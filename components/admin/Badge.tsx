import type { ReactNode } from "react";
import { Badge as ShadcnBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "accent";

const toneClass: Record<Tone, string> = {
  neutral: "",
  success: "border-transparent bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
  warning: "border-transparent bg-amber-50 text-amber-700 hover:bg-amber-50",
  danger: "",
  accent: "",
};

const toneVariant: Record<Tone, "default" | "secondary" | "destructive" | "outline"> = {
  neutral: "secondary",
  success: "outline",
  warning: "outline",
  danger: "destructive",
  accent: "default",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <ShadcnBadge variant={toneVariant[tone]} className={cn(toneClass[tone], className)}>
      {children}
    </ShadcnBadge>
  );
}
