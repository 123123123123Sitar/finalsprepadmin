export const MODEL_COSTS_USD_PER_1K: Record<
  string,
  { input: number; output: number }
> = {
  "claude-haiku-4-5": { input: 0.001, output: 0.005 },
  "claude-sonnet-4-6": { input: 0.003, output: 0.015 },
  "gemini-1.5-flash": { input: 0.00035, output: 0.00105 },
  unknown: { input: 0.0015, output: 0.006 },
};

export function estimateCostUsd({
  model,
  inputTokens,
  outputTokens,
}: {
  model?: string | null;
  inputTokens?: number;
  outputTokens?: number;
}) {
  const cost = MODEL_COSTS_USD_PER_1K[model || ""] ?? MODEL_COSTS_USD_PER_1K.unknown;
  const input = (inputTokens || 0) / 1000 * cost.input;
  const output = (outputTokens || 0) / 1000 * cost.output;
  return Number((input + output).toFixed(6));
}
