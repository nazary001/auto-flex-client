import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { getProductFormData } from "@/lib/admin/queries/catalog";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { ProductForm } from "@/components/admin/catalog/ProductForm";

export const metadata: Metadata = { title: "Новий товар" };

export default async function NewProductPage() {
  await requireUser("catalog:write");
  const db = await getDb();
  const data = await getProductFormData(db);

  return (
    <div>
      <PageHeader title="Новий товар" back={{ href: "/admin/products", label: "До товарів" }} />
      <ProductForm data={data} source="manual" />
    </div>
  );
}
