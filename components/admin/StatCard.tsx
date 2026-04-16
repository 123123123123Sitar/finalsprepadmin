import { Badge } from "@/components/admin/Badge";

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "accent";
}) {
  return (
    <div className="admin-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-mute">{label}</p>
          <p className="mt-3 font-display text-3xl tracking-tight text-ink">{value}</p>
          {hint ? <p className="mt-2 text-sm text-body">{hint}</p> : null}
        </div>
        <Badge tone={tone}>{label}</Badge>
      </div>
    </div>
  );
}

