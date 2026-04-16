"use client";

import { useState, useTransition } from "react";
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
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateFlag(index: number, next: Partial<EditableFlag>) {
    setFlags((current) =>
      current.map((flag, flagIndex) =>
        flagIndex === index ? { ...flag, ...next } : flag
      )
    );
  }

  function saveSettings() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setMessage(response.ok ? "Platform settings saved." : payload.error || "Settings update failed.");
    });
  }

  function saveFlag(flag: EditableFlag) {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setMessage(response.ok ? `Feature flag "${flag.key}" saved.` : payload.error || "Feature flag update failed.");
    });
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Platform Controls"
        description="These values live in Firestore and should be treated as the operational source of truth for the admin system and future student-app feature gating."
        actions={
          <div className="flex flex-wrap gap-3">
            <input
              className="admin-input min-w-[260px]"
              disabled={!canWrite || isPending}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Change reason for audit log"
              value={reason}
            />
            <button className="admin-button" disabled={!canWrite || isPending || reason.trim().length < 3} onClick={saveSettings} type="button">
              Save settings
            </button>
          </div>
        }
      >
        {message ? <div className="mb-5 rounded-2xl bg-accentSoft px-4 py-3 text-sm text-accent">{message}</div> : null}
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-line p-5">
            <h3 className="font-display text-xl text-ink">Announcements and maintenance</h3>
            <div className="mt-4 space-y-4">
              <label className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm text-ink">
                <input
                  checked={draft.maintenanceMode}
                  disabled={!canWrite}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, maintenanceMode: event.target.checked }))
                  }
                  type="checkbox"
                />
                <span>Maintenance mode</span>
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm text-ink">
                <input
                  checked={draft.announcementBanner.enabled}
                  disabled={!canWrite}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      announcementBanner: {
                        ...current.announcementBanner,
                        enabled: event.target.checked,
                      },
                    }))
                  }
                  type="checkbox"
                />
                <span>Announcement banner enabled</span>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Banner text</span>
                <textarea
                  className="admin-textarea"
                  disabled={!canWrite}
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
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Banner tone</span>
                <select
                  className="admin-select"
                  disabled={!canWrite}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      announcementBanner: {
                        ...current.announcementBanner,
                        tone: event.target.value as PlatformSettings["announcementBanner"]["tone"],
                      },
                    }))
                  }
                  value={draft.announcementBanner.tone}
                >
                  <option value="info">info</option>
                  <option value="warning">warning</option>
                  <option value="success">success</option>
                  <option value="danger">danger</option>
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-line p-5">
            <h3 className="font-display text-xl text-ink">AI and quota defaults</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Provider</span>
                <select
                  className="admin-select"
                  disabled={!canWrite}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      ai: {
                        ...current.ai,
                        provider: event.target.value as PlatformSettings["ai"]["provider"],
                      },
                    }))
                  }
                  value={draft.ai.provider}
                >
                  <option value="anthropic">anthropic</option>
                  <option value="google">google</option>
                  <option value="hybrid">hybrid</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Chat model</span>
                <input
                  className="admin-input"
                  disabled={!canWrite}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      ai: {
                        ...current.ai,
                        chatModel: event.target.value,
                      },
                    }))
                  }
                  value={draft.ai.chatModel}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Explain model</span>
                <input
                  className="admin-input"
                  disabled={!canWrite}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      ai: {
                        ...current.ai,
                        explainModel: event.target.value,
                      },
                    }))
                  }
                  value={draft.ai.explainModel}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Hard daily token reserve</span>
                <input
                  className="admin-input"
                  disabled={!canWrite}
                  inputMode="numeric"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      ai: {
                        ...current.ai,
                        hardDailyTokenReserve: Number(event.target.value || 0),
                      },
                    }))
                  }
                  value={draft.ai.hardDailyTokenReserve}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Learner monthly tokens</span>
                <input
                  className="admin-input"
                  disabled={!canWrite}
                  inputMode="numeric"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      credits: {
                        ...current.credits,
                        learnerMonthlyTokens: Number(event.target.value || 0),
                      },
                    }))
                  }
                  value={draft.credits.learnerMonthlyTokens}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Pro monthly tokens</span>
                <input
                  className="admin-input"
                  disabled={!canWrite}
                  inputMode="numeric"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      credits: {
                        ...current.credits,
                        proMonthlyTokens: Number(event.target.value || 0),
                      },
                    }))
                  }
                  value={draft.credits.proMonthlyTokens}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Hacker monthly tokens</span>
                <input
                  className="admin-input"
                  disabled={!canWrite}
                  inputMode="numeric"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      credits: {
                        ...current.credits,
                        hackerMonthlyTokens: Number(event.target.value || 0),
                      },
                    }))
                  }
                  value={draft.credits.hackerMonthlyTokens}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Pro daily messages</span>
                <input
                  className="admin-input"
                  disabled={!canWrite}
                  inputMode="numeric"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      credits: {
                        ...current.credits,
                        proDailyMessages: Number(event.target.value || 0),
                      },
                    }))
                  }
                  value={draft.credits.proDailyMessages}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Hacker daily messages</span>
                <input
                  className="admin-input"
                  disabled={!canWrite}
                  inputMode="numeric"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      credits: {
                        ...current.credits,
                        hackerDailyMessages: Number(event.target.value || 0),
                      },
                    }))
                  }
                  value={draft.credits.hackerDailyMessages}
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-line p-5">
            <h3 className="font-display text-xl text-ink">Commercial and release policy</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm text-ink">
                <input
                  checked={draft.trials.enabled}
                  disabled={!canWrite}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      trials: {
                        ...current.trials,
                        enabled: event.target.checked,
                      },
                    }))
                  }
                  type="checkbox"
                />
                <span>Free trial enabled</span>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Free trial days</span>
                <input
                  className="admin-input"
                  disabled={!canWrite}
                  inputMode="numeric"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      trials: {
                        ...current.trials,
                        freeTrialDays: Number(event.target.value || 0),
                      },
                    }))
                  }
                  value={draft.trials.freeTrialDays}
                />
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm text-ink">
                <input
                  checked={draft.pricing.showAnnualPromo}
                  disabled={!canWrite}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      pricing: {
                        ...current.pricing,
                        showAnnualPromo: event.target.checked,
                      },
                    }))
                  }
                  type="checkbox"
                />
                <span>Show annual promo</span>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Default checkout plan</span>
                <input
                  className="admin-input"
                  disabled={!canWrite}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      pricing: {
                        ...current.pricing,
                        defaultCheckoutPlan: event.target.value,
                      },
                    }))
                  }
                  value={draft.pricing.defaultCheckoutPlan}
                />
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm text-ink">
                <input
                  checked={draft.release.waitlistMode}
                  disabled={!canWrite}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      release: {
                        ...current.release,
                        waitlistMode: event.target.checked,
                      },
                    }))
                  }
                  type="checkbox"
                />
                <span>Waitlist mode</span>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Beta access mode</span>
                <select
                  className="admin-select"
                  disabled={!canWrite}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      release: {
                        ...current.release,
                        betaAccessMode: event.target.value as PlatformSettings["release"]["betaAccessMode"],
                      },
                    }))
                  }
                  value={draft.release.betaAccessMode}
                >
                  <option value="open">open</option>
                  <option value="allowlist">allowlist</option>
                  <option value="disabled">disabled</option>
                </select>
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm text-ink">
                <input
                  checked={draft.release.studentAppReadOnly}
                  disabled={!canWrite}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      release: {
                        ...current.release,
                        studentAppReadOnly: event.target.checked,
                      },
                    }))
                  }
                  type="checkbox"
                />
                <span>Student app read-only mode</span>
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-line p-5">
            <h3 className="font-display text-xl text-ink">Abuse and support policy</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Requests per minute hard cap</span>
                <input
                  className="admin-input"
                  disabled={!canWrite}
                  inputMode="numeric"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      abuse: {
                        ...current.abuse,
                        hardRequestsPerMinute: Number(event.target.value || 0),
                      },
                    }))
                  }
                  value={draft.abuse.hardRequestsPerMinute}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Shared-device threshold</span>
                <input
                  className="admin-input"
                  disabled={!canWrite}
                  inputMode="numeric"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      abuse: {
                        ...current.abuse,
                        sharedAccountDeviceThreshold: Number(event.target.value || 0),
                      },
                    }))
                  }
                  value={draft.abuse.sharedAccountDeviceThreshold}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Coupon abuse threshold</span>
                <input
                  className="admin-input"
                  disabled={!canWrite}
                  inputMode="numeric"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      abuse: {
                        ...current.abuse,
                        couponAbuseThreshold: Number(event.target.value || 0),
                      },
                    }))
                  }
                  value={draft.abuse.couponAbuseThreshold}
                />
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm text-ink">
                <input
                  checked={draft.referrals.enabled}
                  disabled={!canWrite}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      referrals: {
                        ...current.referrals,
                        enabled: event.target.checked,
                      },
                    }))
                  }
                  type="checkbox"
                />
                <span>Referral program enabled</span>
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm text-ink">
                <input
                  checked={draft.referrals.promoEnabled}
                  disabled={!canWrite}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      referrals: {
                        ...current.referrals,
                        promoEnabled: event.target.checked,
                      },
                    }))
                  }
                  type="checkbox"
                />
                <span>Promo code entry enabled</span>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Max promo redemptions per user</span>
                <input
                  className="admin-input"
                  disabled={!canWrite}
                  inputMode="numeric"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      referrals: {
                        ...current.referrals,
                        maxRedemptionsPerUser: Number(event.target.value || 0),
                      },
                    }))
                  }
                  value={draft.referrals.maxRedemptionsPerUser}
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-ink">Support email</span>
                <input
                  className="admin-input"
                  disabled={!canWrite}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      support: {
                        ...current.support,
                        supportEmail: event.target.value,
                      },
                    }))
                  }
                  value={draft.support.supportEmail}
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-ink">Content notice</span>
                <textarea
                  className="admin-textarea"
                  disabled={!canWrite}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      legal: {
                        ...current.legal,
                        contentNotice: event.target.value,
                      },
                    }))
                  }
                  value={draft.legal.contentNotice}
                />
              </label>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Feature Flags"
        description="Flags support global rollout, UID cohorts, role allowlists, or percentage-based experiments."
        actions={
          canWrite ? (
            <button
              className="admin-button-secondary"
              onClick={() =>
                setFlags((current) => [
                  ...current,
                  {
                    key: "",
                    enabled: false,
                    description: "",
                    rollout: {
                      strategy: "none",
                      value: null,
                    },
                    updatedAt: 0,
                    rolloutText: "",
                  },
                ])
              }
              type="button"
            >
              Add flag
            </button>
          ) : null
        }
      >
        <div className="space-y-4">
          {flags.map((flag, index) => (
            <div key={`${flag.key || "new"}-${index}`} className="rounded-2xl border border-line p-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Key</span>
                  <input
                    className="admin-input"
                    disabled={!canWrite}
                    onChange={(event) => updateFlag(index, { key: event.target.value })}
                    placeholder="labs.smart-review"
                    value={flag.key}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Description</span>
                  <input
                    className="admin-input"
                    disabled={!canWrite}
                    onChange={(event) => updateFlag(index, { description: event.target.value })}
                    value={flag.description}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Strategy</span>
                  <select
                    className="admin-select"
                    disabled={!canWrite}
                    onChange={(event) =>
                      updateFlag(index, {
                        rollout: {
                          ...flag.rollout,
                          strategy: event.target.value as EditableFlag["rollout"]["strategy"],
                        },
                      })
                    }
                    value={flag.rollout.strategy}
                  >
                    <option value="all">all</option>
                    <option value="none">none</option>
                    <option value="roles">roles</option>
                    <option value="cohort">cohort</option>
                    <option value="percentage">percentage</option>
                    <option value="uids">uids</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Strategy value</span>
                  <input
                    className="admin-input"
                    disabled={!canWrite}
                    onChange={(event) => updateFlag(index, { rolloutText: event.target.value })}
                    placeholder="support_admin, early-april"
                    value={flag.rolloutText}
                  />
                </label>
                <div className="flex items-end gap-3">
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      checked={flag.enabled}
                      disabled={!canWrite}
                      onChange={(event) => updateFlag(index, { enabled: event.target.checked })}
                      type="checkbox"
                    />
                    Enabled
                  </label>
                  <button
                    className="admin-button"
                    disabled={!canWrite || isPending || reason.trim().length < 3 || !flag.key}
                    onClick={() => saveFlag(flag)}
                    type="button"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

