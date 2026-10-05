import {
  availabilityMeta,
  fulfillmentMeta,
  orderStatusMeta,
  paymentStatusMeta,
  purchaseOrderStatusMeta,
  requestStatusMeta,
  reviewStatusMeta,
  type StatusMeta,
} from "@/lib/admin/labels";
import { Pill } from "./Pill";

export type StatusKind = "order" | "payment" | "po" | "request" | "review" | "fulfillment" | "availability";

const metaByKind: Record<StatusKind, Record<string, StatusMeta>> = {
  order: orderStatusMeta,
  payment: paymentStatusMeta,
  po: purchaseOrderStatusMeta,
  request: requestStatusMeta,
  review: reviewStatusMeta,
  fulfillment: fulfillmentMeta,
  availability: availabilityMeta,
};

interface StatusBadgeProps {
  kind: StatusKind;
  value: string;
  size?: "sm" | "md";
  withDot?: boolean;
}

/** Resolves label and tone from labels.ts; an unknown value shows a neutral chip with the raw value. */
export function StatusBadge({ kind, value, size = "md", withDot = true }: StatusBadgeProps) {
  const meta = metaByKind[kind][value];
  if (!meta) {
    return (
      <Pill tone="neutral" size={size} withDot={withDot}>
        {value}
      </Pill>
    );
  }
  return (
    <Pill tone={meta.tone} size={size} withDot={withDot} title={meta.hint}>
      {meta.label}
    </Pill>
  );
}
