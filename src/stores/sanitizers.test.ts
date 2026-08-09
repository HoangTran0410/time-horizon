import { describe, expect, it } from "vitest";
import {
  filterTimelineSearchEvents,
  findEventByIdInCollections,
  sanitizeImportedEvents,
  useStore,
} from "./index";
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

describe("sanitizeImportedEvents — hostile input tolerance", () => {
  it("returns [] for anything that is not an array", () => {
    expect(sanitizeImportedEvents(null)).toEqual([]);
    expect(sanitizeImportedEvents(undefined)).toEqual([]);
    expect(sanitizeImportedEvents({})).toEqual([]);
    expect(sanitizeImportedEvents("events")).toEqual([]);
    expect(sanitizeImportedEvents(42)).toEqual([]);
  });

  it("drops non-object entries and events missing title, emoji, or a usable time", () => {
    const result = sanitizeImportedEvents([
      null,
      42,
      "event",
      [],
      { title: "No emoji", description: "", time: [1969] },
      { emoji: "🌕", description: "", time: [1969] },
      { title: { vi: "  ", en: "" }, emoji: "🌕", time: [1969] },
      { title: "Bad time", emoji: "🌕", time: "1969" },
      { title: "Bad time", emoji: "🌕", time: [] },
      { title: "Bad time", emoji: "🌕", time: ["1969"] },
      { title: "Bad time", emoji: "🌕", time: [null, 5] },
      { title: "Bad time", emoji: "🌕", time: [Number.NaN] },
    ]);
    expect(result).toEqual([]);
  });

  it("normalizes a valid event: trims strings, defaults priority, nulls bad colors", () => {
    const [event] = sanitizeImportedEvents([
      {
        title: "  Điện Biên Phủ  ",
        description: 42,
        emoji: "  🎖️  ",
        time: [1954, 5, 7],
        priority: "high",
        duration: "long",
        color: 0xff0000,
        image: 1,
        video: false,
        link: {},
      },
    ]);

    expect(event).toBeDefined();
    expect(event.title).toBe("Điện Biên Phủ");
    expect(event.description).toBe("");
    expect(event.emoji).toBe("🎖️");
    expect(event.time).toEqual([1954, 5, 7, null, null, null]);
    expect(event.priority).toBe(50);
    expect(event.duration).toBeUndefined();
    expect(event.color).toBeNull();
    expect(event.image).toBeUndefined();
    expect(event.video).toBeUndefined();
    expect(event.link).toBeUndefined();
  });

  it("prunes blank languages from localized titles", () => {
    const [event] = sanitizeImportedEvents([
      {
        title: { vi: "   ", en: "  Moon landing  ", xx: 42 },
        description: "",
        emoji: "🌕",
        time: [1969],
      },
    ]);
    expect(event.title).toEqual({ en: "Moon landing" });
  });

  it("degrades a malformed endTime to a point event instead of rejecting it", () => {
    const [event] = sanitizeImportedEvents([
      {
        title: "Đế chế La Mã",
        description: "",
        emoji: "🏛️",
        time: [-27],
        endTime: "476",
      },
    ]);
    expect(event).toBeDefined();
    expect(event.endTime).toBeUndefined();
  });

  it("passes `ongoing: true` through and rejects every other value", () => {
    const events = sanitizeImportedEvents([
      { title: "A", description: "", emoji: "🌕", time: [1986], ongoing: true },
      { title: "B", description: "", emoji: "🌕", time: [1986], ongoing: "yes" },
      { title: "C", description: "", emoji: "🌕", time: [1986], ongoing: 1 },
    ]);
    expect(events.map((event) => event.ongoing)).toEqual([
      true,
      undefined,
      undefined,
    ]);
  });

  it("drops a stored endTime when the event is ongoing — the end is 'now'", () => {
    const [event] = sanitizeImportedEvents([
      {
        title: "Đổi Mới",
        description: "",
        emoji: "🌱",
        time: [1986],
        endTime: [2026],
        ongoing: true,
      },
    ]);
    expect(event.ongoing).toBe(true);
    expect(event.endTime).toBeUndefined();
  });

  it("assigns deterministic runtime ids and eventUids", () => {
    const raw = [
      { title: "A", description: "", emoji: "🌕", time: [1969] },
      { title: "A", description: "", emoji: "🌕", time: [1969] },
      { title: "B", description: "", emoji: "🌕", time: [1970] },
    ];
    const first = sanitizeImportedEvents(raw, { collectionId: "c" });
    const second = sanitizeImportedEvents(raw, { collectionId: "c" });

    expect(first).toHaveLength(3);
    expect(new Set(first.map((event) => event.id)).size).toBe(3);
    expect(new Set(first.map((event) => event.eventUid)).size).toBe(3);
    expect(second).toEqual(first);
  });

  it("regenerates the runtime `id` but preserves an explicit `eventUid`", () => {
    // eventUid is the durable identity that must survive imports and
    // re-downloads (it can be a random uuid, not derivable from content);
    // the runtime id, by contrast, is always re-derived and never trusted.
    const [event] = sanitizeImportedEvents(
      [
        {
          id: "attacker-supplied-id",
          eventUid: "persisted-uid",
          title: "A",
          description: "",
          emoji: "🌕",
          time: [1969],
        },
      ],
      { collectionId: "c" },
    );

    expect(event.id).not.toBe("attacker-supplied-id");
    expect(event.eventUid).toBe("persisted-uid");
  });

  it("still derives an eventUid when the incoming one is blank", () => {
    const [event] = sanitizeImportedEvents(
      [
        {
          eventUid: "   ",
          title: "A",
          description: "",
          emoji: "🌕",
          time: [1969],
        },
      ],
      { collectionId: "c" },
    );

    expect(typeof event.eventUid).toBe("string");
    expect(event.eventUid!.trim().length > 0).toBe(true);
  });
});

describe("filterTimelineSearchEvents", () => {
  const moon = makeEvent("moon", {
    title: { vi: "Đổ bộ Mặt Trăng", en: "Moon Landing" },
    description: { en: "Apollo 11 reaches the surface" },
    time: [1969, 7, 20],
    image: "moon.jpg",
  });
  const trung = makeEvent("trung", {
    title: "Khởi nghĩa Hai Bà Trưng",
    time: [40],
    link: "https://example.com",
  });
  const web = makeEvent("web", {
    title: { en: "World Wide Web" },
    time: [1989],
    video: "web.mp4",
  });
  const all = [moon, trung, web];
  const ids = (events: Event[]) => events.map((event) => event.id);

  it("returns everything, in order, for an empty query with no filters", () => {
    expect(filterTimelineSearchEvents(all, "", [])).toEqual(all);
    expect(filterTimelineSearchEvents(all, "   ", [])).toEqual(all);
  });

  it("matches localized titles in either language", () => {
    expect(ids(filterTimelineSearchEvents(all, "landing", []))).toEqual(["moon"]);
    expect(ids(filterTimelineSearchEvents(all, "mặt trăng", []))).toEqual([
      "moon",
    ]);
    // Terms may each hit a different language of the same title.
    expect(ids(filterTimelineSearchEvents(all, "moon đổ", []))).toEqual(["moon"]);
  });

  it("is case-insensitive, including Vietnamese letters", () => {
    expect(ids(filterTimelineSearchEvents(all, "MOON", []))).toEqual(["moon"]);
    expect(ids(filterTimelineSearchEvents(all, "TRƯNG", []))).toEqual(["trung"]);
  });

  it("does NOT strip diacritics — an unaccented query misses accented titles", () => {
    expect(filterTimelineSearchEvents(all, "mat trang", [])).toEqual([]);
    expect(filterTimelineSearchEvents(all, "trung", [])).toEqual([]);
  });

  it("matches descriptions too", () => {
    expect(ids(filterTimelineSearchEvents(all, "apollo", []))).toEqual(["moon"]);
  });

  it("applies media filters conjunctively and drops unknown filter values", () => {
    expect(ids(filterTimelineSearchEvents(all, "", ["image"]))).toEqual(["moon"]);
    expect(ids(filterTimelineSearchEvents(all, "", ["video"]))).toEqual(["web"]);
    expect(ids(filterTimelineSearchEvents(all, "", ["link"]))).toEqual(["trung"]);
    expect(filterTimelineSearchEvents(all, "", ["image", "video"])).toEqual([]);

    const hostileFilters = ["image", "podcast", 42] as unknown as MediaFilter[];
    expect(ids(filterTimelineSearchEvents(all, "", hostileFilters))).toEqual([
      "moon",
    ]);
  });

  it("filters by time range and ignores unusable or inverted range inputs", () => {
    expect(
      ids(filterTimelineSearchEvents(all, "", [], { startTimeInput: "1950" })),
    ).toEqual(["moon", "web"]);
    expect(
      ids(filterTimelineSearchEvents(all, "", [], { endTimeInput: "100" })),
    ).toEqual(["trung"]);
    expect(
      ids(
        filterTimelineSearchEvents(all, "", [], {
          startTimeInput: "1900",
          endTimeInput: "1975",
        }),
      ),
    ).toEqual(["moon"]);
    // Unparseable and inverted ranges are ignored rather than matching nothing.
    expect(
      filterTimelineSearchEvents(all, "", [], { startTimeInput: "not-a-date" }),
    ).toEqual(all);
    expect(
      filterTimelineSearchEvents(all, "", [], {
        startTimeInput: "2000",
        endTimeInput: "1990",
      }),
    ).toEqual(all);
  });

  it("sorts by time in both directions", () => {
    expect(
      ids(filterTimelineSearchEvents(all, "", [], { sortMode: "time-asc" })),
    ).toEqual(["trung", "moon", "web"]);
    expect(
      ids(filterTimelineSearchEvents(all, "", [], { sortMode: "time-desc" })),
    ).toEqual(["web", "moon", "trung"]);
  });

  it("sorts by localized title name", () => {
    expect(
      ids(
        filterTimelineSearchEvents(all, "", [], {
          sortMode: "name-asc",
          language: "en",
        }),
      ),
    ).toEqual(["trung", "moon", "web"]);
    expect(
      ids(
        filterTimelineSearchEvents(all, "", [], {
          sortMode: "name-desc",
          language: "en",
        }),
      ),
    ).toEqual(["web", "moon", "trung"]);
  });

  it("ranks best-match: title prefix beats title substring beats description match", () => {
    const globe = makeEvent("globe", {
      title: { en: "Globalization" },
      description: { en: "A connected world" },
    });
    const atlas = makeEvent("atlas", { title: { en: "Atlas of the World" } });
    const events = [globe, atlas, web];

    expect(
      ids(
        filterTimelineSearchEvents(events, "world", [], {
          sortMode: "best-match",
        }),
      ),
    ).toEqual(["web", "atlas", "globe"]);
  });
});

describe("findEventByIdInCollections", () => {
  const byCollection = {
    a: [makeEvent("a1")],
    b: [makeEvent("b1"), makeEvent("b2")],
  };

  it("finds an event by runtime id across collections", () => {
    expect(findEventByIdInCollections(byCollection, "b2")).toBe(
      byCollection.b[1],
    );
  });

  it("returns null for a missing id or an empty library", () => {
    expect(findEventByIdInCollections(byCollection, "nope")).toBeNull();
    expect(findEventByIdInCollections({}, "a1")).toBeNull();
  });
});

/**
 * `sanitizePersistedTimelineState` is not exported, but it is the merge/migrate
 * gate of the persist middleware, so hostile persisted payloads (localStorage,
 * Drive restores, user JSON) are exercised through the public persist API:
 * write a payload under the store key, rehydrate, inspect the merged state.
 */
describe("persisted-state sanitization via useStore.persist.rehydrate()", () => {
  const STORE_KEY = "time-horizon:timeline-store:v1";

  const rehydrateWith = async (state: unknown, version = 5) => {
    localStorage.setItem(STORE_KEY, JSON.stringify({ state, version }));
    await useStore.persist.rehydrate();
    return useStore.getState();
  };

  it("tolerates null or array persisted state, keeping defaults and forcing sync-safe flags", async () => {
    for (const hostile of [null, [1, 2, 3]]) {
      const state = await rehydrateWith(hostile);
      expect(state.currentLanguage).toBe("vi");
      expect(state.theme).toBe("dark");
      expect(state.collectionLibrary).toEqual({});
      expect(state.syncConnectionStatus).toBe("disconnected");
      expect(state.syncPreferences.onboardingCompleted).toBe(false);
    }
  });

  it("sanitizes wrong-typed fields without throwing", async () => {
    const state = await rehydrateWith({
      theme: "neon",
      currentLanguage: "fr",
      searchQuery: 42,
      activeMediaFilters: ["image", "podcast", 7],
      collectionLibrary: [1, 2, 3],
      deletedCollectionSyncTombstones: {
        badOrigin: { origin: "weird", deletedAt: "2026-01-01T00:00:00.000Z" },
        noDate: { origin: "custom", deletedAt: "   " },
        keep: { origin: "custom", deletedAt: "2026-01-01T00:00:00.000Z" },
        scalar: 42,
      },
      visibleCollectionIds: ["missing", 42, "missing"],
      dimmedEventUids: ["uid-1", "uid-1", 42, "", "   ", "uid-2", null],
      syncPreferences: [],
      syncConnectionStatus: "connected",
      syncAccessToken: "  token  ",
      syncAccessTokenExpiry: "soon",
      selectedEventId: "no-such-event",
      savedFocusYear: "1999",
      spatialMapping: "garbage",
    });

    expect(state.activeMediaFilters).toEqual(["image"]);
    expect(state.collectionLibrary).toEqual({});
    expect(state.deletedCollectionSyncTombstones).toEqual({
      keep: { origin: "custom", deletedAt: "2026-01-01T00:00:00.000Z" },
    });
    expect(state.visibleCollectionIds).toEqual([]);
    expect(state.dimmedEventUids).toEqual(["uid-1", "uid-2"]);
    expect(state.syncPreferences).toEqual({
      onboardingCompleted: false,
      lastSuccessfulSyncAt: null,
    });
    // merge() forces disconnected on every reload, even if the payload said otherwise.
    expect(state.syncConnectionStatus).toBe("disconnected");
    expect(state.syncAccessToken).toBe("token");
    expect(state.syncAccessTokenExpiry).toBeNull();
    expect(state.selectedEventId).toBeNull();
    expect(state.savedFocusYear).toBeNull();
    expect(state.spatialMapping).toBeTypeOf("object");
    // Invalid persisted scalars are dropped by the sanitizer, so the merge
    // spread leaves the in-memory defaults intact instead of clobbering them
    // with explicit `undefined`.
    expect(state.theme).toBe("dark");
    expect(state.currentLanguage).toBe("vi");
  });

  it("rebuilds collection library entries defensively", async () => {
    const rawGoodEvent = {
      title: "Điện Biên Phủ",
      description: "",
      emoji: "🎖️",
      time: [1954, 5, 7],
      priority: 60,
      eventUid: "persisted-uid",
    };
    const [expectedGoodEvent] = sanitizeImportedEvents([rawGoodEvent], {
      collectionId: "good",
    });

    const state = await rehydrateWith({
      collectionLibrary: {
        good: { events: [rawGoodEvent], origin: "custom" },
        unknownOrigin: { events: [], origin: "alien", isLocal: true },
        forked: { events: [], sourceCatalogId: "upstream" },
        plain: { events: "nope" },
        arrayCollection: [1, 2],
        nullCollection: null,
      },
      visibleCollectionIds: ["good", "good", "arrayCollection", "unknownOrigin"],
      selectedEventId: expectedGoodEvent.id,
    });

    expect(Object.keys(state.collectionLibrary).sort()).toEqual([
      "forked",
      "good",
      "plain",
      "unknownOrigin",
    ]);
    expect(state.collectionLibrary.good.origin).toBe("custom");
    expect(state.collectionLibrary.good.events).toEqual([expectedGoodEvent]);
    // Unknown origin string + isLocal flag resolves to "custom".
    expect(state.collectionLibrary.unknownOrigin.origin).toBe("custom");
    // A foreign sourceCatalogId resolves to a catalog fork.
    expect(state.collectionLibrary.forked.origin).toBe("catalog-fork");
    expect(state.collectionLibrary.forked.sourceCatalogId).toBe("upstream");
    // No origin hints at all falls back to "catalog"; garbage events become [].
    expect(state.collectionLibrary.plain.origin).toBe("catalog");
    expect(state.collectionLibrary.plain.events).toEqual([]);
    // Visible ids are deduplicated and restricted to surviving collections.
    expect(state.visibleCollectionIds).toEqual(["good", "unknownOrigin"]);
    // A selected event id is kept only when it resolves to a real event.
    expect(state.selectedEventId).toBe(expectedGoodEvent.id);
  });

  it("keeps auto-orientation on for payloads saved before the field existed", async () => {
    // Every returning visitor has a stored payload without this key, so the
    // default has to survive the merge for auto-orientation to reach them.
    const state = await rehydrateWith({ timelineOrientation: "horizontal" });

    expect(state.timelineOrientationAuto).toBe(true);
  });

  it("keeps an explicit auto-orientation opt-out", async () => {
    const state = await rehydrateWith({ timelineOrientationAuto: false });

    expect(state.timelineOrientationAuto).toBe(false);
  });

  it("routes old-version payloads through the same sanitizer via migrate", async () => {
    const state = await rehydrateWith(
      {
        theme: "light",
        collectionLibrary: { x: { events: [] } },
        dimmedEventUids: ["keep", 42],
      },
      0,
    );

    expect(state.theme).toBe("light");
    expect(state.collectionLibrary.x.origin).toBe("catalog");
    expect(state.dimmedEventUids).toEqual(["keep"]);
  });
});
