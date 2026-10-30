/**
 * Event identity. `id` is a runtime-only id derived from content and stripped
 * before persisting; `eventUid` is the durable cross-device identity. Also
 * the constructors for new events and custom collection metadata.
 */

import type {
  Event,
  EventCollectionMeta,
  ImportedEvent,
  StoredEvent,
} from "../constants/types";
import { normalizeLocalizedText } from "./localization";
import { normalizeEventTimeParts } from "./time";

export const slugifyCollectionId = (value: string): string => {
  const normalized = value
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  const slug = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  return slug || "collection";
};

export const createLocalDateStamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const hashString = (value: string): string => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
};

const normalizeEventUidCandidate = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const createPersistentEventUid = (
  signature: string,
  occurrence: number,
  collectionId?: string,
): string => {
  const namespace = collectionId ? slugifyCollectionId(collectionId) : "event";
  const suffix = hashString(`eventUid:${namespace}:${signature}`);
  return occurrence > 1
    ? `${namespace}-eu-${suffix}-${occurrence}`
    : `${namespace}-eu-${suffix}`;
};

const normalizeStoredEventPayload = (
  event: StoredEvent | Event | ImportedEvent,
): StoredEvent => ({
  ...(normalizeEventUidCandidate(event.eventUid)
    ? { eventUid: normalizeEventUidCandidate(event.eventUid) ?? undefined }
    : {}),
  title: normalizeLocalizedText(event.title) ?? "",
  description: normalizeLocalizedText(event.description) ?? "",
  time: normalizeEventTimeParts(event.time),
  ...(event.endTime != null
    ? { endTime: normalizeEventTimeParts(event.endTime) }
    : {}),
  // Deliberately NOT part of getStoredEventSignature below: changing the
  // signature formula would re-derive every legacy eventUid and duplicate
  // events across Drive sync.
  ...(event.ongoing ? { ongoing: true } : {}),
  emoji: event.emoji,
  priority: event.priority,
  duration: event.duration,
  color: event.color ?? null,
  image: event.image,
  video: event.video,
  link: event.link,
});

const getStoredEventSignature = (
  event: StoredEvent | Event | ImportedEvent,
): string => {
  const normalized = normalizeStoredEventPayload(event);

  return JSON.stringify([
    normalizeLocalizedText(normalized.title) ?? "",
    normalizeLocalizedText(normalized.description) ?? "",
    normalized.emoji.trim(),
    normalizeEventTimeParts(normalized.time),
    normalized.endTime ? normalizeEventTimeParts(normalized.endTime) : null,
    normalized.priority,
    normalized.duration ?? null,
    normalized.color ?? null,
    normalized.image ?? null,
    normalized.video ?? null,
    normalized.link ?? null,
  ]);
};

const createDeterministicEventId = (
  signature: string,
  occurrence: number,
  collectionId?: string,
): string => {
  const namespace = collectionId ? slugifyCollectionId(collectionId) : "event";
  const suffix = hashString(`${namespace}:${signature}`);
  return occurrence > 1
    ? `${namespace}-${suffix}-${occurrence}`
    : `${namespace}-${suffix}`;
};

export const assignRuntimeEventIds = (
  events: Array<StoredEvent | Event>,
  options?: {
    collectionId?: string;
    previousEvents?: Event[];
  },
): Event[] => {
  const previousIdsBySignature = new Map<string, string[]>();
  const previousEventUidsBySignature = new Map<string, string[]>();

  options?.previousEvents?.forEach((event) => {
    const signature = getStoredEventSignature(event);
    const queue = previousIdsBySignature.get(signature) ?? [];
    queue.push(event.id);
    previousIdsBySignature.set(signature, queue);

    const eventUid = normalizeEventUidCandidate(event.eventUid);
    if (eventUid) {
      const uidQueue = previousEventUidsBySignature.get(signature) ?? [];
      uidQueue.push(eventUid);
      previousEventUidsBySignature.set(signature, uidQueue);
    }
  });

  const occurrenceCounts = new Map<string, number>();
  const seenEventUids = new Set<string>();

  return events.map((event) => {
    const normalized = normalizeStoredEventPayload(event);
    const signature = getStoredEventSignature(normalized);
    const nextOccurrence = (occurrenceCounts.get(signature) ?? 0) + 1;
    occurrenceCounts.set(signature, nextOccurrence);

    const preservedId = previousIdsBySignature.get(signature)?.shift();
    const explicitEventUid = normalizeEventUidCandidate(event.eventUid);
    const preservedEventUid =
      explicitEventUid ??
      previousEventUidsBySignature.get(signature)?.shift() ??
      createPersistentEventUid(
        signature,
        nextOccurrence,
        options?.collectionId,
      );

    let nextEventUid = preservedEventUid;
    if (seenEventUids.has(nextEventUid)) {
      nextEventUid = createPersistentEventUid(
        `${signature}:${nextOccurrence}:${seenEventUids.size}`,
        1,
        options?.collectionId,
      );
    }
    seenEventUids.add(nextEventUid);

    return {
      id:
        preservedId ??
        createDeterministicEventId(
          signature,
          nextOccurrence,
          options?.collectionId,
        ),
      ...normalized,
      eventUid: nextEventUid,
    };
  });
};

export const stripRuntimeEventId = (event: Event): StoredEvent => ({
  ...(normalizeEventUidCandidate(event.eventUid)
    ? { eventUid: normalizeEventUidCandidate(event.eventUid) ?? undefined }
    : {}),
  title: event.title,
  description: event.description,
  time: [...normalizeEventTimeParts(event.time)] as Event["time"],
  ...(event.endTime != null
    ? {
        endTime: [
          ...normalizeEventTimeParts(event.endTime),
        ] as Event["time"],
      }
    : {}),
  ...(event.ongoing ? { ongoing: true } : {}),
  emoji: event.emoji,
  priority: event.priority,
  duration: event.duration,
  color: event.color ?? null,
  image: event.image,
  video: event.video,
  link: event.link,
});

export const stripRuntimeEventIds = (events: Event[]): StoredEvent[] =>
  events.map(stripRuntimeEventId);

export const createNewTimelineEvent = (): Event => ({
  id:
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  eventUid:
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  title: {
    vi: "",
    en: "",
  },
  description: {
    vi: "",
    en: "",
  },
  emoji: "📅",
  time: [new Date().getFullYear(), null, null, null, null, null],
  priority: 50,
});

export const buildCustomCollectionMeta = (
  collection: Pick<EventCollectionMeta, "emoji" | "name" | "description">,
  existingCollections: EventCollectionMeta[],
): EventCollectionMeta => {
  const existingIds = new Set(existingCollections.map((item) => item.id));
  const baseId = slugifyCollectionId(collection.name);
  let nextId = baseId;
  let suffix = 2;

  while (existingIds.has(nextId)) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return {
    id: nextId,
    emoji: collection.emoji,
    name: collection.name,
    description: collection.description,
    author: "You",
    createdAt: createLocalDateStamp(),
  };
};
