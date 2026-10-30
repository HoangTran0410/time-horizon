import { describe, expect, it } from "vitest";
import {
  filterTimelineSearchEvents,
  findEventCollectionIdInCollections,
  getTimelineSearchDateInputError,
  hasActiveTimelineSearch,
  hasActiveTimelineSearchFilters,
  sanitizeImportedEvents,
} from "../stores";
import { getEventTimelineRange, stripRuntimeEventIds } from "../helpers";
import type { Event, MediaFilter } from "../constants/types";

const makeEvent = (id: string, overrides: Partial<Event> = {}): Event => ({
  id,
  title: id,
  description: "",
  time: [2000],
  emoji: "📌",
  priority: 50,
  ...overrides,
});
const ids = (events: Event[]) => events.map((event) => event.id);

describe("getTimelineSearchDateInputError", () => {
  it("accepts blank, YYYY, YYYY-MM, YYYY-MM-DD and negative (BCE) years", () => {
    for (const value of ["", "   ", "1969", "1969-7", "1969-07-20", "-500", "-500-03"]) {
      expect(getTimelineSearchDateInputError(value, "")).toBeNull();
      expect(getTimelineSearchDateInputError("", value)).toBeNull();
    }
  });

  it("rejects malformed shapes with a format hint", () => {
    for (const value of ["1969/07/20", "July 1969", "1969-07-20T10:00", "1969--1", "abc"]) {
      expect(getTimelineSearchDateInputError(value, "")).toMatch(
        /^From date: Use YYYY/,
      );
    }
    expect(getTimelineSearchDateInputError("", "abc")).toMatch(/^To date: /);
  });

  it("validates month and day ranges", () => {
    expect(getTimelineSearchDateInputError("2000-13", "")).toBe(
      "From date: Month must be between 1 and 12.",
    );
    expect(getTimelineSearchDateInputError("2000-00", "")).toMatch(/Month/);
    expect(getTimelineSearchDateInputError("2023-04-31", "")).toMatch(
      /Day is out of range/,
    );
    expect(getTimelineSearchDateInputError("2023-02-29", "")).toMatch(
      /Day is out of range/,
    );
  });

  it("accepts Feb 29 in an ordinary leap year", () => {
    expect(getTimelineSearchDateInputError("2024-02-29", "")).toBeNull();
    expect(getTimelineSearchDateInputError("1996-02-29", "")).toBeNull();
  });

  it("rejects a From date that is not before the end of the To date", () => {
    expect(getTimelineSearchDateInputError("2001", "2000")).toBe(
      "From date must be before the end of the To date.",
    );
    // Same year on both sides is a valid one-year window.
    expect(getTimelineSearchDateInputError("2000", "2000")).toBeNull();
    expect(getTimelineSearchDateInputError("2000-05", "2000")).toBeNull();
  });

  it("tolerates non-string input from persisted state", () => {
    expect(
      getTimelineSearchDateInputError(
        42 as unknown as string,
        null as unknown as string,
      ),
    ).toBeNull();
  });
});

describe("hasActiveTimelineSearch / hasActiveTimelineSearchFilters", () => {
  const idle = {
    searchQuery: "",
    activeMediaFilters: [] as MediaFilter[],
    searchSortMode: "best-match" as const,
    timeRangeStartInput: "",
    timeRangeEndInput: "",
  };

  it("is inactive for blank state, and sort mode alone does not count", () => {
    expect(hasActiveTimelineSearch(idle)).toBe(false);
    expect(
      hasActiveTimelineSearch({ ...idle, searchQuery: "   ", searchSortMode: "time-asc" }),
    ).toBe(false);
  });

  it("activates on a query, a media filter or either time bound", () => {
    expect(hasActiveTimelineSearch({ ...idle, searchQuery: "x" })).toBe(true);
    expect(
      hasActiveTimelineSearchFilters({ ...idle, activeMediaFilters: ["image"] }),
    ).toBe(true);
    expect(
      hasActiveTimelineSearchFilters({ ...idle, timeRangeEndInput: "1900" }),
    ).toBe(true);
  });

  it("ignores unknown media filter values", () => {
    expect(
      hasActiveTimelineSearchFilters({
        ...idle,
        activeMediaFilters: ["podcast"] as unknown as MediaFilter[],
      }),
    ).toBe(false);
  });
});

describe("filterTimelineSearchEvents — localized text and date precision", () => {
  const hanoi = makeEvent("hanoi", {
    title: { vi: "Giải phóng Thủ đô Hà Nội", en: "Liberation of Hanoi" },
    description: { vi: "Quân đội tiếp quản", en: "The army takes over" },
    time: [1954, 10, 10],
  });
  const reunification = makeEvent("reunification", {
    title: { vi: "Thống nhất đất nước", en: "Reunification" },
    time: [1975, 4, 30],
  });
  const dbp = makeEvent("dbp", {
    title: "Chiến thắng Điện Biên Phủ",
    time: [1954, 5, 7],
  });
  const all = [hanoi, reunification, dbp];

  it("matches Vietnamese multi-word queries with any word order", () => {
    expect(ids(filterTimelineSearchEvents(all, "hà nội giải phóng", []))).toEqual([
      "hanoi",
    ]);
  });

  it("matches the uppercase Đ against a lowercase đ query", () => {
    expect(ids(filterTimelineSearchEvents(all, "điện biên", []))).toEqual(["dbp"]);
    expect(ids(filterTimelineSearchEvents(all, "ĐIỆN BIÊN", []))).toEqual(["dbp"]);
  });

  it("searches descriptions in every language regardless of UI language", () => {
    expect(
      ids(filterTimelineSearchEvents(all, "army", [], { language: "vi" })),
    ).toEqual(["hanoi"]);
    expect(
      ids(filterTimelineSearchEvents(all, "tiếp quản", [], { language: "en" })),
    ).toEqual(["hanoi"]);
  });

  it("requires every term to match (AND), not any (OR)", () => {
    expect(filterTimelineSearchEvents(all, "hanoi reunification", [])).toEqual([]);
  });

  it("narrows to a single month or day", () => {
    expect(
      ids(
        filterTimelineSearchEvents(all, "", [], {
          startTimeInput: "1954-05",
          endTimeInput: "1954-05",
        }),
      ),
    ).toEqual(["dbp"]);
    expect(
      ids(
        filterTimelineSearchEvents(all, "", [], {
          startTimeInput: "1975-04-30",
          endTimeInput: "1975-04-30",
        }),
      ),
    ).toEqual(["reunification"]);
    expect(
      filterTimelineSearchEvents(all, "", [], {
        startTimeInput: "1975-04-29",
        endTimeInput: "1975-04-29",
      }),
    ).toEqual([]);
  });

  it("lets a year-only event overlap a month window inside that year", () => {
    const yearOnly = makeEvent("year", { time: [1954] });
    expect(
      ids(
        filterTimelineSearchEvents([yearOnly], "", [], {
          startTimeInput: "1954-06",
          endTimeInput: "1954-06",
        }),
      ),
    ).toEqual(["year"]);
  });

  it("handles BCE ranges", () => {
    const trung = makeEvent("trung", { time: [40] });
    const xerxes = makeEvent("xerxes", { time: [-480] });
    expect(
      ids(
        filterTimelineSearchEvents([trung, xerxes], "", [], {
          startTimeInput: "-500",
          endTimeInput: "-1",
        }),
      ),
    ).toEqual(["xerxes"]);
  });

  it("returns a new array when sorting and never mutates the input", () => {
    const input = [...all];
    const sorted = filterTimelineSearchEvents(input, "", [], {
      sortMode: "time-asc",
    });
    expect(input).toEqual(all);
    expect(ids(sorted)).toEqual(["dbp", "hanoi", "reunification"]);
  });

  it("falls back to name order for events with the same start time", () => {
    const b = makeEvent("b", { title: "Beta", time: [1900] });
    const a = makeEvent("a", { title: "Alpha", time: [1900] });
    expect(
      ids(filterTimelineSearchEvents([b, a], "", [], { sortMode: "time-asc" })),
    ).toEqual(["a", "b"]);
  });
});

describe("findEventCollectionIdInCollections", () => {
  it("returns the owning collection id or null", () => {
    const library = {
      a: [makeEvent("one")],
      b: [makeEvent("two")],
    };
    expect(findEventCollectionIdInCollections(library, "two")).toBe("b");
    expect(findEventCollectionIdInCollections(library, "three")).toBeNull();
    expect(findEventCollectionIdInCollections({}, "one")).toBeNull();
  });
});

describe("sanitizeImportedEvents — malformed input edge cases", () => {
  it("keeps the earlier side of a reversed span as the timeline start", () => {
    const [event] = sanitizeImportedEvents([
      { title: "Rome", emoji: "🏛️", time: [476], endTime: [-27] },
    ]);
    // Stored as authored; ordering is applied by getEventTimelineRange.
    expect(event.time[0]).toBe(476);
    expect(event.endTime?.[0]).toBe(-27);
    expect(getEventTimelineRange(event)).toEqual({ startYear: -27, endYear: 476 });
  });

  it("nulls individual non-finite time parts but keeps the event", () => {
    const [event] = sanitizeImportedEvents([
      {
        title: "x",
        emoji: "x",
        time: [2000, "5", Number.POSITIVE_INFINITY, Number.NaN, {}, 30],
      },
    ]);
    expect(event.time).toEqual([2000, null, null, null, null, 30]);
  });

  it("truncates time arrays longer than six parts", () => {
    const [event] = sanitizeImportedEvents([
      { title: "x", emoji: "x", time: [2000, 1, 2, 3, 4, 5, 6, 7] },
    ]);
    expect(event.time).toEqual([2000, 1, 2, 3, 4, 5]);
  });

  it("drops events whose year is Infinity", () => {
    expect(
      sanitizeImportedEvents([
        { title: "x", emoji: "x", time: [Number.POSITIVE_INFINITY] },
      ]),
    ).toEqual([]);
  });

  it("defaults non-finite priority and drops non-finite duration", () => {
    const [event] = sanitizeImportedEvents([
      {
        title: "x",
        emoji: "x",
        time: [1],
        priority: Number.POSITIVE_INFINITY,
        duration: Number.NaN,
      },
    ]);
    expect(event.priority).toBe(50);
    expect(event.duration).toBeUndefined();
  });

  it("accepts priority 0 and negative priority verbatim", () => {
    const events = sanitizeImportedEvents([
      { title: "a", emoji: "x", time: [1], priority: 0 },
      { title: "b", emoji: "x", time: [1], priority: -5 },
    ]);
    expect(events.map((event) => event.priority)).toEqual([0, -5]);
  });

  it("ignores a non-string eventUid and derives one", () => {
    const [event] = sanitizeImportedEvents([
      { title: "x", emoji: "x", time: [1], eventUid: 42 },
    ]);
    expect(typeof event.eventUid).toBe("string");
    expect(event.eventUid).not.toBe("42");
  });

  it("does not let an `ongoing` that is truthy-but-not-true through", () => {
    const events = sanitizeImportedEvents([
      { title: "a", emoji: "x", time: [1986], ongoing: "true", endTime: [1990] },
      { title: "b", emoji: "x", time: [1986], ongoing: 1 },
    ]);
    expect(events.every((event) => event.ongoing === undefined)).toBe(true);
    // Not ongoing, so the authored endTime is kept.
    expect(events[0].endTime?.[0]).toBe(1990);
  });

  it("drops an `id` supplied by the import and derives a runtime id instead", () => {
    const [event] = sanitizeImportedEvents([
      { id: "attacker-chosen", title: "x", emoji: "x", time: [1] },
    ]);
    expect(event.id).not.toBe("attacker-chosen");
  });

  it("survives a large batch of mixed garbage without throwing", () => {
    const garbage: unknown[] = [];
    for (let index = 0; index < 500; index += 1) {
      garbage.push(
        index % 5 === 0
          ? { title: `ok ${index}`, emoji: "✅", time: [index - 250] }
          : [null, index, "x", { time: index }, { title: index }][index % 5],
      );
    }
    const events = sanitizeImportedEvents(garbage);
    expect(events).toHaveLength(100);
    expect(new Set(events.map((event) => event.id)).size).toBe(100);
  });

  it("is idempotent: sanitize -> strip -> sanitize yields equal events", () => {
    const first = sanitizeImportedEvents(
      [
        {
          title: { vi: "  Đổi Mới ", en: "Renovation" },
          description: "  ",
          emoji: " 🔄 ",
          time: [1986, 12],
          ongoing: true,
          endTime: [1990],
          priority: 70,
          color: "#22c55e",
        },
      ],
      { collectionId: "vn" },
    );
    const second = sanitizeImportedEvents(stripRuntimeEventIds(first), {
      collectionId: "vn",
    });
    expect(second).toEqual(first);
  });
});
