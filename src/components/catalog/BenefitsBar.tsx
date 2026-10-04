import { BenefitIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { benefits } from "@/lib/site";

/** The four-promise panel from the brandbook («Приклад використання») */
export function BenefitsBar({ className }: { className?: string }) {
  return (
    <ul
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-5 rounded-card bg-mist-soft px-5 py-5 ring-1 ring-line-soft sm:px-6 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-line lg:px-2",
        className,
      )}
    >
      {benefits.map((item) => (
        <li key={item.title} className="flex items-center gap-3.5 lg:justify-center lg:px-4">
          <BenefitIcon name={item.icon} className="size-8 shrink-0 text-brand-700 sm:size-9" />
          <p className="min-w-0 leading-tight">
            <span className="block text-sm font-semibold text-ink sm:text-[15px]">{item.title}</span>
            <span className="mt-1 block text-[13px] text-ink-3 sm:text-sm">{item.text}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}
