import { Card, CardContent } from "@/components/ui/card";
import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="border-2 border-dashed bg-muted/30 shadow-none">
      <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background text-muted-foreground">
          {icon ?? <Inbox className="h-6 w-6" />}
        </div>
        <p className="font-display text-xl font-medium text-foreground">{title}</p>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
