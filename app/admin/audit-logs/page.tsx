import { Badge } from "@/components/admin/Badge";
import { EmptyState } from "@/components/admin/EmptyState";
import { PageHeader } from "@/components/admin/PageHeader";
import { SectionCard } from "@/components/admin/SectionCard";
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

      <SectionCard title="Filters" description="Target ID is usually a user UID, settings key, or feature-flag key.">
        <form action="/admin/audit-logs" className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_180px_auto]">
          <input className="admin-input" defaultValue={targetId} name="targetId" placeholder="Target id" />
          <input className="admin-input" defaultValue={actorUid} name="actorUid" placeholder="Actor uid" />
          <input className="admin-input" defaultValue={action} name="action" placeholder="Action name" />
          <input className="admin-input" defaultValue={String(limit)} inputMode="numeric" name="limit" placeholder="Limit" />
          <button className="admin-button" type="submit">Apply</button>
        </form>
      </SectionCard>

      <SectionCard title="Entries" description={`${logs.length} audit entries returned.`}>
        {logs.length === 0 ? (
          <EmptyState title="No audit entries" description="Nothing matched the current filters." />
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-line p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-2xl text-ink">{log.action}</h3>
                      <Badge tone={log.status === "success" ? "success" : "danger"}>
                        {log.status}
                      </Badge>
                      <Badge tone="neutral">{log.targetType}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-body">
                      Actor: {log.actorEmail || log.actorUid} • Target: {log.targetId} • {formatDate(log.createdAt)}
                    </p>
                    {log.reason ? <p className="mt-2 text-sm leading-6 text-body">{log.reason}</p> : null}
                  </div>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <details className="rounded-2xl bg-slate-50 p-4 text-sm text-body">
                    <summary className="cursor-pointer font-medium text-ink">Before</summary>
                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-body">
                      {JSON.stringify(log.before || {}, null, 2)}
                    </pre>
                  </details>
                  <details className="rounded-2xl bg-slate-50 p-4 text-sm text-body">
                    <summary className="cursor-pointer font-medium text-ink">After</summary>
                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-body">
                      {JSON.stringify(log.after || {}, null, 2)}
                    </pre>
                  </details>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
