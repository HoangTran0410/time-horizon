import { describe, expect, it } from "vitest";
import {
  assignRuntimeEventIds,
  buildCustomCollectionMeta,
  slugifyCollectionId,
  slugifyCollectionName,
  stripRuntimeEventId,
  stripRuntimeEventIds,
} from "../helpers";
import type { EventCollectionMeta, StoredEvent } from "../constants/types";

const stored = (overrides: Partial<StoredEvent> = {}): StoredEvent => ({
  title: "Moon landing",
  description: "Apollo 11",
  emoji: "🌕",
  time: [1969, 7, 20],
  priority: 80,
  ...overrides,
});

describe("assignRuntimeEventIds — determinism", () => {
  it("derives the same id and eventUid for the same content on every call", () => {
    const first = assignRuntimeEventIds([stored()], { collectionId: "space" });
    const second = assignRuntimeEventIds([stored()], { collectionId: "space" });
    expect(first[0].id).toBe(second[0].id);
    expect(first[0].eventUid).toBe(second[0].eventUid);
  });

  it("namespaces ids by slugified collection id, defaulting to `event`", () => {
    const [withCollection] = assignRuntimeEventIds([stored()], {
      collectionId: "Lịch Sử Việt Nam",
    });
    const [withoutCollection] = assignRuntimeEventIds([stored()]);
    expect(withCollection.id.startsWith("lich-su-viet-nam-")).toBe(true);
    expect(withCollection.eventUid?.startsWith("lich-su-viet-nam-eu-")).toBe(
      true,
    );
    expect(withoutCollection.id.startsWith("event-")).toBe(true);
  });

  it("gives the same content different ids in different collections", () => {
    const [a] = assignRuntimeEventIds([stored()], { collectionId: "a" });
    const [b] = assignRuntimeEventIds([stored()], { collectionId: "b" });
    expect(a.id).not.toBe(b.id);
    expect(a.eventUid).not.toBe(b.eventUid);
  });

  it("changes the id when content that defines identity changes", () => {
    const [base] = assignRuntimeEventIds([stored()]);
    const variants = [
      stored({ title: "Moon landing!" }),
      stored({ time: [1969, 7, 21] }),
      stored({ endTime: [1969, 7, 24] }),
      stored({ priority: 81 }),
      stored({ emoji: "🚀" }),
      stored({ link: "https://example.com" }),
    ];
    for (const variant of variants) {
      expect(assignRuntimeEventIds([variant])[0].id).not.toBe(base.id);
    }
  });

  it("is insensitive to trailing-null padding and surrounding whitespace", () => {
    const [padded] = assignRuntimeEventIds([
      stored({ time: [1969, 7, 20, null, null, null] }),
    ]);
    const [short] = assignRuntimeEventIds([stored({ time: [1969, 7, 20] })]);
    const [spaced] = assignRuntimeEventIds([
      stored({ title: "  Moon landing  ", emoji: " 🌕 " }),
    ]);
    expect(padded.id).toBe(short.id);
    expect(spaced.id).toBe(short.id);
  });

  it("does NOT fold `ongoing` into identity (legacy eventUids must stay stable)", () => {
    const [plain] = assignRuntimeEventIds([stored({ time: [1986] })]);
    const [ongoing] = assignRuntimeEventIds([
      stored({ time: [1986], ongoing: true }),
    ]);
    expect(ongoing.id).toBe(plain.id);
    expect(ongoing.eventUid).toBe(plain.eventUid);
    expect(ongoing.ongoing).toBe(true);
  });

  it("disambiguates exact duplicates with an occurrence suffix, keeping all ids unique", () => {
    const events = assignRuntimeEventIds([stored(), stored(), stored()], {
      collectionId: "dup",
    });
    const ids = events.map((event) => event.id);
    const uids = events.map((event) => event.eventUid);
    expect(new Set(ids).size).toBe(3);
    expect(new Set(uids).size).toBe(3);
    expect(ids[1].endsWith("-2")).toBe(true);
    expect(ids[2].endsWith("-3")).toBe(true);
  });

  it("re-mints a colliding explicit eventUid so uids stay unique within a batch", () => {
    const events = assignRuntimeEventIds([
      stored({ eventUid: "same" }),
      stored({ eventUid: "same", title: "Other" }),
    ]);
    expect(events[0].eventUid).toBe("same");
    expect(events[1].eventUid).not.toBe("same");
    expect(events[1].eventUid).toBeTruthy();
  });

  it("trims an explicit eventUid and preserves it verbatim otherwise", () => {
    const [event] = assignRuntimeEventIds([stored({ eventUid: "  uid-42  " })]);
    expect(event.eventUid).toBe("uid-42");
  });
});

describe("assignRuntimeEventIds — previousEvents carry-over", () => {
  it("reuses the previous runtime id and eventUid for unchanged content", () => {
    const previous = assignRuntimeEventIds([stored()], {
      collectionId: "space",
    }).map((event) => ({ ...event, id: "kept-id", eventUid: "kept-uid" }));

    const [next] = assignRuntimeEventIds([stored()], {
      collectionId: "space",
      previousEvents: previous,
    });
    expect(next.id).toBe("kept-id");
    expect(next.eventUid).toBe("kept-uid");
  });

  it("prefers an explicit eventUid over the one carried from previousEvents", () => {
    const previous = assignRuntimeEventIds([stored()]).map((event) => ({
      ...event,
      eventUid: "old-uid",
    }));
    const [next] = assignRuntimeEventIds([stored({ eventUid: "explicit" })], {
      previousEvents: previous,
    });
    expect(next.eventUid).toBe("explicit");
  });

  it("hands out previous ids one-to-one across duplicates", () => {
    const previous = assignRuntimeEventIds([stored(), stored()]).map(
      (event, index) => ({ ...event, id: `prev-${index}` }),
    );
    const next = assignRuntimeEventIds([stored(), stored(), stored()], {
      previousEvents: previous,
    });
    expect(next[0].id).toBe("prev-0");
    expect(next[1].id).toBe("prev-1");
    expect(next[2].id).not.toMatch(/^prev-/);
  });
});

describe("stripRuntimeEventId(s)", () => {
  it("removes `id`, keeps eventUid and every stored field", () => {
    const [event] = assignRuntimeEventIds([
      stored({
        endTime: [1969, 7, 24],
        color: "#ff0000",
        image: "https://img",
        video: "https://vid",
        link: "https://link",
        duration: 0.01,
      }),
    ]);
    const strippedEvent = stripRuntimeEventId(event);
    expect("id" in strippedEvent).toBe(false);
    expect(strippedEvent.eventUid).toBe(event.eventUid);
    expect(strippedEvent).toMatchObject({
      title: "Moon landing",
      description: "Apollo 11",
      endTime: [1969, 7, 24, null, null, null],
      color: "#ff0000",
      image: "https://img",
      video: "https://vid",
      link: "https://link",
      duration: 0.01,
      priority: 80,
    });
  });

  it("omits endTime/ongoing keys entirely when absent, and a blank eventUid", () => {
    const strippedEvent = stripRuntimeEventId({
      id: "x",
      eventUid: "   ",
      ...stored(),
    });
    expect("endTime" in strippedEvent).toBe(false);
    expect("ongoing" in strippedEvent).toBe(false);
    expect("eventUid" in strippedEvent).toBe(false);
  });

  it("does not alias the time arrays of the runtime event", () => {
    const [event] = assignRuntimeEventIds([stored()]);
    const strippedEvent = stripRuntimeEventId(event);
    expect(strippedEvent.time).not.toBe(event.time);
    expect(strippedEvent.time).toEqual(event.time);
  });

  it("round-trips: strip -> JSON -> assign yields identical ids and uids", () => {
    const original = assignRuntimeEventIds(
      [
        stored(),
        stored(),
        stored({ title: { vi: "Đổi Mới", en: "Renovation" }, time: [1986], ongoing: true }),
        stored({ time: [-27], endTime: [476] }),
      ],
      { collectionId: "mix" },
    );
    const persisted = JSON.parse(
      JSON.stringify(stripRuntimeEventIds(original)),
    ) as StoredEvent[];
    const reloaded = assignRuntimeEventIds(persisted, { collectionId: "mix" });
    expect(reloaded.map((event) => event.id)).toEqual(
      original.map((event) => event.id),
    );
    expect(reloaded.map((event) => event.eventUid)).toEqual(
      original.map((event) => event.eventUid),
    );
    expect(reloaded[2].ongoing).toBe(true);
    expect(reloaded[3].endTime).toEqual([476, null, null, null, null, null]);
  });
});

describe("slugifyCollectionId", () => {
  it("lowercases, strips diacritics and collapses separators", () => {
    expect(slugifyCollectionId("  Lịch Sử Lớp 6  ")).toBe("lich-su-lop-6");
    expect(slugifyCollectionId("World War II: 1939–1945")).toBe(
      "world-war-ii-1939-1945",
    );
  });

  it("falls back to `collection` when nothing usable is left", () => {
    expect(slugifyCollectionId("")).toBe("collection");
    expect(slugifyCollectionId("🚀🌕")).toBe("collection");
    expect(slugifyCollectionId("---")).toBe("collection");
  });
});

describe("buildCustomCollectionMeta", () => {
  const existing = (id: string): EventCollectionMeta => ({
    id,
    name: id,
    emoji: "📁",
    description: "",
    author: "x",
    createdAt: "2026-01-01",
  });

  it("slugifies the name and suffixes -2, -3 on collision", () => {
    const input = { emoji: "📁", name: "My Stuff", description: "d" };
    expect(buildCustomCollectionMeta(input, []).id).toBe("my-stuff");
    expect(
      buildCustomCollectionMeta(input, [existing("my-stuff")]).id,
    ).toBe("my-stuff-2");
    expect(
      buildCustomCollectionMeta(input, [
        existing("my-stuff"),
        existing("my-stuff-2"),
      ]).id,
    ).toBe("my-stuff-3");
  });

  it("stamps author and a YYYY-MM-DD createdAt", () => {
    const meta = buildCustomCollectionMeta(
      { emoji: "📁", name: "X", description: "" },
      [],
    );
    expect(meta.author).toBe("You");
    expect(meta.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("slugifyCollectionName", () => {
  it("transliterates đ/Đ for newly minted ids", () => {
    expect(slugifyCollectionName("Điện Biên Phủ")).toBe("dien-bien-phu");
    expect(slugifyCollectionName("Đời Đường")).toBe("doi-duong");
  });

  it("leaves the eventUid namespace slug unchanged", () => {
    expect(slugifyCollectionId("Điện Biên Phủ")).toBe("ien-bien-phu");
  });
});
