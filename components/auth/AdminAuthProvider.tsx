"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getRedirectResult,
  onAuthStateChanged,
  reload,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth, getGoogleProvider, isFirebaseConfigured } from "@/lib/firebase-client";

type AuthResult = {
  ok: boolean;
  message?: string;
  code?: string;
};

type AdminAuthContextValue = {
  configured: boolean;
  loading: boolean;
  user: User | null;
  syncSessionFromCurrentUser: () => Promise<AuthResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

function formatAuthError(error: unknown): AuthResult {
  if (!(error instanceof Error)) {
    return { ok: false, message: "Authentication failed." };
  }
  const code = (error as Error & { code?: string }).code;
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return { ok: false, code, message: "The email or password is incorrect." };
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return { ok: false, code, message: "The sign-in popup was closed." };
    case "auth/too-many-requests":
      return { ok: false, code, message: "Too many attempts. Wait a minute and try again." };
    default:
      return { ok: false, code, message: error.message || "Authentication failed." };
  }
}

async function exchangeSession(idToken: string): Promise<AuthResult> {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ idToken }),
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    return {
      ok: false,
      message: payload.error || "Admin session creation failed.",
    };
  }

  return { ok: true };
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }

    getRedirectResult(auth)
      .then(async (result) => {
        if (!result?.user) return;
        const idToken = await result.user.getIdToken(true);
        await exchangeSession(idToken);
      })
      .catch(() => undefined);

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  async function syncSessionFromCurrentUser(): Promise<AuthResult> {
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) {
      return { ok: false, message: "No signed-in Firebase user found." };
    }
    try {
      await reload(auth.currentUser);
      if (!auth.currentUser.emailVerified) {
        return { ok: false, message: "A verified admin email is required." };
      }
      const idToken = await auth.currentUser.getIdToken(true);
      const result = await exchangeSession(idToken);
      if (!result.ok) {
        await firebaseSignOut(auth);
      }
      return result;
    } catch (error) {
      return formatAuthError(error);
    }
  }

  async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
    const auth = getFirebaseAuth();
    if (!auth) {
      return { ok: false, message: "Firebase auth is not configured." };
    }
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      await reload(credential.user);
      if (!credential.user.emailVerified) {
        await firebaseSignOut(auth);
        return { ok: false, message: "This admin account must have a verified email." };
      }
      const idToken = await credential.user.getIdToken(true);
      const result = await exchangeSession(idToken);
      if (!result.ok) {
        await firebaseSignOut(auth);
      }
      return result;
    } catch (error) {
      return formatAuthError(error);
    }
  }

  async function signInWithGoogle(): Promise<AuthResult> {
    const auth = getFirebaseAuth();
    if (!auth) {
      return { ok: false, message: "Firebase auth is not configured." };
    }
    const provider = getGoogleProvider();
    try {
      const credential = await signInWithPopup(auth, provider);
      const idToken = await credential.user.getIdToken(true);
      const result = await exchangeSession(idToken);
      if (!result.ok) {
        await firebaseSignOut(auth);
      }
      return result;
    } catch (error) {
      const formatted = formatAuthError(error);
      if (
        formatted.code === "auth/popup-blocked" ||
        formatted.code === "auth/operation-not-supported-in-this-environment"
      ) {
        try {
          await signInWithRedirect(auth, provider);
          return { ok: true };
        } catch (redirectError) {
          return formatAuthError(redirectError);
        }
      }
      return formatted;
    }
  }

  async function signOut() {
    const auth = getFirebaseAuth();
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    if (auth) {
      await firebaseSignOut(auth);
    }
  }

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      configured,
      loading,
      user,
      syncSessionFromCurrentUser,
      signInWithEmail,
      signInWithGoogle,
      signOut,
    }),
    [configured, loading, user]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const value = useContext(AdminAuthContext);
  if (!value) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return value;
}
