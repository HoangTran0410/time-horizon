/**
 * Collision-free placement of event cards along the axis.
 *
 * The old pass kept a fixed 90px gap between events in the same row and never
 * compared neighbouring rows. A card is a 48px marker plus up to three wrapped
 * title lines and a date — about 120px wide and 116px tall — so labels ran
 * into each other along the axis and into the next row across it. Here every
 * placed card reserves the rectangle the canvas actually draws, and a
 * candidate row is rejected if its rectangle hits any of them, whatever row
 * they sit in.
 *
 * Coordinates are screen pixels: `primary` along the time axis (already
 * multiplied by the axis direction, so "after" means further down/right on
 * screen), `cross` the signed offset from the axis that `layout.y` holds.
 */

import type { TimelineOrientation } from "../constants/types";

/**
 * Card geometry, mirrored from the draw code in TimelineCanvasViewport. Keep
 * these in step with EVENT_RADIUS, EVENT_LABEL_MAX_WIDTH, the 34px label
 * offset and EVENT_TITLE_LINE_HEIGHT × EVENT_TITLE_MAX_LINES there.
 */
const MARKER_RADIUS = 24;
const LABEL_HALF_WIDTH = 60;
const LABEL_OFFSET = 34;
/** Three title lines, the gap and the date line below them. */
const STACKED_LABEL_DEPTH = 58;
const SIDE_LABEL_HALF_DEPTH_BEFORE = 28;
const SIDE_LABEL_HALF_DEPTH_AFTER = 40;
const SPAN_BAR_HALF_THICKNESS = 5;
/** Breathing room kept between two cards. */
const CARD_GAP = 8;
/** Width of the spatial-hash buckets along the primary axis. */
const BUCKET_PX = 128;
/** Narrow vertical timelines stack labels under the marker (see the canvas). */
export const VERTICAL_SIDE_LABEL_MIN_WIDTH = 640;

export type PackingRect = {
  primaryStart: number;
  primaryEnd: number;
  crossStart: number;
  crossEnd: number;
};

/**
 * The card's extent relative to its marker centre. `side` is +1 when the card
 * sits on the positive cross side (below the axis in horizontal mode, right of
 * it in vertical mode), which is what decides where the canvas puts the label.
 */
export const getEventCardFootprint = (
  orientation: TimelineOrientation,
  crossSize: number,
  side: 1 | -1,
): PackingRect => {
  const stackedDepth = LABEL_OFFSET + STACKED_LABEL_DEPTH;

  if (orientation === "horizontal") {
    return {
      primaryStart: -LABEL_HALF_WIDTH,
      primaryEnd: LABEL_HALF_WIDTH,
      crossStart: side > 0 ? -MARKER_RADIUS : -stackedDepth,
      crossEnd: side > 0 ? stackedDepth : MARKER_RADIUS,
    };
  }

  if (crossSize < VERTICAL_SIDE_LABEL_MIN_WIDTH) {
    // Labels always stack below the marker, i.e. after it on screen.
    return {
      primaryStart: -MARKER_RADIUS,
      primaryEnd: stackedDepth,
      crossStart: -LABEL_HALF_WIDTH,
      crossEnd: LABEL_HALF_WIDTH,
    };
  }

  const sideReach = LABEL_OFFSET + LABEL_HALF_WIDTH * 2;
  return {
    primaryStart: -SIDE_LABEL_HALF_DEPTH_BEFORE,
    primaryEnd: SIDE_LABEL_HALF_DEPTH_AFTER,
    crossStart: side > 0 ? -MARKER_RADIUS : -sideReach,
    crossEnd: side > 0 ? sideReach : MARKER_RADIUS,
  };
};

const rectsOverlap = (a: PackingRect, b: PackingRect) =>
  a.primaryStart < b.primaryEnd + CARD_GAP &&
  b.primaryStart < a.primaryEnd + CARD_GAP &&
  a.crossStart < b.crossEnd + CARD_GAP &&
  b.crossStart < a.crossEnd + CARD_GAP;

/**
 * A spatial hash over the primary axis. Each rect is filed under every bucket
 * it touches, so a query only looks at its own neighbourhood; callers clamp
 * long span bars to the layout window, which keeps that bounded.
 */
export const createCardPacker = () => {
  const buckets = new Map<number, PackingRect[]>();

  const bucketRange = (rect: PackingRect) => [
    Math.floor((rect.primaryStart - CARD_GAP) / BUCKET_PX),
    Math.floor((rect.primaryEnd + CARD_GAP) / BUCKET_PX),
  ];

  const fits = (rects: PackingRect[]) => {
    for (const rect of rects) {
      const [first, last] = bucketRange(rect);
      for (let bucket = first; bucket <= last; bucket += 1) {
        const placed = buckets.get(bucket);
        if (!placed) continue;
        for (const other of placed) {
          if (rectsOverlap(rect, other)) return false;
        }
      }
    }
    return true;
  };

  const occupy = (rects: PackingRect[]) => {
    for (const rect of rects) {
      const [first, last] = bucketRange(rect);
      for (let bucket = first; bucket <= last; bucket += 1) {
        const placed = buckets.get(bucket);
        if (placed) placed.push(rect);
        else buckets.set(bucket, [rect]);
      }
    }
  };

  return { fits, occupy };
};

/**
 * Rects an event occupies when its marker sits at `markerPrimary` on row
 * `cross`: the card, plus — for a span drawn as a bar — the bar itself,
 * clamped to `[windowStart, windowEnd]`.
 */
export const getEventPackingRects = ({
  footprint,
  markerPrimary,
  cross,
  bar,
  windowStart,
  windowEnd,
}: {
  footprint: PackingRect;
  markerPrimary: number;
  cross: number;
  bar: { start: number; end: number } | null;
  windowStart: number;
  windowEnd: number;
}): PackingRect[] => {
  const card: PackingRect = {
    primaryStart: markerPrimary + footprint.primaryStart,
    primaryEnd: markerPrimary + footprint.primaryEnd,
    crossStart: cross + footprint.crossStart,
    crossEnd: cross + footprint.crossEnd,
  };
  if (!bar) return [card];

  const start = Math.max(Math.min(bar.start, bar.end), windowStart);
  const end = Math.min(Math.max(bar.start, bar.end), windowEnd);
  if (end <= start) return [card];

  return [
    card,
    {
      primaryStart: start,
      primaryEnd: end,
      crossStart: cross - SPAN_BAR_HALF_THICKNESS,
      crossEnd: cross + SPAN_BAR_HALF_THICKNESS,
    },
  ];
};

/**
 * Where the canvas will draw a span's marker: the middle of the on-screen part
 * of its bar (TimelineCanvasViewport clamps to the viewport ± `clampMargin`).
 */
export const getSpanMarkerPrimary = (
  start: number,
  end: number,
  viewportSize: number,
  clampMargin: number,
) => {
  const lo = Math.max(Math.min(start, end), -clampMargin);
  const hi = Math.min(Math.max(start, end), viewportSize + clampMargin);
  return hi > lo ? (lo + hi) / 2 : Math.min(start, end);
};
