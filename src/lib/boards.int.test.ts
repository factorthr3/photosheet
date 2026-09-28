import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { parseFilters } from "@/lib/images/filters";
import { createImage, createOrg, deleteOrg } from "@/test/factories";
import {
  addImagesToBoard,
  listBoardImages,
  listBoards,
  moveIds,
  removeImagesFromBoard,
  reorderBoard,
} from "./boards";

describe("moveIds", () => {
  const order = ["a", "b", "c", "d", "e"];
  it("moves before a target", () => {
    expect(moveIds(order, ["e"], { beforeId: "b" })).toEqual(["a", "e", "b", "c", "d"]);
  });
  it("moves after a target", () => {
    expect(moveIds(order, ["a"], { afterId: "c" })).toEqual(["b", "c", "a", "d", "e"]);
  });
  it("moves several, keeping the given order", () => {
    expect(moveIds(order, ["d", "b"], { beforeId: "a" })).toEqual(["d", "b", "a", "c", "e"]);
  });
  it("moves to the end with no target", () => {
    expect(moveIds(order, ["a", "b"], {})).toEqual(["c", "d", "e", "a", "b"]);
  });
  it("ignores ids that aren't on the board and targets that are moving", () => {
    expect(moveIds(order, ["zz", "c"], { beforeId: "c" })).toEqual(["a", "b", "d", "e", "c"]);
  });
});

describe("board operations", () => {
  let orgId: string;
  let otherOrgId: string;
  let boardId: string;
  const ids: string[] = [];
  let foreignImageId: string;

  const order = async () =>
    (await prisma.boardImage.findMany({ where: { boardId }, orderBy: { position: "asc" } })).map(
      (r) => [r.imageId, r.position] as const,
    );

  beforeAll(async () => {
    orgId = (await createOrg()).id;
    otherOrgId = (await createOrg("Other")).id;
    for (let i = 0; i < 5; i++) ids.push((await createImage(orgId, { filename: `b-${i}.jpg` })).id);
    foreignImageId = (await createImage(otherOrgId)).id;
    boardId = (await prisma.board.create({ data: { orgId, name: "Campaign" } })).id;
  });

  afterAll(async () => {
    await deleteOrg(orgId);
    await deleteOrg(otherOrgId);
  });

  it("adds images in order, ignoring duplicates and other orgs' images", async () => {
    expect(await addImagesToBoard(orgId, boardId, [ids[0], ids[1], foreignImageId])).toBe(2);
    expect(await addImagesToBoard(orgId, boardId, [ids[1], ids[2], ids[3], ids[4]])).toBe(3);
    expect(await order()).toEqual(ids.map((id, i) => [id, i]));
  });

  it("an image can be on several boards", async () => {
    const second = await prisma.board.create({ data: { orgId, name: "Second" } });
    expect(await addImagesToBoard(orgId, second.id, [ids[0]])).toBe(1);
    expect(await prisma.boardImage.count({ where: { imageId: ids[0] } })).toBe(2);
  });

  it("reorders and keeps positions dense", async () => {
    await reorderBoard(boardId, [ids[4], ids[3]], { beforeId: ids[0] });
    expect((await order()).map(([id]) => id)).toEqual([ids[4], ids[3], ids[0], ids[1], ids[2]]);
    expect((await order()).map(([, p]) => p)).toEqual([0, 1, 2, 3, 4]);
  });

  it("removes images, renumbers and clears a removed cover", async () => {
    await prisma.board.update({ where: { id: boardId }, data: { coverImageId: ids[3] } });
    expect(await removeImagesFromBoard(boardId, [ids[3], ids[1]])).toBe(2);
    expect(await order()).toEqual([
      [ids[4], 0],
      [ids[0], 1],
      [ids[2], 2],
    ]);
    expect((await prisma.board.findUnique({ where: { id: boardId } }))?.coverImageId).toBeNull();
  });

  it("pages through the manual order", async () => {
    const f = parseFilters({ sort: "manual" });
    const first = await listBoardImages(orgId, boardId, f, { limit: 2 });
    expect(first.total).toBe(3);
    expect(first.images.map((i) => i.id)).toEqual([ids[4], ids[0]]);
    const second = await listBoardImages(orgId, boardId, f, {
      limit: 2,
      cursor: first.nextCursor!,
    });
    expect(second.images.map((i) => i.id)).toEqual([ids[2]]);
    expect(second.nextCursor).toBeNull();
  });

  it("hides trashed images from the board and its count", async () => {
    await prisma.image.update({ where: { id: ids[0] }, data: { deletedAt: new Date() } });
    const page = await listBoardImages(orgId, boardId, parseFilters({ sort: "manual" }));
    expect(page.images.map((i) => i.id)).toEqual([ids[4], ids[2]]);
    const summary = (await listBoards({ orgId, userId: "nobody", role: "admin" })).find(
      (b) => b.id === boardId,
    );
    expect(summary?.imageCount).toBe(2);
  });
});
