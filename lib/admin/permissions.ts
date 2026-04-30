import type {
  AdminPermission,
  AdminRole,
} from "@/lib/admin/types";

export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  readonly_admin: [
    "dashboard.read",
    "users.read",
    "usage.read",
    "content.read",
    "settings.read",
    "audit.read",
  ],
  support_admin: [
    "dashboard.read",
    "users.read",
    "users.write",
    "support.write",
    "usage.read",
    "content.read",
    "audit.read",
  ],
  content_admin: [
    "dashboard.read",
    "users.read",
    "content.read",
    "content.write",
    "settings.read",
    "usage.read",
    "audit.read",
  ],
  super_admin: [
    "dashboard.read",
    "users.read",
    "users.write",
    "support.write",
    "usage.read",
    "usage.write",
    "content.read",
    "content.write",
    "settings.read",
    "settings.write",
    "audit.read",
    "impersonation.use",
  ],
};

export function expandPermissions(roles: AdminRole[]): AdminPermission[] {
  return [...new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role] ?? []))];
}

export function hasPermission(
  roles: AdminRole[],
  permission: AdminPermission
): boolean {
  return roles.includes("super_admin") || expandPermissions(roles).includes(permission);
}
