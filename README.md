# FinalsPrep Admin

Standalone admin console for FinalsPrep. This app lives in its own repo/subdirectory and connects to the same Firebase and Stripe backend as the student-facing app.

## Quick start

1. Use Node 20+.
2. Copy `.env.example` to `.env.local`.
3. Point the Firebase env vars and `FIREBASE_ADMIN_KEY_B64` at the same project used by `finalsprep`.
4. Run `npm install`.
5. Seed an initial admin:

```bash
npm run seed:super-admin -- --email=ops@finalsprep.com --roles=super_admin
```

6. Start the app:

```bash
npm run dev
```

See [docs/admin-system.md](./docs/admin-system.md) for architecture, schema, RBAC, migration notes, and testing guidance.

