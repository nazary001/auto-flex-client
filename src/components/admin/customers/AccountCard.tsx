"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { ActionButton, Card, CopyText, DateTime, DescriptionList, Pill } from "@/components/admin/ui";
import { issueTemporaryPasswordAction } from "@/lib/admin/actions/customers";
import { formatPhone } from "@/lib/format";

export interface AccountCardAccount {
  email: string;
  phone: string;
  status: "active" | "blocked";
  createdAt: string;
  lastLoginAt?: string;
}

interface AccountCardProps {
  customerId: string;
  account: AccountCardAccount | null;
  canWrite: boolean;
}

/**
 * The customer's storefront account. Managers restore lost access here: a temporary password is
 * generated once, shown on screen and must be passed to the customer, who then changes it in the cabinet.
 */
export function AccountCard({ customerId, account, canWrite }: AccountCardProps) {
  const [temporary, setTemporary] = useState<string | null>(null);

  if (!account) {
    return (
      <Card title="Акаунт на сайті">
        <p className="text-sm text-ink-3">Клієнт не реєструвався на сайті. Замовлення він оформлює як гість.</p>
      </Card>
    );
  }

  return (
    <Card title="Акаунт на сайті">
      <DescriptionList
        items={[
          {
            label: "Статус",
            value: <Pill tone={account.status === "active" ? "green" : "red"} size="sm">{account.status === "active" ? "Активний" : "Заблоковано"}</Pill>,
          },
          { label: "E-mail для входу", value: account.email },
          { label: "Телефон для входу", value: <span className="tabular">{formatPhone(account.phone)}</span> },
          { label: "Зареєстровано", value: <DateTime iso={account.createdAt} /> },
          { label: "Останній вхід", value: account.lastLoginAt ? <DateTime iso={account.lastLoginAt} mode="relative" /> : "—" },
        ]}
      />

      {canWrite && (
        <div className="mt-4 border-t border-line-soft pt-4">
          {temporary ? (
            <div className="rounded-card border border-warn/30 bg-warn-soft p-3">
              <p className="text-[13px] font-medium text-ink">Тимчасовий пароль (показується один раз)</p>
              <p className="tabular mt-1 flex items-center gap-2 text-lg font-bold text-ink">
                {temporary}
                <CopyText text={temporary} />
              </p>
              <p className="mt-1 text-[12.5px] text-ink-3">
                Передайте його клієнту особисто. Усі його сесії завершено; після входу пароль варто змінити в кабінеті.
              </p>
            </div>
          ) : (
            <ActionButton
              variant="secondary"
              size="sm"
              action={() => issueTemporaryPasswordAction({ customerId })}
              confirm={{
                title: "Видати тимчасовий пароль?",
                text: "Поточний пароль перестане діяти, клієнт вийде з кабінету на всіх пристроях. Переконайтеся, що ви спілкуєтеся саме з власником акаунта.",
                confirmLabel: "Видати пароль",
              }}
              onSuccess={(data) => setTemporary((data as { password: string }).password)}
              refresh={false}
            >
              <KeyRound aria-hidden className="size-4" strokeWidth={2} />
              Видати тимчасовий пароль
            </ActionButton>
          )}
        </div>
      )}
    </Card>
  );
}
