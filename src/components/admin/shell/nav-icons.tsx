import {
  ClipboardList,
  CircleHelp,
  FolderTree,
  Inbox,
  LayoutDashboard,
  Package,
  PackagePlus,
  Percent,
  Plug,
  ScrollText,
  Settings,
  Star,
  Tags,
  Truck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

/* Client-safe mapping from NavItem.icon keys to lucide components. */
const icons: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  orders: ClipboardList,
  purchases: PackagePlus,
  requests: Inbox,
  products: Package,
  categories: FolderTree,
  brands: Tags,
  suppliers: Truck,
  customers: Users,
  reviews: Star,
  promos: Percent,
  faq: CircleHelp,
  supplier: Plug,
  settings: Settings,
  users: UserCog,
  audit: ScrollText,
};

export function navIcon(name: string): LucideIcon {
  return icons[name] ?? ClipboardList;
}
