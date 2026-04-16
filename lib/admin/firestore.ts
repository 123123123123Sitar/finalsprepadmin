import { getAdminDb } from "@/lib/firebase-admin";

export function requireDb() {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin Firestore is not configured");
  }
  return db;
}

export const collections = {
  adminRoles: "adminRoles",
  adminUsers: "adminUsers",
  adminNotes: "adminNotes",
  adminAuditLogs: "adminAuditLogs",
  manualCreditAdjustments: "manualCreditAdjustments",
  featureFlags: "featureFlags",
  platformSettings: "platformSettings",
  userUsageDaily: "userUsageDaily",
  contentHealth: "contentHealth",
} as const;
