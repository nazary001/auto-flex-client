import type { Metadata } from "next";
import { BenefitsBar } from "@/components/catalog/BenefitsBar";
import { CategorySidebar } from "@/components/catalog/CategorySidebar";
import { getSelectorData } from "@/components/catalog/VehicleBar";
import { BlogTeasers } from "@/components/home/BlogTeasers";
import { BrandTiles } from "@/components/home/BrandTiles";
import { CategoryTiles } from "@/components/home/CategoryTiles";
import { Hero } from "@/components/home/Hero";
import { HomeFaq } from "@/components/home/HomeFaq";
import { HowItWorks } from "@/components/home/HowItWorks";
import { MakesCard } from "@/components/home/MakesCard";
import { MakeTiles } from "@/components/home/MakeTiles";
import { Promotions } from "@/components/home/Promotions";
import { ProductTabs } from "@/components/home/ProductTabs";
import { SeoText } from "@/components/home/SeoText";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { articles } from "@/data/articles";
import { faq } from "@/data/faq";
import { promos } from "@/data/promos";
import { toCardList } from "@/lib/card";
import {
  getBrands,
  getCategoryProductCount,
  getMakes,
  getModels,
  getNewProducts,
  getPopularProducts,
  getProducts,
  getSaleProducts,
  getTopCategories,
} from "@/lib/catalog";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  // The root page shares its route segment with the root layout, so the layout's
  // title.template does not apply here — set a complete, brand-inclusive title.
  title: { absolute: "AutoFlex — автозапчастини для вашого авто онлайн" },
  description:
    "Інтернет-магазин автозапчастин AutoFlex: підбір за маркою, моделлю та VIN, перевірка сумісності й доставка по Україні за 1–3 дні.",
  alternates: { canonical: "/" },
};

export default function Page() {
  const { makes, categories } = getSelectorData();

  const allMakes = getMakes();
  const allBrands = getBrands();
  const productCount = getProducts().length;

  const newItems = toCardList(getNewProducts(12));
  const saleItems = toCardList(getSaleProducts(12));
  const popularItems = toCardList(getPopularProducts(12));

  const categoryTiles = getTopCategories().map((category) => ({
    slug: category.slug,
    name: category.name,
    illustration: category.illustration,
    count: getCategoryProductCount(category.id),
  }));

  const makeOptions = allMakes.map((make) => ({ slug: make.slug, name: make.name }));

  const popularMakeTiles = allMakes
    .filter((make) => make.popular)
    .map((make) => ({ slug: make.slug, name: make.name, modelCount: getModels(make.id).length }));

  const popularBrandTiles = allBrands
    .filter((brand) => brand.popular)
    .map((brand) => ({ slug: brand.slug, name: brand.name, country: brand.country }));

  const latestArticles = [...articles].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: site.name,
      url: site.url,
      logo: `${site.url}/icon.svg`,
      email: site.email,
      contactPoint: {
        "@type": "ContactPoint",
        telephone: site.phone.href.replace("tel:", ""),
        contactType: "customer service",
        areaServed: "UA",
        availableLanguage: ["uk"],
      },
      sameAs: [site.socials.telegram, site.socials.instagram, site.socials.facebook],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: site.name,
      url: site.url,
      inLanguage: "uk-UA",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${site.url}/search?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ];

  return (
    <>
      <Hero
        makes={makes}
        categories={categories}
        productCount={productCount}
        makeCount={allMakes.length}
        brandCount={allBrands.length}
      />

      <div className="container-page pt-8 lg:pt-10">
        <BenefitsBar />
      </div>

      <section className="container-page py-10 lg:py-14">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-10">
          <aside className="hidden space-y-6 lg:block">
            <CategorySidebar />
            <MakesCard makes={makeOptions} />
          </aside>

          <div className="min-w-0 space-y-12">
            <div>
              <SectionHeading
                title="Товари для вашого авто"
                action={{ label: "Увесь каталог", href: "/catalog" }}
                className="mb-5"
              />
              <ProductTabs newItems={newItems} saleItems={saleItems} popularItems={popularItems} />
            </div>

            <div>
              <SectionHeading
                title="Популярні категорії"
                action={{ label: "Усі категорії", href: "/catalog" }}
                className="mb-5"
              />
              <CategoryTiles items={categoryTiles} />
            </div>
          </div>
        </div>
      </section>

      <Promotions promos={promos} />
      <MakeTiles items={popularMakeTiles} />
      <HowItWorks />
      <BrandTiles items={popularBrandTiles} />
      <BlogTeasers articles={latestArticles} />
      <HomeFaq items={faq} />
      <SeoText />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\u003c") }} />
    </>
  );
}
