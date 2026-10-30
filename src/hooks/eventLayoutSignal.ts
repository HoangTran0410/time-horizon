/**
 * Change notifications for one viewport's event layouts.
 *
 * Event rows and fades are MotionValues animated outside React, so the canvas
 * has no render signal for them. It used to poll every visible layout on every
 * frame, forever, which kept the main thread awake on an idle timeline. The
 * viewport hook now reports each layout value change through this channel and
 * the canvas repaints only then.
 *
 * Keyed by the layouts record itself (stable per viewport instance), so the
 * landing stage and the timeline never wake each other.
 */

type EventLayoutListener = () => void;

const listenersByLayouts = new WeakMap<object, Set<EventLayoutListener>>();

export const subscribeToEventLayoutChanges = (
  layouts: object,
  listener: EventLayoutListener,
): (() => void) => {
  let listeners = listenersByLayouts.get(layouts);
  if (!listeners) {
    listeners = new Set();
    listenersByLayouts.set(layouts, listeners);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const notifyEventLayoutChange = (layouts: object): void => {
  const listeners = listenersByLayouts.get(layouts);
  if (!listeners) return;
  for (const listener of listeners) listener();
};
