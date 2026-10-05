import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Users } from "lucide-react";
import { ArticleBody } from "@/components/blog/ArticleBody";
import { ArticleToc } from "@/components/blog/ArticleToc";
import { buildToc } from "@/components/blog/toc";
import { ArticleCard } from "@/components/content/ArticleCard";
import { ProductCard } from "@/components/product/ProductCard";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Carousel } from "@/components/ui/Carousel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { articles } from "@/data/articles";
import { toCardList } from "@/lib/card";
import { getCategory, queryProducts } from "@/lib/catalog";
import { formatDate } from "@/lib/format";
import { site } from "@/lib/site";
import type { Product } from "@/lib/types";

const bySlug = new Map(articles.map((a) => [a.slug, a]));

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

function clampText(text: string, max = 160): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = bySlug.get(slug);
  if (!article) return {};
  return {
    title: article.title,
    description: clampText(article.excerpt),
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: clampText(article.excerpt),
      publishedTime: article.date,
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = bySlug.get(slug);
  if (!article) notFound();

  const toc = buildToc(article.body);

  // «Товари з цієї статті»: popular in-stock products from the article's categories.
  // relatedCategories slugs may no longer exist in Catalog v2 — queryProducts returns nothing for a
  // missing category and getCategory resolves to undefined, so missing ones are silently skipped.
  const [productResults, resolvedCategories] = await Promise.all([
    Promise.all(
      article.relatedCategories.map((catSlug) =>
        queryProducts({ categoryId: catSlug, inStockOnly: true, sort: "popular", perPage: 6 }),
      ),
    ),
    Promise.all(article.relatedCategories.map((catSlug) => getCategory(catSlug))),
  ]);

  const seen = new Set<string>();
  const related: Product[] = [];
  for (const result of productResults) {
    for (const product of result.items) {
      if (!seen.has(product.id)) {
        seen.add(product.id);
        related.push(product);
      }
    }
  }
  const productCards = toCardList(related.slice(0, 12));
  const relatedCategories = resolvedCategories.filter((c): c is NonNullable<typeof c> => Boolean(c));

  // «Читайте також»: same rubric first, then the rest, newest kept order
  const others = articles.filter((a) => a.slug !== slug);
  const readAlso = [
    ...others.filter((a) => a.topic === article.topic),
    ...others.filter((a) => a.topic !== article.topic),
  ].slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.excerpt,
    datePublished: article.date,
    author: { "@type": "Organization", name: "Команда AutoFlex" },
    publisher: { "@type": "Organization", name: site.name },
    image: new URL(`/illustrations/${article.illustration}.svg`, site.url).toString(),
    mainEntityOfPage: new URL(`/blog/${article.slug}`, site.url).toString(),
  };

  return (
    <article className="container-page py-8 lg:py-12">
      <Breadcrumbs items={[{ label: "Блог", href: "/blog" }, { label: article.title }]} />

      <header className="mt-5 max-w-3xl">
        <Link
          href={`/blog?topic=${encodeURIComponent(article.topic)}`}
          className="inline-flex items-center rounded-md bg-brand-50 px-2.5 py-1 text-[13px] font-semibold text-brand-700 transition-colors hover:bg-brand-100"
        >
          {article.topic}
        </Link>
        <h1 className="page-title mt-3">{article.title}</h1>
        <p className="lead mt-3">{article.excerpt}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-3">
          <time dateTime={article.date}>{formatDate(article.date)}</time>
          <span className="inline-flex items-center gap-1.5">
            <Clock aria-hidden className="size-4" />
            {article.readMinutes} хв читання
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users aria-hidden className="size-4" />
            Команда AutoFlex
          </span>
        </div>
      </header>

      <div className="relative mt-6 flex aspect-[16/9] items-center justify-center overflow-hidden rounded-card bg-stripes-light sm:aspect-[21/7] lg:max-w-5xl">
        <span aria-hidden className="halftone absolute right-0 bottom-0 size-56 text-brand-300" />
        <Image
          src={`/illustrations/${article.illustration}.svg`}
          alt=""
          fill
          unoptimized
          sizes="(min-width: 1024px) 1024px, 100vw"
          className="object-contain p-8 sm:p-10"
        />
      </div>

      <div className="mt-8 grid gap-8 lg:mt-10 lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-10">
        <aside className="lg:col-start-2 lg:row-start-1 lg:sticky lg:top-24 lg:self-start">
          <ArticleToc toc={toc} />
        </aside>
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <ArticleBody body={article.body} />
        </div>
      </div>

      {productCards.length > 0 && (
        <section className="mt-12 lg:mt-16">
          <SectionHeading
            title="Товари з цієї статті"
            description="Популярні позиції з категорій, про які йдеться вище."
          />
          <div className="mt-6">
            <Carousel label="Товари з цієї статті">
              {productCards.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </Carousel>
          </div>
          {relatedCategories.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="text-sm text-ink-3">Категорії:</span>
              {relatedCategories.map((category) => (
                <Link
                  key={category.id}
                  href={`/catalog/${category.slug}`}
                  className="inline-flex h-9 items-center rounded-btn border border-line bg-white px-3.5 text-sm font-medium text-ink-2 transition-colors hover:border-brand-600 hover:text-brand-700"
                >
                  {category.name}
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mt-12 lg:mt-16">
        <SectionHeading title="Читайте також" action={{ label: "Усі статті", href: "/blog" }} />
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {readAlso.map((item) => (
            <ArticleCard key={item.slug} article={item} />
          ))}
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </article>
  );
}
