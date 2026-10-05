import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnchorNav } from "@/components/product-page/AnchorNav";
import { AskQuestion } from "@/components/product-page/AskQuestion";
import { Assurances } from "@/components/product-page/Assurances";
import { BuyBox } from "@/components/product-page/BuyBox";
import { CompatibilityTable, type FitRow } from "@/components/product-page/CompatibilityTable";
import { FitmentPanel, type FitmentTarget } from "@/components/product-page/FitmentPanel";
import { ProductGallery } from "@/components/product-page/ProductGallery";
import { ProductJsonLd } from "@/components/product-page/ProductJsonLd";
import { RecentlyViewed } from "@/components/product-page/RecentlyViewed";
import { ReviewsSection } from "@/components/product-page/ReviewsSection";
import { SpecsTable, type SpecRow } from "@/components/product-page/SpecsTable";
import { CopySku } from "@/components/product/CopySku";
import { FavoriteButton } from "@/components/product/FavoriteButton";
import { ProductCard } from "@/components/product/ProductCard";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";
import { Carousel } from "@/components/ui/Carousel";
import { Rating } from "@/components/ui/Rating";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { toCardData, toCardList } from "@/lib/card";
import {
  getBrandById,
  getCategory,
  getCategoryPath,
  getMakeById,
  getModelById,
  getProduct,
  getRelatedProducts,
  getReviews,
} from "@/lib/catalog";
import { countUk, pluralUk } from "@/lib/format";
import { site } from "@/lib/site";

/** 80 000+ products cannot be prerendered — render each product on demand and cache it (ISR). */
export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return {};

  const description =
    product.shortDescription.length <= 160 ? product.shortDescription : `${product.shortDescription.slice(0, 157)}…`;
  const canonical = `/product/${product.slug}`;

  return {
    title: product.name,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title: product.name,
      description,
      url: canonical,
    },
  };
}

const monthForms: [string, string, string] = ["місяць", "місяці", "місяців"];
const reviewForms: [string, string, string] = ["відгук", "відгуки", "відгуків"];

const sections = [
  { id: "opys", label: "Опис" },
  { id: "harakterystyky", label: "Характеристики" },
  { id: "sumisnist", label: "Сумісність" },
  { id: "vidhuky", label: "Відгуки" },
];

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const card = toCardData(product);

  const [brand, category, reviews, related, fitRowGroups] = await Promise.all([
    getBrandById(product.brandId),
    getCategory(product.categoryId),
    getReviews(product.id),
    getRelatedProducts(product, 12),
    // Fitment → table rows. Universal products carry no fitment, so this stays an empty list.
    Promise.all(
      product.fitment.map(async (fit): Promise<FitRow[]> => {
        const [make, model] = await Promise.all([getMakeById(fit.makeId), getModelById(fit.modelId)]);
        if (!make || !model) return [];
        return [
          {
            makeSlug: make.slug,
            makeName: make.name,
            modelSlug: model.slug,
            modelName: model.name,
            years: fit.years,
            note: fit.note,
          },
        ];
      }),
    ),
  ]);

  const categoryPath = category ? await getCategoryPath(category) : [];
  const relatedCards = toCardList(related);
  const fitRows: FitRow[] = fitRowGroups.flat();
  const fitTargets: FitmentTarget[] = fitRows.map((row) => ({
    makeSlug: row.makeSlug,
    modelSlug: row.modelSlug,
    label: `${row.makeName} ${row.modelName}`,
  }));

  const warranty =
    product.warrantyMonths > 0
      ? `${product.warrantyMonths} ${pluralUk(product.warrantyMonths, monthForms)}`
      : "за умовами виробника";

  const specRows: SpecRow[] = [
    { label: "Бренд", value: brand?.name ?? "—", href: brand ? `/brands/${brand.slug}` : undefined },
    { label: "Країна бренду", value: brand?.country ?? "—" },
    { label: "Артикул", value: product.sku, tabular: true },
    ...(product.oemNumbers.length
      ? [{ label: "OE / крос-номери", value: product.oemNumbers.join(", "), tabular: true }]
      : []),
    { label: "Категорія", value: category?.name ?? "—", href: category ? `/catalog/${category.slug}` : undefined },
    ...product.specs.map((spec) => ({ label: spec.name, value: spec.value })),
    { label: "Гарантія", value: warranty },
  ];

  const crumbs: Crumb[] = [
    { label: "Каталог", href: "/catalog" },
    ...categoryPath.map((cat) => ({ label: cat.name, href: `/catalog/${cat.slug}` })),
    { label: product.name },
  ];

  const canonicalUrl = `${site.url}/product/${product.slug}`;
  const imageUrl = card.image
    ? new URL(card.image, site.url).toString()
    : `${site.url}/illustrations/${card.illustration}.svg`;

  return (
    <div>
      <div className="container-page pt-5 pb-10 lg:pt-6 lg:pb-12">
        <Breadcrumbs items={crumbs} className="mb-5" />

        <div className="md:grid md:grid-cols-2 md:items-start md:gap-6 lg:gap-8 xl:gap-12">
          <div className="mx-auto w-full max-w-md md:max-w-none">
            <ProductGallery
              images={product.images}
              illustration={card.illustration}
              alt={product.name}
              badges={product.badges}
              discount={card.oldPrice ? Math.round(((card.oldPrice - card.price) / card.oldPrice) * 100) : 0}
            />
          </div>

          <div className="mt-6 grid content-start gap-4 md:mt-0">
            {brand && (
              <Link
                href={`/brands/${brand.slug}`}
                className="w-fit text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
              >
                {brand.name}
              </Link>
            )}

            <h1 className="page-title">{product.name}</h1>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <CopySku sku={product.sku} />
              {product.reviewsCount > 0 ? (
                <a href="#vidhuky" className="group inline-flex items-center gap-2 text-sm">
                  <Rating value={product.rating} />
                  <span className="tabular font-medium text-ink-2">
                    {product.rating.toFixed(1).replace(".", ",")}
                  </span>
                  <span className="text-ink-3 underline-offset-2 group-hover:text-brand-700 group-hover:underline">
                    · {countUk(product.reviewsCount, reviewForms)}
                  </span>
                </a>
              ) : (
                <a
                  href="#vidhuky"
                  className="text-sm text-ink-3 underline-offset-2 hover:text-brand-700 hover:underline"
                >
                  Ще немає відгуків — залишіть перший
                </a>
              )}
            </div>

            {product.oemNumbers.length > 0 && (
              <p className="text-[13px] text-ink-3">
                OE / крос-номери: <span className="tabular text-ink-2">{product.oemNumbers.join(", ")}</span>
              </p>
            )}

            <BuyBox product={card} />

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <FavoriteButton productId={product.id} name={product.name} variant="labeled" />
              <AskQuestion productId={product.id} productName={product.name} />
            </div>

            <FitmentPanel fits={fitTargets} universal={product.universal} />
            <Assurances warrantyMonths={product.warrantyMonths} />
          </div>
        </div>
      </div>

      <div className="border-t border-line-soft">
        <div className="container-page py-10 lg:py-14">
          <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
            <AnchorNav sections={sections} />

            <div className="min-w-0 max-w-4xl space-y-10 lg:space-y-12">
              <section id="opys" className="scroll-mt-24">
                <SectionHeading as="h2" title="Опис" className="mb-4" />
                <div className="prose-af">
                  {product.description.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              </section>

              <section id="harakterystyky" className="scroll-mt-24">
                <SectionHeading as="h2" title="Характеристики" className="mb-4" />
                <SpecsTable rows={specRows} />
              </section>

              <section id="sumisnist" className="scroll-mt-24">
                <SectionHeading
                  as="h2"
                  title="Сумісність"
                  description={
                    product.universal
                      ? "Товар підходить до більшості автомобілів."
                      : "Моделі авто, на які встановлюється ця запчастина."
                  }
                  className="mb-4"
                />
                <CompatibilityTable rows={fitRows} universal={product.universal} />
                {!product.universal && fitRows.length > 0 && (
                  <p className="mt-3 text-[13px] text-ink-3">
                    Перелік орієнтовний. Остаточну сумісність перевіримо за VIN перед відправленням.
                  </p>
                )}
              </section>

              <section id="vidhuky" className="scroll-mt-24">
                <SectionHeading as="h2" title="Відгуки" className="mb-5" />
                <ReviewsSection
                  productId={product.id}
                  rating={product.rating}
                  reviewsCount={product.reviewsCount}
                  reviews={reviews}
                />
              </section>
            </div>
          </div>
        </div>
      </div>

      {relatedCards.length > 0 && (
        <section aria-label="З цим товаром купують" className="border-t border-line-soft">
          <div className="container-page py-10 lg:py-14">
            <SectionHeading as="h2" title="З цим товаром купують" className="mb-5" />
            <Carousel label="Супутні товари">
              {relatedCards.map((related) => (
                <ProductCard key={related.id} product={related} />
              ))}
            </Carousel>
          </div>
        </section>
      )}

      <RecentlyViewed currentId={product.id} />

      <ProductJsonLd
        name={product.name}
        sku={product.sku}
        mpn={product.oemNumbers[0] ?? product.sku}
        brandName={brand?.name ?? site.name}
        categoryName={category?.name ?? ""}
        description={product.shortDescription}
        imageUrl={imageUrl}
        url={canonicalUrl}
        price={product.price}
        stock={product.stock}
        rating={product.rating}
        reviewsCount={product.reviewsCount}
      />
    </div>
  );
}
