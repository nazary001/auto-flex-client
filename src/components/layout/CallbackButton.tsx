"use client";

import { useState, type ReactNode } from "react";
import { Phone } from "lucide-react";
import { LeadForm } from "@/components/forms/LeadForm";
import { SocialIcon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import { site } from "@/lib/site";

interface CallbackButtonProps {
  /** Trigger content, e.g. the text «Замовити дзвінок» */
  children: ReactNode;
  className?: string;
}

/**
 * «Замовити дзвінок» — opens a modal with the phone-first <LeadForm> and the
 * store's direct contacts (phone, Telegram, Viber). Reused in the header and footer.
 */
export function CallbackButton({ children, className }: CallbackButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Замовити дзвінок"
        description="Залиште номер — передзвонимо й допоможемо підібрати запчастини."
      >
        <LeadForm
          kind="callback"
          name="optional"
          comment="optional"
          commentLabel="Коментар (необовʼязково)"
          commentPlaceholder="Марка й модель авто, артикул або VIN — щоб ми підготувалися"
          submitLabel="Передзвоніть мені"
          successTitle="Заявку прийнято"
          successText={`Передзвонимо у робочі години: ${site.scheduleShort}.`}
        />

        <div className="mt-5 border-t border-line-soft pt-4">
          <p className="text-sm text-ink-3">Або звʼяжіться з нами напряму:</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={site.phone.href}
              className="inline-flex h-10 items-center gap-2 rounded-btn bg-mist px-3.5 text-sm font-semibold text-ink transition-colors hover:bg-brand-50 hover:text-brand-700"
            >
              <Phone aria-hidden className="size-4 text-brand-700" strokeWidth={1.75} />
              <span className="tabular">{site.phone.label}</span>
            </a>
            <a
              href={site.socials.telegram}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-btn bg-mist px-3.5 text-sm font-semibold text-ink transition-colors hover:bg-brand-50 hover:text-brand-700"
            >
              <SocialIcon name="telegram" className="size-[18px] text-brand-700" />
              Telegram
            </a>
            <a
              href={site.socials.viber}
              className="inline-flex h-10 items-center gap-2 rounded-btn bg-mist px-3.5 text-sm font-semibold text-ink transition-colors hover:bg-brand-50 hover:text-brand-700"
            >
              <SocialIcon name="viber" className="size-[18px] text-brand-700" />
              Viber
            </a>
          </div>
        </div>
      </Modal>
    </>
  );
}
