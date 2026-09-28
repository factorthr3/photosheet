import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createImage, createOrg, deleteOrg } from "@/test/factories";
import {
  buildOrderBy,
  buildWhere,
  cursorWhere,
  decodeCursor,
  encodeCursor,
  parseFilters,
  SORTS,
  type Sort,
} from "./query";

let orgId: string;
let otherOrgId: string;

beforeAll(async () => {
  orgId = (await createOrg()).id;
  otherOrgId = (await createOrg("Other")).id;
  const base = new Date("2026-01-01T00:00:00Z").getTime();
  // 23 images with deliberate ties in createdAt/takenAt/filename and some missing takenAt.
  for (let i = 0; i < 23; i++) {
    await createImage(orgId, {
      filename: `img-${String(i % 7).padStart(2, "0")}.jpg`,
      createdAt: new Date(base + Math.floor(i / 3) * 60_000),
      takenAt: i % 4 === 0 ? null : new Date(base - (i % 5) * 86_400_000),
      width: i % 3 === 0 ? 300 : 400,
      height: i % 3 === 0 ? 400 : 300,
      tags: i % 2 ? ["beach", "summer"] : ["city"],
    });
  }
  await createImage(orgId, { deletedAt: new Date() }); // trashed
  await createImage(orgId, { status: "UPLOADING" }); // incomplete
  await createImage(otherOrgId); // other org
});

afterAll(async () => {
  await deleteOrg(orgId);
  await deleteOrg(otherOrgId);
});

async function pageThrough(sort: Sort, pageSize: number) {
  const filters = parseFilters({ sort });
  const ids: string[] = [];
  let cursor: string | undefined;
  for (let guard = 0; guard < 50; guard++) {
    const values = cursor ? decodeCursor(sort, cursor) : null;
    const where = buildWhere(orgId, filters);
    const rows = await prisma.image.findMany({
      where: values ? { AND: [where, cursorWhere(sort, values)] } : where,
      orderBy: buildOrderBy(sort),
      take: pageSize,
    });
    ids.push(...rows.map((r) => r.id));
    if (rows.length < pageSize) break;
    cursor = encodeCursor(sort, rows[rows.length - 1]);
  }
  return ids;
}

describe("keyset pagination", () => {
  it.each(SORTS)("returns every row exactly once, in order, for %s", async (sort) => {
    const all = await prisma.image.findMany({
      where: buildWhere(orgId, parseFilters({ sort })),
      orderBy: buildOrderBy(sort),
    });
    expect(all).toHaveLength(23);
    for (const pageSize of [1, 4, 10]) {
      expect(await pageThrough(sort, pageSize)).toEqual(all.map((r) => r.id));
    }
  });
});

describe("filters", () => {
  it("filters by orientation using column comparison", async () => {
    const portrait = await prisma.image.count({
      where: buildWhere(orgId, parseFilters({ orientation: "portrait" })),
    });
    const landscape = await prisma.image.count({
      where: buildWhere(orgId, parseFilters({ orientation: "landscape" })),
    });
    expect(portrait).toBe(8);
    expect(landscape).toBe(15);
  });

  it("filters by tag and search", async () => {
    expect(
      await prisma.image.count({
        where: buildWhere(orgId, parseFilters({ tags: "beach,summer" })),
      }),
    ).toBe(11);
    expect(
      await prisma.image.count({ where: buildWhere(orgId, parseFilters({ q: "IMG-03" })) }),
    ).toBe(3);
    expect(
      await prisma.image.count({ where: buildWhere(orgId, parseFilters({ q: "city" })) }),
    ).toBe(12);
  });
});
