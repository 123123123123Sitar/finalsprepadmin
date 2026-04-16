export function formatDate(value?: number | string | null) {
  if (!value) return "—";
  const date =
    typeof value === "number"
      ? new Date(value > 10_000_000_000 ? value : value * 1000)
      : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export function formatNumber(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString();
}

export function formatPercent(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}%`;
}

export function formatUsd(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function toDateKey(input: Date) {
  const y = input.getUTCFullYear();
  const m = String(input.getUTCMonth() + 1).padStart(2, "0");
  const d = String(input.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function daysAgo(days: number) {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

export function safeJsonParse<T>(input: string, fallback: T): T {
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}
