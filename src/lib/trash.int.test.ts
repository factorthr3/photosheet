import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { addMember, createImage, createOrg, createUser, deleteOrg } from "@/test/factories";

// Storage calls are exercised manually against MinIO; here we only check DB behaviour.
vi.mock("@/lib/storage", async (orig) => ({
  ...(await orig<typeof import("@/lib/storage")>()),
  deletePrefix: vi.fn(async () => {}),
  deleteObjects: vi.fn(async () => {}),
}));

const { cleanupStaleUploads, daysLeftInTrash, purgeImages, restoreImages, trashImages } =
  await import("./trash");

let orgId: string;
let editor: string;
let otherEditor: string;
let admin: string;
const img: Record<string, string> = {};

beforeAll(async () => {
  orgId = (await createOrg()).id;
  editor = (await createUser()).id;
  otherEditor = (await createUser()).id;
  admin = (await createUser()).id;
  await addMember(orgId, editor, "editor");
  await addMember(orgId, otherEditor, "editor");
  await addMember(orgId, admin, "admin");
  img.mine = (await createImage(orgId, { uploaderId: editor })).id;
  img.theirs = (await createImage(orgId, { uploaderId: otherEditor })).id;
  img.old = (
    await createImage(orgId, {
      uploaderId: editor,
      deletedAt: new Date(Date.now() - 31 * 86_400_000),
    })
  ).id;
  img.stale = (
    await createImage(orgId, {
      status: "UPLOADING",
      createdAt: new Date(Date.now() - 2 * 86_400_000),
    })
  ).id;
  img.fresh = (await createImage(orgId, { status: "UPLOADING" })).id;
});

afterAll(async () => {
  await deleteOrg(orgId);
  await prisma.user.deleteMany({ where: { id: { in: [editor, otherEditor, admin] } } });
});

const get = (id: string) => prisma.image.findUnique({ where: { id } });

describe("trash", () => {
  it("lets editors trash only their own uploads", async () => {
    const r = await trashImages({ orgId, userId: editor, role: "editor" }, [img.mine, img.theirs]);
    expect(r.trashed.map((t) => t.id)).toEqual([img.mine]);
    expect(r.skipped).toBe(1);
    expect((await get(img.theirs))?.deletedAt).toBeNull();
    expect((await get(img.mine))?.deletedById).toBe(editor);
  });

  it("lets admins trash and restore anything", async () => {
    await trashImages({ orgId, userId: admin, role: "admin" }, [img.theirs]);
    expect((await get(img.theirs))?.deletedAt).not.toBeNull();
    const r = await restoreImages({ orgId, userId: admin, role: "admin" }, [img.theirs]);
    expect(r.restored).toHaveLength(1);
    expect((await get(img.theirs))?.deletedAt).toBeNull();
  });

  it("purges only trashed images past retention when asked to", async () => {
    const purged = await purgeImages({
      orgId,
      deletedBefore: new Date(Date.now() - 30 * 86_400_000),
    });
    expect(purged.map((p) => p.id)).toEqual([img.old]);
    expect(await get(img.old)).toBeNull();
    expect(await get(img.mine)).not.toBeNull(); // trashed today: kept
  });

  it("never purges live images, even by id", async () => {
    expect(await purgeImages({ orgId, ids: [img.theirs] })).toHaveLength(0);
    expect(await get(img.theirs)).not.toBeNull();
  });

  it("cleans up abandoned uploads older than a day", async () => {
    expect(await cleanupStaleUploads()).toBeGreaterThanOrEqual(1);
    expect(await get(img.stale)).toBeNull();
    expect(await get(img.fresh)).not.toBeNull();
  });

  it("counts days left in trash", () => {
    const now = new Date("2026-09-28T00:00:00Z");
    expect(daysLeftInTrash(new Date("2026-09-28T00:00:00Z"), now)).toBe(30);
    expect(daysLeftInTrash(new Date("2026-08-01T00:00:00Z"), now)).toBe(0);
  });
});
