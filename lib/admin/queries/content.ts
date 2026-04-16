import { computeContentHealth } from "@/lib/admin/content-health";
import { requireDb, collections } from "@/lib/admin/firestore";
import type { ContentHealthRecord } from "@/lib/admin/types";

export async function getContentHealth(): Promise<ContentHealthRecord[]> {
  const db = requireDb();
  const snap = await db
    .collection(collections.contentHealth)
    .orderBy("title", "asc")
    .limit(200)
    .get();
  if (snap.empty) {
    return computeContentHealth();
  }
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<ContentHealthRecord, "id">),
  }));
}
