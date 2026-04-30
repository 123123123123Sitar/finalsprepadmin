import type { PlanBreakdown } from "@/lib/admin/types";
import { formatNumber, formatPercent } from "@/lib/admin/utils";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const PLAN_STYLES: Record<
  keyof PlanBreakdown,
  { label: string; bar: string; dot: string; indicator: string }
> = {
  learner: {
    label: "Learner (free)",
    bar: "bg-slate-400",
    dot: "bg-slate-400",
    indicator: "[&>div]:bg-slate-400",
  },
  pro: {
    label: "Pro",
    bar: "bg-primary",
    dot: "bg-primary",
    indicator: "[&>div]:bg-primary",
  },
  hacker: {
    label: "Hacker",
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
    indicator: "[&>div]:bg-emerald-500",
  },
};

const PLAN_ORDER: Array<keyof PlanBreakdown> = ["hacker", "pro", "learner"];

export function PlanDistribution({
  distribution,
  totalUsers,
}: {
  distribution: PlanBreakdown;
  totalUsers: number;
}) {
  const total = Math.max(totalUsers, 1);

  return (
    <div className="space-y-5">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted">
        {PLAN_ORDER.map((plan) => {
          const pct = (distribution[plan] / total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={plan}
              aria-label={`${PLAN_STYLES[plan].label}: ${formatPercent(pct)}`}
              className={PLAN_STYLES[plan].bar}
              style={{ width: `${pct}%` }}
              title={`${PLAN_STYLES[plan].label}: ${formatPercent(pct)}`}
            />
          );
        })}
      </div>

      <div className="space-y-3">
        {PLAN_ORDER.map((plan) => {
          const count = distribution[plan];
          const pct = (count / total) * 100;
          const style = PLAN_STYLES[plan];
          return (
            <div key={plan} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn("inline-block h-2.5 w-2.5 rounded-full", style.dot)}
                  />
                  <span className="font-medium text-foreground">{style.label}</span>
                </div>
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {formatNumber(count)}
                  </span>{" "}
                  · {formatPercent(pct)}
                </div>
              </div>
              <Progress value={pct} className={cn("h-2", style.indicator)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
