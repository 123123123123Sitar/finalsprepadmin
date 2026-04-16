import { Badge } from "@/components/admin/Badge";
import { PageHeader } from "@/components/admin/PageHeader";
import { SectionCard } from "@/components/admin/SectionCard";
import { SimpleBarChart } from "@/components/admin/SimpleBarChart";
import { StatCard } from "@/components/admin/StatCard";
import { getOverviewMetrics } from "@/lib/admin/queries/overview";
import { getUsageTimeseries } from "@/lib/admin/queries/usage";
import { formatNumber, formatPercent, formatUsd } from "@/lib/admin/utils";

export default async function AdminOverviewPage() {
  const [metrics, usageTimeseries] = await Promise.all([
    getOverviewMetrics(),
    getUsageTimeseries(14),
  ]);

  const tokenSeries = usageTimeseries.slice(-10).map((point) => ({
    name: point.label,
    value: point.tokens,
  }));
  const costSeries = usageTimeseries.slice(-10).map((point) => ({
    name: point.label,
    value: point.costUsd,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="FinalsPrep operator dashboard"
        description="A shared admin console for growth, billing, AI-cost control, content readiness, and support risk. These figures come from Firebase Auth, Firestore activity logs, and Stripe where available."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total users" tone="accent" value={formatNumber(metrics.totalUsers)} hint={`${formatNumber(metrics.totalPaidUsers)} paid accounts`} />
        <StatCard label="DAU / WAU / MAU" value={`${formatNumber(metrics.dau)} / ${formatNumber(metrics.wau)} / ${formatNumber(metrics.mau)}`} hint="Distinct active users from recent event logs" />
        <StatCard label="Free to paid" tone="success" value={formatPercent(metrics.freeToPaidConversionRate)} hint={`${formatNumber(metrics.recentSignups7d)} signups in the last 7 days`} />
        <StatCard label="30d AI cost" tone="warning" value={formatUsd(metrics.estimatedAiCost30d)} hint={`${formatNumber(metrics.totalTokensUsed30d)} tokens across ${formatNumber(metrics.totalAiRequests30d)} requests`} />
        <StatCard label="MRR / ARR" tone="success" value={`${formatUsd(metrics.revenue.mrr)} / ${formatUsd(metrics.revenue.arr)}`} hint={`${formatNumber(metrics.revenue.activeSubscriptions)} active subscriptions`} />
        <StatCard label="Failed payments" tone={metrics.revenue.failedPayments > 0 ? "danger" : "neutral"} value={formatNumber(metrics.revenue.failedPayments)} hint={`${formatNumber(metrics.revenue.openInvoices)} open invoices`} />
        <StatCard label="Churn 30d" tone={metrics.churnedSubscriptions30d > 0 ? "warning" : "neutral"} value={formatNumber(metrics.churnedSubscriptions30d)} hint={`${formatNumber(metrics.revenue.cancelAtPeriodEnd)} cancel at period end`} />
        <StatCard label="Reliability gap" value="Session time not tracked" hint="Add client heartbeat/session instrumentation if this becomes operationally important." />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="AI usage trend"
          description="Daily token burn and estimated cost from `userUsageDaily` snapshots. Use this to catch spend spikes before they become billing surprises."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-4 text-sm font-medium text-ink">Tokens</p>
              <SimpleBarChart items={tokenSeries} />
            </div>
            <div>
              <p className="mb-4 text-sm font-medium text-ink">Estimated cost</p>
              <SimpleBarChart items={costSeries} mode="usd" />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="System status"
          description="Operational checks for the dependencies this console relies on."
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3">
              <span className="text-sm font-medium text-ink">Firebase Admin</span>
              <Badge tone={metrics.systemStatus.firebaseAdmin ? "success" : "danger"}>
                {metrics.systemStatus.firebaseAdmin ? "healthy" : "down"}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3">
              <span className="text-sm font-medium text-ink">Stripe connectivity</span>
              <Badge tone={metrics.systemStatus.stripe ? "success" : "warning"}>
                {metrics.systemStatus.stripe ? "healthy" : "not configured"}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3">
              <span className="text-sm font-medium text-ink">Content source mirror</span>
              <Badge tone={metrics.systemStatus.contentSourceAvailable ? "success" : "warning"}>
                {metrics.systemStatus.contentSourceAvailable ? "available" : "missing"}
              </Badge>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-body">
              Last content-health sync:{" "}
              <span className="font-medium text-ink">
                {metrics.systemStatus.lastContentHealthSyncAt
                  ? new Date(metrics.systemStatus.lastContentHealthSyncAt).toLocaleString()
                  : "never"}
              </span>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-body">
              Support indicators: {formatNumber(metrics.suspiciousUsers)} suspicious users,{" "}
              {formatNumber(metrics.supportHotUsers)} priority/VIP accounts,{" "}
              {formatNumber(metrics.recentAuditCount24h)} admin actions in the last 24h.
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard title="Course demand" description="Course popularity from study and lesson activity.">
          <SimpleBarChart items={metrics.popularCourses} />
        </SectionCard>
        <SectionCard title="Unit demand" description="High-traffic units to prioritize when support or content fixes land.">
          <SimpleBarChart items={metrics.popularUnits} />
        </SectionCard>
        <SectionCard title="Feature activity" description="Most-used product actions tracked in the event stream.">
          <SimpleBarChart items={metrics.featureUsage} />
        </SectionCard>
      </div>
    </div>
  );
}

