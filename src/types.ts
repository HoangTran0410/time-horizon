export interface Event {
  id: string;
  title: string;
  description: string;
  /**
   * Absolute year on the timeline (can be fractional for month/day/hour/minute).
   * Examples: 1969, -13800000000, 2026.23
   */
  absoluteYear: number;
  /**
   * Optional exact local datetime (YYYY-MM-DDTHH:mm).
   * When present, UI/labels use this for month/day/hour/minute precision.
   * absoluteYear should stay in sync as decimal-year for plotting.
   */
  exactDateTime?: string;
  /**
   * Reference year representing "now".
   * Displayed offset = timelineYear - pivotYear.
   */
  pivotYear: number;
  emoji: string;
  groups: string[];
  priority: number; // Higher number = higher priority (shown when zoomed out)
}

/**
 * Returns the offset (years from pivot) for display/logic that previously
 * used the old "year from now" semantics.
 * Equivalent to: absoluteYear - pivotYear
 */
export const getEventTimelineYear = (event: Event): number => {
  if (!event.exactDateTime) return event.absoluteYear;
  const d = new Date(event.exactDateTime);
  if (isNaN(d.getTime())) return event.absoluteYear;
  const y = d.getFullYear();
  const start = new Date(y, 0, 1).getTime();
  const end = new Date(y + 1, 0, 1).getTime();
  const frac = (d.getTime() - start) / (end - start);
  return y + frac;
};

export const getYearOffset = (event: Event): number =>
  getEventTimelineYear(event) - event.pivotYear;

export interface TimelineState {
  zoom: number; // Pixels per year
  offset: number; // Scroll position in pixels
}

/** Default pivot = current calendar year (the "now" reference). */
export const DEFAULT_PIVOT_YEAR = new Date().getFullYear();
