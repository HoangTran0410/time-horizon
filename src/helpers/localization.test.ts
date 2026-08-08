import { describe, it, expect } from "vitest";
import type { Event } from "../constants/types";
import {
  DEFAULT_LANGUAGE,
  getLocalizedEventDescription,
  getLocalizedEventTitle,
  getLocalizedText,
  getSearchableLocalizedText,
  normalizeLocalizedText,
} from "./localization";

describe("DEFAULT_LANGUAGE", () => {
  it("is Vietnamese — the app-wide default; a change here is user-visible", () => {
    expect(DEFAULT_LANGUAGE).toBe("vi");
  });
});

describe("getLocalizedText", () => {
  it("passes a plain string through, trimmed", () => {
    expect(getLocalizedText("Hello", "en")).toBe("Hello");
    expect(getLocalizedText("  padded  ", "vi")).toBe("padded");
  });

  it("picks the requested language from a record", () => {
    const value = { vi: "Xin chào", en: "Hello" };
    expect(getLocalizedText(value, "vi")).toBe("Xin chào");
    expect(getLocalizedText(value, "en")).toBe("Hello");
  });

  it("falls back to the default language when the requested one is missing", () => {
    expect(getLocalizedText({ vi: "Chỉ tiếng Việt" }, "en")).toBe(
      "Chỉ tiếng Việt",
    );
  });

  it("falls back to any other supported language when the default is also missing", () => {
    expect(getLocalizedText({ en: "English only" }, "vi")).toBe("English only");
  });

  it("honors an explicit fallbackLanguage before the remaining languages", () => {
    const value = { vi: "VI", en: "EN" };
    expect(
      getLocalizedText({ en: "EN" }, "vi", { fallbackLanguage: "en" }),
    ).toBe("EN");
    expect(getLocalizedText(value, "en", { fallbackLanguage: "vi" })).toBe(
      "EN",
    );
  });

  it("falls back to any language present in the record as a last resort", () => {
    expect(getLocalizedText({ fr: "Bonjour" }, "en")).toBe("Bonjour");
  });

  it("skips whitespace-only entries when resolving", () => {
    expect(getLocalizedText({ vi: "   ", en: "Real" }, "vi")).toBe("Real");
  });

  it("returns the emptyFallback for null, undefined, empty string and empty records", () => {
    expect(getLocalizedText(null, "en")).toBe("");
    expect(getLocalizedText(undefined, "en")).toBe("");
    expect(getLocalizedText("", "en")).toBe("");
    expect(getLocalizedText("   ", "en")).toBe("");
    expect(getLocalizedText({}, "en")).toBe("");
    expect(getLocalizedText(null, "en", { emptyFallback: "n/a" })).toBe("n/a");
    expect(getLocalizedText({ vi: "" }, "vi", { emptyFallback: "n/a" })).toBe(
      "n/a",
    );
  });
});

describe("getSearchableLocalizedText", () => {
  it("returns a plain string unchanged", () => {
    expect(getSearchableLocalizedText("As is  ")).toBe("As is  ");
  });

  it("joins all record values with spaces so every language is searchable", () => {
    expect(getSearchableLocalizedText({ vi: "Trái Đất", en: "Earth" })).toBe(
      "Trái Đất Earth",
    );
  });

  it("returns an empty string for null or undefined", () => {
    expect(getSearchableLocalizedText(null)).toBe("");
    expect(getSearchableLocalizedText(undefined)).toBe("");
  });
});

describe("getLocalizedEventTitle / getLocalizedEventDescription", () => {
  const event: Event = {
    id: "runtime-id",
    title: { vi: "Tiêu đề", en: "Title" },
    description: { vi: "Mô tả", en: "Description" },
    emoji: "📅",
    time: [1954, 5, 7],
    priority: 50,
  };

  it("resolves the event title for the requested language", () => {
    expect(getLocalizedEventTitle(event, "vi")).toBe("Tiêu đề");
    expect(getLocalizedEventTitle(event, "en")).toBe("Title");
  });

  it("resolves the event description for the requested language", () => {
    expect(getLocalizedEventDescription(event, "vi")).toBe("Mô tả");
    expect(getLocalizedEventDescription(event, "en")).toBe("Description");
  });

  it("uses the emptyFallback when the event has no usable title", () => {
    const untitled: Event = { ...event, title: "", description: "" };
    expect(getLocalizedEventTitle(untitled, "en", "Untitled")).toBe("Untitled");
    expect(getLocalizedEventDescription(untitled, "en", "—")).toBe("—");
  });
});

describe("normalizeLocalizedText", () => {
  it("trims strings and nulls out empty ones", () => {
    expect(normalizeLocalizedText("  keep  ")).toBe("keep");
    expect(normalizeLocalizedText("")).toBeNull();
    expect(normalizeLocalizedText("   ")).toBeNull();
  });

  it("trims record values and drops empty entries", () => {
    expect(
      normalizeLocalizedText({ vi: "  còn  ", en: "", fr: "   " }),
    ).toEqual({ vi: "còn" });
  });

  it("returns null for records with no usable entries and for non-text input", () => {
    expect(normalizeLocalizedText({})).toBeNull();
    expect(normalizeLocalizedText({ en: "  " })).toBeNull();
    expect(normalizeLocalizedText(null)).toBeNull();
    expect(normalizeLocalizedText(undefined)).toBeNull();
    expect(normalizeLocalizedText(42)).toBeNull();
    expect(normalizeLocalizedText(["not", "text"])).toBeNull();
  });
});
