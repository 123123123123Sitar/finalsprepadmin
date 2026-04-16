import { AdminUserMenu } from "@/components/admin/AdminUserMenu";
import { Badge } from "@/components/admin/Badge";

export function AdminTopbar({
  email,
  roles,
}: {
  email: string | null;
  roles: string[];
}) {
  const appUrl = process.env.NEXT_PUBLIC_FINALSPREP_APP_URL;

  return (
    <div className="flex flex-col gap-4 border-b border-line bg-white/80 px-6 py-4 backdrop-blur md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="accent">Live console</Badge>
        <Badge tone="neutral">Shared Firebase project</Badge>
        {appUrl ? (
          <a className="text-sm font-medium text-accent hover:underline" href={appUrl} rel="noreferrer" target="_blank">
            Open student app
          </a>
        ) : null}
      </div>
      <AdminUserMenu email={email} roles={roles} />
    </div>
  );
}

