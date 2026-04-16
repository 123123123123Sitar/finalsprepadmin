"use client";

import { useTransition } from "react";
import { Badge } from "@/components/admin/Badge";
import { useAdminAuth } from "@/components/auth/AdminAuthProvider";

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
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-panel">
      <div className="text-right">
        <p className="text-sm font-medium text-ink">{email || "Admin session"}</p>
        <div className="mt-1 flex flex-wrap justify-end gap-2">
          {roles.slice(0, 2).map((role) => (
            <Badge key={role} tone="accent">
              {role}
            </Badge>
          ))}
        </div>
      </div>
      <button
        className="admin-button-secondary"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await signOut();
            window.location.href = "/signin";
          })
        }
        type="button"
      >
        {isPending ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
}

