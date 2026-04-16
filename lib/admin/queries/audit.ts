import { requireDb, collections } from "@/lib/admin/firestore";
import type { AdminAuditLog } from "@/lib/admin/types";

export async function listAuditLogs(query?: {
  targetId?: string;
  actorUid?: string;
  action?: string;
  limit?: number;
}) {
  const db = requireDb();
  let ref = db.collection(collections.adminAuditLogs).orderBy("createdAt", "desc");

  if (query?.targetId) {
    ref = ref.where("targetId", "==", query.targetId) as typeof ref;
  }
  if (query?.actorUid) {
    ref = ref.where("actorUid", "==", query.actorUid) as typeof ref;
  }
  if (query?.action) {
    ref = ref.where("action", "==", query.action) as typeof ref;
  }

  const snap = await ref.limit(query?.limit || 100).get();
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<AdminAuditLog, "id">),
  }));
}
