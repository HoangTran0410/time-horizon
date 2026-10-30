import { useCallback, useInsertionEffect, useRef } from "react";

/**
 * Returns a function whose identity never changes but always calls the latest
 * `callback`. Use it for handlers passed to memoized children (e.g. `Sidebar`)
 * so a parent re-render — `Timeline` re-renders on every tick/label update
 * while zooming — doesn't force the child to re-render too.
 *
 * Only call the result from event handlers or effects, never during render.
 */
export const useStableCallback = <Args extends unknown[], Result>(
  callback: (...args: Args) => Result,
): ((...args: Args) => Result) => {
  const callbackRef = useRef(callback);

  useInsertionEffect(() => {
    callbackRef.current = callback;
  });

  return useCallback((...args: Args) => callbackRef.current(...args), []);
};
