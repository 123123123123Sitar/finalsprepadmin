import { formatNumber, formatUsd } from "@/lib/admin/utils";

export function SimpleBarChart({
  items,
  mode = "count",
}: {
  items: Array<{ name: string; value: number }>;
  mode?: "count" | "usd";
}) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.name} className="space-y-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="truncate text-body">{item.name}</span>
            <span className="font-medium text-ink">
              {mode === "usd" ? formatUsd(item.value) : formatNumber(item.value)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-accent to-amber-400"
              style={{ width: `${Math.max((item.value / max) * 100, 4)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

