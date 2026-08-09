import { describe, expect, it } from "vitest";
import {
  buildTimelineLaneGeometry,
  packTimelineLaneEvents,
} from "./laneLayout";
import { areCollapsedGroupsEqual } from ".";

describe("buildTimelineLaneGeometry", () => {
  it("keeps ordered collection lanes symmetric around the timeline axis", () => {
    const geometry = buildTimelineLaneGeometry(
      [
        { id: "cosmos", label: "Cosmos", color: "#a78bfa" },
        { id: "earth", label: "Earth", color: "#60a5fa" },
        { id: "human", label: "Human", color: "#f97316" },
      ],
      720,
    );

    expect(geometry.map((lane) => lane.id)).toEqual([
      "cosmos",
      "earth",
      "human",
    ]);
    expect(geometry[0].cross).toBeLessThan(0);
    expect(geometry[1].cross).toBe(0);
    expect(geometry[2].cross).toBe(-geometry[0].cross);
  });
});

describe("packTimelineLaneEvents", () => {
  it("packs collisions inside their semantic lane without shifting other lanes", () => {
    const result = packTimelineLaneEvents({
      lanes: [
        { id: "cosmos", label: "Cosmos", color: "#a78bfa" },
        { id: "earth", label: "Earth", color: "#60a5fa" },
      ],
      crossSize: 640,
      minDistanceYears: 20,
      events: [
        {
          id: "cosmos-a",
          laneId: "cosmos",
          startYear: 0,
          endYear: 0,
          priority: 10,
        },
        {
          id: "cosmos-b",
          laneId: "cosmos",
          startYear: 5,
          endYear: 5,
          priority: 9,
        },
        {
          id: "earth-a",
          laneId: "earth",
          startYear: 0,
          endYear: 0,
          priority: 8,
        },
      ],
    });

    const cosmosA = result.placements.get("cosmos-a");
    const cosmosB = result.placements.get("cosmos-b");
    const earthA = result.placements.get("earth-a");

    expect(cosmosA?.cross).not.toBe(cosmosB?.cross);
    expect(earthA?.cross).toBeGreaterThan(0);
    expect(result.collapsed).toEqual([]);
  });

  it("collapses overflow only with nearby events from the same lane", () => {
    const events = Array.from({ length: 4 }, (_, index) => ({
      id: `earth-${index}`,
      laneId: "earth",
      startYear: index,
      endYear: index,
      priority: 10 - index,
    }));

    const result = packTimelineLaneEvents({
      lanes: [
        { id: "cosmos", label: "Cosmos", color: "#a78bfa" },
        { id: "earth", label: "Earth", color: "#60a5fa" },
      ],
      crossSize: 640,
      minDistanceYears: 20,
      events,
    });

    expect(result.collapsed).toHaveLength(1);
    expect(result.collapsed[0].laneId).toBe("earth");
    expect(result.collapsed[0].eventIds).toEqual(["earth-3"]);
  });
});

describe("areCollapsedGroupsEqual", () => {
  it("treats a semantic lane position change as a different layout", () => {
    const base = {
      id: "earth:cluster",
      year: 0,
      side: 1 as const,
      laneId: "earth",
      count: 1,
      eventIds: ["earth-a"],
    };

    expect(
      areCollapsedGroupsEqual(
        [{ ...base, cross: 80 }],
        [{ ...base, cross: 160 }],
      ),
    ).toBe(false);
  });
});
