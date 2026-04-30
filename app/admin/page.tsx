import { Badge } from "@/components/admin/Badge";
import { PageHeader } from "@/components/admin/PageHeader";
import { SectionCard } from "@/components/admin/SectionCard";
import { SimpleBarChart } from "@/components/admin/SimpleBarChart";
import { StatCard } from "@/components/admin/StatCard";
import { PlanDistribution } from "@/components/admin/PlanDistribution";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const signupSeries = metrics.signupTrend14d.map((point) => ({
    name: point.dateKey.slice(5),
    value: point.signups,
  }));
  const planDistributionBars = [
    { name: "Learner", value: metrics.planDistribution.learner },
    { name: "Pro", value: metrics.planDistribution.pro },
    { name: "Hacker", value: metrics.planDistribution.hacker },
  ];
  const activeByPlanBars = [
    { name: "Learner (7d)", value: metrics.activeByPlan7d.learner },
    { name: "Pro (7d)", value: metrics.activeByPlan7d.pro },
    { name: "Hacker (7d)", value: metrics.activeByPlan7d.hacker },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="FinalsPrep operator dashboard"
        description="Shared admin console for growth, AI-cost control, content readiness, and support risk. Figures come from Firebase Auth and Firestore activity logs."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Total users"
          tone="accent"
          value={formatNumber(metrics.totalUsers)}
          hint={`${formatNumber(metrics.totalPaidUsers)} paid · ${formatNumber(metrics.freeUsers)} free`}
        />
        <StatCard
          label="DAU / WAU / MAU"
          value={`${formatNumber(metrics.dau)} / ${formatNumber(metrics.wau)} / ${formatNumber(metrics.mau)}`}
          hint="Distinct active users from the 30d event stream"
        />
        <StatCard
          label="Free → paid"
          tone="success"
          value={formatPercent(metrics.freeToPaidConversionRate)}
          hint={`${formatNumber(metrics.recentSignups7d)} signups · last 7d`}
        />
        <StatCard
          label="30d AI cost"
          tone="warning"
          value={formatUsd(metrics.estimatedAiCost30d)}
          hint={`${formatNumber(metrics.totalTokensUsed30d)} tokens · ${formatNumber(metrics.totalAiRequests30d)} requests`}
        />
        <StatCard
          label="Churn 30d"
          tone={metrics.churnedSubscriptions30d > 0 ? "warning" : "neutral"}
          value={formatNumber(metrics.churnedSubscriptions30d)}
          hint="Subscriptions canceled in last 30d"
        />
        <StatCard
          label="Cost per MAU"
          tone="neutral"
          value={formatUsd(metrics.costPerActiveMau)}
          hint="30d AI spend ÷ monthly active users"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Plan mix"
          description="Paid vs. free distribution across all Firebase Auth accounts."
        >
          <PlanDistribution
            distribution={metrics.planDistribution}
            totalUsers={metrics.totalUsers}
          />
        </SectionCard>

        <SectionCard
          title="System status"
          description="Operational checks for the dependencies this console relies on."
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
              <span className="text-sm font-medium text-foreground">
                Firebase Admin
              </span>
              <Badge tone={metrics.systemStatus.firebaseAdmin ? "success" : "danger"}>
                {metrics.systemStatus.firebaseAdmin ? "healthy" : "down"}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
              <span className="text-sm font-medium text-foreground">
                Content source mirror
              </span>
              <Badge tone={metrics.systemStatus.contentSourceAvailable ? "success" : "warning"}>
                {metrics.systemStatus.contentSourceAvailable ? "available" : "missing"}
              </Badge>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
              Last content-health sync:{" "}
              <span className="font-medium text-foreground">
                {metrics.systemStatus.lastContentHealthSyncAt
                  ? new Date(metrics.systemStatus.lastContentHealthSyncAt).toLocaleString()
                  : "never"}
              </span>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
              Support indicators: {formatNumber(metrics.suspiciousUsers)} suspicious ·{" "}
              {formatNumber(metrics.supportHotUsers)} priority/VIP ·{" "}
              {formatNumber(metrics.recentAuditCount24h)} admin actions / 24h
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="AI usage trend (14 days)"
          description="Daily token burn and estimated cost from userUsageDaily snapshots. Use this to catch spend spikes before they become billing surprises."
        >
          <Tabs defaultValue="tokens" className="space-y-4">
            <TabsList>
              <TabsTrigger value="tokens">Tokens</TabsTrigger>
              <TabsTrigger value="cost">Estimated cost</TabsTrigger>
            </TabsList>
            <TabsContent value="tokens">
              <SimpleBarChart items={tokenSeries} />
            </TabsContent>
            <TabsContent value="cost">
              <SimpleBarChart items={costSeries} mode="usd" />
            </TabsContent>
          </Tabs>
        </SectionCard>

        <SectionCard
          title="Signup trend (14 days)"
          description={`${formatNumber(metrics.recentSignups30d)} signups in the last 30d from the event stream.`}
        >
          <SimpleBarChart items={signupSeries} />
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard title="Plan counts" description="Exact account counts per tier.">
          <SimpleBarChart items={planDistributionBars} />
        </SectionCard>
        <SectionCard
          title="Active users by plan (7d)"
          description="Who showed up in the last week, grouped by plan tag on the event."
        >
          <SimpleBarChart items={activeByPlanBars} />
        </SectionCard>
        <SectionCard
          title="Paid billing cadence"
          description="Active paid subscriptions grouped by billing interval."
        >
          {metrics.paidCohorts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No paid subscribers yet.</p>
          ) : (
            <SimpleBarChart items={metrics.paidCohorts} />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard
          title="Course demand"
          description="Course popularity from study and lesson activity."
        >
          <SimpleBarChart items={metrics.popularCourses} />
        </SectionCard>
        <SectionCard
          title="Unit demand"
          description="High-traffic units to prioritize when support or content fixes land."
        >
          <SimpleBarChart items={metrics.popularUnits} />
        </SectionCard>
        <SectionCard
          title="Feature activity"
          description="Most-used product actions tracked in the event stream."
        >
          <SimpleBarChart items={metrics.featureUsage} />
        </SectionCard>
      </div>
    </div>
  );
}
