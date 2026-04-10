import test from "node:test";
import assert from "node:assert/strict";

import { formatElapsedTimelineTime } from "./index.ts";

test("formats mixed year month day durations with detail", () => {
  const value = 2 + 2 / 12 + 5 / 365.25;
  assert.equal(formatElapsedTimelineTime(value), "2 years 2 months 5 days");
});

test("formats mixed durations in vietnamese", () => {
  const value = 1 + 1 / 12 + 3 / 365.25;
  assert.equal(formatElapsedTimelineTime(value, "vi"), "1 năm 1 tháng 3 ngày");
});

test("formats year and month durations without dropping month detail", () => {
  const value = 1 + 1 / 12;
  assert.equal(formatElapsedTimelineTime(value), "1 year 1 month");
});

test("keeps short durations in month-only form when no year is present", () => {
  assert.equal(formatElapsedTimelineTime(2 / 12), "2 months");
});
