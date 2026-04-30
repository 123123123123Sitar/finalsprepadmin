import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminContext } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireAdminContext();

  return (
    <AdminShell
      email={context.email}
      roles={context.roles}
      permissions={context.permissions}
    >
      {children}
    </AdminShell>
  );
}
