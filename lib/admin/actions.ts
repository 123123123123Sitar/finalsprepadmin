import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminAuth } from "@/lib/firebase-admin";
import { writeAuditLog } from "@/lib/admin/audit";
import { requireDb, collections } from "@/lib/admin/firestore";
import { normalizePlanTier } from "@/lib/admin/plans";
import type { AdminContext } from "@/lib/admin/types";
import { hasPermission } from "@/lib/admin/permissions";
import { refreshContentHealthSnapshot } from "@/lib/admin/content-health";

const setPlanSchema = z.object({
  action: z.literal("set_plan"),
  uid: z.string().min(1),
  plan: z.enum(["learner", "pro", "hacker"]),
  status: z.string().default("active"),
  reason: z.string().min(3),
  billingInterval: z.enum(["monthly", "sixmonth"]).optional(),
  compDays: z.number().int().min(0).max(365).optional(),
});

const adjustTokensSchema = z.object({
  action: z.literal("adjust_tokens"),
  uid: z.string().min(1),
  amount: z.number().int().min(-100000).max(100000),
  reason: z.string().min(3),
  source: z.enum(["manual_add", "manual_remove", "reset", "comp", "billing_fix"]),
});

const addNoteSchema = z.object({
  action: z.literal("add_note"),
  uid: z.string().min(1),
  body: z.string().min(3).max(4000),
  tags: z.array(z.string()).optional(),
});

const setFlagsSchema = z.object({
  action: z.literal("set_flags"),
  uid: z.string().min(1),
  reason: z.string().min(3),
  flags: z.object({
    banned: z.boolean().optional(),
    suspicious: z.boolean().optional(),
    refunded: z.boolean().optional(),
    testAccount: z.boolean().optional(),
    shadowRestricted: z.boolean().optional(),
    billingWatch: z.boolean().optional(),
  }),
  disableAccount: z.boolean().optional(),
});

const setEntitlementsSchema = z.object({
  action: z.literal("set_entitlements"),
  uid: z.string().min(1),
  reason: z.string().min(3),
  betaFeatures: z.array(z.string()).optional(),
  featureFlags: z.record(z.boolean()).optional(),
  unlockedCourses: z.array(z.string()).optional(),
  unlockedTools: z.array(z.string()).optional(),
});

const setQuotaSchema = z.object({
  action: z.literal("set_quota_override"),
  uid: z.string().min(1),
  reason: z.string().min(3),
  monthlyTokens: z.number().int().min(0).max(1000000).nullable().optional(),
  dailyMessages: z.number().int().min(0).max(10000).nullable().optional(),
});

const setRolesSchema = z.object({
  action: z.literal("set_admin_roles"),
  uid: z.string().min(1),
  reason: z.string().min(3),
  roles: z.array(
    z.enum([
      "readonly_admin",
      "support_admin",
      "content_admin",
      "super_admin",
    ])
  ),
  active: z.boolean(),
});

const resetUsageSchema = z.object({
  action: z.literal("reset_usage_override"),
  uid: z.string().min(1),
  reason: z.string().min(3),
});

export const adminMutationSchema = z.discriminatedUnion("action", [
  setPlanSchema,
  adjustTokensSchema,
  addNoteSchema,
  setFlagsSchema,
  setEntitlementsSchema,
  setQuotaSchema,
  setRolesSchema,
  resetUsageSchema,
]);

export async function runAdminMutation(
  actor: AdminContext,
  rawInput: unknown
) {
  const input = adminMutationSchema.parse(rawInput);
  assertCanRunMutation(actor, input.action);
  switch (input.action) {
    case "set_plan":
      return setUserPlan(actor, input);
    case "adjust_tokens":
      return adjustUserTokens(actor, input);
    case "add_note":
      return addAdminNote(actor, input);
    case "set_flags":
      return setUserFlags(actor, input);
    case "set_entitlements":
      return setUserEntitlements(actor, input);
    case "set_quota_override":
      return setQuotaOverride(actor, input);
    case "set_admin_roles":
      return setAdminRoles(actor, input);
    case "reset_usage_override":
      return resetUsageOverride(actor, input);
  }
}

function assertCanRunMutation(
  actor: AdminContext,
  action: z.infer<typeof adminMutationSchema>["action"]
) {
  switch (action) {
    case "add_note":
    case "set_flags":
    case "set_entitlements":
      if (hasPermission(actor.roles, "support.write")) return;
      break;
    case "set_plan":
      if (hasPermission(actor.roles, "users.write")) return;
      break;
    case "adjust_tokens":
    case "set_quota_override":
    case "reset_usage_override":
      if (hasPermission(actor.roles, "usage.write")) return;
      break;
    case "set_admin_roles":
      if (actor.roles.includes("super_admin")) return;
      break;
  }
  throw new Error("FORBIDDEN");
}

async function setUserPlan(
  actor: AdminContext,
  input: z.infer<typeof setPlanSchema>
) {
  const db = requireDb();
  const billingRef = db.doc(`users/${input.uid}/profile/billing`);
  const overlayRef = db.collection(collections.adminUsers).doc(input.uid);
  const before = (await billingRef.get()).data() || null;
  const expiresAt =
    input.compDays && input.compDays > 0
      ? Date.now() + input.compDays * 24 * 60 * 60 * 1000
      : null;

  const payload = {
    plan: input.plan,
    status: input.status,
    billingInterval: input.billingInterval,
    updatedAt: Date.now(),
    currentPeriodEnd: expiresAt ? Math.floor(expiresAt / 1000) : before?.currentPeriodEnd,
  };

  await billingRef.set(payload, { merge: true });
  await overlayRef.set(
    {
      manualPlanOverride: {
        plan: input.plan,
        source: input.compDays ? "comp" : "manual",
        reason: input.reason,
        expiresAt,
        updatedBy: actor.uid,
        updatedAt: Date.now(),
      },
      updatedAt: Date.now(),
    },
    { merge: true }
  );

  await writeAuditLog(actor, {
    action: "user.set_plan",
    targetType: "user",
    targetId: input.uid,
    reason: input.reason,
    status: "success",
    before,
    after: payload,
  });

  return payload;
}

async function adjustUserTokens(
  actor: AdminContext,
  input: z.infer<typeof adjustTokensSchema>
) {
  const db = requireDb();
  const tokenRef = db.doc(`users/${input.uid}/profile/tokenBank`);
  let result: { previousValue: number; newValue: number } = {
    previousValue: 0,
    newValue: 0,
  };

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(tokenRef);
    const previousValue = Math.max(0, Math.round((snap.data()?.balance as number) || 0));
    const newValue =
      input.source === "reset"
        ? Math.max(0, input.amount)
        : Math.max(0, previousValue + input.amount);
    result = { previousValue, newValue };

    tx.set(
      tokenRef,
      {
        balance:
          input.source === "reset"
            ? newValue
            : FieldValue.increment(input.amount),
        updatedAt: Date.now(),
        lastSource: `admin:${input.source}`,
      },
      { merge: true }
    );

    const ledgerRef = db.collection(collections.manualCreditAdjustments).doc();
    tx.set(ledgerRef, {
      uid: input.uid,
      amount: input.amount,
      reason: input.reason,
      previousValue,
      newValue,
      source: input.source,
      actorUid: actor.uid,
      actorEmail: actor.email ?? null,
      createdAt: Date.now(),
    });
  });

  await writeAuditLog(actor, {
    action: "user.adjust_tokens",
    targetType: "user",
    targetId: input.uid,
    reason: input.reason,
    status: "success",
    before: { balance: result.previousValue },
    after: { balance: result.newValue, amount: input.amount },
  });

  return result;
}

async function addAdminNote(
  actor: AdminContext,
  input: z.infer<typeof addNoteSchema>
) {
  const db = requireDb();
  const noteRef = db.collection(collections.adminNotes).doc();
  const payload = {
    targetUid: input.uid,
    authorUid: actor.uid,
    authorEmail: actor.email ?? null,
    body: input.body,
    tags: input.tags || [],
    createdAt: Date.now(),
  };
  await noteRef.set(payload);
  await db.collection(collections.adminUsers).doc(input.uid).set(
    {
      adminNotesSummary: input.body.slice(0, 240),
      updatedAt: Date.now(),
    },
    { merge: true }
  );

  await writeAuditLog(actor, {
    action: "user.add_note",
    targetType: "user",
    targetId: input.uid,
    status: "success",
    after: payload,
  });

  return { id: noteRef.id, ...payload };
}

async function setUserFlags(
  actor: AdminContext,
  input: z.infer<typeof setFlagsSchema>
) {
  const db = requireDb();
  const overlayRef = db.collection(collections.adminUsers).doc(input.uid);
  const before = (await overlayRef.get()).data() || null;
  const payload = {
    flags: {
      ...before?.flags,
      ...input.flags,
    },
    updatedAt: Date.now(),
    deactivatedAt:
      input.disableAccount === true ? Date.now() : before?.deactivatedAt ?? null,
    deactivatedBy:
      input.disableAccount === true ? actor.uid : before?.deactivatedBy ?? null,
  };
  await overlayRef.set(payload, { merge: true });

  const auth = getAdminAuth();
  if (auth && input.disableAccount !== undefined) {
    await auth.updateUser(input.uid, { disabled: input.disableAccount });
  }

  await writeAuditLog(actor, {
    action: "user.set_flags",
    targetType: "user",
    targetId: input.uid,
    reason: input.reason,
    status: "success",
    before,
    after: payload,
  });

  return payload;
}

async function setUserEntitlements(
  actor: AdminContext,
  input: z.infer<typeof setEntitlementsSchema>
) {
  const db = requireDb();
  const ref = db.collection(collections.adminUsers).doc(input.uid);
  const before = (await ref.get()).data() || null;
  const payload = {
    betaFeatures: input.betaFeatures ?? before?.betaFeatures ?? [],
    featureFlags: input.featureFlags ?? before?.featureFlags ?? {},
    unlockedCourses: input.unlockedCourses ?? before?.unlockedCourses ?? [],
    unlockedTools: input.unlockedTools ?? before?.unlockedTools ?? [],
    updatedAt: Date.now(),
  };
  await ref.set(payload, { merge: true });
  await writeAuditLog(actor, {
    action: "user.set_entitlements",
    targetType: "user",
    targetId: input.uid,
    reason: input.reason,
    status: "success",
    before,
    after: payload,
  });
  return payload;
}

async function setQuotaOverride(
  actor: AdminContext,
  input: z.infer<typeof setQuotaSchema>
) {
  const db = requireDb();
  const ref = db.collection(collections.adminUsers).doc(input.uid);
  const before = (await ref.get()).data() || null;
  const payload = {
    quotaOverride: {
      monthlyTokens: input.monthlyTokens ?? null,
      dailyMessages: input.dailyMessages ?? null,
      reason: input.reason,
      updatedBy: actor.uid,
      updatedAt: Date.now(),
    },
    updatedAt: Date.now(),
  };
  await ref.set(payload, { merge: true });
  await writeAuditLog(actor, {
    action: "usage.set_quota_override",
    targetType: "user",
    targetId: input.uid,
    reason: input.reason,
    status: "success",
    before,
    after: payload,
  });
  return payload;
}

async function setAdminRoles(
  actor: AdminContext,
  input: z.infer<typeof setRolesSchema>
) {
  const db = requireDb();
  const ref = db.collection(collections.adminRoles).doc(input.uid);
  const before = (await ref.get()).data() || null;
  const payload = {
    uid: input.uid,
    roles: input.roles,
    active: input.active,
    updatedAt: Date.now(),
    updatedBy: actor.uid,
  };
  await ref.set(payload, { merge: true });

  const auth = getAdminAuth();
  if (auth) {
    const user = await auth.getUser(input.uid);
    const existingClaims = user.customClaims || {};
    await auth.setCustomUserClaims(input.uid, {
      ...existingClaims,
      admin: input.active && input.roles.length > 0,
      adminRoles: input.roles,
    });
  }

  await writeAuditLog(actor, {
    action: "admin.set_roles",
    targetType: "user",
    targetId: input.uid,
    reason: input.reason,
    status: "success",
    before,
    after: payload,
  });

  return payload;
}

async function resetUsageOverride(
  actor: AdminContext,
  input: z.infer<typeof resetUsageSchema>
) {
  const db = requireDb();
  const ref = db.collection(collections.adminUsers).doc(input.uid);
  const before = (await ref.get()).data() || null;
  const payload = {
    usageResetAt: Date.now(),
    updatedAt: Date.now(),
  };
  await ref.set(payload, { merge: true });
  await writeAuditLog(actor, {
    action: "usage.reset_override_marker",
    targetType: "user",
    targetId: input.uid,
    reason: input.reason,
    status: "success",
    before,
    after: payload,
  });
  return payload;
}

export async function updatePlatformSettings(
  actor: AdminContext,
  settings: Record<string, unknown>,
  reason: string
) {
  const db = requireDb();
  const ref = db.collection(collections.platformSettings).doc("current");
  const before = (await ref.get()).data() || null;
  const after = {
    ...settings,
    updatedAt: Date.now(),
    updatedBy: actor.uid,
  };
  await ref.set(after, { merge: true });
  await writeAuditLog(actor, {
    action: "settings.update_platform",
    targetType: "settings",
    targetId: "current",
    reason,
    status: "success",
    before,
    after,
  });
  return after;
}

export async function updateFeatureFlag(
  actor: AdminContext,
  key: string,
  flag: Record<string, unknown>,
  reason: string
) {
  const db = requireDb();
  const ref = db.collection(collections.featureFlags).doc(key);
  const before = (await ref.get()).data() || null;
  const after = {
    ...flag,
    key,
    updatedAt: Date.now(),
    updatedBy: actor.uid,
  };
  await ref.set(after, { merge: true });
  await writeAuditLog(actor, {
    action: "settings.update_feature_flag",
    targetType: "feature_flag",
    targetId: key,
    reason,
    status: "success",
    before,
    after,
  });
  return after;
}

export async function updateContentSettings(
  actor: AdminContext,
  content: Record<string, unknown>,
  reason: string
) {
  if (!hasPermission(actor.roles, "content.write")) {
    throw new Error("FORBIDDEN");
  }
  const db = requireDb();
  const ref = db.collection(collections.platformSettings).doc("current");
  const beforeDoc = await ref.get();
  const before = beforeDoc.data() || null;
  const existingContent =
    before && typeof before === "object" && before.content && typeof before.content === "object"
      ? before.content
      : {};
  const after = {
    content: {
      ...existingContent,
      ...content,
    },
    updatedAt: Date.now(),
    updatedBy: actor.uid,
  };
  await ref.set(after, { merge: true });
  await writeAuditLog(actor, {
    action: "content.update_settings",
    targetType: "content",
    targetId: "platformSettings.content",
    reason,
    status: "success",
    before: {
      content: existingContent,
    },
    after,
  });
  return after;
}

export async function refreshContentHealth(actor: AdminContext, reason: string) {
  const before = null;
  const after = await refreshContentHealthSnapshot(actor.uid);
  await writeAuditLog(actor, {
    action: "content.refresh_health",
    targetType: "content",
    targetId: "contentHealth",
    reason,
    status: "success",
    before,
    after: {
      records: after.length,
    },
  });
  return after;
}
