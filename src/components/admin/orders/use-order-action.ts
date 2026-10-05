"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/store";
import type { ActionResult } from "@/lib/admin/actions/_action";

interface RunOptions<T> {
  success?: string;
  onSuccess?: (data: T) => void;
  /** Refresh the route after success (default true) */
  refresh?: boolean;
}

/** Runs an order server action inside a transition, toasting the outcome and refreshing. */
export function useOrderAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run<T>(action: () => Promise<ActionResult<T>>, options: RunOptions<T> = {}) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          if (options.success) toast({ title: options.success });
          options.onSuccess?.(result.data);
          if (options.refresh !== false) router.refresh();
        } else {
          toast({ title: result.error, tone: "error" });
        }
      } catch {
        toast({ title: "Не вдалося виконати дію. Спробуйте ще раз.", tone: "error" });
      }
    });
  }

  return { pending, run };
}
