import { cookies } from "next/headers";
import { getAdminAuth } from "@/lib/firebase-admin";

const DEFAULT_SESSION_AGE_MS = 1000 * 60 * 60 * 24 * 5;

export function adminSessionCookieName(): string {
  return process.env.ADMIN_SESSION_COOKIE_NAME || "fp_admin_session";
}

export async function createAdminSessionCookie(idToken: string) {
  const auth = getAdminAuth();
  if (!auth) throw new Error("Firebase Admin auth not configured");
  return auth.createSessionCookie(idToken, {
    expiresIn: DEFAULT_SESSION_AGE_MS,
  });
}

export async function setAdminSessionCookie(sessionCookie: string) {
  const cookieStore = await cookies();
  cookieStore.set(adminSessionCookieName(), sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEFAULT_SESSION_AGE_MS / 1000,
  });
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(adminSessionCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export async function readDecodedAdminSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(adminSessionCookieName())?.value;
  if (!sessionCookie) return null;

  const auth = getAdminAuth();
  if (!auth) return null;

  try {
    return await auth.verifySessionCookie(sessionCookie, true);
  } catch {
    return null;
  }
}
