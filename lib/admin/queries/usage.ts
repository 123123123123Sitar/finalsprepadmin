import { requireDb, collections } from "@/lib/admin/firestore";
import { withFirestoreFallback } from "@/lib/admin/query-safety";
import type { UsageTimeseriesPoint } from "@/lib/admin/types";
import { daysAgo, toDateKey } from "@/lib/admin/utils";
import { resolveEntryCostUsd } from "@/lib/admin/usage-costs";

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
  const aiHistory = await withFirestoreFallback(
    "usage.heavyUsers.aiHistory",
    null,
    () =>
      db
        .collectionGroup("aiHistory")
        .where("createdAt", ">=", since)
        .limit(5000)
        .get()
  );
  if (!aiHistory) return [];

  const byUser = new Map<
    string,
    {
      uid: string;
      tokens: number;
      requests: number;
      costUsd: number;
      byModel: Record<string, number>;
      byKind: Record<string, number>;
      lastUsedAt: number;
    }
  >();
  for (const doc of aiHistory.docs) {
    const uid = doc.ref.parent.parent?.id;
    if (!uid) continue;
    const data = doc.data();
    const current =
      byUser.get(uid) ??
      {
        uid,
        tokens: 0,
        requests: 0,
        costUsd: 0,
        byModel: {} as Record<string, number>,
        byKind: {} as Record<string, number>,
        lastUsedAt: 0,
      };
    const tokens = Number(data.tokens || 0);
    const model = typeof data.model === "string" ? data.model : "unknown";
    const kind = typeof data.kind === "string" ? data.kind : "unknown";
    current.tokens += tokens;
    current.requests += 1;
    current.costUsd += resolveEntryCostUsd(data);
    current.byModel[model] = (current.byModel[model] || 0) + 1;
    current.byKind[kind] = (current.byKind[kind] || 0) + 1;
    current.lastUsedAt = Math.max(current.lastUsedAt, Number(data.createdAt || 0));
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

// Derived from aiHistory collection-group (30d window already fetched once
// elsewhere). Call sites should share their snapshot when possible to avoid
// the 5k-read cost of repeating this query.
export async function getUsageBreakdownByModel(days = 30) {
  const db = requireDb();
  const since = daysAgo(days);
  const snap = await withFirestoreFallback(
    "usage.breakdownByModel.aiHistory",
    null,
    () =>
      db
        .collectionGroup("aiHistory")
        .where("createdAt", ">=", since)
        .limit(5000)
        .get()
  );
  if (!snap) return [];

  const byModel = new Map<
    string,
    { model: string; requests: number; tokens: number; costUsd: number }
  >();
  for (const doc of snap.docs) {
    const data = doc.data();
    const model = typeof data.model === "string" ? data.model : "unknown";
    const current =
      byModel.get(model) ?? { model, requests: 0, tokens: 0, costUsd: 0 };
    current.requests += 1;
    current.tokens += Number(data.tokens || 0);
    current.costUsd += resolveEntryCostUsd(data);
    byModel.set(model, current);
  }
  return [...byModel.values()].sort((a, b) => b.tokens - a.tokens);
}
