export interface Event {
  id: string;
  title: string;
  description: string;
  /**
   * [year, month, day, hour, minute, second]
   * Only year is required. Others can be null.
   * Examples: [1969, null, null, null, null, null], [2026, 3, 24, 16, 40, 45]
   */
  time: [
    year: number,
    month: number | null,
    day: number | null,
    hour: number | null,
    minute: number | null,
    seconds: number | null,
  ];
  /**
   * Optional duration in years. Used to auto-zoom when focusing this event.
   * Example: 1 => show ~20 years around event; 0.01 => show month/day neighborhood.
   */
  duration?: number;
  emoji: string;
  /** Optional accent color as a hex string, e.g. "#ef4444". */
  color?: string | null;
  groups: string[];
  priority: number; // Higher number = higher priority (shown when zoomed out)
}

// Cache: event time is immutable, so the timeline year is deterministic.
// WeakMap avoids memory leaks — entries disappear when Event is GC'd.
const _timelineYearCache = new WeakMap<Event, number>();

export const getEventTimelineYear = (event: Event): number => {
  const cached = _timelineYearCache.get(event);
  if (cached !== undefined) return cached;

  const [year, month, day, hour, minute, seconds] = event.time;

  if (
    month === null &&
    day === null &&
    hour === null &&
    minute === null &&
    seconds === null
  ) {
    _timelineYearCache.set(event, year);
    return year;
  }

  const d = new Date(
    year,
    (month ?? 1) - 1,
    day ?? 1,
    hour ?? 0,
    minute ?? 0,
    seconds ?? 0,
  );

  if (isNaN(d.getTime())) {
    _timelineYearCache.set(event, year);
    return year;
  }

  const y = d.getFullYear();
  const start = new Date(y, 0, 1).getTime();
  const end = new Date(y + 1, 0, 1).getTime();
  const frac = (d.getTime() - start) / (end - start);
  const result = y + frac;

  _timelineYearCache.set(event, result);
  return result;
};

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
}
