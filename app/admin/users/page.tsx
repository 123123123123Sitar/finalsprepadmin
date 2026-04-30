import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import { Badge } from "@/components/admin/Badge";
import { EmptyState } from "@/components/admin/EmptyState";
import { PageHeader } from "@/components/admin/PageHeader";
import { SectionCard } from "@/components/admin/SectionCard";
import { UsersFilterBar } from "@/components/admin/UsersFilterBar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listUsers } from "@/lib/admin/queries/users";
import type { AdminUserListItem } from "@/lib/admin/types";
import { formatDate, formatNumber, formatUsd } from "@/lib/admin/utils";

function readParam(value: string | string[] | undefined, fallback = "") {
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

function buildHref(params: Record<string, string | undefined>) {
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
  const pageStack = readParam(resolvedSearchParams.pageStack);
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

  const stack = pageStack
    ? pageStack.split(",").filter(Boolean)
    : [];

  // forward: append current pageToken to stack so we can navigate back
  const nextStack = pageToken ? [...stack, pageToken] : stack;
  const nextHref = data.nextPageToken
    ? buildHref({
        search,
        plan,
        status,
        flag,
        sort,
        pageSize: String(pageSize),
        pageToken: data.nextPageToken,
        pageStack: nextStack.join(","),
      })
    : null;

  // back: pop the last stack entry, use it as the previous pageToken
  const prevStack = stack.slice(0, -1);
  const prevToken = stack[stack.length - 1];
  const hasPrev = stack.length > 0;
  const prevHref = hasPrev
    ? buildHref({
        search,
        plan,
        status,
        flag,
        sort,
        pageSize: String(pageSize),
        pageToken: prevStack.length > 0 ? prevToken : "",
        pageStack: prevStack.join(","),
      })
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Users"
        title="User management"
        description="Search Firebase-authenticated users, inspect subscription state and AI usage, then move into the full detail page for support, billing, or moderation actions."
      />

      <SectionCard
        title="Filters"
        description="Search by email, display name, or UID. Sort and filter refine the current result page."
      >
        <UsersFilterBar
          initial={{ search, plan, status, flag, sort }}
        />
        {data.searchMode ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Search mode scans up to 1,000 Firebase Auth users when needed. For
            deeper support work, search by exact email or UID.
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Users"
        description={`${filteredItems.length} results on this page. Pagination is cursor-based through Firebase Auth.`}
        actions={
          <div className="flex flex-wrap gap-2">
            {prevHref ? (
              <Button asChild size="sm" variant="outline">
                <Link href={prevHref}>
                  <ArrowLeft className="mr-2 h-3.5 w-3.5" />
                  Previous
                </Link>
              </Button>
            ) : null}
            {nextHref ? (
              <Button asChild size="sm" variant="outline">
                <Link href={nextHref}>
                  Next
                  <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : null}
          </div>
        }
      >
        {filteredItems.length === 0 ? (
          <EmptyState
            description="No users matched the current page filters. Try clearing the flag/status filters or search for an exact email/UID."
            title="No users found"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Plan / status</TableHead>
                  <TableHead>AI usage (30d)</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((user) => (
                  <TableRow key={user.uid} className="align-top">
                    <TableCell className="py-4">
                      <p className="font-medium text-foreground">
                        {user.name || "Unnamed user"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {user.email || "no-email"}
                      </p>
                      <p className="mt-2 font-mono text-xs text-muted-foreground/80">
                        {user.uid}
                      </p>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={user.plan === "learner" ? "neutral" : "accent"}>
                          {user.plan}
                        </Badge>
                        <Badge
                          tone={
                            user.subscriptionStatus === "active"
                              ? "success"
                              : user.subscriptionStatus === "past_due"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {user.subscriptionStatus}
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">
                        Daily tokens:{" "}
                        <span className="text-foreground">
                          {formatNumber(user.dailyTokens.remaining)} /{" "}
                          {formatNumber(user.dailyTokens.cap)}
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Bonus:{" "}
                        <span className="text-foreground">
                          {formatNumber(user.tokenBalance)}
                        </span>
                      </p>
                    </TableCell>
                    <TableCell className="py-4">
                      <p className="text-sm text-muted-foreground">
                        {formatNumber(user.aiUsage.totalRequests)} requests
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatNumber(user.aiUsage.totalTokens)} units
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {formatUsd(user.aiUsage.totalCostUsd)}
                      </p>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(user.flags)
                          .filter(([, enabled]) => enabled)
                          .map(([key]) => (
                            <Badge
                              key={key}
                              tone={key === "banned" || key === "suspicious" ? "danger" : "warning"}
                            >
                              {key}
                            </Badge>
                          ))}
                        {Object.values(user.flags).every((enabled) => !enabled) ? (
                          <Badge tone="success">clean</Badge>
                        ) : null}
                      </div>
                      {user.referralSource ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Source: {user.referralSource}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-4">
                      <p className="text-sm text-muted-foreground">
                        Last:{" "}
                        <span className="text-foreground">
                          {formatDate(user.lastSignInAt)}
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Joined:{" "}
                        <span className="text-foreground">
                          {formatDate(user.createdAt)}
                        </span>
                      </p>
                    </TableCell>
                    <TableCell className="py-4 text-right">
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
        )}
      </SectionCard>
    </div>
  );
}
