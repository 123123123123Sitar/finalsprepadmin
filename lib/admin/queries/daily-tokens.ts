/**
 * Read-only mirror of the student app's daily/weekly token tracker so the
 * admin can show how much of the user's per-plan daily budget is consumed
 * alongside the bonus token bank balance.
 *
 * Storage backends mirror the student app exactly:
 *   1. Upstash Redis (sorted set at `rl:{uid}`) when UPSTASH_REDIS_REST_URL
 *      and UPSTASH_REDIS_REST_TOKEN are set.
 *   2. Firestore fallback at `users/{uid}/profile/rateLimit` otherwise.
 *
 * Per-plan daily caps must stay in sync with finalsprep/lib/rateLimit.ts.
 */
import { requireDb } from "@/lib/admin/firestore";
import type { PlanTier } from "@/lib/admin/plans";

export const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

export const DAILY_TOKEN_CAPS: Record<PlanTier, number> = {
  learner: 10_000,
  pro: 20_000,
  hacker: 80_000,
};

export type DailyTokenUsage = {
  cap: number;
  used: number;
  remaining: number;
};

type Entry = { t: number; tokens: number };

function capForPlan(plan: PlanTier, override?: number | null): number {
  if (typeof override === "number" && override > 0) return override;
  return DAILY_TOKEN_CAPS[plan] ?? DAILY_TOKEN_CAPS.learner;
}

function emptyUsage(plan: PlanTier, override?: number | null): DailyTokenUsage {
  const cap = capForPlan(plan, override);
  return { cap, used: 0, remaining: cap };
}

function isRedisEnabled(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim() || "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || "";
  return Boolean(url && token);
}

async function redisPipeline(commands: (string | number)[][]): Promise<unknown[]> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim() || "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || "";
  if (!url || !token) throw new Error("Upstash Redis not configured");
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Upstash ${res.status}`);
  }
  const body = (await res.json()) as Array<{ result?: unknown; error?: string }>;
  return body.map((x) => {
    if (x && typeof x === "object" && "error" in x && x.error) {
      throw new Error(`Upstash: ${x.error}`);
    }
    return x?.result;
  });
}

function parseRedisEntry(raw: unknown): Entry | null {
  if (typeof raw !== "string") return null;
  const m = raw.match(/^(\d+):(\d+)(?::.*)?$/);
  if (!m) return null;
  const t = Number(m[1]);
  const tokens = Number(m[2]);
  if (!Number.isFinite(t) || !Number.isFinite(tokens)) return null;
  return { t, tokens };
}

async function readDailyUsedFromRedis(uid: string): Promise<number | null> {
  try {
    const dailyCutoff = Date.now() - DAILY_WINDOW_MS;
    const [members] = await redisPipeline([
      ["ZRANGEBYSCORE", `rl:${uid}`, String(dailyCutoff), "+inf"],
    ]);
    if (!Array.isArray(members)) return 0;
    return (members as unknown[])
      .map(parseRedisEntry)
      .filter((e): e is Entry => e !== null)
      .reduce((sum, entry) => sum + entry.tokens, 0);
  } catch {
    return null;
  }
}

async function readDailyUsedFromFirestore(uid: string): Promise<number> {
  try {
    const db = requireDb();
    const snap = await db.doc(`users/${uid}/profile/rateLimit`).get();
    if (!snap.exists) return 0;
    const data = snap.data() as { entries?: Entry[] } | undefined;
    const cutoff = Date.now() - DAILY_WINDOW_MS;
    const entries = Array.isArray(data?.entries) ? data!.entries : [];
    return entries
      .filter((e) => typeof e?.t === "number" && e.t >= cutoff)
      .reduce((sum, entry) => sum + (Number(entry.tokens) || 0), 0);
  } catch {
    return 0;
  }
}

async function readDailyUsed(uid: string): Promise<number> {
  if (isRedisEnabled()) {
    const fromRedis = await readDailyUsedFromRedis(uid);
    if (fromRedis !== null) return fromRedis;
  }
  return readDailyUsedFromFirestore(uid);
}

export async function getDailyTokenUsage(
  uid: string,
  plan: PlanTier,
  capOverride?: number | null
): Promise<DailyTokenUsage> {
  const cap = capForPlan(plan, capOverride);
  const used = await readDailyUsed(uid);
  return {
    cap,
    used,
    remaining: Math.max(0, cap - used),
  };
}

export async function getDailyTokenUsageMap(
  entries: Array<{ uid: string; plan: PlanTier; capOverride?: number | null }>
): Promise<Map<string, DailyTokenUsage>> {
  const result = new Map<string, DailyTokenUsage>();
  if (entries.length === 0) return result;
  const usages = await Promise.all(
    entries.map((entry) =>
      getDailyTokenUsage(entry.uid, entry.plan, entry.capOverride).catch(() =>
        emptyUsage(entry.plan, entry.capOverride)
      )
    )
  );
  entries.forEach((entry, idx) => result.set(entry.uid, usages[idx]));
  return result;
}
