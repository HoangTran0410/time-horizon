import type { Event, EventCollectionMeta } from "../types";

export const PLAYGROUND_COLLECTION: EventCollectionMeta = {
  id: "playground",
  name: "Playground",
  emoji: "🧪",
  description: "Scratchpad collection for custom events you add locally.",
  author: "You",
  createdAt: "2026-03-25",
};

export const EVENT_COLLECTIONS: EventCollectionMeta[] = [
  {
    id: "cosmic",
    name: "Cosmic Origins",
    emoji: "🌌",
    description: "Big Bang, stars, galaxies, and solar-system origins.",
    author: "Time Horizon",
    createdAt: "2026-03-25",
  },
  {
    id: "earth",
    name: "Earth & Life",
    emoji: "🌍",
    description: "Planetary history, geology, evolution, and prehistory.",
    author: "Time Horizon",
    createdAt: "2026-03-25",
  },
  {
    id: "human",
    name: "Human Civilization",
    emoji: "🏛️",
    description: "Culture, empires, technology, and recent history.",
    author: "Time Horizon",
    createdAt: "2026-03-25",
  },
];

const COLLECTION_URLS: Record<string, URL> = {
  cosmic: new URL("./collections/cosmic.json", import.meta.url),
  earth: new URL("./collections/earth.json", import.meta.url),
  human: new URL("./collections/human.json", import.meta.url),
};

export const SYNCABLE_COLLECTION_IDS = Object.keys(COLLECTION_URLS);

export const isSyncableCollection = (collectionId: string): boolean =>
  Object.prototype.hasOwnProperty.call(COLLECTION_URLS, collectionId);

export const loadEventCollection = async (
  collectionId: string,
): Promise<Event[]> => {
  const url = COLLECTION_URLS[collectionId];
  if (!url) throw new Error(`Unknown collection: ${collectionId}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load collection: ${collectionId}`);
  }

  return (await response.json()) as Event[];
};
