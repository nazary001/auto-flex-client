"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PromoBanner } from "@/components/content/PromoBanner";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/admin/ui";
import { toast } from "@/lib/store";
import type { Promo } from "@/lib/types";
import { savePromoAction } from "@/lib/admin/actions/content";

interface PromoFormProps {
  mode: "create" | "edit";
  initial?: Promo & { id: string; active: boolean };
  /** Leaf category slugs usable as illustration keys */
  illustrations: { value: string; label: string }[];
}

const TONE_OPTIONS: { value: Promo["tone"]; label: string }[] = [
  { value: "navy", label: "Темний (navy)" },
  { value: "blue", label: "Синій (blue)" },
  { value: "light", label: "Світлий (light)" },
];

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh", з: "z",
  и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p",
  р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ь: "", ю: "iu", я: "ia", "'": "", "’": "",
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .split("")
    .map((char) => (char in TRANSLIT ? TRANSLIT[char] : char))
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function PromoForm({ mode, initial, illustrations }: PromoFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [text, setText] = useState(initial?.text ?? "");
  const [period, setPeriod] = useState(initial?.period ?? "");
  const [href, setHref] = useState(initial?.href ?? "/catalog");
  const [cta, setCta] = useState(initial?.cta ?? "Переглянути");
  const [illustration, setIllustration] = useState(initial?.illustration ?? illustrations[0]?.value ?? "");
  const [tone, setTone] = useState<Promo["tone"]>(initial?.tone ?? "navy");
  const [active, setActive] = useState(initial?.active ?? true);

  function onTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  const preview = useMemo<Promo>(
    () => ({
      slug: slug || "promo",
      title: title || "Заголовок акції",
      text: text || "Опис акції побачать покупці на головній сторінці та у розділі «Акції».",
      period: period || "період",
      href: href || "/catalog",
      cta: cta || "Переглянути",
      illustration: illustration || illustrations[0]?.value || "_fallback",
      tone,
    }),
    [slug, title, text, period, href, cta, illustration, tone, illustrations],
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    startTransition(async () => {
      const result = await savePromoAction({
        id: initial?.id,
        slug,
        title,
        text,
        period,
        href,
        cta,
        illustration,
        tone,
        active,
      });
      if (result.ok) {
        toast({ title: mode === "create" ? "Акцію створено" : "Зміни збережено" });
        router.push("/admin/promos");
        router.refresh();
      } else {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        toast({ title: result.error, tone: "error" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
      <Card className="order-2 lg:order-1">
        <div className="grid gap-4">
          <Field label="Заголовок" htmlFor="promo-title" required error={fieldErrors.title}>
            <Input
              id="promo-title"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              maxLength={120}
              required
            />
          </Field>
          <Field
            label="Ідентифікатор"
            htmlFor="promo-slug"
            required
            error={fieldErrors.slug}
            hint="Латиниця, цифри й дефіси. Генерується із заголовка, можна змінити."
          >
            <Input
              id="promo-slug"
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.target.value);
              }}
              maxLength={80}
              required
            />
          </Field>
          <Field label="Опис" htmlFor="promo-text" required error={fieldErrors.text}>
            <Textarea
              id="promo-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={3}
              maxLength={600}
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Період" htmlFor="promo-period" error={fieldErrors.period} hint="Напр. «до кінця місяця»">
              <Input
                id="promo-period"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                maxLength={60}
              />
            </Field>
            <Field label="Текст кнопки" htmlFor="promo-cta" required error={fieldErrors.cta}>
              <Input id="promo-cta" value={cta} onChange={(event) => setCta(event.target.value)} maxLength={40} required />
            </Field>
          </div>
          <Field
            label="Посилання"
            htmlFor="promo-href"
            required
            error={fieldErrors.href}
            hint="Внутрішній шлях, напр. /catalog/halmivna-systema?sale=1"
          >
            <Input id="promo-href" value={href} onChange={(event) => setHref(event.target.value)} maxLength={200} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ілюстрація" htmlFor="promo-illustration" error={fieldErrors.illustration}>
              <Select
                id="promo-illustration"
                value={illustration}
                onChange={(event) => setIllustration(event.target.value)}
              >
                {illustrations.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Оформлення" htmlFor="promo-tone" error={fieldErrors.tone}>
              <Select id="promo-tone" value={tone} onChange={(event) => setTone(event.target.value as Promo["tone"])}>
                {TONE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-[15px] text-ink">
            <input type="checkbox" className="check" checked={active} onChange={(event) => setActive(event.target.checked)} />
            Показувати на сайті
          </label>
        </div>
        <div className="mt-6 flex items-center gap-2">
          <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
            {mode === "create" ? "Створити акцію" : "Зберегти зміни"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push("/admin/promos")} disabled={pending}>
            Скасувати
          </Button>
        </div>
      </Card>

      <div className="order-1 lg:order-2 lg:sticky lg:top-20">
        <p className="mb-2 text-[13px] font-medium text-ink-3">Попередній перегляд</p>
        <PromoBanner promo={preview} variant="wide" />
      </div>
    </form>
  );
}
