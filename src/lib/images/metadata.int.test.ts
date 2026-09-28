import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createImage, createOrg, deleteOrg } from "@/test/factories";
import { bulkUpdateSchema, updateImageSchema } from "./metadata";
import { bulkUpdateImages, updateImageMetadata } from "./metadata.server";

let orgId: string;
let otherOrgId: string;
let a: string, b: string, trashed: string, foreign: string;

beforeAll(async () => {
  orgId = (await createOrg()).id;
  otherOrgId = (await createOrg()).id;
  a = (await createImage(orgId, { tags: ["beach", "summer"] })).id;
  b = (await createImage(orgId, { tags: ["city"], credit: "Old credit" })).id;
  trashed = (await createImage(orgId, { deletedAt: new Date(), tags: ["x"] })).id;
  foreign = (await createImage(otherOrgId, { tags: ["theirs"] })).id;
});

afterAll(async () => {
  await deleteOrg(orgId);
  await deleteOrg(otherOrgId);
});

const get = (id: string) => prisma.image.findUniqueOrThrow({ where: { id } });

describe("updateImageMetadata", () => {
  it("normalises tags, clears empty strings and parses expiry dates", async () => {
    const update = updateImageSchema.parse({
      title: "  Hero shot ",
      credit: "",
      tags: ["Beach", "#Sunset", "beach"],
      licence: "press",
      licenceExpiresAt: "2027-01-31",
    });
    expect(await updateImageMetadata(orgId, a, update)).toBe(true);
    const img = await get(a);
    expect(img).toMatchObject({
      title: "Hero shot",
      credit: null,
      licence: "press",
      tags: ["beach", "sunset"],
    });
    expect(img.licenceExpiresAt?.toISOString()).toBe("2027-01-31T00:00:00.000Z");
  });

  it("refuses images from another org", async () => {
    expect(
      await updateImageMetadata(orgId, foreign, updateImageSchema.parse({ title: "hijack" })),
    ).toBe(false);
    expect((await get(foreign)).title).toBeNull();
  });
});

describe("bulkUpdateImages", () => {
  it("adds and removes tags per image, keeping each image's other tags", async () => {
    const body = bulkUpdateSchema.parse({
      imageIds: [a, b, trashed, foreign],
      addTags: ["Campaign 2027", "beach"],
      removeTags: ["sunset"],
      set: { credit: "Jo Photographer" },
    });
    const count = await bulkUpdateImages(orgId, body);
    expect(count).toBe(2);
    expect((await get(a)).tags).toEqual(["beach", "campaign 2027"]);
    expect((await get(b)).tags).toEqual(["city", "campaign 2027", "beach"]);
    expect((await get(b)).credit).toBe("Jo Photographer");
    // trashed and other-org images untouched
    expect((await get(trashed)).tags).toEqual(["x"]);
    expect((await get(foreign)).tags).toEqual(["theirs"]);
    expect((await get(foreign)).credit).toBeNull();
  });

  it("rejects an empty change", () => {
    expect(() => bulkUpdateSchema.parse({ imageIds: [a] })).toThrow(/Nothing to change/);
  });
});
