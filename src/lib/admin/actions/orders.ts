"use server";

import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isValidUaPhone, normalizePhone } from "@/lib/format";
import { searchCatalog } from "@/lib/catalog";
import { orderStatusMeta, paymentStatusMeta } from "@/lib/admin/labels";
import type { Order, OrderCreateInput, OrderLine, TrackingSnapshot } from "@/lib/admin/types";
import { compact, nowIso } from "@/lib/server/db/util";
import {
  addOrderEvent,
  changeOrderStatus,
  createOrder,
  getOrder,
  updateOrder,
} from "@/lib/server/db/repos/orders";
import { getCustomerByPhone } from "@/lib/server/db/repos/customers";
import { normalizeSku, offersForMany } from "@/lib/server/db/repos/offers";
import { getSuppliersMap } from "@/lib/server/db/repos/suppliers";
import { getRequest, updateRequest } from "@/lib/server/db/repos/requests";
import { getSettings } from "@/lib/server/db/repos/settings";
import { isTrackingNumber, trackDocument, TrackingError } from "@/lib/server/nova-poshta";
import { ActionError, idSchema, moneySchema, optionalText, runAction, type ActionResult } from "./_action";

/*
 * Server actions for the orders module. Each mutation runs through `runAction` (parse → auth →
 * run → map errors), records an audit entry and revalidates the affected admin paths.
 */

// ── shared zod pieces ───────────────────────────────────────

const orderStatusEnum = z.enum([
  "new",
  "confirmed",
  "sourcing",
  "in_transit",
  "delivered",
  "completed",
  "on_hold",
  "cancelled",
  "returned",
]);
const paymentStatusEnum = z.enum(["unpaid", "prepaid", "paid", "refunded", "partially_refunded"]);
const deliveryMethodEnum = z.enum(["np_branch", "np_locker", "np_courier", "ukrposhta"]);
const paymentMethodEnum = z.enum(["cod", "card_online", "installments", "invoice"]);
const sourceEnum = z.enum(["website", "phone", "manual", "quick_order"]);
const carrierEnum = z.enum(["nova_poshta", "ukrposhta", "other"]);

const reqText = (max: number) => z.string().trim().min(1).max(max);
const qtySchema = z.coerce.number().int().min(1).max(99);

const emailOptional = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((v) => v || undefined)
  .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), { message: "Перевірте адресу електронної пошти." });

const customerSchema = z.object({
  customerId: optionalText(80),
  firstName: reqText(80),
  lastName: reqText(80),
  phone: z
    .string()
    .trim()
    .min(5)
    .max(30)
    .refine((v) => isValidUaPhone(v), { message: "Вкажіть номер телефону у форматі +38 (0XX) XXX-XX-XX." }),
  email: emailOptional,
});

const deliverySchema = z.object({
  method: deliveryMethodEnum,
  city: reqText(80),
  address: reqText(160),
  carrier: carrierEnum.optional(),
  cost: moneySchema.optional(),
  costPayer: z.enum(["customer", "shop"]).optional(),
});

const paymentSchema = z.object({
  method: paymentMethodEnum,
  status: paymentStatusEnum.optional(),
  paidAmount: moneySchema.optional(),
  paymentLink: optionalText(400),
  invoiceNumber: optionalText(60),
});

const lineSchema = z.object({
  id: optionalText(80),
  productId: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  sku: reqText(80),
  name: reqText(200),
  optionLabel: optionalText(160),
  price: moneySchema,
  qty: qtySchema,
  discount: moneySchema.optional(),
  costPrice: moneySchema.optional(),
  supplierId: optionalText(80),
  note: optionalText(300),
});

const orderBodySchema = z.object({
  source: sourceEnum.optional(),
  customer: customerSchema,
  delivery: deliverySchema,
  payment: paymentSchema,
  lines: z.array(lineSchema).min(1, "Додайте хоча б одну позицію.").max(50),
  orderDiscount: moneySchema.optional(),
  comment: optionalText(600),
  vehicle: optionalText(160),
  doNotCall: z.boolean().optional(),
  managerNote: optionalText(1000),
  assigneeId: optionalText(80),
  tags: z.array(z.string().trim().max(40)).optional(),
  requestId: optionalText(80),
});

type OrderBody = z.infer<typeof orderBodySchema>;

function toCreateInput(body: OrderBody): OrderCreateInput {
  return {
    source: body.source ?? "manual",
    customer: {
      customerId: body.customer.customerId,
      firstName: body.customer.firstName,
      lastName: body.customer.lastName,
      phone: body.customer.phone,
      email: body.customer.email,
    },
    delivery: {
      method: body.delivery.method,
      city: body.delivery.city,
      address: body.delivery.address,
      carrier: body.delivery.carrier,
      cost: body.delivery.cost,
      costPayer: body.delivery.costPayer,
    },
    payment: {
      method: body.payment.method,
      status: body.payment.status,
      paidAmount: body.payment.paidAmount,
      paymentLink: body.payment.paymentLink,
    },
    lines: body.lines.map((line) => ({
      productId: line.productId,
      sku: line.sku,
      name: line.name,
      optionLabel: line.optionLabel,
      price: line.price,
      qty: line.qty,
      discount: line.discount,
      costPrice: line.costPrice,
      supplierId: line.supplierId,
      note: line.note,
    })),
    orderDiscount: body.orderDiscount,
    comment: body.comment,
    vehicle: body.vehicle,
    doNotCall: body.doNotCall,
    managerNote: body.managerNote,
    assigneeId: body.assigneeId,
    tags: body.tags,
  };
}

async function requireOrder(db: Db, id: string): Promise<Order> {
  const order = await getOrder(db, id);
  if (!order) throw new ActionError("Замовлення не знайдено.");
  return order;
}

function revalidateOrder(id: string): void {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
}

// ── create / update ─────────────────────────────────────────

export async function createOrderAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction({
    permission: "orders:write",
    schema: orderBodySchema,
    input,
    run: async (body, ctx) => {
      const order = await createOrder(ctx.db, toCreateInput(body), ctx.actor);

      if (body.payment.invoiceNumber || body.payment.status === "paid") {
        const payment = compact({
          ...order.payment,
          invoiceNumber: body.payment.invoiceNumber,
          paidAt: order.payment.status === "paid" ? nowIso() : order.payment.paidAt,
        });
        await updateOrder(ctx.db, order.id, { payment }, ctx.actor);
      }

      if (body.requestId) {
        const request = await getRequest(ctx.db, body.requestId);
        if (request && request.status !== "done") {
          await updateRequest(ctx.db, body.requestId, { status: "done", orderId: order.id });
          revalidatePath("/admin/requests");
        }
      }

      await ctx.audit({
        action: "order.create",
        entity: "order",
        entityId: order.id,
        summary: `Замовлення ${order.number} створено`,
      });
      revalidateOrder(order.id);
      return { id: order.id };
    },
  });
}

const updateSchema = orderBodySchema.extend({ id: idSchema });

export async function updateOrderAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction({
    permission: "orders:write",
    schema: updateSchema,
    input,
    run: async (body, ctx) => {
      const current = await requireOrder(ctx.db, body.id);

      const lockedIds = current.lines.filter((l) => l.purchaseOrderId).map((l) => l.id);
      const submittedIds = new Set(body.lines.map((l) => l.id).filter(Boolean));
      for (const locked of lockedIds) {
        if (!submittedIds.has(locked)) throw new ActionError("Позицію, що вже в закупівлі, не можна видалити.");
      }

      const byId = new Map(current.lines.map((l) => [l.id, l]));
      const lines: OrderLine[] = body.lines.map((s) => {
        const existing = s.id ? byId.get(s.id) : undefined;
        if (existing) {
          return compact({
            ...existing,
            productId: s.productId,
            sku: s.sku,
            name: s.name,
            optionLabel: s.optionLabel,
            price: Math.round(s.price),
            qty: s.qty,
            discount: Math.round(s.discount ?? 0),
            costPrice: s.costPrice ?? existing.costPrice,
            supplierId: s.supplierId ?? existing.supplierId,
            note: s.note,
          });
        }
        return compact({
          id: randomUUID(),
          productId: s.productId,
          sku: s.sku,
          name: s.name,
          optionLabel: s.optionLabel,
          price: Math.round(s.price),
          qty: s.qty,
          discount: Math.round(s.discount ?? 0),
          costPrice: s.costPrice,
          supplierId: s.supplierId,
          fulfillment: "pending" as const,
          note: s.note,
        });
      });

      const delivery = { ...current.delivery, method: body.delivery.method, city: body.delivery.city, address: body.delivery.address };
      if (body.delivery.carrier !== undefined) delivery.carrier = body.delivery.carrier;
      if (body.delivery.cost !== undefined) delivery.cost = body.delivery.cost;
      if (body.delivery.costPayer !== undefined) delivery.costPayer = body.delivery.costPayer;

      const patch: Partial<Order> = {
        customer: compact({
          customerId: current.customer.customerId,
          firstName: body.customer.firstName,
          lastName: body.customer.lastName,
          phone: normalizePhone(body.customer.phone),
          email: body.customer.email,
        }),
        delivery: compact(delivery),
        payment: { ...current.payment, method: body.payment.method },
        lines,
        orderDiscount: body.orderDiscount ?? current.orderDiscount,
        comment: body.comment,
        vehicle: body.vehicle,
        managerNote: body.managerNote,
        doNotCall: body.doNotCall ?? current.doNotCall,
        assigneeId: body.assigneeId || undefined,
        tags: body.tags ?? current.tags,
      };

      const order = await updateOrder(ctx.db, body.id, patch, ctx.actor, {
        type: "lines_changed",
        text: "Замовлення відредаговано",
      });
      await ctx.audit({
        action: "order.update",
        entity: "order",
        entityId: order.id,
        summary: `Замовлення ${order.number} відредаговано`,
      });
      revalidateOrder(order.id);
      return { id: order.id };
    },
  });
}

// ── status ──────────────────────────────────────────────────

const statusSchema = z.object({
  id: idSchema,
  to: orderStatusEnum,
  reason: optionalText(300),
  markPaid: z.boolean().optional(),
});

export async function changeOrderStatusAction(input: unknown): Promise<ActionResult<{ status: string }>> {
  return runAction({
    permission: "orders:write",
    schema: statusSchema,
    input,
    run: async ({ id, to, reason, markPaid }, ctx) => {
      const order = await changeOrderStatus(ctx.db, id, to, ctx.actor, { reason, markPaid });
      await ctx.audit({
        action: "order.status",
        entity: "order",
        entityId: id,
        summary: `${order.number} → ${orderStatusMeta[to].label}`,
        data: { to, reason },
      });
      revalidateOrder(id);
      return { status: order.status };
    },
  });
}

// ── payment ─────────────────────────────────────────────────

const updatePaymentSchema = z.object({
  id: idSchema,
  status: paymentStatusEnum,
  paidAmount: moneySchema.optional(),
  paymentLink: optionalText(400),
  invoiceNumber: optionalText(60),
});

export async function updatePaymentAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction({
    permission: "orders:write",
    schema: updatePaymentSchema,
    input,
    run: async ({ id, status, paidAmount, paymentLink, invoiceNumber }, ctx) => {
      const order = await requireOrder(ctx.db, id);
      const now = nowIso();
      const amount = paidAmount ?? (status === "paid" ? order.total : order.payment.paidAmount);
      const payment = compact({
        ...order.payment,
        status,
        paidAmount: amount,
        paidAt: status === "paid" || status === "prepaid" ? (order.payment.paidAt ?? now) : undefined,
        paymentLink,
        invoiceNumber,
      });
      await updateOrder(ctx.db, id, { payment }, ctx.actor, {
        type: "payment_changed",
        text: `Оплата: ${paymentStatusMeta[status].label}`,
        data: { status },
      });
      await ctx.audit({
        action: "order.payment",
        entity: "order",
        entityId: id,
        summary: `${order.number}: оплата — ${paymentStatusMeta[status].label}`,
      });
      revalidateOrder(id);
      return undefined;
    },
  });
}

// ── delivery / tracking ─────────────────────────────────────

const updateDeliverySchema = z.object({
  id: idSchema,
  trackingNumber: optionalText(40),
  carrier: carrierEnum.optional(),
});

export async function updateDeliveryAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction({
    permission: "orders:write",
    schema: updateDeliverySchema,
    input,
    run: async ({ id, trackingNumber, carrier }, ctx) => {
      const order = await requireOrder(ctx.db, id);
      const ttn = trackingNumber ? trackingNumber.replace(/\s/g, "") : undefined;
      const delivery = compact({ ...order.delivery, trackingNumber: ttn, carrier: carrier ?? order.delivery.carrier });
      await updateOrder(ctx.db, id, { delivery }, ctx.actor, {
        type: "delivery_changed",
        text: ttn ? `Номер ТТН: ${ttn}` : "Номер ТТН очищено",
      });
      await ctx.audit({ action: "order.delivery", entity: "order", entityId: id, summary: `${order.number}: доставку оновлено` });
      revalidateOrder(id);
      return undefined;
    },
  });
}

const checkTrackingSchema = z.object({ id: idSchema });

export async function checkTrackingAction(input: unknown): Promise<ActionResult<{ status: string; delivered: boolean }>> {
  return runAction({
    permission: "orders:write",
    schema: checkTrackingSchema,
    input,
    run: async ({ id }, ctx) => {
      const order = await requireOrder(ctx.db, id);
      const ttn = order.delivery.trackingNumber;
      if (!ttn || !isTrackingNumber(ttn)) throw new ActionError("Спочатку додайте коректний номер ТТН (14 цифр).");
      const settings = await getSettings(ctx.db);
      let result;
      try {
        result = await trackDocument(ttn, { apiKey: settings.novaPoshta.apiKey });
      } catch (error) {
        if (error instanceof TrackingError) throw new ActionError(error.message);
        throw new ActionError("Не вдалося перевірити статус посилки.");
      }
      const snapshot: TrackingSnapshot = compact({
        status: result.status,
        statusCode: result.statusCode,
        checkedAt: nowIso(),
        scheduledDeliveryDate: result.scheduledDeliveryDate,
        warehouse: result.warehouseRecipient,
      });
      const delivery = { ...order.delivery, tracking: snapshot };
      await updateOrder(ctx.db, id, { delivery }, ctx.actor, {
        type: "tracking_checked",
        text: `Статус посилки: ${result.status}`,
        data: { statusCode: result.statusCode },
      });
      await ctx.audit({ action: "order.tracking", entity: "order", entityId: id, summary: `${order.number}: ${result.status}` });
      revalidateOrder(id);
      return { status: result.status, delivered: result.delivered };
    },
  });
}

// ── timeline / assignment / tags ────────────────────────────

const noteSchema = z.object({
  id: idSchema,
  type: z.enum(["note", "call"]),
  text: reqText(1000),
});

export async function addOrderNoteAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction({
    permission: "orders:write",
    schema: noteSchema,
    input,
    run: async ({ id, type, text }, ctx) => {
      const order = await requireOrder(ctx.db, id);
      await addOrderEvent(ctx.db, id, type, ctx.actor, text);
      await ctx.audit({
        action: type === "call" ? "order.call" : "order.note",
        entity: "order",
        entityId: id,
        summary: `${order.number}: ${text.slice(0, 120)}`,
      });
      revalidatePath(`/admin/orders/${id}`);
      return undefined;
    },
  });
}

const assignSchema = z.object({ id: idSchema, assigneeId: optionalText(80) });

export async function assignOrderAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction({
    permission: "orders:write",
    schema: assignSchema,
    input,
    run: async ({ id, assigneeId }, ctx) => {
      const order = await requireOrder(ctx.db, id);
      await updateOrder(ctx.db, id, { assigneeId: assigneeId || undefined }, ctx.actor);
      await ctx.audit({
        action: "order.assign",
        entity: "order",
        entityId: id,
        summary: assigneeId ? `${order.number}: призначено відповідального` : `${order.number}: знято відповідального`,
        data: { assigneeId: assigneeId || null },
      });
      revalidateOrder(id);
      return undefined;
    },
  });
}

const tagsSchema = z.object({ id: idSchema, tags: z.array(z.string().trim().max(40)) });

export async function setTagsAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction({
    permission: "orders:write",
    schema: tagsSchema,
    input,
    run: async ({ id, tags }, ctx) => {
      const order = await requireOrder(ctx.db, id);
      const clean = [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, 20);
      await updateOrder(ctx.db, id, { tags: clean }, ctx.actor);
      await ctx.audit({ action: "order.tags", entity: "order", entityId: id, summary: `${order.number}: мітки оновлено` });
      revalidateOrder(id);
      return undefined;
    },
  });
}

// ── bulk ────────────────────────────────────────────────────

const bulkIds = z.array(idSchema).min(1, "Оберіть хоча б одне замовлення.").max(200);

const bulkAssignSchema = z.object({ ids: bulkIds, assigneeId: optionalText(80) });

export async function bulkAssignAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  return runAction({
    permission: "orders:write",
    schema: bulkAssignSchema,
    input,
    run: async ({ ids, assigneeId }, ctx) => {
      let count = 0;
      for (const id of ids) {
        const order = await getOrder(ctx.db, id);
        if (!order) continue;
        await updateOrder(ctx.db, id, { assigneeId: assigneeId || undefined }, ctx.actor);
        count++;
      }
      await ctx.audit({
        action: "order.bulk_assign",
        entity: "order",
        entityId: ids[0],
        summary: `Призначено відповідального для ${count} замовлень`,
        data: { ids, assigneeId: assigneeId || null },
      });
      revalidatePath("/admin/orders");
      return { count };
    },
  });
}

const bulkStatusSchema = z.object({ ids: bulkIds, to: orderStatusEnum, reason: optionalText(300) });

export async function bulkStatusAction(input: unknown): Promise<ActionResult<{ count: number; failed: number }>> {
  return runAction({
    permission: "orders:write",
    schema: bulkStatusSchema,
    input,
    run: async ({ ids, to, reason }, ctx) => {
      let count = 0;
      let failed = 0;
      for (const id of ids) {
        try {
          await changeOrderStatus(ctx.db, id, to, ctx.actor, { reason });
          count++;
        } catch {
          failed++;
        }
      }
      if (count === 0) throw new ActionError("Жодне замовлення не вдалося перевести в цей статус.");
      await ctx.audit({
        action: "order.bulk_status",
        entity: "order",
        entityId: ids[0],
        summary: `Статус «${orderStatusMeta[to].label}» для ${count} замовлень`,
        data: { ids, to, failed },
      });
      revalidatePath("/admin/orders");
      return { count, failed };
    },
  });
}

// ── messages ────────────────────────────────────────────────

const logMessageSchema = z.object({ id: idSchema, templateId: reqText(80) });

export async function logMessageAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction({
    permission: "orders:write",
    schema: logMessageSchema,
    input,
    run: async ({ id, templateId }, ctx) => {
      const order = await requireOrder(ctx.db, id);
      const settings = await getSettings(ctx.db);
      const template = settings.templates.find((t) => t.id === templateId);
      if (!template) throw new ActionError("Шаблон повідомлення не знайдено.");
      await addOrderEvent(ctx.db, id, "message_sent", ctx.actor, `Надіслано повідомлення: ${template.name}`, {
        templateId,
      });
      await ctx.audit({
        action: "order.message",
        entity: "order",
        entityId: id,
        summary: `${order.number}: повідомлення «${template.name}»`,
      });
      revalidatePath(`/admin/orders/${id}`);
      return undefined;
    },
  });
}

// ── lookups (read) ──────────────────────────────────────────

export interface CustomerLookupResult {
  found: boolean;
  customerId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  city?: string;
  doNotCall?: boolean;
  ordersCount?: number;
  totalSpent?: number;
  tags?: string[];
}

const lookupSchema = z.object({ phone: z.string().trim().min(3).max(30) });

export async function lookupCustomerAction(input: unknown): Promise<ActionResult<CustomerLookupResult>> {
  return runAction({
    permission: "orders:read",
    schema: lookupSchema,
    input,
    run: async ({ phone }, ctx) => {
      const customer = await getCustomerByPhone(ctx.db, phone);
      if (!customer) return { found: false };
      return {
        found: true,
        customerId: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        city: customer.city,
        doNotCall: customer.doNotCall,
        ordersCount: customer.ordersCount,
        totalSpent: customer.totalSpent,
        tags: customer.tags,
      };
    },
  });
}

export interface ProductSearchItem {
  id: string;
  slug: string;
  sku: string;
  name: string;
  brandName: string;
  price: number;
  oldPrice?: number;
  stock: string;
  option?: { id: string; name: string; values: { id: string; label: string; priceDelta: number }[] };
  bestOffer?: { supplierId: string; supplierName: string; cost: number };
}

const productSearchSchema = z.object({ q: z.string().trim().max(80) });

export async function searchProductsAction(input: unknown): Promise<ActionResult<{ products: ProductSearchItem[] }>> {
  return runAction({
    permission: "orders:read",
    schema: productSearchSchema,
    input,
    run: async ({ q }, ctx) => {
      if (q.length < 2) return { products: [] };
      const result = await searchCatalog(q, 10);
      const [offersMap, suppliers] = await Promise.all([
        offersForMany(
          ctx.db,
          result.products.map((p) => ({ productId: p.id, sku: p.sku })),
        ),
        getSuppliersMap(ctx.db),
      ]);
      const products: ProductSearchItem[] = result.products.map((p) => {
        const list = offersMap.get(p.id) ?? offersMap.get(normalizeSku(p.sku)) ?? [];
        const best = list.find((o) => o.availability !== "none") ?? list[0];
        return {
          id: p.id,
          slug: p.slug,
          sku: p.sku,
          name: p.name,
          brandName: p.brandName ?? "",
          price: p.price,
          oldPrice: p.oldPrice,
          stock: p.stock,
          option: p.option,
          bestOffer: best
            ? { supplierId: best.supplierId, supplierName: suppliers.get(best.supplierId)?.name ?? "", cost: best.cost }
            : undefined,
        };
      });
      return { products };
    },
  });
}
