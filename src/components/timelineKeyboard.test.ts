import { describe, expect, it } from "vitest";
import {
  getKeyboardCameraRange,
  getTimelineKeyAction,
  isEditableKeyTarget,
  KEYBOARD_PAN_FRACTION,
  KEYBOARD_ZOOM_FACTOR,
} from "./timelineKeyboard";
import { getTrappedFocusIndex } from "./useDialogA11y";

describe("getTimelineKeyAction", () => {
  it("pans along the active axis only", () => {
    expect(getTimelineKeyAction({ key: "ArrowLeft" }, "horizontal")).toBe(
      "panBackward",
    );
    expect(getTimelineKeyAction({ key: "ArrowRight" }, "horizontal")).toBe(
      "panForward",
    );
    expect(getTimelineKeyAction({ key: "ArrowUp" }, "horizontal")).toBeNull();
    expect(getTimelineKeyAction({ key: "ArrowUp" }, "vertical")).toBe(
      "panBackward",
    );
    expect(getTimelineKeyAction({ key: "ArrowDown" }, "vertical")).toBe(
      "panForward",
    );
    expect(getTimelineKeyAction({ key: "ArrowLeft" }, "vertical")).toBeNull();
  });

  it("maps zoom, fit, search, help and event stepping", () => {
    expect(getTimelineKeyAction({ key: "+" }, "horizontal")).toBe("zoomIn");
    expect(getTimelineKeyAction({ key: "=" }, "horizontal")).toBe("zoomIn");
    expect(getTimelineKeyAction({ key: "-" }, "horizontal")).toBe("zoomOut");
    expect(getTimelineKeyAction({ key: "0" }, "horizontal")).toBe("fitAll");
    expect(getTimelineKeyAction({ key: "/" }, "horizontal")).toBe("search");
    expect(getTimelineKeyAction({ key: "?" }, "horizontal")).toBe("help");
    expect(getTimelineKeyAction({ key: "[" }, "horizontal")).toBe(
      "previousEvent",
    );
    expect(getTimelineKeyAction({ key: "]" }, "horizontal")).toBe("nextEvent");
  });

  it("leaves browser shortcuts alone", () => {
    expect(
      getTimelineKeyAction({ key: "+", ctrlKey: true }, "horizontal"),
    ).toBeNull();
    expect(
      getTimelineKeyAction({ key: "0", metaKey: true }, "horizontal"),
    ).toBeNull();
    expect(
      getTimelineKeyAction({ key: "ArrowLeft", altKey: true }, "horizontal"),
    ).toBeNull();
    expect(getTimelineKeyAction({ key: "a" }, "horizontal")).toBeNull();
  });
});

describe("isEditableKeyTarget", () => {
  it("detects fields and dialogs", () => {
    expect(isEditableKeyTarget(null)).toBe(false);
    expect(isEditableKeyTarget({ tagName: "input" })).toBe(true);
    expect(isEditableKeyTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(
      isEditableKeyTarget({ tagName: "DIV", isContentEditable: true }),
    ).toBe(true);
    expect(
      isEditableKeyTarget({ tagName: "BUTTON", closest: () => null }),
    ).toBe(false);
    expect(
      isEditableKeyTarget({ tagName: "BUTTON", closest: () => ({}) }),
    ).toBe(true);
  });
});

describe("getKeyboardCameraRange", () => {
  const camera = {
    centerYear: 1000,
    zoom: 1,
    primarySize: 1000,
    axisDirection: 1 as const,
    fitFraction: 0.76,
  };
  const zoomOf = (range: { startYear: number; endYear: number }) =>
    (camera.primarySize * camera.fitFraction) /
    (range.endYear - range.startYear);
  const centerOf = (range: { startYear: number; endYear: number }) =>
    (range.startYear + range.endYear) / 2;

  it("pans by a fraction of the visible span, keeping zoom", () => {
    const forward = getKeyboardCameraRange("panForward", camera)!;
    expect(centerOf(forward)).toBeCloseTo(1000 + 1000 * KEYBOARD_PAN_FRACTION);
    expect(zoomOf(forward)).toBeCloseTo(1);
    const backward = getKeyboardCameraRange("panBackward", camera)!;
    expect(centerOf(backward)).toBeCloseTo(1000 - 1000 * KEYBOARD_PAN_FRACTION);
  });

  it("flips direction when the axis runs the other way", () => {
    const flipped = getKeyboardCameraRange("panForward", {
      ...camera,
      axisDirection: -1,
    })!;
    expect(centerOf(flipped)).toBeLessThan(1000);
  });

  it("pans further with the large option", () => {
    const small = getKeyboardCameraRange("panForward", camera)!;
    const large = getKeyboardCameraRange("panForward", camera, {
      large: true,
    })!;
    expect(centerOf(large)).toBeGreaterThan(centerOf(small));
  });

  it("zooms around the centre", () => {
    const zoomedIn = getKeyboardCameraRange("zoomIn", camera)!;
    expect(centerOf(zoomedIn)).toBeCloseTo(1000);
    expect(zoomOf(zoomedIn)).toBeCloseTo(KEYBOARD_ZOOM_FACTOR);
    const zoomedOut = getKeyboardCameraRange("zoomOut", camera)!;
    expect(zoomOf(zoomedOut)).toBeCloseTo(1 / KEYBOARD_ZOOM_FACTOR);
  });

  it("rejects a degenerate camera", () => {
    expect(getKeyboardCameraRange("zoomIn", { ...camera, zoom: 0 })).toBeNull();
    expect(
      getKeyboardCameraRange("zoomIn", { ...camera, centerYear: NaN }),
    ).toBeNull();
    expect(
      getKeyboardCameraRange("zoomIn", { ...camera, primarySize: 0 }),
    ).toBeNull();
  });
});

describe("getTrappedFocusIndex", () => {
  it("wraps at both ends and otherwise defers to the browser", () => {
    expect(getTrappedFocusIndex(2, 3, false)).toBe(0);
    expect(getTrappedFocusIndex(0, 3, true)).toBe(2);
    expect(getTrappedFocusIndex(1, 3, false)).toBeNull();
    expect(getTrappedFocusIndex(1, 3, true)).toBeNull();
  });

  it("pulls stray focus back into the trap", () => {
    expect(getTrappedFocusIndex(-1, 3, false)).toBe(0);
    expect(getTrappedFocusIndex(-1, 3, true)).toBe(2);
    expect(getTrappedFocusIndex(-1, 0, false)).toBeNull();
  });
});
