"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SectionCard } from "@/components/admin/SectionCard";
import { Badge } from "@/components/admin/Badge";
import { safeJsonParse } from "@/lib/admin/utils";

function parseList(input: string) {
  return input
    .split(/[\n,]/g)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function UserActionConsole({
  uid,
  currentPlan,
  currentStatus,
  currentBillingInterval,
  currentTokenBalance,
  currentFlags,
  currentEntitlements,
  currentQuota,
  currentAdminRoles,
  currentAdminActive,
  canSupportWrite,
  canBillingWrite,
  canUsageWrite,
  canSuperAdmin,
}: {
  uid: string;
  currentPlan: "learner" | "pro" | "hacker";
  currentStatus: string;
  currentBillingInterval?: "monthly" | "sixmonth";
  currentTokenBalance: number;
  currentFlags: {
    banned?: boolean;
    suspicious?: boolean;
    refunded?: boolean;
    testAccount?: boolean;
    shadowRestricted?: boolean;
    billingWatch?: boolean;
  };
  currentEntitlements: {
    betaFeatures?: string[];
    featureFlags?: Record<string, boolean>;
    unlockedCourses?: string[];
    unlockedTools?: string[];
  };
  currentQuota?: {
    monthlyTokens?: number | null;
    dailyMessages?: number | null;
  } | null;
  currentAdminRoles: string[];
  currentAdminActive: boolean;
  canSupportWrite: boolean;
  canBillingWrite: boolean;
  canUsageWrite: boolean;
  canSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "danger">("success");

  const [plan, setPlan] = useState(currentPlan);
  const [status, setStatus] = useState(currentStatus || "active");
  const [billingInterval, setBillingInterval] = useState(currentBillingInterval || "monthly");
  const [compDays, setCompDays] = useState("");
  const [planReason, setPlanReason] = useState("");

  const [tokenAmount, setTokenAmount] = useState("5000");
  const [tokenSource, setTokenSource] = useState<
    "manual_add" | "manual_remove" | "reset" | "comp" | "billing_fix"
  >("manual_add");
  const [tokenReason, setTokenReason] = useState("");

  const [noteBody, setNoteBody] = useState("");
  const [noteTags, setNoteTags] = useState("");

  const [flags, setFlags] = useState({
    banned: Boolean(currentFlags.banned),
    suspicious: Boolean(currentFlags.suspicious),
    refunded: Boolean(currentFlags.refunded),
    testAccount: Boolean(currentFlags.testAccount),
    shadowRestricted: Boolean(currentFlags.shadowRestricted),
    billingWatch: Boolean(currentFlags.billingWatch),
    disableAccount: Boolean(currentFlags.banned),
  });
  const [flagsReason, setFlagsReason] = useState("");

  const [betaFeatures, setBetaFeatures] = useState(
    (currentEntitlements.betaFeatures || []).join(", ")
  );
  const [featureFlagsJson, setFeatureFlagsJson] = useState(
    JSON.stringify(currentEntitlements.featureFlags || {}, null, 2)
  );
  const [unlockedCourses, setUnlockedCourses] = useState(
    (currentEntitlements.unlockedCourses || []).join(", ")
  );
  const [unlockedTools, setUnlockedTools] = useState(
    (currentEntitlements.unlockedTools || []).join(", ")
  );
  const [entitlementReason, setEntitlementReason] = useState("");

  const [monthlyTokens, setMonthlyTokens] = useState(
    currentQuota?.monthlyTokens == null ? "" : String(currentQuota.monthlyTokens)
  );
  const [dailyMessages, setDailyMessages] = useState(
    currentQuota?.dailyMessages == null ? "" : String(currentQuota.dailyMessages)
  );
  const [quotaReason, setQuotaReason] = useState("");

  const [adminRoles, setAdminRoles] = useState<string[]>(currentAdminRoles);
  const [adminActive, setAdminActive] = useState(currentAdminActive);
  const [adminReason, setAdminReason] = useState("");

  const mutationGroups = useMemo(
    () => [
      {
        key: "support",
        label: "Support",
        enabled: canSupportWrite,
      },
      {
        key: "billing",
        label: "Billing",
        enabled: canBillingWrite,
      },
      {
        key: "usage",
        label: "Usage",
        enabled: canUsageWrite,
      },
      {
        key: "super",
        label: "Super Admin",
        enabled: canSuperAdmin,
      },
    ],
    [canBillingWrite, canSupportWrite, canSuperAdmin, canUsageWrite]
  );

  async function postMutation(
    payload: Record<string, unknown>,
    successText: string,
    confirmText?: string
  ) {
    if (confirmText && !window.confirm(confirmText)) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/users/${uid}/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setMessageTone("danger");
        setMessage(body.error || "The mutation failed.");
        return;
      }

      setMessageTone("success");
      setMessage(successText);
      router.refresh();
    });
  }

  function toggleAdminRole(role: string) {
    setAdminRoles((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role]
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Mutation Controls"
        description="Sensitive actions are grouped by operational area. The server will reject anything outside the current admin role scope."
        actions={
          <div className="flex flex-wrap gap-2">
            {mutationGroups.map((group) => (
              <Badge key={group.key} tone={group.enabled ? "accent" : "neutral"}>
                {group.label}: {group.enabled ? "enabled" : "read-only"}
              </Badge>
            ))}
          </div>
        }
      >
        {message ? (
          <div
            className={`mb-6 rounded-2xl px-4 py-3 text-sm ${
              messageTone === "success" ? "bg-positiveSoft text-positive" : "bg-dangerSoft text-danger"
            }`}
          >
            {message}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-2">
          {canBillingWrite ? (
            <div className="rounded-2xl border border-line p-5">
              <h3 className="font-display text-xl text-ink">Plan and subscription override</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Plan</span>
                  <select className="admin-select" value={plan} onChange={(event) => setPlan(event.target.value as typeof plan)}>
                    <option value="learner">Learner</option>
                    <option value="pro">Pro</option>
                    <option value="hacker">Hacker</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Status</span>
                  <select className="admin-select" value={status} onChange={(event) => setStatus(event.target.value)}>
                    <option value="active">active</option>
                    <option value="trialing">trialing</option>
                    <option value="canceled">canceled</option>
                    <option value="past_due">past_due</option>
                    <option value="inactive">inactive</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Interval</span>
                  <select className="admin-select" value={billingInterval} onChange={(event) => setBillingInterval(event.target.value as typeof billingInterval)}>
                    <option value="monthly">Monthly</option>
                    <option value="sixmonth">6 months</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Comp days</span>
                  <input
                    className="admin-input"
                    inputMode="numeric"
                    onChange={(event) => setCompDays(event.target.value)}
                    placeholder="0"
                    value={compDays}
                  />
                </label>
              </div>
              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-medium text-ink">Reason</span>
                <textarea className="admin-textarea" onChange={(event) => setPlanReason(event.target.value)} value={planReason} />
              </label>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className="admin-button"
                  disabled={isPending || planReason.trim().length < 3}
                  onClick={() =>
                    postMutation(
                      {
                        action: "set_plan",
                        plan,
                        status,
                        billingInterval,
                        compDays: compDays ? Number(compDays) : undefined,
                        reason: planReason,
                      },
                      "Plan override saved."
                    )
                  }
                  type="button"
                >
                  Save plan override
                </button>
                <button
                  className="admin-button-secondary"
                  disabled={isPending || planReason.trim().length < 3}
                  onClick={() =>
                    postMutation(
                      {
                        action: "sync_stripe",
                        reason: planReason,
                      },
                      "Stripe subscription synced from the source of truth."
                    )
                  }
                  type="button"
                >
                  Sync Stripe now
                </button>
              </div>
            </div>
          ) : null}

          {canUsageWrite ? (
            <div className="rounded-2xl border border-line p-5">
              <h3 className="font-display text-xl text-ink">Credits and quota control</h3>
              <p className="mt-2 text-sm text-body">Current token balance: {currentTokenBalance.toLocaleString()}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr]">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Amount</span>
                  <input className="admin-input" inputMode="numeric" onChange={(event) => setTokenAmount(event.target.value)} value={tokenAmount} />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Source</span>
                  <select className="admin-select" value={tokenSource} onChange={(event) => setTokenSource(event.target.value as typeof tokenSource)}>
                    <option value="manual_add">manual_add</option>
                    <option value="manual_remove">manual_remove</option>
                    <option value="reset">reset</option>
                    <option value="comp">comp</option>
                    <option value="billing_fix">billing_fix</option>
                  </select>
                </label>
              </div>
              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-medium text-ink">Reason</span>
                <textarea className="admin-textarea" onChange={(event) => setTokenReason(event.target.value)} value={tokenReason} />
              </label>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className="admin-button"
                  disabled={isPending || tokenReason.trim().length < 3}
                  onClick={() =>
                    postMutation(
                      {
                        action: "adjust_tokens",
                        amount: Number(tokenAmount || 0),
                        source: tokenSource,
                        reason: tokenReason,
                      },
                      "Token ledger updated.",
                      tokenSource === "manual_remove"
                        ? "Remove credits from this user?"
                        : tokenSource === "reset"
                          ? "Reset the token balance to the entered value?"
                          : undefined
                    )
                  }
                  type="button"
                >
                  Apply token change
                </button>
              </div>

              <div className="mt-6 border-t border-line pt-5">
                <h4 className="text-sm font-medium text-ink">Quota override</h4>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ink">Monthly tokens</span>
                    <input className="admin-input" inputMode="numeric" onChange={(event) => setMonthlyTokens(event.target.value)} placeholder="inherit" value={monthlyTokens} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ink">Daily messages</span>
                    <input className="admin-input" inputMode="numeric" onChange={(event) => setDailyMessages(event.target.value)} placeholder="inherit" value={dailyMessages} />
                  </label>
                </div>
                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-medium text-ink">Reason</span>
                  <textarea className="admin-textarea" onChange={(event) => setQuotaReason(event.target.value)} value={quotaReason} />
                </label>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    className="admin-button"
                    disabled={isPending || quotaReason.trim().length < 3}
                    onClick={() =>
                      postMutation(
                        {
                          action: "set_quota_override",
                          monthlyTokens: monthlyTokens === "" ? null : Number(monthlyTokens),
                          dailyMessages: dailyMessages === "" ? null : Number(dailyMessages),
                          reason: quotaReason,
                        },
                        "Quota override saved."
                      )
                    }
                    type="button"
                  >
                    Save quota override
                  </button>
                  <button
                    className="admin-button-secondary"
                    disabled={isPending || quotaReason.trim().length < 3}
                    onClick={() =>
                      postMutation(
                        {
                          action: "reset_usage_override",
                          reason: quotaReason,
                        },
                        "Usage reset marker saved.",
                        "This only writes a reset marker. Continue?"
                      )
                    }
                    type="button"
                  >
                    Mark usage reset
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {canSupportWrite ? (
            <div className="rounded-2xl border border-line p-5">
              <h3 className="font-display text-xl text-ink">Support notes and moderation flags</h3>
              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-medium text-ink">Internal note</span>
                <textarea className="admin-textarea" onChange={(event) => setNoteBody(event.target.value)} value={noteBody} />
              </label>
              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-medium text-ink">Tags</span>
                <input className="admin-input" onChange={(event) => setNoteTags(event.target.value)} placeholder="refund, abuse, onboarding" value={noteTags} />
              </label>
              <button
                className="admin-button mt-4"
                disabled={isPending || noteBody.trim().length < 3}
                onClick={() =>
                  postMutation(
                    {
                      action: "add_note",
                      body: noteBody,
                      tags: parseList(noteTags),
                    },
                    "Admin note saved."
                  )
                }
                type="button"
              >
                Add note
              </button>

              <div className="mt-6 border-t border-line pt-5">
                <h4 className="text-sm font-medium text-ink">Flags and account state</h4>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["banned", "Banned"],
                      ["suspicious", "Suspicious"],
                      ["refunded", "Refunded"],
                      ["testAccount", "Test account"],
                      ["shadowRestricted", "Shadow restricted"],
                      ["billingWatch", "Billing watch"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm text-ink">
                      <input
                        checked={Boolean(flags[key])}
                        onChange={(event) =>
                          setFlags((current) => ({ ...current, [key]: event.target.checked }))
                        }
                        type="checkbox"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <label className="mt-3 flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm text-ink">
                  <input
                    checked={flags.disableAccount}
                    onChange={(event) =>
                      setFlags((current) => ({
                        ...current,
                        disableAccount: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  <span>Disable Firebase sign-in for this account</span>
                </label>
                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-medium text-ink">Reason</span>
                  <textarea className="admin-textarea" onChange={(event) => setFlagsReason(event.target.value)} value={flagsReason} />
                </label>
                <button
                  className="admin-button-danger mt-4"
                  disabled={isPending || flagsReason.trim().length < 3}
                  onClick={() =>
                    postMutation(
                      {
                        action: "set_flags",
                        flags: {
                          banned: flags.banned,
                          suspicious: flags.suspicious,
                          refunded: flags.refunded,
                          testAccount: flags.testAccount,
                          shadowRestricted: flags.shadowRestricted,
                          billingWatch: flags.billingWatch,
                        },
                        disableAccount: flags.disableAccount,
                        reason: flagsReason,
                      },
                      "Flags updated.",
                      flags.banned || flags.disableAccount
                        ? "This will restrict the account. Continue?"
                        : undefined
                    )
                  }
                  type="button"
                >
                  Save flags
                </button>
              </div>
            </div>
          ) : null}

          {canSupportWrite ? (
            <div className="rounded-2xl border border-line p-5">
              <h3 className="font-display text-xl text-ink">Entitlements and unlocks</h3>
              <div className="grid gap-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Beta features</span>
                  <input className="admin-input" onChange={(event) => setBetaFeatures(event.target.value)} placeholder="labs-mode, smart-review" value={betaFeatures} />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">User feature flags JSON</span>
                  <textarea className="admin-textarea font-mono" onChange={(event) => setFeatureFlagsJson(event.target.value)} value={featureFlagsJson} />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Unlocked courses</span>
                  <input className="admin-input" onChange={(event) => setUnlockedCourses(event.target.value)} placeholder="ap-biology, ap-calc-ab" value={unlockedCourses} />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Unlocked tools</span>
                  <input className="admin-input" onChange={(event) => setUnlockedTools(event.target.value)} placeholder="chat, explain, interactives" value={unlockedTools} />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Reason</span>
                  <textarea className="admin-textarea" onChange={(event) => setEntitlementReason(event.target.value)} value={entitlementReason} />
                </label>
                <button
                  className="admin-button"
                  disabled={isPending || entitlementReason.trim().length < 3}
                  onClick={() =>
                    postMutation(
                      {
                        action: "set_entitlements",
                        betaFeatures: parseList(betaFeatures),
                        featureFlags: safeJsonParse(featureFlagsJson || "{}", {}),
                        unlockedCourses: parseList(unlockedCourses),
                        unlockedTools: parseList(unlockedTools),
                        reason: entitlementReason,
                      },
                      "Entitlements saved."
                    )
                  }
                  type="button"
                >
                  Save entitlements
                </button>
              </div>
            </div>
          ) : null}

          {canSuperAdmin ? (
            <div className="rounded-2xl border border-line p-5 xl:col-span-2">
              <h3 className="font-display text-xl text-ink">Admin role assignment</h3>
              <p className="mt-2 text-sm text-body">
                This updates both `adminRoles/{uid}` and Firebase custom claims. Use it sparingly.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  "readonly_admin",
                  "support_admin",
                  "content_admin",
                  "billing_admin",
                  "super_admin",
                ].map((role) => (
                  <label key={role} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm text-ink">
                    <input checked={adminRoles.includes(role)} onChange={() => toggleAdminRole(role)} type="checkbox" />
                    <span>{role}</span>
                  </label>
                ))}
              </div>
              <label className="mt-3 flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm text-ink">
                <input checked={adminActive} onChange={(event) => setAdminActive(event.target.checked)} type="checkbox" />
                <span>Admin access active</span>
              </label>
              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-medium text-ink">Reason</span>
                <textarea className="admin-textarea" onChange={(event) => setAdminReason(event.target.value)} value={adminReason} />
              </label>
              <button
                className="admin-button-danger mt-4"
                disabled={isPending || adminReason.trim().length < 3}
                onClick={() =>
                  postMutation(
                    {
                      action: "set_admin_roles",
                      roles: adminRoles,
                      active: adminActive,
                      reason: adminReason,
                    },
                    "Admin role assignment updated.",
                    "This changes elevated access. Continue?"
                  )
                }
                type="button"
              >
                Save admin roles
              </button>
            </div>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}

