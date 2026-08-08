import { describe, expect, it } from "vitest";
import { sanitizeImportedEvents } from "./index";
import {
  assignRuntimeEventIds,
  getEventTimelineRange,
  isSpanEvent,
  stripRuntimeEventIds,
} from "../helpers/index";
import { exportCollectionToCsv, parseCsvEvents } from "../helpers/csv";

/**
 * End-to-end identity of a span event across every persistence boundary it
 * crosses in production: raw import -> runtime ids -> strip (localStorage /
 * Drive shape) -> reload -> CSV export -> CSV import.
 */
const raw = [
  { title: "Đế chế La Mã", description: "", emoji: "🏛️", time: [-27], endTime: [476], priority: 90 },
  { title: "Big Bang", description: "", emoji: "💥", time: [-13.8e9], priority: 100 },
  { title: "Đảo ngược", description: "", emoji: "🔁", time: [500], endTime: [100], priority: 10 },
];

describe("span events across persistence boundaries", () => {
  const events = sanitizeImportedEvents(raw, { collectionId: "t" });

  it("imports all events, keeping span-ness", () => {
    expect(events).toHaveLength(3);
    expect(isSpanEvent(events[0])).toBe(true);
    expect(isSpanEvent(events[1])).toBe(false);
  });

  it("every timeline range is ordered, even from a reversed input span", () => {
    for (const event of events) {
      const { startYear, endYear } = getEventTimelineRange(event);
      expect(startYear).toBeLessThanOrEqual(endYear);
    }
  });

  it("endTime and eventUid survive strip -> reload", () => {
    const stored = stripRuntimeEventIds(events);
    for (const event of stored) {
      expect("id" in event && (event as { id?: unknown }).id).toBeFalsy();
    }
    expect(stored.map((e) => e.endTime ?? null)).toEqual(
      events.map((e) => e.endTime ?? null),
    );

    const reloaded = assignRuntimeEventIds(stored, { collectionId: "t" });
    expect(reloaded.map((e) => e.endTime ?? null)).toEqual(
      events.map((e) => e.endTime ?? null),
    );
    expect(reloaded.map((e) => e.eventUid)).toEqual(events.map((e) => e.eventUid));
  });

  it("timeline ranges survive a CSV round trip", async () => {
    const meta = {
      id: "t",
      name: "T",
      emoji: "🗂️",
      description: "",
      author: "",
      createdAt: "2026-01-01",
    };
    const csv = await exportCollectionToCsv(
      meta as Parameters<typeof exportCollectionToCsv>[0],
      stripRuntimeEventIds(events),
    ).text();

    const parsed = parseCsvEvents(csv);
    const reimported = sanitizeImportedEvents(parsed.events, { collectionId: "t" });
    expect(reimported.map(getEventTimelineRange)).toEqual(
      events.map(getEventTimelineRange),
    );
  });
});
