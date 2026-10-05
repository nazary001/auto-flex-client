import type { Permission } from "@/lib/admin/permissions";
import type { SidebarCounts } from "@/lib/server/db/repos/stats";

/*
 * Navigation model for the admin sidebar. Plain data (no server imports at runtime), so it is
 * safe to import from both the server shell layout and the client nav. `icon` is a key into the
 * map in nav-icons.tsx; `badge` names a count from the sidebar stats.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: keyof SidebarCounts;
  permission?: Permission;
  /** Active only on an exact path match (used by the dashboard root) */
  exact?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Операції",
    items: [
      { href: "/admin", label: "Дашборд", icon: "dashboard", exact: true },
      { href: "/admin/orders", label: "Замовлення", icon: "orders", badge: "newOrders" },
      { href: "/admin/purchases", label: "Закупівлі", icon: "purchases", badge: "needsSourcing" },
      { href: "/admin/requests", label: "Заявки", icon: "requests", badge: "newRequests" },
    ],
  },
  {
    title: "Довідники",
    items: [
      { href: "/admin/products", label: "Товари", icon: "products" },
      { href: "/admin/categories", label: "Категорії", icon: "categories" },
      { href: "/admin/brands", label: "Бренди", icon: "brands" },
      { href: "/admin/suppliers", label: "Постачальники", icon: "suppliers" },
      { href: "/admin/customers", label: "Клієнти", icon: "customers" },
    ],
  },
  {
    title: "Контент",
    items: [
      { href: "/admin/reviews", label: "Відгуки", icon: "reviews", badge: "pendingReviews" },
      { href: "/admin/promos", label: "Акції", icon: "promos" },
      { href: "/admin/faq", label: "FAQ", icon: "faq" },
    ],
  },
  {
    title: "Система",
    items: [
      { href: "/admin/supplier", label: "Постачальник DD", icon: "supplier", permission: "settings:read" },
      { href: "/admin/settings", label: "Налаштування", icon: "settings", permission: "settings:read" },
      { href: "/admin/users", label: "Користувачі", icon: "users", permission: "users:read" },
      { href: "/admin/audit", label: "Журнал", icon: "audit", permission: "audit:read" },
    ],
  },
];

/** Up to two initials from a display name, for avatar chips. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0];
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1];
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}
