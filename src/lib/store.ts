"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useHydrated } from "@/lib/hooks";
import type { CartItem, OrderPayload, ProductCardData, ProductOptionValue } from "@/lib/types";

/*
 * Client state kept in localStorage. Every `use…()` hook below returns the empty
 * state until hydration is finished, so server and first client render match.
 */

export const MAX_QTY = 99;

const clampQty = (qty: number) => Math.min(MAX_QTY, Math.max(1, Math.round(qty) || 1));

/*
 * What comes back from localStorage is untrusted: it may be hand-edited, written by an older
 * version of the site or simply corrupt. Every store therefore rebuilds its state from the
 * stored value with the guards below, so bad data degrades to "empty" instead of crashing pages.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown, fallback = ""): string => (typeof value === "string" ? value : fallback);

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

function toCartItems(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  const items: CartItem[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const { key, productId, slug, name, sku, price, qty } = raw;
    if (typeof key !== "string" || typeof productId !== "string" || typeof slug !== "string") continue;
    if (typeof name !== "string" || typeof sku !== "string") continue;
    if (typeof price !== "number" || !Number.isFinite(price) || price < 0) continue;
    items.push({
      key,
      productId,
      slug,
      name,
      sku,
      brandName: text(raw.brandName),
      illustration: text(raw.illustration, "_fallback"),
      image: typeof raw.image === "string" ? raw.image : undefined,
      price,
      oldPrice: typeof raw.oldPrice === "number" && Number.isFinite(raw.oldPrice) ? raw.oldPrice : undefined,
      optionLabel: typeof raw.optionLabel === "string" ? raw.optionLabel : undefined,
      qty: clampQty(typeof qty === "number" ? qty : 1),
    });
  }
  return items;
}

// ── Cart ────────────────────────────────────────────────────

interface CartState {
  items: CartItem[];
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item, qty = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.key === item.key);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.key === item.key ? { ...i, ...item, qty: clampQty(i.qty + qty) } : i,
              ),
            };
          }
          return { items: [...state.items, { ...item, qty: clampQty(qty) }] };
        }),
      setQty: (key, qty) =>
        set((state) => ({
          items: state.items.map((i) => (i.key === key ? { ...i, qty: clampQty(qty) } : i)),
        })),
      remove: (key) => set((state) => ({ items: state.items.filter((i) => i.key !== key) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: "autoflex-cart",
      version: 1,
      merge: (persisted, current) => ({
        ...current,
        items: toCartItems(isRecord(persisted) ? persisted.items : undefined),
      }),
    },
  ),
);

const NO_ITEMS: CartItem[] = [];

export function useCart() {
  const hydrated = useHydrated();
  const stored = useCartStore((s) => s.items);
  const add = useCartStore((s) => s.add);
  const setQty = useCartStore((s) => s.setQty);
  const remove = useCartStore((s) => s.remove);
  const clear = useCartStore((s) => s.clear);
  const items = hydrated ? stored : NO_ITEMS;
  return {
    hydrated,
    items,
    count: items.reduce((sum, i) => sum + i.qty, 0),
    total: items.reduce((sum, i) => sum + i.price * i.qty, 0),
    add,
    setQty,
    remove,
    clear,
  };
}

/** Builds the cart snapshot of a product (with the chosen option value, if any) */
export function toCartItem(product: ProductCardData, optionValue?: ProductOptionValue): Omit<CartItem, "qty"> {
  const delta = optionValue?.priceDelta ?? 0;
  return {
    key: optionValue ? `${product.id}:${optionValue.id}` : product.id,
    productId: product.id,
    slug: product.slug,
    name: product.name,
    sku: product.sku,
    brandName: product.brandName,
    illustration: product.illustration,
    image: product.image,
    price: product.price + delta,
    oldPrice: product.oldPrice ? product.oldPrice + delta : undefined,
    optionLabel: optionValue && product.option ? `${product.option.name}: ${optionValue.label}` : undefined,
  };
}

// ── Favourites ──────────────────────────────────────────────

interface FavoritesState {
  ids: string[];
  toggle: (id: string) => void;
  clear: () => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set) => ({
      ids: [],
      toggle: (id) =>
        set((state) => ({
          ids: state.ids.includes(id) ? state.ids.filter((x) => x !== id) : [id, ...state.ids],
        })),
      clear: () => set({ ids: [] }),
    }),
    {
      name: "autoflex-favorites",
      version: 1,
      merge: (persisted, current) => ({ ...current, ids: stringList(isRecord(persisted) ? persisted.ids : undefined) }),
    },
  ),
);

const NO_IDS: string[] = [];

export function useFavorites() {
  const hydrated = useHydrated();
  const stored = useFavoritesStore((s) => s.ids);
  const toggle = useFavoritesStore((s) => s.toggle);
  const clear = useFavoritesStore((s) => s.clear);
  const ids = hydrated ? stored : NO_IDS;
  return { hydrated, ids, count: ids.length, has: (id: string) => ids.includes(id), toggle, clear };
}

// ── Selected vehicle («Моє авто») ───────────────────────────

export interface SelectedVehicle {
  makeSlug: string;
  modelSlug?: string;
  /** Human label, e.g. "Skoda Octavia A7" */
  label: string;
}

interface VehicleState {
  vehicle: SelectedVehicle | null;
  setVehicle: (vehicle: SelectedVehicle | null) => void;
}

export const useVehicleStore = create<VehicleState>()(
  persist(
    (set) => ({
      vehicle: null,
      setVehicle: (vehicle) => set({ vehicle }),
    }),
    {
      name: "autoflex-vehicle",
      version: 1,
      merge: (persisted, current) => {
        const stored = isRecord(persisted) ? persisted.vehicle : undefined;
        const valid = isRecord(stored) && typeof stored.makeSlug === "string" && typeof stored.label === "string";
        return {
          ...current,
          vehicle: valid
            ? {
                makeSlug: stored.makeSlug as string,
                modelSlug: typeof stored.modelSlug === "string" ? stored.modelSlug : undefined,
                label: stored.label as string,
              }
            : null,
        };
      },
    },
  ),
);

export function useVehicle() {
  const hydrated = useHydrated();
  const stored = useVehicleStore((s) => s.vehicle);
  const setVehicle = useVehicleStore((s) => s.setVehicle);
  return { hydrated, vehicle: hydrated ? stored : null, setVehicle };
}

// ── Recently viewed ─────────────────────────────────────────

interface RecentState {
  ids: string[];
  push: (id: string) => void;
}

export const useRecentStore = create<RecentState>()(
  persist(
    (set) => ({
      ids: [],
      push: (id) => set((state) => ({ ids: [id, ...state.ids.filter((x) => x !== id)].slice(0, 12) })),
    }),
    {
      name: "autoflex-recent",
      version: 1,
      merge: (persisted, current) => ({
        ...current,
        ids: stringList(isRecord(persisted) ? persisted.ids : undefined).slice(0, 12),
      }),
    },
  ),
);

export function useRecentlyViewed() {
  const hydrated = useHydrated();
  const stored = useRecentStore((s) => s.ids);
  const push = useRecentStore((s) => s.push);
  return { hydrated, ids: hydrated ? stored : NO_IDS, push };
}

// ── Buyer profile & local order history (no backend account yet) ──

export interface Profile {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  city: string;
  address: string;
}

export const emptyProfile: Profile = { firstName: "", lastName: "", phone: "", email: "", city: "", address: "" };

export interface LocalOrder {
  number: string;
  /** ISO datetime */
  createdAt: string;
  payload: OrderPayload;
}

/** Shape check for an order kept in the browser: enough for the cabinet to render it safely */
function isLocalOrder(value: unknown): value is LocalOrder {
  if (!isRecord(value) || typeof value.number !== "string" || typeof value.createdAt !== "string") return false;
  const payload = value.payload;
  if (!isRecord(payload) || !isRecord(payload.customer) || !isRecord(payload.delivery)) return false;
  if (typeof payload.payment !== "string" || typeof payload.total !== "number") return false;
  return (
    Array.isArray(payload.items) &&
    payload.items.every(
      (item) =>
        isRecord(item) && typeof item.name === "string" && typeof item.price === "number" && typeof item.qty === "number",
    )
  );
}

interface AccountState {
  profile: Profile;
  orders: LocalOrder[];
  setProfile: (profile: Partial<Profile>) => void;
  addOrder: (order: LocalOrder) => void;
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set) => ({
      profile: emptyProfile,
      orders: [],
      setProfile: (profile) => set((state) => ({ profile: { ...state.profile, ...profile } })),
      addOrder: (order) => set((state) => ({ orders: [order, ...state.orders].slice(0, 50) })),
    }),
    {
      name: "autoflex-account",
      version: 1,
      merge: (persisted, current) => {
        const stored = isRecord(persisted) ? persisted : {};
        const profile = isRecord(stored.profile) ? stored.profile : {};
        const orders = Array.isArray(stored.orders) ? stored.orders : [];
        return {
          ...current,
          profile: {
            firstName: text(profile.firstName),
            lastName: text(profile.lastName),
            phone: text(profile.phone),
            email: text(profile.email),
            city: text(profile.city),
            address: text(profile.address),
          },
          orders: orders.filter(isLocalOrder).slice(0, 50),
        };
      },
    },
  ),
);

const NO_ORDERS: LocalOrder[] = [];

export function useAccount() {
  const hydrated = useHydrated();
  const profile = useAccountStore((s) => s.profile);
  const orders = useAccountStore((s) => s.orders);
  const setProfile = useAccountStore((s) => s.setProfile);
  const addOrder = useAccountStore((s) => s.addOrder);
  return {
    hydrated,
    profile: hydrated ? profile : emptyProfile,
    orders: hydrated ? orders : NO_ORDERS,
    setProfile,
    addOrder,
  };
}

// ── Toasts (not persisted) ──────────────────────────────────

export interface Toast {
  id: number;
  title: string;
  description?: string;
  /** Optional action link, e.g. "Перейти до кошика" */
  action?: { label: string; href: string };
  tone?: "success" | "error";
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
}

let toastId = 0;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (toast) => set((state) => ({ toasts: [...state.toasts.slice(-2), { ...toast, id: ++toastId }] })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper: toast({ title: "Додано до кошика" }) */
export function toast(input: Omit<Toast, "id">): void {
  useToastStore.getState().push(input);
}
