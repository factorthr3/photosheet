import { describe, expect, it } from "vitest";
import {
  createShareSchema,
  expiryFromDate,
  generateShareToken,
  isUnlocked,
  shareState,
  unlockCookieValue,
} from "./shares";

describe("share tokens", () => {
  it("are at least 128 bits of URL-safe randomness", () => {
    const tokens = new Set(Array.from({ length: 1000 }, generateShareToken));
    expect(tokens.size).toBe(1000);
    for (const t of tokens) {
      expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/);
      expect(Buffer.from(t, "base64url").length * 8).toBeGreaterThanOrEqual(128);
    }
  });
});

describe("shareState", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  it("reports revoked, expired and active", () => {
    expect(shareState({ revokedAt: now, expiresAt: null }, now)).toBe("revoked");
    expect(shareState({ revokedAt: null, expiresAt: new Date("2026-09-28T11:00:00Z") }, now)).toBe(
      "expired",
    );
    expect(shareState({ revokedAt: null, expiresAt: new Date("2026-10-01T00:00:00Z") }, now)).toBe(
      "active",
    );
    expect(shareState({ revokedAt: null, expiresAt: null }, now)).toBe("active");
  });
});

describe("expiryFromDate", () => {
  it("keeps the link working through the chosen day", () => {
    expect(expiryFromDate("2026-10-31")?.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(expiryFromDate(null)).toBeNull();
  });
});

describe("unlock cookie", () => {
  const link = { id: "0192f3c4-aaaa-7bbb-8ccc-123456789abc", passwordHash: "hash-1" };
  it("accepts the right value and rejects others", () => {
    const value = unlockCookieValue(link);
    expect(isUnlocked(link, value)).toBe(true);
    expect(isUnlocked(link, undefined)).toBe(false);
    expect(isUnlocked(link, value.slice(0, -1) + "x")).toBe(false);
  });
  it("is invalidated when the password changes", () => {
    const value = unlockCookieValue(link);
    expect(isUnlocked({ ...link, passwordHash: "hash-2" }, value)).toBe(false);
  });
  it("always passes when there's no password", () => {
    expect(isUnlocked({ ...link, passwordHash: null }, undefined)).toBe(true);
  });
});

describe("createShareSchema", () => {
  it("normalises optional text and defaults", () => {
    const d = createShareSchema.parse({
      targetType: "board",
      targetId: "b1",
      title: "  ",
      password: null,
    });
    expect(d).toMatchObject({
      title: null,
      allowDownload: true,
      allowOriginal: false,
      allowedPresetIds: [],
    });
  });
  it("rejects a short password", () => {
    expect(() =>
      createShareSchema.parse({ targetType: "image", targetId: "i", password: "abc" }),
    ).toThrow();
  });
});
