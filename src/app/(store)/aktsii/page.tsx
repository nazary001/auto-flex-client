import type { Metadata } from "next";
import Link from "next/link";
import { TicketPercent } from "lucide-react";
import { PromoBanner } from "@/components/content/PromoBanner";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { toCardList } from "@/lib/card";
import { getSaleProducts } from "@/lib/catalog";
import { getPromos } from "@/lib/content";

export const metadata: Metadata = {
  title: "Акції",
  description:
    "Актуальні знижки AutoFlex на гальма, підвіску, двигун і автохімію. Чесні ціни, підбір за VIN і доставка по Україні.",
  alternates: { canonical: "/aktsii" },
};

export default async function PromotionsPage() {
  const [promos, saleProductsList] = await Promise.all([getPromos(), getSaleProducts(8)]);
  const saleProducts = toCardList(saleProductsList);

  return (
    <div className="container-page py-8 lg:py-12">
      <Breadcrumbs items={[{ label: "Акції" }]} />

      <header className="mt-5 max-w-3xl">
        <h1 className="page-title">Акції</h1>
        <p className="lead mt-3">
          Актуальні пропозиції та підбірки зі знижками. Кожна веде до реальних товарів у каталозі — із чесними цінами
          й перевіркою сумісності за VIN перед відправкою.
        </p>
      </header>

      <h2 className="sr-only">Поточні пропозиції</h2>
      <div className="mt-8 grid gap-4 lg:mt-10 lg:gap-5">
        {promos.map((promo) => (
          <PromoBanner key={promo.slug} promo={promo} variant="wide" />
        ))}
      </div>

      <section className="mt-12 lg:mt-16">
        <SectionHeading
          title="Товари зі знижкою"
          description="Найбільші реальні знижки з каталогу просто зараз."
          action={{ label: "Усі товари зі знижкою", href: "/catalog?sale=1" }}
        />
        {saleProducts.length > 0 ? (
          <ProductGrid className="mt-6" products={saleProducts} />
        ) : (
          <EmptyState
            className="mt-6"
            icon={<TicketPercent strokeWidth={1.75} />}
            title="Зараз немає акційних товарів"
            text="Загляньте трохи пізніше або перегляньте весь каталог запчастин."
            action={
              <Link href="/catalog" className={buttonClass({ variant: "secondary" })}>
                До каталогу
              </Link>
            }
          />
        )}
      </section>
    </div>
  );
}
