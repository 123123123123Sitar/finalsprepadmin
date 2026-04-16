import { NextResponse } from "next/server";
import { z } from "zod";
import { clearAdminSessionCookie, createAdminSessionCookie, setAdminSessionCookie } from "@/lib/admin/session";
import { requireDb, collections } from "@/lib/admin/firestore";
import { getAdminAuth } from "@/lib/firebase-admin";

const schema = z.object({
  idToken: z.string().min(20),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const auth = getAdminAuth();
    if (!auth) {
      return NextResponse.json({ error: "Admin auth unavailable" }, { status: 500 });
    }

    const decoded = await auth.verifyIdToken(body.idToken, true);
    if (!decoded.email || !decoded.email_verified) {
      return NextResponse.json({ error: "Verified email required" }, { status: 403 });
    }

    const db = requireDb();
    const rolesDoc = await db.collection(collections.adminRoles).doc(decoded.uid).get();
    const customClaims = (decoded as { admin?: boolean; adminRoles?: string[] });
    const roles = rolesDoc.data()?.roles || customClaims.adminRoles || [];
    const active = rolesDoc.exists ? rolesDoc.data()?.active !== false : Boolean(customClaims.admin);
    if (!active || !Array.isArray(roles) || roles.length === 0) {
      return NextResponse.json({ error: "Admin access not granted" }, { status: 403 });
    }

    const sessionCookie = await createAdminSessionCookie(body.idToken);
    await setAdminSessionCookie(sessionCookie);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create session",
      },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  await clearAdminSessionCookie();
  return NextResponse.json({ ok: true });
}
