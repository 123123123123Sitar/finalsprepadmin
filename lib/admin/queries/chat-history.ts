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
  /** Cost-weighted billing units (see finalsprep/lib/aiCost.ts). */
  tokens: number;
  /** Raw input tokens reported by the model API, when available. */
  inputTokens: number | null;
  /** Raw output tokens reported by the model API, when available. */
  outputTokens: number | null;
  costUsd: number;
  promptPreview: string | null;
  responsePreview: string | null;
  prompt: string | null;
  response: string | null;
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
  /** Sum of cost-weighted billing units across pulled entries. */
  totalTokens: number;
  /** Sum of raw input tokens reported by the model API. */
  totalInputTokens: number;
  /** Sum of raw output tokens reported by the model API. */
  totalOutputTokens: number;
  /** Number of entries that lacked raw input/output tokens (older records). */
  entriesMissingRawTokens: number;
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
  if (typeof value === "number" && Number.isFinite(value)) return value;
  // Tolerate Firestore Timestamp values written by older code paths.
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in (value as Record<string, unknown>) &&
    typeof (value as { toMillis: unknown }).toMillis === "function"
  ) {
    const ms = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function readRawTokens(data: Record<string, unknown>): {
  input: number | null;
  output: number | null;
} {
  const metadata =
    data.metadata && typeof data.metadata === "object"
      ? (data.metadata as Record<string, unknown>)
      : {};
  const input =
    coerceNumber(data.inputTokens) ?? coerceNumber(metadata.inputTokens);
  const output =
    coerceNumber(data.outputTokens) ?? coerceNumber(metadata.outputTokens);
  return { input, output };
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
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let entriesMissingRawTokens = 0;
  let totalCostUsd = 0;
  let firstAt: number | null = null;
  let lastAt: number | null = null;
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  let truncated = false;

  try {
    while (entries.length < hardLimit) {
      const remaining = hardLimit - entries.length;
      const pageSize = Math.min(DEFAULT_PAGE_SIZE, remaining);
      let pageQuery = baseRef.limit(pageSize);
      if (options.since) {
        pageQuery = baseRef
          .where("createdAt", ">=", options.since)
          .limit(pageSize);
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
        const { input, output } = readRawTokens(data);
        if (input === null && output === null) entriesMissingRawTokens += 1;
        if (input !== null) totalInputTokens += input;
        if (output !== null) totalOutputTokens += output;

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
          inputTokens: input,
          outputTokens: output,
          costUsd: Number(costUsd.toFixed(6)),
          promptPreview: coerceString(data.promptPreview),
          responsePreview: coerceString(data.responsePreview),
          prompt: coerceString(data.prompt),
          response: coerceString(data.response),
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
        const nextCheck = await baseRef.startAfter(cursor).limit(1).get();
        truncated = !nextCheck.empty;
        break;
      }
    }
  } catch (error) {
    console.error("[admin.chatHistory] pull failed", {
      uid,
      since: options.since ?? null,
      hardLimit,
      entriesCollected: entries.length,
      message: error instanceof Error ? error.message : String(error),
      code: (error as { code?: unknown })?.code ?? null,
    });
    throw error;
  }

  return {
    uid,
    entryCount: entries.length,
    truncated,
    firstAt,
    lastAt,
    totalTokens,
    totalInputTokens,
    totalOutputTokens,
    entriesMissingRawTokens,
    totalCostUsd: Number(totalCostUsd.toFixed(4)),
    byKind,
    byModel,
    pulledAt: Date.now(),
    entries,
  };
}

export const CHAT_HISTORY_MAX_ENTRIES = MAX_ENTRIES_PER_PULL;
