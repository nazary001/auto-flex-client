import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleCheckBig, Info, PackageSearch, PhoneCall, Truck } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Замовлення прийнято",
  description: "Дякуємо за замовлення в AutoFlex. Менеджер перевірить наявність і сумісність та зв'яжеться для підтвердження.",
  alternates: { canonical: "/checkout/success" },
  robots: { index: false, follow: false },
};

const steps = [
  {
    icon: PackageSearch,
    title: "Перевірка наявності та сумісності",
    text: "Менеджер перевірить, що запчастини є на складі постачальника та підходять вашому авто.",
  },
  {
    icon: PhoneCall,
    title: "Підтвердження замовлення",
    text: "Зв'яжемося з вами, щоб підтвердити деталі — крім випадку, коли ви відмовились від дзвінка.",
  },
  {
    icon: Truck,
    title: "Відправлення і номер ТТН",
    text: "Після відправлення надішлемо номер ТТН, щоб ви могли відстежувати посилку.",
  },
];

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).order;
  const orderParam = Array.isArray(raw) ? raw[0] : raw;
  const orderNumber = orderParam && /^AF-\d{6}-\d{3,5}$/.test(orderParam) ? orderParam : null;

  if (!orderNumber) {
    return (
      <div className="container-page py-10 pb-24 lg:py-16 lg:pb-16">
        <div className="mx-auto grid max-w-xl justify-items-center gap-5 text-center">
          <span className="grid size-14 place-content-center rounded-full bg-mist text-ink-3">
            <Info aria-hidden className="size-7" strokeWidth={1.75} />
          </span>
          <div className="grid gap-2">
            <h1 className="page-title">Немає даних про замовлення</h1>
            <p className="lead mx-auto">
              Сторінку відкрито без номера замовлення. Якщо ви щойно оформили замовлення, перевірте його в кабінеті або
              напишіть нам — підкажемо статус.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/catalog" className={buttonClass()}>
              Перейти до каталогу
            </Link>
            <Link href="/account" className={buttonClass({ variant: "secondary" })}>
              Мої замовлення
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-10 pb-24 lg:py-16 lg:pb-16">
      <div className="mx-auto max-w-2xl">
        <div className="grid justify-items-center gap-4 text-center">
          <span className="grid size-16 place-content-center rounded-full bg-ok-soft text-ok">
            <CircleCheckBig aria-hidden className="size-9" strokeWidth={1.75} />
          </span>
          <h1 className="page-title">Дякуємо! Замовлення прийнято</h1>
          <p className="lead mx-auto">
            Ми отримали ваше замовлення та вже беремося за нього. Збережіть номер — за ним зручно уточнювати статус.
          </p>
          <p className="inline-flex items-center gap-2 rounded-btn border border-line-soft bg-mist-soft px-4 py-2.5">
            <span className="text-sm text-ink-3">Номер замовлення</span>
            <span className="tabular text-lg font-bold text-ink">{orderNumber}</span>
          </p>
        </div>

        <div className="card mt-8 p-5 sm:p-7">
          <h2 className="text-lg font-bold text-ink">Що буде далі</h2>
          <ol className="mt-5 grid gap-5">
            {steps.map(({ icon: Icon, title, text }, index) => (
              <li key={title} className="flex gap-4">
                <span className="relative grid size-10 shrink-0 place-content-center rounded-full bg-brand-50 text-brand-700">
                  <Icon aria-hidden className="size-5" strokeWidth={1.75} />
                  <span className="tabular absolute -top-1 -right-1 grid size-5 place-content-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
                    {index + 1}
                  </span>
                </span>
                <div className="pt-0.5">
                  <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
                  <p className="mt-0.5 text-sm text-ink-3">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/account" className={buttonClass({ size: "lg" })}>
            Переглянути в кабінеті
            <ArrowRight aria-hidden className="size-[18px]" />
          </Link>
          <Link href="/catalog" className={buttonClass({ variant: "secondary", size: "lg" })}>
            Продовжити покупки
          </Link>
        </div>

        <p className="mt-6 text-center text-sm text-ink-3">
          Виникли питання?{" "}
          <a href={site.phone.href} className="link font-medium">
            {site.phone.label}
          </a>
        </p>
      </div>
    </div>
  );
}
