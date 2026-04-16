import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { SectionCard } from "@/components/admin/SectionCard";
import { SimpleBarChart } from "@/components/admin/SimpleBarChart";
import { StatCard } from "@/components/admin/StatCard";
import { getOverviewMetrics } from "@/lib/admin/queries/overview";
import { getHeavyUsers, getUsageBreakdownByRoute, getUsageTimeseries } from "@/lib/admin/queries/usage";
import { formatNumber, formatPercent, formatUsd } from "@/lib/admin/utils";

export default async function AdminUsagePage() {
  const [overview, timeseries, heavyUsers, byRoute] = await Promise.all([
    getOverviewMetrics(),
    getUsageTimeseries(30),
    getHeavyUsers(20),
    getUsageBreakdownByRoute(30),
  ]);

  const totalRequests = timeseries.reduce((sum, point) => sum + point.requests, 0);
  const failedRequests = timeseries.reduce((sum, point) => sum + point.failedRequests, 0);
  const topFiveTokens = heavyUsers.slice(0, 5).reduce((sum, user) => sum + user.tokens, 0);
  const topFiveShare =
    overview.totalTokensUsed30d === 0 ? 0 : (topFiveTokens / overview.totalTokensUsed30d) * 100;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Usage"
        title="AI usage and cost controls"
        description="Usage snapshots track token burn, route mix, heavy users, and estimated cost. This is the page to check before a model rollout or quota-policy change."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="30d tokens" tone="accent" value={formatNumber(overview.totalTokensUsed30d)} hint={`${formatNumber(overview.totalMessages30d)} messages logged`} />
        <StatCard label="30d requests" value={formatNumber(totalRequests)} hint={`${formatNumber(failedRequests)} failed requests in aggregated usage docs`} />
        <StatCard label="30d cost" tone="warning" value={formatUsd(overview.estimatedAiCost30d)} hint={`${formatNumber(byRoute.length)} endpoints tracked`} />
        <StatCard label="Top-5 user share" tone={topFiveShare >= 35 ? "danger" : "neutral"} value={formatPercent(topFiveShare)} hint="Share of 30d tokens consumed by the five heaviest users" />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Daily tokens" description="Token burn over the last 30 days from `userUsageDaily`.">
          <SimpleBarChart
            items={timeseries.map((point) => ({
              name: point.label,
              value: point.tokens,
            }))}
          />
        </SectionCard>
        <SectionCard title="Daily cost" description="Estimated dollar cost over the same window.">
          <SimpleBarChart
            items={timeseries.map((point) => ({
              name: point.label,
              value: point.costUsd,
            }))}
            mode="usd"
          />
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Heavy users" description="Top AI consumers over the last 30 days. Review for abuse, coupon leakage, or high-touch enterprise candidates.">
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.18em] text-mute">
                  <th className="pb-2">UID</th>
                  <th className="pb-2">Requests</th>
                  <th className="pb-2">Tokens</th>
                  <th className="pb-2">Cost</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {heavyUsers.map((user) => (
                  <tr key={user.uid} className="bg-white shadow-panel">
                    <td className="rounded-l-2xl border-y border-l border-line px-4 py-4 font-mono text-xs text-body">
                      {user.uid}
                    </td>
                    <td className="border-y border-line px-4 py-4 text-sm text-body">{formatNumber(user.requests)}</td>
                    <td className="border-y border-line px-4 py-4 text-sm text-body">{formatNumber(user.tokens)}</td>
                    <td className="border-y border-line px-4 py-4 text-sm text-body">{formatUsd(user.costUsd)}</td>
                    <td className="rounded-r-2xl border-y border-r border-line px-4 py-4">
                      <Link className="admin-button-secondary" href={`/admin/users/${user.uid}`}>
                        Open user
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Cost guardrails" description="Quick heuristics for suspicious usage and runaway spend.">
          <div className="space-y-4 text-sm text-body">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-medium text-ink">Failure rate</p>
              <p className="mt-2">
                {formatPercent(totalRequests === 0 ? 0 : (failedRequests / totalRequests) * 100)}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-medium text-ink">Shared-account risk</p>
              <p className="mt-2">
                High-consumption clusters are easier to inspect from the heavy-user table, especially
                when combined with suspicious or test-account flags on the user detail page.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-medium text-ink">Missing diagnostics</p>
              <p className="mt-2">
                Retry counts and route latency are not yet emitted by the student app. The admin schema
                already has room for them in `userUsageDaily` if you add that instrumentation.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Endpoint breakdown" description="Usage grouped by logical route or feature.">
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.18em] text-mute">
                <th className="pb-2">Route</th>
                <th className="pb-2">Requests</th>
                <th className="pb-2">Tokens</th>
                <th className="pb-2">Cost</th>
              </tr>
            </thead>
            <tbody>
              {byRoute.map((route) => (
                <tr key={route.route} className="bg-white shadow-panel">
                  <td className="rounded-l-2xl border-y border-l border-line px-4 py-4 font-mono text-xs text-body">
                    {route.route}
                  </td>
                  <td className="border-y border-line px-4 py-4 text-sm text-body">{formatNumber(route.requests)}</td>
                  <td className="border-y border-line px-4 py-4 text-sm text-body">{formatNumber(route.tokens)}</td>
                  <td className="rounded-r-2xl border-y border-r border-line px-4 py-4 text-sm text-body">{formatUsd(route.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

