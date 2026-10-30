import { describe, expect, it } from "vitest";
import {
  notifyEventLayoutChange,
  subscribeToEventLayoutChanges,
} from "./eventLayoutSignal";

describe("event layout change signal", () => {
  it("notifies only the listeners of the layouts record that changed", () => {
    const timeline = {};
    const landing = {};
    let timelineCalls = 0;
    let landingCalls = 0;
    subscribeToEventLayoutChanges(timeline, () => (timelineCalls += 1));
    subscribeToEventLayoutChanges(landing, () => (landingCalls += 1));

    notifyEventLayoutChange(timeline);
    notifyEventLayoutChange(timeline);
    expect(timelineCalls).toBe(2);
    expect(landingCalls).toBe(0);
  });

  it("stops notifying after unsubscribe and tolerates unknown records", () => {
    const layouts = {};
    let calls = 0;
    const unsubscribe = subscribeToEventLayoutChanges(layouts, () => (calls += 1));
    unsubscribe();
    notifyEventLayoutChange(layouts);
    notifyEventLayoutChange({});
    expect(calls).toBe(0);
  });
});
