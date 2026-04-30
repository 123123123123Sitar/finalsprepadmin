"use client";

import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SectionCard } from "@/components/admin/SectionCard";

type ChatHistoryEntry = {
  id: string;
  kind: string | null;
  model: string | null;
  tokens: number;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number;
  promptPreview: string | null;
  responsePreview: string | null;
  prompt: string | null;
  response: string | null;
  createdAt: number | null;
};

type ChatHistoryPullResult = {
  uid: string;
  entryCount: number;
  truncated: boolean;
  firstAt: number | null;
  lastAt: number | null;
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  entriesMissingRawTokens: number;
  totalCostUsd: number;
  byKind: Record<string, number>;
  byModel: Record<string, number>;
  pulledAt: number;
  entries: ChatHistoryEntry[];
};

function formatDate(value: number | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatNumber(value: number) {
  return value.toLocaleString();
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  }).format(value);
}

export function ChatHistoryPullPanel({
  uid,
  userLabel,
}: {
  uid: string;
  userLabel: string;
}) {
  const [reason, setReason] = useState("");
  const [limit, setLimit] = useState<string>("500");
  const [sinceDays, setSinceDays] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ChatHistoryPullResult | null>(null);

  const canPull = !loading && reason.trim().length >= 3;

  const downloadUrl = useMemo(() => {
    if (!result) return null;
    const payload = JSON.stringify(result, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    return URL.createObjectURL(blob);
  }, [result]);

  async function handlePull() {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { reason: reason.trim() };
      const limitNumber = Number(limit);
      if (!Number.isNaN(limitNumber) && limitNumber > 0) body.limit = limitNumber;
      if (sinceDays !== "all") {
        const sinceNumber = Number(sinceDays);
        if (!Number.isNaN(sinceNumber) && sinceNumber > 0) {
          body.sinceDays = sinceNumber;
        }
      }

      const response = await fetch(`/api/admin/users/${uid}/chat-history`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      let json: { ok?: boolean; result?: ChatHistoryPullResult; error?: string } = {};
      try {
        json = await response.json();
      } catch {
        // Body wasn't JSON — fall through to status-based error.
      }
      if (!response.ok) {
        throw new Error(json?.error || `Pull failed (HTTP ${response.status})`);
      }
      if (!json.result) {
        throw new Error("Pull succeeded but returned no result payload.");
      }
      setResult(json.result);
      toast.success(`Pulled ${formatNumber(json.result.entryCount)} entries`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      toast.error("Failed to pull chat history", { description: message });
    } finally {
      setLoading(false);
    }
  }

  const totalApiTokens =
    (result?.totalInputTokens ?? 0) + (result?.totalOutputTokens ?? 0);
  const hasZeroEntries = result !== null && result.entryCount === 0;

  return (
    <SectionCard
      title="Pull chat history"
      description="Manually load recent AI chat entries for this user. Each pull is audit-logged and charged against the Firestore read budget — include a reason and prefer a tight window."
      actions={
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Target UID
          </p>
          <code className="font-mono text-[11px]">{uid}</code>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="chat-pull-reason">Reason (required, audited)</Label>
          <Input
            id="chat-pull-reason"
            onChange={(event) => setReason(event.target.value)}
            placeholder="Support ticket #, suspected abuse, user-requested export…"
            value={reason}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Max entries</Label>
          <Select onValueChange={(value) => setLimit(value)} value={limit}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="250">250</SelectItem>
              <SelectItem value="500">500 (default)</SelectItem>
              <SelectItem value="1000">1,000</SelectItem>
              <SelectItem value="2000">2,000 (hard cap)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Since (days)</Label>
          <Select onValueChange={(value) => setSinceDays(value)} value={sinceDays}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All history</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="180">Last 180 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button
            className="w-full md:w-auto"
            disabled={!canPull}
            onClick={handlePull}
            type="button"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Pulling…
              </>
            ) : (
              "Pull chat history"
            )}
          </Button>
        </div>
      </div>

      {error ? (
        <Alert className="mt-4" variant="destructive">
          <AlertTitle>Pull failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {hasZeroEntries ? (
        <Alert className="mt-4">
          <AlertTitle>No history found</AlertTitle>
          <AlertDescription>
            No AI history found for this user
            {sinceDays !== "all" ? ` in the last ${sinceDays} days` : ""}. They may not
            have used any AI features yet — confirm by checking{" "}
            <code className="font-mono text-xs">users/{uid}/aiHistory</code> in
            Firestore.
          </AlertDescription>
        </Alert>
      ) : null}

      {result && result.entryCount > 0 ? (
        <div className="mt-6 space-y-5">
          <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 md:grid-cols-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Entries
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-foreground">
                {formatNumber(result.entryCount)}
              </p>
              {result.truncated ? (
                <p className="mt-1 text-xs text-amber-600">
                  Capped — raise limit or narrow window.
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                API tokens
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-foreground">
                {formatNumber(totalApiTokens)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatNumber(result.totalInputTokens)} in ·{" "}
                {formatNumber(result.totalOutputTokens)} out
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Billing units
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-foreground">
                {formatNumber(result.totalTokens)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Est. cost
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-foreground">
                {formatUsd(result.totalCostUsd)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Window
              </p>
              <p className="mt-1 text-xs leading-5 text-foreground">
                {formatDate(result.firstAt)} →<br />
                {formatDate(result.lastAt)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {downloadUrl ? (
              <Button asChild variant="outline">
                <a
                  download={`chat-history-${uid}-${new Date(result.pulledAt)
                    .toISOString()
                    .slice(0, 19)
                    .replace(/:/g, "-")}.json`}
                  href={downloadUrl}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download JSON
                </a>
              </Button>
            ) : null}
            <Button
              onClick={() => {
                setResult(null);
                setReason("");
              }}
              type="button"
              variant="outline"
            >
              Clear
            </Button>
            <p className="text-xs text-muted-foreground">
              Pulled {new Date(result.pulledAt).toLocaleString()} · {userLabel}
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">In / Out</TableHead>
                  <TableHead className="text-right">Billed</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Preview</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.entries.slice(0, 25).map((entry) => (
                  <TableRow key={entry.id} className="align-top">
                    <TableCell>{formatDate(entry.createdAt)}</TableCell>
                    <TableCell>{entry.kind || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {entry.model || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.inputTokens === null && entry.outputTokens === null
                        ? "—"
                        : `${formatNumber(entry.inputTokens || 0)} / ${formatNumber(entry.outputTokens || 0)}`}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(entry.tokens)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatUsd(entry.costUsd)}
                    </TableCell>
                    <TableCell>
                      <p className="line-clamp-2 text-foreground">
                        {entry.promptPreview || "—"}
                      </p>
                      <p className="mt-1 line-clamp-2 text-muted-foreground">
                        {entry.responsePreview || "—"}
                      </p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {result.entries.length > 25 ? (
            <p className="text-xs text-muted-foreground">
              Showing the 25 most recent entries — download the JSON for all{" "}
              {formatNumber(result.entryCount)}.
            </p>
          ) : null}
        </div>
      ) : null}
    </SectionCard>
  );
}
