import Image from "next/image";
import Link from "next/link";
import { SpeedStripes } from "@/components/brand/Graphics";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { Promo } from "@/lib/types";

const tones = {
  navy: {
    box: "bg-stripes-navy text-white",
    period: "bg-white/10 text-white",
    text: "text-white/75",
    button: "light",
    dots: "text-brand-400",
  },
  blue: {
    box: "bg-linear-to-br from-brand-600 to-brand-800 text-white",
    period: "bg-white/15 text-white",
    text: "text-white/80",
    button: "light",
    dots: "text-white/70",
  },
  light: {
    box: "bg-stripes-light text-ink",
    period: "bg-white text-brand-700",
    text: "text-ink-2",
    button: "primary",
    dots: "text-brand-300",
  },
} as const;

interface PromoBannerProps {
  promo: Promo;
  /** "wide" — full-width strip; "tile" — compact card for 2–3 column rows */
  variant?: "wide" | "tile";
  className?: string;
}

/** Promotion banner in one of the three brand surfaces (navy stripes / blue / light stripes) */
export function PromoBanner({ promo, variant = "tile", className }: PromoBannerProps) {
  const tone = tones[promo.tone];
  const wide = variant === "wide";

  return (
    <article
      className={cn(
        "group relative isolate flex overflow-hidden rounded-card",
        wide ? "min-h-56 items-center p-6 sm:p-9 lg:p-11" : "min-h-52 p-6",
        tone.box,
        className,
      )}
    >
      <span aria-hidden className={cn("halftone absolute right-0 bottom-0 -z-10 size-56", tone.dots)} />
      {promo.tone === "light" && (
        <SpeedStripes className="absolute right-0 bottom-0 -z-10 h-24 w-1/2 opacity-90 max-sm:hidden" />
      )}

      <div className={cn("flex min-w-0 flex-1 flex-col items-start", wide ? "max-w-xl" : "max-w-[62%]")}>
        <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", tone.period)}>{promo.period}</span>
        <h3 className={cn("display mt-3", wide ? "text-3xl sm:text-4xl" : "text-2xl")}>{promo.title}</h3>
        <p className={cn("mt-2 text-[15px]", tone.text, !wide && "line-clamp-3")}>{promo.text}</p>
        <div className="mt-auto pt-5">
          <Link
            href={promo.href}
            className={buttonClass({
              variant: tone.button,
              size: wide ? "md" : "sm",
              className: "after:absolute after:inset-0",
            })}
          >
            {promo.cta}
          </Link>
        </div>
      </div>

      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full bg-white/95 shadow-[0_10px_40px_-10px_rgb(0_8_28/0.5)]",
          wide ? "right-6 size-44 sm:right-10 sm:size-52 lg:right-16 max-sm:hidden" : "-right-6 size-40",
        )}
      >
        <Image
          src={`/illustrations/${promo.illustration}.svg`}
          alt=""
          fill
          unoptimized
          className="object-contain p-5 transition-transform duration-500 ease-out group-hover:scale-110 group-hover:-rotate-6"
        />
      </div>
    </article>
  );
}
