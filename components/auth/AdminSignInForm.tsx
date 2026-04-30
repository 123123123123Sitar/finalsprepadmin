"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle className="font-display text-xl">
          Firebase is not configured.
        </AlertTitle>
        <AlertDescription className="mt-2">
          Set the <code className="font-mono">NEXT_PUBLIC_FIREBASE_*</code> variables
          and <code className="font-mono">FIREBASE_ADMIN_KEY_B64</code> in{" "}
          <code className="font-mono">.env.local</code>, then restart this app.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-gradient-to-r from-orange-50 via-background to-background">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
          FinalsPrep Internal
        </p>
        <CardTitle className="font-display text-2xl">Admin sign-in</CardTitle>
        <CardDescription>
          Access requires a verified Firebase account plus an admin role in{" "}
          <code className="font-mono text-xs">adminRoles</code> or matching custom
          claims.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr]">
        <form className="space-y-4" onSubmit={handleEmailSignIn}>
          <div className="space-y-2">
            <Label htmlFor="admin-email">Admin email</Label>
            <Input
              autoComplete="email"
              id="admin-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ops@finalsprep.com"
              required
              type="email"
              value={email}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password">Password</Label>
            <Input
              autoComplete="current-password"
              id="admin-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
              type="password"
              value={password}
            />
          </div>
          <Button className="w-full" disabled={isPending} type="submit">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign in with email"
            )}
          </Button>
        </form>

        <div className="rounded-xl border border-dashed bg-muted/30 p-5">
          <p className="text-sm font-semibold text-foreground">Google SSO</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            If your organization uses Google-authenticated Firebase accounts,
            this path will create the admin session cookie after the Firebase
            sign-in step completes.
          </p>
          <Button
            className="mt-4 w-full"
            disabled={isPending || loading}
            onClick={handleGoogleSignIn}
            type="button"
            variant="outline"
          >
            Sign in with Google
          </Button>
          <div className="mt-5 rounded-lg border bg-card p-4 text-sm">
            <p className="font-medium text-foreground">Role model</p>
            <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <li>
                <code className="font-mono">readonly_admin</code> — metrics-only access
              </li>
              <li>
                <code className="font-mono">support_admin</code> — user troubleshooting and notes
              </li>
              <li>
                <code className="font-mono">content_admin</code> — course and release operations
              </li>
              <li>
                <code className="font-mono">super_admin</code> — settings, roles, all sensitive mutations
              </li>
            </ul>
          </div>
        </div>
      </CardContent>

      {message ? (
        <div className="border-t bg-destructive/10 px-6 py-3 text-sm text-destructive sm:px-8">
          {message}
        </div>
      ) : null}
    </Card>
  );
}
