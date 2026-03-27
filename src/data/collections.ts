import type { Event, EventCollectionMeta } from "../constants/types";
import {
  HISTOGRAPHY_COLLECTIONS,
  HISTOGRAPHY_COLLECTION_URLS,
} from "./histographyCollections";

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
    id: "dinosaur-age",
    name: "Dinosaur Age",
    emoji: "🦕",
    description: "Major milestones from the Mesozoic world of dinosaurs.",
    author: "Time Horizon",
    createdAt: "2026-03-26",
  },
  {
    id: "ice-age",
    name: "Ice Age",
    emoji: "🧊",
    description:
      "Glacial-era milestones from the Pleistocene into the Holocene.",
    author: "Time Horizon",
    createdAt: "2026-03-26",
  },
  {
    id: "stone-age",
    name: "Stone Age",
    emoji: "🪨",
    description: "Early tools, human evolution, cave art, and farming.",
    author: "Time Horizon",
    createdAt: "2026-03-26",
  },
  {
    id: "bronze-age",
    name: "Bronze Age",
    emoji: "🥉",
    description: "Cities, writing, kingdoms, and the rise of metallurgy.",
    author: "Time Horizon",
    createdAt: "2026-03-26",
  },
  {
    id: "iron-age",
    name: "Iron Age",
    emoji: "⚒️",
    description: "Empires, classical states, and iron-powered societies.",
    author: "Time Horizon",
    createdAt: "2026-03-26",
  },
  {
    id: "medieval-age",
    name: "Medieval Age",
    emoji: "🏰",
    description: "Post-Roman kingdoms, world religions, plague, and print.",
    author: "Time Horizon",
    createdAt: "2026-03-26",
  },
  {
    id: "industrial-age",
    name: "Industrial Age",
    emoji: "🏭",
    description: "Machines, electricity, aviation, war, and the space race.",
    author: "Time Horizon",
    createdAt: "2026-03-26",
  },
  {
    id: "information-age",
    name: "Information Age",
    emoji: "💻",
    description: "Networks, the web, smartphones, genomics, and AI.",
    author: "Time Horizon",
    createdAt: "2026-03-26",
  },
  {
    id: "ho-chi-minh",
    name: "Ho Chi Minh",
    emoji: "🇻🇳",
    description:
      "Key milestones in the life and political career of Ho Chi Minh.",
    author: "Time Horizon",
    createdAt: "2026-03-26",
  },
  {
    id: "lenin",
    name: "Vladimir Lenin",
    emoji: "📕",
    description:
      "Major turning points in Lenin's life and the Russian Revolution.",
    author: "Time Horizon",
    createdAt: "2026-03-26",
  },
  {
    id: "hitler",
    name: "Adolf Hitler",
    emoji: "⚠️",
    description:
      "Key events in Hitler's rise, dictatorship, war, and downfall.",
    author: "Time Horizon",
    createdAt: "2026-03-26",
  },
  {
    id: "einstein",
    name: "Albert Einstein",
    emoji: "🧠",
    description: "Milestones from Einstein's life and scientific career.",
    author: "Time Horizon",
    createdAt: "2026-03-26",
  },
  {
    id: "buddhism",
    name: "Buddhism",
    emoji: "☸️",
    description: "Key milestones in the development and spread of Buddhism.",
    author: "Time Horizon",
    createdAt: "2026-03-26",
  },
  {
    id: "buddha-life",
    name: "Life of the Buddha",
    emoji: "🪷",
    description:
      "Traditional and historical milestones in the life of Siddhartha Gautama, the Buddha.",
    author: "Time Horizon",
    createdAt: "2026-03-26",
  },
  {
    id: "hinduism",
    name: "Hinduism",
    emoji: "🕉️",
    description:
      "Major milestones in the long development of Hindu traditions.",
    author: "Time Horizon",
    createdAt: "2026-03-26",
  },
  {
    id: "christianity",
    name: "Christianity",
    emoji: "✝️",
    description: "Foundational events and turning points in Christian history.",
    author: "Time Horizon",
    createdAt: "2026-03-26",
  },
  {
    id: "islam",
    name: "Islam",
    emoji: "☪️",
    description: "Major milestones from the rise and global spread of Islam.",
    author: "Time Horizon",
    createdAt: "2026-03-26",
  },
  ...HISTOGRAPHY_COLLECTIONS,
];

const COLLECTION_URLS: Record<string, URL> = {
  cosmic: new URL("./collections/cosmic.json", import.meta.url),
  earth: new URL("./collections/earth.json", import.meta.url),
  "dinosaur-age": new URL("./collections/dinosaur-age.json", import.meta.url),
  "ice-age": new URL("./collections/ice-age.json", import.meta.url),
  "stone-age": new URL("./collections/stone-age.json", import.meta.url),
  "bronze-age": new URL("./collections/bronze-age.json", import.meta.url),
  "iron-age": new URL("./collections/iron-age.json", import.meta.url),
  "medieval-age": new URL("./collections/medieval-age.json", import.meta.url),
  "industrial-age": new URL(
    "./collections/industrial-age.json",
    import.meta.url,
  ),
  "information-age": new URL(
    "./collections/information-age.json",
    import.meta.url,
  ),
  "ho-chi-minh": new URL("./collections/ho-chi-minh.json", import.meta.url),
  lenin: new URL("./collections/lenin.json", import.meta.url),
  hitler: new URL("./collections/hitler.json", import.meta.url),
  einstein: new URL("./collections/einstein.json", import.meta.url),
  buddhism: new URL("./collections/buddhism.json", import.meta.url),
  "buddha-life": new URL("./collections/buddha-life.json", import.meta.url),
  hinduism: new URL("./collections/hinduism.json", import.meta.url),
  christianity: new URL("./collections/christianity.json", import.meta.url),
  islam: new URL("./collections/islam.json", import.meta.url),
  ...HISTOGRAPHY_COLLECTION_URLS,
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
