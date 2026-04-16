# FinalsPrep Admin System

## Implementation plan

1. Isolate the admin surface in its own Next.js 14 app so operational tooling does not share runtime or deployment risk with the student product.
2. Reuse the same Firebase Auth, Firestore, and Stripe sources of truth as `finalsprep`.
3. Enforce admin access server-side with Firebase session cookies, Firestore-backed admin role documents, and custom claims.
4. Split permissions by operational domain: support, content, billing, usage, and super-admin.
5. Keep the query layer separate from pages so dashboards and API routes share the same typed data access code.
6. Keep all sensitive mutations behind route handlers that validate payloads with Zod and always write audit logs.
7. Model product settings, feature flags, user overlays, content health, and credit adjustments as Firestore-native documents rather than hard-coded config.
8. Document the remaining student-app integration steps so the admin app becomes the control plane for the wider platform.

## Added structure

```text
finalsprep-admin/
  app/
    admin/
      audit-logs/
      billing/
      content/
      settings/
      usage/
      users/
      layout.tsx
      loading.tsx
      error.tsx
      page.tsx
    api/
      admin/
        audit-logs/
        billing/
        content/
        overview/
        settings/
        support-summary/
        usage/
        users/
      auth/
        logout/
        session/
    signin/
  components/
    admin/
      AdminSidebar.tsx
      AdminTopbar.tsx
      AdminUserMenu.tsx
      Badge.tsx
      ContentControls.tsx
      CopyButton.tsx
      EmptyState.tsx
      PageHeader.tsx
      SectionCard.tsx
      SettingsEditor.tsx
      SimpleBarChart.tsx
      StatCard.tsx
      UserActionConsole.tsx
      UserSupportTools.tsx
    auth/
      AdminAuthProvider.tsx
      AdminSignInForm.tsx
  docs/
    admin-system.md
  lib/
    admin/
      actions.ts
      audit.ts
      auth.ts
      content-health.ts
      firestore.ts
      permissions.ts
      plans.ts
      queries/
      session.ts
      stripe.ts
      types.ts
      usage-costs.ts
      utils.ts
    firebase-admin.ts
    firebase-client.ts
  scripts/
    seed-super-admin.ts
```

## Permission model

### Roles

- `readonly_admin`
- `support_admin`
- `content_admin`
- `billing_admin`
- `super_admin`

### Permission mapping

- `readonly_admin`
  - Dashboard, users, billing, usage, content, settings, and audit read access only.
- `support_admin`
  - User read access plus notes, moderation flags, and manual entitlement changes.
- `content_admin`
  - Content health, course visibility, draft/publish state, and content refresh operations.
- `billing_admin`
  - Plan overrides, Stripe sync, invoice oversight, token-credit fixes, and quota operations.
- `super_admin`
  - Full platform control including settings, feature flags, and admin role assignment.

### Server-side enforcement

- Admin pages use `requireAdminContext()` which reads the signed admin session cookie, verifies it with Firebase Admin, merges Firestore `adminRoles/{uid}` and custom claims, and redirects unauthorized users to `/signin`.
- Admin APIs use `requireApiAdminContext()` so route handlers fail closed even if a user discovers the endpoint.
- `runAdminMutation()` applies action-level RBAC:
  - support actions require `support.write`
  - billing actions require `billing.write`
  - credit/quota actions require `usage.write`
  - role assignment requires `super_admin`

## Firestore schema

### Existing student-app collections reused

- `users/{uid}/profile/billing`
  - Current plan, interval, Stripe ids, renewal/cancel timestamps, cached subscription state.
- `users/{uid}/profile/tokenBank`
  - Bonus or manually-granted AI credits.
- `users/{uid}/aiHistory/{entryId}`
  - Request history, model, token counts, metadata.
- `events/{eventId}`
  - Lightweight activity events for signups, study, usage, and limits.

### Admin collections added

- `adminRoles/{uid}`
  - `uid`, `email`, `displayName`, `roles[]`, `active`, `note`, `createdAt`, `updatedAt`, `updatedBy`
- `adminUsers/{uid}`
  - Overlay document for flags, manual plan overrides, quota overrides, support tier, feature flags, beta toggles, manual unlocks, referral data, and Stripe sync metadata.
- `adminNotes/{noteId}`
  - `targetUid`, `authorUid`, `authorEmail`, `body`, `tags[]`, `createdAt`
- `adminAuditLogs/{logId}`
  - `action`, `actorUid`, `actorEmail`, `actorRoles[]`, `targetType`, `targetId`, `reason`, `status`, `before`, `after`, `metadata`, `ip`, `userAgent`, `createdAt`
- `manualCreditAdjustments/{entryId}`
  - `uid`, `amount`, `reason`, `previousValue`, `newValue`, `source`, `actorUid`, `actorEmail`, `createdAt`
- `featureFlags/{key}`
  - `enabled`, `description`, `rollout.strategy`, `rollout.value`, `updatedAt`, `updatedBy`
- `platformSettings/current`
  - maintenance, announcements, AI routing defaults, quota defaults, trials, pricing, release toggles, referral policy, abuse guardrails, content visibility config, support contact, legal notices
- `platformSettings/contentHealthMeta`
  - last sync timestamp and actor for the computed content-health snapshot
- `userUsageDaily/{compositeKey}`
  - per-user or per-day aggregate metrics such as `dateKey`, `tokens`, `costUsd`, `requests`, `failedRequests`, `messages`, `routes`
- `contentHealth/{courseSlug}`
  - `totalUnits`, `totalTopics`, completeness counts, missing-unit/topic arrays, stale signals

## Minimal indexes to add

- `adminAuditLogs`
  - `createdAt desc`
  - `targetId asc, createdAt desc`
  - `actorUid asc, createdAt desc`
  - `action asc, createdAt desc`
- `adminNotes`
  - `targetUid asc, createdAt desc`
- `manualCreditAdjustments`
  - `uid asc, createdAt desc`
- `events`
  - `uid asc, at desc`
  - `kind asc, at desc`
- `userUsageDaily`
  - `dateKey asc`

## Sensitive actions and audit logging

Every write path records:

- acting admin uid and email
- actor roles
- target entity type and id
- action type
- before and after payloads when applicable
- freeform reason
- success or failure
- request metadata such as IP and user agent when available

## Seed an initial super admin

Use the included script after setting `FIREBASE_ADMIN_KEY_B64`:

```bash
npm run seed:super-admin -- --email=ops@finalsprep.com --roles=super_admin
```

You can also seed by uid:

```bash
npm run seed:super-admin -- --uid=<firebase-uid> --roles=super_admin,billing_admin
```

The script writes `adminRoles/{uid}` and sets Firebase custom claims:

- `admin: true`
- `adminRoles: [...]`

## Safe testing checklist

1. Start with a staging Firebase project and Stripe test key.
2. Seed one super admin and one read-only admin.
3. Verify non-admin users are redirected away from `/admin`.
4. Verify non-admin requests to `/api/admin/*` return `401` or `403`.
5. Exercise:
   - note creation
   - plan override
   - token adjustment
   - Stripe sync
   - feature-flag update
   - content-health refresh
6. Confirm each mutation produced an `adminAuditLogs` entry.
7. Confirm `manualCreditAdjustments` entries appear for token changes.
8. Confirm disabled/banned accounts are blocked at Firebase Auth.
9. Confirm billing-risk and usage pages still load with missing Stripe data.

## Migration steps for the student app

The admin app is already writing platform control data, but the student app still needs to consume some of it for full effect.

### High-priority integrations in `finalsprep`

- Read `platformSettings/current.maintenanceMode` and `release.studentAppReadOnly` to gate student traffic during incidents.
- Read `platformSettings/current.content.courseVisibility`, `draftCourseSlugs`, and `hiddenTopicIds` when building the study catalog.
- Read `featureFlags/*` and `adminUsers/{uid}.featureFlags` for cohort rollouts and support overrides.
- Respect `adminUsers/{uid}.manualPlanOverride` and `quotaOverride` in `lib/userPlan.ts` and rate-limit code.
- Emit `userUsageDaily` aggregates from AI routes so usage analytics become precise rather than inferred from `aiHistory`.
- Emit route latency, retries, and model/provider info into `userUsageDaily.routes`.

### Recommended reliability additions

- Add Stripe webhook health status into Firestore so the admin overview can show webhook drift.
- Add coupon/redemption documents so coupon-abuse detection has a real source.
- Add device/session fingerprint events if shared-account detection is required.
- Add lesson completion and progress-dropoff events for deeper content analytics.

## Product-specific extras already included

- Manual token-credit ledger for AI-cost products
- Stripe sync and billing-risk queue for subscription support
- Per-user entitlement overrides for course/tool unlocks
- Shadow restriction and suspicious-account flags for abuse moderation
- Content health computation against the live `finalsprep` source tree
- Feature-flag framework with rollout strategies
- Support-summary generation and account export tooling

## Runtime assumptions

- Node 20+ is recommended. The current `firebase` client dependency warns on Node 18.
- This admin app expects the same Firebase project and Stripe account as the student app.
- The app is intentionally dynamic and server-verified; it should not be statically exported.

