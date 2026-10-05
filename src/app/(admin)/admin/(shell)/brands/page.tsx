import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { can } from "@/lib/admin/permissions";
import { listAdminBrands } from "@/lib/admin/queries/catalog";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { BrandManager } from "@/components/admin/catalog/BrandManager";

export const metadata: Metadata = { title: "Бренди" };

export default async function BrandsPage() {
  const user = await requireUser("catalog:read");
  const db = await getDb();
  const brands = await listAdminBrands(db);

  return (
    <div>
      <PageHeader title="Бренди" description={`Усього брендів: ${brands.length}`} />
      <BrandManager brands={brands} canWrite={can(user, "catalog:write")} />
    </div>
  );
}
