import type { PlanBreakdown } from "@/lib/admin/types";
import { formatNumber, formatPercent } from "@/lib/admin/utils";

const PLAN_STYLES: Record<
  keyof PlanBreakdown,
  { label: string; bar: string; tone: string }
> = {
  learner: {
    label: "Learner (free)",
    bar: "bg-slate-400",
    tone: "bg-slate-100 text-slate-700",
  },
  pro: {
    label: "Pro",
    bar: "bg-accent",
    tone: "bg-accentSoft text-accent",
  },
  hacker: {
    label: "Hacker",
    bar: "bg-positive",
    tone: "bg-positiveSoft text-positive",
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
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        {PLAN_ORDER.map((plan) => {
          const pct = (distribution[plan] / total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={plan}
              className={PLAN_STYLES[plan].bar}
              style={{ width: `${pct}%` }}
              aria-label={`${PLAN_STYLES[plan].label}: ${formatPercent(pct)}`}
              title={`${PLAN_STYLES[plan].label}: ${formatPercent(pct)}`}
            />
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {PLAN_ORDER.map((plan) => {
          const count = distribution[plan];
          const pct = (count / total) * 100;
          const style = PLAN_STYLES[plan];
          return (
            <div
              key={plan}
              className="rounded-2xl border border-line px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${style.bar}`} />
                <span className="text-sm font-medium text-ink">{style.label}</span>
              </div>
              <p className="mt-2 font-display text-2xl text-ink">{formatNumber(count)}</p>
              <p className="text-xs text-mute">{formatPercent(pct)} of accounts</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
