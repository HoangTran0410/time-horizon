import { describe, it, expect } from "vitest";
import en from "../../i18n/en.json";
import vi from "../../i18n/vi.json";
import {
  isLandingLogZoomInBounds,
  LANDING_REFERENCE_AXIS_PX,
  resolveLandingCamera,
} from "./landingCamera";
import {
  buildLandingEvents,
  LANDING_CAMERA_WAYPOINTS,
  LANDING_EDGE_PAD_PX,
  LANDING_WAYPOINTS,
} from "./landingWaypoints";

const enMap: Record<string, string> = en;
const viMap: Record<string, string> = vi;

const HALF_AXIS_PX = LANDING_REFERENCE_AXIS_PX / 2;
/** Furthest from centre an event may sit and still have room for its card. */
const MAX_OFFSET_PX = HALF_AXIS_PX - LANDING_EDGE_PAD_PX;

/** Where a year lands on the axis, relative to the centre of the frame. */
const offsetPx = (
  year: number,
  camera: { focusYear: number; logZoom: number },
): number => Math.abs(year - camera.focusYear) * Math.exp(camera.logZoom);

describe("LANDING_WAYPOINTS", () => {
  it("has at least eight moments so the scroll has somewhere to go", () => {
    expect(LANDING_WAYPOINTS.length).toBeGreaterThanOrEqual(8);
  });

  it("is ordered strictly forward in time", () => {
    for (let i = 1; i < LANDING_WAYPOINTS.length; i++) {
      expect(LANDING_WAYPOINTS[i].year).toBeGreaterThan(
        LANDING_WAYPOINTS[i - 1].year,
      );
    }
  });

  it("never zooms back out", () => {
    for (let i = 1; i < LANDING_WAYPOINTS.length; i++) {
      expect(LANDING_WAYPOINTS[i].logZoom).toBeGreaterThanOrEqual(
        LANDING_WAYPOINTS[i - 1].logZoom,
      );
    }
  });

  it("ends up meaningfully deeper than it starts", () => {
    const first = LANDING_WAYPOINTS[0].logZoom;
    const last = LANDING_WAYPOINTS[LANDING_WAYPOINTS.length - 1].logZoom;
    // e^19 ≈ 1.8e8×, i.e. the journey really does cross the scales it claims.
    expect(last - first).toBeGreaterThan(19);
  });

  it("frames both neighbours at every stop", () => {
    LANDING_WAYPOINTS.forEach((waypoint, index) => {
      for (const neighbour of [
        LANDING_WAYPOINTS[index - 1],
        LANDING_WAYPOINTS[index + 1],
      ]) {
        if (!neighbour) continue;
        expect(
          offsetPx(neighbour.year, {
            focusYear: waypoint.year,
            logZoom: waypoint.logZoom,
          }),
          `${neighbour.eventUid} is off screen at the ${waypoint.eventUid} stop`,
        ).toBeLessThanOrEqual(MAX_OFFSET_PX + 1e-6);
      }
    });
  });

  it("keeps both ends of every segment on screen for the whole transition", () => {
    const segmentCount = LANDING_WAYPOINTS.length - 1;

    for (let segment = 0; segment < segmentCount; segment++) {
      for (let step = 0; step <= 20; step++) {
        const progress = (segment + step / 20) / segmentCount;
        const camera = resolveLandingCamera(LANDING_CAMERA_WAYPOINTS, progress);

        for (const end of [
          LANDING_WAYPOINTS[segment],
          LANDING_WAYPOINTS[segment + 1],
        ]) {
          expect(
            offsetPx(end.year, camera),
            `${end.eventUid} left the frame ${step * 5}% through segment ${segment}`,
          ).toBeLessThanOrEqual(MAX_OFFSET_PX + 1e-6);
        }
      }
    }
  });

  it("keeps every logZoom inside the engine's range", () => {
    for (const waypoint of LANDING_WAYPOINTS) {
      expect(
        isLandingLogZoomInBounds(waypoint.logZoom),
        `${waypoint.eventUid} logZoom ${waypoint.logZoom} out of range`,
      ).toBe(true);
    }
  });

  it("has unique, non-empty, namespaced eventUids", () => {
    const uids = LANDING_WAYPOINTS.map((waypoint) => waypoint.eventUid);
    expect(new Set(uids).size).toBe(uids.length);
    for (const uid of uids) {
      expect(uid.startsWith("landing-")).toBe(true);
      expect(uid.length).toBeGreaterThan("landing-".length);
    }
  });

  it("references i18n keys that exist in both languages", () => {
    for (const waypoint of LANDING_WAYPOINTS) {
      for (const key of [
        waypoint.titleKey,
        waypoint.captionKey,
        waypoint.timeLabelKey,
      ]) {
        expect(enMap[key], `missing from en.json: ${key}`).toBeTruthy();
        expect(viMap[key], `missing from vi.json: ${key}`).toBeTruthy();
      }
    }
  });

  it("exposes a camera view carrying the same years and zooms", () => {
    expect(LANDING_CAMERA_WAYPOINTS).toHaveLength(LANDING_WAYPOINTS.length);
    LANDING_CAMERA_WAYPOINTS.forEach((camera, index) => {
      expect(camera.year).toBe(LANDING_WAYPOINTS[index].year);
      expect(camera.logZoom).toBe(LANDING_WAYPOINTS[index].logZoom);
    });
  });

  it("has priority descending strictly from 100 to 55, matching catalog convention", () => {
    for (const waypoint of LANDING_WAYPOINTS) {
      expect(waypoint.priority).toBeGreaterThanOrEqual(55);
      expect(waypoint.priority).toBeLessThanOrEqual(100);
    }
    for (let i = 1; i < LANDING_WAYPOINTS.length; i++) {
      expect(LANDING_WAYPOINTS[i].priority).toBeLessThan(
        LANDING_WAYPOINTS[i - 1].priority,
      );
    }
  });
});

describe("buildLandingEvents", () => {
  it("produces one event per waypoint, carrying the durable uid", () => {
    const events = buildLandingEvents();
    expect(events).toHaveLength(LANDING_WAYPOINTS.length);
    events.forEach((event, index) => {
      expect(event.eventUid).toBe(LANDING_WAYPOINTS[index].eventUid);
    });
  });

  it("assigns a non-empty runtime id to every event", () => {
    for (const event of buildLandingEvents()) {
      expect(typeof event.id).toBe("string");
      expect(event.id.length).toBeGreaterThan(0);
    }
  });

  it("gives every event a year matching its waypoint", () => {
    const events = buildLandingEvents();
    events.forEach((event, index) => {
      expect(event.time[0]).toBe(LANDING_WAYPOINTS[index].year);
    });
  });
});
