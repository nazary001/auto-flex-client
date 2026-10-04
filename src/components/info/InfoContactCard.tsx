import { Mail, PhoneCall } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { SocialIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { site } from "@/lib/site";

/**
 * Closing contact block for the information pages. «Замовити дзвінок» lives in the
 * header, so here we give the direct phone link, messengers and the schedule.
 */
export function InfoContactCard({ className }: { className?: string }) {
  return (
    <section
      aria-label="Зв’язатися з нами"
      className={cn("bg-stripes-navy relative isolate overflow-hidden rounded-card p-6 text-white sm:p-8", className)}
    >
      <span aria-hidden className="halftone absolute -right-6 -bottom-8 -z-10 size-52 text-brand-400" />
      <div className="max-w-md">
        <p className="text-lg font-bold">Залишилися запитання?</p>
        <p className="mt-1.5 text-sm text-white/70">
          Зателефонуйте або напишіть у месенджер — підкажемо з підбором, наявністю та оформленням замовлення.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <a href={site.phone.href} className={buttonClass({ variant: "light" })}>
            <PhoneCall aria-hidden className="size-[18px]" strokeWidth={1.75} />
            {site.phone.label}
          </a>
          <div className="flex gap-2">
            <a
              href={site.socials.telegram}
              target="_blank"
              rel="noreferrer"
              aria-label="Написати в Telegram"
              className="inline-flex size-11 items-center justify-center rounded-btn bg-white/10 text-white transition-colors hover:bg-white/20 [&>svg]:size-5"
            >
              <SocialIcon name="telegram" />
            </a>
            <a
              href={site.socials.viber}
              aria-label="Написати у Viber"
              className="inline-flex size-11 items-center justify-center rounded-btn bg-white/10 text-white transition-colors hover:bg-white/20 [&>svg]:size-5"
            >
              <SocialIcon name="viber" />
            </a>
          </div>
        </div>

        <dl className="mt-6 grid gap-1.5 text-sm">
          {site.schedule.map((row) => (
            <div key={row.days} className="flex gap-2">
              <dt className="w-16 shrink-0 text-white/60">{row.days}</dt>
              <dd className="font-medium text-white/90">{row.hours}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 text-sm">
          <a
            href={`mailto:${site.email}`}
            className="inline-flex items-center gap-2 text-white/90 underline-offset-2 hover:underline"
          >
            <Mail aria-hidden className="size-4 text-brand-300" strokeWidth={1.75} />
            {site.email}
          </a>
        </p>
      </div>
    </section>
  );
}
