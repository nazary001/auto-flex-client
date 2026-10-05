"use client";

import { initials } from "@/components/admin/shell/nav";
import { Pill } from "@/components/admin/ui";
import { assignOrderAction } from "@/lib/admin/actions/orders";
import { useOrderAction } from "./use-order-action";

interface OrderAssigneeProps {
  id: string;
  assigneeId?: string;
  users: { id: string; name: string }[];
  canWrite: boolean;
}

/** Compact assignee picker in the order header; changes commit immediately. */
export function OrderAssignee({ id, assigneeId, users, canWrite }: OrderAssigneeProps) {
  const { pending, run } = useOrderAction();
  const name = users.find((u) => u.id === assigneeId)?.name;

  if (!canWrite) {
    return name ? (
      <Pill tone="neutral" size="sm" title={name}>
        {initials(name)}
      </Pill>
    ) : (
      <span className="text-[13px] text-ink-3">Без відповідального</span>
    );
  }

  return (
    <select
      key={assigneeId ?? "none"}
      defaultValue={assigneeId ?? ""}
      disabled={pending}
      aria-label="Відповідальний"
      className="field field-sm w-auto min-w-44"
      onChange={(e) => run(() => assignOrderAction({ id, assigneeId: e.target.value }), { success: "Відповідального змінено" })}
    >
      <option value="">Без відповідального</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
    </select>
  );
}
