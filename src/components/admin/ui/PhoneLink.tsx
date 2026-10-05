import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/format";
import { CopyText } from "./CopyText";

interface PhoneLinkProps {
  /** Any phone format; dialled as +<digits>, shown as +38 (0XX) XXX-XX-XX */
  phone: string;
  className?: string;
}

/** A tel: link with a copy button next to it. */
export function PhoneLink({ phone, className }: PhoneLinkProps) {
  const digits = phone.replace(/\D/g, "");
  const pretty = formatPhone(phone);
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <a href={`tel:+${digits}`} className="link tabular font-medium">
        {pretty}
      </a>
      <CopyText text={pretty} />
    </span>
  );
}
