"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/admin/SectionCard";
import { Badge } from "@/components/admin/Badge";
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
  const [isPending, startTransition] = useTransition();
  const [visibility, setVisibility] = useState<Record<string, boolean>>({
    ...contentSettings.courseVisibility,
  });
  const [featured, setFeatured] = useState<string[]>(
    contentSettings.featuredCourseSlugs || []
  );
  const [draftCourses, setDraftCourses] = useState<string[]>(
    contentSettings.draftCourseSlugs || []
  );
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
    startTransition(async () => {
      const response = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (response.ok) {
        toast.success("Content controls saved");
      } else {
        toast.error("Failed to save content controls", {
          description: payload.error || "Unknown error",
        });
      }
    });
  }

  function refreshHealthSnapshot() {
    startTransition(async () => {
      const response = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason || "Manual content health refresh",
          refresh: true,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (response.ok) {
        toast.success("Content health snapshot refreshed");
        window.location.reload();
      } else {
        toast.error("Failed to refresh content health", {
          description: payload.error || "Unknown error",
        });
      }
    });
  }

  return (
    <SectionCard
      title="Publishing and Visibility Controls"
      description="These settings are stored centrally so the student-facing app can consume the same source of truth for course visibility, featured shelves, and draft-state gating."
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
            disabled={!canWrite || isPending}
            onClick={refreshHealthSnapshot}
            type="button"
            variant="outline"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh health
          </Button>
          <Button
            disabled={!canWrite || isPending || reason.trim().length < 3}
            onClick={saveCourseControls}
            type="button"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save controls
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="homepage-order">Homepage course order</Label>
            <Textarea
              disabled={!canWrite}
              id="homepage-order"
              onChange={(event) => setHomepageOrder(event.target.value)}
              placeholder="ap-biology, ap-calc-ab, ap-world-history"
              value={homepageOrder}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hidden-topics">Hidden topic IDs</Label>
            <Textarea
              className="font-mono text-xs"
              disabled={!canWrite}
              id="hidden-topics"
              onChange={(event) => setHiddenTopicIds(event.target.value)}
              placeholder="2.3, 4.6, 8.1"
              value={hiddenTopicIds}
            />
          </div>
        </div>

        <div className="grid gap-3">
          {records.map((record) => {
            const visible = visibility[record.id] ?? true;
            const isFeatured = featured.includes(record.id);
            const isDraft = draftCourses.includes(record.id);
            const previewUrl = previewBaseUrl
              ? `${previewBaseUrl.replace(/\/$/, "")}/study?course=${record.id}`
              : null;

            return (
              <Card key={record.id}>
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base font-semibold text-foreground">
                          {record.title}
                        </h3>
                        <Badge tone="neutral">{record.category}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {record.totalUnits} units · {record.totalTopics} topics ·{" "}
                        {record.missingCedLessons.length} missing CED ·{" "}
                        {record.missingPracticeUnits.length} practice gaps
                      </p>
                    </div>
                    {previewUrl ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href={previewUrl} rel="noreferrer" target="_blank">
                          Preview
                          <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
                      <span className="text-foreground">Visible to students</span>
                      <Switch
                        checked={visible}
                        disabled={!canWrite}
                        onCheckedChange={(value) =>
                          setVisibility((current) => ({
                            ...current,
                            [record.id]: value,
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
                      <span className="text-foreground">Featured on homepage</span>
                      <Switch
                        checked={isFeatured}
                        disabled={!canWrite}
                        onCheckedChange={() =>
                          setFeatured((current) => toggleSetValue(current, record.id))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
                      <span className="text-foreground">Draft / internal only</span>
                      <Switch
                        checked={isDraft}
                        disabled={!canWrite}
                        onCheckedChange={() =>
                          setDraftCourses((current) =>
                            toggleSetValue(current, record.id)
                          )
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}
