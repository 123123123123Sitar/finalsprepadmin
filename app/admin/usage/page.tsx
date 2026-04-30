import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { SectionCard } from "@/components/admin/SectionCard";
import { SimpleBarChart } from "@/components/admin/SimpleBarChart";
import { StatCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getOverviewMetrics } from "@/lib/admin/queries/overview";
import {
  getHeavyUsers,
  getUsageBreakdownByModel,
  getUsageBreakdownByRoute,
  getUsageTimeseries,
} from "@/lib/admin/queries/usage";
import { formatNumber, formatPercent, formatUsd } from "@/lib/admin/utils";

export default async function AdminUsagePage() {
  const [overview, timeseries, heavyUsers, byRoute, byModel] = await Promise.all([
    getOverviewMetrics(),
    getUsageTimeseries(30),
    getHeavyUsers(20),
    getUsageBreakdownByRoute(30),
    getUsageBreakdownByModel(30),
  ]);

  const totalRequests = timeseries.reduce((sum, point) => sum + point.requests, 0);
  const failedRequests = timeseries.reduce(
    (sum, point) => sum + point.failedRequests,
    0
  );
  const topFiveTokens = heavyUsers
    .slice(0, 5)
    .reduce((sum, user) => sum + user.tokens, 0);
  const topFiveShare =
    overview.totalTokensUsed30d === 0
      ? 0
      : (topFiveTokens / overview.totalTokensUsed30d) * 100;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Usage"
        title="AI usage and cost controls"
        description="Usage snapshots track token burn, route mix, heavy users, and estimated cost. This is the page to check before a model rollout or quota-policy change."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="30d tokens"
          tone="accent"
          value={formatNumber(overview.totalTokensUsed30d)}
          hint={`${formatNumber(overview.totalMessages30d)} messages logged`}
        />
        <StatCard
          label="30d requests"
          value={formatNumber(totalRequests)}
          hint={`${formatNumber(failedRequests)} failed requests in aggregated docs`}
        />
        <StatCard
          label="30d cost"
          tone="warning"
          value={formatUsd(overview.estimatedAiCost30d)}
          hint={`${formatNumber(byRoute.length)} endpoints tracked`}
        />
        <StatCard
          label="Top-5 user share"
          tone={topFiveShare >= 35 ? "danger" : "neutral"}
          value={formatPercent(topFiveShare)}
          hint="Share of 30d tokens consumed by the five heaviest users"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Daily tokens"
          description="Token burn over the last 30 days from userUsageDaily."
        >
          <SimpleBarChart
            items={timeseries.map((point) => ({
              name: point.label,
              value: point.tokens,
            }))}
          />
        </SectionCard>
        <SectionCard
          title="Daily cost"
          description="Estimated dollar cost over the same window."
        >
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
        <SectionCard
          title="Heavy users"
          description="Top AI consumers over the last 30 days. Review for abuse, coupon leakage, or high-touch enterprise candidates."
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>UID</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {heavyUsers.map((user) => (
                  <TableRow key={user.uid}>
                    <TableCell className="font-mono text-xs">{user.uid}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(user.requests)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(user.tokens)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatUsd(user.costUsd)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/users/${user.uid}`}>
                          Open
                          <ChevronRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>

        <SectionCard
          title="Cost guardrails"
          description="Quick heuristics for suspicious usage and runaway spend."
        >
          <div className="space-y-4 text-sm">
            <div className="rounded-lg bg-muted/40 p-4">
              <p className="font-medium text-foreground">Failure rate</p>
              <p className="mt-2 text-muted-foreground">
                {formatPercent(
                  totalRequests === 0 ? 0 : (failedRequests / totalRequests) * 100
                )}
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-4">
              <p className="font-medium text-foreground">Shared-account risk</p>
              <p className="mt-2 text-muted-foreground">
                High-consumption clusters are easier to inspect from the
                heavy-user table, especially when combined with suspicious or
                test-account flags on the user detail page.
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-4">
              <p className="font-medium text-foreground">Missing diagnostics</p>
              <p className="mt-2 text-muted-foreground">
                Retry counts and route latency are not yet emitted by the
                student app. The admin schema already has room for them in{" "}
                <code className="font-mono text-xs">userUsageDaily</code> if you
                add that instrumentation.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Model breakdown (30d)"
        description="Tokens and cost per AI model derived from the per-user aiHistory collection."
      >
        {byModel.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No AI history in the last 30 days.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byModel.map((row) => (
                  <TableRow key={row.model}>
                    <TableCell className="font-mono text-xs">{row.model}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(row.requests)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(row.tokens)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatUsd(row.costUsd)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Endpoint breakdown"
        description="Usage grouped by logical route or feature."
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route</TableHead>
                <TableHead className="text-right">Requests</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byRoute.map((route) => (
                <TableRow key={route.route}>
                  <TableCell className="font-mono text-xs">{route.route}</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(route.requests)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(route.tokens)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatUsd(route.costUsd)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </div>
  );
}
