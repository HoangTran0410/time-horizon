import { describe, expect, it } from "vitest";
import {
  normalizeEmbedVideoUrl,
  normalizeExternalLinkUrl,
  normalizeImageUrl,
  withAlpha,
} from "../helpers";

describe("normalizeImageUrl", () => {
  it("returns null for blank input", () => {
    expect(normalizeImageUrl(undefined)).toBeNull();
    expect(normalizeImageUrl("   ")).toBeNull();
  });

  it("upgrades protocol-relative URLs to https and trims", () => {
    expect(normalizeImageUrl("  //upload.wikimedia.org/a.png ")).toBe(
      "https://upload.wikimedia.org/a.png",
    );
  });

  it("leaves absolute and relative URLs alone", () => {
    expect(normalizeImageUrl("http://x/a.png")).toBe("http://x/a.png");
    expect(normalizeImageUrl("img/a.png")).toBe("img/a.png");
  });
});

describe("normalizeEmbedVideoUrl", () => {
  const embed = "https://www.youtube.com/embed/dQw4w9WgXcQ";

  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/live/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "//www.youtube.com/watch?v=dQw4w9WgXcQ",
    "www.youtube.com/watch?v=dQw4w9WgXcQ",
    "youtu.be/dQw4w9WgXcQ",
  ])("maps %s to the embed URL", (input) => {
    expect(normalizeEmbedVideoUrl(input)).toBe(embed);
  });

  it("treats a bare token as a YouTube video id", () => {
    expect(normalizeEmbedVideoUrl("dQw4w9WgXcQ")).toBe(embed);
  });

  it("passes non-YouTube http(s) URLs through", () => {
    expect(normalizeEmbedVideoUrl("https://vimeo.com/123")).toBe(
      "https://vimeo.com/123",
    );
  });

  it("returns null for blank input", () => {
    expect(normalizeEmbedVideoUrl("")).toBeNull();
    expect(normalizeEmbedVideoUrl(undefined)).toBeNull();
  });
});

describe("normalizeExternalLinkUrl", () => {
  it("keeps absolute URLs and adds https to wikipedia host-only input", () => {
    expect(normalizeExternalLinkUrl("https://example.com/a")).toBe(
      "https://example.com/a",
    );
    expect(normalizeExternalLinkUrl("vi.wikipedia.org/wiki/Hà_Nội")).toBe(
      "https://vi.wikipedia.org/wiki/Hà_Nội",
    );
  });

  it("turns a bare article name into an encoded English Wikipedia URL", () => {
    expect(normalizeExternalLinkUrl("Apollo 11")).toBe(
      "https://en.wikipedia.org/wiki/Apollo_11",
    );
    expect(normalizeExternalLinkUrl("wiki/Điện Biên Phủ")).toBe(
      `https://en.wikipedia.org/wiki/${encodeURIComponent("Điện_Biên_Phủ")}`,
    );
  });

  it("returns null for blank input", () => {
    expect(normalizeExternalLinkUrl("  ")).toBeNull();
  });
});

describe("withAlpha", () => {
  it("expands 3- and 6-digit hex into rgba", () => {
    expect(withAlpha("#f00", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
    expect(withAlpha(" #3B82F6 ", 1)).toBe("rgba(59, 130, 246, 1)");
  });

  it("clamps alpha into [0, 1]", () => {
    expect(withAlpha("#000000", 2)).toBe("rgba(0, 0, 0, 1)");
    expect(withAlpha("#000000", -1)).toBe("rgba(0, 0, 0, 0)");
  });

  it("returns non-hex colors unchanged (trimmed)", () => {
    expect(withAlpha(" red ", 0.5)).toBe("red");
    expect(withAlpha("#12345", 0.5)).toBe("#12345");
  });
});
