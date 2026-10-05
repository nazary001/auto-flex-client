"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/Field";
import { Card } from "@/components/admin/ui";
import { toast } from "@/lib/store";
import { formatPrice } from "@/lib/format";
import { availabilityMeta } from "@/lib/admin/labels";
import type { OfferAvailability } from "@/lib/admin/types";
import { createPurchaseOrdersAction } from "@/lib/admin/actions/purchasing";

export interface BuilderOffer {
  supplierId: string;
  code: string;
  name: string;
  cost: number;
  availability: OfferAvailability;
  shipsDirect: boolean;
}

export interface BuilderLine {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerCity: string;
  orderLineId: string;
  sku: string;
  name: string;
  qty: number;
  defaultCost: number;
  offers: BuilderOffer[];
}

export interface BuilderSupplier {
  id: string;
  code: string;
  name: string;
  shipsDirect: boolean;
}

interface LineState {
  checked: boolean;
  qty: number;
  cost: number;
  supplierId: string;
}

interface GroupState {
  shipDirect: boolean;
  notes: string;
  expectedAt: string;
}

interface PurchaseOrderBuilderProps {
  lines: BuilderLine[];
  suppliers: BuilderSupplier[];
}

/**
 * Picks lines from one or many orders, groups them by supplier and creates one draft purchase
 * order per supplier. Cost is prefilled from the best offer (or the order line's known cost).
 */
export function PurchaseOrderBuilder({ lines, suppliers }: PurchaseOrderBuilderProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const lineById = useMemo(() => new Map(lines.map((l) => [l.orderLineId, l])), [lines]);
  const supplierById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);

  const [lineState, setLineState] = useState<Record<string, LineState>>(() => {
    const state: Record<string, LineState> = {};
    for (const line of lines) {
      const best = line.offers[0];
      state[line.orderLineId] = {
        checked: true,
        qty: line.qty,
        cost: best?.cost ?? line.defaultCost,
        supplierId: best?.supplierId ?? "",
      };
    }
    return state;
  });
  const [groupState, setGroupState] = useState<Record<string, GroupState>>({});

  function patchLine(id: string, patch: Partial<LineState>) {
    setLineState((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function onSupplierChange(line: BuilderLine, supplierId: string) {
    const offer = line.offers.find((o) => o.supplierId === supplierId);
    patchLine(line.orderLineId, offer ? { supplierId, cost: offer.cost } : { supplierId });
  }

  function groupSettings(supplierId: string): GroupState {
    return groupState[supplierId] ?? { shipDirect: supplierById.get(supplierId)?.shipsDirect ?? false, notes: "", expectedAt: "" };
  }

  function patchGroup(supplierId: string, patch: Partial<GroupState>) {
    setGroupState((prev) => ({ ...prev, [supplierId]: { ...groupSettings(supplierId), ...patch } }));
  }

  // lines grouped by order for display
  const orders = useMemo(() => {
    const map = new Map<string, { orderNumber: string; customerName: string; customerCity: string; lines: BuilderLine[] }>();
    for (const line of lines) {
      const entry = map.get(line.orderId) ?? {
        orderNumber: line.orderNumber,
        customerName: line.customerName,
        customerCity: line.customerCity,
        lines: [],
      };
      entry.lines.push(line);
      map.set(line.orderId, entry);
    }
    return [...map.values()];
  }, [lines]);

  // checked lines grouped by supplier for the summary
  const summary = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const s of Object.values(lineState)) {
      if (!s.checked || !s.supplierId) continue;
      const entry = map.get(s.supplierId) ?? { count: 0, total: 0 };
      entry.count += 1;
      entry.total += s.cost * s.qty;
      map.set(s.supplierId, entry);
    }
    return map;
  }, [lineState]);

  const grandTotal = useMemo(
    () => Object.values(lineState).reduce((sum, s) => (s.checked && s.supplierId ? sum + s.cost * s.qty : sum), 0),
    [lineState],
  );

  function submit() {
    const checked = Object.entries(lineState).filter(([, s]) => s.checked);
    if (checked.length === 0) {
      toast({ title: "Оберіть хоча б одну позицію.", tone: "error" });
      return;
    }
    if (checked.some(([, s]) => !s.supplierId)) {
      toast({ title: "Оберіть постачальника для кожної позначеної позиції.", tone: "error" });
      return;
    }
    const bySupplier = new Map<string, { orderId: string; orderLineId: string; qty: number; cost: number }[]>();
    for (const [lineId, s] of checked) {
      const line = lineById.get(lineId);
      if (!line) continue;
      const list = bySupplier.get(s.supplierId) ?? [];
      list.push({ orderId: line.orderId, orderLineId: lineId, qty: s.qty, cost: Math.round(s.cost) });
      bySupplier.set(s.supplierId, list);
    }
    const groups = [...bySupplier.entries()].map(([supplierId, groupLines]) => {
      const gs = groupSettings(supplierId);
      return { supplierId, shipDirect: gs.shipDirect, notes: gs.notes.trim() || undefined, expectedAt: gs.expectedAt || undefined, lines: groupLines };
    });

    startTransition(async () => {
      const result = await createPurchaseOrdersAction({ groups });
      if (result.ok) {
        toast({ title: `Створено закупівлі: ${result.data.ids.length}` });
        router.push(result.data.firstId ? `/admin/purchases/${result.data.firstId}` : "/admin/purchases");
      } else {
        toast({ title: result.error, tone: "error" });
      }
    });
  }

  const summaryEntries = [...summary.entries()];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="grid gap-4">
        {orders.map((order) => (
          <Card
            key={order.orderNumber}
            title={`Замовлення ${order.orderNumber}`}
            description={[order.customerName, order.customerCity].filter(Boolean).join(" · ")}
            padded={false}
          >
            <ul className="divide-y divide-line-soft">
              {order.lines.map((line) => {
                const s = lineState[line.orderLineId];
                return (
                  <li key={line.orderLineId} className="grid gap-3 px-4 py-3 sm:px-5">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="check mt-0.5"
                        checked={s.checked}
                        onChange={(e) => patchLine(line.orderLineId, { checked: e.target.checked })}
                        aria-label={`Включити ${line.name}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink">{line.name}</p>
                        <p className="tabular text-[13px] text-ink-3">{line.sku}</p>
                      </div>
                    </div>
                    <div className="grid gap-2 pl-7 sm:grid-cols-[5rem_8rem_minmax(0,1fr)]">
                      <label className="grid gap-1 text-[12px] text-ink-3">
                        Кількість
                        <Input
                          type="number"
                          min={1}
                          value={s.qty}
                          onChange={(e) => patchLine(line.orderLineId, { qty: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
                          className="field-sm"
                          disabled={!s.checked}
                        />
                      </label>
                      <label className="grid gap-1 text-[12px] text-ink-3">
                        Ціна, ₴
                        <Input
                          type="number"
                          min={0}
                          value={s.cost}
                          onChange={(e) => patchLine(line.orderLineId, { cost: Math.max(0, Number(e.target.value) || 0) })}
                          className="field-sm text-right"
                          disabled={!s.checked}
                        />
                      </label>
                      <label className="grid gap-1 text-[12px] text-ink-3">
                        Постачальник
                        <Select
                          value={s.supplierId}
                          onChange={(e) => onSupplierChange(line, e.target.value)}
                          className="field-sm"
                          disabled={!s.checked}
                        >
                          <option value="">— оберіть —</option>
                          {line.offers.length > 0 && (
                            <optgroup label="Пропозиції">
                              {line.offers.map((o) => (
                                <option key={`offer-${o.supplierId}`} value={o.supplierId}>
                                  {o.code} · {formatPrice(o.cost)} · {availabilityMeta[o.availability].label}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          <optgroup label="Усі постачальники">
                            {suppliers.map((sup) => (
                              <option key={sup.id} value={sup.id}>
                                {sup.code} · {sup.name}
                              </option>
                            ))}
                          </optgroup>
                        </Select>
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>

      <Card title="Закупівлі за постачальниками" className="lg:sticky lg:top-4">
        {summaryEntries.length === 0 ? (
          <p className="text-[13px] text-ink-3">Позначте позиції та оберіть постачальника.</p>
        ) : (
          <div className="grid gap-4">
            {summaryEntries.map(([supplierId, info]) => {
              const supplier = supplierById.get(supplierId);
              const gs = groupSettings(supplierId);
              return (
                <div key={supplierId} className="grid gap-2 rounded-card border border-line-soft p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">{supplier?.name ?? supplierId}</span>
                    <span className="tabular text-sm font-semibold text-ink">{formatPrice(info.total)}</span>
                  </div>
                  <p className="text-[12.5px] text-ink-3">{info.count} поз.</p>
                  <Checkbox
                    label="Напряму покупцю"
                    checked={gs.shipDirect}
                    onChange={(e) => patchGroup(supplierId, { shipDirect: e.target.checked })}
                  />
                  <label className="grid gap-1 text-[12px] text-ink-3">
                    Очікувана дата
                    <Input type="date" value={gs.expectedAt} onChange={(e) => patchGroup(supplierId, { expectedAt: e.target.value })} className="field-sm" />
                  </label>
                  <Textarea
                    value={gs.notes}
                    onChange={(e) => patchGroup(supplierId, { notes: e.target.value })}
                    rows={2}
                    placeholder="Нотатки для закупівлі"
                    className="field-sm"
                    aria-label="Нотатки"
                  />
                </div>
              );
            })}
            <div className="flex items-baseline justify-between border-t border-line-soft pt-3">
              <span className="text-sm text-ink-2">Разом</span>
              <span className="tabular text-base font-semibold text-ink">{formatPrice(grandTotal)}</span>
            </div>
          </div>
        )}
        <Button block className="mt-4" onClick={submit} disabled={pending || summaryEntries.length === 0} aria-busy={pending || undefined}>
          Створити закупівлі
        </Button>
      </Card>
    </div>
  );
}
