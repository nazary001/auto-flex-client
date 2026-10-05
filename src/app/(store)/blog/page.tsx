import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Newspaper } from "lucide-react";
import { ArticleCard } from "@/components/content/ArticleCard";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { articles } from "@/data/articles";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Блог",
  description:
    "Поради з вибору та обслуговування автозапчастин: гальма, двигун, фільтри, підвіска, акумулятор і підготовка авто до зими.",
  alternates: { canonical: "/blog" },
};

/** Rubrics in first-appearance order */
const topics = [...new Set(articles.map((a) => a.topic))];

function TopicChip({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-10 items-center rounded-btn border px-4 text-sm font-medium transition-colors",
        active
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-line bg-white text-ink-2 hover:border-brand-600 hover:text-brand-700",
      )}
    >
      {children}
    </Link>
  );
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = typeof sp.topic === "string" ? sp.topic : undefined;
  const activeTopic = raw && topics.includes(raw) ? raw : undefined;
  const list = activeTopic ? articles.filter((a) => a.topic === activeTopic) : articles;

  return (
    <div className="container-page py-8 lg:py-12">
      <Breadcrumbs items={[{ label: "Блог" }]} />

      <header className="mt-5 max-w-3xl">
        <h1 className="page-title">Блог AutoFlex</h1>
        <p className="lead mt-3">
          Поради, як обрати запчастини, вчасно їх обслужити та підготувати авто до сезону. Пишемо просто й по суті —
          щоб ви купували саме те, що потрібно вашій машині.
        </p>
      </header>

      <nav aria-label="Рубрики блогу" className="mt-6 flex flex-wrap gap-2">
        <TopicChip href="/blog" active={!activeTopic}>
          Усі статті
        </TopicChip>
        {topics.map((topic) => (
          <TopicChip key={topic} href={`/blog?topic=${encodeURIComponent(topic)}`} active={topic === activeTopic}>
            {topic}
          </TopicChip>
        ))}
      </nav>

      <h2 className="sr-only">{activeTopic ? `Статті: ${activeTopic}` : "Усі статті блогу"}</h2>

      {list.length > 0 ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:mt-10 lg:grid-cols-3">
          {list.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-8"
          icon={<Newspaper strokeWidth={1.75} />}
          title="У цій рубриці поки порожньо"
          text="Тут ще немає статей. Загляньте в інші теми або перегляньте всі матеріали блогу."
          action={
            <Link href="/blog" className={buttonClass({ variant: "secondary" })}>
              Усі статті
            </Link>
          }
        />
      )}
    </div>
  );
}
