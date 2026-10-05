import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { deliveryOptions, paymentOptions } from "@/components/checkout/options";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { getDb } from "@/lib/server/db/client";
import { getSettings } from "@/lib/server/db/repos/settings";
import type { DeliveryMethod, PaymentMethod } from "@/lib/types";

export const metadata: Metadata = {
  title: "Оформлення замовлення",
  description:
    "Оформлення замовлення в AutoFlex: контактні дані, доставка Новою Поштою або Укрпоштою, оплата та перевірка сумісності за VIN.",
  alternates: { canonical: "/checkout" },
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  let deliveryMethods: DeliveryMethod[] | undefined;
  let paymentMethods: PaymentMethod[] | undefined;
  let methodNotes: Partial<Record<string, string>> | undefined;

  try {
    const settings = await getSettings(await getDb());
    deliveryMethods = deliveryOptions
      .map((option) => option.value)
      .filter((method) => settings.checkout.delivery[method]?.enabled);
    paymentMethods = paymentOptions
      .map((option) => option.value)
      .filter((method) => settings.checkout.payment[method]?.enabled);

    const notes: Record<string, string> = {};
    for (const [method, setting] of Object.entries(settings.checkout.delivery)) {
      if (setting.enabled && setting.note?.trim()) notes[method] = setting.note;
    }
    for (const [method, setting] of Object.entries(settings.checkout.payment)) {
      if (setting.enabled && setting.note?.trim()) notes[method] = setting.note;
    }
    methodNotes = notes;
  } catch {
    // Database unreachable — render the form with every delivery and payment method enabled.
  }

  return (
    <div className="container-page py-6 pb-24 lg:py-10 lg:pb-14">
      <Breadcrumbs items={[{ label: "Кошик", href: "/cart" }, { label: "Оформлення замовлення" }]} />
      <h1 className="page-title mt-4">Оформлення замовлення</h1>
      <p className="lead mt-2">
        Заповніть дані для доставки — менеджер перевірить наявність і сумісність, після чого підтвердить замовлення.
      </p>
      <CheckoutForm deliveryMethods={deliveryMethods} paymentMethods={paymentMethods} methodNotes={methodNotes} />
    </div>
  );
}
