import { describe, expect, it } from "vitest";
import {
  buildSyncProjectionSnapshot,
  hasPendingSyncableChanges,
  isCollectionSyncable,
  type SyncProjectionSnapshot,
} from "./index";
import type {
  DeletedCollectionSyncTombstone,
  Event,
  EventCollectionMeta,
  StoredTimelineCollection,
  SyncPreferences,
} from "../constants/types";

const makeEvent = (overrides: Partial<Event> = {}): Event => ({
  id: "runtime-id-1",
  eventUid: "uid-1",
  title: { vi: "Đổ bộ Mặt Trăng", en: "Moon landing" },
  description: "",
  time: [1969],
  emoji: "🌕",
  priority: 50,
  ...overrides,
});

const makeCollection = (
  overrides: Partial<StoredTimelineCollection> = {},
): StoredTimelineCollection => ({
  events: [],
  origin: "custom",
  ...overrides,
});

const onboarded: SyncPreferences = {
  onboardingCompleted: true,
  lastSuccessfulSyncAt: null,
};

const notOnboarded: SyncPreferences = {
  onboardingCompleted: false,
  lastSuccessfulSyncAt: null,
};

const tombstone: DeletedCollectionSyncTombstone = {
  deletedAt: "2026-01-02T03:04:05.000Z",
  origin: "custom",
};

const catalogMeta: EventCollectionMeta = {
  id: "vn-history",
  name: "Lịch sử Việt Nam",
  emoji: "🇻🇳",
  description: "",
  author: "catalog",
  createdAt: "2026-01-01",
};

describe("isCollectionSyncable", () => {
  it("treats every declared CollectionOrigin as syncable", () => {
    expect(
      isCollectionSyncable("a", makeCollection({ origin: "catalog" })),
    ).toBe(true);
    expect(isCollectionSyncable("a", makeCollection({ origin: "custom" }))).toBe(
      true,
    );
    expect(
      isCollectionSyncable("a", makeCollection({ origin: "catalog-fork" })),
    ).toBe(true);
  });

  it("rejects a collection without an origin", () => {
    expect(
      isCollectionSyncable("a", makeCollection({ origin: undefined })),
    ).toBe(false);
  });

  it("admits an origin-less collection when a color preference exists for it", () => {
    const collection = makeCollection({ origin: undefined });
    expect(isCollectionSyncable("a", collection, { a: "#ef4444" })).toBe(true);
    // A preference for a different collection does not help.
    expect(isCollectionSyncable("a", collection, { b: "#ef4444" })).toBe(false);
  });
});

describe("hasPendingSyncableChanges", () => {
  const dirtyCustom = makeCollection({
    sync: { dirty: true, dirtyReason: "content" },
  });

  it("is always false before sync onboarding completes", () => {
    expect(
      hasPendingSyncableChanges({
        collectionLibrary: { a: dirtyCustom },
        deletedCollectionSyncTombstones: { gone: tombstone },
        syncPreferences: notOnboarded,
      }),
    ).toBe(false);
  });

  it("reports pending changes when a deletion tombstone exists, even with a clean library", () => {
    expect(
      hasPendingSyncableChanges({
        collectionLibrary: {},
        deletedCollectionSyncTombstones: { gone: tombstone },
        syncPreferences: onboarded,
      }),
    ).toBe(true);
  });

  it("reports pending changes for a dirty syncable collection", () => {
    expect(
      hasPendingSyncableChanges({
        collectionLibrary: { a: dirtyCustom },
        deletedCollectionSyncTombstones: {},
        syncPreferences: onboarded,
      }),
    ).toBe(true);
  });

  it("ignores dirtiness on a non-syncable collection", () => {
    const dirtyOriginless = makeCollection({
      origin: undefined,
      sync: { dirty: true, dirtyReason: "content" },
    });
    expect(
      hasPendingSyncableChanges({
        collectionLibrary: { a: dirtyOriginless },
        deletedCollectionSyncTombstones: {},
        syncPreferences: onboarded,
      }),
    ).toBe(false);
    // The same collection becomes reportable once a color preference makes it syncable.
    expect(
      hasPendingSyncableChanges({
        collectionLibrary: { a: dirtyOriginless },
        deletedCollectionSyncTombstones: {},
        syncPreferences: onboarded,
        collectionColorPreferences: { a: "#22c55e" },
      }),
    ).toBe(true);
  });

  it("is false when every syncable collection is clean", () => {
    expect(
      hasPendingSyncableChanges({
        collectionLibrary: {
          a: makeCollection({ sync: { dirty: false } }),
          b: makeCollection({ origin: "catalog", sync: null }),
        },
        deletedCollectionSyncTombstones: {},
        syncPreferences: onboarded,
      }),
    ).toBe(false);
  });
});

describe("buildSyncProjectionSnapshot", () => {
  const events = [makeEvent()];
  const collectionLibrary: Record<string, StoredTimelineCollection> = {
    "custom-notes": makeCollection({
      events,
      sync: { dirty: true, dirtyReason: "content" },
    }),
    "vn-history": makeCollection({ origin: "catalog", meta: catalogMeta }),
    "vn-history-fork": makeCollection({
      origin: "catalog-fork",
      sourceCatalogId: "vn-history",
    }),
    "origin-less": makeCollection({ origin: undefined }),
    "colored-only": makeCollection({ origin: undefined }),
  };

  const buildSnapshot = () =>
    buildSyncProjectionSnapshot({
      collectionLibrary,
      deletedCollectionSyncTombstones: {
        gone: { ...tombstone, sourceCatalogId: "upstream-id" },
      },
      syncPreferences: onboarded,
      collectionColorPreferences: {
        "colored-only": "#ef4444",
        "vn-history": "#22c55e",
      },
      generatedAt: "2026-08-08T00:00:00.000Z",
    });

  const byId = (snapshot: SyncProjectionSnapshot, id: string) => {
    const entry = snapshot.collections.find(
      (collection) => collection.id === id,
    );
    if (!entry) throw new Error(`snapshot is missing collection "${id}"`);
    return entry;
  };

  it("includes exactly the syncable collections", () => {
    const snapshot = buildSnapshot();
    expect(snapshot.collections.map((collection) => collection.id).sort()).toEqual(
      ["colored-only", "custom-notes", "vn-history", "vn-history-fork"],
    );
  });

  it("uses the provided generatedAt verbatim, and defaults to a parseable ISO timestamp", () => {
    expect(buildSnapshot().generatedAt).toBe("2026-08-08T00:00:00.000Z");

    const defaulted = buildSyncProjectionSnapshot({
      collectionLibrary: {},
      deletedCollectionSyncTombstones: {},
      syncPreferences: onboarded,
      collectionColorPreferences: {},
    });
    expect(typeof defaulted.generatedAt).toBe("string");
    expect(Number.isNaN(Date.parse(defaulted.generatedAt))).toBe(false);
  });

  it("projects per-collection fields: origin fallback, sourceCatalogId, meta, colorPreference, dirtyReason", () => {
    const snapshot = buildSnapshot();

    // Missing origin falls back to "catalog" — even for a collection that is
    // only in the snapshot because of its color preference.
    expect(byId(snapshot, "colored-only").origin).toBe("catalog");
    expect(byId(snapshot, "custom-notes").origin).toBe("custom");

    expect(byId(snapshot, "vn-history-fork").sourceCatalogId).toBe("vn-history");
    expect("sourceCatalogId" in byId(snapshot, "custom-notes")).toBe(false);

    // meta is null when absent, passed through when present.
    expect(byId(snapshot, "custom-notes").meta).toBeNull();
    expect(byId(snapshot, "vn-history").meta).toEqual(catalogMeta);

    // colorPreference appears only for collections that actually have one.
    expect(byId(snapshot, "vn-history").colorPreference).toBe("#22c55e");
    expect(byId(snapshot, "colored-only").colorPreference).toBe("#ef4444");
    expect("colorPreference" in byId(snapshot, "custom-notes")).toBe(false);

    // dirtyReason appears only when the collection sync state carries one.
    expect(byId(snapshot, "custom-notes").dirtyReason).toBe("content");
    expect("dirtyReason" in byId(snapshot, "vn-history")).toBe(false);
  });

  it("passes events through verbatim — runtime `id` fields are NOT stripped (current behavior)", () => {
    // The durable identity is eventUid; the runtime `id` is documented as
    // never-persisted, yet the snapshot carries the events array by reference,
    // so runtime ids leak into the sync payload. Flagged in the review notes;
    // this test pins the actual behavior.
    const snapshot = buildSnapshot();
    const entry = byId(snapshot, "custom-notes");
    expect(entry.events).toBe(events);
    expect(entry.events?.[0]?.id).toBe("runtime-id-1");
    expect(entry.events?.[0]?.eventUid).toBe("uid-1");
  });

  it("flattens deletion tombstones into deletedCollections with their id", () => {
    expect(buildSnapshot().deletedCollections).toEqual([
      {
        id: "gone",
        deletedAt: "2026-01-02T03:04:05.000Z",
        origin: "custom",
        sourceCatalogId: "upstream-id",
      },
    ]);
  });

  it("produces a snapshot that survives a JSON round trip losslessly", () => {
    const snapshot = buildSnapshot();
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});
