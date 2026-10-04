import Image from "next/image";
import { CreditCard, Search, ShieldCheck, Truck, type LucideIcon } from "lucide-react";
import photoMechanic from "@/assets/brand/photo-mechanic.jpg";
import { SectionHeading } from "@/components/ui/SectionHeading";

interface Step {
  icon: LucideIcon;
  title: string;
  text: string;
}

const steps: Step[] = [
  {
    icon: Search,
    title: "Підбір",
    text: "Оберіть деталь за маркою й моделлю авто або знайдіть за артикулом, OE-номером чи VIN.",
  },
  {
    icon: ShieldCheck,
    title: "Перевірка сумісності за VIN",
    text: "Менеджер звіряє запчастину з вашим авто за VIN перед відправкою зі складу постачальника.",
  },
  {
    icon: CreditCard,
    title: "Оплата зручним способом",
    text: "Готівкою при отриманні, карткою онлайн, частинами або за рахунком для бізнесу.",
  },
  {
    icon: Truck,
    title: "Доставка за 1–3 дні",
    text: "Відправляємо Новою Поштою та Укрпоштою по всій Україні — товари в наявності їдуть за 1–3 дні.",
  },
];

/** «Як ми працюємо»: the real dropship flow as four numbered steps, with a workshop photo. */
export function HowItWorks() {
  return (
    <section className="bg-stripes-navy text-white">
      <div className="container-page py-10 lg:py-14">
        <SectionHeading
          as="h2"
          onDark
          title="Як ми працюємо"
          description="Прозорий шлях від вибору деталі до доставки — без зайвих кроків."
          className="mb-8"
        />

        <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
          <div className="relative mx-auto aspect-[322/290] w-full max-w-[322px] overflow-hidden rounded-card ring-1 ring-white/15 lg:mx-0">
            <Image
              src={photoMechanic}
              alt="Майстер AutoFlex перевіряє деталі в майстерні"
              fill
              placeholder="blur"
              sizes="322px"
              className="object-cover"
            />
            <span aria-hidden className="absolute inset-0 bg-linear-to-t from-navy-950/60 to-transparent" />
          </div>

          <ol className="grid gap-4 sm:grid-cols-2">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="relative flex flex-col rounded-card bg-white/5 p-5 ring-1 ring-white/10"
              >
                <div className="flex items-center gap-3">
                  <span className="display text-3xl text-brand-400">{String(index + 1).padStart(2, "0")}</span>
                  <step.icon aria-hidden className="size-5 text-brand-300" strokeWidth={1.75} />
                </div>
                <h3 className="mt-3 font-semibold text-white">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/70">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
