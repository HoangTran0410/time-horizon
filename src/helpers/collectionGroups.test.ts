import { describe, expect, it } from "vitest";
import type {
  CollectionGroupDefinition,
  EventCollectionMeta,
} from "../constants/types";
import {
  groupCollectionsByDefinitions,
  sanitizeCollectionGroupDefinitions,
} from "./collectionGroups";

const meta = (id: string, categories?: string[]): EventCollectionMeta => ({
  id,
  name: id,
  emoji: "📚",
  description: "",
  author: "",
  createdAt: "2026-01-01",
  categories,
});

/** Mirrors the shipped data-repo file closely enough to test the semantics. */
const definitions: CollectionGroupDefinition[] = [
  { id: "sgk", match: "any", categories: ["Education"], name: "SGK" },
  { id: "biography", match: "any", categories: ["Biography"], name: "Lives" },
  { id: "vietnam", match: "any", categories: ["Vietnam"], name: "VN" },
  {
    id: "world-history",
    match: "primary",
    categories: ["History"],
    name: "World",
  },
  {
    id: "science",
    match: "primary",
    categories: ["Science", "Prehistory"],
    name: "Science",
  },
  { id: "religion", match: "primary", categories: ["Religion"], name: "Rel" },
  { id: "other", match: "fallback", name: "Other" },
];

describe("groupCollectionsByDefinitions", () => {
  it("returns no groups when there are no definitions", () => {
    expect(groupCollectionsByDefinitions([meta("a", ["History"])], [])).toEqual(
      [],
    );
  });

  it("assigns each collection to the first matching definition", () => {
    const groups = groupCollectionsByDefinitions(
      [
        meta("lop-6", ["Education", "History", "Vietnam"]),
        meta("ho-chi-minh", ["Biography", "Politics", "Vietnam"]),
        meta("vn-dynasties", ["History", "Vietnam"]),
        meta("medieval-age", ["History", "Religion"]),
        meta("buddhism", ["Religion", "History"]),
        meta("stone-age", ["Prehistory", "History"]),
      ],
      definitions,
    );

    expect(
      groups.map((group) => [
        group.definition.id,
        group.collections.map((collection) => collection.id),
      ]),
    ).toEqual([
      ["sgk", ["lop-6"]],
      ["biography", ["ho-chi-minh"]],
      ["vietnam", ["vn-dynasties"]],
      ["world-history", ["medieval-age"]],
      ["science", ["stone-age"]],
      ["religion", ["buddhism"]],
    ]);
  });

  it("matches categories case-insensitively and keeps in-folder order", () => {
    const groups = groupCollectionsByDefinitions(
      [meta("bronze", ["HISTORY"]), meta("iron", ["history", "Politics"])],
      definitions,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].collections.map((c) => c.id)).toEqual(["bronze", "iron"]);
  });

  it("routes unmatched collections to the declared fallback", () => {
    const groups = groupCollectionsByDefinitions(
      [meta("mystery", ["Mystery"]), meta("untagged")],
      definitions,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].definition.id).toBe("other");
    expect(groups[0].collections.map((c) => c.id)).toEqual([
      "mystery",
      "untagged",
    ]);
  });

  it("adds an implicit fallback when the definitions forgot one", () => {
    const groups = groupCollectionsByDefinitions(
      [meta("untagged")],
      [{ id: "sgk", match: "any", categories: ["Education"], name: "SGK" }],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].definition.id).toBe("other");
  });

  it("omits folders that end up empty", () => {
    const groups = groupCollectionsByDefinitions(
      [meta("art", ["Culture"])],
      definitions,
    );
    expect(groups.map((group) => group.definition.id)).toEqual(["other"]);
  });
});

describe("sanitizeCollectionGroupDefinitions", () => {
  it("accepts well-formed definitions", () => {
    const parsed = sanitizeCollectionGroupDefinitions([
      { id: "sgk", match: "any", categories: ["Education"], name: { vi: "SGK" } },
      { id: "other", match: "fallback", name: "Other" },
    ]);
    expect(parsed.map((definition) => definition.id)).toEqual(["sgk", "other"]);
  });

  it("drops malformed entries, duplicates, and non-arrays", () => {
    expect(sanitizeCollectionGroupDefinitions(null)).toEqual([]);
    expect(sanitizeCollectionGroupDefinitions({})).toEqual([]);
    expect(
      sanitizeCollectionGroupDefinitions([
        null,
        "x",
        { id: "", name: "no id" },
        { id: "no-name" },
        { id: "bad-name", name: { vi: 3 } },
        { id: "bad-match", name: "x", match: "sometimes" },
        { id: "bad-categories", name: "x", categories: [1] },
        { id: "ok", name: "x" },
        { id: "ok", name: "duplicate" },
      ]),
    ).toEqual([{ id: "ok", name: "x", match: undefined, categories: undefined }]);
  });
});
