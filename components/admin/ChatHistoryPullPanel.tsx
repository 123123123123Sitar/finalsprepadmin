"use client";

import { useMemo, useState } from "react";

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
  const [sinceDays, setSinceDays] = useState<string>("");
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
      const sinceNumber = Number(sinceDays);
      if (!Number.isNaN(sinceNumber) && sinceNumber > 0) body.sinceDays = sinceNumber;

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
        throw new Error(
          json?.error || `Pull failed (HTTP ${response.status})`
        );
      }
      if (!json.result) {
        throw new Error("Pull succeeded but returned no result payload.");
      }
      setResult(json.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const totalApiTokens =
    (result?.totalInputTokens ?? 0) + (result?.totalOutputTokens ?? 0);
  const hasZeroEntries = result !== null && result.entryCount === 0;

  return (
    <section className="admin-card p-6">
      <div className="flex flex-col gap-3 border-b border-line pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="font-display text-2xl text-ink">Pull chat history</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-body">
            Manually load recent AI chat entries for this user. Chat history is never
            pulled automatically — each pull is audit-logged and charged against the
            Firestore read budget, so include a reason and prefer a tight window.
          </p>
        </div>
        <div className="text-right text-xs text-mute">
          <p>Target UID</p>
          <code className="font-mono text-[11px]">{uid}</code>
        </div>
      </div>

      <div className="grid gap-4 pt-5 md:grid-cols-[2fr_1fr_1fr_auto]">
        <label className="flex flex-col gap-1 text-sm text-body">
          <span className="font-medium text-ink">Reason (required, audited)</span>
          <input
            className="admin-input"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Support ticket #, suspected abuse, user-requested export…"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-body">
          <span className="font-medium text-ink">Max entries</span>
          <select
            className="admin-select"
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
          >
            <option value="100">100</option>
            <option value="250">250</option>
            <option value="500">500 (default)</option>
            <option value="1000">1,000</option>
            <option value="2000">2,000 (hard cap)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-body">
          <span className="font-medium text-ink">Since (days)</span>
          <select
            className="admin-select"
            value={sinceDays}
            onChange={(event) => setSinceDays(event.target.value)}
          >
            <option value="">All history</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 180 days</option>
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="button"
            className="admin-button-accent w-full md:w-auto"
            disabled={!canPull}
            onClick={handlePull}
            aria-disabled={!canPull}
          >
            {loading ? "Pulling…" : "Pull chat history"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="admin-toast-enter mt-4 rounded-2xl bg-dangerSoft px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {hasZeroEntries ? (
        <p className="admin-toast-enter mt-4 rounded-2xl border border-line bg-slate-50 px-4 py-3 text-sm text-body">
          No AI history found for this user
          {sinceDays ? ` in the last ${sinceDays} days` : ""}. They may not have
          used any AI features yet — confirm by checking{" "}
          <code className="font-mono text-xs">users/{uid}/aiHistory</code> in
          Firestore directly.
        </p>
      ) : null}

      {result && result.entryCount > 0 ? (
        <div className="admin-toast-enter mt-6 space-y-5">
          <div className="grid gap-3 rounded-2xl border border-line bg-slate-50 p-4 text-sm text-body md:grid-cols-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-mute">Entries</p>
              <p className="mt-1 font-display text-2xl text-ink">
                {formatNumber(result.entryCount)}
              </p>
              {result.truncated ? (
                <p className="mt-1 text-xs text-warning">
                  Capped — raise limit or narrow the window.
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-mute">
                API tokens (in + out)
              </p>
              <p className="mt-1 font-display text-2xl text-ink">
                {formatNumber(totalApiTokens)}
              </p>
              <p className="mt-1 text-xs text-mute">
                {formatNumber(result.totalInputTokens)} in ·{" "}
                {formatNumber(result.totalOutputTokens)} out
              </p>
              {result.entriesMissingRawTokens > 0 ? (
                <p className="mt-1 text-xs text-warning">
                  {formatNumber(result.entriesMissingRawTokens)} older
                  entries lack raw tokens.
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-mute">
                Billing units
              </p>
              <p className="mt-1 font-display text-2xl text-ink">
                {formatNumber(result.totalTokens)}
              </p>
              <p className="mt-1 text-xs text-mute">
                Cost-weighted (floor + tax + multipliers).
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-mute">Est. cost</p>
              <p className="mt-1 font-display text-2xl text-ink">
                {formatUsd(result.totalCostUsd)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-mute">Window</p>
              <p className="mt-1 text-xs leading-5 text-body">
                {formatDate(result.firstAt)} →<br />
                {formatDate(result.lastAt)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {downloadUrl ? (
              <a
                className="admin-button-secondary"
                href={downloadUrl}
                download={`chat-history-${uid}-${new Date(result.pulledAt)
                  .toISOString()
                  .slice(0, 19)
                  .replace(/:/g, "-")}.json`}
              >
                Download JSON
              </a>
            ) : null}
            <button
              type="button"
              className="admin-button-secondary"
              onClick={() => {
                setResult(null);
                setReason("");
              }}
            >
              Clear
            </button>
            <p className="text-xs text-mute">
              Pulled {new Date(result.pulledAt).toLocaleString()} · {userLabel}
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-line">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-mute">
                <tr>
                  <th className="px-4 py-3 text-left">When</th>
                  <th className="px-4 py-3 text-left">Kind</th>
                  <th className="px-4 py-3 text-left">Model</th>
                  <th className="px-4 py-3 text-right">In / Out</th>
                  <th className="px-4 py-3 text-right">Billed</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                  <th className="px-4 py-3 text-left">Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.entries.slice(0, 25).map((entry) => (
                  <tr key={entry.id} className="align-top">
                    <td className="px-4 py-3 text-body">{formatDate(entry.createdAt)}</td>
                    <td className="px-4 py-3 text-body">{entry.kind || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-body">{entry.model || "—"}</td>
                    <td className="px-4 py-3 text-right text-body">
                      {entry.inputTokens === null && entry.outputTokens === null
                        ? "—"
                        : `${formatNumber(entry.inputTokens || 0)} / ${formatNumber(entry.outputTokens || 0)}`}
                    </td>
                    <td className="px-4 py-3 text-right text-body">{formatNumber(entry.tokens)}</td>
                    <td className="px-4 py-3 text-right text-body">{formatUsd(entry.costUsd)}</td>
                    <td className="px-4 py-3 text-body">
                      <p className="line-clamp-2 text-ink">{entry.promptPreview || "—"}</p>
                      <p className="mt-1 line-clamp-2 text-mute">
                        {entry.responsePreview || "—"}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.entries.length > 25 ? (
            <p className="text-xs text-mute">
              Showing the 25 most recent entries — download the JSON for all{" "}
              {formatNumber(result.entryCount)}.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
