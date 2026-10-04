"use client";

import { CarFront, Check } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { toast, useVehicle } from "@/lib/store";

interface RememberVehicleButtonProps {
  makeSlug: string;
  modelSlug: string;
  /** Human label, e.g. "Škoda Octavia A7" */
  label: string;
}

/**
 * «Запам'ятати як моє авто» — stores the current make+model as the buyer's car
 * (shown preselected in the vehicle bar everywhere). When this car is already
 * remembered, it switches to a confirmed state and lets the buyer forget it.
 */
export function RememberVehicleButton({ makeSlug, modelSlug, label }: RememberVehicleButtonProps) {
  const { hydrated, vehicle, setVehicle } = useVehicle();
  const isCurrent = hydrated && vehicle?.makeSlug === makeSlug && vehicle?.modelSlug === modelSlug;

  if (isCurrent) {
    return (
      <button
        type="button"
        aria-pressed
        onClick={() => {
          setVehicle(null);
          toast({ title: "Прибрали авто", description: `${label} більше не збережене як ваше.` });
        }}
        title="Натисніть, щоб прибрати"
        className="group inline-flex h-11 items-center gap-2 rounded-btn border border-ok/30 bg-ok-soft px-4 text-[15px] font-semibold text-ok"
      >
        <Check aria-hidden className="size-[18px]" strokeWidth={2.25} />
        <span>Це ваше авто</span>
        <span className="text-[13px] font-medium text-ok/70 group-hover:underline">· прибрати</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={false}
      onClick={() => {
        setVehicle({ makeSlug, modelSlug, label });
        toast({
          title: "Зберегли ваше авто",
          description: `${label} — показуватимемо сумісні запчастини.`,
        });
      }}
      className={buttonClass({ variant: "secondary" })}
    >
      <CarFront aria-hidden className="size-[18px]" strokeWidth={1.75} />
      Запам&apos;ятати як моє авто
    </button>
  );
}
