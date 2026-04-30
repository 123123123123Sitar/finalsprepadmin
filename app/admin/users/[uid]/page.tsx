import { Badge } from "@/components/admin/Badge";
import { PageHeader } from "@/components/admin/PageHeader";
import { SectionCard } from "@/components/admin/SectionCard";
import { StatCard } from "@/components/admin/StatCard";
import { ChatHistoryPullPanel } from "@/components/admin/ChatHistoryPullPanel";
import { CopyButton } from "@/components/admin/CopyButton";
import { UserActionConsole } from "@/components/admin/UserActionConsole";
import { UserSupportTools } from "@/components/admin/UserSupportTools";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireAdminContext } from "@/lib/admin/auth";
import { requireDb, collections } from "@/lib/admin/firestore";
import { hasPermission } from "@/lib/admin/permissions";
import { getUserDetail } from "@/lib/admin/queries/users";
import { formatDate, formatNumber, formatUsd } from "@/lib/admin/utils";

function initials(input: string | null | undefined) {
  if (!input) return "?";
  const trimmed = input.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/[\s@._-]/g).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

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
  const headerLabel = detail.auth.displayName || detail.auth.email || detail.auth.uid;

  const canShowActions =
    hasPermission(context.roles, "users.write") ||
    hasPermission(context.roles, "support.write") ||
    hasPermission(context.roles, "usage.write") ||
    context.roles.includes("super_admin");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="User detail"
        title={headerLabel}
        description="Full support, billing, and usage view for a single FinalsPrep account. Every mutation below is server-checked and audit logged."
      />

      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-primary text-lg text-primary-foreground">
                {initials(detail.auth.displayName || detail.auth.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold text-foreground">
                {detail.auth.displayName || "Unnamed user"}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {detail.auth.email || "no email"}
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground/80">
                {detail.auth.uid}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={detail.billing.plan === "learner" ? "neutral" : "accent"}>
              {detail.billing.plan}
            </Badge>
            <Badge
              tone={
                detail.billing.status === "active"
                  ? "success"
                  : detail.billing.status === "past_due"
                    ? "danger"
                    : "warning"
              }
            >
              {detail.billing.status || "inactive"}
            </Badge>
            {detail.auth.disabled ? <Badge tone="danger">disabled</Badge> : null}
            {visibleFlags.length === 0 ? <Badge tone="success">clean</Badge> : null}
            {visibleFlags.map(([key]) => (
              <Badge
                key={key}
                tone={key === "banned" || key === "suspicious" ? "danger" : "warning"}
              >
                {key}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="billing">Billing state</TabsTrigger>
          <TabsTrigger value="notes">Notes & ledger</TabsTrigger>
          <TabsTrigger value="ai">AI history</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
          {canShowActions ? <TabsTrigger value="actions">Actions</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Daily budget"
              value={`${formatNumber(detail.dailyTokens.remaining)} / ${formatNumber(detail.dailyTokens.cap)}`}
              hint={`Used last 24h: ${formatNumber(detail.dailyTokens.used)} units (${detail.billing.plan} plan)`}
            />
            <StatCard
              label="Bonus tokens"
              value={formatNumber(detail.tokenBank.balance)}
              hint={`Lifetime billing units: ${formatNumber(detail.aiUsage.totalTokens)}`}
            />
            {(() => {
              const rawTotal =
                detail.aiUsage.totalInputTokens + detail.aiUsage.totalOutputTokens;
              if (rawTotal > 0) {
                return (
                  <StatCard
                    label="API tokens 30d"
                    value={formatNumber(rawTotal)}
                    hint={`${formatNumber(detail.aiUsage.totalInputTokens)} in · ${formatNumber(detail.aiUsage.totalOutputTokens)} out · ${formatNumber(detail.aiUsage.totalRequests)} requests · ${formatUsd(detail.aiUsage.totalCostUsd)}`}
                  />
                );
              }
              return (
                <StatCard
                  label="Activity 30d"
                  value={`${formatNumber(detail.aiUsage.totalTokens)} units`}
                  hint={`${formatNumber(detail.aiUsage.totalRequests)} requests · ${formatUsd(detail.aiUsage.totalCostUsd)}`}
                />
              );
            })()}
            <StatCard
              label="Last sign-in"
              value={formatDate(detail.auth.metadata.lastSignInTime)}
              hint={`Created ${formatDate(detail.auth.metadata.creationTime)}`}
            />
          </section>

          <SectionCard
            title="Account snapshot"
            description="Core identity, providers, and study summary."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-foreground">Email</span>
                  {detail.auth.email ? <CopyButton value={detail.auth.email} /> : null}
                </div>
                <p>{detail.auth.email || "none"}</p>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-foreground">UID</span>
                  <CopyButton value={detail.auth.uid} />
                </div>
                <code className="block font-mono text-xs">{detail.auth.uid}</code>
                <p>
                  Providers:{" "}
                  <span className="font-medium text-foreground">
                    {detail.auth.providerData
                      .map((provider) => provider.providerId)
                      .join(", ") || "unknown"}
                  </span>
                </p>
                <p>
                  Email verified:{" "}
                  <span className="font-medium text-foreground">
                    {detail.auth.emailVerified ? "yes" : "no"}
                  </span>
                </p>
                <p>
                  Referral source:{" "}
                  <span className="font-medium text-foreground">
                    {detail.overlay.referralSource || "unknown"}
                  </span>
                </p>
                <p>
                  Pricing cohort:{" "}
                  <span className="font-medium text-foreground">
                    {detail.overlay.pricingCohort || "default"}
                  </span>
                </p>
                <p>
                  Courses studied:{" "}
                  <span className="font-medium text-foreground">
                    {studiedCourses.join(", ") || "none captured yet"}
                  </span>
                </p>
              </div>

              <div className="space-y-3 rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
                <p>
                  Plan:{" "}
                  <span className="font-medium text-foreground">
                    {detail.billing.plan}
                  </span>
                </p>
                <p>
                  Quota override:{" "}
                  <span className="font-medium text-foreground">
                    {detail.overlay.quotaOverride
                      ? `${detail.overlay.quotaOverride.monthlyTokens ?? "inherit"} tokens / ${detail.overlay.quotaOverride.dailyMessages ?? "inherit"} messages`
                      : "inherit"}
                  </span>
                </p>
                <p>
                  Beta features:{" "}
                  <span className="font-medium text-foreground">
                    {detail.overlay.betaFeatures?.join(", ") || "none"}
                  </span>
                </p>
                <p>
                  Unlocked courses:{" "}
                  <span className="font-medium text-foreground">
                    {detail.overlay.unlockedCourses?.join(", ") || "none"}
                  </span>
                </p>
                <p>
                  Unlocked tools:{" "}
                  <span className="font-medium text-foreground">
                    {detail.overlay.unlockedTools?.join(", ") || "none"}
                  </span>
                </p>
                <p>
                  Support tier:{" "}
                  <span className="font-medium text-foreground">
                    {detail.overlay.supportTier || "normal"}
                  </span>
                </p>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="billing">
          <SectionCard
            title="Subscription state"
            description="From `users/{uid}/profile/billing` (Firestore). The student app keeps this in sync after checkout."
          >
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                { label: "Plan", value: detail.billing.plan },
                {
                  label: "Status",
                  value: detail.billing.status || "inactive",
                },
                {
                  label: "Billing interval",
                  value: detail.billing.billingInterval || "—",
                },
                {
                  label: "Current period end",
                  value: formatDate(detail.billing.currentPeriodEnd),
                },
                {
                  label: "Cancel at",
                  value: formatDate(detail.billing.cancelAt),
                },
                {
                  label: "Canceled at",
                  value: formatDate(detail.billing.canceledAt),
                },
                {
                  label: "Trial ends",
                  value: formatDate(detail.billing.trialEndsAt),
                },
                {
                  label: "Last updated",
                  value: formatDate(detail.billing.updatedAt),
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className="rounded-lg border bg-card p-4"
                >
                  <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {row.label}
                  </dt>
                  <dd className="mt-1.5 text-sm font-medium text-foreground">
                    {row.value || "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </SectionCard>
        </TabsContent>

        <TabsContent value="notes" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              title="Internal notes"
              description="Support context and moderation rationale."
            >
              <div className="space-y-3">
                {detail.notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No internal notes yet.
                  </p>
                ) : (
                  detail.notes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-lg border bg-card p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="accent">
                          {note.authorEmail || note.authorUid}
                        </Badge>
                        <Badge tone="neutral">{formatDate(note.createdAt)}</Badge>
                        {(note.tags || []).map((tag) => (
                          <Badge key={tag} tone="neutral">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-foreground">
                        {note.body}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Manual credit ledger"
              description="Every manual token adjustment with previous and new values."
            >
              <div className="space-y-3">
                {detail.ledger.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No manual adjustments recorded.
                  </p>
                ) : (
                  detail.ledger.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-lg border bg-card p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={entry.amount >= 0 ? "success" : "danger"}>
                          {entry.amount >= 0 ? "+" : ""}
                          {formatNumber(entry.amount)}
                        </Badge>
                        <Badge tone="neutral">{entry.source}</Badge>
                        <Badge tone="neutral">
                          {formatDate(entry.createdAt)}
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">
                        {formatNumber(entry.previousValue)} →{" "}
                        {formatNumber(entry.newValue)} by{" "}
                        <span className="font-medium text-foreground">
                          {entry.actorEmail || entry.actorUid}
                        </span>
                      </p>
                      <p className="mt-1 text-sm leading-6 text-foreground">
                        {entry.reason}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="ai">
          <SectionCard
            title="Recent AI history"
            description="Latest AI requests stored under the user profile."
          >
            <div className="space-y-3">
              {detail.recentAiHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No AI history yet.
                </p>
              ) : (
                detail.recentAiHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-lg border bg-card p-4 text-sm text-muted-foreground"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="accent">
                        {String(entry.kind || "unknown")}
                      </Badge>
                      <Badge tone="neutral">
                        {String(entry.model || "unknown-model")}
                      </Badge>
                      <Badge tone="neutral">
                        {formatDate(Number(entry.createdAt || 0))}
                      </Badge>
                    </div>
                    <p className="mt-3">
                      Tokens:{" "}
                      <span className="font-medium text-foreground">
                        {formatNumber(Number(entry.tokens || 0))}
                      </span>
                    </p>
                    <p className="mt-2 leading-6">
                      Prompt:{" "}
                      <span className="text-foreground">
                        {String(entry.promptPreview || "—")}
                      </span>
                    </p>
                    <p className="mt-2 leading-6">
                      Response:{" "}
                      <span className="text-foreground">
                        {String(entry.responsePreview || "—")}
                      </span>
                    </p>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="events">
          <SectionCard
            title="Recent events"
            description="Study, checkout, and usage events from the shared event stream."
          >
            <div className="space-y-3">
              {detail.recentEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No recent events recorded.
                </p>
              ) : (
                detail.recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-lg border bg-card p-4 text-sm text-muted-foreground"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="accent">
                        {String(event.kind || "unknown")}
                      </Badge>
                      <Badge tone="neutral">
                        {formatDate(Number(event.at || 0))}
                      </Badge>
                      {typeof event.plan === "string" ? (
                        <Badge tone="neutral">{event.plan}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-3 leading-6">
                      Meta:{" "}
                      <span className="font-mono text-xs text-foreground">
                        {JSON.stringify(event.meta || {}, null, 0)}
                      </span>
                    </p>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="support" className="space-y-6">
          <UserSupportTools email={detail.auth.email || null} uid={detail.auth.uid} />
          <ChatHistoryPullPanel
            uid={detail.auth.uid}
            userLabel={detail.auth.email || detail.auth.displayName || detail.auth.uid}
          />
        </TabsContent>

        {canShowActions ? (
          <TabsContent value="actions">
            <UserActionConsole
              canUsersWrite={hasPermission(context.roles, "users.write")}
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
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
