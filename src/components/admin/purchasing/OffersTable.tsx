"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { ActionButton, DateTime, Money, StatusBadge } from "@/components/admin/ui";
import { toast } from "@/lib/store";
import { useRouter } from "next/navigation";
import type { OfferAvailability } from "@/lib/admin/types";
import { availabilityMeta } from "@/lib/admin/labels";
import { deleteOfferAction, upsertOfferAction } from "@/lib/admin/actions/purchasing";

export interface OfferRow {
  id: string;
  sku: string;
  productName: string | null;
  cost: number;
  availability: OfferAvailability;
  qty?: number;
  leadDays?: [number, number];
  updatedAt: string;
}

const AVAILABILITY_OPTIONS = (Object.keys(availabilityMeta) as OfferAvailability[]).map((value) => ({
  value,
  label: availabilityMeta[value].label,
}));

interface OffersTableProps {
  supplierId: string;
  offers: OfferRow[];
  canWrite: boolean;
}

export function OffersTable({ supplierId, offers, canWrite }: OffersTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="adm-scroll-x rounded-card border border-line-soft bg-white">
      <table className="adm-table">
        <thead>
          <tr>
            <th scope="col">Артикул</th>
            <th scope="col">Товар</th>
            <th scope="col" className="text-right">
              Ціна
            </th>
            <th scope="col">Наявність</th>
            <th scope="col" className="text-right">
              К-сть
            </th>
            <th scope="col">Термін, днів</th>
            <th scope="col" className="hidden md:table-cell">
              Оновлено
            </th>
            {canWrite && <th scope="col" className="text-right" />}
          </tr>
        </thead>
        <tbody>
          {offers.map((offer) =>
            editingId === offer.id ? (
              <OfferEditRow
                key={offer.id}
                supplierId={supplierId}
                offer={offer}
                onDone={() => setEditingId(null)}
              />
            ) : (
              <tr key={offer.id}>
                <td className="font-medium text-ink">{offer.sku}</td>
                <td className="text-ink-2">{offer.productName ?? <span className="text-ink-3">— не в каталозі</span>}</td>
                <td className="text-right tabular">
                  <Money value={offer.cost} />
                </td>
                <td>
                  <StatusBadge kind="availability" value={offer.availability} size="sm" />
                </td>
                <td className="text-right tabular text-ink-2">{offer.qty ?? "—"}</td>
                <td className="tabular text-ink-2">{offer.leadDays ? `${offer.leadDays[0]}–${offer.leadDays[1]}` : "—"}</td>
                <td className="hidden md:table-cell">
                  <DateTime iso={offer.updatedAt} className="text-ink-3" />
                </td>
                {canWrite && (
                  <td className="text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingId(offer.id)}
                        aria-label={`Редагувати ${offer.sku}`}
                        className="grid size-8 place-content-center rounded-btn text-ink-3 transition-colors hover:bg-mist hover:text-ink"
                      >
                        <Pencil aria-hidden className="size-4" strokeWidth={1.75} />
                      </button>
                      <ActionButton
                        action={() => deleteOfferAction({ id: offer.id, supplierId })}
                        variant="ghost"
                        size="sm"
                        successMessage="Позицію видалено"
                        confirm={{
                          title: "Видалити позицію прайсу?",
                          text: `Артикул ${offer.sku} буде видалено з прайс-листа.`,
                          confirmLabel: "Видалити",
                          tone: "danger",
                        }}
                        className="grid size-8 place-content-center !px-0 text-ink-3 hover:text-danger"
                      >
                        <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
                      </ActionButton>
                    </div>
                  </td>
                )}
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function OfferEditRow({ supplierId, offer, onDone }: { supplierId: string; offer: OfferRow; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cost, setCost] = useState(String(offer.cost));
  const [availability, setAvailability] = useState<OfferAvailability>(offer.availability);
  const [qty, setQty] = useState(offer.qty !== undefined ? String(offer.qty) : "");
  const [leadMin, setLeadMin] = useState(offer.leadDays ? String(offer.leadDays[0]) : "");
  const [leadMax, setLeadMax] = useState(offer.leadDays ? String(offer.leadDays[1]) : "");

  function save() {
    startTransition(async () => {
      const result = await upsertOfferAction({
        supplierId,
        sku: offer.sku,
        cost,
        availability,
        qty: qty === "" ? undefined : qty,
        leadMin: leadMin === "" ? undefined : leadMin,
        leadMax: leadMax === "" ? undefined : leadMax,
      });
      if (result.ok) {
        toast({ title: "Позицію збережено" });
        onDone();
        router.refresh();
      } else {
        toast({ title: result.error, tone: "error" });
      }
    });
  }

  return (
    <tr className="bg-mist-soft">
      <td className="font-medium text-ink">{offer.sku}</td>
      <td className="text-ink-3">{offer.productName ?? "— не в каталозі"}</td>
      <td className="text-right">
        <Input value={cost} onChange={(e) => setCost(e.target.value)} type="number" min={0} className="field-sm w-24 text-right" aria-label="Ціна" />
      </td>
      <td>
        <Select value={availability} onChange={(e) => setAvailability(e.target.value as OfferAvailability)} className="field-sm w-auto" aria-label="Наявність">
          {AVAILABILITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </td>
      <td className="text-right">
        <Input value={qty} onChange={(e) => setQty(e.target.value)} type="number" min={0} className="field-sm w-20 text-right" aria-label="Кількість" />
      </td>
      <td>
        <div className="flex items-center gap-1">
          <Input value={leadMin} onChange={(e) => setLeadMin(e.target.value)} type="number" min={0} className="field-sm w-16" aria-label="Термін від" />
          <span aria-hidden className="text-ink-3">–</span>
          <Input value={leadMax} onChange={(e) => setLeadMax(e.target.value)} type="number" min={0} className="field-sm w-16" aria-label="Термін до" />
        </div>
      </td>
      <td className="hidden md:table-cell" />
      <td className="text-right whitespace-nowrap">
        <div className="inline-flex items-center gap-1">
          <Button size="sm" onClick={save} disabled={pending} aria-busy={pending || undefined} className="!px-2">
            <Check aria-hidden className="size-4" strokeWidth={2} />
          </Button>
          <button
            type="button"
            onClick={onDone}
            disabled={pending}
            aria-label="Скасувати"
            className="grid size-8 place-content-center rounded-btn text-ink-3 transition-colors hover:bg-mist hover:text-ink"
          >
            <X aria-hidden className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </td>
    </tr>
  );
}
