"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { LeadForm } from "@/components/forms/LeadForm";
import { cn } from "@/lib/cn";

/** Review form: a star-rating picker passed into the shared LeadForm (kind="question"). */
export function ReviewForm({ productId }: { productId: string }) {
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const shown = hover || rating;

  return (
    <LeadForm
      kind="question"
      productId={productId}
      name="required"
      comment="required"
      commentLabel="Ваш відгук"
      commentPlaceholder="Поділіться досвідом: чи підійшло до вашого авто, якість, доставка…"
      commentPrefix={`Відгук, оцінка ${rating}/5`}
      submitLabel="Надіслати відгук"
      successTitle="Дякуємо за відгук!"
      successText="Він з'явиться на сторінці товару після перевірки модератором."
    >
      <div className="grid gap-1.5">
        <span className="text-sm font-medium text-ink-2">Ваша оцінка</span>
        <div
          role="radiogroup"
          aria-label="Ваша оцінка"
          className="flex items-center gap-1"
          onMouseLeave={() => setHover(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} з 5`}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onFocus={() => setHover(n)}
              onBlur={() => setHover(0)}
              className="grid size-9 place-content-center rounded-md transition-colors hover:bg-mist"
            >
              <Star
                aria-hidden
                className={cn("size-6 transition-colors", n <= shown ? "text-[#f2a100]" : "text-line")}
                fill="currentColor"
                strokeWidth={0}
              />
            </button>
          ))}
          <span className="tabular ml-2 text-sm font-medium text-ink-2">{rating}/5</span>
        </div>
      </div>
    </LeadForm>
  );
}
