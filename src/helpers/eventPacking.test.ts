import { describe, expect, it } from "vitest";
import {
  createCardPacker,
  getCollapsedGroupOffset,
  getEventCardFootprint,
  getEventPackingRects,
  getSpanMarkerPrimary,
  VERTICAL_SIDE_LABEL_MIN_WIDTH,
} from ".";

const place = (
  packer: ReturnType<typeof createCardPacker>,
  footprint: ReturnType<typeof getEventCardFootprint>,
  markerPrimary: number,
  cross: number,
  bar: { start: number; end: number } | null = null,
) => {
  const rects = getEventPackingRects({
    footprint,
    markerPrimary,
    cross,
    bar,
    windowStart: -1000,
    windowEnd: 3000,
  });
  if (!packer.fits(rects)) return false;
  packer.occupy(rects);
  return true;
};

describe("getEventCardFootprint", () => {
  it("is wider than the old 90px gap along a horizontal axis", () => {
    const footprint = getEventCardFootprint("horizontal", 900, 1);
    expect(footprint.primaryEnd - footprint.primaryStart).toBeGreaterThan(90);
  });

  it("puts the label away from the axis in horizontal mode", () => {
    const below = getEventCardFootprint("horizontal", 900, 1);
    const above = getEventCardFootprint("horizontal", 900, -1);
    expect(below.crossEnd).toBeGreaterThan(-below.crossStart);
    expect(above.crossStart).toBe(-below.crossEnd);
  });

  it("stacks labels after the marker on narrow vertical timelines", () => {
    const footprint = getEventCardFootprint(
      "vertical",
      VERTICAL_SIDE_LABEL_MIN_WIDTH - 1,
      -1,
    );
    expect(footprint.primaryEnd).toBeGreaterThan(-footprint.primaryStart);
    expect(footprint.crossStart).toBe(-footprint.crossEnd);
  });

  it("reaches sideways on wide vertical timelines", () => {
    const right = getEventCardFootprint("vertical", 1440, 1);
    const left = getEventCardFootprint("vertical", 1440, -1);
    expect(right.crossEnd).toBeGreaterThan(100);
    expect(left.crossStart).toBe(-right.crossEnd);
  });
});

describe("createCardPacker", () => {
  const horizontal = getEventCardFootprint("horizontal", 900, 1);
  const narrowVertical = getEventCardFootprint("vertical", 390, 1);

  it("rejects a card closer than its label width on the same row", () => {
    const packer = createCardPacker();
    expect(place(packer, horizontal, 0, 80)).toBe(true);
    // 100px apart passed the old 90px test but the labels overlap.
    expect(place(packer, horizontal, 100, 80)).toBe(false);
    expect(place(packer, horizontal, 140, 80)).toBe(true);
  });

  it("checks neighbouring rows, not just the candidate row", () => {
    const packer = createCardPacker();
    expect(place(packer, horizontal, 0, 80)).toBe(true);
    // Row 2 starts 80px further out, inside row 1's label.
    expect(place(packer, horizontal, 0, 160)).toBe(false);
    expect(place(packer, horizontal, 0, 240)).toBe(true);
  });

  it("spaces narrow vertical cards by their stacked height", () => {
    const packer = createCardPacker();
    expect(place(packer, narrowVertical, 0, -80)).toBe(true);
    expect(place(packer, narrowVertical, 100, -80)).toBe(false);
    expect(place(packer, narrowVertical, 130, -80)).toBe(true);
  });

  it("keeps cards off a span bar on the same row", () => {
    const packer = createCardPacker();
    expect(
      place(packer, horizontal, 500, 80, { start: 0, end: 1000 }),
    ).toBe(true);
    expect(place(packer, horizontal, 150, 80)).toBe(false);
    expect(place(packer, horizontal, 150, -80)).toBe(true);
  });

  it("finds collisions across bucket boundaries", () => {
    const packer = createCardPacker();
    expect(place(packer, horizontal, 127, 80)).toBe(true);
    expect(place(packer, horizontal, 129, 80)).toBe(false);
  });
});

describe("getEventPackingRects", () => {
  it("clamps a span bar to the layout window", () => {
    const [, bar] = getEventPackingRects({
      footprint: getEventCardFootprint("horizontal", 900, 1),
      markerPrimary: 0,
      cross: 80,
      bar: { start: -1e9, end: 1e9 },
      windowStart: -500,
      windowEnd: 1500,
    });
    expect(bar.primaryStart).toBe(-500);
    expect(bar.primaryEnd).toBe(1500);
  });
});

describe("getSpanMarkerPrimary", () => {
  it("centres on the visible part of the bar", () => {
    expect(getSpanMarkerPrimary(-1000, 200, 800, 40)).toBe(80);
    expect(getSpanMarkerPrimary(100, 300, 800, 40)).toBe(200);
  });
});

describe("getCollapsedGroupOffset", () => {
  it("keeps the old row-based offset without an orientation", () => {
    expect(getCollapsedGroupOffset(900)).toBe(400);
  });

  it("clears the outermost card on wide vertical timelines", () => {
    const offset = getCollapsedGroupOffset(1440, "vertical");
    const reach = getEventCardFootprint("vertical", 1440, 1).crossEnd;
    expect(offset).toBeGreaterThan(4 * 80 + reach);
  });

  it("stays on screen on a phone", () => {
    expect(getCollapsedGroupOffset(390, "vertical")).toBeLessThanOrEqual(
      390 / 2 - 22,
    );
  });
});
