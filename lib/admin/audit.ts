import { requireDb, collections } from "@/lib/admin/firestore";
import type { AdminAuditLog, AdminContext } from "@/lib/admin/types";

export async function writeAuditLog(
  actor: AdminContext,
  input: Omit<AdminAuditLog, "id" | "actorUid" | "actorEmail" | "actorRoles" | "createdAt">
) {
  const db = requireDb();
  await db.collection(collections.adminAuditLogs).add({
    ...input,
    actorUid: actor.uid,
    actorEmail: actor.email ?? null,
    actorRoles: actor.roles,
    createdAt: Date.now(),
  });
}

export function requestMetadata(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  return {
    ip,
    userAgent: request.headers.get("user-agent"),
  };
}
