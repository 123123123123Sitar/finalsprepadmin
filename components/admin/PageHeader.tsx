import type { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="space-y-4 pb-2">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
      <Separator />
    </div>
  );
}
