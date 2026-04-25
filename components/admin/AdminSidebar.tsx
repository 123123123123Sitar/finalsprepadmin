"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  permission: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Overview", permission: "dashboard.read" },
  { href: "/admin/users", label: "Users", permission: "users.read" },
  { href: "/admin/billing", label: "Billing", permission: "billing.read" },
  { href: "/admin/usage", label: "Usage", permission: "usage.read" },
  { href: "/admin/content", label: "Content", permission: "content.read" },
  { href: "/admin/settings", label: "Settings", permission: "settings.read" },
  { href: "/admin/audit-logs", label: "Audit Logs", permission: "audit.read" },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar({
  permissions,
}: {
  permissions: string[];
}) {
  const pathname = usePathname();

  return (
    <aside className="w-full shrink-0 border-b border-slate-800 bg-ink text-slate-100 lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r">
      <div className="sticky top-0 flex flex-col gap-8 px-6 py-7 lg:h-screen">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-300">FinalsPrep</p>
          <h1 className="mt-3 font-display text-3xl leading-tight text-white">Admin Console</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Operator workspace for subscriptions, AI spend, course health, and abuse controls.
          </p>
        </div>

        <nav aria-label="Admin navigation" className="grid gap-1.5">
          {NAV_ITEMS.filter((item) => permissions.includes(item.permission)).map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                  active
                    ? "bg-white text-ink shadow-panel"
                    : "text-slate-200 hover:bg-slate-800 hover:text-white"
                }`}
                href={item.href}
              >
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full ${
                    active ? "bg-accent" : "bg-slate-600 group-hover:bg-slate-400"
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-300">
          <p className="font-medium text-white">Guardrails</p>
          <ul className="mt-3 space-y-2 leading-6">
            <li>All mutations are server-verified and audit logged.</li>
            <li>Read-only roles never reach write-capable handlers.</li>
            <li>Use manual overrides only with a written reason.</li>
          </ul>
        </div>
      </div>
    </aside>
  );
}
