import type { SyncRunDoc } from "@/lib/server/db/collections";

/** Sync-run projection shared by the supplier page (last run) and the live status actions. */
export interface SyncRunView {
  id: string;
  status: SyncRunDoc["status"];
  phase: string;
  offset: number;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
  counters: Record<string, number>;
  log: { at: string; text: string }[];
  error?: string;
}

const LOG_TAIL = 15;

export function toRunView(run: SyncRunDoc | null | undefined): SyncRunView | null {
  if (!run) return null;
  return {
    id: run._id,
    status: run.status,
    phase: run.phase,
    offset: run.offset,
    startedAt: run.startedAt,
    updatedAt: run.updatedAt,
    finishedAt: run.finishedAt,
    counters: run.counters ?? {},
    log: run.log.slice(-LOG_TAIL),
    error: run.error,
  };
}
