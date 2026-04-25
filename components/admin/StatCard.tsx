type Tone = "neutral" | "success" | "warning" | "danger" | "accent";

const TONE_STYLES: Record<Tone, { border: string; dot: string }> = {
  neutral: { border: "before:bg-slate-300", dot: "bg-slate-400" },
  success: { border: "before:bg-positive", dot: "bg-positive" },
  warning: { border: "before:bg-warning", dot: "bg-warning" },
  danger: { border: "before:bg-danger", dot: "bg-danger" },
  accent: { border: "before:bg-accent", dot: "bg-accent" },
};

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}) {
  const style = TONE_STYLES[tone];
  return (
    <div
      role="group"
      aria-label={`${label}: ${value}`}
      className={`admin-card relative overflow-hidden p-5 transition hover:shadow-md before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-[''] ${style.border}`}
    >
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${style.dot}`} aria-hidden />
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mute">
          {label}
        </p>
      </div>
      <p className="mt-3 font-display text-3xl tracking-tight text-ink">{value}</p>
      {hint ? <p className="mt-2 text-sm leading-5 text-body">{hint}</p> : null}
    </div>
  );
}
