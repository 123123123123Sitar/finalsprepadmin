import { redirect } from "next/navigation";
import { readDecodedAdminSession } from "@/lib/admin/session";
import { requireDb, collections } from "@/lib/admin/firestore";
import { expandPermissions, hasPermission } from "@/lib/admin/permissions";
import type {
  AdminContext,
  AdminPermission,
  AdminRole,
  AdminSessionClaims,
} from "@/lib/admin/types";

function normalizeRoles(value: unknown): AdminRole[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (role): role is AdminRole =>
      role === "readonly_admin" ||
      role === "support_admin" ||
      role === "content_admin" ||
      role === "super_admin"
  );
}

export async function getAdminContext(): Promise<AdminContext | null> {
  const decoded = await readDecodedAdminSession();
  if (!decoded) return null;

  const claims = decoded as typeof decoded & AdminSessionClaims;
  const db = requireDb();
  const rolesDoc = await db.collection(collections.adminRoles).doc(decoded.uid).get();
  const docRoles = rolesDoc.exists
    ? normalizeRoles(rolesDoc.data()?.roles)
    : [];
  const active =
    rolesDoc.exists && typeof rolesDoc.data()?.active === "boolean"
      ? Boolean(rolesDoc.data()?.active)
      : true;

  const mergedRoles = [...new Set([...normalizeRoles(claims.adminRoles), ...docRoles])];
  if (!active || (!claims.admin && mergedRoles.length === 0)) {
    return null;
  }

  return {
    uid: decoded.uid,
    email: decoded.email ?? null,
    emailVerified: Boolean(decoded.email_verified),
    roles: mergedRoles,
    permissions: expandPermissions(mergedRoles),
    displayName: decoded.name ?? null,
  };
}

export async function requireAdminContext(
  permission?: AdminPermission
): Promise<AdminContext> {
  const context = await getAdminContext();
  if (!context || !context.emailVerified) {
    redirect("/signin");
  }
  if (permission && !hasPermission(context.roles, permission)) {
    redirect("/signin?error=forbidden");
  }
  return context;
}

export async function requireApiAdminContext(
  permission?: AdminPermission
): Promise<AdminContext> {
  const context = await getAdminContext();
  if (!context || !context.emailVerified) {
    throw new Error("UNAUTHORIZED");
  }
  if (permission && !hasPermission(context.roles, permission)) {
    throw new Error("FORBIDDEN");
  }
  return context;
}
