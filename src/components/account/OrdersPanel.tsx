"use client";

import Link from "next/link";
import { ChevronDown, CircleCheck, CreditCard, PackageSearch, Truck } from "lucide-react";
import { deliveryLabels, paymentLabels } from "@/components/checkout/options";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { countUk, formatDate, formatPrice } from "@/lib/format";
import { useAccount, type LocalOrder } from "@/lib/store";

export function OrdersPanel() {
  const { hydrated, orders } = useAccount();

  if (!hydrated) return <OrdersSkeleton />;

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<PackageSearch aria-hidden strokeWidth={1.75} />}
        title="Замовлень поки немає"
        text="Тут з'являться ваші замовлення, оформлені в цьому браузері. Оформіть перше — і зможете відстежувати його статус."
        action={
          <Link href="/catalog" className={buttonClass()}>
            Перейти до каталогу
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid gap-4">
      {orders.map((order) => (
        <OrderCard key={order.number} order={order} />
      ))}
    </div>
  );
}

function OrderCard({ order }: { order: LocalOrder }) {
  const { payload } = order;
  const itemCount = payload.items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <article className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line-soft p-4 sm:p-5">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="tabular text-[15px] font-bold text-ink">{order.number}</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2 py-0.5 text-xs font-semibold text-ok">
              <CircleCheck aria-hidden className="size-3.5" strokeWidth={2} />
              Прийнято
            </span>
          </div>
          <p className="mt-1 text-[13px] text-ink-3">
            від {formatDate(order.createdAt)} · {countUk(itemCount, ["товар", "товари", "товарів"])}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[13px] text-ink-3">Сума</p>
          <p className="tabular text-lg font-bold text-ink">{formatPrice(payload.total)}</p>
        </div>
      </header>

      <div className="grid gap-3 p-4 sm:p-5">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p className="flex items-start gap-2 text-ink-2">
            <Truck aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-700" strokeWidth={1.75} />
            <span>
              {deliveryLabels[payload.delivery.method]}
              <span className="block text-ink-3">
                {payload.delivery.city}, {payload.delivery.address}
              </span>
            </span>
          </p>
          <p className="flex items-start gap-2 text-ink-2">
            <CreditCard aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-700" strokeWidth={1.75} />
            <span>{paymentLabels[payload.payment]}</span>
          </p>
        </div>

        <details className="group rounded-btn border border-line-soft">
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-sm font-semibold text-ink">
            Склад замовлення
            <ChevronDown
              aria-hidden
              className="size-4 text-ink-3 transition-transform duration-200 group-open:rotate-180"
            />
          </summary>
          <ul className="divide-y divide-line-soft border-t border-line-soft">
            {payload.items.map((item) => (
              <li key={item.key} className="flex items-start justify-between gap-3 px-3.5 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{item.name}</p>
                  {item.optionLabel && <p className="text-[13px] text-ink-3">{item.optionLabel}</p>}
                  <p className="tabular text-[13px] text-ink-3">
                    арт. {item.sku} · {item.qty} × {formatPrice(item.price)}
                  </p>
                </div>
                <span className="tabular shrink-0 font-semibold text-ink">{formatPrice(item.price * item.qty)}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </article>
  );
}

function OrdersSkeleton() {
  return (
    <div className="grid gap-4" aria-hidden>
      {[0, 1].map((i) => (
        <div key={i} className="card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-mist" />
              <div className="h-3 w-40 animate-pulse rounded bg-mist" />
            </div>
            <div className="h-6 w-20 animate-pulse rounded bg-mist" />
          </div>
          <div className="mt-4 h-10 w-full animate-pulse rounded-btn bg-mist" />
        </div>
      ))}
    </div>
  );
}
