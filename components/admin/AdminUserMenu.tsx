"use client";

import { useTransition } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/admin/Badge";
import { useAdminAuth } from "@/components/auth/AdminAuthProvider";

function initials(input: string | null) {
  if (!input) return "?";
  const trimmed = input.trim();
  if (!trimmed) return "?";
  const local = trimmed.split("@")[0];
  const parts = local.split(/[._-]/g).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

export function AdminUserMenu({
  email,
  roles,
}: {
  email: string | null;
  roles: string[];
}) {
  const { signOut } = useAdminAuth();
  const [isPending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex h-auto items-center gap-3 rounded-full px-2 py-1.5 hover:bg-muted"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
              {initials(email)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-left sm:inline">
            <span className="block text-sm font-medium leading-tight text-foreground">
              {email || "Admin"}
            </span>
            <span className="block text-xs leading-tight text-muted-foreground">
              {roles.length > 0 ? roles[0].replace(/_/g, " ") : "no role"}
            </span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">
            {email || "Admin session"}
          </span>
          <span className="text-xs text-muted-foreground">
            Signed in to FinalsPrep Admin
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="flex flex-wrap gap-1.5 px-2 py-1.5">
          {roles.length === 0 ? (
            <span className="text-xs text-muted-foreground">No roles assigned</span>
          ) : (
            roles.map((role) => (
              <Badge key={role} tone="neutral">
                {role.replace(/_/g, " ")}
              </Badge>
            ))
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
          disabled={isPending}
          onSelect={(event) => {
            event.preventDefault();
            startTransition(async () => {
              await signOut();
              window.location.href = "/signin";
            });
          }}
        >
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="mr-2 h-4 w-4" />
          )}
          {isPending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
