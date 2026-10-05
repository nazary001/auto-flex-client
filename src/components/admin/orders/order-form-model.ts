import { formatPhone } from "@/lib/format";
import type { DeliveryMethod, PaymentMethod } from "@/lib/types";
import type { Carrier, Customer, CustomerRequest, Order, OrderLine, OrderSource, PaymentStatus } from "@/lib/admin/types";

/*
 * Plain form model shared by the order form (client) and the new/edit pages (server). Numbers
 * are kept as strings so inputs stay controlled; the form converts them on submit.
 */

export interface FormLine {
  id?: string;
  locked: boolean;
  productId: string | null;
  sku: string;
  name: string;
  optionLabel: string;
  price: string;
  qty: string;
  discount: string;
  costPrice: string;
  supplierId: string;
  note: string;
}

export interface FormState {
  source: OrderSource;
  customer: { customerId?: string; firstName: string; lastName: string; phone: string; email: string };
  lines: FormLine[];
  delivery: { method: DeliveryMethod; city: string; address: string; carrier: Carrier; cost: string; costPayer: "customer" | "shop" };
  payment: { method: PaymentMethod; status: PaymentStatus; paidAmount: string; paymentLink: string; invoiceNumber: string };
  orderDiscount: string;
  comment: string;
  vehicle: string;
  managerNote: string;
  doNotCall: boolean;
  assigneeId: string;
  tags: string;
}

const opt = (n: number | undefined): string => (n ? String(n) : "");

export function emptyLine(): FormLine {
  return { locked: false, productId: null, sku: "", name: "", optionLabel: "", price: "", qty: "1", discount: "", costPrice: "", supplierId: "", note: "" };
}

export function emptyForm(): FormState {
  return {
    source: "manual",
    customer: { firstName: "", lastName: "", phone: "", email: "" },
    lines: [],
    delivery: { method: "np_branch", city: "", address: "", carrier: "nova_poshta", cost: "", costPayer: "customer" },
    payment: { method: "cod", status: "unpaid", paidAmount: "", paymentLink: "", invoiceNumber: "" },
    orderDiscount: "",
    comment: "",
    vehicle: "",
    managerNote: "",
    doNotCall: false,
    assigneeId: "",
    tags: "",
  };
}

function lineToForm(line: OrderLine, keepId: boolean): FormLine {
  return {
    id: keepId ? line.id : undefined,
    locked: keepId ? Boolean(line.purchaseOrderId) : false,
    productId: line.productId,
    sku: line.sku,
    name: line.name,
    optionLabel: line.optionLabel ?? "",
    price: String(line.price),
    qty: String(line.qty),
    discount: opt(line.discount),
    costPrice: line.costPrice !== undefined ? String(line.costPrice) : "",
    supplierId: line.supplierId ?? "",
    note: line.note ?? "",
  };
}

/** Build the form from an existing order, for edit (keeps ids) or duplicate (fresh copy). */
export function formFromOrder(order: Order, mode: "edit" | "duplicate"): FormState {
  const keepId = mode === "edit";
  const base = emptyForm();
  return {
    ...base,
    source: keepId ? order.source : "manual",
    customer: {
      customerId: order.customer.customerId,
      firstName: order.customer.firstName,
      lastName: order.customer.lastName,
      phone: formatPhone(order.customer.phone),
      email: order.customer.email ?? "",
    },
    lines: order.lines.map((line) => lineToForm(line, keepId)),
    delivery: {
      method: order.delivery.method,
      city: order.delivery.city,
      address: order.delivery.address,
      carrier: order.delivery.carrier ?? "nova_poshta",
      cost: opt(order.delivery.cost),
      costPayer: order.delivery.costPayer ?? "customer",
    },
    payment: keepId
      ? {
          method: order.payment.method,
          status: order.payment.status,
          paidAmount: opt(order.payment.paidAmount),
          paymentLink: order.payment.paymentLink ?? "",
          invoiceNumber: order.payment.invoiceNumber ?? "",
        }
      : { ...base.payment, method: order.payment.method },
    orderDiscount: keepId ? opt(order.orderDiscount) : "",
    comment: keepId ? (order.comment ?? "") : "",
    vehicle: keepId ? (order.vehicle ?? "") : "",
    managerNote: keepId ? (order.managerNote ?? "") : "",
    doNotCall: order.doNotCall,
    assigneeId: keepId ? (order.assigneeId ?? "") : "",
    tags: keepId ? order.tags.join(", ") : "",
  };
}

export function formFromCustomer(customer: Customer): FormState {
  const base = emptyForm();
  return {
    ...base,
    customer: {
      customerId: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: formatPhone(customer.phone),
      email: customer.email ?? "",
    },
    delivery: { ...base.delivery, city: customer.city ?? "" },
    doNotCall: customer.doNotCall,
  };
}

export function formFromRequest(request: CustomerRequest): FormState {
  const base = emptyForm();
  const name = (request.name ?? "").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  const hasProduct = Boolean(request.productId || request.productSku || request.productName);
  return {
    ...base,
    source: "quick_order",
    customer: {
      ...base.customer,
      firstName: parts[0] ?? "",
      lastName: parts.slice(1).join(" "),
      phone: formatPhone(request.phone),
    },
    comment: request.comment ?? "",
    lines: hasProduct
      ? [{ ...emptyLine(), productId: request.productId ?? null, sku: request.productSku ?? "", name: request.productName ?? "" }]
      : [],
  };
}
