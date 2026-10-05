"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Alert, Card, DateTime } from "@/components/admin/ui";
import { carrierLabel, deliveryMethodLabel } from "@/lib/admin/labels";
import type { Carrier, Order } from "@/lib/admin/types";
import { changeOrderStatusAction, checkTrackingAction, updateDeliveryAction } from "@/lib/admin/actions/orders";
import { useOrderAction } from "./use-order-action";

interface OrderDeliveryCardProps {
  order: Order;
  canWrite: boolean;
}

const CARRIERS: Carrier[] = ["nova_poshta", "ukrposhta", "other"];
const DELIVERED_CODES = new Set(["9", "10", "11"]);

function isTtn(value: string): boolean {
  return /^\d{14}$/.test(value.replace(/\s/g, ""));
}

/** Delivery card: method/address, carrier + TTN editing, Nova Poshta status refresh. */
export function OrderDeliveryCard({ order, canWrite }: OrderDeliveryCardProps) {
  const { pending, run } = useOrderAction();
  const [ttn, setTtn] = useState(order.delivery.trackingNumber ?? "");
  const [carrier, setCarrier] = useState<Carrier>(order.delivery.carrier ?? "nova_poshta");

  const tracking = order.delivery.tracking;
  const delivered = tracking ? DELIVERED_CODES.has(tracking.statusCode ?? "") : false;
  const trackUrl = order.delivery.trackingNumber
    ? `https://novaposhta.ua/tracking/?cargo_number=${encodeURIComponent(order.delivery.trackingNumber.replace(/\s/g, ""))}`
    : null;

  return (
    <Card title="Доставка">
      <div className="space-y-1 text-sm">
        <p className="text-ink">{deliveryMethodLabel[order.delivery.method]}</p>
        <p className="text-ink-2">
          {order.delivery.city}
          {order.delivery.address ? `, ${order.delivery.address}` : ""}
        </p>
        {order.delivery.cost !== undefined && (
          <p className="text-[13px] text-ink-3">
            Вартість доставки: {order.delivery.cost} ₴{order.delivery.costPayer === "shop" ? " (за наш рахунок)" : ""}
          </p>
        )}
      </div>

      {canWrite ? (
        <div className="mt-4 space-y-3">
          <Field label="Перевізник" htmlFor="del-carrier">
            <Select id="del-carrier" value={carrier} onChange={(e) => setCarrier(e.target.value as Carrier)}>
              {CARRIERS.map((c) => (
                <option key={c} value={c}>
                  {carrierLabel[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Номер ТТН" htmlFor="del-ttn" hint="14 цифр для Нової Пошти">
            <Input id="del-ttn" value={ttn} onChange={(e) => setTtn(e.target.value)} inputMode="numeric" placeholder="20450000000000" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() => run(() => updateDeliveryAction({ id: order.id, trackingNumber: ttn.trim() || undefined, carrier }), { success: "Доставку збережено" })}
            >
              Зберегти
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={pending || !isTtn(ttn)}
              onClick={() => run(() => checkTrackingAction({ id: order.id }), { success: "Статус оновлено" })}
            >
              Перевірити статус
            </Button>
          </div>
        </div>
      ) : (
        order.delivery.trackingNumber && <p className="tabular mt-3 text-sm text-ink-2">ТТН: {order.delivery.trackingNumber}</p>
      )}

      {tracking && (
        <div className="mt-4 rounded-card border border-line-soft bg-mist-soft p-3 text-[13px]">
          <p className="font-medium text-ink">{tracking.status}</p>
          <p className="mt-0.5 text-ink-3">
            Перевірено <DateTime iso={tracking.checkedAt} mode="relative" />
            {tracking.warehouse ? ` · ${tracking.warehouse}` : ""}
          </p>
          {trackUrl && (
            <a href={trackUrl} target="_blank" rel="noopener noreferrer" className="link mt-1 inline-flex items-center gap-1">
              Відстежити на сайті НП
              <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
            </a>
          )}
        </div>
      )}

      {canWrite && delivered && order.status === "in_transit" && (
        <Alert tone="success" className="mt-3" title="Посилку доставлено">
          <button
            type="button"
            className="link mt-1 font-medium"
            disabled={pending}
            onClick={() => run(() => changeOrderStatusAction({ id: order.id, to: "delivered" }), { success: "Позначено доставленим" })}
          >
            Позначити доставленим
          </button>
        </Alert>
      )}
    </Card>
  );
}
