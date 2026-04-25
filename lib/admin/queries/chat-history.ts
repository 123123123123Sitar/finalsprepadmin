import { requireDb } from "@/lib/admin/firestore";
import { resolveEntryCostUsd } from "@/lib/admin/usage-costs";

const MAX_ENTRIES_PER_PULL = 2000;
const DEFAULT_PAGE_SIZE = 250;

export type ChatHistoryEntry = {
  id: string;
  kind: string | null;
  source: string | null;
  plan: string | null;
  model: string | null;
  tokens: number;
  costUsd: number;
  promptPreview: string | null;
  responsePreview: string | null;
  promptChars: number | null;
  responseChars: number | null;
  metadata: Record<string, unknown>;
  createdAt: number | null;
};

export type ChatHistoryPullResult = {
  uid: string;
  entryCount: number;
  truncated: boolean;
  firstAt: number | null;
  lastAt: number | null;
  totalTokens: number;
  totalCostUsd: number;
  byKind: Record<string, number>;
  byModel: Record<string, number>;
  pulledAt: number;
  entries: ChatHistoryEntry[];
};

function coerceString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function coerceNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function pullUserChatHistory(
  uid: string,
  options: { limit?: number; since?: number } = {}
): Promise<ChatHistoryPullResult> {
  const db = requireDb();
  const hardLimit = Math.min(
    Math.max(options.limit ?? MAX_ENTRIES_PER_PULL, 1),
    MAX_ENTRIES_PER_PULL
  );

  const baseRef = db
    .collection("users")
    .doc(uid)
    .collection("aiHistory")
    .orderBy("createdAt", "desc");

  const entries: ChatHistoryEntry[] = [];
  const byKind: Record<string, number> = {};
  const byModel: Record<string, number> = {};
  let totalTokens = 0;
  let totalCostUsd = 0;
  let firstAt: number | null = null;
  let lastAt: number | null = null;
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  let truncated = false;

  while (entries.length < hardLimit) {
    const remaining = hardLimit - entries.length;
    const pageSize = Math.min(DEFAULT_PAGE_SIZE, remaining);
    let pageQuery = baseRef.limit(pageSize);
    if (options.since) {
      pageQuery = baseRef.where("createdAt", ">=", options.since).limit(pageSize);
    }
    if (cursor) pageQuery = pageQuery.startAfter(cursor);
    const page = await pageQuery.get();
    if (page.empty) break;

    for (const doc of page.docs) {
      const data = doc.data() as Record<string, unknown>;
      const createdAt = coerceNumber(data.createdAt);
      const tokens = Number(data.tokens || 0);
      const kind = coerceString(data.kind) || "unknown";
      const model = coerceString(data.model) || "unknown";
      const costUsd = resolveEntryCostUsd(data as never);

      byKind[kind] = (byKind[kind] || 0) + 1;
      byModel[model] = (byModel[model] || 0) + 1;
      totalTokens += tokens;
      totalCostUsd += costUsd;
      if (createdAt !== null) {
        firstAt = firstAt === null ? createdAt : Math.min(firstAt, createdAt);
        lastAt = lastAt === null ? createdAt : Math.max(lastAt, createdAt);
      }

      entries.push({
        id: doc.id,
        kind,
        source: coerceString(data.source),
        plan: coerceString(data.plan),
        model,
        tokens,
        costUsd: Number(costUsd.toFixed(6)),
        promptPreview: coerceString(data.promptPreview),
        responsePreview: coerceString(data.responsePreview),
        promptChars: coerceNumber(data.promptChars),
        responseChars: coerceNumber(data.responseChars),
        metadata:
          data.metadata && typeof data.metadata === "object"
            ? (data.metadata as Record<string, unknown>)
            : {},
        createdAt,
      });
    }

    cursor = page.docs[page.docs.length - 1];
    if (page.size < pageSize) break;
    if (entries.length >= hardLimit) {
      // Peek next doc to know whether we hit the cap or the real end.
      const nextCheck = await baseRef.startAfter(cursor).limit(1).get();
      truncated = !nextCheck.empty;
      break;
    }
  }

  return {
    uid,
    entryCount: entries.length,
    truncated,
    firstAt,
    lastAt,
    totalTokens,
    totalCostUsd: Number(totalCostUsd.toFixed(4)),
    byKind,
    byModel,
    pulledAt: Date.now(),
    entries,
  };
}

export const CHAT_HISTORY_MAX_ENTRIES = MAX_ENTRIES_PER_PULL;
