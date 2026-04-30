import type { ListUsersResult, UserRecord } from "firebase-admin/auth";
import { getAdminAuth } from "@/lib/firebase-admin";
import { requireDb, collections } from "@/lib/admin/firestore";
import { normalizeBillingInterval, normalizePlanTier } from "@/lib/admin/plans";
import {
  sortByNumericFieldDesc,
  withFirestoreFallback,
} from "@/lib/admin/query-safety";
import type {
  AdminNote,
  AdminUserDetail,
  AdminUserListItem,
  AdminUserOverlay,
  AppBillingProfile,
  DailyTokens,
  ManualCreditAdjustment,
  TokenBank,
  UserAiUsageSummary,
} from "@/lib/admin/types";
import { daysAgo } from "@/lib/admin/utils";
import { resolveEntryCostUsd } from "@/lib/admin/usage-costs";
import {
  DAILY_TOKEN_CAPS,
  getDailyTokenUsageMap,
} from "@/lib/admin/queries/daily-tokens";

export type UserListQuery = {
  pageSize?: number;
  pageToken?: string;
  search?: string;
};

function encodePageToken(token?: string) {
  if (!token) return null;
  return Buffer.from(token, "utf8").toString("base64");
}

function decodePageToken(token?: string | null) {
  if (!token) return undefined;
  try {
    return Buffer.from(token, "base64").toString("utf8");
  } catch {
    return undefined;
  }
}

function parseTimestamp(input?: string | null) {
  if (!input) return undefined;
  const value = Date.parse(input);
  return Number.isNaN(value) ? undefined : value;
}

function defaultFlags(overlay?: AdminUserOverlay) {
  return {
    banned: Boolean(overlay?.flags?.banned),
    suspicious: Boolean(overlay?.flags?.suspicious),
    refunded: Boolean(overlay?.flags?.refunded),
    testAccount: Boolean(overlay?.flags?.testAccount),
    shadowRestricted: Boolean(overlay?.flags?.shadowRestricted),
    billingWatch: Boolean(overlay?.flags?.billingWatch),
  };
}

async function getBillingProfiles(uids: string[]) {
  const db = requireDb();
  const refs = uids.map((uid) => db.doc(`users/${uid}/profile/billing`));
  const snaps = refs.length ? await db.getAll(...refs) : [];
  const result = new Map<string, AppBillingProfile>();
  for (const snap of snaps) {
    const uid = snap.ref.parent.parent?.id;
    if (!uid) continue;
    const raw = snap.data() || {};
    result.set(uid, {
      plan: normalizePlanTier(raw.plan),
      billingInterval: normalizeBillingInterval(raw.billingInterval),
      status: typeof raw.status === "string" ? raw.status : "inactive",
      currentPeriodEnd: raw.currentPeriodEnd,
      updatedAt: raw.updatedAt,
      cancelAt: raw.cancelAt ?? null,
      canceledAt: raw.canceledAt ?? null,
      trialEndsAt: raw.trialEndsAt ?? null,
    });
  }
  return result;
}

async function getTokenBanks(uids: string[]) {
  const db = requireDb();
  const refs = uids.map((uid) => db.doc(`users/${uid}/profile/tokenBank`));
  const snaps = refs.length ? await db.getAll(...refs) : [];
  const result = new Map<string, TokenBank>();
  for (const snap of snaps) {
    const uid = snap.ref.parent.parent?.id;
    if (!uid) continue;
    const raw = snap.data() || {};
    result.set(uid, {
      balance: Math.max(0, Math.round(raw.balance || 0)),
      updatedAt: raw.updatedAt,
      lastSource: raw.lastSource ?? null,
    });
  }
  return result;
}

async function getUserOverlays(uids: string[]) {
  const db = requireDb();
  const refs = uids.map((uid) => db.collection(collections.adminUsers).doc(uid));
  const snaps = refs.length ? await db.getAll(...refs) : [];
  const result = new Map<string, AdminUserOverlay>();
  for (const snap of snaps) {
    if (!snap.exists) continue;
    result.set(snap.id, snap.data() as AdminUserOverlay);
  }
  return result;
}

function emptyUsageSummary(): UserAiUsageSummary {
  return {
    totalTokens: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
    totalRequests: 0,
    failedRequests: 0,
    byKind: {},
    byModel: {},
  };
}

function readNumberish(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return 0;
}

function applyUsageEntry(summary: UserAiUsageSummary, data: Record<string, unknown>) {
  const tokens = Number((data as { tokens?: unknown }).tokens || 0);
  const metadata =
    (data as { metadata?: unknown }).metadata &&
    typeof (data as { metadata?: unknown }).metadata === "object"
      ? ((data as { metadata: Record<string, unknown> }).metadata)
      : {};
  const inputTokens =
    readNumberish((data as { inputTokens?: unknown }).inputTokens) ||
    readNumberish(metadata.inputTokens);
  const outputTokens =
    readNumberish((data as { outputTokens?: unknown }).outputTokens) ||
    readNumberish(metadata.outputTokens);
  const model =
    typeof (data as { model?: unknown }).model === "string"
      ? ((data as { model: string }).model)
      : "unknown";
  const kind =
    typeof (data as { kind?: unknown }).kind === "string"
      ? ((data as { kind: string }).kind)
      : "unknown";
  summary.totalTokens += tokens;
  summary.totalInputTokens += inputTokens;
  summary.totalOutputTokens += outputTokens;
  summary.totalRequests += 1;
  summary.lastUsedAt = Math.max(
    summary.lastUsedAt || 0,
    Number((data as { createdAt?: unknown }).createdAt || 0)
  );
  summary.byKind[kind] = (summary.byKind[kind] || 0) + 1;
  summary.byModel[model] = (summary.byModel[model] || 0) + 1;
  summary.totalCostUsd += resolveEntryCostUsd(data as never);
}

async function getUsageSummaries(uids: string[]): Promise<Map<string, UserAiUsageSummary>> {
  const db = requireDb();
  const since = daysAgo(30);
  const result = new Map<string, UserAiUsageSummary>();
  uids.forEach((uid) => result.set(uid, emptyUsageSummary()));
  if (uids.length === 0) return result;

  // Single-uid call (user detail): direct subcollection read. Avoids a full
  // cross-user collection-group scan that would otherwise burn thousands of
  // Firestore reads per page view.
  if (uids.length === 1) {
    const uid = uids[0];
    const snap = await withFirestoreFallback(
      "users.usageSummaries.aiHistory.direct",
      null,
      () =>
        db
          .collection("users")
          .doc(uid)
          .collection("aiHistory")
          .where("createdAt", ">=", since)
          .limit(5000)
          .get()
    );
    if (!snap) return result;
    const summary = result.get(uid)!;
    for (const doc of snap.docs) applyUsageEntry(summary, doc.data());
    return result;
  }

  const collectionGroupSnap = await withFirestoreFallback(
    "users.usageSummaries.aiHistory",
    null,
    () =>
      db
        .collectionGroup("aiHistory")
        .where("createdAt", ">=", since)
        .limit(5000)
        .get()
  );
  if (!collectionGroupSnap) return result;

  for (const doc of collectionGroupSnap.docs) {
    const uid = doc.ref.parent.parent?.id;
    if (!uid || !result.has(uid)) continue;
    applyUsageEntry(result.get(uid)!, doc.data());
  }

  return result;
}

async function listPage(
  pageSize: number,
  pageToken?: string
): Promise<ListUsersResult> {
  const auth = getAdminAuth();
  if (!auth) throw new Error("Firebase Admin auth not configured");
  return auth.listUsers(pageSize, pageToken);
}

async function searchUsers(search: string): Promise<UserRecord[]> {
  const auth = getAdminAuth();
  if (!auth) throw new Error("Firebase Admin auth not configured");

  const query = search.trim();
  if (!query) return [];

  try {
    if (query.includes("@")) {
      const user = await auth.getUserByEmail(query);
      return [user];
    }
  } catch {}

  try {
    const user = await auth.getUser(query);
    return [user];
  } catch {}

  const scanned: UserRecord[] = [];
  let nextPageToken: string | undefined;
  while (scanned.length < 1000) {
    const page = await auth.listUsers(250, nextPageToken);
    scanned.push(
      ...page.users.filter((user) =>
        [user.email, user.displayName, user.uid].some((value) =>
          (value || "").toLowerCase().includes(query.toLowerCase())
        )
      )
    );
    if (!page.pageToken) break;
    nextPageToken = page.pageToken;
  }
  return scanned;
}

function toListItem(
  user: UserRecord,
  billing: AppBillingProfile | undefined,
  tokenBank: TokenBank | undefined,
  overlay: AdminUserOverlay | undefined,
  usage: UserAiUsageSummary | undefined,
  dailyTokens: DailyTokens | undefined
): AdminUserListItem {
  const plan = billing?.plan ?? "learner";
  return {
    uid: user.uid,
    name: user.displayName ?? null,
    email: user.email ?? null,
    disabled: user.disabled,
    createdAt: parseTimestamp(user.metadata.creationTime),
    lastSignInAt: parseTimestamp(user.metadata.lastSignInTime),
    emailVerified: user.emailVerified,
    providerIds: user.providerData.map((provider) => provider.providerId),
    plan,
    subscriptionStatus: billing?.status ?? "inactive",
    tokenBalance: tokenBank?.balance ?? 0,
    dailyTokens:
      dailyTokens ?? {
        cap: DAILY_TOKEN_CAPS[plan] ?? DAILY_TOKEN_CAPS.learner,
        used: 0,
        remaining: DAILY_TOKEN_CAPS[plan] ?? DAILY_TOKEN_CAPS.learner,
      },
    aiUsage: usage ?? emptyUsageSummary(),
    flags: defaultFlags(overlay),
    referralSource: overlay?.referralSource ?? null,
  };
}

export async function listUsers(query: UserListQuery) {
  const pageSize = Math.min(Math.max(query.pageSize || 25, 1), 100);

  let users: UserRecord[];
  let nextPageToken: string | undefined;
  let searchMode = false;

  if (query.search?.trim()) {
    searchMode = true;
    users = await searchUsers(query.search);
  } else {
    const page = await listPage(pageSize, decodePageToken(query.pageToken));
    users = page.users;
    nextPageToken = page.pageToken;
  }

  const uids = users.map((user) => user.uid);
  const [billingMap, tokenBankMap, overlayMap, usageMap] = await Promise.all([
    getBillingProfiles(uids),
    getTokenBanks(uids),
    getUserOverlays(uids),
    getUsageSummaries(uids),
  ]);

  const dailyTokenMap = await getDailyTokenUsageMap(
    users.map((user) => ({
      uid: user.uid,
      plan: billingMap.get(user.uid)?.plan ?? "learner",
    }))
  );

  return {
    items: users.map((user) =>
      toListItem(
        user,
        billingMap.get(user.uid),
        tokenBankMap.get(user.uid),
        overlayMap.get(user.uid),
        usageMap.get(user.uid),
        dailyTokenMap.get(user.uid)
      )
    ),
    nextPageToken: encodePageToken(nextPageToken),
    searchMode,
  };
}

async function queryTopLevelByUid<T>(
  collectionName: string,
  uid: string,
  limit: number,
  orderField = "createdAt"
) {
  const db = requireDb();
  const snap = await withFirestoreFallback(
    `${collectionName}.byTargetUid`,
    null,
    () =>
      db
        .collection(collectionName)
        .where("targetUid", "==", uid)
        .limit(Math.max(limit * 5, 50))
        .get()
  );
  if (!snap) return [];
  return sortByNumericFieldDesc(
    snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as T) })),
    orderField
  ).slice(0, limit);
}

export async function getUserDetail(uid: string): Promise<AdminUserDetail> {
  const auth = getAdminAuth();
  if (!auth) throw new Error("Firebase Admin auth not configured");
  const db = requireDb();
  const user = await auth.getUser(uid);

  const [billingMap, tokenMap, overlayMap, usageMap, notes, ledger] = await Promise.all([
    getBillingProfiles([uid]),
    getTokenBanks([uid]),
    getUserOverlays([uid]),
    getUsageSummaries([uid]),
    queryTopLevelByUid<AdminNote>(collections.adminNotes, uid, 20),
    withFirestoreFallback(
      "users.manualCreditAdjustments",
      [] as ManualCreditAdjustment[],
      async () => {
        const snap = await db
          .collection(collections.manualCreditAdjustments)
          .where("uid", "==", uid)
          .limit(100)
          .get();
        return sortByNumericFieldDesc(
          snap.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<ManualCreditAdjustment, "id">),
          })),
          "createdAt"
        ).slice(0, 20);
      }
    ),
  ]);

  const recentAiHistorySnap = await db
    .collection("users")
    .doc(uid)
    .collection("aiHistory")
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();
  const recentEvents = await withFirestoreFallback(
    "users.recentEvents",
    [] as Array<Record<string, unknown> & { id: string }>,
    async () => {
      const snap = await db
        .collection("events")
        .where("uid", "==", uid)
        .limit(100)
        .get();
      return sortByNumericFieldDesc(
        snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })),
        "at"
      ).slice(0, 20);
    }
  );

  const billing =
    billingMap.get(uid) ?? {
      plan: "learner" as const,
      status: "inactive",
    };
  const dailyTokens = (
    await getDailyTokenUsageMap([{ uid, plan: billing.plan }])
  ).get(uid) ?? {
    cap: DAILY_TOKEN_CAPS[billing.plan] ?? DAILY_TOKEN_CAPS.learner,
    used: 0,
    remaining: DAILY_TOKEN_CAPS[billing.plan] ?? DAILY_TOKEN_CAPS.learner,
  };

  return {
    auth: user,
    billing,
    tokenBank: tokenMap.get(uid) ?? { balance: 0 },
    dailyTokens,
    overlay: overlayMap.get(uid) ?? { uid },
    aiUsage: usageMap.get(uid) ?? emptyUsageSummary(),
    recentAiHistory: recentAiHistorySnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })),
    recentEvents,
    notes,
    ledger,
  };
}

export async function countAllUsers() {
  const auth = getAdminAuth();
  if (!auth) throw new Error("Firebase Admin auth not configured");
  let nextPageToken: string | undefined;
  let total = 0;

  do {
    const page = await auth.listUsers(1000, nextPageToken);
    total += page.users.length;
    nextPageToken = page.pageToken;
  } while (nextPageToken);

  return total;
}
