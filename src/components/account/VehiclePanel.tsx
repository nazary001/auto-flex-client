"use client";

import Link from "next/link";
import { ArrowRight, Car, X } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useVehicle } from "@/lib/store";

export function VehiclePanel() {
  const { hydrated, vehicle, setVehicle } = useVehicle();

  if (!hydrated) return <div className="h-28 max-w-xl animate-pulse rounded-card bg-mist" aria-hidden />;

  if (!vehicle) {
    return (
      <EmptyState
        icon={<Car aria-hidden strokeWidth={1.75} />}
        title="Авто ще не обрано"
        text="Оберіть марку та модель авто — ми показуватимемо лише сумісні запчастини та підставимо авто в замовлення."
        action={
          <Link href="/avto" className={buttonClass()}>
            Обрати авто
          </Link>
        }
      />
    );
  }

  const href = vehicle.modelSlug ? `/avto/${vehicle.makeSlug}/${vehicle.modelSlug}` : `/avto/${vehicle.makeSlug}`;

  return (
    <div className="max-w-xl">
      <p className="text-[15px] text-ink-3">
        Обране авто. За ним ми фільтруємо сумісні запчастини та перевіряємо замовлення перед відправкою.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-4 rounded-card border border-line-soft bg-mist-soft p-4 sm:p-5">
        <span className="grid size-12 shrink-0 place-content-center rounded-full bg-white text-brand-700 shadow-card">
          <Car aria-hidden className="size-6" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-3">Моє авто</p>
          <p className="text-lg font-bold text-ink">{vehicle.label}</p>
        </div>
        <Link href={href} className={buttonClass({ variant: "secondary", size: "sm" })}>
          Перейти до запчастин
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>

      <button
        type="button"
        onClick={() => setVehicle(null)}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-3 transition-colors hover:text-danger"
      >
        <X aria-hidden className="size-4" strokeWidth={2} />
        Прибрати авто
      </button>
    </div>
  );
}
