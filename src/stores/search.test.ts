import { describe, expect, it } from "vitest";
import {
  filterTimelineSearchEvents,
  getTimelineSearchDateInputError,
} from "./search";
import type { Event } from "../constants/types";

const makeEvent = (id: string, overrides: Partial<Event> = {}): Event => ({
  id,
  title: id,
  description: "",
  time: [2000],
  emoji: "📌",
  priority: 50,
  ...overrides,
});

const filterByRange = (events: Event[], start: string, end: string) =>
  filterTimelineSearchEvents(events, "", [], {
    startTimeInput: start,
    endTimeInput: end,
  }).map((event) => event.id);

describe("partial-date validation — Gregorian leap years", () => {
  it("accepts Feb 29 in a 400-year century", () => {
    expect(getTimelineSearchDateInputError("2000-02-29", "")).toBeNull();
    expect(getTimelineSearchDateInputError("1600-02-29", "")).toBeNull();
  });

  it("rejects Feb 29 in a plain century", () => {
    expect(getTimelineSearchDateInputError("1900-02-29", "")).toMatch(
      /Day is out of range/,
    );
    expect(getTimelineSearchDateInputError("2100-02-29", "")).toMatch(
      /Day is out of range/,
    );
  });
});

describe("time-range filter — spans and ongoing events", () => {
  const ww2 = makeEvent("ww2", { time: [1939], endTime: [1945] });
  const reversed = makeEvent("reversed", { time: [1945], endTime: [1939] });
  const ongoing = makeEvent("ongoing", { time: [1986], ongoing: true });
  const point = makeEvent("point", { time: [1969, 7, 20] });

  it("matches a span whose interior overlaps the range", () => {
    expect(filterByRange([ww2], "1942", "1942")).toEqual(["ww2"]);
    expect(filterByRange([reversed], "1942", "1942")).toEqual(["reversed"]);
  });

  it("includes the whole end year of a span", () => {
    expect(filterByRange([ww2], "1945-12", "1946")).toEqual(["ww2"]);
    expect(filterByRange([ww2], "1946", "1950")).toEqual([]);
  });

  it("runs an ongoing event up to now", () => {
    expect(filterByRange([ongoing], "2020", "2020")).toEqual(["ongoing"]);
    expect(filterByRange([ongoing], "1900", "1985")).toEqual([]);
  });

  it("keeps point events at their own precision", () => {
    expect(filterByRange([point], "1969-07-20", "1969-07-20")).toEqual([
      "point",
    ]);
    expect(filterByRange([point], "1969-07-21", "1969-12")).toEqual([]);
  });

  it("sorts spans by their earliest year", () => {
    const sorted = filterTimelineSearchEvents([point, reversed], "", [], {
      sortMode: "time-asc",
      startTimeInput: "1900",
    }).map((event) => event.id);
    expect(sorted).toEqual(["reversed", "point"]);
  });
});
