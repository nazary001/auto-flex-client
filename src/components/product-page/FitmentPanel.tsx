"use client";

import Link from "next/link";
import { Car, Check, CircleAlert, ScanLine } from "lucide-react";
import { cn } from "@/lib/cn";
import { useVehicle } from "@/lib/store";

export interface FitmentTarget {
  makeSlug: string;
  modelSlug: string;
  label: string;
}

interface FitmentPanelProps {
  fits: FitmentTarget[];
  universal: boolean;
}

type Tone = "ok" | "warn" | "neutral";

const toneStyle: Record<Tone, { box: string; icon: string }> = {
  ok: { box: "border-ok/25 bg-ok-soft", icon: "text-ok" },
  warn: { box: "border-warn/25 bg-warn-soft", icon: "text-warn" },
  neutral: { box: "border-line-soft bg-mist-soft", icon: "text-brand-700" },
};

/** Compatibility hint next to the buy box: checks the remembered vehicle against this product's fitment. */
export function FitmentPanel({ fits, universal }: FitmentPanelProps) {
  const { vehicle } = useVehicle();

  let tone: Tone = "neutral";
  let Icon = Car;
  let title: React.ReactNode;
  let body: React.ReactNode = null;

  if (universal) {
    tone = "ok";
    Icon = Check;
    title = "Універсальний товар";
    body = "Підходить до більшості автомобілів незалежно від марки й моделі.";
  } else if (vehicle) {
    const matches = fits.some(
      (f) => f.makeSlug === vehicle.makeSlug && (!vehicle.modelSlug || f.modelSlug === vehicle.modelSlug),
    );
    if (matches) {
      tone = "ok";
      Icon = Check;
      title = (
        <>
          Підходить до <span className="font-semibold">{vehicle.label}</span>
        </>
      );
      body = "Авто є в переліку сумісності цього товару.";
    } else {
      tone = "warn";
      Icon = CircleAlert;
      title = (
        <>
          <span className="font-semibold">{vehicle.label}</span> немає в переліку сумісності
        </>
      );
      body = "Можливо, товар усе одно підійде — звіртеся з розділом «Сумісність» нижче або надішліть VIN.";
    }
  } else {
    tone = "neutral";
    Icon = Car;
    title = "Перевірте сумісність зі своїм авто";
    body = (
      <>
        Дивіться перелік у розділі{" "}
        <a href="#sumisnist" className="link font-medium">
          «Сумісність»
        </a>{" "}
        або{" "}
        <Link href="/avto" className="link font-medium">
          підберіть за маркою та моделлю
        </Link>
        .
      </>
    );
  }

  const style = toneStyle[tone];

  return (
    <div className={cn("rounded-card border p-4", style.box)}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", style.icon)} strokeWidth={1.9} />
        <div className="min-w-0">
          <p className="text-[15px] text-ink">{title}</p>
          {body && <p className="mt-0.5 text-sm text-ink-2">{body}</p>}
        </div>
      </div>
      <p className="mt-3 flex items-start gap-2 border-t border-black/5 pt-3 text-[13px] text-ink-3">
        <ScanLine aria-hidden className="mt-px size-4 shrink-0 text-brand-700" strokeWidth={1.75} />
        Перевіримо сумісність за VIN перед відправкою.
      </p>
    </div>
  );
}
