"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/admin/ui";
import { Button, buttonClass } from "@/components/ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { formatPrice } from "@/lib/format";
import { toast } from "@/lib/store";
import type { Product, ProductBadge, StockStatus } from "@/lib/types";
import type { ProductSource } from "@/lib/server/db/collections";
import type { AdminProductDetail, ProductFormData } from "@/lib/admin/queries/catalog";
import { saveProductAction } from "@/lib/admin/actions/catalog";
import { slugify } from "./slug";
import { TagInput } from "./TagInput";
import { FitmentEditor, type FitmentDraft } from "./FitmentEditor";

type SupplierData = NonNullable<AdminProductDetail["supplier"]>;

function moveItem<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

const STOCKS: { value: StockStatus; label: string }[] = [
  { value: "in_stock", label: "В наявності" },
  { value: "low_stock", label: "Закінчується" },
  { value: "preorder", label: "Під замовлення" },
  { value: "out_of_stock", label: "Немає в наявності" },
];

interface OptionValueDraft {
  id: string;
  label: string;
  priceDelta: string;
}

interface Draft {
  name: string;
  slug: string;
  sku: string;
  oemNumbers: string[];
  brandId: string;
  categoryId: string;
  price: string;
  oldPrice: string;
  stock: StockStatus;
  deliveryMin: string;
  deliveryMax: string;
  images: string[];
  badges: ProductBadge[];
  shortDescription: string;
  descriptionText: string;
  specs: { name: string; value: string }[];
  fitment: FitmentDraft[];
  universal: boolean;
  optionEnabled: boolean;
  optionName: string;
  optionValues: OptionValueDraft[];
  warrantyMonths: string;
  popularity: string;
  createdAt: string;
}

function toDraft(product?: Product): Draft {
  return {
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    sku: product?.sku ?? "",
    oemNumbers: product?.oemNumbers ?? [],
    brandId: product?.brandId ?? "",
    categoryId: product?.categoryId ?? "",
    price: product ? String(product.price) : "",
    oldPrice: product?.oldPrice ? String(product.oldPrice) : "",
    stock: product?.stock ?? "in_stock",
    deliveryMin: String(product?.deliveryDays?.[0] ?? 1),
    deliveryMax: String(product?.deliveryDays?.[1] ?? 3),
    images: product?.images ?? [],
    badges: product?.badges ?? [],
    shortDescription: product?.shortDescription ?? "",
    descriptionText: (product?.description ?? []).join("\n\n"),
    specs: product?.specs?.length ? product.specs.map((s) => ({ ...s })) : [],
    fitment: (product?.fitment ?? []).map((f) => ({ makeId: f.makeId, modelId: f.modelId, years: f.years, note: f.note ?? "" })),
    universal: product?.universal ?? false,
    optionEnabled: Boolean(product?.option),
    optionName: product?.option?.name ?? "",
    optionValues: (product?.option?.values ?? []).map((v) => ({ id: v.id, label: v.label, priceDelta: String(v.priceDelta) })),
    warrantyMonths: String(product?.warrantyMonths ?? 12),
    popularity: String(product?.popularity ?? 1000),
    createdAt: (product?.createdAt ?? new Date().toISOString()).slice(0, 10),
  };
}

interface ProductFormProps {
  product?: Product;
  data: ProductFormData;
  source: ProductSource;
  supplier?: SupplierData;
}

export function ProductForm({ product, data, source, supplier }: ProductFormProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => toDraft(product));
  const [slugEdited, setSlugEdited] = useState(Boolean(product));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const fromSupplier = source === "ddtuning";
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  function onName(name: string) {
    setDraft((d) => ({ ...d, name, slug: slugEdited ? d.slug : slugify(name) }));
  }

  function toggleBadge(badge: ProductBadge) {
    setDraft((d) => ({
      ...d,
      badges: d.badges.includes(badge) ? d.badges.filter((b) => b !== badge) : [...d.badges, badge],
    }));
  }

  function submit() {
    setErrors({});
    const input = {
      id: product?.id,
      name: draft.name,
      slug: draft.slug,
      sku: draft.sku,
      oemNumbers: draft.oemNumbers,
      brandId: draft.brandId,
      categoryId: draft.categoryId,
      price: draft.price === "" ? 0 : Number(draft.price),
      oldPrice: draft.oldPrice.trim() === "" ? undefined : Number(draft.oldPrice),
      stock: draft.stock,
      deliveryMin: Number(draft.deliveryMin) || 0,
      deliveryMax: Number(draft.deliveryMax) || 0,
      images: draft.images,
      badges: draft.badges,
      shortDescription: draft.shortDescription,
      description: draft.descriptionText
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean),
      specs: draft.specs.filter((s) => s.name.trim() || s.value.trim()),
      fitment: draft.universal ? [] : draft.fitment.filter((f) => f.makeId && f.modelId),
      universal: draft.universal,
      option:
        !fromSupplier && draft.optionEnabled && draft.optionName.trim() && draft.optionValues.length > 0
          ? {
              id: product?.option?.id || slugify(draft.optionName) || "opt",
              name: draft.optionName,
              values: draft.optionValues
                .filter((v) => v.label.trim())
                .map((v) => ({ id: v.id || slugify(v.label), label: v.label, priceDelta: Number(v.priceDelta) || 0 })),
            }
          : undefined,
      warrantyMonths: Number(draft.warrantyMonths) || 0,
      popularity: Number(draft.popularity) || 0,
      createdAt: draft.createdAt,
    };

    start(async () => {
      const result = await saveProductAction(input);
      if (result.ok) {
        toast({ title: "Товар збережено" });
        router.push(`/admin/products/${result.data.id}`);
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        toast({ title: result.error, tone: "error" });
      }
    });
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid gap-4">
        {fromSupplier && supplier && <SupplierCard supplier={supplier} />}

        <Card title="Основне">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Назва" htmlFor="pf-name" required error={errors.name} className="sm:col-span-2">
              <Input id="pf-name" value={draft.name} onChange={(e) => onName(e.target.value)} />
            </Field>
            <Field label="Слаг" htmlFor="pf-slug" hint="URL товару на сайті" error={errors.slug} className="sm:col-span-2">
              <Input
                id="pf-slug"
                value={draft.slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  set("slug", e.target.value);
                }}
              />
            </Field>
            <Field label="Артикул" htmlFor="pf-sku" required={!fromSupplier} error={errors.sku} hint={fromSupplier ? "Артикул постачальника" : undefined}>
              <Input id="pf-sku" value={draft.sku} onChange={(e) => set("sku", e.target.value)} disabled={fromSupplier} />
            </Field>
            <Field label="Бренд" htmlFor="pf-brand" required error={errors.brandId}>
              <Select id="pf-brand" value={draft.brandId} onChange={(e) => set("brandId", e.target.value)}>
                <option value="">Оберіть бренд…</option>
                {data.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Категорія" htmlFor="pf-category" required error={errors.categoryId}>
              <Select id="pf-category" value={draft.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                <option value="">Оберіть категорію…</option>
                {data.categoryGroups.map((g) => (
                  <optgroup key={g.id} label={g.name}>
                    {g.leaves.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
            <Field label="OE / крос-номери" htmlFor="pf-oem" className="sm:col-span-2">
              <TagInput id="pf-oem" values={draft.oemNumbers} onChange={(v) => set("oemNumbers", v)} placeholder="Введіть номер і натисніть Enter" />
            </Field>
            <Field label="Гарантія, міс." htmlFor="pf-warranty">
              <Input id="pf-warranty" type="number" min={0} value={draft.warrantyMonths} onChange={(e) => set("warrantyMonths", e.target.value)} />
            </Field>
            <Field label="Популярність" htmlFor="pf-pop" hint="Вище — вище у сортуванні">
              <Input id="pf-pop" type="number" min={0} value={draft.popularity} onChange={(e) => set("popularity", e.target.value)} />
            </Field>
            {!fromSupplier && (
              <Field label="Дата створення" htmlFor="pf-created">
                <Input id="pf-created" type="date" value={draft.createdAt} onChange={(e) => set("createdAt", e.target.value)} />
              </Field>
            )}
            <div className="grid content-start gap-1.5">
              <span className="text-sm font-medium text-ink-2">Бейджі</span>
              <div className="flex flex-wrap gap-3">
                {data.badges.map((b) => (
                  <Checkbox
                    key={b.value}
                    label={b.label}
                    checked={draft.badges.includes(b.value)}
                    onChange={() => toggleBadge(b.value)}
                  />
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <Checkbox
                label="Універсальний товар"
                description="Підходить до будь-якого авто — сумісність приховується"
                checked={draft.universal}
                onChange={(e) => set("universal", e.target.checked)}
              />
            </div>
          </div>
        </Card>

        <Card title="Ціна і наявність">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ціна, ₴" htmlFor="pf-price" required error={errors.price}>
              <Input id="pf-price" type="number" min={0} value={draft.price} onChange={(e) => set("price", e.target.value)} />
            </Field>
            <Field label="Стара ціна, ₴" htmlFor="pf-oldprice" hint="Порожньо — без знижки" error={errors.oldPrice}>
              <Input id="pf-oldprice" type="number" min={0} value={draft.oldPrice} onChange={(e) => set("oldPrice", e.target.value)} />
            </Field>
            <Field label="Наявність" htmlFor="pf-stock">
              <Select id="pf-stock" value={draft.stock} onChange={(e) => set("stock", e.target.value as StockStatus)}>
                {STOCKS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Доставка від, днів" htmlFor="pf-dmin">
                <Input id="pf-dmin" type="number" min={0} value={draft.deliveryMin} onChange={(e) => set("deliveryMin", e.target.value)} />
              </Field>
              <Field label="до" htmlFor="pf-dmax">
                <Input id="pf-dmax" type="number" min={0} value={draft.deliveryMax} onChange={(e) => set("deliveryMax", e.target.value)} />
              </Field>
            </div>
          </div>
          {fromSupplier && (
            <p className="mt-3 text-[12.5px] text-ink-3">
              Ціну можна задати вручну або масово перерахувати за націнкою на сторінці «Постачальник DD». Зміни зберігаються
              як перевизначення над ціною постачальника.
            </p>
          )}
        </Card>

        <Card title="Опис">
          <div className="grid gap-4">
            <Field label="Короткий опис" htmlFor="pf-short">
              <Textarea id="pf-short" rows={2} value={draft.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} />
            </Field>
            <Field label="Повний опис" htmlFor="pf-desc" hint="Абзаци розділяються порожнім рядком">
              <Textarea id="pf-desc" rows={6} value={draft.descriptionText} onChange={(e) => set("descriptionText", e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card
          title="Характеристики"
          actions={
            <Button variant="secondary" size="sm" onClick={() => set("specs", [...draft.specs, { name: "", value: "" }])}>
              <Plus aria-hidden className="size-4" strokeWidth={1.75} />
              Додати
            </Button>
          }
        >
          {draft.specs.length === 0 ? (
            <p className="text-sm text-ink-3">Характеристик немає.</p>
          ) : (
            <div className="grid gap-2">
              {draft.specs.map((spec, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Input
                    aria-label="Назва характеристики"
                    value={spec.name}
                    placeholder="Назва"
                    onChange={(e) => set("specs", draft.specs.map((s, i) => (i === index ? { ...s, name: e.target.value } : s)))}
                  />
                  <Input
                    aria-label="Значення характеристики"
                    value={spec.value}
                    placeholder="Значення"
                    onChange={(e) => set("specs", draft.specs.map((s, i) => (i === index ? { ...s, value: e.target.value } : s)))}
                  />
                  <div className="flex items-center">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => set("specs", moveItem(draft.specs, index, -1))}
                      aria-label="Вгору"
                      className="grid size-9 place-content-center rounded-btn text-ink-3 transition-colors hover:bg-mist hover:text-ink disabled:opacity-30"
                    >
                      <ChevronUp aria-hidden className="size-4" strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      disabled={index === draft.specs.length - 1}
                      onClick={() => set("specs", moveItem(draft.specs, index, 1))}
                      aria-label="Вниз"
                      className="grid size-9 place-content-center rounded-btn text-ink-3 transition-colors hover:bg-mist hover:text-ink disabled:opacity-30"
                    >
                      <ChevronDown aria-hidden className="size-4" strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      onClick={() => set("specs", draft.specs.filter((_, i) => i !== index))}
                      aria-label="Прибрати характеристику"
                      className="grid size-9 place-content-center rounded-btn text-ink-3 transition-colors hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {!draft.universal && (
          <Card title="Сумісність">
            <FitmentEditor rows={draft.fitment} onChange={(rows) => set("fitment", rows)} makes={data.makes} initialModels={data.initialModels} />
          </Card>
        )}

        <Card
          title="Фото"
          description="Посилання на зображення. Якщо порожньо — показується ілюстрація категорії."
          actions={
            <Button variant="secondary" size="sm" onClick={() => set("images", [...draft.images, ""])}>
              <Plus aria-hidden className="size-4" strokeWidth={1.75} />
              Додати
            </Button>
          }
        >
          {draft.images.length === 0 ? (
            <p className="text-sm text-ink-3">Фото не додано.</p>
          ) : (
            <div className="grid gap-2">
              {draft.images.map((url, index) => (
                <div key={index} className="flex items-center gap-2">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin preview of an arbitrary URL
                    <img src={url} alt="" className="size-10 shrink-0 rounded-md border border-line-soft object-cover" />
                  ) : (
                    <span className="size-10 shrink-0 rounded-md border border-dashed border-line" />
                  )}
                  <Input
                    aria-label={`Посилання на фото ${index + 1}`}
                    value={url}
                    placeholder="https://…"
                    onChange={(e) => set("images", draft.images.map((v, i) => (i === index ? e.target.value : v)))}
                  />
                  <button
                    type="button"
                    onClick={() => set("images", draft.images.filter((_, i) => i !== index))}
                    aria-label="Прибрати фото"
                    className="grid size-9 shrink-0 place-content-center rounded-btn text-ink-3 transition-colors hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {!fromSupplier && (
          <Card title="Варіант">
            <Checkbox
              label="Товар має вибір варіанта"
              description="Напр. сторона встановлення або обʼєм"
              checked={draft.optionEnabled}
              onChange={(e) => set("optionEnabled", e.target.checked)}
            />
            {draft.optionEnabled && (
              <div className="mt-4 grid gap-3">
                <Field label="Назва варіанта" htmlFor="pf-opt-name">
                  <Input id="pf-opt-name" value={draft.optionName} placeholder="Напр. Сторона встановлення" onChange={(e) => set("optionName", e.target.value)} />
                </Field>
                <div className="grid gap-2">
                  {draft.optionValues.map((v, index) => (
                    <div key={index} className="grid grid-cols-[1fr_7rem_auto] gap-2">
                      <Input
                        aria-label="Назва значення"
                        value={v.label}
                        placeholder="Значення"
                        onChange={(e) => set("optionValues", draft.optionValues.map((x, i) => (i === index ? { ...x, label: e.target.value } : x)))}
                      />
                      <Input
                        aria-label="Доплата, ₴"
                        type="number"
                        value={v.priceDelta}
                        placeholder="± ₴"
                        onChange={(e) => set("optionValues", draft.optionValues.map((x, i) => (i === index ? { ...x, priceDelta: e.target.value } : x)))}
                      />
                      <button
                        type="button"
                        onClick={() => set("optionValues", draft.optionValues.filter((_, i) => i !== index))}
                        aria-label="Прибрати значення"
                        className="grid size-9 place-content-center rounded-btn text-ink-3 transition-colors hover:bg-danger-soft hover:text-danger"
                      >
                        <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
                      </button>
                    </div>
                  ))}
                </div>
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => set("optionValues", [...draft.optionValues, { id: "", label: "", priceDelta: "0" }])}
                  >
                    <Plus aria-hidden className="size-4" strokeWidth={1.75} />
                    Додати значення
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      <aside className="lg:sticky lg:top-16">
        <Card>
          <div className="grid gap-3">
            <p className="text-[13px] text-ink-3">
              {product ? "Зміни застосуються на сайті одразу після збереження." : "Новий товар зʼявиться в каталозі після збереження."}
            </p>
            <Button onClick={submit} disabled={pending} aria-busy={pending || undefined} block>
              {pending ? "Зберігаємо…" : "Зберегти товар"}
            </Button>
            <Link href="/admin/products" className={buttonClass({ variant: "ghost", block: true })}>
              Скасувати
            </Link>
          </div>
        </Card>
      </aside>
    </div>
  );
}

function SupplierCard({ supplier }: { supplier: SupplierData }) {
  const costLabel =
    supplier.costPrice != null
      ? `${formatPrice(supplier.costPrice)}${
          supplier.costCurrency && supplier.costCurrency !== "UAH" && supplier.costOriginal
            ? ` (${supplier.costOriginal} ${supplier.costCurrency})`
            : ""
        }`
      : "—";
  return (
    <Card
      title="Дані постачальника"
      description={`DD Tuning · синхронізовано ${new Date(supplier.syncedAt).toLocaleString("uk-UA")}`}
    >
      <p className="mb-3 text-[12.5px] text-ink-3">
        Товар імпортовано від постачальника. Ваші зміни зберігаються як перевизначення й повторно застосовуються після
        кожної синхронізації. «Скинути зміни» повертає дані постачальника.
      </p>
      <div className="adm-scroll-x overflow-hidden rounded-card border border-line-soft">
        <table className="adm-table">
          <thead>
            <tr>
              <th scope="col">Артикул</th>
              <th scope="col">Назва</th>
              <th scope="col" className="text-right">К-сть</th>
              <th scope="col" className="hidden sm:table-cell">Склад</th>
              <th scope="col" className="text-right">Ціна</th>
              <th scope="col" className="text-right">Собівартість</th>
              <th scope="col" className="hidden text-right sm:table-cell">Фото</th>
            </tr>
          </thead>
          <tbody>
            {supplier.items.map((item) => (
              <tr key={item.id}>
                <td className="tabular text-ink-2">{item.sku}</td>
                <td className="text-ink">{item.short || item.title}</td>
                <td className="tabular text-right text-ink-2">{item.qty}</td>
                <td className="hidden text-[12.5px] text-ink-3 sm:table-cell">{item.warehouse ?? "—"}</td>
                <td className="tabular text-right">{formatPrice(item.price)}</td>
                <td className="tabular text-right text-ink-2">
                  {item.costUah != null
                    ? `${formatPrice(item.costUah)}${
                        item.costCurrency && item.costCurrency !== "UAH" && item.costOriginal != null
                          ? ` · ${item.costOriginal} ${item.costCurrency}`
                          : ""
                      }`
                    : "—"}
                </td>
                <td className="tabular hidden text-right text-ink-3 sm:table-cell">{item.images}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12.5px] text-ink-3">Собівартість базового варіанта: {costLabel}</p>
    </Card>
  );
}
