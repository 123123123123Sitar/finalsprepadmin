import type { ReactNode } from "react";

const styles = {
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-positiveSoft text-positive",
  warning: "bg-warningSoft text-warning",
  danger: "bg-dangerSoft text-danger",
  accent: "bg-accentSoft text-accent",
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

