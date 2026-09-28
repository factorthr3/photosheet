import { describe, expect, it } from "vitest";
import { licenceLabel, licenceState } from "./licence";

const now = new Date("2026-09-28T12:00:00Z");

describe("licenceState", () => {
  it("flags expired licences regardless of type", () => {
    expect(licenceState("unlimited", "2026-09-01", now)).toBe("expired");
    expect(licenceState(null, new Date("2026-09-28T11:59:59Z"), now)).toBe("expired");
  });
  it("warns 30 days ahead", () => {
    expect(licenceState("press", "2026-10-20", now)).toBe("expiring");
    expect(licenceState("press", "2026-12-20", now)).toBe("restricted");
  });
  it("treats anything but unlimited as restricted", () => {
    expect(licenceState("internal", null, now)).toBe("restricted");
    expect(licenceState("Client X only", null, now)).toBe("restricted");
    expect(licenceState("unlimited", null, now)).toBe("ok");
    expect(licenceState(null, null, now)).toBe("none");
  });
});

describe("licenceLabel", () => {
  it("maps presets and passes custom text through", () => {
    expect(licenceLabel("press")).toBe("Press use");
    expect(licenceLabel("Client X only")).toBe("Client X only");
    expect(licenceLabel(null)).toBeNull();
  });
});
