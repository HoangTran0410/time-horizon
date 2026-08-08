import { describe, expect, it, vi as vitest } from "vitest";
import {
  ensureMessagesLoaded,
  getFallbackMessages,
  getMessages,
  getMessagesVersion,
  subscribeToMessages,
} from "./messages";

// One module-level registry, so these run in order on purpose: the first
// assertion is only meaningful before anything has been fetched.
describe("message loading", () => {
  it("keeps every non-default language out of the entry chunk", async () => {
    expect(getMessages("vi")).toBeDefined();
    expect(getMessages("en")).toBeUndefined();

    const versionBefore = getMessagesVersion();
    let notifications = 0;
    const unsubscribe = subscribeToMessages(() => {
      notifications += 1;
    });

    // Called on every render in the real hook; must only ever fetch once.
    ensureMessagesLoaded("en");
    ensureMessagesLoaded("en");

    await vitest.waitFor(() => {
      expect(getMessages("en")).toBeDefined();
    });
    unsubscribe();

    expect(notifications).toBe(1);
    expect(getMessagesVersion()).toBe(versionBefore + 1);
    expect(getMessages("en")?.enterTimeline).toBeTypeOf("string");
  });

  it("does not refetch a language it already holds", () => {
    const versionBefore = getMessagesVersion();
    ensureMessagesLoaded("en");
    ensureMessagesLoaded("vi");
    expect(getMessagesVersion()).toBe(versionBefore);
  });

  it("falls back to the bundled language, which is always present", () => {
    expect(getFallbackMessages()).toBe(getMessages("vi"));
  });
});
