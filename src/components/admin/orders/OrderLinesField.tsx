"use client";

import { useEffect, useState } from "react";
import { Lock, Plus, Search, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { formatPrice } from "@/lib/format";
import { priceFromCost } from "@/lib/admin/domain/money";
import { searchProductsAction, type ProductSearchItem } from "@/lib/admin/actions/orders";
import { toast } from "@/lib/store";
import { emptyLine, type FormLine } from "./order-form-model";

interface OrderLinesFieldProps {
  lines: FormLine[];
  onChange: (lines: FormLine[]) => void;
  suppliers: { id: string; name: string }[];
  markup: number;
}

/** Lines block of the order form: product search, custom lines and per-line editing. */
export function OrderLinesField({ lines, onChange, suppliers, markup }: OrderLinesFieldProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductSearchItem[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const handle = setTimeout(async () => {
      setSearching(true);
      const result = await searchProductsAction({ q });
      setSearching(false);
      if (result.ok) setResults(result.data.products);
      else toast({ title: result.error, tone: "error" });
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  function addProduct(product: ProductSearchItem, value?: { label: string; priceDelta: number }) {
    const delta = value?.priceDelta ?? 0;
    onChange([
      ...lines,
      {
        ...emptyLine(),
        productId: product.id,
        sku: product.sku,
        name: product.name,
        optionLabel: value && product.option ? `${product.option.name}: ${value.label}` : "",
        price: String(product.price + delta),
        costPrice: product.bestOffer ? String(product.bestOffer.cost) : "",
        supplierId: product.bestOffer?.supplierId ?? "",
      },
    ]);
    setQuery("");
    setResults([]);
  }

  function update(index: number, patch: Partial<FormLine>) {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function remove(index: number) {
    onChange(lines.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.75} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Пошук товару за назвою або артикулом"
            aria-label="Пошук товару"
            className="pl-9"
          />
        </div>
        {(results.length > 0 || searching) && query.trim().length >= 2 && (
          <div className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-card border border-line-soft bg-white p-1 shadow-pop">
            {searching && <p className="px-3 py-2 text-[13px] text-ink-3">Пошук…</p>}
            {results.map((product) => (
              <div key={product.id} className="rounded-btn px-2 py-2 hover:bg-mist">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{product.name}</p>
                    <p className="tabular text-[12.5px] text-ink-3">
                      {product.sku}
                      {product.brandName ? ` · ${product.brandName}` : ""}
                      {product.bestOffer ? ` · закупка ${formatPrice(product.bestOffer.cost)}` : ""}
                    </p>
                  </div>
                  <span className="tabular shrink-0 text-sm font-semibold text-ink">{formatPrice(product.price)}</span>
                </div>
                {product.option ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {product.option.values.map((value) => (
                      <button
                        key={value.id}
                        type="button"
                        onClick={() => addProduct(product, value)}
                        className="rounded-full bg-brand-50 px-2.5 py-1 text-[12px] font-semibold text-brand-700 transition-colors hover:bg-brand-100"
                      >
                        {value.label}
                        {value.priceDelta ? ` (+${value.priceDelta})` : ""}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => addProduct(product)}
                    className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-700"
                  >
                    <Plus aria-hidden className="size-3.5" strokeWidth={2} />
                    Додати
                  </button>
                )}
              </div>
            ))}
            {!searching && results.length === 0 && <p className="px-3 py-2 text-[13px] text-ink-3">Нічого не знайдено.</p>}
          </div>
        )}
      </div>

      {lines.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-soft px-4 py-6 text-center text-sm text-ink-3">
          Додайте позиції через пошук або створіть власну.
        </p>
      ) : (
        <ul className="space-y-3">
          {lines.map((line, index) => (
            <li key={line.id ?? `new-${index}`} className="rounded-card border border-line-soft p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {line.productId === null && !line.locked ? (
                    <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
                      <Input value={line.sku} onChange={(e) => update(index, { sku: e.target.value })} placeholder="Артикул" aria-label="Артикул" />
                      <Input value={line.name} onChange={(e) => update(index, { name: e.target.value })} placeholder="Назва позиції" aria-label="Назва" />
                    </div>
                  ) : (
                    <div>
                      <p className="tabular text-[12.5px] text-ink-3">{line.sku}</p>
                      <p className="text-sm font-medium text-ink">{line.name}</p>
                      {line.optionLabel && <p className="text-[12.5px] text-ink-3">{line.optionLabel}</p>}
                    </div>
                  )}
                </div>
                {line.locked ? (
                  <span className="inline-flex items-center gap-1 text-[12px] text-ink-3" title="Позиція в закупівлі">
                    <Lock aria-hidden className="size-3.5" strokeWidth={1.75} />
                  </span>
                ) : (
                  <button type="button" onClick={() => remove(index)} aria-label="Видалити позицію" className="text-ink-3 transition-colors hover:text-danger">
                    <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
                  </button>
                )}
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-4">
                <label className="grid gap-1 text-[12px] text-ink-3">
                  Кількість
                  <Input type="number" min={1} max={99} value={line.qty} onChange={(e) => update(index, { qty: e.target.value })} disabled={line.locked} />
                </label>
                <label className="grid gap-1 text-[12px] text-ink-3">
                  Ціна, ₴
                  <span className="flex gap-1">
                    <Input type="number" min={0} value={line.price} onChange={(e) => update(index, { price: e.target.value })} disabled={line.locked} />
                    {!line.locked && line.costPrice && (
                      <button
                        type="button"
                        title="Порахувати ціну з націнкою"
                        onClick={() => update(index, { price: String(priceFromCost(Number(line.costPrice) || 0, markup)) })}
                        className="grid w-9 shrink-0 place-content-center rounded-btn border border-line-soft text-ink-3 transition-colors hover:text-brand-700"
                      >
                        <Wand2 aria-hidden className="size-4" strokeWidth={1.75} />
                      </button>
                    )}
                  </span>
                </label>
                <label className="grid gap-1 text-[12px] text-ink-3">
                  Знижка, ₴
                  <Input type="number" min={0} value={line.discount} onChange={(e) => update(index, { discount: e.target.value })} disabled={line.locked} />
                </label>
                <label className="grid gap-1 text-[12px] text-ink-3">
                  Собівартість, ₴
                  <Input type="number" min={0} value={line.costPrice} onChange={(e) => update(index, { costPrice: e.target.value })} disabled={line.locked} />
                </label>
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr]">
                <label className="grid gap-1 text-[12px] text-ink-3">
                  Постачальник
                  <Select value={line.supplierId} onChange={(e) => update(index, { supplierId: e.target.value })} disabled={line.locked}>
                    <option value="">—</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="grid gap-1 text-[12px] text-ink-3">
                  Примітка
                  <Input value={line.note} onChange={(e) => update(index, { note: e.target.value })} disabled={line.locked} />
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...lines, emptyLine()])}>
        <Plus aria-hidden className="size-4" strokeWidth={1.75} />
        Додати власну позицію
      </Button>
    </div>
  );
}
