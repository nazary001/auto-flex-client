"use client";

import { useState } from "react";
import { Phone } from "lucide-react";
import { LeadForm } from "@/components/forms/LeadForm";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

/**
 * Opens a «Замовити дзвінок» modal with the shared phone-first LeadForm.
 * Handy on empty/no-result states where the buyer may want help choosing a part.
 */
export function CallbackButton({
  label = "Замовити дзвінок",
  variant = "primary",
}: {
  label?: string;
  variant?: ButtonVariant;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Phone aria-hidden className="size-[18px]" strokeWidth={1.75} />
        {label}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Замовити дзвінок"
        description="Залиште номер — менеджер передзвонить, допоможе з підбором і перевірить сумісність за VIN."
      >
        <LeadForm
          kind="callback"
          name="optional"
          submitLabel="Замовити дзвінок"
          successTitle="Дякуємо! Ми передзвонимо найближчим часом"
          successText="Наш менеджер зв'яжеться з вами в робочі години, щоб допомогти з підбором запчастин."
        />
      </Modal>
    </>
  );
}
