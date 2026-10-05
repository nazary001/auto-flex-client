import type { Metadata } from "next";
import { Clock, Mail, PhoneCall, Truck } from "lucide-react";
import { SocialIcon, type SocialName } from "@/components/icons";
import { InfoCallout, InfoHeader, InfoSection, SellerDetails } from "@/components/info/InfoContent";
import { LeadForm } from "@/components/forms/LeadForm";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Контакти",
  description:
    "Зв’язатися з AutoFlex: телефон, електронна пошта, месенджери та графік роботи. Магазин працює онлайн і відправляє автоаксесуари по всій Україні.",
  alternates: { canonical: "/kontakty" },
};

const phoneNumber = site.phone.href.replace("tel:", "");

const messengers: { name: SocialName; label: string; href: string }[] = [
  { name: "telegram", label: "Telegram", href: site.socials.telegram },
  { name: "viber", label: "Viber", href: site.socials.viber },
  { name: "instagram", label: "Instagram", href: site.socials.instagram },
  { name: "facebook", label: "Facebook", href: site.socials.facebook },
];

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    url: site.url,
    email: site.email,
    telephone: phoneNumber,
    address: { "@type": "PostalAddress", addressCountry: "UA" },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: phoneNumber,
      email: site.email,
      contactType: "customer service",
      areaServed: "UA",
      availableLanguage: "uk",
    },
    sameAs: [site.socials.telegram, site.socials.instagram, site.socials.facebook],
  },
  {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: `Контакти — ${site.name}`,
    url: `${site.url}/kontakty`,
  },
];

export default function KontaktyPage() {
  return (
    <article className="space-y-10 lg:space-y-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <InfoHeader
        title="Контакти"
        lead="Зателефонуйте, напишіть на пошту або в месенджер — допоможемо з підбором, наявністю та оформленням замовлення."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-10">
        <section aria-label="Способи зв’язку" className="card divide-y divide-line-soft">
          <div className="flex items-start gap-3.5 p-5">
            <PhoneCall aria-hidden className="mt-0.5 size-5 shrink-0 text-brand-700" strokeWidth={1.75} />
            <div className="min-w-0">
              <p className="text-sm text-ink-3">Телефон</p>
              <a href={site.phone.href} className="link text-lg font-semibold">
                {site.phone.label}
              </a>
              <p className="mt-0.5 text-sm text-ink-3">{site.scheduleShort}</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-5">
            <Mail aria-hidden className="mt-0.5 size-5 shrink-0 text-brand-700" strokeWidth={1.75} />
            <div className="min-w-0">
              <p className="text-sm text-ink-3">Електронна пошта</p>
              <a href={`mailto:${site.email}`} className="link font-semibold break-all">
                {site.email}
              </a>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-5">
            <SocialIcon name="telegram" aria-hidden className="mt-0.5 size-5 shrink-0 text-brand-700" />
            <div className="min-w-0">
              <p className="text-sm text-ink-3">Месенджери та соцмережі</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {messengers.map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={item.label}
                    className="inline-flex size-11 items-center justify-center rounded-btn border border-line-soft text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-50 [&>svg]:size-5"
                  >
                    <SocialIcon name={item.name} />
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-5">
            <Clock aria-hidden className="mt-0.5 size-5 shrink-0 text-brand-700" strokeWidth={1.75} />
            <div className="min-w-0">
              <p className="text-sm text-ink-3">Графік роботи</p>
              <dl className="mt-1.5 grid gap-1 text-[15px]">
                {site.schedule.map((row) => (
                  <div key={row.days} className="flex gap-2">
                    <dt className="w-16 shrink-0 text-ink-3">{row.days}</dt>
                    <dd className="font-medium text-ink">{row.hours}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section aria-label="Форма зв’язку" className="card p-5 sm:p-6">
          <h2 className="text-lg font-bold text-ink">Напишіть нам</h2>
          <p className="mt-1 text-sm text-ink-3">Залиште повідомлення — відповімо в робочі години.</p>
          <LeadForm
            className="mt-4"
            kind="question"
            name="optional"
            comment="required"
            commentPrefix="Контактна форма"
            commentLabel="Повідомлення"
            commentPlaceholder="Ваше запитання, назва товару або артикул"
            submitLabel="Надіслати повідомлення"
            successTitle="Повідомлення надіслано"
            successText="Дякуємо! Ми відповімо найближчим часом у робочі години."
          />
        </section>
      </div>

      <InfoCallout icon={<Truck aria-hidden strokeWidth={1.75} />} title="Ми працюємо онлайн">
        AutoFlex не має фізичного магазину й самовивозу. Замовлення відправляємо зі складу постачальника по всій
        Україні Новою Поштою та Укрпоштою.
      </InfoCallout>

      <InfoSection id="rekvizyty" title="Реквізити продавця">
        <SellerDetails />
      </InfoSection>
    </article>
  );
}
