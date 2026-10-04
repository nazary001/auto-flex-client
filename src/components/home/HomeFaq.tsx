import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Accordion, type AccordionItem } from "@/components/ui/Accordion";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { FaqItem } from "@/lib/types";

/** Home FAQ accordion. The matching FAQPage JSON-LD is emitted by the page. */
export function HomeFaq({ items }: { items: FaqItem[] }) {
  if (items.length === 0) return null;

  const accordionItems: AccordionItem[] = items.map((item) => ({ title: item.question, content: item.answer }));

  return (
    <section className="container-page py-10 lg:py-14">
      <div className="grid gap-8 lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-12">
        <div>
          <SectionHeading
            as="h2"
            title="Поширені запитання"
            description="Коротко про підбір, оплату, доставку та гарантію. Не знайшли відповідь — напишіть нам."
          />
          <Link href="/kontakty" className="group mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-800">
            Поставити запитання
            <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        <Accordion items={accordionItems} name="home-faq" />
      </div>
    </section>
  );
}
