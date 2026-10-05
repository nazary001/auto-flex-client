import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { can } from "@/lib/admin/permissions";
import { getIllustrationKeys, listAdminCategories } from "@/lib/admin/queries/catalog";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { CategoryManager } from "@/components/admin/catalog/CategoryManager";

export const metadata: Metadata = { title: "Категорії" };

export default async function CategoriesPage() {
  const user = await requireUser("catalog:read");
  const db = await getDb();
  const [groups, illustrationKeys] = await Promise.all([listAdminCategories(db), getIllustrationKeys()]);

  return (
    <div>
      <PageHeader title="Категорії" description="Структура каталогу: групи та категорії товарів" />
      <CategoryManager groups={groups} illustrationKeys={illustrationKeys} canWrite={can(user, "catalog:write")} />
    </div>
  );
}
