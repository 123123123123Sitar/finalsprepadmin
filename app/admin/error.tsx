"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="admin-card max-w-3xl p-8">
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-danger">Admin Error</p>
      <h1 className="mt-3 font-display text-4xl text-ink">The admin page failed to load.</h1>
      <p className="mt-4 text-sm leading-6 text-body">
        {error.message || "Unexpected operator console failure."}
      </p>
      <button className="admin-button mt-6" onClick={reset} type="button">
        Retry
      </button>
    </div>
  );
}

