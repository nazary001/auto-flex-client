/*
 * Human-readable document numbers. The sequence itself comes from an atomic counter
 * in the database (see db/util nextSequence); these helpers only format and parse.
 *
 *   orders:          AF-YYMMDD-NNNN   (NNNN starts at 1000 every day)
 *   purchase orders: PO-YYMMDD-NN     (NN starts at 01 every day)
 */

export function dateStamp(date: Date = new Date()): string {
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

export function formatOrderNumber(stamp: string, seq: number): string {
  return `AF-${stamp}-${String(999 + seq).padStart(4, "0")}`;
}

export function formatPurchaseOrderNumber(stamp: string, seq: number): string {
  return `PO-${stamp}-${String(seq).padStart(2, "0")}`;
}

export const ORDER_NUMBER_RE = /^AF-\d{6}-\d{3,5}$/;
export const PURCHASE_ORDER_NUMBER_RE = /^PO-\d{6}-\d{2,4}$/;

/** Counter keys are per document type and per day so sequences restart daily */
export function orderCounterKey(stamp: string): string {
  return `order:${stamp}`;
}

export function purchaseOrderCounterKey(stamp: string): string {
  return `po:${stamp}`;
}
