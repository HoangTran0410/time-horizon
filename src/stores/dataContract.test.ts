/**
 * Contract between the app's import layer and the real collection data in the
 * separate `time-horizon-data` repo. Runs against `data/` (the git submodule)
 * or a sibling `../time-horizon-data` checkout, and skips when neither is
 * present so CI without the submodule stays green.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { sanitizeImportedEvents } from "../stores";
import { stripRuntimeEventIds } from "../helpers";
import { exportCollectionToCsv, parseCsvEvents } from "../helpers/csv";
import { BIG_BANG_YEAR } from "../constants";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const dataRoot = [join(repoRoot, "data"), resolve(repoRoot, "../time-horizon-data")].find(
  (candidate) => existsSync(join(candidate, "collections")),
);

const listJsonFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listJsonFiles(full);
    return name.endsWith(".json") ? [full] : [];
  });

const collectionFiles = dataRoot
  ? listJsonFiles(join(dataRoot, "collections")).sort()
  : [];
const relative = (file: string) =>
  dataRoot ? file.slice(dataRoot.length + 1) : file;
const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));

describe.skipIf(collectionFiles.length === 0)(
  "data contract: real collections survive sanitizeImportedEvents",
  () => {
    it.each(collectionFiles.map((file) => [relative(file), file]))(
      "%s",
      (_name, file) => {
        const raw = readJson(file);
        expect(Array.isArray(raw)).toBe(true);
        const rawEvents = raw as Array<Record<string, unknown>>;
        const collectionId = relative(file).replace(/\.json$/, "").replace(/\//g, "-");

        const events = sanitizeImportedEvents(rawEvents, { collectionId });

        // Nothing silently dropped.
        expect(events).toHaveLength(rawEvents.length);

        // Runtime ids and durable eventUids are unique within the collection.
        expect(new Set(events.map((event) => event.id)).size).toBe(events.length);
        expect(new Set(events.map((event) => event.eventUid)).size).toBe(
          events.length,
        );

        // Deterministic: a second load derives identical identities.
        const again = sanitizeImportedEvents(rawEvents, { collectionId });
        expect(again.map((event) => event.eventUid)).toEqual(
          events.map((event) => event.eventUid),
        );

        for (const event of events) {
          expect(event.time[0]).toBeGreaterThanOrEqual(BIG_BANG_YEAR);
          const month = event.time[1];
          if (month != null) {
            expect(month).toBeGreaterThanOrEqual(1);
            expect(month).toBeLessThanOrEqual(12);
          }
          const day = event.time[2];
          if (day != null) {
            expect(day).toBeGreaterThanOrEqual(1);
            expect(day).toBeLessThanOrEqual(31);
          }
        }
      },
    );

    it("every collection survives a CSV export/import round trip with no loss", async () => {
      for (const file of collectionFiles) {
        const raw = readJson(file);
        const events = sanitizeImportedEvents(raw);
        const csv = await exportCollectionToCsv(
          {
            id: "x",
            name: "x",
            emoji: "x",
            description: "",
            author: "x",
            createdAt: "x",
          },
          stripRuntimeEventIds(events),
        ).text();
        const reimported = sanitizeImportedEvents(parseCsvEvents(csv).events);
        expect(reimported.length, relative(file)).toBe(events.length);
        expect(
          stripRuntimeEventIds(reimported).map((event) => event.time),
          relative(file),
        ).toEqual(stripRuntimeEventIds(events).map((event) => event.time));
        expect(
          reimported.map((event) => event.eventUid),
          relative(file),
        ).toEqual(events.map((event) => event.eventUid));
      }
    });
  },
);

const metadataFile = dataRoot ? join(dataRoot, "collections-metadata.json") : "";
const hasMetadata = Boolean(dataRoot) && existsSync(metadataFile);

describe.skipIf(!hasMetadata)("data contract: catalog index", () => {
  it("has unique ids and a dataUrl that resolves to an existing file", () => {
    const catalog = readJson(metadataFile) as Array<{
      id: string;
      name: string;
      emoji: string;
      dataUrl?: string;
    }>;
    expect(Array.isArray(catalog)).toBe(true);
    expect(new Set(catalog.map((entry) => entry.id)).size).toBe(catalog.length);

    const missing = catalog
      .filter(
        (entry) =>
          !entry.dataUrl ||
          !existsSync(join(dataRoot as string, entry.dataUrl.replace(/^\//, ""))),
      )
      .map((entry) => `${entry.id} -> ${entry.dataUrl}`);
    expect(missing, `catalog entries with missing data files:\n${missing.join("\n")}`)
      .toEqual([]);

    for (const entry of catalog) {
      expect(entry.name?.trim(), entry.id).toBeTruthy();
      expect(entry.emoji?.trim(), entry.id).toBeTruthy();
    }
  });
});
