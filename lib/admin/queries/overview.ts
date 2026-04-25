import type { QuerySnapshot } from "firebase-admin/firestore";
import { requireDb, collections } from "@/lib/admin/firestore";
import { getStripeClient } from "@/lib/admin/stripe";
import type {
  AdminOverviewMetrics,
  AppBillingProfile,
  PlanBreakdown,
  SignupTrendPoint,
} from "@/lib/admin/types";
import { countAllUsers } from "@/lib/admin/queries/users";
import { isPaidPlan, normalizePlanTier, type PlanTier } from "@/lib/admin/plans";
import { withFirestoreFallback } from "@/lib/admin/query-safety";
import { daysAgo, toDateKey } from "@/lib/admin/utils";
import { contentSourceAvailable } from "@/lib/admin/content-health";

const PLAN_TIERS: PlanTier[] = ["learner", "pro", "hacker"];

function toSecondsOrMillis(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  // Anything below ~year-2286 in ms is < 10 trillion; treat small ints as seconds.
  return raw > 10_000_000_000 ? raw : raw * 1000;
}

async function getBillingProfiles() {
  const db = requireDb();
  // Filter to billing docs by requiring a plan field (tokenBank docs don't
  // have one). Falls back to the old scan if the composite index isn't ready.
  const snap = await withFirestoreFallback<QuerySnapshot | null>(
    "overview.billingProfiles.filtered",
    null,
    () =>
      db
        .collectionGroup("profile")
        .where("plan", "in", PLAN_TIERS)
        .limit(5000)
        .get()
  );
  const docs = snap
    ? snap.docs
    : (await db.collectionGroup("profile").limit(5000).get()).docs;

  const profiles: AppBillingProfile[] = [];
  for (const doc of docs) {
    if (doc.id !== "billing") continue;
    const data = doc.data();
    profiles.push({
      plan: normalizePlanTier(data.plan),
      billingInterval: data.billingInterval,
      status: data.status,
      currentPeriodEnd: data.currentPeriodEnd,
      cancelAt: data.cancelAt ?? null,
      canceledAt: data.canceledAt ?? null,
      stripeCustomerId: data.stripeCustomerId,
      stripeSubscriptionId: data.stripeSubscriptionId,
      updatedAt: data.updatedAt,
    });
  }
  return profiles;
}

type EventDoc = {
  id: string;
  kind: string;
  uid: string;
  at: number;
  meta: Record<string, unknown>;
  plan?: string;
};

async function fetchRecentEvents(days: number): Promise<EventDoc[]> {
  const db = requireDb();
  const snap = await withFirestoreFallback<QuerySnapshot | null>(
    "overview.events.window",
    null,
    () =>
      db
        .collection("events")
        .where("at", ">=", daysAgo(days))
        .limit(8000)
        .get()
  );
  if (!snap) return [];
  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      kind: typeof data.kind === "string" ? data.kind : "unknown",
      uid: String(data.uid || ""),
      at: Number(data.at || 0),
      meta:
        data.meta && typeof data.meta === "object"
          ? (data.meta as Record<string, unknown>)
          : {},
      plan: typeof data.plan === "string" ? data.plan : undefined,
    };
  });
}

function uniqueActiveUsersSince(events: EventDoc[], sinceMs: number) {
  const set = new Set<string>();
  for (const event of events) {
    if (!event.uid) continue;
    if (event.at < sinceMs) continue;
    set.add(event.uid);
  }
  return set.size;
}

function topByField(
  events: EventDoc[],
  field: string,
  limit = 8
): Array<{ name: string; value: number }> {
  const counts = new Map<string, number>();
  for (const event of events) {
    const metaValue = event.meta[field];
    const value =
      typeof metaValue === "string"
        ? metaValue
        : typeof (event as Record<string, unknown>)[field] === "string"
          ? ((event as Record<string, unknown>)[field] as string)
          : undefined;
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, value]) => ({ name, value }));
}

function topFeatures(events: EventDoc[], limit = 8) {
  const counts = new Map<string, number>();
  for (const event of events) {
    counts.set(event.kind, (counts.get(event.kind) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, value]) => ({ name, value }));
}

function signupTrend(events: EventDoc[], days: number): SignupTrendPoint[] {
  const bucket = new Map<string, number>();
  const start = Date.now() - days * 24 * 60 * 60 * 1000;
  for (const event of events) {
    if (event.kind !== "signup") continue;
    if (event.at < start) continue;
    const key = toDateKey(new Date(event.at));
    bucket.set(key, (bucket.get(key) || 0) + 1);
  }
  const points: SignupTrendPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = toDateKey(new Date(Date.now() - i * 24 * 60 * 60 * 1000));
    points.push({ dateKey: key, signups: bucket.get(key) || 0 });
  }
  return points;
}

function activeByPlan(events: EventDoc[], days: number) {
  const result: Record<PlanTier, number> = { learner: 0, pro: 0, hacker: 0 };
  const seen: Record<PlanTier, Set<string>> = {
    learner: new Set(),
    pro: new Set(),
    hacker: new Set(),
  };
  const since = daysAgo(days);
  for (const event of events) {
    if (event.at < since) continue;
    if (!event.uid) continue;
    const plan = normalizePlanTier(event.plan);
    if (!seen[plan].has(event.uid)) {
      seen[plan].add(event.uid);
      result[plan] += 1;
    }
  }
  return result;
}

async function getUsageWindow() {
  const db = requireDb();
  const usageSnap = await db
    .collection(collections.userUsageDaily)
    .where("dateKey", ">=", toDateKey(new Date(daysAgo(30))))
    .limit(5000)
    .get();

  let totalTokensUsed30d = 0;
  let totalMessages30d = 0;
  let totalAiRequests30d = 0;
  let estimatedAiCost30d = 0;

  usageSnap.forEach((doc) => {
    const data = doc.data();
    totalTokensUsed30d += Number(data.tokens || 0);
    totalMessages30d += Number(data.messages || 0);
    totalAiRequests30d += Number(data.requests || 0);
    estimatedAiCost30d += Number(data.costUsd || 0);
  });

  return {
    totalTokensUsed30d,
    totalMessages30d,
    totalAiRequests30d,
    estimatedAiCost30d,
  };
}

async function countInvoicesByStatus(
  stripe: NonNullable<ReturnType<typeof getStripeClient>>,
  status: "open" | "uncollectible"
): Promise<number> {
  let total = 0;
  let startingAfter: string | undefined;
  do {
    const page = await stripe.invoices.list({
      status,
      limit: 100,
      starting_after: startingAfter,
    });
    total += page.data.length;
    if (!page.has_more) break;
    startingAfter = page.data.at(-1)?.id;
  } while (startingAfter);
  return total;
}

async function getRevenueMetrics() {
  const stripe = getStripeClient();
  if (!stripe) {
    return {
      mrr: 0,
      arr: 0,
      openInvoices: 0,
      failedPayments: 0,
      activeSubscriptions: 0,
      cancelAtPeriodEnd: 0,
    };
  }

  let startingAfter: string | undefined;
  let activeSubscriptions = 0;
  let cancelAtPeriodEnd = 0;
  let mrr = 0;
  do {
    const page = await stripe.subscriptions.list({
      status: "all",
      limit: 100,
      starting_after: startingAfter,
      expand: ["data.items.data.price"],
    });

    for (const subscription of page.data) {
      const active = subscription.status === "active" || subscription.status === "trialing";
      if (active) activeSubscriptions += 1;
      if (subscription.cancel_at_period_end) cancelAtPeriodEnd += 1;
      for (const item of subscription.items.data) {
        const amount = (item.price.unit_amount || 0) / 100;
        const recurring = item.price.recurring;
        if (!active || !recurring) continue;
        if (recurring.interval === "year") {
          mrr += amount / 12;
        } else if (recurring.interval === "month") {
          mrr += recurring.interval_count && recurring.interval_count > 1
            ? amount / recurring.interval_count
            : amount;
        }
      }
    }

    if (!page.has_more) break;
    startingAfter = page.data.at(-1)?.id;
  } while (startingAfter);

  const [openInvoices, failedPayments] = await Promise.all([
    countInvoicesByStatus(stripe, "open"),
    countInvoicesByStatus(stripe, "uncollectible"),
  ]);

  return {
    mrr: Number(mrr.toFixed(2)),
    arr: Number((mrr * 12).toFixed(2)),
    openInvoices,
    failedPayments,
    activeSubscriptions,
    cancelAtPeriodEnd,
  };
}

function buildPlanDistribution(
  billingProfiles: AppBillingProfile[],
  totalUsers: number
): PlanBreakdown {
  const counts: Record<PlanTier, number> = { learner: 0, pro: 0, hacker: 0 };
  for (const profile of billingProfiles) counts[profile.plan] += 1;
  // Users without any billing doc default to learner (free).
  const billedTotal = counts.learner + counts.pro + counts.hacker;
  const unbilledLearners = Math.max(totalUsers - billedTotal, 0);
  counts.learner += unbilledLearners;
  return counts;
}

function buildCohortBreakdown(billingProfiles: AppBillingProfile[]) {
  const byInterval = new Map<string, number>();
  for (const profile of billingProfiles) {
    if (!isPaidPlan(profile.plan)) continue;
    const key = profile.billingInterval || "unknown";
    byInterval.set(key, (byInterval.get(key) || 0) + 1);
  }
  return [...byInterval.entries()].map(([name, value]) => ({ name, value }));
}

export async function getOverviewMetrics(): Promise<AdminOverviewMetrics> {
  const db = requireDb();
  const [totalUsers, billingProfiles, events, usageWindow, revenue, suspiciousUsersSnap, auditSnap, contentMetaSnap, supportHotUsersSnap] =
    await Promise.all([
      countAllUsers(),
      getBillingProfiles(),
      fetchRecentEvents(30),
      getUsageWindow(),
      getRevenueMetrics(),
      db
        .collection(collections.adminUsers)
        .where("flags.suspicious", "==", true)
        .limit(200)
        .get(),
      db
        .collection(collections.adminAuditLogs)
        .where("createdAt", ">=", daysAgo(1))
        .limit(500)
        .get(),
      db.collection(collections.platformSettings).doc("contentHealthMeta").get(),
      withFirestoreFallback<QuerySnapshot | null>(
        "overview.supportHot",
        null,
        () =>
          db
            .collection(collections.adminUsers)
            .where("supportTier", "in", ["priority", "vip"])
            .limit(200)
            .get()
      ),
    ]);

  const dau = uniqueActiveUsersSince(events, daysAgo(1));
  const wau = uniqueActiveUsersSince(events, daysAgo(7));
  const mau = uniqueActiveUsersSince(events, daysAgo(30));
  const popularCourses = topByField(events, "courseSlug");
  const popularUnits = topByField(events, "unitTitle");
  const featureUsage = topFeatures(events);
  const recentSignups7d = events.filter(
    (event) => event.kind === "signup" && event.at >= daysAgo(7)
  ).length;
  const recentSignups30d = events.filter(
    (event) => event.kind === "signup" && event.at >= daysAgo(30)
  ).length;
  const signupTrend14d = signupTrend(events, 14);
  const activeByPlan7d = activeByPlan(events, 7);
  const planDistribution = buildPlanDistribution(billingProfiles, totalUsers);
  const paidCohorts = buildCohortBreakdown(billingProfiles);
  const totalPaidUsers = planDistribution.pro + planDistribution.hacker;
  const proUsers = planDistribution.pro;
  const premiumUsers = planDistribution.hacker;
  const freeUsers = planDistribution.learner;

  const cutoffMs = daysAgo(30);
  const churnedSubscriptions30d = billingProfiles.filter((profile) => {
    const canceled = toSecondsOrMillis(profile.canceledAt ?? undefined);
    return canceled !== null && canceled >= cutoffMs;
  }).length;

  const freeToPaidConversionRate =
    totalUsers === 0 ? 0 : (totalPaidUsers / totalUsers) * 100;

  const arpuPaid =
    totalPaidUsers === 0 ? 0 : Number((revenue.mrr / totalPaidUsers).toFixed(2));
  const costPerActiveMau =
    mau === 0 ? 0 : Number((usageWindow.estimatedAiCost30d / mau).toFixed(4));

  return {
    totalUsers,
    dau,
    wau,
    mau,
    totalPaidUsers,
    freeUsers,
    proUsers,
    premiumUsers,
    planDistribution,
    activeByPlan7d,
    paidCohorts,
    signupTrend14d,
    recentSignups7d,
    recentSignups30d,
    freeToPaidConversionRate,
    churnedSubscriptions30d,
    totalTokensUsed30d: usageWindow.totalTokensUsed30d,
    totalMessages30d: usageWindow.totalMessages30d,
    totalAiRequests30d: usageWindow.totalAiRequests30d,
    estimatedAiCost30d: usageWindow.estimatedAiCost30d,
    arpuPaid,
    costPerActiveMau,
    revenue,
    popularCourses,
    popularUnits,
    featureUsage,
    recentAuditCount24h: auditSnap.size,
    suspiciousUsers: suspiciousUsersSnap.size,
    supportHotUsers: supportHotUsersSnap?.size ?? 0,
    systemStatus: {
      firebaseAdmin: true,
      stripe: Boolean(getStripeClient()),
      contentSourceAvailable: contentSourceAvailable(),
      lastContentHealthSyncAt: contentMetaSnap.data()?.syncedAt,
    },
  };
}
