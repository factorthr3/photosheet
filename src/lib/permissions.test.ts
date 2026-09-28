import { describe, expect, it } from "vitest";
import { can, canAssignRole, isRole, ROLES } from "./permissions";

describe("can", () => {
  it("lets viewers browse, download and resize only", () => {
    expect(can("viewer", "image:view")).toBe(true);
    expect(can("viewer", "image:download")).toBe(true);
    expect(can("viewer", "image:resize")).toBe(true);
    expect(can("viewer", "image:upload")).toBe(false);
    expect(can("viewer", "image:edit")).toBe(false);
    expect(can("viewer", "board:edit")).toBe(false);
    expect(can("viewer", "share:create")).toBe(false);
  });

  it("lets editors upload, edit, manage boards and share", () => {
    for (const cap of ["image:upload", "image:edit", "board:edit", "share:create"] as const) {
      expect(can("editor", cap)).toBe(true);
    }
    expect(can("editor", "image:delete:own")).toBe(true);
    expect(can("editor", "image:delete:any")).toBe(false);
    expect(can("editor", "member:manage")).toBe(false);
  });

  it("lets admins manage members and all images but not org settings", () => {
    expect(can("admin", "member:manage")).toBe(true);
    expect(can("admin", "image:delete:any")).toBe(true);
    expect(can("admin", "audit:view")).toBe(true);
    expect(can("admin", "org:settings")).toBe(false);
  });

  it("gives owners everything", () => {
    expect(can("owner", "org:settings")).toBe(true);
    expect(can("owner", "org:delete")).toBe(true);
    expect(can("owner", "member:manage")).toBe(true);
  });

  it("denies when there is no role", () => {
    expect(can(null, "image:view")).toBe(false);
    expect(can(undefined, "image:view")).toBe(false);
  });

  it("is monotonic: a higher role can do everything a lower one can", () => {
    const caps = [
      "image:view",
      "image:upload",
      "image:delete:any",
      "member:manage",
      "org:settings",
    ] as const;
    for (let i = 1; i < ROLES.length; i++) {
      const higher = ROLES[i - 1];
      const lower = ROLES[i];
      for (const cap of caps) {
        if (can(lower, cap)) expect(can(higher, cap)).toBe(true);
      }
    }
  });
});

describe("canAssignRole", () => {
  it("only lets owners grant ownership", () => {
    expect(canAssignRole("owner", "owner")).toBe(true);
    expect(canAssignRole("admin", "owner")).toBe(false);
  });

  it("lets admins assign non-owner roles", () => {
    expect(canAssignRole("admin", "editor")).toBe(true);
    expect(canAssignRole("admin", "viewer")).toBe(true);
    expect(canAssignRole("admin", "admin")).toBe(true);
  });

  it("stops editors and viewers assigning roles", () => {
    expect(canAssignRole("editor", "viewer")).toBe(false);
    expect(canAssignRole("viewer", "viewer")).toBe(false);
  });
});

describe("isRole", () => {
  it("accepts known roles and rejects everything else", () => {
    expect(isRole("editor")).toBe(true);
    expect(isRole("member")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});
