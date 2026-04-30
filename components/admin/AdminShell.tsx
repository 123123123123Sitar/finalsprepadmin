"use client";

import { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { AdminSidebar, AdminSidebarContent } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";

export function AdminShell({
  email,
  roles,
  permissions,
  children,
}: {
  email: string | null;
  roles: string[];
  permissions: string[];
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AdminSidebar permissions={permissions} />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-72 border-r-0 bg-slate-950 p-0 text-slate-100"
        >
          <AdminSidebarContent
            permissions={permissions}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar
          email={email}
          roles={roles}
          onOpenSidebar={() => setMobileOpen(true)}
        />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
