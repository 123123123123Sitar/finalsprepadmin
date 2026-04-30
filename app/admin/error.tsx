"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl py-8">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle className="font-display text-lg">
          The admin page failed to load.
        </AlertTitle>
        <AlertDescription className="mt-2 space-y-4">
          <p className="text-sm leading-6">
            {error.message || "Unexpected operator console failure."}
          </p>
          {error.digest ? (
            <p className="text-xs text-destructive/80">Digest: {error.digest}</p>
          ) : null}
          <Button onClick={reset} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
