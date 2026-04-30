"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/admin/Badge";
import { SectionCard } from "@/components/admin/SectionCard";
import { safeJsonParse } from "@/lib/admin/utils";

function parseList(input: string) {
  return input
    .split(/[\n,]/g)
    .map((value) => value.trim())
    .filter(Boolean);
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
      <span className="text-foreground">{label}</span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
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
  canUsersWrite,
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
  canUsersWrite: boolean;
  canUsageWrite: boolean;
  canSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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

  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    description: string;
    action: () => void;
  } | null>(null);

  const summary = useMemo(
    () => [
      { key: "plan", label: "Plan / users", enabled: canUsersWrite },
      { key: "support", label: "Support", enabled: canSupportWrite },
      { key: "usage", label: "Usage", enabled: canUsageWrite },
      { key: "super", label: "Super admin", enabled: canSuperAdmin },
    ],
    [canSupportWrite, canSuperAdmin, canUsageWrite, canUsersWrite]
  );

  async function postMutation(
    payload: Record<string, unknown>,
    successText: string
  ) {
    startTransition(async () => {
      const response = await fetch(`/api/admin/users/${uid}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        toast.error("Mutation failed", {
          description: body.error || "The mutation failed.",
        });
        return;
      }

      toast.success(successText);
      router.refresh();
    });
  }

  function withConfirm(
    confirmText: { title: string; description: string } | null,
    runner: () => void
  ) {
    if (!confirmText) {
      runner();
      return;
    }
    setPendingConfirm({
      title: confirmText.title,
      description: confirmText.description,
      action: () => {
        setPendingConfirm(null);
        runner();
      },
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
        title="Mutation controls"
        description="Sensitive actions are grouped by operational area. The server will reject anything outside the current admin role scope."
        actions={
          <div className="flex flex-wrap gap-2">
            {summary.map((group) => (
              <Badge key={group.key} tone={group.enabled ? "accent" : "neutral"}>
                {group.label}: {group.enabled ? "enabled" : "read-only"}
              </Badge>
            ))}
          </div>
        }
      >
        <Tabs defaultValue="plan" className="space-y-4">
          <TabsList className="flex w-full flex-wrap justify-start">
            {canUsersWrite ? <TabsTrigger value="plan">Plan</TabsTrigger> : null}
            {canUsageWrite ? <TabsTrigger value="usage">Tokens & quota</TabsTrigger> : null}
            {canSupportWrite ? <TabsTrigger value="support">Notes & flags</TabsTrigger> : null}
            {canSupportWrite ? <TabsTrigger value="entitlements">Entitlements</TabsTrigger> : null}
            {canSuperAdmin ? <TabsTrigger value="roles">Admin roles</TabsTrigger> : null}
          </TabsList>

          {canUsersWrite ? (
            <TabsContent value="plan" className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Plan</Label>
                  <Select onValueChange={(value) => setPlan(value as typeof plan)} value={plan}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="learner">Learner</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="hacker">Hacker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select onValueChange={setStatus} value={status}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">active</SelectItem>
                      <SelectItem value="trialing">trialing</SelectItem>
                      <SelectItem value="canceled">canceled</SelectItem>
                      <SelectItem value="past_due">past_due</SelectItem>
                      <SelectItem value="inactive">inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Interval</Label>
                  <Select
                    onValueChange={(value) => setBillingInterval(value as typeof billingInterval)}
                    value={billingInterval}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="sixmonth">6 months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="comp-days">Comp days</Label>
                  <Input
                    id="comp-days"
                    inputMode="numeric"
                    onChange={(event) => setCompDays(event.target.value)}
                    placeholder="0"
                    value={compDays}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-reason">Reason</Label>
                <Textarea
                  id="plan-reason"
                  onChange={(event) => setPlanReason(event.target.value)}
                  value={planReason}
                />
              </div>
              <Button
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
                    "Plan override saved"
                  )
                }
                type="button"
              >
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save plan override
              </Button>
            </TabsContent>
          ) : null}

          {canUsageWrite ? (
            <TabsContent value="usage" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Current token balance:{" "}
                <span className="font-medium text-foreground">
                  {currentTokenBalance.toLocaleString()}
                </span>
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="token-amount">Amount</Label>
                  <Input
                    id="token-amount"
                    inputMode="numeric"
                    onChange={(event) => setTokenAmount(event.target.value)}
                    value={tokenAmount}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Source</Label>
                  <Select
                    onValueChange={(value) => setTokenSource(value as typeof tokenSource)}
                    value={tokenSource}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual_add">manual_add</SelectItem>
                      <SelectItem value="manual_remove">manual_remove</SelectItem>
                      <SelectItem value="reset">reset</SelectItem>
                      <SelectItem value="comp">comp</SelectItem>
                      <SelectItem value="billing_fix">billing_fix</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="token-reason">Reason</Label>
                <Textarea
                  id="token-reason"
                  onChange={(event) => setTokenReason(event.target.value)}
                  value={tokenReason}
                />
              </div>
              <Button
                disabled={isPending || tokenReason.trim().length < 3}
                onClick={() =>
                  withConfirm(
                    tokenSource === "manual_remove"
                      ? {
                          title: "Remove credits?",
                          description:
                            "This removes credits from this user's bank. Continue?",
                        }
                      : tokenSource === "reset"
                        ? {
                            title: "Reset token balance?",
                            description:
                              "This sets the balance to the entered value. Continue?",
                          }
                        : null,
                    () =>
                      postMutation(
                        {
                          action: "adjust_tokens",
                          amount: Number(tokenAmount || 0),
                          source: tokenSource,
                          reason: tokenReason,
                        },
                        "Token ledger updated"
                      )
                  )
                }
                type="button"
              >
                Apply token change
              </Button>

              <div className="space-y-3 border-t pt-5">
                <p className="text-sm font-medium text-foreground">Quota override</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="monthly-tokens">Monthly tokens</Label>
                    <Input
                      id="monthly-tokens"
                      inputMode="numeric"
                      onChange={(event) => setMonthlyTokens(event.target.value)}
                      placeholder="inherit"
                      value={monthlyTokens}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="daily-messages">Daily messages</Label>
                    <Input
                      id="daily-messages"
                      inputMode="numeric"
                      onChange={(event) => setDailyMessages(event.target.value)}
                      placeholder="inherit"
                      value={dailyMessages}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quota-reason">Reason</Label>
                  <Textarea
                    id="quota-reason"
                    onChange={(event) => setQuotaReason(event.target.value)}
                    value={quotaReason}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={isPending || quotaReason.trim().length < 3}
                    onClick={() =>
                      postMutation(
                        {
                          action: "set_quota_override",
                          monthlyTokens:
                            monthlyTokens === "" ? null : Number(monthlyTokens),
                          dailyMessages:
                            dailyMessages === "" ? null : Number(dailyMessages),
                          reason: quotaReason,
                        },
                        "Quota override saved"
                      )
                    }
                    type="button"
                  >
                    Save quota override
                  </Button>
                  <Button
                    disabled={isPending || quotaReason.trim().length < 3}
                    onClick={() =>
                      withConfirm(
                        {
                          title: "Mark usage reset?",
                          description: "This only writes a reset marker. Continue?",
                        },
                        () =>
                          postMutation(
                            {
                              action: "reset_usage_override",
                              reason: quotaReason,
                            },
                            "Usage reset marker saved"
                          )
                      )
                    }
                    type="button"
                    variant="outline"
                  >
                    Mark usage reset
                  </Button>
                </div>
              </div>
            </TabsContent>
          ) : null}

          {canSupportWrite ? (
            <TabsContent value="support" className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="note-body">Internal note</Label>
                <Textarea
                  id="note-body"
                  onChange={(event) => setNoteBody(event.target.value)}
                  value={noteBody}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="note-tags">Tags</Label>
                <Input
                  id="note-tags"
                  onChange={(event) => setNoteTags(event.target.value)}
                  placeholder="refund, abuse, onboarding"
                  value={noteTags}
                />
              </div>
              <Button
                disabled={isPending || noteBody.trim().length < 3}
                onClick={() =>
                  postMutation(
                    {
                      action: "add_note",
                      body: noteBody,
                      tags: parseList(noteTags),
                    },
                    "Admin note saved"
                  )
                }
                type="button"
              >
                Add note
              </Button>

              <div className="space-y-3 border-t pt-5">
                <p className="text-sm font-medium text-foreground">
                  Flags and account state
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
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
                    <ToggleRow
                      key={key}
                      checked={Boolean(flags[key])}
                      label={label}
                      onChange={(value) =>
                        setFlags((current) => ({ ...current, [key]: value }))
                      }
                    />
                  ))}
                </div>
                <ToggleRow
                  checked={flags.disableAccount}
                  label="Disable Firebase sign-in for this account"
                  onChange={(value) =>
                    setFlags((current) => ({ ...current, disableAccount: value }))
                  }
                />
                <div className="space-y-1.5">
                  <Label htmlFor="flags-reason">Reason</Label>
                  <Textarea
                    id="flags-reason"
                    onChange={(event) => setFlagsReason(event.target.value)}
                    value={flagsReason}
                  />
                </div>
                <Button
                  disabled={isPending || flagsReason.trim().length < 3}
                  onClick={() =>
                    withConfirm(
                      flags.banned || flags.disableAccount
                        ? {
                            title: "Restrict account?",
                            description:
                              "This will restrict the account or disable sign-in. Continue?",
                          }
                        : null,
                      () =>
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
                          "Flags updated"
                        )
                    )
                  }
                  type="button"
                  variant="destructive"
                >
                  Save flags
                </Button>
              </div>
            </TabsContent>
          ) : null}

          {canSupportWrite ? (
            <TabsContent value="entitlements" className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="beta-features">Beta features</Label>
                <Input
                  id="beta-features"
                  onChange={(event) => setBetaFeatures(event.target.value)}
                  placeholder="labs-mode, smart-review"
                  value={betaFeatures}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="feature-flags-json">User feature flags JSON</Label>
                <Textarea
                  className="font-mono text-xs"
                  id="feature-flags-json"
                  onChange={(event) => setFeatureFlagsJson(event.target.value)}
                  value={featureFlagsJson}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unlocked-courses">Unlocked courses</Label>
                <Input
                  id="unlocked-courses"
                  onChange={(event) => setUnlockedCourses(event.target.value)}
                  placeholder="ap-biology, ap-calc-ab"
                  value={unlockedCourses}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unlocked-tools">Unlocked tools</Label>
                <Input
                  id="unlocked-tools"
                  onChange={(event) => setUnlockedTools(event.target.value)}
                  placeholder="chat, explain, interactives"
                  value={unlockedTools}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="entitlement-reason">Reason</Label>
                <Textarea
                  id="entitlement-reason"
                  onChange={(event) => setEntitlementReason(event.target.value)}
                  value={entitlementReason}
                />
              </div>
              <Button
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
                    "Entitlements saved"
                  )
                }
                type="button"
              >
                Save entitlements
              </Button>
            </TabsContent>
          ) : null}

          {canSuperAdmin ? (
            <TabsContent value="roles" className="space-y-4">
              <Card>
                <CardContent className="space-y-4 p-5">
                  <p className="text-sm text-muted-foreground">
                    This updates both{" "}
                    <code className="font-mono text-xs">adminRoles/{`{uid}`}</code>{" "}
                    and Firebase custom claims. Use sparingly.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      "readonly_admin",
                      "support_admin",
                      "content_admin",
                      "super_admin",
                    ].map((role) => (
                      <ToggleRow
                        key={role}
                        checked={adminRoles.includes(role)}
                        label={role}
                        onChange={() => toggleAdminRole(role)}
                      />
                    ))}
                  </div>
                  <ToggleRow
                    checked={adminActive}
                    label="Admin access active"
                    onChange={setAdminActive}
                  />
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-reason">Reason</Label>
                    <Textarea
                      id="admin-reason"
                      onChange={(event) => setAdminReason(event.target.value)}
                      value={adminReason}
                    />
                  </div>
                  <Button
                    disabled={isPending || adminReason.trim().length < 3}
                    onClick={() =>
                      withConfirm(
                        {
                          title: "Change elevated access?",
                          description: "This changes elevated access. Continue?",
                        },
                        () =>
                          postMutation(
                            {
                              action: "set_admin_roles",
                              roles: adminRoles,
                              active: adminActive,
                              reason: adminReason,
                            },
                            "Admin role assignment updated"
                          )
                      )
                    }
                    type="button"
                    variant="destructive"
                  >
                    Save admin roles
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          ) : null}
        </Tabs>
      </SectionCard>

      <AlertDialog
        open={pendingConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setPendingConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingConfirm?.title || "Confirm"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingConfirm?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingConfirm?.action()}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
