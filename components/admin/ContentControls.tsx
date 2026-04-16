"use client";

import { useState, useTransition } from "react";
import { SectionCard } from "@/components/admin/SectionCard";
import type { ContentHealthRecord, PlatformSettings } from "@/lib/admin/types";

function parseTextList(input: string) {
  return input
    .split(/[\n,]/g)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function ContentControls({
  records,
  contentSettings,
  canWrite,
  previewBaseUrl,
}: {
  records: ContentHealthRecord[];
  contentSettings: PlatformSettings["content"];
  canWrite: boolean;
  previewBaseUrl?: string;
}) {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [visibility, setVisibility] = useState<Record<string, boolean>>({
    ...contentSettings.courseVisibility,
  });
  const [featured, setFeatured] = useState<string[]>(contentSettings.featuredCourseSlugs || []);
  const [draftCourses, setDraftCourses] = useState<string[]>(contentSettings.draftCourseSlugs || []);
  const [homepageOrder, setHomepageOrder] = useState(
    (contentSettings.homepageCourseOrder || []).join(", ")
  );
  const [hiddenTopicIds, setHiddenTopicIds] = useState(
    (contentSettings.hiddenTopicIds || []).join(", ")
  );

  function toggleSetValue(collection: string[], key: string) {
    return collection.includes(key)
      ? collection.filter((value) => value !== key)
      : [...collection, key];
  }

  function saveCourseControls() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason,
          refresh: false,
          contentSettings: {
            courseVisibility: visibility,
            featuredCourseSlugs: featured,
            draftCourseSlugs: draftCourses,
            homepageCourseOrder: parseTextList(homepageOrder),
            hiddenTopicIds: parseTextList(hiddenTopicIds),
          },
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setMessage(response.ok ? "Content controls saved." : payload.error || "Content settings update failed.");
    });
  }

  function refreshHealthSnapshot() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: reason || "Manual content health refresh",
          refresh: true,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setMessage(response.ok ? "Content health snapshot refreshed." : payload.error || "Content refresh failed.");
      if (response.ok) {
        window.location.reload();
      }
    });
  }

  return (
    <SectionCard
      title="Publishing and Visibility Controls"
      description="These settings are stored centrally so the student-facing app can consume the same source of truth for course visibility, featured shelves, and draft-state gating."
      actions={
        <div className="flex flex-wrap gap-3">
          <input
            className="admin-input min-w-[260px]"
            disabled={!canWrite || isPending}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Change reason for audit log"
            value={reason}
          />
          <button className="admin-button-secondary" disabled={!canWrite || isPending} onClick={refreshHealthSnapshot} type="button">
            Refresh content health
          </button>
          <button className="admin-button" disabled={!canWrite || isPending || reason.trim().length < 3} onClick={saveCourseControls} type="button">
            Save content controls
          </button>
        </div>
      }
    >
      {message ? <div className="mb-5 rounded-2xl bg-accentSoft px-4 py-3 text-sm text-accent">{message}</div> : null}
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">Homepage course order</span>
            <textarea
              className="admin-textarea"
              disabled={!canWrite}
              onChange={(event) => setHomepageOrder(event.target.value)}
              placeholder="ap-biology, ap-calc-ab, ap-world-history"
              value={homepageOrder}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">Hidden topic IDs</span>
            <textarea
              className="admin-textarea font-mono text-xs"
              disabled={!canWrite}
              onChange={(event) => setHiddenTopicIds(event.target.value)}
              placeholder="2.3, 4.6, 8.1"
              value={hiddenTopicIds}
            />
          </label>
        </div>

        <div className="grid gap-4">
          {records.map((record) => {
            const visible = visibility[record.id] ?? true;
            const isFeatured = featured.includes(record.id);
            const isDraft = draftCourses.includes(record.id);
            const previewUrl = previewBaseUrl
              ? `${previewBaseUrl.replace(/\/$/, "")}/study?course=${record.id}`
              : null;

            return (
              <div key={record.id} className="rounded-2xl border border-line p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-2xl text-ink">{record.title}</h3>
                      <span className="badge bg-slate-100 text-slate-700">{record.category}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-body">
                      {record.totalUnits} units, {record.totalTopics} topics, {record.missingCedLessons.length} missing CED topics, {record.missingPracticeUnits.length} practice gaps.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {previewUrl ? (
                      <a className="admin-button-secondary" href={previewUrl} rel="noreferrer" target="_blank">
                        Preview in student app
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <label className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm text-ink">
                    <input
                      checked={visible}
                      disabled={!canWrite}
                      onChange={(event) =>
                        setVisibility((current) => ({
                          ...current,
                          [record.id]: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    <span>Visible to students</span>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm text-ink">
                    <input
                      checked={isFeatured}
                      disabled={!canWrite}
                      onChange={() => setFeatured((current) => toggleSetValue(current, record.id))}
                      type="checkbox"
                    />
                    <span>Featured on homepage</span>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm text-ink">
                    <input
                      checked={isDraft}
                      disabled={!canWrite}
                      onChange={() => setDraftCourses((current) => toggleSetValue(current, record.id))}
                      type="checkbox"
                    />
                    <span>Draft / internal only</span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}
