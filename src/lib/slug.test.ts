import { describe, expect, it } from "vitest";
import { isValidSlug, slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Acme Photo Co.")).toBe("acme-photo-co");
  });
  it("strips accents and trims hyphens", () => {
    expect(slugify("  Café Société!! ")).toBe("cafe-societe");
  });
  it("caps length at 48 without a trailing hyphen", () => {
    const s = slugify(`${"a".repeat(47)} b`);
    expect(s.length).toBeLessThanOrEqual(48);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("isValidSlug", () => {
  it("accepts simple slugs", () => {
    expect(isValidSlug("acme")).toBe(true);
    expect(isValidSlug("acme-photo-2")).toBe(true);
  });
  it("rejects bad slugs", () => {
    expect(isValidSlug("a")).toBe(false);
    expect(isValidSlug("-acme")).toBe(false);
    expect(isValidSlug("Acme")).toBe(false);
    expect(isValidSlug("acme_co")).toBe(false);
  });
});
