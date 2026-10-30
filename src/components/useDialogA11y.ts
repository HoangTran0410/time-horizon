import { useEffect, useId, useRef } from "react";

/**
 * Shared keyboard / screen-reader behaviour for every modal surface:
 *
 * - focus moves into the dialog when it opens and returns to whatever opened it
 *   when it closes, so keyboard users are not dumped at the top of the page;
 * - Tab / Shift+Tab cycle inside the dialog instead of wandering onto the
 *   canvas and toolbar hidden behind the backdrop;
 * - Escape closes the *topmost* dialog only. Dialogs stack (a confirm opened
 *   from the control center, say), so a module-level stack decides who owns
 *   the key, and the handler stops propagation so the window-level Escape in
 *   `Timeline` does not also close the panel underneath.
 *
 * Returns a ref for the dialog surface plus a `titleId` to wire up
 * `aria-labelledby`.
 */

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

const dialogStack: symbol[] = [];

/**
 * Index that should receive focus after a Tab press inside a trap, or `null`
 * when the browser's default move is fine (focus stays inside the trap).
 * Pure so it can be unit-tested without a DOM.
 */
export const getTrappedFocusIndex = (
  currentIndex: number,
  count: number,
  isShift: boolean,
): number | null => {
  if (count <= 0) return null;
  if (currentIndex < 0) return isShift ? count - 1 : 0;
  if (isShift && currentIndex === 0) return count - 1;
  if (!isShift && currentIndex === count - 1) return 0;
  return null;
};

const getFocusableElements = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(
    (element) =>
      !element.closest("[inert]") &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.getClientRects().length > 0,
  );

interface UseDialogA11yOptions {
  isOpen: boolean;
  /** Called on Escape when `closeOnEscape` is on. */
  onClose?: () => void;
  /** Off for dialogs that already own Escape (editors, search). */
  closeOnEscape?: boolean;
  /** Element to focus on open; defaults to the first focusable control. */
  initialFocusSelector?: string;
}

export const useDialogA11y = <T extends HTMLElement = HTMLDivElement>({
  isOpen,
  onClose,
  closeOnEscape = true,
  initialFocusSelector,
}: UseDialogA11yOptions) => {
  const containerRef = useRef<T | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const token = Symbol("dialog");
    dialogStack.push(token);
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // Wait a frame: motion/AnimatePresence mounts the surface on the same
    // commit, and some dialogs autofocus their own field — respect that.
    const frame = window.requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container || container.contains(document.activeElement)) return;
      const preferred = initialFocusSelector
        ? container.querySelector<HTMLElement>(initialFocusSelector)
        : null;
      const target = preferred ?? getFocusableElements(container)[0];
      if (target) {
        target.focus({ preventScroll: true });
      } else {
        if (!container.hasAttribute("tabindex")) {
          container.setAttribute("tabindex", "-1");
        }
        container.focus({ preventScroll: true });
      }
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== token) return;
      if (event.isComposing) return;
      const container = containerRef.current;
      if (!container) return;

      if (event.key === "Escape" && closeOnEscape && onCloseRef.current) {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || event.defaultPrevented) return;
      // Code editors use Tab for indentation.
      if (
        (document.activeElement as HTMLElement | null)?.closest?.(
          ".monaco-editor",
        )
      ) {
        return;
      }
      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const active = document.activeElement as HTMLElement | null;
      const currentIndex = active ? focusable.indexOf(active) : -1;
      // Focus inside a nested widget we didn't enumerate (e.g. Monaco):
      // leave the browser alone.
      if (currentIndex < 0 && active && container.contains(active)) return;
      const nextIndex = getTrappedFocusIndex(
        currentIndex,
        focusable.length,
        event.shiftKey,
      );
      if (nextIndex !== null) {
        event.preventDefault();
        focusable[nextIndex]?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      const index = dialogStack.lastIndexOf(token);
      if (index >= 0) dialogStack.splice(index, 1);

      // Hand focus back only if it is now lost (on <body>) or still inside
      // the closing dialog — never yank it away from something else.
      const active = document.activeElement;
      const container = containerRef.current;
      const focusIsLost =
        !active ||
        active === document.body ||
        (container !== null && container.contains(active));
      if (
        focusIsLost &&
        previouslyFocused &&
        previouslyFocused.isConnected &&
        typeof previouslyFocused.focus === "function"
      ) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [closeOnEscape, initialFocusSelector, isOpen]);

  return { containerRef, titleId };
};
