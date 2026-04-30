"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BookOpen,
  FileText,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type NavItem = {
  href: string;
  label: string;
  permission: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Overview", permission: "dashboard.read", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", permission: "users.read", icon: Users },
  { href: "/admin/usage", label: "Usage", permission: "usage.read", icon: Activity },
  { href: "/admin/content", label: "Content", permission: "content.read", icon: BookOpen },
  { href: "/admin/settings", label: "Settings", permission: "settings.read", icon: Settings },
  { href: "/admin/audit-logs", label: "Audit Logs", permission: "audit.read", icon: FileText },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebarContent({
  permissions,
  onNavigate,
}: {
  permissions: string[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => permissions.includes(item.permission));

  return (
    <div className="flex h-full flex-col gap-6 px-5 py-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-300">
          FinalsPrep
        </p>
        <h1 className="font-display text-2xl font-semibold leading-tight text-white">
          Admin Console
        </h1>
        <p className="text-sm leading-6 text-slate-300">
          Operator workspace for subscriptions, AI spend, course health, and
          abuse controls.
        </p>
      </div>

      <nav aria-label="Admin navigation" className="flex-1 space-y-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-200 hover:bg-slate-800 hover:text-white"
              )}
              href={item.href}
              onClick={onNavigate}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  active ? "text-primary" : "text-slate-400 group-hover:text-slate-200"
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <Alert className="border-slate-700 bg-slate-800/60 text-slate-200">
        <ShieldCheck className="h-4 w-4 !text-orange-300" />
        <AlertTitle className="text-white">Guardrails</AlertTitle>
        <AlertDescription className="text-xs leading-6 text-slate-300">
          All mutations are server-verified and audit logged. Read-only roles
          never reach write-capable handlers. Use manual overrides only with a
          written reason.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export function AdminSidebar({ permissions }: { permissions: string[] }) {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-800 bg-slate-950 text-slate-100 lg:block">
      <div className="sticky top-0 h-screen overflow-y-auto">
        <AdminSidebarContent permissions={permissions} />
      </div>
    </aside>
  );
}
