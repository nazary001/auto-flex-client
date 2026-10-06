"use client";

import type { ComponentProps } from "react";
import { trackEvent } from "@/lib/analytics";

/** A tel: link that reports a `phone_click` event to the dataLayer */
export function PhoneLink({ onClick, ...props }: ComponentProps<"a">) {
  return (
    <a
      {...props}
      onClick={(event) => {
        trackEvent("phone_click", { phone: props.href?.replace(/^tel:/, "") });
        onClick?.(event);
      }}
    />
  );
}
