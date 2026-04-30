"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
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
import { SectionCard } from "@/components/admin/SectionCard";
import type { FeatureFlagRecord, PlatformSettings } from "@/lib/admin/types";

type EditableFlag = FeatureFlagRecord & {
  rolloutText: string;
};

function toEditableFlag(flag: FeatureFlagRecord): EditableFlag {
  return {
    ...flag,
    rolloutText:
      flag.rollout.value == null
        ? ""
        : Array.isArray(flag.rollout.value)
          ? flag.rollout.value.join(", ")
          : String(flag.rollout.value),
  };
}

function parseRolloutValue(
  strategy: EditableFlag["rollout"]["strategy"],
  value: string
) {
  if (strategy === "all" || strategy === "none") return null;
  if (strategy === "percentage") return Number(value || 0);
  return value
    .split(/[\n,]/g)
    .map((entry) => entry.trim())
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

function NumberField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        disabled={disabled}
        id={id}
        inputMode="numeric"
        onChange={(event) => onChange(Number(event.target.value || 0))}
        value={value}
      />
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        disabled={disabled}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </div>
  );
}

export function SettingsEditor({
  settings,
  featureFlags,
  canWrite,
}: {
  settings: PlatformSettings;
  featureFlags: FeatureFlagRecord[];
  canWrite: boolean;
}) {
  const [draft, setDraft] = useState<PlatformSettings>(settings);
  const [reason, setReason] = useState("");
  const [flags, setFlags] = useState<EditableFlag[]>(
    featureFlags.map(toEditableFlag)
  );
  const [isPending, startTransition] = useTransition();

  function updateFlag(index: number, next: Partial<EditableFlag>) {
    setFlags((current) =>
      current.map((flag, flagIndex) =>
        flagIndex === index ? { ...flag, ...next } : flag
      )
    );
  }

  function saveSettings() {
    startTransition(async () => {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          settings: {
            maintenanceMode: draft.maintenanceMode,
            announcementBanner: draft.announcementBanner,
            ai: draft.ai,
            credits: draft.credits,
            trials: draft.trials,
            pricing: draft.pricing,
            release: draft.release,
            referrals: draft.referrals,
            abuse: draft.abuse,
            support: draft.support,
            legal: draft.legal,
          },
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (response.ok) {
        toast.success("Platform settings saved");
      } else {
        toast.error("Failed to save settings", {
          description: payload.error || "Unknown error",
        });
      }
    });
  }

  function saveFlag(flag: EditableFlag) {
    startTransition(async () => {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          featureFlag: {
            key: flag.key,
            data: {
              enabled: flag.enabled,
              description: flag.description,
              rollout: {
                strategy: flag.rollout.strategy,
                value: parseRolloutValue(flag.rollout.strategy, flag.rolloutText),
              },
            },
          },
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (response.ok) {
        toast.success(`Feature flag "${flag.key}" saved`);
      } else {
        toast.error(`Failed to save flag "${flag.key}"`, {
          description: payload.error || "Unknown error",
        });
      }
    });
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Platform Controls"
        description="These values live in Firestore and are the operational source of truth for the admin system and student-app feature gating."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label="Change reason for audit log"
              className="min-w-[260px]"
              disabled={!canWrite || isPending}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Change reason for audit log"
              value={reason}
            />
            <Button
              disabled={!canWrite || isPending || reason.trim().length < 3}
              onClick={saveSettings}
              type="button"
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save settings
            </Button>
          </div>
        }
      >
        <Tabs defaultValue="announcements" className="space-y-6">
          <TabsList className="flex w-full flex-wrap justify-start">
            <TabsTrigger value="announcements">Announcements</TabsTrigger>
            <TabsTrigger value="ai">AI & credits</TabsTrigger>
            <TabsTrigger value="commercial">Commercial</TabsTrigger>
            <TabsTrigger value="abuse">Abuse & support</TabsTrigger>
          </TabsList>

          <TabsContent value="announcements" className="space-y-4">
            <ToggleRow
              checked={draft.maintenanceMode}
              disabled={!canWrite}
              label="Maintenance mode"
              onChange={(value) =>
                setDraft((current) => ({ ...current, maintenanceMode: value }))
              }
            />
            <ToggleRow
              checked={draft.announcementBanner.enabled}
              disabled={!canWrite}
              label="Announcement banner enabled"
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  announcementBanner: {
                    ...current.announcementBanner,
                    enabled: value,
                  },
                }))
              }
            />
            <div className="space-y-1.5">
              <Label htmlFor="banner-text">Banner text</Label>
              <Textarea
                disabled={!canWrite}
                id="banner-text"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    announcementBanner: {
                      ...current.announcementBanner,
                      text: event.target.value,
                    },
                  }))
                }
                value={draft.announcementBanner.text}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Banner tone</Label>
              <Select
                disabled={!canWrite}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    announcementBanner: {
                      ...current.announcementBanner,
                      tone: value as PlatformSettings["announcementBanner"]["tone"],
                    },
                  }))
                }
                value={draft.announcementBanner.tone}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">info</SelectItem>
                  <SelectItem value="warning">warning</SelectItem>
                  <SelectItem value="success">success</SelectItem>
                  <SelectItem value="danger">danger</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="ai" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>AI provider</Label>
                <Select
                  disabled={!canWrite}
                  onValueChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      ai: {
                        ...current.ai,
                        provider: value as PlatformSettings["ai"]["provider"],
                      },
                    }))
                  }
                  value={draft.ai.provider}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anthropic">anthropic</SelectItem>
                    <SelectItem value="google">google</SelectItem>
                    <SelectItem value="hybrid">hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <TextField
                id="chat-model"
                label="Chat model"
                disabled={!canWrite}
                value={draft.ai.chatModel}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    ai: { ...current.ai, chatModel: value },
                  }))
                }
              />
              <TextField
                id="explain-model"
                label="Explain model"
                disabled={!canWrite}
                value={draft.ai.explainModel}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    ai: { ...current.ai, explainModel: value },
                  }))
                }
              />
              <NumberField
                id="hard-token-reserve"
                label="Hard daily token reserve"
                disabled={!canWrite}
                value={draft.ai.hardDailyTokenReserve}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    ai: { ...current.ai, hardDailyTokenReserve: value },
                  }))
                }
              />
              <NumberField
                id="learner-monthly"
                label="Learner monthly tokens"
                disabled={!canWrite}
                value={draft.credits.learnerMonthlyTokens}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    credits: { ...current.credits, learnerMonthlyTokens: value },
                  }))
                }
              />
              <NumberField
                id="pro-monthly"
                label="Pro monthly tokens"
                disabled={!canWrite}
                value={draft.credits.proMonthlyTokens}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    credits: { ...current.credits, proMonthlyTokens: value },
                  }))
                }
              />
              <NumberField
                id="hacker-monthly"
                label="Hacker monthly tokens"
                disabled={!canWrite}
                value={draft.credits.hackerMonthlyTokens}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    credits: { ...current.credits, hackerMonthlyTokens: value },
                  }))
                }
              />
              <NumberField
                id="pro-daily"
                label="Pro daily messages"
                disabled={!canWrite}
                value={draft.credits.proDailyMessages}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    credits: { ...current.credits, proDailyMessages: value },
                  }))
                }
              />
              <NumberField
                id="hacker-daily"
                label="Hacker daily messages"
                disabled={!canWrite}
                value={draft.credits.hackerDailyMessages}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    credits: { ...current.credits, hackerDailyMessages: value },
                  }))
                }
              />
            </div>
          </TabsContent>

          <TabsContent value="commercial" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <ToggleRow
                checked={draft.trials.enabled}
                disabled={!canWrite}
                label="Free trial enabled"
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    trials: { ...current.trials, enabled: value },
                  }))
                }
              />
              <NumberField
                id="trial-days"
                label="Free trial days"
                disabled={!canWrite}
                value={draft.trials.freeTrialDays}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    trials: { ...current.trials, freeTrialDays: value },
                  }))
                }
              />
              <ToggleRow
                checked={draft.pricing.showAnnualPromo}
                disabled={!canWrite}
                label="Show annual promo"
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    pricing: { ...current.pricing, showAnnualPromo: value },
                  }))
                }
              />
              <TextField
                id="default-checkout"
                label="Default checkout plan"
                disabled={!canWrite}
                value={draft.pricing.defaultCheckoutPlan}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    pricing: { ...current.pricing, defaultCheckoutPlan: value },
                  }))
                }
              />
              <ToggleRow
                checked={draft.release.waitlistMode}
                disabled={!canWrite}
                label="Waitlist mode"
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    release: { ...current.release, waitlistMode: value },
                  }))
                }
              />
              <div className="space-y-1.5">
                <Label>Beta access mode</Label>
                <Select
                  disabled={!canWrite}
                  onValueChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      release: {
                        ...current.release,
                        betaAccessMode: value as PlatformSettings["release"]["betaAccessMode"],
                      },
                    }))
                  }
                  value={draft.release.betaAccessMode}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">open</SelectItem>
                    <SelectItem value="allowlist">allowlist</SelectItem>
                    <SelectItem value="disabled">disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <ToggleRow
                checked={draft.release.studentAppReadOnly}
                disabled={!canWrite}
                label="Student app read-only mode"
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    release: { ...current.release, studentAppReadOnly: value },
                  }))
                }
              />
            </div>
          </TabsContent>

          <TabsContent value="abuse" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <NumberField
                id="rpm"
                label="Requests per minute hard cap"
                disabled={!canWrite}
                value={draft.abuse.hardRequestsPerMinute}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    abuse: { ...current.abuse, hardRequestsPerMinute: value },
                  }))
                }
              />
              <NumberField
                id="device-threshold"
                label="Shared-device threshold"
                disabled={!canWrite}
                value={draft.abuse.sharedAccountDeviceThreshold}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    abuse: { ...current.abuse, sharedAccountDeviceThreshold: value },
                  }))
                }
              />
              <NumberField
                id="coupon-threshold"
                label="Coupon abuse threshold"
                disabled={!canWrite}
                value={draft.abuse.couponAbuseThreshold}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    abuse: { ...current.abuse, couponAbuseThreshold: value },
                  }))
                }
              />
              <ToggleRow
                checked={draft.referrals.enabled}
                disabled={!canWrite}
                label="Referral program enabled"
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    referrals: { ...current.referrals, enabled: value },
                  }))
                }
              />
              <ToggleRow
                checked={draft.referrals.promoEnabled}
                disabled={!canWrite}
                label="Promo code entry enabled"
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    referrals: { ...current.referrals, promoEnabled: value },
                  }))
                }
              />
              <NumberField
                id="max-redemptions"
                label="Max promo redemptions per user"
                disabled={!canWrite}
                value={draft.referrals.maxRedemptionsPerUser}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    referrals: {
                      ...current.referrals,
                      maxRedemptionsPerUser: value,
                    },
                  }))
                }
              />
              <div className="md:col-span-2">
                <TextField
                  id="support-email"
                  label="Support email"
                  disabled={!canWrite}
                  value={draft.support.supportEmail}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      support: { ...current.support, supportEmail: value },
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="content-notice">Content notice</Label>
                <Textarea
                  disabled={!canWrite}
                  id="content-notice"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      legal: { ...current.legal, contentNotice: event.target.value },
                    }))
                  }
                  value={draft.legal.contentNotice}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SectionCard>

      <SectionCard
        title="Feature flags"
        description="Flags support global rollout, UID cohorts, role allowlists, or percentage-based experiments."
        actions={
          canWrite ? (
            <Button
              onClick={() =>
                setFlags((current) => [
                  ...current,
                  {
                    key: "",
                    enabled: false,
                    description: "",
                    rollout: { strategy: "none", value: null },
                    updatedAt: 0,
                    rolloutText: "",
                  },
                ])
              }
              type="button"
              variant="outline"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add flag
            </Button>
          ) : null
        }
      >
        <div className="space-y-3">
          {flags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No feature flags configured.</p>
          ) : (
            flags.map((flag, index) => (
              <Card key={`${flag.key || "new"}-${index}`}>
                <CardContent className="p-4">
                  <div className="grid gap-3 lg:grid-cols-[1.2fr_1.4fr_1fr_1fr_auto]">
                    <TextField
                      id={`flag-key-${index}`}
                      label="Key"
                      disabled={!canWrite}
                      value={flag.key}
                      onChange={(value) => updateFlag(index, { key: value })}
                    />
                    <TextField
                      id={`flag-desc-${index}`}
                      label="Description"
                      disabled={!canWrite}
                      value={flag.description}
                      onChange={(value) => updateFlag(index, { description: value })}
                    />
                    <div className="space-y-1.5">
                      <Label>Strategy</Label>
                      <Select
                        disabled={!canWrite}
                        onValueChange={(value) =>
                          updateFlag(index, {
                            rollout: {
                              ...flag.rollout,
                              strategy: value as EditableFlag["rollout"]["strategy"],
                            },
                          })
                        }
                        value={flag.rollout.strategy}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">all</SelectItem>
                          <SelectItem value="none">none</SelectItem>
                          <SelectItem value="roles">roles</SelectItem>
                          <SelectItem value="cohort">cohort</SelectItem>
                          <SelectItem value="percentage">percentage</SelectItem>
                          <SelectItem value="uids">uids</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <TextField
                      id={`flag-value-${index}`}
                      label="Strategy value"
                      disabled={!canWrite}
                      value={flag.rolloutText}
                      onChange={(value) => updateFlag(index, { rolloutText: value })}
                    />
                    <div className="flex items-end gap-3">
                      <div className="flex flex-col items-center gap-1.5">
                        <Label className="text-xs">Enabled</Label>
                        <Switch
                          checked={flag.enabled}
                          disabled={!canWrite}
                          onCheckedChange={(value) => updateFlag(index, { enabled: value })}
                        />
                      </div>
                      <Button
                        disabled={
                          !canWrite ||
                          isPending ||
                          reason.trim().length < 3 ||
                          !flag.key
                        }
                        onClick={() => saveFlag(flag)}
                        size="sm"
                        type="button"
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  );
}
