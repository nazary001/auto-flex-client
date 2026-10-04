import { ArticleCard } from "@/components/content/ArticleCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/lib/cn";
import type { Article } from "@/lib/types";

/** Blog block: the newest articles with a link to the full blog. */
export function BlogTeasers({ articles }: { articles: Article[] }) {
  if (articles.length === 0) return null;

  const cols =
    articles.length >= 3 ? "sm:grid-cols-2 lg:grid-cols-3" : articles.length === 2 ? "sm:grid-cols-2" : "max-w-md";

  return (
    <section className="bg-mist-soft">
      <div className="container-page py-10 lg:py-14">
        <SectionHeading
          title="Поради та статті"
          description="Як підбирати запчастини, обслуговувати авто й не переплачувати."
          action={{ label: "Усі статті", href: "/blog" }}
          className="mb-6"
        />
        <ul className={cn("grid gap-5", cols)}>
          {articles.map((article) => (
            <li key={article.slug} className="flex">
              <ArticleCard article={article} className="w-full" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
