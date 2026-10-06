import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { AccountOrders } from "@/components/account/AccountOrders";
import { PasswordForm } from "@/components/account/PasswordForm";
import { ProfileForm } from "@/components/account/ProfileForm";
import { VehiclePanel } from "@/components/account/VehiclePanel";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { buttonClass } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { logoutAction } from "@/lib/account/actions";
import type { Order } from "@/lib/admin/types";
import { formatPhone } from "@/lib/format";
import { requireAccount } from "@/lib/server/account/dal";
import { getDb } from "@/lib/server/db/client";
import { listOrdersByCustomer, listOrdersByPhone } from "@/lib/server/db/repos/orders";
import { refreshStaleTracking } from "@/lib/server/orders/tracking";

export const metadata: Metadata = {
  title: "Кабінет",
  description: "Особистий кабінет AutoFlex: ваші замовлення, контактні дані для оформлення та обране авто.",
  alternates: { canonical: "/account" },
  robots: { index: false, follow: false },
};

const TABS = new Set(["orders", "profile", "password", "vehicle"]);

/** Orders linked to the customer card plus any placed with the account's phone, newest first */
async function loadOrders(customerId: string, phone: string): Promise<Order[]> {
  const db = await getDb();
  const [byCustomer, byPhone] = await Promise.all([listOrdersByCustomer(db, customerId), listOrdersByPhone(db, phone)]);
  const seen = new Set<string>();
  const orders = [...byCustomer, ...byPhone]
    .filter((order) => (seen.has(order.id) ? false : (seen.add(order.id), true)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  // Fresh parcel statuses for the parcels still on their way (at most three carrier calls per visit)
  return refreshStaleTracking(db, orders, { limit: 3, timeoutMs: 4000 });
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab }, { account, customer }] = await Promise.all([searchParams, requireAccount("/account")]);
  const orders = await loadOrders(customer.id, account.phone);
  const greeting = customer.firstName.trim() ? `Вітаємо, ${customer.firstName.trim()}!` : "Особистий кабінет";

  return (
    <div className="container-page py-6 pb-24 lg:py-10 lg:pb-14">
      <Breadcrumbs items={[{ label: "Кабінет" }]} />
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{greeting}</h1>
          <p className="mt-2 text-[15px] text-ink-3">
            <span className="tabular">{formatPhone(account.phone)}</span> · {account.email}
          </p>
        </div>
        <form action={logoutAction}>
          <button type="submit" className={buttonClass({ variant: "secondary", size: "sm" })}>
            <LogOut aria-hidden className="size-4" strokeWidth={2} />
            Вийти
          </button>
        </form>
      </div>

      <Tabs
        className="mt-6"
        defaultId={tab && TABS.has(tab) ? tab : "orders"}
        items={[
          {
            id: "orders",
            label: orders.length ? `Мої замовлення (${orders.length})` : "Мої замовлення",
            content: <AccountOrders orders={orders} />,
          },
          {
            id: "profile",
            label: "Мої дані",
            content: (
              <ProfileForm
                initial={{
                  firstName: customer.firstName,
                  lastName: customer.lastName,
                  phone: account.phone,
                  email: account.email,
                  city: customer.city ?? "",
                  address: customer.address ?? "",
                }}
              />
            ),
          },
          { id: "password", label: "Пароль", content: <PasswordForm /> },
          { id: "vehicle", label: "Моє авто", content: <VehiclePanel /> },
        ]}
      />
    </div>
  );
}
