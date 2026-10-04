import Link from "next/link";
import { Clock, Phone, User } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { SocialIcon } from "@/components/icons";
import { getCategoryProductCount, getMakes, getSubcategories, getTopCategories } from "@/lib/catalog";
import { site, topNav } from "@/lib/site";
import { BackToTop } from "./BackToTop";
import { BottomTabBar } from "./BottomTabBar";
import { CallbackButton } from "./CallbackButton";
import { CartLink } from "./CartLink";
import { CatalogMenu } from "./CatalogMenu";
import { FavoritesLink } from "./FavoritesLink";
import { HeaderSearch } from "./HeaderSearch";
import { MiniCart } from "./MiniCart";
import { MobileNav } from "./MobileNav";
import type { NavData } from "./nav-data";

/** Reads the catalog on the server and hands plain data to the client islands. */
function getNavData(): NavData {
  const groups = getTopCategories().map((group) => ({
    slug: group.slug,
    name: group.name,
    icon: group.icon,
    illustration: group.illustration,
    description: group.description,
    count: getCategoryProductCount(group.id),
    subs: getSubcategories(group.id).map((sub) => ({ slug: sub.slug, name: sub.name })),
  }));
  const popularMakes = getMakes()
    .filter((make) => make.popular)
    .map((make) => ({ slug: make.slug, name: make.name }));
  return { groups, popularMakes };
}

export function Header() {
  const nav = getNavData();

  return (
    <>
      {/* Top utility bar — desktop only */}
      <div className="hidden border-b border-navy-800 bg-navy-900 text-white/70 lg:block">
        <div className="container-page flex h-9 items-center justify-between gap-6 text-[13px]">
          <nav aria-label="Інформація для покупців">
            <ul className="flex items-center gap-5">
              {topNav.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <Clock aria-hidden className="size-3.5 text-brand-400" strokeWidth={2} />
              {site.scheduleShort}
            </span>
            <span aria-hidden className="h-3.5 w-px bg-white/20" />
            <div className="flex items-center gap-0.5">
              <a
                href={site.socials.telegram}
                target="_blank"
                rel="noreferrer"
                aria-label="Ми в Telegram"
                className="grid size-7 place-content-center rounded-full transition-colors hover:bg-white/10 hover:text-white"
              >
                <SocialIcon name="telegram" className="size-[18px]" />
              </a>
              <a
                href={site.socials.viber}
                aria-label="Ми у Viber"
                className="grid size-7 place-content-center rounded-full transition-colors hover:bg-white/10 hover:text-white"
              >
                <SocialIcon name="viber" className="size-[18px]" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Main header — sticky */}
      <header className="sticky top-0 z-40 border-b border-line-soft bg-white">
        {/* Desktop */}
        <div className="container-page hidden lg:block">
          <div className="relative flex h-[76px] items-center gap-4 xl:gap-6">
            <Link href="/" aria-label="AutoFlex — на головну" className="shrink-0">
              <Logo className="h-8 w-auto" />
            </Link>

            <CatalogMenu data={nav} />

            <HeaderSearch instanceId="desktop" className="min-w-0 flex-1" />

            <div className="hidden shrink-0 xl:block">
              <a
                href={site.phone.href}
                className="flex items-center gap-1.5 text-[15px] font-bold whitespace-nowrap text-ink transition-colors hover:text-brand-700"
              >
                <Phone aria-hidden className="size-4 text-brand-700" strokeWidth={2} />
                <span className="tabular">{site.phone.label}</span>
              </a>
              <CallbackButton className="mt-0.5 ml-[1.5rem] block text-[13px] font-medium text-brand-600 transition-colors hover:text-brand-800 hover:underline">
                Замовити дзвінок
              </CallbackButton>
            </div>

            <span aria-hidden className="hidden h-10 w-px bg-line-soft xl:block" />

            <nav aria-label="Акаунт" className="flex shrink-0 items-center gap-1">
              <Link
                href="/account"
                className="group flex w-[4.25rem] flex-col items-center gap-1 rounded-btn px-1 py-1.5 text-[11px] font-medium text-ink-2 transition-colors hover:bg-mist hover:text-brand-700"
              >
                <User aria-hidden className="size-6" strokeWidth={1.75} />
                Кабінет
              </Link>
              <FavoritesLink />
              <MiniCart />
            </nav>
          </div>
        </div>

        {/* Mobile */}
        <div className="container-page lg:hidden">
          <div className="flex h-14 items-center gap-2">
            <MobileNav data={nav} />
            <Link href="/" aria-label="AutoFlex — на головну" className="mr-auto shrink-0">
              <Logo className="h-7 w-auto" />
            </Link>
            <a
              href={site.phone.href}
              aria-label={`Зателефонувати: ${site.phone.label}`}
              className="grid size-10 place-content-center rounded-full text-ink transition-colors hover:bg-mist hover:text-brand-700"
            >
              <Phone aria-hidden className="size-6" strokeWidth={1.75} />
            </a>
            <CartLink />
          </div>
          <div className="pb-3">
            <HeaderSearch instanceId="mobile" />
          </div>
        </div>
      </header>

      <BottomTabBar />
      <BackToTop />
    </>
  );
}
