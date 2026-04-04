#!/usr/bin/env node
/**
 * Converts all JSON collection files in data/collections/ (including histography/)
 * to CSV format and writes them to data/collections-csv/.
 *
 * CSV format:
 *   Line 1: #meta;id=...;name=...;emoji=...;author=...;createdAt=...;color=...;dataUrl=...
 *   Line 2: CSV header (no "id" — auto-generated on import)
 *   Lines 3+: event rows
 *
 * Run: node_modules/.bin/tsx scripts/json-to-csv.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT, "data", "collections");
const OUT_DIR = path.join(ROOT, "data", "collections-csv");

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Event CSV columns — NO id (auto-generated on import). */
const EVENT_HEADERS = [
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

/** Convert a value to a CSV-safe string. */
function toCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "string") {
    if (/[,"\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  }
  if (Array.isArray(value)) return value.map(toCSV).join(" ");
  return String(value);
}

/** EventTime tuple → space-separated: [2026,3,4] → "2026 3 4" */
function eventTimeToString(time: unknown): string {
  if (!Array.isArray(time)) return "";
  return time.map((v) => String(v ?? "")).filter(Boolean).join(" ");
}

/** Escape a value for the #meta line (semicolon-separated key=value pairs). */
function metaValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/\n/g, "\\n");
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`Source directory not found: ${SRC_DIR}`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(path.join(OUT_DIR, "histography"), { recursive: true });

  // Load metadata map: id → meta
  const metaPath = path.join(ROOT, "data", "collections-metadata.json");
  const metaRaw = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as Array<Record<string, unknown>>;
  const metaMap = new Map<string, Record<string, string>>();
  for (const item of metaRaw) {
    if (item && typeof item === "object" && item.id && typeof item.id === "string") {
      metaMap.set(item.id, item as Record<string, string>);
    }
  }
  console.log(`Loaded ${metaMap.size} metadata entries.\n`);

  // Collect all .json files
  const allFiles: string[] = [];
  const entries = fs.readdirSync(SRC_DIR, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(SRC_DIR, entry.name);
    if (entry.isFile() && entry.name.endsWith(".json")) {
      allFiles.push(fullPath);
    } else if (entry.isDirectory()) {
      for (const sub of fs.readdirSync(fullPath)) {
        if (sub.endsWith(".json")) allFiles.push(path.join(fullPath, sub));
      }
    }
  }

  console.log(`Converting ${allFiles.length} JSON files → CSV (self-contained).\n`);

  let totalEvents = 0;
  let totalJsonBytes = 0;
  let totalCsvBytes = 0;

  for (const filePath of allFiles.sort()) {
    const rel = path.relative(SRC_DIR, filePath);
    const outPath = path.join(OUT_DIR, rel.replace(/\.json$/, ".csv"));
    const jsonBytes = fs.statSync(filePath).size;

    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
    if (!Array.isArray(raw)) {
      console.warn(`  Skipping non-array: ${rel}`);
      continue;
    }

    // ── Resolve metadata (find by matching dataUrl) ───────────────────────
    const basename = path.basename(filePath, ".json");
    // Build a dataUrl like "/collections/cosmic.json" or "/collections/histography/art.json"
    const relative = rel.replace(/\\/g, "/"); // Windows compat
    const dataUrl = "/" + relative.replace(/\.json$/, ".json");

    // Try to find by dataUrl first, then fall back to basename
    let meta: Record<string, string> | undefined = metaMap.get(basename);
    if (!meta) {
      // Find by dataUrl
      for (const m of metaMap.values()) {
        if (m.dataUrl === dataUrl) { meta = m; break; }
      }
    }

    // ── Build output ─────────────────────────────────────────────────────
    const lines: string[] = [];

    // Line 1: metadata comment
    const metaLine = [
      "#meta",
      `id=${metaValue(meta?.id ?? basename)}`,
      `name=${metaValue(meta?.name ?? basename)}`,
      `emoji=${metaValue(meta?.emoji ?? "📁")}`,
      `author=${metaValue(meta?.author ?? "Imported")}`,
      `createdAt=${metaValue(meta?.createdAt ?? "")}`,
    ].join(";");
    lines.push(metaLine);

    // Line 2: CSV header (no event id)
    lines.push(EVENT_HEADERS.join(","));

    // Lines 3+: event rows
    for (const event of raw as unknown[]) {
      if (!event || typeof event !== "object") continue;
      const e = event as Record<string, unknown>;
      lines.push(
        [
          toCSV(e.title ?? ""),
          toCSV(e.description ?? ""),
          toCSV(eventTimeToString(e.time)),
          toCSV(e.duration ?? ""),
          toCSV(e.emoji ?? ""),
          toCSV(e.color ?? ""),
          toCSV(e.priority ?? ""),
          toCSV(e.link ?? ""),
          toCSV(e.image ?? ""),
          toCSV(e.video ?? ""),
        ].join(","),
      );
    }

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, lines.join("\n"), "utf-8");

    const csvBytes = fs.statSync(outPath).size;
    const name = basename;
    const pct = ((1 - csvBytes / jsonBytes) * 100).toFixed(1);
    const saved = jsonBytes - csvBytes;
    console.log(
      `  ${name.padEnd(30)} JSON: ${(jsonBytes / 1024).toFixed(1)} KB  →  CSV: ${(csvBytes / 1024).toFixed(1)} KB  (${saved > 0 ? "saves " + pct + "%" : "larger by " + Math.abs(Number(pct)) + "%"})`,
    );

    totalEvents += raw.length;
    totalJsonBytes += jsonBytes;
    totalCsvBytes += csvBytes;
  }

  console.log(
    `\nTotal: ${allFiles.length} files, ${totalEvents} events`,
  );
  console.log(
    `JSON: ${(totalJsonBytes / 1024).toFixed(1)} KB  →  CSV: ${(totalCsvBytes / 1024).toFixed(1)} KB  (${totalJsonBytes > totalCsvBytes ? "saves " + ((1 - totalCsvBytes / totalJsonBytes) * 100).toFixed(1) + "%" : "larger by " + ((totalCsvBytes / totalJsonBytes - 1) * 100).toFixed(1) + "%"})`,
  );
}

main();
