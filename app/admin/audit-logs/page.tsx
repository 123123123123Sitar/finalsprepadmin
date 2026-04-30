import { Badge } from "@/components/admin/Badge";
import { EmptyState } from "@/components/admin/EmptyState";
import { PageHeader } from "@/components/admin/PageHeader";
import { SectionCard } from "@/components/admin/SectionCard";
import { AuditLogsFilterBar } from "@/components/admin/AuditLogsFilterBar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown } from "lucide-react";
import { listAuditLogs } from "@/lib/admin/queries/audit";
import { formatDate } from "@/lib/admin/utils";

function readParam(value: string | string[] | undefined, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) || {};
  const targetId = readParam(resolvedSearchParams.targetId);
  const actorUid = readParam(resolvedSearchParams.actorUid);
  const action = readParam(resolvedSearchParams.action);
  const limit = Number(readParam(resolvedSearchParams.limit, "100")) || 100;
  const logs = await listAuditLogs({
    targetId: targetId || undefined,
    actorUid: actorUid || undefined,
    action: action || undefined,
    limit,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Audit"
        title="Audit log"
        description="Every sensitive admin action records actor, target, status, reason, and before/after state. Filter this page when investigating mistakes or escalation history."
      />

      <SectionCard
        title="Filters"
        description="Target ID is usually a user UID, settings key, or feature-flag key."
      >
        <AuditLogsFilterBar
          initial={{
            targetId,
            actorUid,
            action,
            limit: String(limit),
          }}
        />
      </SectionCard>

      <SectionCard
        title="Entries"
        description={`${logs.length} audit entries returned.`}
      >
        {logs.length === 0 ? (
          <EmptyState
            description="Nothing matched the current filters."
            title="No audit entries"
          />
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <Card key={log.id}>
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base font-semibold text-foreground">
                          {log.action}
                        </h3>
                        <Badge tone={log.status === "success" ? "success" : "danger"}>
                          {log.status}
                        </Badge>
                        <Badge tone="neutral">{log.targetType}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Actor:{" "}
                        <span className="text-foreground">
                          {log.actorEmail || log.actorUid}
                        </span>{" "}
                        · Target:{" "}
                        <span className="font-mono text-xs text-foreground">
                          {log.targetId}
                        </span>{" "}
                        · {formatDate(log.createdAt)}
                      </p>
                      {log.reason ? (
                        <p className="text-sm leading-6 text-foreground">
                          {log.reason}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {(["before", "after"] as const).map((side) => (
                      <Collapsible key={side}>
                        <CollapsibleTrigger asChild>
                          <Button
                            className="w-full justify-between"
                            size="sm"
                            variant="outline"
                          >
                            <span className="capitalize">{side}</span>
                            <ChevronsUpDown className="h-3.5 w-3.5" />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 rounded-lg bg-muted/40 p-3">
                          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-foreground">
                            {JSON.stringify(log[side] || {}, null, 2)}
                          </pre>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
