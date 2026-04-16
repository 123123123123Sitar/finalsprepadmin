import { PageHeader } from "@/components/admin/PageHeader";
import { SettingsEditor } from "@/components/admin/SettingsEditor";
import { requireAdminContext } from "@/lib/admin/auth";
import { hasPermission } from "@/lib/admin/permissions";
import { getFeatureFlags, getPlatformSettings } from "@/lib/admin/queries/settings";

export default async function AdminSettingsPage() {
  const context = await requireAdminContext();
  const [settings, featureFlags] = await Promise.all([
    getPlatformSettings(),
    getFeatureFlags(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Platform settings and release controls"
        description="Global defaults for maintenance, AI routing, quotas, promotions, abuse guardrails, and feature rollouts. Only super admins should write here."
      />
      <SettingsEditor
        canWrite={hasPermission(context.roles, "settings.write")}
        featureFlags={featureFlags}
        settings={settings}
      />
    </div>
  );
}

