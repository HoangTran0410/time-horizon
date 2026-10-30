/**
 * Keyboard navigation for the canvas timeline. The canvas has no DOM nodes to
 * tab through, so without this a keyboard-only visitor could not pan or zoom
 * at all. Kept pure (no DOM, no React) so the mapping and camera math are
 * unit-testable; `Timeline` wires it to the viewport's public API.
 */

export type TimelineKeyAction =
  | "panBackward"
  | "panForward"
  | "zoomIn"
  | "zoomOut"
  | "fitAll"
  | "search"
  | "help"
  | "previousEvent"
  | "nextEvent";

export interface TimelineKeyInput {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

/** Fraction of the visible span one arrow press pans (Shift pans further). */
export const KEYBOARD_PAN_FRACTION = 0.2;
export const KEYBOARD_PAN_FRACTION_LARGE = 0.6;
/** Zoom multiplier per key press. */
export const KEYBOARD_ZOOM_FACTOR = 1.8;

/**
 * The shortcuts as shown in the help dialog. `keys` are display labels; the
 * matcher below is the source of truth for what actually fires.
 */
export const TIMELINE_SHORTCUTS: ReadonlyArray<{
  keys: string[];
  labelKey: string;
}> = [
  { keys: ["←", "→"], labelKey: "shortcutPanHorizontal" },
  { keys: ["↑", "↓"], labelKey: "shortcutPanVertical" },
  { keys: ["Shift", "←→↑↓"], labelKey: "shortcutPanFar" },
  { keys: ["+", "−"], labelKey: "shortcutZoom" },
  { keys: ["0"], labelKey: "shortcutFitAll" },
  { keys: ["[", "]"], labelKey: "shortcutPrevNextEvent" },
  { keys: ["/"], labelKey: "shortcutSearch" },
  { keys: ["Esc"], labelKey: "shortcutClose" },
  { keys: ["?"], labelKey: "shortcutHelp" },
];

/**
 * Map a key press to a timeline action. Arrow keys only pan along the axis the
 * timeline runs on, so in vertical mode ←/→ stay free (and vice versa).
 */
export const getTimelineKeyAction = (
  input: TimelineKeyInput,
  orientation: "horizontal" | "vertical",
): TimelineKeyAction | null => {
  if (input.ctrlKey || input.metaKey || input.altKey) return null;

  switch (input.key) {
    case "ArrowLeft":
      return orientation === "horizontal" ? "panBackward" : null;
    case "ArrowRight":
      return orientation === "horizontal" ? "panForward" : null;
    case "ArrowUp":
      return orientation === "vertical" ? "panBackward" : null;
    case "ArrowDown":
      return orientation === "vertical" ? "panForward" : null;
    case "+":
    case "=":
      return "zoomIn";
    case "-":
    case "_":
      return "zoomOut";
    case "0":
      return "fitAll";
    case "/":
      return "search";
    case "?":
      return "help";
    case "[":
      return "previousEvent";
    case "]":
      return "nextEvent";
    default:
      return null;
  }
};

/**
 * True when the key press belongs to a text field or other widget that needs
 * the keys itself, so global shortcuts must stay out of the way.
 */
export const isEditableKeyTarget = (
  target: {
    tagName?: string;
    isContentEditable?: boolean;
    closest?: (selector: string) => unknown;
  } | null,
): boolean => {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = (target.tagName ?? "").toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return Boolean(
    target.closest?.("[role='dialog'],[role='alertdialog'],.monaco-editor"),
  );
};

export interface KeyboardCameraInput {
  /** Year at the centre of the viewport. */
  centerYear: number;
  /** Pixels per year. */
  zoom: number;
  /** Viewport length along the time axis, in pixels. */
  primarySize: number;
  /** +1 when years grow along the screen axis, -1 when they shrink. */
  axisDirection: 1 | -1;
  /** Fraction of the viewport a range fit fills (1 - 2 × padding). */
  fitFraction: number;
}

/**
 * Year range to hand `handleAutoFitRange` so the camera lands panned or
 * zoomed by one keyboard step. The range is sized so that, after the fit's own
 * padding, the resulting zoom is exactly the target.
 */
export const getKeyboardCameraRange = (
  action: "panBackward" | "panForward" | "zoomIn" | "zoomOut",
  camera: KeyboardCameraInput,
  options: { large?: boolean } = {},
): { startYear: number; endYear: number } | null => {
  const { centerYear, zoom, primarySize, axisDirection, fitFraction } = camera;
  if (
    !Number.isFinite(centerYear) ||
    !Number.isFinite(zoom) ||
    zoom <= 0 ||
    primarySize <= 0 ||
    fitFraction <= 0
  ) {
    return null;
  }

  let nextCenter = centerYear;
  let nextZoom = zoom;
  const visibleSpanYears = primarySize / zoom;

  if (action === "panBackward" || action === "panForward") {
    const fraction = options.large
      ? KEYBOARD_PAN_FRACTION_LARGE
      : KEYBOARD_PAN_FRACTION;
    // "Forward" is toward the screen's right/bottom edge, which is later in
    // time unless the vertical axis is flipped.
    const screenSign = action === "panForward" ? 1 : -1;
    nextCenter =
      centerYear + screenSign * axisDirection * visibleSpanYears * fraction;
  } else {
    nextZoom =
      action === "zoomIn"
        ? zoom * KEYBOARD_ZOOM_FACTOR
        : zoom / KEYBOARD_ZOOM_FACTOR;
  }

  const rangeYears = (primarySize * fitFraction) / nextZoom;
  return {
    startYear: nextCenter - rangeYears / 2,
    endYear: nextCenter + rangeYears / 2,
  };
};
