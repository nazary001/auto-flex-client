/*
 * Small CSV utilities for exports and price-list imports. Exports use ";" as the separator
 * with a UTF-8 BOM so that Excel with Ukrainian/Russian locale opens them correctly;
 * the parser auto-detects "," / ";" / tab and handles quoted fields and CRLF.
 */

export type CsvRow = Record<string, string>;

const BOM = "﻿";

function escapeCell(value: unknown, separator: string): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : Array.isArray(value) ? value.join(", ") : String(value);
  if (text.includes('"') || text.includes(separator) || text.includes("\n") || text.includes("\r")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(
  columns: { key: string; header: string }[],
  rows: Record<string, unknown>[],
  options: { separator?: string; bom?: boolean } = {},
): string {
  const separator = options.separator ?? ";";
  const lines = [columns.map((c) => escapeCell(c.header, separator)).join(separator)];
  for (const row of rows) lines.push(columns.map((c) => escapeCell(row[c.key], separator)).join(separator));
  return (options.bom === false ? "" : BOM) + lines.join("\r\n") + "\r\n";
}

export function detectSeparator(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = [";", ",", "\t"].map((sep) => ({ sep, n: firstLine.split(sep).length - 1 }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].sep : ";";
}

/** Parses CSV text into rows keyed by the (trimmed, lower-cased) header. Empty lines are skipped. */
export function parseCsv(input: string, options: { separator?: string } = {}): { headers: string[]; rows: CsvRow[] } {
  const text = input.startsWith(BOM) ? input.slice(1) : input;
  const separator = options.separator ?? detectSeparator(text);
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === separator) {
      record.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      record.push(field);
      field = "";
      records.push(record);
      record = [];
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const nonEmpty = records.filter((r) => r.some((cell) => cell.trim() !== ""));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };
  const headers = nonEmpty[0].map((h) => h.trim().toLowerCase());
  const rows: CsvRow[] = nonEmpty.slice(1).map((cells) => {
    const row: CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? "").trim();
    });
    return row;
  });
  return { headers, rows };
}

/** "1 234,50" / "1234.5" / "1 234" → 1234.5; NaN when not a number */
export function parseNumber(value: string | undefined): number {
  if (!value) return Number.NaN;
  const cleaned = value.replace(/\s| /g, "").replace(",", ".").replace(/[^\d.\-]/g, "");
  return cleaned === "" ? Number.NaN : Number(cleaned);
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
