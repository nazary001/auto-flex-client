import Link from "next/link";
import { Clock, Mail, Phone } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { BenefitIcon, SocialIcon } from "@/components/icons";
import { benefits, footerNav, site } from "@/lib/site";
import { CallbackButton } from "./CallbackButton";

const socialLinks = [
  { name: "telegram", href: site.socials.telegram, label: "Telegram", external: true },
  { name: "viber", href: site.socials.viber, label: "Viber", external: false },
  { name: "instagram", href: site.socials.instagram, label: "Instagram", external: true },
  { name: "facebook", href: site.socials.facebook, label: "Facebook", external: true },
] as const;

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-stripes-navy text-white/70">
      {/* Trust strip */}
      <div className="border-b border-white/10">
        <ul className="container-page grid grid-cols-2 gap-x-6 gap-y-6 py-7 lg:grid-cols-4 lg:py-8">
          {benefits.map((item) => (
            <li key={item.title} className="flex items-center gap-3.5">
              <span className="grid size-11 shrink-0 place-content-center rounded-full bg-white/5 text-brand-400 ring-1 ring-white/10">
                <BenefitIcon name={item.icon} className="size-6" />
              </span>
              <p className="min-w-0 leading-tight">
                <span className="block text-sm font-semibold text-white">{item.title}</span>
                <span className="mt-0.5 block text-[13px] text-white/55">{item.text}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* Main */}
      <div className="container-page grid gap-10 py-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr] lg:gap-8 lg:py-12">
        {/* Brand column */}
        <div className="sm:col-span-2 lg:col-span-1">
          <Logo variant="dark" className="h-8 w-auto" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
            {site.tagline}. Доставка по всій Україні, перевірка сумісності за VIN перед відправкою зі складів
            постачальників.
          </p>

          <a
            href={site.phone.href}
            className="mt-5 flex items-center gap-2 text-lg font-bold text-white transition-colors hover:text-brand-300"
          >
            <Phone aria-hidden className="size-5 text-brand-400" strokeWidth={2} />
            <span className="tabular">{site.phone.label}</span>
          </a>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <CallbackButton className="inline-flex h-9 items-center gap-2 rounded-btn border border-white/20 px-3.5 text-sm font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/10">
              Замовити дзвінок
            </CallbackButton>
            <a
              href={`mailto:${site.email}`}
              className="inline-flex items-center gap-2 text-sm text-white/70 transition-colors hover:text-white"
            >
              <Mail aria-hidden className="size-4 text-brand-400" strokeWidth={1.75} />
              {site.email}
            </a>
          </div>

          <div className="mt-4 flex items-start gap-2 text-[13px] text-white/60">
            <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-400" strokeWidth={1.75} />
            <ul className="grid gap-0.5">
              {site.schedule.map((row) => (
                <li key={row.days} className="flex gap-2">
                  <span className="min-w-[2.75rem] font-medium text-white/75">{row.days}</span>
                  <span>{row.hours}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {socialLinks.map((social) => (
              <a
                key={social.name}
                href={social.href}
                aria-label={social.label}
                {...(social.external ? { target: "_blank", rel: "noreferrer" } : {})}
                className="grid size-9 place-content-center rounded-full bg-white/5 text-white/80 ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-white"
              >
                <SocialIcon name={social.name} className="size-[18px]" />
              </a>
            ))}
          </div>
        </div>

        {/* Navigation columns */}
        {footerNav.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="text-sm font-semibold text-white">{column.title}</h2>
            <ul className="mt-4 grid gap-2.5 text-sm">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-white/60 transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2.5 py-5 text-[13px] text-white/55 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <p>
            © {year} {site.name}. Всі права захищені.
          </p>
          <p className="lg:order-last">
            <a href={site.url} className="font-semibold text-brand-400 transition-colors hover:text-brand-300">
              {site.domainLabel}
            </a>
          </p>
          <p>Оплата: при отриманні, карткою, частинами, за рахунком.</p>
        </div>
      </div>

      {/* Clearance for the fixed mobile tab bar */}
      <div aria-hidden className="lg:hidden" style={{ height: "calc(4rem + env(safe-area-inset-bottom))" }} />
    </footer>
  );
}
