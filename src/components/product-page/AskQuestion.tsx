"use client";

import { useState } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { LeadForm } from "@/components/forms/LeadForm";
import { Modal } from "@/components/ui/Modal";

interface AskQuestionProps {
  productId: string;
  productName: string;
}

/** «Поставити запитання про товар» — opens a modal with a product-question form. */
export function AskQuestion({ productId, productName }: AskQuestionProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 text-sm font-semibold text-ink-2 transition-colors hover:text-brand-700"
      >
        <MessageCircleQuestion aria-hidden className="size-5" strokeWidth={1.75} />
        Поставити запитання про товар
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Запитання про товар" description={productName}>
        <LeadForm
          kind="question"
          productId={productId}
          name="optional"
          comment="required"
          commentLabel="Ваше запитання"
          commentPlaceholder="Що вас цікавить: сумісність із авто, наявність, терміни доставки?"
          submitLabel="Надіслати запитання"
          successTitle="Запитання надіслано"
          successText="Менеджер зв'яжеться з вами найближчим часом і допоможе з відповіддю."
        />
      </Modal>
    </>
  );
}
