import { describe, expect, it } from "vitest";
import { formatBytes, formatDate } from "./format";

describe("formatBytes", () => {
  it("formats across units", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(50 * 1024 * 1024)).toBe("50 MB");
    expect(formatBytes(BigInt(3 * 1024 ** 3))).toBe("3.0 GB");
    expect(formatBytes(null)).toBe("—");
  });
});

describe("formatDate", () => {
  it("formats in en-GB", () => {
    expect(formatDate("2026-09-28T12:00:00Z")).toBe("28 Sept 2026");
  });
});
