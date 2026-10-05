import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { PromoForm } from "@/components/admin/content/PromoForm";
import { categories } from "@/data/categories";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { getPromo } from "@/lib/server/db/repos/content";

export const metadata: Metadata = { title: "Редагувати акцію" };

function illustrationOptions() {
  return categories
    .filter((category) => category.parentId !== null)
    .map((category) => ({ value: category.slug, label: category.name }));
}

export default async function EditPromoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("content:write");
  const { id } = await params;
  const db = await getDb();
  const promo = await getPromo(db, id);
  if (!promo) notFound();

  return (
    <div>
      <PageHeader title="Редагувати акцію" back={{ href: "/admin/promos", label: "Акції" }} />
      <PromoForm
        mode="edit"
        initial={{ ...promo.data, id: promo.id, active: promo.active }}
        illustrations={illustrationOptions()}
      />
    </div>
  );
}
