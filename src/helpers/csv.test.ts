import { describe, it, expect } from "vitest";
import type {
  EventCollectionMeta,
  EventTime,
  StoredEvent,
} from "../constants/types";
import {
  exportCollectionToCsv,
  parseCsvEventRow,
  parseCsvEvents,
  parseCsvLine,
  parseCsvMetaLine,
} from "./csv";

const makeMeta = (
  overrides: Partial<EventCollectionMeta> = {},
): EventCollectionMeta => ({
  id: "col-1",
  name: "World History",
  emoji: "🌍",
  description: "A test collection",
  author: "tester",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makeEvent = (overrides: Partial<StoredEvent> = {}): StoredEvent => ({
  title: "Untitled",
  description: "",
  emoji: "📅",
  time: [2000],
  priority: 50,
  ...overrides,
});

const exportToText = async (
  meta: EventCollectionMeta,
  events: StoredEvent[],
): Promise<string> => exportCollectionToCsv(meta, events).text();

describe("exportCollectionToCsv → parseCsvEvents round trip", () => {
  it("preserves titles, times, spans, priority, emoji and optional fields", async () => {
    const events: StoredEvent[] = [
      // BCE point event, year-only time.
      makeEvent({
        title: "Founding of Rome",
        description: "Traditional date",
        emoji: "🏛️",
        time: [-753],
        priority: 70,
      }),
      // Span event (endTime set), BCE start to CE end.
      makeEvent({
        title: "Roman Empire",
        description: "From Augustus to the fall of the West",
        emoji: "🦅",
        time: [-27],
        endTime: [476],
        priority: 90,
      }),
      // Full-precision time plus optional fields.
      makeEvent({
        title: "Moon Landing",
        description: "Apollo 11",
        emoji: "🚀",
        time: [1969, 7, 20, 20, 17, 40],
        priority: 95,
        duration: 0.01,
        color: "#ef4444",
        link: "https://example.com/apollo",
        image: "https://example.com/apollo.jpg",
      }),
    ];

    const { events: parsed, meta } = parseCsvEvents(
      await exportToText(makeMeta(), events),
    );

    expect(parsed).toHaveLength(3);

    expect(parsed[0]).toEqual({
      title: "Founding of Rome",
      description: "Traditional date",
      emoji: "🏛️",
      time: [-753],
      priority: 70,
      color: null,
    });

    expect(parsed[1]).toEqual({
      title: "Roman Empire",
      description: "From Augustus to the fall of the West",
      emoji: "🦅",
      time: [-27],
      endTime: [476],
      priority: 90,
      color: null,
    });

    expect(parsed[2]).toEqual({
      title: "Moon Landing",
      description: "Apollo 11",
      emoji: "🚀",
      time: [1969, 7, 20, 20, 17, 40],
      priority: 95,
      duration: 0.01,
      color: "#ef4444",
      link: "https://example.com/apollo",
      image: "https://example.com/apollo.jpg",
    });

    expect(meta).toBeDefined();
    expect(meta).toMatchObject({
      id: "col-1",
      name: "World History",
      emoji: "🌍",
      author: "tester",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("preserves localized title and description records", async () => {
    const events: StoredEvent[] = [
      makeEvent({
        title: { vi: "Sự kiện Trọng đại", en: "Major Event" },
        description: { vi: "Mô tả tiếng Việt", en: "English description" },
        time: [1945, 9, 2],
        priority: 80,
      }),
    ];

    const { events: parsed } = parseCsvEvents(
      await exportToText(makeMeta(), events),
    );

    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toEqual({
      vi: "Sự kiện Trọng đại",
      en: "Major Event",
    });
    expect(parsed[0].description).toEqual({
      vi: "Mô tả tiếng Việt",
      en: "English description",
    });
    expect(parsed[0].time).toEqual([1945, 9, 2]);
  });

  it("round-trips field values containing commas, quotes and semicolons", async () => {
    const trickyTitle = 'Hello, "World"; and more';
    const trickyDescription = 'She said ""twice""; then, left';
    const events: StoredEvent[] = [
      makeEvent({
        title: trickyTitle,
        description: trickyDescription,
        time: [1815, 6, 18],
        priority: 60,
      }),
    ];

    const { events: parsed } = parseCsvEvents(
      await exportToText(makeMeta(), events),
    );

    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe(trickyTitle);
    expect(parsed[0].description).toBe(trickyDescription);
  });

  it("round-trips field values containing literal newlines", async () => {
    // Newlines are quoted per RFC-4180 on export, and the importer splits
    // records quote-aware — a multiline description must not fragment its row.
    const events: StoredEvent[] = [
      makeEvent({ title: "Before", time: [1900], priority: 10 }),
      makeEvent({
        title: "Multiline",
        description: "line one\nline two",
        time: [1950],
        priority: 20,
      }),
      makeEvent({ title: "After", time: [2000], priority: 30 }),
    ];

    const { events: parsed } = parseCsvEvents(
      await exportToText(makeMeta(), events),
    );

    expect(parsed.map((e) => e.title)).toEqual(["Before", "Multiline", "After"]);
    expect(parsed[1].description).toBe("line one\nline two");
  });

  it("round-trips meta values containing semicolons and backslashes", () => {
    const roundTrip = parseCsvMetaLine(
      "#meta;" +
        "id=x;" +
        "name=A\\;B;" +
        "author=back\\\\slash;" +
        "createdAt=2026-01-01",
    );
    expect(roundTrip).toEqual({
      id: "x",
      name: "A;B",
      author: "back\\slash",
      createdAt: "2026-01-01",
    });
  });

  it("round-trips an eventUid column so durable identity survives CSV", async () => {
    const events: StoredEvent[] = [
      makeEvent({ title: "Has uid", time: [1990], eventUid: "uid-keep-1" }),
    ];
    const { events: parsed } = parseCsvEvents(
      await exportToText(makeMeta(), events),
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0].eventUid).toBe("uid-keep-1");
  });

  it("emits the #meta header as the first line", async () => {
    const text = await exportToText(makeMeta(), [makeEvent()]);
    const [firstLine, headerLine] = text.split("\n");
    expect(firstLine.startsWith("#meta;")).toBe(true);
    expect(firstLine).toContain("id=col-1");
    expect(firstLine).toContain("name=World History");
    expect(headerLine.split(",")).toContain("endTime");
  });
});

describe("parseCsvMetaLine", () => {
  it("parses all supported keys from a plain meta line", () => {
    const meta = parseCsvMetaLine(
      "#meta;id=abc;name=My Collection;emoji=🎉;author=Someone;createdAt=2025-05-05",
    );
    expect(meta).toEqual({
      id: "abc",
      name: "My Collection",
      emoji: "🎉",
      author: "Someone",
      createdAt: "2025-05-05",
    });
  });

  it("maps an empty color value to null and ignores unknown keys", () => {
    const meta = parseCsvMetaLine("#meta;id=x;color=;mystery=42");
    expect(meta.id).toBe("x");
    expect(meta.color).toBeNull();
    expect(meta).not.toHaveProperty("mystery");
  });

  it("returns an empty object for a bare #meta line", () => {
    expect(parseCsvMetaLine("#meta")).toEqual({});
  });
});

describe("parseCsvLine", () => {
  it("splits unquoted fields on commas", () => {
    expect(parseCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("keeps commas inside quoted fields", () => {
    expect(parseCsvLine('a,"b,c",d')).toEqual(["a", "b,c", "d"]);
  });

  it("unescapes doubled quotes inside quoted fields", () => {
    expect(parseCsvLine('"say ""hi""",x')).toEqual(['say "hi"', "x"]);
  });

  it("preserves empty fields, including trailing ones", () => {
    expect(parseCsvLine("a,,c,")).toEqual(["a", "", "c", ""]);
  });
});

describe("parseCsvEventRow", () => {
  it("supports header aliases and applies defaults", () => {
    const event = parseCsvEventRow({
      name: "Aliased title",
      desc: "Aliased description",
      year: "1969 7 20",
      end_time: "1972 12",
    });
    expect(event).toEqual({
      title: "Aliased title",
      description: "Aliased description",
      emoji: "📅",
      time: [1969, 7, 20],
      endTime: [1972, 12],
      priority: 50,
      color: null,
    });
  });

  it("keeps an explicit id column for imported events", () => {
    const event = parseCsvEventRow({
      id: "ev-7",
      title: "Has id",
      time: "2001",
    });
    expect(event?.id).toBe("ev-7");
  });

  it("returns null when both title and description are empty", () => {
    expect(parseCsvEventRow({ title: "", description: "", time: "2000" })).toBeNull();
  });

  it("returns null when the time is missing or not numeric", () => {
    expect(parseCsvEventRow({ title: "No time" })).toBeNull();
    expect(parseCsvEventRow({ title: "Bad time", time: "abc" })).toBeNull();
  });

  it("parses priority 0 and negative (BCE) years", () => {
    const event = parseCsvEventRow({
      title: "Zero priority BCE",
      time: "-3200",
      priority: "0",
    });
    expect(event?.time).toEqual([-3200]);
    expect(event?.priority).toBe(0);
  });
});

describe("parseCsvEvents malformed input", () => {
  it("returns an empty list for empty or single-line input", () => {
    expect(parseCsvEvents("")).toEqual({ events: [] });
    expect(parseCsvEvents("   \n  \n")).toEqual({ events: [] });
    expect(parseCsvEvents("just one line")).toEqual({ events: [] });
  });

  it("does not throw on garbage and yields no events", () => {
    const garbage = " \nnot,a,real\ncsv;;;file\n{]}";
    let result: ReturnType<typeof parseCsvEvents> | undefined;
    expect(() => {
      result = parseCsvEvents(garbage);
    }).not.toThrow();
    expect(result?.events).toEqual([]);
    expect(result?.meta).toBeUndefined();
  });

  it("skips rows whose column count does not match the header", () => {
    const csv = [
      "title,description,time",
      "Valid,ok,1990",
      "too,few",
      "way,too,many,columns,here",
    ].join("\n");
    const { events } = parseCsvEvents(csv);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Valid");
  });

  it("skips rows with unparseable times but keeps valid ones", () => {
    const csv = [
      "title,description,time",
      "Good,ok,2020",
      "Bad,broken,not-a-year",
      "AlsoGood,ok,-44",
    ].join("\n");
    const { events } = parseCsvEvents(csv);
    expect(events.map((e) => e.title)).toEqual(["Good", "AlsoGood"]);
    expect(events[1].time).toEqual([-44] satisfies EventTime);
  });

  it("parses files without a #meta line and leaves meta undefined", () => {
    const { events, meta } = parseCsvEvents(
      "title,description,time\nPlain,no meta,1500",
    );
    expect(events).toHaveLength(1);
    expect(meta).toBeUndefined();
  });
});
