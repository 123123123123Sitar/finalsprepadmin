"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Download, FileText, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton } from "@/components/admin/CopyButton";
import { SectionCard } from "@/components/admin/SectionCard";

export function UserSupportTools({
  uid,
  email,
}: {
  uid: string;
  email: string | null;
}) {
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function exportSnapshot() {
    setError(null);
    startTransition(async () => {
      let response: Response;
      try {
        response = await fetch(`/api/admin/users/${uid}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Network error";
        setError(message);
        toast.error("Failed to export snapshot", { description: message });
        return;
      }

      const payload = await response.text();
      if (!response.ok) {
        const message = `Server returned ${response.status} ${response.statusText || ""}`.trim();
        setError(message);
        toast.error("Failed to export snapshot", { description: message });
        return;
      }

      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `finalsprep-user-${uid}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("User snapshot exported");
    });
  }

  function generateSummary() {
    setError(null);
    startTransition(async () => {
      let response: Response;
      try {
        response = await fetch(`/api/admin/support-summary/${uid}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Network error";
        setError(message);
        toast.error("Failed to fetch support summary", { description: message });
        return;
      }

      const text = await response.text();
      let parsed: { summary?: string; error?: string } | null = null;
      try {
        parsed = text ? (JSON.parse(text) as { summary?: string; error?: string }) : null;
      } catch {
        // Non-JSON response — fall through to error path with the status text
      }

      if (!response.ok || !parsed) {
        const message =
          parsed?.error ||
          `Server returned ${response.status} ${response.statusText || ""}`.trim() ||
          "Empty response from server";
        setError(message);
        toast.error("Failed to generate summary", { description: message });
        return;
      }

      const body = parsed.summary || "";
      if (!body) {
        const message = "Server returned an empty summary.";
        setError(message);
        toast.error("Failed to generate summary", { description: message });
        return;
      }
      setSummary(body);
      toast.success("Support summary generated");
    });
  }

  return (
    <SectionCard
      title="Support utilities"
      description="Fast support tooling for lookup, handoff notes, exports, and safe account handling."
    >
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm font-medium text-foreground">Identifiers</p>
            <div className="mt-3 space-y-3 text-sm">
              <div className="rounded-md bg-muted/40 p-3">
                <p className="font-medium text-foreground">UID</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <code className="break-all font-mono text-xs text-muted-foreground">
                    {uid}
                  </code>
                  <CopyButton value={uid} />
                </div>
              </div>
              {email ? (
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="font-medium text-foreground">Email</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <code className="break-all font-mono text-xs text-muted-foreground">
                      {email}
                    </code>
                    <CopyButton value={email} />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm font-medium text-foreground">Quick actions</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button
                disabled={isPending}
                onClick={generateSummary}
                type="button"
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                Generate support summary
              </Button>
              <Button
                disabled={isPending}
                onClick={exportSnapshot}
                type="button"
                variant="outline"
              >
                <Download className="mr-2 h-4 w-4" />
                Export usage and billing
              </Button>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Impersonation is intentionally not enabled in this build. It
              creates too much risk around cross-session leakage unless the
              student app adopts a dedicated read-only support token model.
            </p>
            {error ? (
              <Alert className="mt-4" variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Last attempt failed</AlertTitle>
                <AlertDescription className="mt-2 space-y-3">
                  <p className="text-sm">{error}</p>
                  <Button
                    disabled={isPending}
                    onClick={generateSummary}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-medium text-foreground">Support summary</p>
          <Textarea
            className="mt-3 min-h-[280px] font-mono text-xs"
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Generate a support summary to hand off a concise account snapshot."
            value={summary}
          />
        </div>
      </div>
    </SectionCard>
  );
}
