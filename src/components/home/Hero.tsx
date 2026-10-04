import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CarFront } from "lucide-react";
import heroCar from "@/assets/brand/hero-car.jpg";
import { VehicleSelector, type SelectorMake } from "@/components/catalog/VehicleSelector";
import { buttonClass } from "@/components/ui/Button";
import { countUk } from "@/lib/format";

interface HeroProps {
  makes: SelectorMake[];
  categories: { slug: string; name: string }[];
  productCount: number;
  makeCount: number;
  brandCount: number;
}

/**
 * Full-bleed navy hero in the spirit of the brandbook cover: the display headline on the left,
 * the car photo bleeding off the right edge, and a white vehicle-selector card overlapping the
 * bottom edge.
 */
export function Hero({ makes, categories, productCount, makeCount, brandCount }: HeroProps) {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-navy-950 text-white">
        {/* Car photo bleeding off the right edge, masked into the navy */}
        <div aria-hidden className="absolute inset-0 lg:left-[32%]">
          <Image
            src={heroCar}
            alt=""
            fill
            preload
            placeholder="blur"
            sizes="(min-width: 1024px) 70vw, 100vw"
            className="object-cover object-[68%_center] lg:object-[60%_center]"
          />
          {/* left → right navy fade so the headline stays readable over the photo */}
          <div className="absolute inset-0 bg-linear-to-r from-navy-950 from-20% via-navy-950/75 via-55% to-navy-950/25 lg:via-navy-950/55 lg:via-45% lg:to-transparent" />
          {/* bottom fade so the photo melts into the overlapping card */}
          <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-navy-950 to-transparent" />
        </div>

        {/* one subtle brand graphic */}
        <span
          aria-hidden
          className="halftone absolute top-0 left-0 size-72 rotate-180 text-brand-400/30 max-sm:hidden"
        />

        <div className="container-page relative z-10 pt-12 pb-28 sm:pt-16 sm:pb-32 lg:pt-24 lg:pb-36">
          <div className="max-w-xl lg:max-w-2xl">
            <h1 className="display text-[2.1rem] leading-[1.05] text-white sm:text-5xl lg:text-6xl">
              Надійні автозапчастини для вашого авто
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/80 sm:text-lg">
              {countUk(productCount, ["товар", "товари", "товарів"])} для{" "}
              {countUk(makeCount, ["марки", "марок", "марок"])} авто від{" "}
              {countUk(brandCount, ["перевіреного бренду", "перевірених брендів", "перевірених брендів"])} — з перевіркою
              сумісності за VIN і доставкою по Україні за <span className="whitespace-nowrap">1–3 дні</span>.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/catalog" className={buttonClass({ size: "lg", className: "max-sm:btn-block" })}>
                Перейти до каталогу
                <ArrowRight aria-hidden className="size-[18px]" />
              </Link>
              <Link
                href="/avto"
                className="btn btn-lg max-sm:btn-block text-white ring-1 ring-inset ring-white/35 transition-colors hover:bg-white/10"
              >
                <CarFront aria-hidden className="size-[18px]" />
                Підібрати за авто
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Vehicle selector card overlapping the hero's bottom edge */}
      <div className="container-page relative z-20 -mt-20 sm:-mt-24">
        <div className="rounded-card bg-white p-5 shadow-pop ring-1 ring-navy-950/5 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-ink">
            <CarFront aria-hidden className="size-5 text-brand-700" strokeWidth={1.75} />
            Підбір запчастин за авто
          </h2>
          <VehicleSelector makes={makes} categories={categories} variant="hero" />
        </div>
      </div>
    </>
  );
}
