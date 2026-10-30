import { describe, expect, it } from "vitest";
import {
  clearSharedOrientationInUrl,
  clearSharedSpatialMappingInUrl,
  clearSharedViewportInUrl,
  getSharedCollectionIdsFromSearch,
  getSharedEventIdFromSearch,
  getSharedLogZoomFromSearch,
  getSharedOrientationFromSearch,
  getSharedSpatialMappingFromSearch,
  getSharedViewportYearFromSearch,
  hasSharedCollectionIdsInSearch,
  hasSharedEventIdInSearch,
  hasSharedSpatialMappingInSearch,
  hasSharedViewportInSearch,
  hasTimelineViewInSearch,
  setSharedCollectionIdsInUrl,
  setSharedEventIdInUrl,
  setSharedOrientationInUrl,
  setSharedSpatialMappingInUrl,
  setSharedViewportInUrl,
  setTimelineViewInUrl,
} from "./useTimelineShareUrl";
import { BIG_BANG_YEAR } from "../constants";
import { DEFAULT_SPATIAL_MAPPING } from "../helpers";

const BASE = "https://hoangtran99.is-a.dev/time-horizon/";
const makeUrl = (search = "") => new URL(`${BASE}${search}`);

describe("timeline view flag `t`", () => {
  it("is set to 1 and removed again", () => {
    const url = makeUrl("?x=1");
    setTimelineViewInUrl(url, true);
    expect(hasTimelineViewInSearch(url.search)).toBe(true);
    setTimelineViewInUrl(url, false);
    expect(hasTimelineViewInSearch(url.search)).toBe(false);
    expect(url.searchParams.get("x")).toBe("1");
  });

  it("only accepts the literal value 1", () => {
    expect(hasTimelineViewInSearch("?t=true")).toBe(false);
    expect(hasTimelineViewInSearch("?t=0")).toBe(false);
    expect(hasTimelineViewInSearch("")).toBe(false);
  });
});

describe("shared collections `c`", () => {
  it("round-trips ids, deduplicating and dropping blanks", () => {
    const url = makeUrl();
    setSharedCollectionIdsInUrl(url, ["einstein", "", "cosmic", "einstein"]);
    expect(url.searchParams.get("c")).toBe("einstein,cosmic");
    expect(getSharedCollectionIdsFromSearch(url.search)).toEqual([
      "einstein",
      "cosmic",
    ]);
  });

  it("round-trips ids containing characters that need encoding", () => {
    const ids = ["sgk-vietnam-new-lop-6", "a b", "x&y=z", "lịch-sử"];
    const url = makeUrl();
    setSharedCollectionIdsInUrl(url, ids);
    expect(getSharedCollectionIdsFromSearch(url.search)).toEqual(ids);
  });

  it("trims whitespace around comma-separated ids when reading", () => {
    expect(getSharedCollectionIdsFromSearch("?c=%20a%20,,b%20")).toEqual([
      "a",
      "b",
    ]);
  });

  it("reads the legacy `collections` param and drops it on write", () => {
    expect(getSharedCollectionIdsFromSearch("?collections=a,b")).toEqual([
      "a",
      "b",
    ]);
    // The short param wins when both are present.
    expect(getSharedCollectionIdsFromSearch("?collections=a&c=b")).toEqual([
      "b",
    ]);

    const url = makeUrl("?collections=a,b");
    setSharedCollectionIdsInUrl(url, ["c"]);
    expect(url.searchParams.has("collections")).toBe(false);
    expect(url.searchParams.get("c")).toBe("c");
  });

  it("removes the param entirely for an empty list", () => {
    const url = makeUrl("?c=a");
    setSharedCollectionIdsInUrl(url, []);
    expect(url.searchParams.has("c")).toBe(false);
    expect(hasSharedCollectionIdsInSearch(url.search)).toBe(false);
  });
});

describe("shared event `e`", () => {
  it("round-trips and trims an event id", () => {
    const url = makeUrl();
    setSharedEventIdInUrl(url, "  einstein-abc123-2  ");
    expect(getSharedEventIdFromSearch(url.search)).toBe("einstein-abc123-2");
    expect(hasSharedEventIdInSearch(url.search)).toBe(true);
  });

  it("clears on null or blank", () => {
    const url = makeUrl("?e=x");
    setSharedEventIdInUrl(url, null);
    expect(url.searchParams.has("e")).toBe(false);
    setSharedEventIdInUrl(url, "x");
    setSharedEventIdInUrl(url, "   ");
    expect(url.searchParams.has("e")).toBe(false);
    expect(getSharedEventIdFromSearch("?e=%20%20")).toBeNull();
  });
});

describe("viewport `y` / `z`", () => {
  const roundTrip = (focusYear: number, logZoom: number) => {
    const url = makeUrl();
    setSharedViewportInUrl(url, focusYear, logZoom);
    return {
      url,
      year: getSharedViewportYearFromSearch(url.search),
      zoom: getSharedLogZoomFromSearch(url.search),
    };
  };

  it("round-trips modern years to 2 decimals and log zoom to 3", () => {
    const { year, zoom } = roundTrip(1969.554321, -3.14159);
    expect(year).toBe(1969.55);
    expect(zoom).toBe(-3.142);
  });

  it("round-trips BCE and zero", () => {
    expect(roundTrip(-500, 0).year).toBe(-500);
    expect(roundTrip(0, 0).year).toBe(0);
  });

  it("writes years beyond ±1e6 in scientific notation that parses back", () => {
    const { url, year } = roundTrip(-66_000_000, -10);
    expect(url.searchParams.get("y")).toBe("-6.6e7");
    expect(year).toBe(-66_000_000);
    expect(roundTrip(BIG_BANG_YEAR, -18).year).toBe(BIG_BANG_YEAR);
  });

  it("keeps large years within a small fraction of the visible span", () => {
    // Century zoom (~10 px/yr, ~100 visible years): -1234567 used to be
    // written as -1.235e+6, a 433-year jump.
    const logZoom = Math.log(10);
    const visibleSpan = 1000 / Math.exp(logZoom);
    for (const focusYear of [-1_234_567, 7_654_321.5, -987_654_321]) {
      const { year } = roundTrip(focusYear, logZoom);
      expect(Math.abs((year ?? 0) - focusYear)).toBeLessThan(visibleSpan * 1e-4);
    }
  });

  it("writes only the digits the zoom needs", () => {
    // Zoomed all the way out, 1e-5 of 13.8 billion years is ~100k years.
    expect(roundTrip(-13_812_345_678, Math.log(1000 / 13.8e9)).url.searchParams.get("y"))
      .toBe("-1.38123e10");
  });

  it("adds decimals at sub-day zoom so a shared hour stays put", () => {
    // ~1 hour across 1000px.
    const logZoom = Math.log(1000 / (1 / (365.25 * 24)));
    const visibleSpan = 1000 / Math.exp(logZoom);
    const focusYear = 2024.123456789;
    const { year } = roundTrip(focusYear, logZoom);
    expect(Math.abs((year ?? 0) - focusYear)).toBeLessThan(visibleSpan * 1e-4);
  });

  it("accepts hand-written scientific notation and plain numbers", () => {
    expect(getSharedViewportYearFromSearch("?y=-6.6e7")).toBe(-66_000_000);
    expect(getSharedViewportYearFromSearch("?y=1.5E9")).toBe(1.5e9);
    expect(getSharedViewportYearFromSearch("?y=%201969%20")).toBe(1969);
    expect(getSharedLogZoomFromSearch("?z=2.5e-1")).toBe(0.25);
  });

  it("rejects absent, blank and non-finite values", () => {
    for (const search of ["", "?y=", "?y=%20", "?y=abc", "?y=Infinity", "?y=NaN", "?y=1e999"]) {
      expect(getSharedViewportYearFromSearch(search)).toBeNull();
    }
    for (const search of ["", "?z=", "?z=x", "?z=-Infinity"]) {
      expect(getSharedLogZoomFromSearch(search)).toBeNull();
    }
  });

  it("reports a viewport when either half is present, and clears both", () => {
    expect(hasSharedViewportInSearch("?y=1")).toBe(true);
    expect(hasSharedViewportInSearch("?z=1")).toBe(true);
    expect(hasSharedViewportInSearch("?y=x&z=y")).toBe(false);

    const { url } = roundTrip(1, 1);
    clearSharedViewportInUrl(url);
    expect(hasSharedViewportInSearch(url.search)).toBe(false);
  });
});

describe("orientation `o`", () => {
  it("round-trips both orientations and clears", () => {
    const url = makeUrl();
    setSharedOrientationInUrl(url, "vertical");
    expect(getSharedOrientationFromSearch(url.search)).toBe("vertical");
    setSharedOrientationInUrl(url, "horizontal");
    expect(getSharedOrientationFromSearch(url.search)).toBe("horizontal");
    clearSharedOrientationInUrl(url);
    expect(getSharedOrientationFromSearch(url.search)).toBeNull();
  });

  it("rejects anything else", () => {
    expect(getSharedOrientationFromSearch("?o=diagonal")).toBeNull();
    expect(getSharedOrientationFromSearch("?o=Vertical")).toBeNull();
  });
});

describe("spatial mapping `sm*`", () => {
  it("returns null when no spatial param is present", () => {
    expect(getSharedSpatialMappingFromSearch("?t=1&y=2")).toBeNull();
    expect(hasSharedSpatialMappingInSearch("")).toBe(false);
  });

  it("round-trips a full mapping with rounding", () => {
    const url = makeUrl();
    setSharedSpatialMappingInUrl(url, {
      enabled: true,
      anchorYear: 1945.123456,
      anchorLat: 21.0277644,
      anchorLng: 105.8341598,
      metersPerYear: 1234.56789,
      mapTheme: "light",
      mapOpacity: 0.4567,
    });
    expect(getSharedSpatialMappingFromSearch(url.search)).toEqual({
      enabled: true,
      anchorYear: 1945.123,
      anchorLat: 21.02776,
      anchorLng: 105.83416,
      metersPerYear: 1234.568,
      mapTheme: "light",
      mapOpacity: 0.457,
    });
  });

  it("round-trips the default mapping (null anchors stay null)", () => {
    const url = makeUrl();
    setSharedSpatialMappingInUrl(url, DEFAULT_SPATIAL_MAPPING);
    expect(getSharedSpatialMappingFromSearch(url.search)).toEqual(
      DEFAULT_SPATIAL_MAPPING,
    );
  });

  it("removes stale anchor params when the new mapping has none", () => {
    const url = makeUrl("?say=1&salat=2&salng=3");
    setSharedSpatialMappingInUrl(url, DEFAULT_SPATIAL_MAPPING);
    expect(url.searchParams.has("say")).toBe(false);
    expect(url.searchParams.has("salat")).toBe(false);
    expect(url.searchParams.has("salng")).toBe(false);
  });

  it("sanitizes hostile values: clamps latitude, wraps longitude, defaults bad numbers", () => {
    const mapping = getSharedSpatialMappingFromSearch(
      "?sm=1&salat=120&salng=190&smpy=-5&smt=neon&smo=7",
    );
    expect(mapping).toEqual({
      enabled: true,
      anchorYear: null,
      anchorLat: 85,
      anchorLng: -170,
      metersPerYear: DEFAULT_SPATIAL_MAPPING.metersPerYear,
      mapTheme: "dark",
      mapOpacity: 1,
    });
  });

  it("treats any `sm` other than 1 as disabled", () => {
    expect(getSharedSpatialMappingFromSearch("?sm=true")?.enabled).toBe(false);
    expect(getSharedSpatialMappingFromSearch("?sm=0")?.enabled).toBe(false);
  });

  it("clears every spatial param", () => {
    const url = makeUrl("?t=1");
    setSharedSpatialMappingInUrl(url, { ...DEFAULT_SPATIAL_MAPPING, anchorYear: 1 });
    clearSharedSpatialMappingInUrl(url);
    expect(hasSharedSpatialMappingInSearch(url.search)).toBe(false);
    expect(url.search).toBe("?t=1");
  });
});

describe("combined share URL", () => {
  it("encodes every param family into one URL and decodes each independently", () => {
    const url = makeUrl();
    setTimelineViewInUrl(url, true);
    setSharedCollectionIdsInUrl(url, ["einstein", "cosmic"]);
    setSharedEventIdInUrl(url, "einstein-xyz");
    setSharedViewportInUrl(url, 1905.5, 4.2);
    setSharedOrientationInUrl(url, "vertical");
    setSharedSpatialMappingInUrl(url, { ...DEFAULT_SPATIAL_MAPPING, enabled: true });

    const search = new URL(url.toString()).search;
    expect(hasTimelineViewInSearch(search)).toBe(true);
    expect(getSharedCollectionIdsFromSearch(search)).toEqual(["einstein", "cosmic"]);
    expect(getSharedEventIdFromSearch(search)).toBe("einstein-xyz");
    expect(getSharedViewportYearFromSearch(search)).toBe(1905.5);
    expect(getSharedLogZoomFromSearch(search)).toBe(4.2);
    expect(getSharedOrientationFromSearch(search)).toBe("vertical");
    expect(getSharedSpatialMappingFromSearch(search)?.enabled).toBe(true);
  });
});
