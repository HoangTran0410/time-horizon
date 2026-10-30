/** Pure viewport math: row layout levels, zoom fixed point, drag inertia. */

import {
  LAYOUT_EDGE_PADDING,
  LAYOUT_MAX_LEVELS_PER_SIDE,
  LAYOUT_ROW_OFFSET,
} from "../constants";
import type {
  CollapsedEventGroup,
  TimelineOrientation,
} from "../constants/types";
import { getEventCardFootprint } from "./eventPacking";

export const getTimelineLayoutLevelCount = (viewportHeight: number): number => {
  const halfHeight = Math.max(0, viewportHeight / 2);
  const usableHalfHeight = Math.max(0, halfHeight - LAYOUT_EDGE_PADDING);
  const levelCount = Math.floor(usableHalfHeight / LAYOUT_ROW_OFFSET);

  return Math.max(1, Math.min(LAYOUT_MAX_LEVELS_PER_SIDE, levelCount));
};

export const getTimelineLayoutLevels = (viewportHeight: number): number[] =>
  Array.from(
    { length: getTimelineLayoutLevelCount(viewportHeight) },
    (_, index) => index + 1,
  );

const COLLAPSED_GROUP_RADIUS = 22;

/**
 * Cross offset of the "+N" collapsed-group badges: one row past the last
 * layout row, and — given the orientation — far enough out that the badge
 * clears the outermost row's card. Vertical timelines draw labels beside the
 * marker, which reaches well past one row, and a badge on the next row sat on
 * top of them. Clamped so the badge stays on screen.
 */
export const getCollapsedGroupOffset = (
  viewportHeight: number,
  orientation?: TimelineOrientation,
): number => {
  const levelCount = getTimelineLayoutLevelCount(viewportHeight);
  const nextRow = (levelCount + 1) * LAYOUT_ROW_OFFSET;
  if (!orientation) return nextRow;

  const cardReach = getEventCardFootprint(orientation, viewportHeight, 1).crossEnd;
  const clearOfCards =
    levelCount * LAYOUT_ROW_OFFSET + cardReach + COLLAPSED_GROUP_RADIUS + 4;
  const onScreen = viewportHeight / 2 - COLLAPSED_GROUP_RADIUS - 4;
  return Math.max(nextRow, Math.min(clearOfCards, onScreen));
};

/**
 * One frame of the camera, reduced to the map it applies to years.
 *
 * `panPixel` is where year 0 lands — `focusPixel - focusYear * zoom *
 * axisDirection`, the quantity the viewport hook derives as `panX`. Sampling
 * that rather than the (focusPixel, focusYear) pair it is built from matters:
 * the wheel handler rewrites both on every event to re-anchor on the pointer,
 * which does not move the picture at all, and `panPixel` is what stays put.
 */
export type TimelineCameraSample = {
  panPixel: number;
  zoom: number;
};

/**
 * The pixel that does not move between two camera frames — the point the
 * timeline appears to expand from.
 *
 * Zooming and panning at once still reads as a pure zoom about *some* pixel,
 * and that pixel is generally not the middle of the viewport: the landing
 * tour's camera expands about a point up to ~90px off centre. Anything drawn
 * to measure the zoom — the warp overlay's reference rings — has to be centred
 * there, or its edges slide across the timeline at exactly the pan rate.
 *
 * Returns null when the two frames share a zoom, since a pure pan has no fixed
 * point. Callers should hold their last pivot in that case.
 */
export const resolveZoomFixedPointPixel = (
  previous: TimelineCameraSample,
  next: TimelineCameraSample,
  axisDirection: 1 | -1,
): number | null => {
  const zoomDelta = previous.zoom - next.zoom;
  if (!Number.isFinite(zoomDelta) || zoomDelta === 0) return null;

  const fixedYear =
    (next.panPixel - previous.panPixel) / (zoomDelta * axisDirection);
  const pixel = next.panPixel + fixedYear * next.zoom * axisDirection;

  return Number.isFinite(pixel) ? pixel : null;
};

/** Below this, the last move sample is noise from the finger leaving the glass. */
export const DRAG_INERTIA_MIN_VELOCITY = 0.1;
/** A finger that has already come to rest is not a flick, whatever it last read. */
export const DRAG_INERTIA_MAX_IDLE_MS = 90;
/** How long a post-pinch drag must run before it can fling. */
export const PINCH_TAIL_INERTIA_MIN_MS = 140;
/** How far a post-pinch drag must travel before it can fling. */
export const PINCH_TAIL_INERTIA_MIN_PX = 24;

export type DragInertiaRelease = {
  /** px/ms, signed, from the last flushed drag sample. */
  velocity: number;
  /** Age of that sample at release time. */
  msSinceLastMove: number;
  /** True when this drag is the tail of a pinch — the finger left over after
   * the other one lifted, rather than a drag the user started deliberately. */
  isPinchTail: boolean;
  dragDurationMs: number;
  dragDistancePx: number;
};

/**
 * Whether releasing a drag should launch the inertia fling.
 *
 * Lifting two fingers off a pinch is never simultaneous: the survivor keeps
 * emitting pointermoves for a few milliseconds while it rolls off the glass,
 * and over a 2ms sample even a 3px slide reads as a hard flick. That is what
 * threw the camera across the timeline every time a pinch ended, so a drag
 * inherited from a pinch has to prove it is a real pan first.
 */
export const shouldStartDragInertia = ({
  velocity,
  msSinceLastMove,
  isPinchTail,
  dragDurationMs,
  dragDistancePx,
}: DragInertiaRelease): boolean => {
  if (!Number.isFinite(velocity)) return false;
  if (Math.abs(velocity) < DRAG_INERTIA_MIN_VELOCITY) return false;
  if (msSinceLastMove > DRAG_INERTIA_MAX_IDLE_MS) return false;

  if (
    isPinchTail &&
    (dragDurationMs < PINCH_TAIL_INERTIA_MIN_MS ||
      dragDistancePx < PINCH_TAIL_INERTIA_MIN_PX)
  ) {
    return false;
  }

  return true;
};

export const areCollapsedGroupsEqual = (
  prevGroups: CollapsedEventGroup[],
  nextGroups: CollapsedEventGroup[],
) =>
  prevGroups.length === nextGroups.length &&
  prevGroups.every((group, index) => {
    const nextGroup = nextGroups[index];
    const nextEventIds = new Set(nextGroup.eventIds);
    return (
      group.id === nextGroup.id &&
      group.year === nextGroup.year &&
      group.side === nextGroup.side &&
      group.cross === nextGroup.cross &&
      group.laneId === nextGroup.laneId &&
      group.count === nextGroup.count &&
      group.eventIds.length === nextEventIds.size &&
      group.eventIds.every((eventId) => nextEventIds.has(eventId))
    );
  });
