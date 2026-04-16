"use client";

import { useEffect, useState, useTransition } from "react";
import { useAdminAuth } from "@/components/auth/AdminAuthProvider";

export function AdminSignInForm({
  nextHref,
  initialError,
}: {
  nextHref: string;
  initialError?: string;
}) {
  const { configured, loading, user, syncSessionFromCurrentUser, signInWithEmail, signInWithGoogle } =
    useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(initialError || null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!loading && user) {
      startTransition(async () => {
        const result = await syncSessionFromCurrentUser();
        if (result.ok) {
          window.location.href = nextHref;
          return;
        }
        setMessage(result.message || "Admin access was not granted for this account.");
      });
    }
  }, [loading, nextHref, syncSessionFromCurrentUser, user]);

  async function handleEmailSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await signInWithEmail(email, password);
      if (result.ok) {
        window.location.href = nextHref;
        return;
      }
      setMessage(result.message || "Sign-in failed.");
    });
  }

  function handleGoogleSignIn() {
    setMessage(null);
    startTransition(async () => {
      const result = await signInWithGoogle();
      if (result.ok) return;
      setMessage(result.message || "Sign-in failed.");
    });
  }

  if (!configured) {
    return (
      <div className="admin-card p-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-mute">Configuration Required</p>
        <h2 className="mt-3 font-display text-3xl text-ink">Firebase is not configured.</h2>
        <p className="mt-4 text-sm text-body">
          Set the `NEXT_PUBLIC_FIREBASE_*` variables and `FIREBASE_ADMIN_KEY_B64` in
          `.env.local`, then restart this app.
        </p>
      </div>
    );
  }

  return (
    <div className="admin-card overflow-hidden">
      <div className="border-b border-line bg-gradient-to-r from-accentSoft via-white to-white px-8 py-6">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">FinalsPrep Internal</p>
        <h2 className="mt-2 font-display text-3xl text-ink">Admin sign-in</h2>
        <p className="mt-3 max-w-xl text-sm text-body">
          Access requires a verified Firebase account plus an admin role in `adminRoles` or
          matching custom claims.
        </p>
      </div>

      <div className="grid gap-8 px-8 py-8 lg:grid-cols-[1.1fr_0.9fr]">
        <form className="space-y-4" onSubmit={handleEmailSignIn}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">Admin email</span>
            <input
              className="admin-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ops@finalsprep.com"
              required
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">Password</span>
            <input
              className="admin-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
            />
          </label>
          <button className="admin-button w-full" disabled={isPending} type="submit">
            {isPending ? "Signing in..." : "Sign in with email"}
          </button>
        </form>

        <div className="rounded-2xl border border-dashed border-line bg-slate-50 p-6">
          <p className="text-sm font-medium text-ink">Google SSO</p>
          <p className="mt-2 text-sm leading-6 text-body">
            If your organization uses Google-authenticated Firebase accounts, this path will
            create the admin session cookie after the Firebase sign-in step completes.
          </p>
          <button className="admin-button-secondary mt-5 w-full" disabled={isPending || loading} onClick={handleGoogleSignIn} type="button">
            Sign in with Google
          </button>
          <div className="mt-6 rounded-xl bg-white p-4 text-sm text-body">
            <p className="font-medium text-ink">Role model</p>
            <ul className="mt-3 space-y-2 text-sm text-body">
              <li>`readonly_admin` for metrics-only access</li>
              <li>`support_admin` for user troubleshooting and notes</li>
              <li>`content_admin` for course and release operations</li>
              <li>`billing_admin` for subscriptions, comp access, and Stripe sync</li>
              <li>`super_admin` for settings, roles, and all sensitive mutations</li>
            </ul>
          </div>
        </div>
      </div>

      {message ? (
        <div className="border-t border-line bg-dangerSoft px-8 py-4 text-sm text-danger">
          {message}
        </div>
      ) : null}
    </div>
  );
}

