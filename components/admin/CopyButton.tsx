"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label="Copy to clipboard"
            onClick={handleCopy}
            size="sm"
            variant="outline"
            type="button"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span className="ml-1.5 text-xs">{copied ? "Copied" : "Copy"}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copied ? "Copied to clipboard" : "Copy to clipboard"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
