import type { Role } from "./types";

/*
 * Role-based permissions. Reads are open to every active user; writes are granted per area.
 * `can()` is the single check used by pages, server actions and route handlers.
 */

export type Permission =
  | "orders:read"
  | "orders:write"
  | "purchases:read"
  | "purchases:write"
  | "customers:read"
  | "customers:write"
  | "requests:read"
  | "requests:write"
  | "catalog:read"
  | "catalog:write"
  | "content:read"
  | "content:write"
  | "settings:read"
  | "settings:write"
  | "users:read"
  | "users:write"
  | "audit:read"
  | "export";

const READ_ALL: Permission[] = [
  "orders:read",
  "purchases:read",
  "customers:read",
  "requests:read",
  "catalog:read",
  "content:read",
  "settings:read",
  "users:read",
  "audit:read",
  "export",
];

const MANAGER_WRITES: Permission[] = [
  "orders:write",
  "purchases:write",
  "customers:write",
  "requests:write",
  "catalog:write",
  "content:write",
];

const OWNER_WRITES: Permission[] = ["settings:write", "users:write"];

export const rolePermissions: Record<Role, ReadonlySet<Permission>> = {
  viewer: new Set(READ_ALL),
  manager: new Set([...READ_ALL, ...MANAGER_WRITES]),
  owner: new Set([...READ_ALL, ...MANAGER_WRITES, ...OWNER_WRITES]),
};

export function can(user: { role: Role; active?: boolean } | null | undefined, permission: Permission): boolean {
  if (!user || user.active === false) return false;
  return rolePermissions[user.role]?.has(permission) ?? false;
}

export const ALL_PERMISSIONS: Permission[] = [...READ_ALL, ...MANAGER_WRITES, ...OWNER_WRITES];
