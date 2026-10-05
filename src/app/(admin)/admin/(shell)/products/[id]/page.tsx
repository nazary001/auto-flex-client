import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader, Pill } from "@/components/admin/ui";
import { can } from "@/lib/admin/permissions";
import { getAdminProductDetail, getProductFormData } from "@/lib/admin/queries/catalog";
import type { ProductSource } from "@/lib/server/db/collections";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { ProductForm } from "@/components/admin/catalog/ProductForm";
import { ProductHeaderActions } from "@/components/admin/catalog/ProductHeaderActions";

const sourceMeta: Record<ProductSource, { label: string; tone: "blue" | "violet" | "slate" }> = {
  ddtuning: { label: "DD Tuning", tone: "blue" },
  manual: { label: "Вручну", tone: "violet" },
  demo: { label: "Демо", tone: "slate" },
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const db = await getDb();
  const detail = await getAdminProductDetail(db, id);
  return { title: detail ? detail.product.name : "Товар" };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("catalog:read");
  const db = await getDb();
  const { id } = await params;
  const detail = await getAdminProductDetail(db, id);
  if (!detail) notFound();

  const canWrite = can(user, "catalog:write");
  const source = sourceMeta[detail.source];

  return (
    <div>
      <PageHeader
        title={detail.product.name}
        back={{ href: "/admin/products", label: "До товарів" }}
        description={`Артикул ${detail.product.sku}`}
        meta={
          <>
            <Pill tone={source.tone}>{source.label}</Pill>
            {detail.edited && <Pill tone="amber">Змінено</Pill>}
            {detail.retired ? <Pill tone="red">Знято з продажу</Pill> : detail.hidden ? <Pill tone="slate">Приховано</Pill> : null}
          </>
        }
        actions={
          <ProductHeaderActions
            id={detail.product.id}
            slug={detail.product.slug}
            source={detail.source}
            edited={detail.edited}
            hidden={detail.hidden}
            canWrite={canWrite}
          />
        }
      />
      <ProductForm product={detail.product} data={await getProductFormData(db, detail.product)} source={detail.source} supplier={detail.supplier} />
    </div>
  );
}
