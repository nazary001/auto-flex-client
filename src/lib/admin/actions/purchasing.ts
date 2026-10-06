"use server";

import type { Db } from "mongodb";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { OfferAvailability } from "@/lib/admin/types";
import { parseNumber } from "@/lib/admin/domain/csv";
import { cols } from "@/lib/server/db/collections";
import {
  ActionError,
  fail,
  idSchema,
  moneySchema,
  optionalText,
  runAction,
  type ActionResult,
} from "./_action";

const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
import {
  createPurchaseOrder,
  propagateDirectShipmentTracking,
  setPurchaseOrderStatus,
  updatePurchaseOrder,
} from "@/lib/server/db/repos/purchase-orders";
import { getOrders } from "@/lib/server/db/repos/orders";
import { createSupplier, DuplicateSupplierCodeError, getSupplier, updateSupplier } from "@/lib/server/db/repos/suppliers";
import { deleteOffer, normalizeSku, upsertOffers, type OfferInput } from "@/lib/server/db/repos/offers";

/*
 * Mutations for suppliers, supplier price lists and purchase orders. Every action is built with
 * runAction (parse → auth "purchases:write" → run → audit), returns an ActionResult and
 * revalidates the admin paths it touched.
 */

// ── shared helpers ──────────────────────────────────────────

/** Resolves a catalog product id from a supplier SKU (compares the raw and upper-cased forms). */
async function resolveProductIdBySku(db: Db, sku: string): Promise<string | null> {
  const trimmed = sku.trim();
  if (!trimmed) return null;
  const doc = await cols(db).products.findOne(
    { skus: { $in: [trimmed, trimmed.toUpperCase()] } },
    { projection: { _id: 1 } },
  );
  return doc?._id ?? null;
}

/** Resolves many SKUs in one query (keys cover the raw and upper-cased forms of every product SKU). */
async function productIdsBySku(db: Db, skus: string[]): Promise<Map<string, string>> {
  const forms = new Set<string>();
  for (const sku of skus) {
    const trimmed = sku.trim();
    if (trimmed) {
      forms.add(trimmed);
      forms.add(trimmed.toUpperCase());
    }
  }
  if (forms.size === 0) return new Map();
  const docs = await cols(db)
    .products.find({ skus: { $in: [...forms] } }, { projection: { _id: 1, skus: 1 } })
    .toArray();
  const map = new Map<string, string>();
  for (const doc of docs) {
    for (const s of doc.skus ?? []) {
      map.set(s, doc._id);
      map.set(s.toUpperCase(), doc._id);
    }
  }
  return map;
}

function leadRange(min?: number, max?: number): [number, number] | undefined {
  if (min === undefined && max === undefined) return undefined;
  const lo = min ?? max ?? 0;
  const hi = max ?? min ?? 0;
  return [Math.min(lo, hi), Math.max(lo, hi)];
}

const availabilitySchema = z.enum(["in_stock", "on_order", "none"]);

// ── purchase orders ─────────────────────────────────────────

const poLineSchema = z.object({
  orderId: idSchema,
  orderLineId: idSchema,
  qty: z.coerce.number().int().min(1).max(100_000),
  cost: moneySchema,
});

const createPurchaseOrdersSchema = z.object({
  groups: z
    .array(
      z.object({
        supplierId: idSchema,
        shipDirect: z.boolean().optional(),
        notes: optionalText(2000),
        expectedAt: optionalText(40),
        lines: z.array(poLineSchema).min(1),
      }),
    )
    .min(1, "Оберіть хоча б одну позицію."),
});

export async function createPurchaseOrdersAction(
  input: unknown,
): Promise<ActionResult<{ ids: string[]; firstId: string | null }>> {
  return runAction({
    permission: "purchases:write",
    schema: createPurchaseOrdersSchema,
    input,
    run: async ({ groups }, ctx) => {
      // Validate the whole batch before writing anything: creating a PO marks its order lines and
      // there is no transaction, so a failure on a later group would otherwise orphan earlier POs.
      const batchOrders = await getOrders(ctx.db, [...new Set(groups.flatMap((g) => g.lines.map((l) => l.orderId)))]);
      const orderById = new Map(batchOrders.map((o) => [o.id, o]));
      const claimed = new Set<string>();
      for (const group of groups) {
        const supplier = await getSupplier(ctx.db, group.supplierId);
        if (!supplier) throw new ActionError("Постачальника не знайдено.");
        for (const { orderId, orderLineId } of group.lines) {
          const line = orderById.get(orderId)?.lines.find((l) => l.id === orderLineId);
          if (!line) throw new ActionError("Позицію замовлення не знайдено.");
          if (line.purchaseOrderId) throw new ActionError(`Позиція «${line.name}» уже в закупівлі.`);
          if (line.fulfillment === "cancelled") throw new ActionError(`Позиція «${line.name}» скасована.`);
          const key = `${orderId}:${orderLineId}`;
          if (claimed.has(key)) throw new ActionError(`Позиція «${line.name}» додана до двох закупівель.`);
          claimed.add(key);
        }
      }

      const ids: string[] = [];
      const orderIds = new Set<string>();
      for (const group of groups) {
        const po = await createPurchaseOrder(
          ctx.db,
          {
            supplierId: group.supplierId,
            shipDirect: group.shipDirect,
            notes: group.notes,
            expectedAt: group.expectedAt,
            status: "draft",
            lines: group.lines.map((l) => ({ orderId: l.orderId, orderLineId: l.orderLineId, qty: l.qty, cost: l.cost })),
          },
          ctx.actor,
        );
        ids.push(po.id);
        for (const line of po.lines) orderIds.add(line.orderId);
        await ctx.audit({
          action: "po.create",
          entity: "purchase_order",
          entityId: po.id,
          summary: `Закупівля ${po.number} створена (${po.lines.length} поз.)`,
          data: { supplierId: po.supplierId, totalCost: po.totalCost },
        });
      }
      revalidatePath("/admin/purchases");
      revalidatePath("/admin/orders");
      revalidatePath("/admin/suppliers");
      for (const id of ids) revalidatePath(`/admin/purchases/${id}`);
      for (const orderId of orderIds) revalidatePath(`/admin/orders/${orderId}`);
      return { ids, firstId: ids[0] ?? null };
    },
  });
}

const setStatusSchema = z.object({
  id: idSchema,
  to: z.enum(["draft", "sent", "confirmed", "shipped", "received", "cancelled"]),
  trackingNumber: optionalText(60),
  supplierRef: optionalText(120),
});

export async function setPurchaseOrderStatusAction(input: unknown): Promise<ActionResult<{ status: string }>> {
  return runAction({
    permission: "purchases:write",
    schema: setStatusSchema,
    input,
    run: async ({ id, to, trackingNumber, supplierRef }, ctx) => {
      const po = await setPurchaseOrderStatus(ctx.db, id, to, ctx.actor, { trackingNumber, supplierRef });
      await ctx.audit({
        action: "po.status",
        entity: "purchase_order",
        entityId: po.id,
        summary: `Закупівля ${po.number} → ${to}`,
        data: { to, trackingNumber },
      });
      revalidatePath("/admin/purchases");
      revalidatePath(`/admin/purchases/${po.id}`);
      revalidatePath("/admin/orders");
      revalidatePath("/admin/suppliers");
      for (const orderId of new Set(po.lines.map((l) => l.orderId))) revalidatePath(`/admin/orders/${orderId}`);
      return { status: po.status };
    },
  });
}

const updatePoSchema = z.object({
  id: idSchema,
  supplierRef: optionalText(120),
  trackingNumber: optionalText(60),
  expectedAt: optionalText(40),
  notes: optionalText(2000),
  shipDirect: z.boolean(),
});

export async function updatePurchaseOrderAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction({
    permission: "purchases:write",
    schema: updatePoSchema,
    input,
    run: async ({ id, supplierRef, trackingNumber, expectedAt, notes, shipDirect }, ctx) => {
      const po = await updatePurchaseOrder(ctx.db, id, { supplierRef, trackingNumber, expectedAt, notes, shipDirect });
      if (!po) throw new ActionError("Закупівлю не знайдено.");
      // A drop-ship parcel may ship with an empty TTN and get its number here — carry it to the orders.
      await propagateDirectShipmentTracking(ctx.db, po, ctx.actor);
      await ctx.audit({
        action: "po.update",
        entity: "purchase_order",
        entityId: po.id,
        summary: `Закупівлю ${po.number} оновлено`,
      });
      revalidatePath("/admin/purchases");
      revalidatePath(`/admin/purchases/${po.id}`);
      revalidatePath("/admin/orders");
      for (const orderId of new Set(po.lines.map((l) => l.orderId))) revalidatePath(`/admin/orders/${orderId}`);
      return undefined;
    },
  });
}

// ── suppliers ───────────────────────────────────────────────

const supplierSchema = z.object({
  code: z.string().trim().min(1, "Вкажіть код постачальника.").max(20),
  name: z.string().trim().min(1, "Вкажіть назву постачальника.").max(120),
  active: z.boolean(),
  shipsDirect: z.boolean(),
  phone: optionalText(40),
  email: optionalText(120),
  telegram: optionalText(80),
  site: optionalText(200),
  manager: optionalText(80),
  leadMin: z.coerce.number().int().min(0).max(365),
  leadMax: z.coerce.number().int().min(0).max(365),
  paymentTerms: optionalText(200),
  deliveryTerms: optionalText(200),
  defaultMarkupPercent: z.coerce.number().min(0).max(1000).optional(),
  notes: optionalText(2000),
});

function toSupplierInput(data: z.infer<typeof supplierSchema>) {
  return {
    code: data.code,
    name: data.name,
    active: data.active,
    shipsDirect: data.shipsDirect,
    contacts: { phone: data.phone, email: data.email, telegram: data.telegram, site: data.site, manager: data.manager },
    leadDays: [Math.min(data.leadMin, data.leadMax), Math.max(data.leadMin, data.leadMax)] as [number, number],
    paymentTerms: data.paymentTerms,
    deliveryTerms: data.deliveryTerms,
    defaultMarkupPercent: data.defaultMarkupPercent,
    notes: data.notes,
  };
}

export async function createSupplierAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction({
    permission: "purchases:write",
    schema: supplierSchema,
    input,
    run: async (data, ctx) => {
      try {
        const supplier = await createSupplier(ctx.db, toSupplierInput(data));
        await ctx.audit({
          action: "supplier.create",
          entity: "supplier",
          entityId: supplier.id,
          summary: `Постачальник ${supplier.name} (${supplier.code}) створений`,
        });
        revalidatePath("/admin/suppliers");
        return { id: supplier.id };
      } catch (error) {
        if (error instanceof DuplicateSupplierCodeError) {
          throw new ActionError(error.message, { code: error.message });
        }
        throw error;
      }
    },
  });
}

export async function updateSupplierAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction({
    permission: "purchases:write",
    schema: supplierSchema.extend({ id: idSchema }),
    input,
    run: async ({ id, ...data }, ctx) => {
      try {
        const supplier = await updateSupplier(ctx.db, id, toSupplierInput(data));
        if (!supplier) throw new ActionError("Постачальника не знайдено.");
        await ctx.audit({
          action: "supplier.update",
          entity: "supplier",
          entityId: supplier.id,
          summary: `Постачальника ${supplier.name} (${supplier.code}) оновлено`,
        });
        revalidatePath("/admin/suppliers");
        revalidatePath(`/admin/suppliers/${id}`);
        return { id: supplier.id };
      } catch (error) {
        if (error instanceof DuplicateSupplierCodeError) {
          throw new ActionError(error.message, { code: error.message });
        }
        throw error;
      }
    },
  });
}

// ── supplier offers (price list) ────────────────────────────

const upsertOfferSchema = z.object({
  supplierId: idSchema,
  sku: z.string().trim().min(1, "Вкажіть артикул.").max(80),
  cost: moneySchema,
  availability: availabilitySchema,
  qty: z.coerce.number().int().min(0).max(1_000_000).optional(),
  leadMin: z.coerce.number().int().min(0).max(365).optional(),
  leadMax: z.coerce.number().int().min(0).max(365).optional(),
});

export async function upsertOfferAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction({
    permission: "purchases:write",
    schema: upsertOfferSchema,
    input,
    run: async ({ supplierId, sku, cost, availability, qty, leadMin, leadMax }, ctx) => {
      const supplier = await getSupplier(ctx.db, supplierId);
      if (!supplier) throw new ActionError("Постачальника не знайдено.");
      const productId = await resolveProductIdBySku(ctx.db, sku);
      await upsertOffers(ctx.db, supplierId, [
        { sku, cost, availability, qty, leadDays: leadRange(leadMin, leadMax), productId },
      ]);
      await ctx.audit({
        action: "offer.upsert",
        entity: "supplier",
        entityId: supplierId,
        summary: `Прайс ${supplier.code}: ${sku} — ${cost} ₴`,
        data: { sku, cost, availability },
      });
      revalidatePath("/admin/suppliers");
      revalidatePath(`/admin/suppliers/${supplierId}`);
      return undefined;
    },
  });
}

const deleteOfferSchema = z.object({ id: idSchema, supplierId: idSchema });

export async function deleteOfferAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction({
    permission: "purchases:write",
    schema: deleteOfferSchema,
    input,
    run: async ({ id, supplierId }, ctx) => {
      await deleteOffer(ctx.db, id);
      await ctx.audit({
        action: "offer.delete",
        entity: "supplier",
        entityId: supplierId,
        summary: "Позицію прайсу видалено",
        data: { offerId: id },
      });
      revalidatePath("/admin/suppliers");
      revalidatePath(`/admin/suppliers/${supplierId}`);
      return undefined;
    },
  });
}

// ── CSV price-list import ───────────────────────────────────

interface OfferImportResult {
  inserted: number;
  updated: number;
  skipped: { row: number; reason: string }[];
}

const IN_STOCK = new Set(["in_stock", "instock", "в наявності", "є", "е", "yes", "так", "+", "наявність"]);
const ON_ORDER = new Set(["on_order", "onorder", "під замовлення", "пiд замовлення", "order", "предзамовлення"]);
const NONE = new Set(["none", "немає", "нема", "нет", "no", "ні", "-", "0"]);

/** Maps a price-list availability cell to the enum; a positive number means "in stock". */
function parseAvailability(raw: string): { availability: OfferAvailability; qty?: number } {
  const value = raw.trim().toLowerCase();
  if (!value) return { availability: "in_stock" };
  if (IN_STOCK.has(value)) return { availability: "in_stock" };
  if (ON_ORDER.has(value)) return { availability: "on_order" };
  if (NONE.has(value)) return { availability: "none" };
  const n = parseNumber(value);
  if (!Number.isNaN(n)) return n > 0 ? { availability: "in_stock", qty: Math.round(n) } : { availability: "none" };
  return { availability: "on_order" };
}

const importSchema = z.object({ supplierId: idSchema, text: z.string().min(1, "Додайте файл CSV з прайсом.") });

export async function importOffersAction(formData: FormData): Promise<ActionResult<OfferImportResult>> {
  const supplierId = String(formData.get("supplierId") ?? "");
  const file = formData.get("file");
  let text = "";
  if (file instanceof Blob) {
    if (file.size > MAX_IMPORT_BYTES) return fail("Файл завеликий: до 8 МБ за один імпорт.");
    text = await file.text();
  }

  return runAction({
    permission: "purchases:write",
    schema: importSchema,
    input: { supplierId, text },
    run: async ({ supplierId, text }, ctx) => {
      const supplier = await getSupplier(ctx.db, supplierId);
      if (!supplier) throw new ActionError("Постачальника не знайдено.");
      const { parseCsv } = await import("@/lib/admin/domain/csv");
      const { rows } = parseCsv(text);
      if (rows.length === 0) throw new ActionError("У файлі немає рядків із даними.");

      const productMap = await productIdsBySku(ctx.db, rows.map((r) => r.sku ?? ""));
      const skipped: { row: number; reason: string }[] = [];
      const bySku = new Map<string, OfferInput>();

      rows.forEach((row, index) => {
        const line = index + 2; // header is line 1
        const sku = (row.sku ?? "").trim();
        if (!sku) {
          skipped.push({ row: line, reason: "Порожній артикул" });
          return;
        }
        const cost = parseNumber(row.cost);
        if (Number.isNaN(cost) || cost < 0) {
          skipped.push({ row: line, reason: "Невірна ціна" });
          return;
        }
        const { availability, qty: qtyFromAvail } = parseAvailability(row.availability ?? "");
        const qtyRaw = parseNumber(row.qty);
        const qty = !Number.isNaN(qtyRaw) && qtyRaw >= 0 ? Math.round(qtyRaw) : qtyFromAvail;
        const leadMin = parseNumber(row.lead_min);
        const leadMax = parseNumber(row.lead_max);
        const leadDays = leadRange(
          Number.isNaN(leadMin) ? undefined : Math.round(leadMin),
          Number.isNaN(leadMax) ? undefined : Math.round(leadMax),
        );
        bySku.set(normalizeSku(sku), {
          sku,
          cost: Math.round(cost),
          availability,
          qty,
          leadDays,
          productId: productMap.get(sku) ?? productMap.get(sku.toUpperCase()) ?? null,
        });
      });

      const offers = [...bySku.values()];
      const { inserted, updated } = await upsertOffers(ctx.db, supplierId, offers);
      await ctx.audit({
        action: "offer.import",
        entity: "supplier",
        entityId: supplierId,
        summary: `Імпорт прайсу ${supplier.code}: +${inserted}, оновлено ${updated}, пропущено ${skipped.length}`,
        data: { inserted, updated, skipped: skipped.length },
      });
      revalidatePath("/admin/suppliers");
      revalidatePath(`/admin/suppliers/${supplierId}`);
      return { inserted, updated, skipped };
    },
  });
}
