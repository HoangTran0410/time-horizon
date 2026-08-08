import { describe, it, expect } from "vitest";
import en from "../../i18n/en.json";
import vi from "../../i18n/vi.json";
import { isLandingLogZoomInBounds } from "./landingCamera";
import {
  buildLandingEvents,
  LANDING_CAMERA_WAYPOINTS,
  LANDING_WAYPOINTS,
} from "./landingWaypoints";

const enMap: Record<string, string> = en;
const viMap: Record<string, string> = vi;

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

  it("zooms in monotonically", () => {
    for (let i = 1; i < LANDING_WAYPOINTS.length; i++) {
      expect(LANDING_WAYPOINTS[i].logZoom).toBeGreaterThan(
        LANDING_WAYPOINTS[i - 1].logZoom,
      );
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
