"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Filters = {
  search: string;
  plan: string;
  status: string;
  flag: string;
  sort: string;
};

const ALL = "__all__";

function buildHref(params: Record<string, string>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && value !== ALL) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/admin/users?${query}` : "/admin/users";
}

export function UsersFilterBar({ initial }: { initial: Filters }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState<Filters>(initial);

  function pushHref(next: Filters) {
    const href = buildHref({
      search: next.search,
      plan: next.plan,
      status: next.status,
      flag: next.flag,
      sort: next.sort,
    });
    startTransition(() => router.push(href));
  }

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    if (key !== "search") pushHref(next);
  }

  return (
    <form
      className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        pushHref(filters);
      }}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search users"
          className="pl-9"
          name="search"
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          placeholder="Search email, UID, or display name…"
          value={filters.search}
        />
      </div>

      <Select value={filters.plan || ALL} onValueChange={(value) => update("plan", value === ALL ? "" : value)}>
        <SelectTrigger aria-label="Filter by plan">
          <SelectValue placeholder="All plans" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All plans</SelectItem>
          <SelectItem value="learner">Learner</SelectItem>
          <SelectItem value="pro">Pro</SelectItem>
          <SelectItem value="hacker">Hacker</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.status || ALL} onValueChange={(value) => update("status", value === ALL ? "" : value)}>
        <SelectTrigger aria-label="Filter by status">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          <SelectItem value="active">active</SelectItem>
          <SelectItem value="trialing">trialing</SelectItem>
          <SelectItem value="past_due">past_due</SelectItem>
          <SelectItem value="canceled">canceled</SelectItem>
          <SelectItem value="inactive">inactive</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.flag || ALL} onValueChange={(value) => update("flag", value === ALL ? "" : value)}>
        <SelectTrigger aria-label="Filter by flag">
          <SelectValue placeholder="All flags" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All flags</SelectItem>
          <SelectItem value="banned">banned</SelectItem>
          <SelectItem value="suspicious">suspicious</SelectItem>
          <SelectItem value="refunded">refunded</SelectItem>
          <SelectItem value="test">test</SelectItem>
          <SelectItem value="billing_watch">billing_watch</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.sort} onValueChange={(value) => update("sort", value)}>
        <SelectTrigger aria-label="Sort">
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="last_active">Sort: last active</SelectItem>
          <SelectItem value="created">Sort: created</SelectItem>
          <SelectItem value="tokens">Sort: bonus tokens</SelectItem>
          <SelectItem value="cost">Sort: AI cost</SelectItem>
          <SelectItem value="email">Sort: email</SelectItem>
        </SelectContent>
      </Select>

      <Button disabled={isPending} type="submit">
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Apply
      </Button>
    </form>
  );
}
