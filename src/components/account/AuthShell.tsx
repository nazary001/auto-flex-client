import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

interface AuthShellProps {
  /** Breadcrumb for this screen ("Вхід", "Реєстрація") */
  crumb: string;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}

/** Narrow centred card for the sign-in and registration screens */
export function AuthShell({ crumb, title, subtitle, children }: AuthShellProps) {
  return (
    <div className="container-page py-6 pb-24 lg:py-10 lg:pb-16">
      <Breadcrumbs items={[{ label: "Кабінет", href: "/account" }, { label: crumb }]} />
      <div className="mx-auto mt-6 w-full max-w-md lg:mt-10">
        <section className="card p-6 sm:p-8">
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="mt-2 text-[15px] leading-relaxed text-ink-3">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </section>
      </div>
    </div>
  );
}
