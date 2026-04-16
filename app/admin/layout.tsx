import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { requireAdminContext } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireAdminContext();

  return (
    <div className="page-shell lg:flex">
      <AdminSidebar permissions={context.permissions} />
      <div className="min-w-0 flex-1">
        <AdminTopbar email={context.email} roles={context.roles} />
        <main className="mx-auto max-w-7xl px-5 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
