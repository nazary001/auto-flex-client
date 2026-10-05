import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { PromoForm } from "@/components/admin/content/PromoForm";
import { categories } from "@/data/categories";
import { requireUser } from "@/lib/server/auth/dal";

export const metadata: Metadata = { title: "Нова акція" };

function illustrationOptions() {
  return categories
    .filter((category) => category.parentId !== null)
    .map((category) => ({ value: category.slug, label: category.name }));
}

export default async function NewPromoPage() {
  await requireUser("content:write");
  return (
    <div>
      <PageHeader title="Нова акція" back={{ href: "/admin/promos", label: "Акції" }} />
      <PromoForm mode="create" illustrations={illustrationOptions()} />
    </div>
  );
}
