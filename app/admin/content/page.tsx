import { Badge } from "@/components/admin/Badge";
import { ContentControls } from "@/components/admin/ContentControls";
import { PageHeader } from "@/components/admin/PageHeader";
import { SectionCard } from "@/components/admin/SectionCard";
import { StatCard } from "@/components/admin/StatCard";
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
  const curriculumUnitsPresent = records.reduce((sum, record) => sum + record.curriculumUnitsPresent, 0);
  const totalTopics = records.reduce((sum, record) => sum + record.totalTopics, 0);
  const cedLessonsPresent = records.reduce((sum, record) => sum + record.cedLessonsPresent, 0);
  const coursesWithGaps = records.filter((record) => record.staleSignals.length > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content"
        title="Curriculum operations"
        description="Inspect course completeness, track CED and practice gaps, and control which courses are visible or featured in the student app."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tracked courses" tone="accent" value={formatNumber(totalCourses)} hint={`${formatNumber(coursesWithGaps)} with stale or missing content signals`} />
        <StatCard label="Curriculum coverage" tone="success" value={formatPercent(totalUnits === 0 ? 0 : (curriculumUnitsPresent / totalUnits) * 100)} hint={`${formatNumber(curriculumUnitsPresent)} of ${formatNumber(totalUnits)} unit guides present`} />
        <StatCard label="CED lesson coverage" tone="success" value={formatPercent(totalTopics === 0 ? 0 : (cedLessonsPresent / totalTopics) * 100)} hint={`${formatNumber(cedLessonsPresent)} of ${formatNumber(totalTopics)} topic lessons detected`} />
        <StatCard label="Hidden topics" tone="warning" value={formatNumber(settings.content.hiddenTopicIds.length)} hint={`${formatNumber(settings.content.draftCourseSlugs.length)} draft courses configured`} />
      </section>

      <ContentControls
        canWrite={hasPermission(context.roles, "content.write")}
        contentSettings={settings.content}
        previewBaseUrl={process.env.NEXT_PUBLIC_FINALSPREP_APP_URL}
        records={records}
      />

      <SectionCard title="Content health dashboard" description="Detailed content completeness by course.">
        <div className="space-y-4">
          {records.map((record) => (
            <div key={record.id} className="rounded-2xl border border-line p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-2xl text-ink">{record.title}</h3>
                    <Badge tone="neutral">{record.category}</Badge>
                    {record.staleSignals.map((signal) => (
                      <Badge key={signal} tone="warning">
                        {signal}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-body">
                    {record.totalUnits} units, {record.totalTopics} topics
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-body">
                  <p>
                    Missing curriculum units:{" "}
                    <span className="font-medium text-ink">
                      {record.missingCurriculumUnits.join(", ") || "none"}
                    </span>
                  </p>
                  <p className="mt-2">
                    Missing practice units:{" "}
                    <span className="font-medium text-ink">
                      {record.missingPracticeUnits.join(", ") || "none"}
                    </span>
                  </p>
                  <p className="mt-2">
                    Missing interactive units:{" "}
                    <span className="font-medium text-ink">
                      {record.missingInteractiveUnits.join(", ") || "none"}
                    </span>
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-body">
                  <p>
                    Missing CED lessons:{" "}
                    <span className="font-medium text-ink">
                      {record.missingCedLessons.join(", ") || "none"}
                    </span>
                  </p>
                  <p className="mt-2">
                    Draft units: <span className="font-medium text-ink">{record.draftUnits.join(", ") || "none"}</span>
                  </p>
                  <p className="mt-2">
                    Unpublished topics:{" "}
                    <span className="font-medium text-ink">
                      {record.unpublishedTopics.join(", ") || "none"}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

