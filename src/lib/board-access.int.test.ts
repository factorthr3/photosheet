import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { addMember, createOrg, createUser, deleteOrg } from "@/test/factories";
import { type BoardViewer, getBoard, listBoards } from "./boards";

let orgId: string;
let otherOrgId: string;
const u: Record<string, string> = {};
let orgBoard: string;
let privateBoard: string;
let foreignBoard: string;

beforeAll(async () => {
  orgId = (await createOrg()).id;
  otherOrgId = (await createOrg("Other")).id;
  for (const name of ["creator", "member", "outsider", "admin"]) {
    u[name] = (await createUser()).id;
    await addMember(orgId, u[name], name === "admin" ? "admin" : "editor");
  }
  orgBoard = (await prisma.board.create({ data: { orgId, name: "Open", createdById: u.creator } }))
    .id;
  privateBoard = (
    await prisma.board.create({
      data: { orgId, name: "Private", visibility: "PRIVATE", createdById: u.creator },
    })
  ).id;
  await prisma.boardMember.create({ data: { boardId: privateBoard, userId: u.member } });
  foreignBoard = (await prisma.board.create({ data: { orgId: otherOrgId, name: "Theirs" } })).id;
});

afterAll(async () => {
  await deleteOrg(orgId);
  await deleteOrg(otherOrgId);
  await prisma.user.deleteMany({ where: { id: { in: Object.values(u) } } });
});

const viewer = (who: string, role: BoardViewer["role"] = "editor"): BoardViewer => ({
  orgId,
  userId: u[who],
  role,
});
const ids = async (v: BoardViewer) => (await listBoards(v)).map((b) => b.id).sort();

describe("board visibility", () => {
  it("shows private boards only to their creator, members and admins", async () => {
    expect(await ids(viewer("creator"))).toEqual([orgBoard, privateBoard].sort());
    expect(await ids(viewer("member"))).toEqual([orgBoard, privateBoard].sort());
    expect(await ids(viewer("outsider"))).toEqual([orgBoard]);
    expect(await ids(viewer("admin", "admin"))).toEqual([orgBoard, privateBoard].sort());
  });

  it("404s a private board for outsiders and any board from another org", async () => {
    await expect(getBoard(viewer("outsider"), privateBoard)).rejects.toMatchObject({ status: 404 });
    await expect(getBoard(viewer("creator"), foreignBoard)).rejects.toMatchObject({ status: 404 });
    await expect(getBoard(viewer("admin", "admin"), foreignBoard)).rejects.toMatchObject({
      status: 404,
    });
    expect((await getBoard(viewer("member"), privateBoard)).id).toBe(privateBoard);
  });
});
