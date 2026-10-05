import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";

/*
 * All timestamps are ISO-8601 UTC. We format in Europe/Kyiv so the result is identical on the
 * server and the client (same IANA data), which keeps hydration stable. Relative labels read
 * from Date.now(), so that one case carries suppressHydrationWarning for the inevitable drift.
 */
const TZ = "Europe/Kyiv";
const timeFmt = new Intl.DateTimeFormat("uk-UA", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const fullFmt = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});

function relative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "щойно";
  if (mins < 60) return `${mins} хв тому`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} год тому`;
  if (hours < 48) return "вчора";
  return formatDate(date.toISOString());
}

interface DateTimeProps {
  iso: string;
  mode?: "date" | "datetime" | "relative";
  className?: string;
}

/** Renders a <time> element; hover shows the full local date and time. */
export function DateTime({ iso, mode = "date", className }: DateTimeProps) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return <span className={cn("tabular", className)}>{iso}</span>;
  }
  const title = fullFmt.format(date);
  let text: string;
  if (mode === "relative") text = relative(date);
  else if (mode === "datetime") text = `${formatDate(iso)}, ${timeFmt.format(date)}`;
  else text = formatDate(iso);

  return (
    <time
      dateTime={iso}
      title={title}
      suppressHydrationWarning={mode === "relative"}
      className={cn("tabular whitespace-nowrap", className)}
    >
      {text}
    </time>
  );
}
