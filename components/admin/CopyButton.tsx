"use client";

import { useState } from "react";

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
    <button className="admin-button-secondary px-3 py-1.5 text-xs" onClick={handleCopy} type="button">
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

