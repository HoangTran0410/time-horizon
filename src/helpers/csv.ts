/**
 * CSV export helpers for self-contained collection files.
 *
 * CSV format (export):
 *   Line 1: #meta;id=...;name=...;emoji=...;author=...;createdAt=...
 *   Line 2: title,description,time,duration,emoji,color,priority,link,image,video
 *   Lines 3+: event rows
 */

import type {
  EventCollectionMeta,
  EventTime,
  ImportedEvent,
  LocalizedText,
  StoredEvent,
} from "../constants/types";
import { normalizeLocalizedText } from "./localization";

/** Escape a value for a CSV field (RFC-4180). */
function escapeCsvValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "string") {
    if (/[,"\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  }
  return String(v);
}

const serializeLocalizedText = (value: LocalizedText): string =>
  typeof value === "string" ? value : JSON.stringify(value);

const parseLocalizedText = (value: string): LocalizedText | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{")) {
    try {
      return normalizeLocalizedText(JSON.parse(trimmed));
    } catch {
      return trimmed;
    }
  }

  return trimmed;
};

/** EventTime array → space-separated string: [2026,3,4] → "2026 3 4" */
function eventTimeToStr(time: unknown): string {
  if (!Array.isArray(time)) return "";
  return time.map((v) => String(v ?? "")).filter(Boolean).join(" ");
}

/** Build a #meta; line from collection metadata. */
function buildCsvMetaLine(meta: EventCollectionMeta): string {
  const escape = (v: unknown) =>
    String(v ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/\n/g, "\\n");
  return [
    "#meta",
    `id=${escape(meta.id)}`,
    `name=${escape(meta.name)}`,
    `emoji=${escape(meta.emoji)}`,
    `author=${escape(meta.author)}`,
    `createdAt=${escape(meta.createdAt)}`,
  ].join(";");
}

/**
 * Export a collection to a self-contained CSV Blob.
 * Includes the #meta; line, then event headers, then rows.
 */
export function exportCollectionToCsv(
  meta: EventCollectionMeta,
  events: StoredEvent[],
): Blob {
  const HEADERS = [
    "title",
    "description",
    "time",
    "duration",
    "emoji",
    "color",
    "priority",
    "link",
    "image",
    "video",
  ] as const;

  const lines = [
    buildCsvMetaLine(meta),
    HEADERS.join(","),
    ...events.map((ev) =>
      [
        escapeCsvValue(serializeLocalizedText(ev.title)),
        escapeCsvValue(serializeLocalizedText(ev.description)),
        escapeCsvValue(eventTimeToStr(ev.time)),
        escapeCsvValue(ev.duration ?? ""),
        escapeCsvValue(ev.emoji),
        escapeCsvValue(ev.color ?? ""),
        escapeCsvValue(ev.priority),
        escapeCsvValue(ev.link ?? ""),
        escapeCsvValue(ev.image ?? ""),
        escapeCsvValue(ev.video ?? ""),
      ].join(","),
    ),
  ];

  return new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
}

/** Parse metadata from the #meta; line of a self-contained CSV. */
export function parseCsvMetaLine(line: string): Partial<EventCollectionMeta> {
  const raw = line.replace(/^#meta;?/, "");
  const meta: Partial<EventCollectionMeta> = {};
  const parts = raw.split(/;(?![^\\]*\\)/);
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const rawVal = part.slice(idx + 1);
    // Unescape: \n → newline, \; → semicolon, \\ → backslash
    const value = rawVal
      .replace(/\\n/g, "\n")
      .replace(/\\;/g, ";")
      .replace(/\\\\/g, "\\");
    if (key === "id") meta.id = value;
    else if (key === "name") meta.name = value;
    else if (key === "emoji") meta.emoji = value;
    else if (key === "author") meta.author = value;
    else if (key === "createdAt") meta.createdAt = value;
    else if (key === "color") meta.color = value || null;
  }
  return meta;
}

/** Parse a single CSV line, respecting double-quote escaping (RFC-4180). */
export function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }
    if (ch === "," && !inQuotes) {
      values.push(current);
      current = "";
      i++;
      continue;
    }
    current += ch;
    i++;
  }
  values.push(current);
  return values;
}

/** Map a flat CSV row object to a Partial<ImportedEvent>. Returns null if the row is invalid. */
export function parseCsvEventRow(
  row: Record<string, string>,
): Partial<ImportedEvent> | null {
  const title = parseLocalizedText(row.title ?? row.name ?? "");
  const description = parseLocalizedText(row.description ?? row.desc ?? "") ?? "";
  const emoji = row.emoji ?? "📅";
  const timeStr = row.time ?? row.year ?? "";
  if (!title && !description) return null;

  // Parse EventTime: space-separated [year month day hour minute seconds?]
  const timeParts = timeStr
    .split(/\s+/)
    .map((v) => (v ? Number(v) : null))
    .filter((v): v is number | null => v === null || Number.isFinite(v));

  const isValidTime =
    timeParts.length > 0 &&
    timeParts[0] !== null &&
    Number.isFinite(timeParts[0]);

  if (!isValidTime) return null;

  const time: EventTime = [
    timeParts[0] as number,
    ...(timeParts.slice(1, 6) as [number | null, number | null, number | null, number | null, number | null]),
  ];

  return {
    ...(row.id || row.event_id
      ? { id: row.id ?? row.event_id }
      : {}),
    title,
    description,
    emoji,
    time,
    priority: row.priority ? Number(row.priority) : 50,
    duration: row.duration ? Number(row.duration) : undefined,
    color: row.color || null,
    link: row.link || undefined,
    image: row.image || undefined,
    video: row.video || undefined,
  };
}

/**
 * Parse a CSV string into events and optional embedded metadata.
 * - Detects and strips the #meta; header line
 * - Returns { events, meta } where meta is defined only if #meta; was present
 */
export function parseCsvEvents(
  csvText: string,
): { events: Partial<ImportedEvent>[]; meta?: Partial<EventCollectionMeta> } {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { events: [] };

  let offset = 0;
  let meta: Partial<EventCollectionMeta> | undefined;

  if (lines[0].startsWith("#meta")) {
    meta = parseCsvMetaLine(lines[0]);
    offset = 1;
  }

  const headerLine = lines[offset];
  const headers = headerLine
    .split(",")
    .map((h) => h.trim().replace(/^"|"$/g, ""));

  const events: Partial<ImportedEvent>[] = [];
  for (let i = offset + 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length !== headers.length) continue;
    const row: Record<string, string> = Object.fromEntries(
      headers.map((h, idx) => [h, (values[idx] ?? "").trim()]),
    );
    const event = parseCsvEventRow(row);
    if (event) events.push(event);
  }

  return { events, meta };
}
