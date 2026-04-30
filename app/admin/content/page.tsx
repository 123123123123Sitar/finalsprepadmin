import { Badge } from "@/components/admin/Badge";
import { ContentControls } from "@/components/admin/ContentControls";
import { PageHeader } from "@/components/admin/PageHeader";
import { SectionCard } from "@/components/admin/SectionCard";
import { StatCard } from "@/components/admin/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { requireAdminContext } from "@/lib/admin/auth";
import { hasPermission } from "@/lib/admin/permissions";
import { getContentHealth } from "@/lib/admin/queries/content";
import { getPlatformSettings } from "@/lib/admin/queries/settings";
import { formatNumber, formatPercent } from "@/lib/admin/utils";

export default async function AdminContentPage() {
  const context = await requireAdminContext();
  const [records, settings] = await Promise.all([
    getContentHealth(),
    getPlatformSettings(),
  ]);

  const totalCourses = records.length;
  const totalUnits = records.reduce((sum, record) => sum + record.totalUnits, 0);
  const curriculumUnitsPresent = records.reduce(
    (sum, record) => sum + record.curriculumUnitsPresent,
    0
  );
  const totalTopics = records.reduce((sum, record) => sum + record.totalTopics, 0);
  const cedLessonsPresent = records.reduce(
    (sum, record) => sum + record.cedLessonsPresent,
    0
  );
  const coursesWithGaps = records.filter(
    (record) => record.staleSignals.length > 0
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content"
        title="Curriculum operations"
        description="Inspect course completeness, track CED and practice gaps, and control which courses are visible or featured in the student app."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Tracked courses"
          tone="accent"
          value={formatNumber(totalCourses)}
          hint={`${formatNumber(coursesWithGaps)} with stale or missing content signals`}
        />
        <StatCard
          label="Curriculum coverage"
          tone="success"
          value={formatPercent(
            totalUnits === 0 ? 0 : (curriculumUnitsPresent / totalUnits) * 100
          )}
          hint={`${formatNumber(curriculumUnitsPresent)} of ${formatNumber(totalUnits)} unit guides present`}
        />
        <StatCard
          label="CED lesson coverage"
          tone="success"
          value={formatPercent(
            totalTopics === 0 ? 0 : (cedLessonsPresent / totalTopics) * 100
          )}
          hint={`${formatNumber(cedLessonsPresent)} of ${formatNumber(totalTopics)} topic lessons detected`}
        />
        <StatCard
          label="Hidden topics"
          tone="warning"
          value={formatNumber(settings.content.hiddenTopicIds.length)}
          hint={`${formatNumber(settings.content.draftCourseSlugs.length)} draft courses configured`}
        />
      </section>

      <ContentControls
        canWrite={hasPermission(context.roles, "content.write")}
        contentSettings={settings.content}
        previewBaseUrl={process.env.NEXT_PUBLIC_FINALSPREP_APP_URL}
        records={records}
      />

      <SectionCard
        title="Content health dashboard"
        description="Detailed content completeness by course."
      >
        <div className="space-y-4">
          {records.map((record) => {
            const curriculumPct =
              record.totalUnits === 0
                ? 0
                : (record.curriculumUnitsPresent / record.totalUnits) * 100;
            const cedPct =
              record.totalTopics === 0
                ? 0
                : (record.cedLessonsPresent / record.totalTopics) * 100;
            return (
              <Card key={record.id}>
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-xl font-semibold text-foreground">
                          {record.title}
                        </h3>
                        <Badge tone="neutral">{record.category}</Badge>
                        {record.staleSignals.map((signal) => (
                          <Badge key={signal} tone="warning">
                            {signal}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {record.totalUnits} units · {record.totalTopics} topics
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">
                          Curriculum units
                        </span>
                        <span className="text-muted-foreground">
                          {formatNumber(record.curriculumUnitsPresent)} /{" "}
                          {formatNumber(record.totalUnits)} ·{" "}
                          {formatPercent(curriculumPct)}
                        </span>
                      </div>
                      <Progress value={curriculumPct} className="h-2" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">
                          CED lessons
                        </span>
                        <span className="text-muted-foreground">
                          {formatNumber(record.cedLessonsPresent)} /{" "}
                          {formatNumber(record.totalTopics)} ·{" "}
                          {formatPercent(cedPct)}
                        </span>
                      </div>
                      <Progress value={cedPct} className="h-2" />
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
                      <p>
                        Missing curriculum units:{" "}
                        <span className="font-medium text-foreground">
                          {record.missingCurriculumUnits.join(", ") || "none"}
                        </span>
                      </p>
                      <p className="mt-2">
                        Missing practice units:{" "}
                        <span className="font-medium text-foreground">
                          {record.missingPracticeUnits.join(", ") || "none"}
                        </span>
                      </p>
                      <p className="mt-2">
                        Missing interactive units:{" "}
                        <span className="font-medium text-foreground">
                          {record.missingInteractiveUnits.join(", ") || "none"}
                        </span>
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
                      <p>
                        Missing CED lessons:{" "}
                        <span className="font-medium text-foreground">
                          {record.missingCedLessons.join(", ") || "none"}
                        </span>
                      </p>
                      <p className="mt-2">
                        Draft units:{" "}
                        <span className="font-medium text-foreground">
                          {record.draftUnits.join(", ") || "none"}
                        </span>
                      </p>
                      <p className="mt-2">
                        Unpublished topics:{" "}
                        <span className="font-medium text-foreground">
                          {record.unpublishedTopics.join(", ") || "none"}
                        </span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
