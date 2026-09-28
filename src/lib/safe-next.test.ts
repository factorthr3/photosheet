import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps relative paths", () => {
    expect(safeNext("/o/acme/library?q=1")).toBe("/o/acme/library?q=1");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeNext("https://evil.com")).toBe("/app");
    expect(safeNext("//evil.com")).toBe("/app");
    expect(safeNext("/\\evil.com")).toBe("/app");
  });

  it("falls back when missing", () => {
    expect(safeNext(undefined)).toBe("/app");
    expect(safeNext(null, "/x")).toBe("/x");
    expect(safeNext(["/a", "/b"])).toBe("/a");
  });
});
