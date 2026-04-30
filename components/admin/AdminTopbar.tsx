"use client";

import Link from "next/link";
import { ExternalLink, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminUserMenu } from "@/components/admin/AdminUserMenu";
import { Badge } from "@/components/admin/Badge";

export function AdminTopbar({
  email,
  roles,
  onOpenSidebar,
}: {
  email: string | null;
  roles: string[];
  onOpenSidebar?: () => void;
}) {
  const appUrl = process.env.NEXT_PUBLIC_FINALSPREP_APP_URL;

  return (
    <header className="sticky top-0 z-30 flex flex-col gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        {onOpenSidebar ? (
          <Button
            aria-label="Open navigation"
            className="lg:hidden"
            onClick={onOpenSidebar}
            size="icon"
            variant="ghost"
          >
            <Menu className="h-5 w-5" />
          </Button>
        ) : null}
        <Badge tone="accent">Live console</Badge>
        <Badge tone="neutral">Shared Firebase project</Badge>
        {appUrl ? (
          <Link
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            href={appUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open student app
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
      <AdminUserMenu email={email} roles={roles} />
    </header>
  );
}
