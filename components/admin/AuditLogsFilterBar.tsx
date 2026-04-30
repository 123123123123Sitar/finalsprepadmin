"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Filters = {
  targetId: string;
  actorUid: string;
  action: string;
  limit: string;
};

function buildHref(params: Filters) {
  const search = new URLSearchParams();
  if (params.targetId) search.set("targetId", params.targetId);
  if (params.actorUid) search.set("actorUid", params.actorUid);
  if (params.action) search.set("action", params.action);
  if (params.limit) search.set("limit", params.limit);
  const query = search.toString();
  return query ? `/admin/audit-logs?${query}` : "/admin/audit-logs";
}

export function AuditLogsFilterBar({ initial }: { initial: Filters }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState<Filters>(initial);

  return (
    <form
      className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_180px_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(() => router.push(buildHref(filters)));
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="filter-target">Target ID</Label>
        <Input
          id="filter-target"
          onChange={(event) =>
            setFilters((current) => ({ ...current, targetId: event.target.value }))
          }
          placeholder="user UID, settings key, …"
          value={filters.targetId}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="filter-actor">Actor UID</Label>
        <Input
          id="filter-actor"
          onChange={(event) =>
            setFilters((current) => ({ ...current, actorUid: event.target.value }))
          }
          placeholder="who ran the action"
          value={filters.actorUid}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="filter-action">Action</Label>
        <Input
          id="filter-action"
          onChange={(event) =>
            setFilters((current) => ({ ...current, action: event.target.value }))
          }
          placeholder="user.set_plan, settings.update_…"
          value={filters.action}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="filter-limit">Limit</Label>
        <Input
          id="filter-limit"
          inputMode="numeric"
          onChange={(event) =>
            setFilters((current) => ({ ...current, limit: event.target.value }))
          }
          placeholder="100"
          value={filters.limit}
        />
      </div>
      <div className="flex items-end">
        <Button className="w-full" disabled={isPending} type="submit">
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Apply
        </Button>
      </div>
    </form>
  );
}
