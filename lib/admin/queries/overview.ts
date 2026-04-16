import { requireDb, collections } from "@/lib/admin/firestore";
import { getStripeClient } from "@/lib/admin/stripe";
import type { AdminOverviewMetrics, AppBillingProfile } from "@/lib/admin/types";
import { countAllUsers } from "@/lib/admin/queries/users";
import { isPaidPlan, normalizePlanTier } from "@/lib/admin/plans";
import { withFirestoreFallback } from "@/lib/admin/query-safety";
import { daysAgo, toDateKey } from "@/lib/admin/utils";
import { contentSourceAvailable } from "@/lib/admin/content-health";

function startOfDay(daysBack = 0) {
  const current = new Date();
  current.setUTCHours(0, 0, 0, 0);
  current.setUTCDate(current.getUTCDate() - daysBack);
  return current.getTime();
}

async function getBillingProfiles() {
  const db = requireDb();
  const snap = await db.collectionGroup("profile").limit(5000).get();
  const profiles: AppBillingProfile[] = [];
  for (const doc of snap.docs) {
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

async function getUniqueActiveUsers(days: number) {
  const db = requireDb();
  const snap = await db
    .collection("events")
    .where("at", ">=", daysAgo(days))
    .limit(5000)
    .get();
  return new Set(
    snap.docs
      .map((doc) => String(doc.data().uid || ""))
      .filter((uid) => Boolean(uid))
  ).size;
}

async function getPopularMeta(field: string, days: number) {
  const db = requireDb();
  const snap = await db
    .collection("events")
    .where("at", ">=", daysAgo(days))
    .limit(5000)
    .get();

  const counts = new Map<string, number>();
  for (const doc of snap.docs) {
    const value =
      doc.data().meta?.[field] ||
      doc.data().meta?.[field.replace("meta.", "")] ||
      doc.data()[field];
    if (!value || typeof value !== "string") continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));
}

async function getFeatureUsage(days: number) {
  const db = requireDb();
  const snap = await db
    .collection("events")
    .where("at", ">=", daysAgo(days))
    .limit(5000)
    .get();
  const counts = new Map<string, number>();
  for (const doc of snap.docs) {
    counts.set(doc.data().kind, (counts.get(doc.data().kind) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));
}

async function getRecentSignups(days: number) {
  const db = requireDb();
  const snap = await db
    .collection("events")
    .where("at", ">=", daysAgo(days))
    .limit(5000)
    .get();

  return snap.docs.filter((doc) => doc.data().kind === "signup").length;
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

    startingAfter = page.has_more ? page.data.at(-1)?.id : undefined;
  } while (startingAfter);

  const openInvoices = await stripe.invoices
    .list({ status: "open", limit: 100 })
    .then((page) => page.data.length);
  const failedPayments = await stripe.invoices
    .list({ status: "uncollectible", limit: 100 })
    .then((page) => page.data.length);

  return {
    mrr: Number(mrr.toFixed(2)),
    arr: Number((mrr * 12).toFixed(2)),
    openInvoices,
    failedPayments,
    activeSubscriptions,
    cancelAtPeriodEnd,
  };
}

export async function getOverviewMetrics(): Promise<AdminOverviewMetrics> {
  const db = requireDb();
  const [totalUsers, billingProfiles, dau, wau, mau, popularCourses, popularUnits, featureUsage, usageWindow, revenue, suspiciousUsersSnap, auditSnap, contentMetaSnap] =
    await Promise.all([
      countAllUsers(),
      getBillingProfiles(),
      getUniqueActiveUsers(1),
      getUniqueActiveUsers(7),
      getUniqueActiveUsers(30),
      getPopularMeta("courseSlug", 30),
      getPopularMeta("unitTitle", 30),
      getFeatureUsage(30),
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
    ]);

  const totalPaidUsers = billingProfiles.filter((profile) => isPaidPlan(profile.plan)).length;
  const proUsers = billingProfiles.filter((profile) => profile.plan === "pro").length;
  const premiumUsers = billingProfiles.filter((profile) => profile.plan === "hacker").length;
  const freeUsers = Math.max(totalUsers - totalPaidUsers, 0);
  const recentSignups7d = await withFirestoreFallback(
    "overview.recentSignups7d",
    0,
    () => getRecentSignups(7)
  );
  const churnedSubscriptions30d = billingProfiles.filter(
    (profile) =>
      typeof profile.canceledAt === "number" && profile.canceledAt >= daysAgo(30) / 1000
  ).length;

  const freeToPaidConversionRate =
    totalUsers === 0 ? 0 : (totalPaidUsers / totalUsers) * 100;

  const supportHotUsers = await db
    .collection(collections.adminUsers)
    .where("supportTier", "in", ["priority", "vip"])
    .limit(200)
    .get()
    .then((snap) => snap.size);

  return {
    totalUsers,
    dau,
    wau,
    mau,
    totalPaidUsers,
    freeUsers,
    proUsers,
    premiumUsers,
    recentSignups7d,
    freeToPaidConversionRate,
    churnedSubscriptions30d,
    totalTokensUsed30d: usageWindow.totalTokensUsed30d,
    totalMessages30d: usageWindow.totalMessages30d,
    totalAiRequests30d: usageWindow.totalAiRequests30d,
    estimatedAiCost30d: usageWindow.estimatedAiCost30d,
    revenue,
    popularCourses,
    popularUnits,
    featureUsage,
    recentAuditCount24h: auditSnap.size,
    suspiciousUsers: suspiciousUsersSnap.size,
    supportHotUsers,
    systemStatus: {
      firebaseAdmin: true,
      stripe: Boolean(getStripeClient()),
      contentSourceAvailable: contentSourceAvailable(),
      lastContentHealthSyncAt: contentMetaSnap.data()?.syncedAt,
    },
  };
}
