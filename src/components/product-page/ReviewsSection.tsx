import { Star } from "lucide-react";
import { ReviewForm } from "@/components/product-page/ReviewForm";
import { Rating } from "@/components/ui/Rating";
import { countUk, formatDate } from "@/lib/format";
import type { Review } from "@/lib/types";

interface ReviewsSectionProps {
  productId: string;
  rating: number;
  reviewsCount: number;
  reviews: Review[];
}

const reviewForms: [string, string, string] = ["відгук", "відгуки", "відгуків"];

function ReviewItem({ review }: { review: Review }) {
  return (
    <article className="border-t border-line-soft py-4 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-content-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700"
          >
            {review.author.slice(0, 1)}
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">{review.author}</p>
            <p className="text-xs text-ink-3">
              {formatDate(review.date)}
              {review.car ? ` · ${review.car}` : ""}
            </p>
          </div>
        </div>
        <Rating value={review.rating} size="sm" />
      </div>
      <p className="mt-2.5 text-[15px] leading-relaxed text-ink-2">{review.text}</p>
    </article>
  );
}

/** «Відгуки» — aggregate rating, the written reviews and the review form. */
export function ReviewsSection({ productId, rating, reviewsCount, reviews }: ReviewsSectionProps) {
  const hasAggregate = reviewsCount > 0;

  return (
    <div className="grid gap-6">
      {hasAggregate ? (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-card border border-line-soft bg-mist-soft p-5">
          <div className="text-center">
            <p className="display text-5xl text-ink">{rating.toFixed(1).replace(".", ",")}</p>
            <Rating value={rating} size="md" className="mt-1.5 justify-center" />
            <p className="mt-1.5 text-[13px] text-ink-3">{countUk(reviewsCount, reviewForms)}</p>
          </div>
          <p className="max-w-sm text-sm text-ink-2">
            Оцінки покупців, які придбали цей товар. Ваш відгук допоможе іншим зробити вибір.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-card border border-line-soft bg-mist-soft p-5">
          <Star aria-hidden className="mt-0.5 size-6 shrink-0 text-silver-400" fill="currentColor" strokeWidth={0} />
          <div>
            <p className="font-semibold text-ink">Відгуків поки немає</p>
            <p className="mt-0.5 text-sm text-ink-2">
              Станьте першим, хто поділиться враженнями про цей товар — це допоможе іншим покупцям.
            </p>
          </div>
        </div>
      )}

      {reviews.length > 0 ? (
        <div>
          {reviews.map((review) => (
            <ReviewItem key={review.id} review={review} />
          ))}
        </div>
      ) : hasAggregate ? (
        <p className="text-sm text-ink-3">
          Розгорнутих відгуків поки немає. Залиште свій — розкажіть, як товар показав себе у вашому авто.
        </p>
      ) : null}

      <div className="rounded-card border border-line-soft p-5">
        <h3 className="text-base font-bold text-ink">Залишити відгук</h3>
        <p className="mt-1 mb-4 text-sm text-ink-3">
          {"Поставте оцінку й напишіть кілька слів. Відгук з'явиться після перевірки модератором."}
        </p>
        <ReviewForm productId={productId} />
      </div>
    </div>
  );
}
