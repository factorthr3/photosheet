import { describe, expect, it } from "vitest";
import { describeEvent } from "./activity-describe";

const e = (action: string, meta: Record<string, unknown> = {}) => ({
  action,
  targetType: "x",
  targetId: null,
  meta,
});

describe("describeEvent", () => {
  it("describes common events", () => {
    expect(describeEvent(e("image.upload", { filename: "a.jpg" }))).toBe("uploaded “a.jpg”");
    expect(
      describeEvent(e("member.role_change", { email: "a@b.c", from: "viewer", to: "editor" })),
    ).toBe("changed a@b.c from viewer to editor");
    expect(describeEvent(e("image.trash", { count: 1, filenames: ["x.jpg"] }))).toBe(
      "moved “x.jpg” to trash",
    );
    expect(describeEvent(e("image.trash", { count: 3, filenames: ["x.jpg"] }))).toBe(
      "moved 3 images to trash",
    );
    expect(describeEvent(e("export.zip", { images: 12, variant: "Web large" }))).toBe(
      "downloaded a ZIP of 12 images (Web large)",
    );
    expect(
      describeEvent(e("image.download", { via: "share", filename: "b.jpg", variant: "Original" })),
    ).toBe("downloaded via a shared link “b.jpg” (Original)");
    expect(describeEvent(e("share.email", { recipients: 1 }))).toBe(
      "emailed a public link to 1 person",
    );
  });

  it("falls back to the raw action", () => {
    expect(describeEvent(e("something.new"))).toBe("something.new");
  });
});
