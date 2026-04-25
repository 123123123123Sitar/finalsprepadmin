import type { ReactNode } from "react";

const styles = {
  neutral: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200",
  success: "bg-positiveSoft text-positive ring-1 ring-inset ring-positive/20",
  warning: "bg-warningSoft text-warning ring-1 ring-inset ring-warning/25",
  danger: "bg-dangerSoft text-danger ring-1 ring-inset ring-danger/25",
  accent: "bg-accentSoft text-accent ring-1 ring-inset ring-accent/25",
} as const;

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof styles;
}) {
  return <span className={`badge ${styles[tone]}`}>{children}</span>;
}
