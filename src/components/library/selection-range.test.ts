import { describe, expect, it } from "vitest";

// Selection range logic is exercised end-to-end in Playwright; this guards the pure helper.
import { rangeBetween } from "./selection-range";

describe("rangeBetween", () => {
  const ids = ["a", "b", "c", "d", "e"];
  it("returns the inclusive range in either direction", () => {
    expect(rangeBetween(ids, "b", "d")).toEqual(["b", "c", "d"]);
    expect(rangeBetween(ids, "d", "b")).toEqual(["b", "c", "d"]);
  });
  it("returns just the target when the anchor is missing", () => {
    expect(rangeBetween(ids, "z", "c")).toEqual(["c"]);
  });
});
