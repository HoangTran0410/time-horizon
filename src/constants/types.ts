import type { MotionValue } from "motion";

export const SUPPORTED_LANGUAGES = ["vi", "en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type LocalizedTextRecord = Record<string, string>;
export type LocalizedText = string | LocalizedTextRecord;

export type EventTime = [
  year: number,
  month?: number | null,
  day?: number | null,
  hour?: number | null,
  minute?: number | null,
  seconds?: number | null,
];

export interface Event {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  link?: string;
  image?: string;
  video?: string;
  /**
   * [year, month, day, hour, minute, second]
   * Only year is required. Missing trailing fields are treated as null.
   * Examples: [1969], [2026, 3, 24, 16, 40, 45]
   */
  time: EventTime;
  /**
   * Optional duration in years. Used to auto-zoom when focusing this event.
   * Example: 1 => show ~20 years around event; 0.01 => show month/day neighborhood.
   */
  duration?: number;
  emoji: string;
  /** Optional accent color as a hex string, e.g. "#ef4444". */
  color?: string | null;
  priority: number; // Higher number = higher priority (shown when zoomed out)
}

export type StoredEvent = Omit<Event, "id">;
export type ImportedEvent = StoredEvent & { id?: string };

export interface TimelineState {
  zoom: number; // Pixels per year
  offset: number; // Scroll position in pixels
}

export interface EventCollectionMeta {
  id: string;
  name: string;
  emoji: string;
  description: string;
  author: string;
  createdAt: string;
  categories?: string[];
  /** Optional default accent color for the collection. */
  color?: string | null;
  /**
   * For catalog (syncable/public) collections: URL to fetch the events JSON.
   * Not present for locally-created collections.
   */
  dataUrl?: string;
}

export interface StoredTimelineCollection {
  events: Event[];
  meta?: EventCollectionMeta | null;
  isLocal?: boolean;
}

export type CollectionCache = {
  version: number;
  collectionLibrary?: Record<string, StoredTimelineCollection>;
  collections?: Record<string, Event[]>;
  visibleCollectionIds?: string[];
  customCollections?: EventCollectionMeta[];
};

export type StoppableAnimation = {
  stop: () => void;
};

export type FpsSampleState = {
  sampleStart: number;
  frames: number;
};

export type ActivePointer = {
  clientX: number;
  clientY: number;
};

export type PinchGestureState = {
  anchorYear: number;
  startDistance: number;
  startLogZoom: number;
};

export type CollectionCreationInput = Pick<
  EventCollectionMeta,
  "emoji" | "name" | "description"
>;

export interface DateJumpTarget {
  year: number;
  month: number | null;
  day: number | null;
}

export interface AutoFitRangeTarget {
  startYear: number;
  endYear: number;
}

export const MEDIA_FILTERS = ["image", "video", "link"] as const;

export type MediaFilter = (typeof MEDIA_FILTERS)[number];

export type TimelineTick = {
  year: number;
  interval: number;
  isHighlighted: boolean;
};

export type EventLayoutState = {
  y: MotionValue<number>;
  opacity: MotionValue<number>;
  targetY: number;
  targetOpacity: number;
};

export type CollapsedEventGroup = {
  id: string;
  year: number;
  side: 1 | -1;
  count: number;
  eventIds: string[];
};

export type ExpandedCollapsedGroup = {
  id: string;
  year: number;
  side: 1 | -1;
  eventIds: string[];
};

export type WarpOverlayMode = "travel" | "zoom-in" | "zoom-out";
