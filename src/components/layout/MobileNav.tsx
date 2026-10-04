"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";
import { BadgePercent, CarFront, ChevronDown, Clock, Factory, Mail, Menu, Newspaper, Phone } from "lucide-react";
import { CategoryIcon, SocialIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { site, topNav } from "@/lib/site";
import type { NavData } from "./nav-data";
import { CallbackButton } from "./CallbackButton";

const primaryLinks = [
  { href: "/avto", label: "Підбір за маркою авто", icon: CarFront },
  { href: "/brands", label: "Виробники запчастин", icon: Factory },
  { href: "/aktsii", label: "Акції та знижки", icon: BadgePercent },
  { href: "/blog", label: "Блог", icon: Newspaper },
] as const;

export function MobileNav({ data }: { data: NavData }) {
  const [open, setOpen] = useState(false);
  const { groups } = data;

  // Close the drawer whenever a link is activated (navigation)
  function onContentClick(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("a")) setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        aria-label="Відкрити меню"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="-ml-1.5 grid size-10 shrink-0 place-content-center rounded-full text-ink transition-colors hover:bg-mist hover:text-brand-700"
      >
        <Menu aria-hidden className="size-6" strokeWidth={1.75} />
      </button>

      <Drawer open={open} onClose={() => setOpen(false)} title="Меню" side="left">
        <div onClick={onContentClick}>
          {/* Catalog */}
          <p className="px-4 pt-3 pb-1 text-xs font-semibold tracking-wide text-ink-3">Каталог товарів</p>
          <ul className="divide-y divide-line-soft border-y border-line-soft">
            {groups.map((group) => (
              <li key={group.slug}>
                <details className="group/acc">
                  <summary className="flex items-center gap-3 px-4 py-3 text-[15px] font-medium text-ink transition-colors hover:text-brand-700">
                    <CategoryIcon name={group.icon} className="size-5 shrink-0 text-brand-700" />
                    <span className="min-w-0 flex-1 truncate">{group.name}</span>
                    <ChevronDown
                      aria-hidden
                      className="size-4 shrink-0 text-ink-3 transition-transform duration-200 group-open/acc:rotate-180"
                    />
                  </summary>
                  <ul className="grid gap-0.5 bg-mist-soft px-2 py-2">
                    <li>
                      <Link
                        href={`/catalog/${group.slug}`}
                        className="block rounded-md px-3 py-2 text-sm font-semibold text-brand-700 transition-colors hover:bg-white"
                      >
                        Усі товари групи
                      </Link>
                    </li>
                    {group.subs.map((sub) => (
                      <li key={sub.slug}>
                        <Link
                          href={`/catalog/${sub.slug}`}
                          className="block rounded-md px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-white hover:text-brand-700"
                        >
                          {sub.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>

          {/* Primary navigation */}
          <ul className="border-b border-line-soft py-1.5">
            {primaryLinks.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex items-center gap-3 px-4 py-2.5 text-[15px] font-medium text-ink transition-colors hover:text-brand-700"
                >
                  <Icon aria-hidden className="size-5 shrink-0 text-brand-700" strokeWidth={1.75} />
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Info links */}
          <p className="px-4 pt-3 pb-1 text-xs font-semibold tracking-wide text-ink-3">Інформація</p>
          <ul className="pb-2">
            {topNav.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block px-4 py-2 text-sm text-ink-2 transition-colors hover:text-brand-700"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Contacts */}
          <div className="border-t border-line-soft bg-mist-soft px-4 py-4">
            <a href={site.phone.href} className="flex items-center gap-2 text-lg font-bold text-ink">
              <Phone aria-hidden className="size-5 text-brand-700" strokeWidth={1.75} />
              <span className="tabular">{site.phone.label}</span>
            </a>

            <CallbackButton className={buttonClass({ variant: "secondary", block: true, className: "mt-3" })}>
              Замовити дзвінок
            </CallbackButton>

            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={site.socials.telegram}
                target="_blank"
                rel="noreferrer"
                aria-label="Telegram"
                className="grid size-10 place-content-center rounded-full bg-white text-brand-700 ring-1 ring-line-soft transition-colors hover:bg-brand-50"
              >
                <SocialIcon name="telegram" className="size-5" />
              </a>
              <a
                href={site.socials.viber}
                aria-label="Viber"
                className="grid size-10 place-content-center rounded-full bg-white text-brand-700 ring-1 ring-line-soft transition-colors hover:bg-brand-50"
              >
                <SocialIcon name="viber" className="size-5" />
              </a>
              <a
                href={site.socials.instagram}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="grid size-10 place-content-center rounded-full bg-white text-brand-700 ring-1 ring-line-soft transition-colors hover:bg-brand-50"
              >
                <SocialIcon name="instagram" className="size-5" />
              </a>
            </div>

            <a
              href={`mailto:${site.email}`}
              className="mt-3 flex items-center gap-2 text-sm text-ink-2 transition-colors hover:text-brand-700"
            >
              <Mail aria-hidden className="size-4 text-brand-700" strokeWidth={1.75} />
              {site.email}
            </a>

            <div className="mt-3 flex items-start gap-2 text-sm text-ink-3">
              <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-700" strokeWidth={1.75} />
              <ul className="grid gap-0.5">
                {site.schedule.map((row) => (
                  <li key={row.days} className="flex gap-1.5">
                    <span className="min-w-[2.75rem] font-medium text-ink-2">{row.days}</span>
                    <span>{row.hours}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Drawer>
    </>
  );
}
