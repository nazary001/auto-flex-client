import { describe, expect, it } from "vitest";
import { addToCartEvent, cartItemToAnalytics, purchaseEvent, pushEvent, viewCartEvent } from "@/lib/analytics";

const item = cartItemToAnalytics({
  key: "p1",
  productId: "p1",
  slug: "kolodky",
  name: "Колодки",
  sku: "A1",
  brandName: "Brembo",
  categoryName: "Гальма",
  illustration: "brakes",
  price: 1725,
  qty: 2,
});

describe("dataLayer events", () => {
  it("maps a cart line to a GA4 item", () => {
    expect(item).toEqual({ item_id: "p1", item_name: "Колодки", price: 1725, item_brand: "Brembo", item_category: "Гальма", quantity: 2 });
  });

  it("adds the Google Ads block to add_to_cart", () => {
    const event = addToCartEvent([item]);
    expect(event.event).toBe("add_to_cart");
    expect(event.ecommerce).toMatchObject({ currency: "UAH", value: 3450, items: [item] });
    expect(event.value).toBe("3450.00");
    expect(event.items).toEqual([{ id: "p1", google_business_vertical: "retail" }]);
  });

  it("builds purchase with user_data and the transaction fields", () => {
    const event = purchaseEvent({
      transactionId: "AF-261007-1001",
      total: 3450,
      items: [item],
      customer: { firstName: "Іван", lastName: "Петренко", phone: "380971234567", email: "ivan@example.com" },
      delivery: { city: "Київ", address: "відділення 12" },
    });
    expect(event.ecommerce).toMatchObject({ transaction_id: "AF-261007-1001", affiliation: "online_store", value: 3450, currency: "UAH" });
    expect(event.user_data).toEqual({
      email: "ivan@example.com",
      phone_number: "+380971234567",
      address: { first_name: "Іван", last_name: "Петренко", street: "відділення 12", city: "Київ", country: "UA" },
    });
    expect(event.value).toBe("3450.00");
  });

  it("clears the previous ecommerce object before every ecommerce push only", () => {
    const layer: unknown[] = [];
    pushEvent(viewCartEvent([item]), layer);
    expect(layer[0]).toEqual({ ecommerce: null });
    expect((layer[1] as { event: string }).event).toBe("view_cart");
    pushEvent({ event: "phone_click" }, layer);
    expect(layer).toHaveLength(3);
  });
});
