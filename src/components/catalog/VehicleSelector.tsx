"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CarFront, ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useVehicle } from "@/lib/store";

export interface SelectorMake {
  slug: string;
  name: string;
  models: { slug: string; name: string; years: string }[];
}

interface VehicleSelectorProps {
  makes: SelectorMake[];
  /** Top-level catalog groups for the optional third select */
  categories: { slug: string; name: string }[];
  /** "hero" — large form for the home page card; "bar" — slim strip for catalog pages (collapsed on phones) */
  variant?: "hero" | "bar";
  /** Preselected vehicle (e.g. on a make/model page) */
  initial?: { makeSlug?: string; modelSlug?: string; categorySlug?: string };
  className?: string;
}

/**
 * Make → model → (group) → «Показати товари».
 * Navigates to /avto/[make] or /avto/[make]/[model] (with ?category=…) and remembers the vehicle.
 */
export function VehicleSelector({ makes, categories, variant = "bar", initial, className }: VehicleSelectorProps) {
  const router = useRouter();
  const { vehicle, setVehicle } = useVehicle();
  // null until the user (or the page via `initial`) picks something; then the remembered vehicle is ignored
  const [selection, setSelection] = useState<{ makeSlug: string; modelSlug: string } | null>(
    initial?.makeSlug ? { makeSlug: initial.makeSlug, modelSlug: initial.modelSlug ?? "" } : null,
  );
  const [categorySlug, setCategorySlug] = useState(initial?.categorySlug ?? "");
  const [expanded, setExpanded] = useState(false);
  const id = useId();

  const remembered =
    vehicle && makes.some((m) => m.slug === vehicle.makeSlug)
      ? { makeSlug: vehicle.makeSlug, modelSlug: vehicle.modelSlug ?? "" }
      : null;
  const { makeSlug, modelSlug } = selection ?? remembered ?? { makeSlug: "", modelSlug: "" };

  const make = makes.find((m) => m.slug === makeSlug);
  const model = make?.models.find((m) => m.slug === modelSlug);
  const vehicleLabel = make ? (model ? `${make.name} ${model.name}` : make.name) : "";

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!make) return;
    setVehicle({ makeSlug: make.slug, modelSlug: model?.slug, label: vehicleLabel });
    const path = model ? `/avto/${make.slug}/${model.slug}` : `/avto/${make.slug}`;
    router.push(categorySlug ? `${path}?category=${categorySlug}` : path);
  }

  const hero = variant === "hero";
  const fieldClass = cn("field", !hero && "field-sm");
  const labelClass = hero ? "mb-1.5 block text-[13px] font-medium text-ink-2" : "sr-only";

  const form = (
    <form
      id={`${id}-form`}
      onSubmit={onSubmit}
      aria-label="Підбір запчастин за авто"
      className={cn(
        hero
          ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end"
          : cn("grid-cols-2 gap-2 md:flex md:items-center", expanded ? "mt-2 grid md:mt-0" : "hidden"),
        hero && className,
      )}
    >
      <div className={cn(!hero && "md:w-44 lg:w-52")}>
        <label htmlFor={`${id}-make`} className={labelClass}>
          Марка
        </label>
        <select
          id={`${id}-make`}
          value={makeSlug}
          onChange={(event) => setSelection({ makeSlug: event.target.value, modelSlug: "" })}
          className={fieldClass}
        >
          <option value="">{hero ? "Оберіть марку" : "Марка"}</option>
          {makes.map((m) => (
            <option key={m.slug} value={m.slug}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div className={cn(!hero && "md:w-52 lg:w-64")}>
        <label htmlFor={`${id}-model`} className={labelClass}>
          Модель
        </label>
        <select
          id={`${id}-model`}
          value={modelSlug}
          disabled={!make}
          onChange={(event) => setSelection({ makeSlug, modelSlug: event.target.value })}
          className={fieldClass}
        >
          <option value="">{hero ? (make ? "Усі моделі" : "Спочатку оберіть марку") : "Модель"}</option>
          {make?.models.map((m) => (
            <option key={m.slug} value={m.slug}>
              {m.years ? `${m.name} (${m.years})` : m.name}
            </option>
          ))}
        </select>
      </div>

      <div className={cn(!hero && "max-md:col-span-2 md:w-52 lg:w-60")}>
        <label htmlFor={`${id}-category`} className={labelClass}>
          Група запчастин
        </label>
        <select
          id={`${id}-category`}
          value={categorySlug}
          onChange={(event) => setCategorySlug(event.target.value)}
          className={fieldClass}
        >
          <option value="">{hero ? "Усі групи" : "Група запчастин"}</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <Button
        type="submit"
        size={hero ? "md" : "sm"}
        disabled={!make}
        className={cn(hero ? "sm:col-span-2 lg:col-span-1" : "max-md:col-span-2")}
      >
        {hero ? <CarFront aria-hidden className="size-[18px]" /> : <Search aria-hidden className="size-4" />}
        Показати товари
      </Button>
    </form>
  );

  if (hero) return form;

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={`${id}-form`}
        onClick={() => setExpanded((value) => !value)}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-btn border border-line bg-white px-3.5 text-left text-sm md:hidden"
      >
        <span className="flex min-w-0 items-center gap-2">
          <CarFront aria-hidden className="size-5 shrink-0 text-brand-700" strokeWidth={1.75} />
          <span className="truncate">
            <span className="font-semibold text-ink">Підбір за авто</span>
            {vehicleLabel && <span className="text-ink-3"> · {vehicleLabel}</span>}
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn("size-4 shrink-0 text-ink-3 transition-transform", expanded && "rotate-180")}
        />
      </button>
      {form}
    </div>
  );
}
