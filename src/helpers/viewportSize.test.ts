import { describe, expect, it } from "vitest";
import { resolveViewportDimension } from "./viewportSize";

describe("resolveViewportDimension", () => {
  it("falls back to the window dimension while the mounted container is still zero-sized", () => {
    expect(resolveViewportDimension(0, 1280)).toBe(1280);
  });

  it("uses the measured container dimension once layout is ready", () => {
    expect(resolveViewportDimension(960, 1280)).toBe(960);
  });
});