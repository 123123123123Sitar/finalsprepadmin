import Link from "next/link";
import { Badge } from "@/components/admin/Badge";
import { EmptyState } from "@/components/admin/EmptyState";
import { PageHeader } from "@/components/admin/PageHeader";
import { SectionCard } from "@/components/admin/SectionCard";
import { StatCard } from "@/components/admin/StatCard";
import { getBillingRiskItems, getBillingSnapshots } from "@/lib/admin/queries/billing";
import { getOverviewMetrics } from "@/lib/admin/queries/overview";
import { formatDate, formatNumber, formatUsd } from "@/lib/admin/utils";

export default async function AdminBillingPage() {
  const [riskItems, snapshots, overview] = await Promise.all([
    getBillingRiskItems(),
    getBillingSnapshots(30),
    getOverviewMetrics(),
  ]);

  const totalDue = riskItems.reduce((sum, item) => sum + (item.amountDue || 0), 0);
  const paidLast30d = snapshots.reduce((sum, invoice) => sum + invoice.amountPaid, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Billing"
        title="Subscription and invoice oversight"
        description="Stripe is the payment source of truth; Firebase billing docs are the app-facing cache. Use this page to find desyncs, failed payments, cancellations, and emergency access overrides."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active subscriptions" tone="success" value={formatNumber(overview.revenue.activeSubscriptions)} hint={`${formatNumber(overview.totalPaidUsers)} paid users in app cache`} />
        <StatCard label="Cancel at period end" tone="warning" value={formatNumber(overview.revenue.cancelAtPeriodEnd)} hint={`${formatNumber(overview.churnedSubscriptions30d)} churned in the last 30d`} />
        <StatCard label="Failed payments" tone={overview.revenue.failedPayments > 0 ? "danger" : "neutral"} value={formatNumber(overview.revenue.failedPayments)} hint={`${formatUsd(totalDue)} currently due across risky accounts`} />
        <StatCard label="Cash collected 30d" tone="accent" value={formatUsd(paidLast30d)} hint={`${formatNumber(snapshots.length)} invoices surfaced from Stripe`} />
      </section>

      <SectionCard title="Billing risk queue" description="Accounts with past-due, unpaid, incomplete, or cancellation-adjacent subscription states.">
        {riskItems.length === 0 ? (
          <EmptyState title="No billing risks" description="No risky billing states were found in the current app-side billing cache." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.18em] text-mute">
                  <th className="pb-2">User</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Stripe</th>
                  <th className="pb-2">Renewal</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {riskItems.map((item) => (
                  <tr key={item.uid} className="bg-white shadow-panel">
                    <td className="rounded-l-2xl border-y border-l border-line px-4 py-4">
                      <p className="font-medium text-ink">{item.email || "Unknown email"}</p>
                      <p className="mt-1 font-mono text-xs text-mute">{item.uid}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge tone={item.plan === "learner" ? "neutral" : "accent"}>{item.plan}</Badge>
                        {item.cancelAtPeriodEnd ? <Badge tone="warning">cancel at period end</Badge> : null}
                      </div>
                    </td>
                    <td className="border-y border-line px-4 py-4">
                      <Badge tone={item.status === "past_due" || item.status === "unpaid" ? "danger" : "warning"}>
                        {item.status}
                      </Badge>
                      <p className="mt-3 text-sm text-body">Invoice status: {item.invoiceStatus || "unknown"}</p>
                      <p className="mt-1 text-sm text-body">Amount due: {formatUsd(item.amountDue)}</p>
                    </td>
                    <td className="border-y border-line px-4 py-4 text-sm text-body">
                      <p>Customer: {item.stripeCustomerId || "none"}</p>
                      <p className="mt-1">Subscription: {item.stripeSubscriptionId || "none"}</p>
                    </td>
                    <td className="border-y border-line px-4 py-4 text-sm text-body">
                      <p>Period end: {formatDate(item.currentPeriodEnd)}</p>
                      <p className="mt-1">Cancel at: {formatDate(item.cancelAt)}</p>
                    </td>
                    <td className="rounded-r-2xl border-y border-r border-line px-4 py-4">
                      <Link className="admin-button-secondary" href={`/admin/users/${item.uid}`}>
                        Open user
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Recent Stripe invoices" description="Invoice activity from the last 30 days. Use this to reconcile revenue timing against the app cache.">
        {snapshots.length === 0 ? (
          <EmptyState title="No Stripe data" description="Stripe is either not configured for this admin app or returned no invoice data for the selected window." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.18em] text-mute">
                  <th className="pb-2">Invoice</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Amounts</th>
                  <th className="pb-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((invoice) => (
                  <tr key={invoice.id} className="bg-white shadow-panel">
                    <td className="rounded-l-2xl border-y border-l border-line px-4 py-4">
                      <p className="font-medium text-ink">{invoice.id}</p>
                      <p className="mt-1 font-mono text-xs text-mute">{invoice.customer || "unknown customer"}</p>
                    </td>
                    <td className="border-y border-line px-4 py-4">
                      <Badge tone={invoice.status === "paid" ? "success" : invoice.status === "open" ? "warning" : "danger"}>
                        {invoice.status || "unknown"}
                      </Badge>
                    </td>
                    <td className="border-y border-line px-4 py-4 text-sm text-body">
                      <p>Amount due: {formatUsd(invoice.amountDue)}</p>
                      <p className="mt-1">Amount paid: {formatUsd(invoice.amountPaid)}</p>
                    </td>
                    <td className="rounded-r-2xl border-y border-r border-line px-4 py-4 text-sm text-body">
                      <p>Created: {formatDate(invoice.createdAt)}</p>
                      <p className="mt-1">Paid at: {formatDate(invoice.paidAt)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

