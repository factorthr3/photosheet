import { describe, expect, it } from "vitest";
import { MAX_TAGS, normalizeTag, normalizeTags, parseTagInput } from "./tags";

describe("tags", () => {
  it("normalises case, whitespace and leading #", () => {
    expect(normalizeTag("  #Summer   Campaign ")).toBe("summer campaign");
  });
  it("de-duplicates and drops empties", () => {
    expect(normalizeTags(["Beach", "beach", " ", "BEACH ", "city"])).toEqual(["beach", "city"]);
  });
  it("caps the number of tags", () => {
    expect(normalizeTags(Array.from({ length: 80 }, (_, i) => `t${i}`))).toHaveLength(MAX_TAGS);
  });
  it("splits free text on commas, semicolons and newlines", () => {
    expect(parseTagInput("beach, Summer;sunset\nbeach")).toEqual(["beach", "summer", "sunset"]);
  });
});
