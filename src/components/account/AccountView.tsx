"use client";

import { OrdersPanel } from "@/components/account/OrdersPanel";
import { ProfilePanel } from "@/components/account/ProfilePanel";
import { VehiclePanel } from "@/components/account/VehiclePanel";
import { Tabs } from "@/components/ui/Tabs";

export function AccountView() {
  return (
    <Tabs
      className="mt-6"
      items={[
        { id: "orders", label: "Мої замовлення", content: <OrdersPanel /> },
        { id: "profile", label: "Мої дані", content: <ProfilePanel /> },
        { id: "vehicle", label: "Моє авто", content: <VehiclePanel /> },
      ]}
    />
  );
}
