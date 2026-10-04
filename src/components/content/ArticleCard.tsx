import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import type { Article } from "@/lib/types";

/** Blog teaser: illustrated cover, rubric, date, title, excerpt */
export function ArticleCard({ article, className }: { article: Article; className?: string }) {
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-card border border-line-soft bg-white transition-[box-shadow,border-color] duration-200 hover:border-line hover:shadow-card",
        className,
      )}
    >
      <div className="bg-stripes-light relative aspect-[16/9] overflow-hidden">
        <span aria-hidden className="halftone absolute right-0 bottom-0 size-40 text-brand-300" />
        <Image
          src={`/illustrations/${article.illustration}.svg`}
          alt=""
          fill
          unoptimized
          className="object-contain p-4 transition-transform duration-300 group-hover:scale-[1.04]"
        />
        <span className="absolute top-3 left-3 rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-brand-700 backdrop-blur-sm">
          {article.topic}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="flex items-center gap-3 text-[13px] text-ink-3">
          <time dateTime={article.date}>{formatDate(article.date)}</time>
          <span className="inline-flex items-center gap-1">
            <Clock aria-hidden className="size-3.5" />
            {article.readMinutes} хв
          </span>
        </p>
        <h3 className="mt-2 text-[17px] leading-snug font-bold text-ink">
          <Link
            href={`/blog/${article.slug}`}
            className="transition-colors after:absolute after:inset-0 group-hover:text-brand-700"
          >
            {article.title}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-3 text-[15px] text-ink-3">{article.excerpt}</p>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-brand-600">
          Читати статтю
          <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </article>
  );
}
