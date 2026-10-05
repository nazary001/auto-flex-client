import Link from "next/link";
import { CarFront, House, Package, Search } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Button, buttonClass } from "@/components/ui/Button";

/**
 * Branded 404 — shown for any unmatched URL. Renders the storefront chrome itself
 * because the root layout carries no header or footer (the admin shares it).
 */
export default async function NotFound() {

  return (
    <>
      <Header />
      <main id="main" className="flex-1">
        <div className="container-page py-10 lg:py-16">
          <section className="bg-stripes-navy relative isolate overflow-hidden rounded-card px-6 py-14 text-center text-white sm:px-10 sm:py-20">
            <span aria-hidden className="halftone absolute -top-10 -right-6 -z-10 size-64 text-brand-400" />
            <span aria-hidden className="halftone absolute -bottom-12 -left-8 -z-10 size-56 text-brand-600" />

            <p className="display text-[clamp(4rem,15vw,7.5rem)] leading-none text-white">404</p>
            <h1 className="mt-4 text-2xl font-bold sm:text-3xl">Сторінку не знайдено</h1>
            <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-white/70 sm:text-base">
              Можливо, адресу введено з помилкою або сторінку переміщено. Спробуйте знайти потрібну запчастину через
              пошук або перейдіть до каталогу.
            </p>

            <form action="/search" method="get" className="mx-auto mt-7 flex max-w-md gap-2" role="search">
              <label htmlFor="nf-search" className="sr-only">
                Пошук товарів
              </label>
              <div className="relative flex-1">
                <Search
                  aria-hidden
                  className="absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-ink-3"
                  strokeWidth={1.75}
                />
                <input
                  id="nf-search"
                  name="q"
                  type="search"
                  placeholder="Пошук по артикулу, бренду або назві"
                  className="field pl-10"
                />
              </div>
              <Button type="submit">Пошук</Button>
            </form>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link href="/catalog" className={buttonClass({ variant: "light" })}>
                <Package aria-hidden className="size-[18px]" strokeWidth={1.75} />
                До каталогу
              </Link>
              <Link
                href="/avto"
                className="btn text-white ring-1 ring-white/35 transition-colors ring-inset hover:bg-white/10"
              >
                <CarFront aria-hidden className="size-[18px]" strokeWidth={1.75} />
                Підбір за авто
              </Link>
              <Link href="/" className="btn text-white ring-1 ring-white/35 transition-colors ring-inset hover:bg-white/10">
                <House aria-hidden className="size-[18px]" strokeWidth={1.75} />
                На головну
              </Link>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
