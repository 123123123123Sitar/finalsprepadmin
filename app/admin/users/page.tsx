import Link from "next/link";
import { Badge } from "@/components/admin/Badge";
import { EmptyState } from "@/components/admin/EmptyState";
import { PageHeader } from "@/components/admin/PageHeader";
import { SectionCard } from "@/components/admin/SectionCard";
import { listUsers } from "@/lib/admin/queries/users";
import type { AdminUserListItem } from "@/lib/admin/types";
import { formatDate, formatNumber, formatUsd } from "@/lib/admin/utils";

function readParam(
  value: string | string[] | undefined,
  fallback = ""
) {
  return typeof value === "string" ? value : fallback;
}

function sortUsers(items: AdminUserListItem[], sortKey: string) {
  const sorted = [...items];
  switch (sortKey) {
    case "email":
      return sorted.sort((a, b) => (a.email || "").localeCompare(b.email || ""));
    case "tokens":
      return sorted.sort((a, b) => b.tokenBalance - a.tokenBalance);
    case "cost":
      return sorted.sort((a, b) => b.aiUsage.totalCostUsd - a.aiUsage.totalCostUsd);
    case "created":
      return sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    case "last_active":
    default:
      return sorted.sort((a, b) => (b.lastSignInAt || 0) - (a.lastSignInAt || 0));
  }
}

function filterUsers(
  items: AdminUserListItem[],
  filters: { plan: string; status: string; flag: string }
) {
  return items.filter((user) => {
    if (filters.plan && user.plan !== filters.plan) return false;
    if (filters.status && user.subscriptionStatus !== filters.status) return false;
    if (filters.flag) {
      const matchesFlag =
        filters.flag === "banned"
          ? user.flags.banned
          : filters.flag === "suspicious"
            ? user.flags.suspicious
            : filters.flag === "refunded"
              ? user.flags.refunded
              : filters.flag === "test"
                ? user.flags.testAccount
                : filters.flag === "billing_watch"
                  ? user.flags.billingWatch
                  : false;
      if (!matchesFlag) return false;
    }
    return true;
  });
}

function buildHref(params: Record<string, string>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/admin/users?${query}` : "/admin/users";
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) || {};
  const search = readParam(resolvedSearchParams.search);
  const pageToken = readParam(resolvedSearchParams.pageToken);
  const plan = readParam(resolvedSearchParams.plan);
  const status = readParam(resolvedSearchParams.status);
  const flag = readParam(resolvedSearchParams.flag);
  const sort = readParam(resolvedSearchParams.sort, "last_active");
  const pageSize = Number(readParam(resolvedSearchParams.pageSize, "25")) || 25;

  const data = await listUsers({
    search,
    pageToken: pageToken || undefined,
    pageSize,
  });

  const filteredItems = sortUsers(
    filterUsers(data.items, { plan, status, flag }),
    sort
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Users"
        title="User management"
        description="Search Firebase-authenticated users, inspect subscription state and AI usage, then move into the full detail page for support, billing, or moderation actions."
      />

      <SectionCard title="Filters" description="Search by email, display name, or UID. Sort and filter refine the current result page.">
        <form action="/admin/users" className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
          <input className="admin-input" defaultValue={search} name="search" placeholder="Search email, uid, or display name" />
          <select className="admin-select" defaultValue={plan} name="plan">
            <option value="">All plans</option>
            <option value="learner">Learner</option>
            <option value="pro">Pro</option>
            <option value="hacker">Hacker</option>
          </select>
          <select className="admin-select" defaultValue={status} name="status">
            <option value="">All statuses</option>
            <option value="active">active</option>
            <option value="trialing">trialing</option>
            <option value="past_due">past_due</option>
            <option value="canceled">canceled</option>
            <option value="inactive">inactive</option>
          </select>
          <select className="admin-select" defaultValue={flag} name="flag">
            <option value="">All flags</option>
            <option value="banned">banned</option>
            <option value="suspicious">suspicious</option>
            <option value="refunded">refunded</option>
            <option value="test">test</option>
            <option value="billing_watch">billing_watch</option>
          </select>
          <select className="admin-select" defaultValue={sort} name="sort">
            <option value="last_active">Sort: last active</option>
            <option value="created">Sort: created</option>
            <option value="tokens">Sort: token balance</option>
            <option value="cost">Sort: AI cost</option>
            <option value="email">Sort: email</option>
          </select>
          <button className="admin-button" type="submit">Apply</button>
        </form>
        {data.searchMode ? (
          <p className="mt-4 text-sm text-body">
            Search mode scans up to 1,000 Firebase Auth users when needed. For deeper support work, search by exact email or UID.
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Users"
        description={`${filteredItems.length} results on this page. Pagination is cursor-based through Firebase Auth.`}
        actions={
          data.nextPageToken ? (
            <Link
              className="admin-button-secondary"
              href={buildHref({
                search,
                plan,
                status,
                flag,
                sort,
                pageSize: String(pageSize),
                pageToken: data.nextPageToken,
              })}
            >
              Next page
            </Link>
          ) : null
        }
      >
        {filteredItems.length === 0 ? (
          <EmptyState
            description="No users matched the current page filters. Try clearing the flag/status filters or search for an exact email/UID."
            title="No users found"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.18em] text-mute">
                  <th className="pb-2">User</th>
                  <th className="pb-2">Plan</th>
                  <th className="pb-2">AI usage</th>
                  <th className="pb-2">Flags</th>
                  <th className="pb-2">Last active</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((user) => (
                  <tr key={user.uid} className="admin-row rounded-2xl">
                    <td className="rounded-l-2xl border-y border-l border-line px-4 py-4 align-top">
                      <p className="font-medium text-ink">{user.name || "Unnamed user"}</p>
                      <p className="mt-1 text-sm text-body">{user.email || "no-email"}</p>
                      <p className="mt-2 font-mono text-xs text-mute">{user.uid}</p>
                    </td>
                    <td className="border-y border-line px-4 py-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={user.plan === "learner" ? "neutral" : "accent"}>{user.plan}</Badge>
                        <Badge tone={user.subscriptionStatus === "active" ? "success" : user.subscriptionStatus === "past_due" ? "danger" : "warning"}>
                          {user.subscriptionStatus}
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm text-body">
                        Token balance: {formatNumber(user.tokenBalance)}
                      </p>
                      <p className="mt-1 text-sm text-body">
                        Customer: {user.stripeCustomerId ? "linked" : "none"}
                      </p>
                    </td>
                    <td className="border-y border-line px-4 py-4 align-top">
                      <p className="text-sm text-body">{formatNumber(user.aiUsage.totalRequests)} requests / 30d</p>
                      <p className="mt-1 text-sm text-body">{formatNumber(user.aiUsage.totalTokens)} tokens / 30d</p>
                      <p className="mt-1 text-sm text-body">{formatUsd(user.aiUsage.totalCostUsd)} est. cost</p>
                    </td>
                    <td className="border-y border-line px-4 py-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(user.flags)
                          .filter(([, enabled]) => enabled)
                          .map(([key]) => (
                            <Badge key={key} tone={key === "banned" || key === "suspicious" ? "danger" : "warning"}>
                              {key}
                            </Badge>
                          ))}
                        {Object.values(user.flags).every((enabled) => !enabled) ? (
                          <Badge tone="neutral">clean</Badge>
                        ) : null}
                      </div>
                      {user.referralSource ? (
                        <p className="mt-3 text-sm text-body">Source: {user.referralSource}</p>
                      ) : null}
                    </td>
                    <td className="border-y border-line px-4 py-4 align-top">
                      <p className="text-sm text-body">Last sign-in: {formatDate(user.lastSignInAt)}</p>
                      <p className="mt-1 text-sm text-body">Created: {formatDate(user.createdAt)}</p>
                    </td>
                    <td className="rounded-r-2xl border-y border-r border-line px-4 py-4 align-top">
                      <Link className="admin-button-secondary" href={`/admin/users/${user.uid}`}>
                        Open
                      </Link>
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
