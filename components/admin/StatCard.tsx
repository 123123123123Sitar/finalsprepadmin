import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "accent";

const TONE_STYLES: Record<Tone, { accent: string; dot: string }> = {
  neutral: { accent: "before:bg-border", dot: "bg-muted-foreground/40" },
  success: { accent: "before:bg-emerald-500", dot: "bg-emerald-500" },
  warning: { accent: "before:bg-amber-500", dot: "bg-amber-500" },
  danger: { accent: "before:bg-destructive", dot: "bg-destructive" },
  accent: { accent: "before:bg-primary", dot: "bg-primary" },
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
    <Card
      role="group"
      aria-label={`${label}: ${value}`}
      className={cn(
        "relative overflow-hidden transition hover:shadow-md",
        "before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
        style.accent
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn("inline-block h-2 w-2 rounded-full", style.dot)}
          />
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
        </div>
        <p className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground">
          {value}
        </p>
        {hint ? (
          <p className="mt-2 text-sm leading-5 text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
