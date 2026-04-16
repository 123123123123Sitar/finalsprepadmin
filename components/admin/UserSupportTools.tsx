"use client";

import { useState, useTransition } from "react";
import { CopyButton } from "@/components/admin/CopyButton";
import { SectionCard } from "@/components/admin/SectionCard";

export function UserSupportTools({
  uid,
  email,
  stripeCustomerId,
  stripeSubscriptionId,
}: {
  uid: string;
  email: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}) {
  const [summary, setSummary] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function exportSnapshot() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/users/${uid}`);
      const payload = await response.text();
      if (!response.ok) {
        setMessage("Failed to export user snapshot.");
        return;
      }
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `finalsprep-user-${uid}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("User snapshot exported.");
    });
  }

  function generateSummary() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/support-summary/${uid}`);
      const payload = (await response.json().catch(() => ({}))) as {
        summary?: string;
        error?: string;
      };
      if (!response.ok) {
        setMessage(payload.error || "Failed to build support summary.");
        return;
      }
      setSummary(payload.summary || "");
    });
  }

  return (
    <SectionCard
      title="Support Utilities"
      description="Fast support tooling for lookup, handoff notes, exports, and safe account handling."
    >
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-line p-4">
            <p className="text-sm font-medium text-ink">Identifiers</p>
            <div className="mt-3 space-y-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="font-medium text-ink">UID</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <code className="font-mono text-xs text-body">{uid}</code>
                  <CopyButton value={uid} />
                </div>
              </div>
              {email ? (
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="font-medium text-ink">Email</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <code className="font-mono text-xs text-body">{email}</code>
                    <CopyButton value={email} />
                  </div>
                </div>
              ) : null}
              {stripeCustomerId ? (
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="font-medium text-ink">Stripe customer</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <code className="font-mono text-xs text-body">{stripeCustomerId}</code>
                    <CopyButton value={stripeCustomerId} />
                  </div>
                </div>
              ) : null}
              {stripeSubscriptionId ? (
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="font-medium text-ink">Stripe subscription</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <code className="font-mono text-xs text-body">{stripeSubscriptionId}</code>
                    <CopyButton value={stripeSubscriptionId} />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-line p-4">
            <p className="text-sm font-medium text-ink">Quick actions</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button className="admin-button" disabled={isPending} onClick={generateSummary} type="button">
                Generate support summary
              </button>
              <button className="admin-button-secondary" disabled={isPending} onClick={exportSnapshot} type="button">
                Export usage and billing history
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-body">
              Impersonation is intentionally not enabled in this build. It creates too much risk
              around cross-session leakage unless the student app adopts a dedicated read-only
              support token model.
            </p>
            {message ? <p className="mt-3 text-sm text-accent">{message}</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-line p-4">
          <p className="text-sm font-medium text-ink">Support summary</p>
          <textarea
            className="admin-textarea mt-3 min-h-[280px] font-mono text-xs"
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Generate a support summary to hand off a concise account snapshot."
            value={summary}
          />
        </div>
      </div>
    </SectionCard>
  );
}

