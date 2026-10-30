import { describe, expect, it } from "vitest";
import type { EventCollectionMeta, StoredEvent } from "../constants/types";
import {
  exportCollectionToCsv,
  parseCsvEventRow,
  parseCsvEvents,
  parseCsvLine,
  splitCsvRecords,
} from "./csv";
import { sanitizeImportedEvents } from "../stores";
import { stripRuntimeEventIds } from "../helpers";

const meta: EventCollectionMeta = {
  id: "lich-su",
  name: "Lịch sử; \"Việt\" Nam",
  emoji: "🇻🇳",
  description: "",
  author: "Nguyễn Văn A",
  createdAt: "2026-01-01",
};

const event = (overrides: Partial<StoredEvent> = {}): StoredEvent => ({
  title: "Untitled",
  description: "",
  emoji: "📅",
  time: [2000],
  priority: 50,
  ...overrides,
});

/** Full app path: stored events -> CSV -> parse -> sanitize -> strip. */
const roundTrip = async (events: StoredEvent[]) => {
  const text = await exportCollectionToCsv(meta, events).text();
  const parsed = parseCsvEvents(text);
  return {
    text,
    meta: parsed.meta,
    events: stripRuntimeEventIds(sanitizeImportedEvents(parsed.events)),
  };
};

describe("CSV round trip through the sanitizer", () => {
  it("preserves tricky text: quotes, commas, semicolons, CRLF, tabs and unicode", async () => {
    const tricky = [
      'He said "xin chào", then left; later, returned',
      "Line one\r\nLine two\nLine three",
      "Tab\tseparated, ‘smart quotes’ — em dash … ellipsis",
      "👨‍👩‍👧‍👦 family ZWJ, 🏳️‍🌈 flag, Ω≈ç√",
      "Tiếng Việt: Đại Việt sử ký toàn thư",
      '""leading quotes""',
      ",leading comma",
    ];
    const { events } = await roundTrip(
      tricky.map((text, index) =>
        event({ title: text, description: text, time: [1000 + index] }),
      ),
    );
    expect(events.map((item) => item.title)).toEqual(tricky);
    expect(events.map((item) => item.description)).toEqual(tricky);
  });

  it("preserves meta with semicolons, quotes and unicode", async () => {
    const { meta: parsedMeta } = await roundTrip([event()]);
    expect(parsedMeta).toMatchObject({
      id: meta.id,
      name: meta.name,
      emoji: meta.emoji,
      author: meta.author,
      createdAt: meta.createdAt,
    });
  });

  it("preserves deep-time and full-precision times", async () => {
    const times: StoredEvent["time"][] = [
      [-13.8e9],
      [-66_000_000],
      [-44, 3, 15],
      [0],
      [1969, 7, 20, 20, 17, 40],
      [2000, 1, 1, 0, 0, 0],
    ];
    const { events } = await roundTrip(times.map((time) => event({ time })));
    expect(events.map((item) => item.time)).toEqual(
      times.map((time) => [...time, null, null, null, null, null].slice(0, 6)),
    );
  });

  it("preserves eventUid, spans and ongoing flags so durable identity survives", async () => {
    const input = [
      event({ eventUid: "uid-1", time: [-27], endTime: [476] }),
      event({ eventUid: "uid-2", time: [1986], ongoing: true }),
    ];
    const { events } = await roundTrip(input);
    expect(events[0]).toMatchObject({ eventUid: "uid-1", endTime: [476, null, null, null, null, null] });
    expect(events[1]).toMatchObject({ eventUid: "uid-2", ongoing: true });
    expect(events[1].endTime).toBeUndefined();
  });

  it("round-trips a localized title record containing quotes and commas", async () => {
    const title = { vi: 'Trận "Bạch Đằng", 938', en: 'Battle of "Bach Dang", 938' };
    const { events } = await roundTrip([event({ title })]);
    expect(events[0].title).toEqual(title);
  });

  it("keeps an empty collection importable as zero events, not an error", async () => {
    const { events, meta: parsedMeta } = await roundTrip([]);
    expect(events).toEqual([]);
    expect(parsedMeta?.id).toBe(meta.id);
  });
});

describe("splitCsvRecords", () => {
  it("splits on LF, CRLF and lone CR outside quotes", () => {
    expect(splitCsvRecords("a\nb\r\nc\rd")).toEqual(["a", "b", "c", "d"]);
  });

  it("keeps newlines inside quoted fields, including after an escaped quote", () => {
    expect(splitCsvRecords('x,"a ""q""\nb"\ny')).toEqual([
      'x,"a ""q""\nb"',
      "y",
    ]);
  });

  it("emits a trailing empty record for a trailing newline (filtered by parseCsvEvents)", () => {
    expect(splitCsvRecords("a\n")).toEqual(["a", ""]);
  });
});

describe("parseCsvLine", () => {
  it("handles an empty quoted field and a quoted field at end of line", () => {
    expect(parseCsvLine('a,"",b,"c,d"')).toEqual(["a", "", "b", "c,d"]);
  });

  it("returns a single empty field for an empty line", () => {
    expect(parseCsvLine("")).toEqual([""]);
  });
});

describe("parseCsvEvents — hand-written files", () => {
  it("accepts CRLF line endings throughout", () => {
    const text = "title,time,emoji\r\nMoon,1969 7 20,🌕\r\nWeb,1989,🌐\r\n";
    const { events } = parseCsvEvents(text);
    expect(events.map((item) => item.title)).toEqual(["Moon", "Web"]);
    expect(events[0].time).toEqual([1969, 7, 20]);
  });

  it("accepts quoted header names and the endYear / year aliases", () => {
    const text = '"title","year","endYear","emoji"\nRome,-27,476,🏛️';
    const [row] = parseCsvEvents(text).events;
    expect(row.time).toEqual([-27]);
    expect(row.endTime).toEqual([476]);
  });

  it("parses ongoing as true/1/yes, case-insensitively", () => {
    for (const value of ["true", "TRUE", "1", "yes", " Yes "]) {
      expect(
        parseCsvEventRow({ title: "x", time: "1986", ongoing: value })?.ongoing,
      ).toBe(true);
    }
    for (const value of ["", "false", "0", "no", "y"]) {
      expect(
        parseCsvEventRow({ title: "x", time: "1986", ongoing: value })?.ongoing,
      ).toBeUndefined();
    }
  });

  it("accepts scientific-notation years", () => {
    expect(parseCsvEventRow({ title: "x", time: "-1.38e10" })?.time).toEqual([
      -13.8e9,
    ]);
  });

  it("defaults a missing emoji column so the sanitizer keeps the row", () => {
    const { events } = parseCsvEvents("title,time\nMoon,1969");
    expect(sanitizeImportedEvents(events)).toHaveLength(1);
  });
});
