import { Badge } from "@/components/admin/Badge";
import { PageHeader } from "@/components/admin/PageHeader";
import { SectionCard } from "@/components/admin/SectionCard";
import { StatCard } from "@/components/admin/StatCard";
import { ChatHistoryPullPanel } from "@/components/admin/ChatHistoryPullPanel";
import { CopyButton } from "@/components/admin/CopyButton";
import { UserActionConsole } from "@/components/admin/UserActionConsole";
import { UserSupportTools } from "@/components/admin/UserSupportTools";
import { requireAdminContext } from "@/lib/admin/auth";
import { requireDb, collections } from "@/lib/admin/firestore";
import { hasPermission } from "@/lib/admin/permissions";
import { getUserDetail } from "@/lib/admin/queries/users";
import { formatDate, formatNumber, formatUsd } from "@/lib/admin/utils";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const resolvedParams = await params;
  const context = await requireAdminContext();
  const [detail, adminRoleSnap] = await Promise.all([
    getUserDetail(resolvedParams.uid),
    requireDb().collection(collections.adminRoles).doc(resolvedParams.uid).get(),
  ]);

  const adminRoleData = adminRoleSnap.exists ? adminRoleSnap.data() : null;
  const currentAdminRoles = Array.isArray(adminRoleData?.roles)
    ? adminRoleData?.roles
    : Array.isArray(detail.auth.customClaims?.adminRoles)
      ? (detail.auth.customClaims?.adminRoles as string[])
      : [];
  const currentAdminActive =
    typeof adminRoleData?.active === "boolean"
      ? Boolean(adminRoleData.active)
      : Boolean(detail.auth.customClaims?.admin);

  const studiedCourses = Array.from(
    new Set(
      detail.recentEvents
        .map((event) => {
          const meta =
            typeof event.meta === "object" && event.meta !== null
              ? (event.meta as Record<string, unknown>)
              : null;
          return meta?.courseSlug;
        })
        .filter((courseSlug): courseSlug is string => typeof courseSlug === "string")
    )
  );
  const visibleFlags = Object.entries(detail.overlay.flags || {}).filter(([, enabled]) => enabled);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="User detail"
        title={detail.auth.displayName || detail.auth.email || detail.auth.uid}
        description="Full support, billing, and usage view for a single FinalsPrep account. Every mutation below is server-checked and audit logged."
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge tone={detail.billing.plan === "learner" ? "neutral" : "accent"}>{detail.billing.plan}</Badge>
            <Badge tone={detail.billing.status === "active" ? "success" : detail.billing.status === "past_due" ? "danger" : "warning"}>
              {detail.billing.status || "inactive"}
            </Badge>
            {detail.auth.disabled ? <Badge tone="danger">disabled</Badge> : null}
            {visibleFlags.length === 0 ? <Badge tone="neutral">clean</Badge> : null}
            {visibleFlags.map(([key]) => (
              <Badge key={key} tone={key === "banned" || key === "suspicious" ? "danger" : "warning"}>
                {key}
              </Badge>
            ))}
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Token balance" value={formatNumber(detail.tokenBank.balance)} hint={`Lifetime tokens used: ${formatNumber(detail.aiUsage.totalTokens)}`} />
        <StatCard label="AI requests 30d" value={formatNumber(detail.aiUsage.totalRequests)} hint={`Estimated cost ${formatUsd(detail.aiUsage.totalCostUsd)}`} />
        <StatCard label="Last sign-in" value={formatDate(detail.auth.metadata.lastSignInTime)} hint={`Created ${formatDate(detail.auth.metadata.creationTime)}`} />
        <StatCard label="Stripe sync" value={detail.overlay.lastStripeSyncAt ? formatDate(detail.overlay.lastStripeSyncAt) : "Never"} hint={detail.billing.stripeCustomerId ? "Stripe linked" : "No Stripe customer"} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Account snapshot" description="Core identity, billing, usage, and support metadata.">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3 rounded-2xl bg-slate-50 p-4 text-sm text-body">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-ink">Email</span>
                {detail.auth.email ? <CopyButton value={detail.auth.email} /> : null}
              </div>
              <p>{detail.auth.email || "none"}</p>
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-ink">UID</span>
                <CopyButton value={detail.auth.uid} />
              </div>
              <code className="font-mono text-xs">{detail.auth.uid}</code>
              <p>
                Providers:{" "}
                <span className="font-medium text-ink">
                  {detail.auth.providerData.map((provider) => provider.providerId).join(", ") || "unknown"}
                </span>
              </p>
              <p>Email verified: <span className="font-medium text-ink">{detail.auth.emailVerified ? "yes" : "no"}</span></p>
              <p>Referral source: <span className="font-medium text-ink">{detail.overlay.referralSource || "unknown"}</span></p>
              <p>Pricing cohort: <span className="font-medium text-ink">{detail.overlay.pricingCohort || "default"}</span></p>
              <p>Courses studied: <span className="font-medium text-ink">{studiedCourses.join(", ") || "none captured yet"}</span></p>
            </div>

            <div className="space-y-3 rounded-2xl bg-slate-50 p-4 text-sm text-body">
              <p>
                Plan: <span className="font-medium text-ink">{detail.billing.plan}</span>
              </p>
              <p>
                Subscription status: <span className="font-medium text-ink">{detail.billing.status || "inactive"}</span>
              </p>
              <p>
                Renewal date: <span className="font-medium text-ink">{formatDate(detail.billing.currentPeriodEnd)}</span>
              </p>
              <p>
                Cancel at: <span className="font-medium text-ink">{formatDate(detail.billing.cancelAt)}</span>
              </p>
              <p>
                Stripe customer: <span className="font-medium text-ink">{detail.billing.stripeCustomerId || "none"}</span>
              </p>
              <p>
                Stripe subscription: <span className="font-medium text-ink">{detail.billing.stripeSubscriptionId || "none"}</span>
              </p>
              <p>
                Quota override:{" "}
                <span className="font-medium text-ink">
                  {detail.overlay.quotaOverride
                    ? `${detail.overlay.quotaOverride.monthlyTokens ?? "inherit"} tokens / ${detail.overlay.quotaOverride.dailyMessages ?? "inherit"} messages`
                    : "inherit"}
                </span>
              </p>
              <p>
                Unlocked courses: <span className="font-medium text-ink">{detail.overlay.unlockedCourses?.join(", ") || "none"}</span>
              </p>
            </div>
          </div>
        </SectionCard>

        <UserSupportTools
          email={detail.auth.email || null}
          stripeCustomerId={detail.billing.stripeCustomerId || null}
          stripeSubscriptionId={detail.billing.stripeSubscriptionId || null}
          uid={detail.auth.uid}
        />
      </div>

      <ChatHistoryPullPanel
        uid={detail.auth.uid}
        userLabel={detail.auth.email || detail.auth.displayName || detail.auth.uid}
      />

      <UserActionConsole
        canBillingWrite={hasPermission(context.roles, "billing.write")}
        canSuperAdmin={context.roles.includes("super_admin")}
        canSupportWrite={hasPermission(context.roles, "support.write")}
        canUsageWrite={hasPermission(context.roles, "usage.write")}
        currentAdminActive={currentAdminActive}
        currentAdminRoles={currentAdminRoles}
        currentBillingInterval={detail.billing.billingInterval}
        currentEntitlements={{
          betaFeatures: detail.overlay.betaFeatures || [],
          featureFlags: detail.overlay.featureFlags || {},
          unlockedCourses: detail.overlay.unlockedCourses || [],
          unlockedTools: detail.overlay.unlockedTools || [],
        }}
        currentFlags={detail.overlay.flags || {}}
        currentPlan={detail.billing.plan}
        currentQuota={detail.overlay.quotaOverride || null}
        currentStatus={detail.billing.status || "inactive"}
        currentTokenBalance={detail.tokenBank.balance}
        uid={detail.auth.uid}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Internal notes" description="Support context and moderation rationale.">
          <div className="space-y-3">
            {detail.notes.length === 0 ? (
              <p className="text-sm text-body">No internal notes yet.</p>
            ) : (
              detail.notes.map((note) => (
                <div key={note.id} className="rounded-2xl border border-line p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="accent">{note.authorEmail || note.authorUid}</Badge>
                    <Badge tone="neutral">{formatDate(note.createdAt)}</Badge>
                    {(note.tags || []).map((tag) => (
                      <Badge key={tag} tone="neutral">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-body">{note.body}</p>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Manual credit ledger" description="Every manual token adjustment with previous and new values.">
          <div className="space-y-3">
            {detail.ledger.length === 0 ? (
              <p className="text-sm text-body">No manual adjustments recorded.</p>
            ) : (
              detail.ledger.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-line p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={entry.amount >= 0 ? "success" : "danger"}>
                      {entry.amount >= 0 ? "+" : ""}
                      {formatNumber(entry.amount)}
                    </Badge>
                    <Badge tone="neutral">{entry.source}</Badge>
                    <Badge tone="neutral">{formatDate(entry.createdAt)}</Badge>
                  </div>
                  <p className="mt-3 text-sm text-body">
                    {formatNumber(entry.previousValue)} → {formatNumber(entry.newValue)} by{" "}
                    <span className="font-medium text-ink">{entry.actorEmail || entry.actorUid}</span>
                  </p>
                  <p className="mt-1 text-sm leading-6 text-body">{entry.reason}</p>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Recent AI history" description="Latest AI requests stored under the user profile.">
          <div className="space-y-3">
            {detail.recentAiHistory.length === 0 ? (
              <p className="text-sm text-body">No AI history yet.</p>
            ) : (
              detail.recentAiHistory.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-line p-4 text-sm text-body">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="accent">{String(entry.kind || "unknown")}</Badge>
                    <Badge tone="neutral">{String(entry.model || "unknown-model")}</Badge>
                    <Badge tone="neutral">{formatDate(Number(entry.createdAt || 0))}</Badge>
                  </div>
                  <p className="mt-3">
                    Tokens: <span className="font-medium text-ink">{formatNumber(Number(entry.tokens || 0))}</span>
                  </p>
                  <p className="mt-2 leading-6">
                    Prompt: <span className="text-ink">{String(entry.promptPreview || "—")}</span>
                  </p>
                  <p className="mt-2 leading-6">
                    Response: <span className="text-ink">{String(entry.responsePreview || "—")}</span>
                  </p>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Recent events" description="Study, checkout, and usage events from the shared event stream.">
          <div className="space-y-3">
            {detail.recentEvents.length === 0 ? (
              <p className="text-sm text-body">No recent events recorded.</p>
            ) : (
              detail.recentEvents.map((event) => (
                <div key={event.id} className="rounded-2xl border border-line p-4 text-sm text-body">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="accent">{String(event.kind || "unknown")}</Badge>
                    <Badge tone="neutral">{formatDate(Number(event.at || 0))}</Badge>
                    {typeof event.plan === "string" ? <Badge tone="neutral">{event.plan}</Badge> : null}
                  </div>
                  <p className="mt-3 leading-6">
                    Meta:{" "}
                    <span className="font-mono text-xs text-ink">
                      {JSON.stringify(event.meta || {}, null, 0)}
                    </span>
                  </p>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
