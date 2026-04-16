import { requireDb, collections } from "@/lib/admin/firestore";
import type { UsageTimeseriesPoint } from "@/lib/admin/types";
import { daysAgo, toDateKey } from "@/lib/admin/utils";
import { estimateCostUsd } from "@/lib/admin/usage-costs";

export async function getUsageTimeseries(days = 30): Promise<UsageTimeseriesPoint[]> {
  const db = requireDb();
  const sinceKey = toDateKey(new Date(daysAgo(days)));
  const snap = await db
    .collection(collections.userUsageDaily)
    .where("dateKey", ">=", sinceKey)
    .limit(5000)
    .get();

  const byKey = new Map<string, UsageTimeseriesPoint>();
  for (const doc of snap.docs) {
    const data = doc.data();
    const key = String(data.dateKey || "unknown");
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        label: key,
        tokens: 0,
        costUsd: 0,
        requests: 0,
        failedRequests: 0,
      });
    }
    const point = byKey.get(key)!;
    point.tokens += Number(data.tokens || 0);
    point.costUsd += Number(data.costUsd || 0);
    point.requests += Number(data.requests || 0);
    point.failedRequests += Number(data.failedRequests || 0);
  }

  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export async function getHeavyUsers(limit = 25) {
  const db = requireDb();
  const since = daysAgo(30);
  const aiHistory = await db
    .collectionGroup("aiHistory")
    .where("createdAt", ">=", since)
    .limit(5000)
    .get();

  const byUser = new Map<
    string,
    { uid: string; tokens: number; requests: number; costUsd: number }
  >();
  for (const doc of aiHistory.docs) {
    const uid = doc.ref.parent.parent?.id;
    if (!uid) continue;
    const data = doc.data();
    const inputTokens =
      typeof data.metadata?.inputTokens === "number"
        ? data.metadata.inputTokens
        : Number(data.tokens || 0);
    const outputTokens =
      typeof data.metadata?.outputTokens === "number"
        ? data.metadata.outputTokens
        : 0;
    const current = byUser.get(uid) ?? {
      uid,
      tokens: 0,
      requests: 0,
      costUsd: 0,
    };
    current.tokens += Number(data.tokens || 0);
    current.requests += 1;
    current.costUsd +=
      Number(data.metadata?.costUsd || 0) ||
      estimateCostUsd({
        model: typeof data.model === "string" ? data.model : undefined,
        inputTokens,
        outputTokens,
      });
    byUser.set(uid, current);
  }

  return [...byUser.values()].sort((a, b) => b.tokens - a.tokens).slice(0, limit);
}

export async function getUsageBreakdownByRoute(days = 30) {
  const db = requireDb();
  const snap = await db
    .collection(collections.userUsageDaily)
    .where("dateKey", ">=", toDateKey(new Date(daysAgo(days))))
    .limit(5000)
    .get();

  const byRoute = new Map<string, { route: string; requests: number; tokens: number; costUsd: number }>();
  for (const doc of snap.docs) {
    const routeBreakdown = doc.data().routes || {};
    for (const [route, value] of Object.entries(routeBreakdown)) {
      const current = byRoute.get(route) ?? {
        route,
        requests: 0,
        tokens: 0,
        costUsd: 0,
      };
      current.requests += Number((value as any).requests || 0);
      current.tokens += Number((value as any).tokens || 0);
      current.costUsd += Number((value as any).costUsd || 0);
      byRoute.set(route, current);
    }
  }

  return [...byRoute.values()].sort((a, b) => b.tokens - a.tokens);
}
