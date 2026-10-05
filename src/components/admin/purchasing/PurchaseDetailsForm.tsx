"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/Field";
import { toast } from "@/lib/store";
import type { PurchaseOrder } from "@/lib/admin/types";
import { updatePurchaseOrderAction } from "@/lib/admin/actions/purchasing";

/** Nova Poshta public tracking page for a waybill number. */
export function novaPoshtaTrackingUrl(ttn: string): string {
  return `https://tracking.novaposhta.ua/#/uk/tracking?number=${encodeURIComponent(ttn.trim())}`;
}

interface PurchaseDetailsFormProps {
  po: PurchaseOrder;
}

export function PurchaseDetailsForm({ po }: PurchaseDetailsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [supplierRef, setSupplierRef] = useState(po.supplierRef ?? "");
  const [trackingNumber, setTrackingNumber] = useState(po.trackingNumber ?? "");
  const [expectedAt, setExpectedAt] = useState(po.expectedAt ? po.expectedAt.slice(0, 10) : "");
  const [shipDirect, setShipDirect] = useState(po.shipDirect);
  const [notes, setNotes] = useState(po.notes ?? "");

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updatePurchaseOrderAction({
        id: po.id,
        supplierRef: supplierRef.trim(),
        trackingNumber: trackingNumber.trim(),
        expectedAt: expectedAt || "",
        notes: notes.trim(),
        shipDirect,
      });
      if (result.ok) {
        toast({ title: "Деталі закупівлі збережено" });
        router.refresh();
      } else {
        toast({ title: result.error, tone: "error" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Field label="Номер / рахунок постачальника" htmlFor="po-ref">
        <Input id="po-ref" value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} placeholder="Напр. INV-10234" />
      </Field>

      <Field label="Номер ТТН" htmlFor="po-ttn">
        <Input id="po-ttn" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} inputMode="numeric" placeholder="20450000000000" />
      </Field>
      {po.trackingNumber && (
        <a
          href={novaPoshtaTrackingUrl(po.trackingNumber)}
          target="_blank"
          rel="noopener noreferrer"
          className="link -mt-2 inline-flex w-fit items-center gap-1.5 text-sm font-medium"
        >
          Відстежити на Новій Пошті
          <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
        </a>
      )}

      <Field label="Очікувана дата" htmlFor="po-expected">
        <Input id="po-expected" type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} />
      </Field>

      <Checkbox
        label="Відправка напряму покупцю"
        description="Постачальник надсилає посилку одразу на адресу клієнта."
        checked={shipDirect}
        onChange={(e) => setShipDirect(e.target.checked)}
      />

      <Field label="Нотатки" htmlFor="po-notes">
        <Textarea id="po-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Домовленості, коментарі для себе" />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending} aria-busy={pending || undefined}>
          Зберегти
        </Button>
      </div>
    </form>
  );
}
