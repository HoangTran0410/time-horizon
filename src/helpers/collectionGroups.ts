import type {
  CollectionGroupDefinition,
  CollectionGroupMatch,
  EventCollectionMeta,
} from "../constants/types";

/**
 * Grouping of the public catalog into topical folders. The folder definitions
 * (names, order, category rules) live in the data repo as
 * `collection-groups.json` — they are catalog content, not app code — so this
 * module only implements the matching. An app talking to a data repo that
 * does not ship the file simply gets no folders and renders the flat list.
 */

export type CollectionGroup = {
  definition: CollectionGroupDefinition;
  collections: EventCollectionMeta[];
};

/**
 * Safety net for collections no data-defined folder matches when the data
 * repo forgot a fallback entry; with the shipped file it never renders.
 */
const IMPLICIT_FALLBACK_DEFINITION: CollectionGroupDefinition = {
  id: "other",
  match: "fallback",
  name: { vi: "Khác", en: "Other" },
};

const COLLECTION_GROUP_MATCHES: readonly CollectionGroupMatch[] = [
  "any",
  "primary",
  "fallback",
];

const isLocalizedText = (value: unknown): value is string | Record<string, string> =>
  typeof value === "string" ||
  (typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "string"));

/**
 * The groups file is remote catalog data, so it gets the same defensive
 * treatment as every other fetched payload: malformed entries are dropped,
 * not trusted.
 */
export const sanitizeCollectionGroupDefinitions = (
  data: unknown,
): CollectionGroupDefinition[] => {
  if (!Array.isArray(data)) return [];

  const definitions: CollectionGroupDefinition[] = [];
  const seenIds = new Set<string>();
  for (const entry of data) {
    if (typeof entry !== "object" || entry === null) continue;
    const { id, name, match, categories } = entry as Record<string, unknown>;
    if (typeof id !== "string" || id.trim().length === 0) continue;
    if (seenIds.has(id)) continue;
    if (!isLocalizedText(name)) continue;
    if (
      match !== undefined &&
      !COLLECTION_GROUP_MATCHES.includes(match as CollectionGroupMatch)
    ) {
      continue;
    }
    if (
      categories !== undefined &&
      (!Array.isArray(categories) ||
        categories.some((category) => typeof category !== "string"))
    ) {
      continue;
    }

    seenIds.add(id);
    definitions.push({
      id,
      name,
      match: match as CollectionGroupMatch | undefined,
      categories: categories as string[] | undefined,
    });
  }

  return definitions;
};

const normalizeCategories = (meta: EventCollectionMeta) =>
  (meta.categories ?? [])
    .map((category) => category.trim().toLowerCase())
    .filter((category) => category.length > 0);

const matchesDefinition = (
  definition: CollectionGroupDefinition,
  categories: string[],
) => {
  const match = definition.match ?? "primary";
  if (match === "fallback") return true;

  const definitionCategories = (definition.categories ?? []).map((category) =>
    category.trim().toLowerCase(),
  );
  if (definitionCategories.length === 0) return false;

  if (match === "any") {
    return categories.some((category) =>
      definitionCategories.includes(category),
    );
  }

  return categories.length > 0 && definitionCategories.includes(categories[0]);
};

/**
 * Split a catalog list into ordered, non-empty folders; first matching
 * definition wins and collections keep their relative order inside a folder.
 * No definitions means no grouping — callers render their flat layout.
 */
export const groupCollectionsByDefinitions = (
  collections: EventCollectionMeta[],
  definitions: CollectionGroupDefinition[],
): CollectionGroup[] => {
  if (definitions.length === 0) return [];

  const hasFallback = definitions.some(
    (definition) => (definition.match ?? "primary") === "fallback",
  );
  const orderedDefinitions = hasFallback
    ? definitions
    : [...definitions, IMPLICIT_FALLBACK_DEFINITION];

  const buckets = new Map<string, EventCollectionMeta[]>();
  for (const collection of collections) {
    const categories = normalizeCategories(collection);
    const definition = orderedDefinitions.find((candidate) =>
      matchesDefinition(candidate, categories),
    );
    if (!definition) continue;
    const bucket = buckets.get(definition.id);
    if (bucket) bucket.push(collection);
    else buckets.set(definition.id, [collection]);
  }

  return orderedDefinitions.flatMap((definition) => {
    const bucket = buckets.get(definition.id);
    return bucket ? [{ definition, collections: bucket }] : [];
  });
};
