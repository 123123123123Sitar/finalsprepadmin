import type { ListUsersResult, UserRecord } from "firebase-admin/auth";
import { getAdminAuth } from "@/lib/firebase-admin";
import { requireDb, collections } from "@/lib/admin/firestore";
import { normalizeBillingInterval, normalizePlanTier } from "@/lib/admin/plans";
import type {
  AdminNote,
  AdminUserDetail,
  AdminUserListItem,
  AdminUserOverlay,
  AppBillingProfile,
  ManualCreditAdjustment,
  TokenBank,
  UserAiUsageSummary,
} from "@/lib/admin/types";
import { daysAgo } from "@/lib/admin/utils";
import { estimateCostUsd } from "@/lib/admin/usage-costs";

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
      stripeCustomerId: raw.stripeCustomerId,
      stripeSubscriptionId: raw.stripeSubscriptionId,
      stripePriceId: raw.stripePriceId,
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

async function getUsageSummaries(uids: string[]): Promise<Map<string, UserAiUsageSummary>> {
  const db = requireDb();
  const since = daysAgo(30);
  const result = new Map<string, UserAiUsageSummary>();
  uids.forEach((uid) =>
    result.set(uid, {
      totalTokens: 0,
      totalCostUsd: 0,
      totalRequests: 0,
      failedRequests: 0,
      byKind: {},
      byModel: {},
    })
  );

  const collectionGroupSnap = await db
    .collectionGroup("aiHistory")
    .where("createdAt", ">=", since)
    .limit(5000)
    .get();

  for (const doc of collectionGroupSnap.docs) {
    const uid = doc.ref.parent.parent?.id;
    if (!uid || !result.has(uid)) continue;
    const current = result.get(uid)!;
    const data = doc.data();
    const tokens = Number(data.tokens || 0);
    const model = typeof data.model === "string" ? data.model : "unknown";
    const inputTokens =
      typeof data.metadata?.inputTokens === "number" ? data.metadata.inputTokens : tokens;
    const outputTokens =
      typeof data.metadata?.outputTokens === "number" ? data.metadata.outputTokens : 0;

    current.totalTokens += tokens;
    current.totalRequests += 1;
    current.lastUsedAt = Math.max(current.lastUsedAt || 0, Number(data.createdAt || 0));
    current.byKind[String(data.kind || "unknown")] =
      (current.byKind[String(data.kind || "unknown")] || 0) + 1;
    current.byModel[model] = (current.byModel[model] || 0) + 1;
    current.totalCostUsd += estimateCostUsd({
      model,
      inputTokens,
      outputTokens,
    });
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
  usage: UserAiUsageSummary | undefined
): AdminUserListItem {
  return {
    uid: user.uid,
    name: user.displayName ?? null,
    email: user.email ?? null,
    disabled: user.disabled,
    createdAt: parseTimestamp(user.metadata.creationTime),
    lastSignInAt: parseTimestamp(user.metadata.lastSignInTime),
    emailVerified: user.emailVerified,
    providerIds: user.providerData.map((provider) => provider.providerId),
    plan: billing?.plan ?? "learner",
    subscriptionStatus: billing?.status ?? "inactive",
    stripeCustomerId: billing?.stripeCustomerId,
    stripeSubscriptionId: billing?.stripeSubscriptionId,
    tokenBalance: tokenBank?.balance ?? 0,
    aiUsage:
      usage ?? {
        totalTokens: 0,
        totalCostUsd: 0,
        totalRequests: 0,
        failedRequests: 0,
        byKind: {},
        byModel: {},
      },
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

  return {
    items: users.map((user) =>
      toListItem(
        user,
        billingMap.get(user.uid),
        tokenBankMap.get(user.uid),
        overlayMap.get(user.uid),
        usageMap.get(user.uid)
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
  const snap = await db
    .collection(collectionName)
    .where("targetUid", "==", uid)
    .orderBy(orderField, "desc")
    .limit(limit)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as T) }));
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
    db
      .collection(collections.manualCreditAdjustments)
      .where("uid", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(20)
      .get()
      .then((snap) => snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<ManualCreditAdjustment, "id">) }))),
  ]);

  const recentAiHistorySnap = await db
    .collection("users")
    .doc(uid)
    .collection("aiHistory")
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();
  const recentEventsSnap = await db
    .collection("events")
    .where("uid", "==", uid)
    .orderBy("at", "desc")
    .limit(20)
    .get();

  return {
    auth: user,
    billing:
      billingMap.get(uid) ?? {
        plan: "learner",
        status: "inactive",
      },
    tokenBank: tokenMap.get(uid) ?? { balance: 0 },
    overlay: overlayMap.get(uid) ?? { uid },
    aiUsage:
      usageMap.get(uid) ?? {
        totalTokens: 0,
        totalCostUsd: 0,
        totalRequests: 0,
        failedRequests: 0,
        byKind: {},
        byModel: {},
      },
    recentAiHistory: recentAiHistorySnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })),
    recentEvents: recentEventsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })),
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
