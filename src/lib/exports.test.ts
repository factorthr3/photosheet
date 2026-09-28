import { describe, expect, it } from "vitest";
import { exportFilename, uniqueName } from "./exports";

describe("uniqueName", () => {
  it("suffixes duplicates case-insensitively", () => {
    const used = new Set<string>();
    expect(uniqueName("IMG_1.jpg", used)).toBe("IMG_1.jpg");
    expect(uniqueName("img_1.JPG", used)).toBe("img_1-2.JPG");
    expect(uniqueName("IMG_1.jpg", used)).toBe("IMG_1-3.jpg");
    expect(uniqueName("README", used)).toBe("README");
    expect(uniqueName("README", used)).toBe("README-2");
  });
});

describe("exportFilename", () => {
  it("makes a safe, dated name", () => {
    const d = new Date("2026-09-28T10:00:00Z");
    expect(exportFilename("Spring campaign / 2027!", d)).toBe("Spring-campaign-2027-2026-09-28");
    expect(exportFilename("???", d)).toBe("photosheet-2026-09-28");
  });
});
