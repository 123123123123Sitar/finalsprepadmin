export const MODEL_COSTS_USD_PER_1K: Record<
  string,
  { input: number; output: number }
> = {
  "claude-haiku-4-5": { input: 0.001, output: 0.005 },
  "claude-sonnet-4-6": { input: 0.003, output: 0.015 },
  "claude-opus-4-7": { input: 0.015, output: 0.075 },
  "gemini-2.0-flash": { input: 0.00035, output: 0.00105 },
  "gemini-1.5-flash": { input: 0.00035, output: 0.00105 },
  "gemini-1.5-pro": { input: 0.00125, output: 0.005 },
  unknown: { input: 0.0015, output: 0.006 },
};

// Student app stores `tokens` as a single cost-weighted integer (see
// `lib/aiHistory.ts` + `lib/aiCost.ts` in the student repo). That number is
// NOT a raw input+output token count. When no per-request split exists we
// fall back to a blended rate so the admin view doesn't over- or under-count.
const BLENDED_INPUT_SHARE = 0.65;

type EstimateInput = {
  model?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  tokens?: number;
};

function rateFor(model?: string | null) {
  return MODEL_COSTS_USD_PER_1K[model || ""] ?? MODEL_COSTS_USD_PER_1K.unknown;
}

export function estimateCostUsd({
  model,
  inputTokens,
  outputTokens,
  tokens,
}: EstimateInput) {
  const rate = rateFor(model);
  const hasSplit =
    typeof inputTokens === "number" || typeof outputTokens === "number";

  if (hasSplit) {
    const input = ((inputTokens || 0) / 1000) * rate.input;
    const output = ((outputTokens || 0) / 1000) * rate.output;
    return Number((input + output).toFixed(6));
  }

  const total = Math.max(0, Number(tokens || 0));
  if (total === 0) return 0;
  const blendedPer1k =
    rate.input * BLENDED_INPUT_SHARE + rate.output * (1 - BLENDED_INPUT_SHARE);
  return Number(((total / 1000) * blendedPer1k).toFixed(6));
}

// Reads a stored per-entry costUsd first (source of truth), else derives it.
export function resolveEntryCostUsd(data: {
  metadata?: { costUsd?: unknown; inputTokens?: unknown; outputTokens?: unknown };
  model?: unknown;
  tokens?: unknown;
}): number {
  const storedCost = data.metadata?.costUsd;
  if (typeof storedCost === "number" && Number.isFinite(storedCost)) {
    return storedCost;
  }
  const inputTokens =
    typeof data.metadata?.inputTokens === "number"
      ? data.metadata.inputTokens
      : undefined;
  const outputTokens =
    typeof data.metadata?.outputTokens === "number"
      ? data.metadata.outputTokens
      : undefined;
  return estimateCostUsd({
    model: typeof data.model === "string" ? data.model : undefined,
    inputTokens,
    outputTokens,
    tokens: Number(data.tokens || 0),
  });
}
