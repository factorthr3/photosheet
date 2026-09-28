import { describe, expect, it } from "vitest";
import { sanitizeFilename } from "./filename";

describe("sanitizeFilename", () => {
  it("strips directories and control characters", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("C:\\Users\\me\\IMG_1.JPG")).toBe("IMG_1.JPG");
    expect(sanitizeFilename("bad\u0000name\n.jpg")).toBe("badname.jpg");
  });
  it("falls back for empty names", () => {
    expect(sanitizeFilename("   ")).toBe("untitled");
    expect(sanitizeFilename("..")).toBe("untitled");
  });
  it("truncates long names but keeps the extension", () => {
    const out = sanitizeFilename(`${"a".repeat(300)}.jpeg`);
    expect(out.length).toBe(200);
    expect(out.endsWith(".jpeg")).toBe(true);
  });
});
