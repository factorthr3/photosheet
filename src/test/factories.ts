import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** Minimal DB fixtures for integration tests. Everything hangs off one org for easy cleanup. */
export async function createOrg(name = "Test Org") {
  const id = randomUUID();
  return prisma.organization.create({
    data: { id, name, slug: `test-${id.slice(0, 8)}`, createdAt: new Date() },
  });
}

export async function createUser(email = `${randomUUID()}@example.test`, name = "Test User") {
  return prisma.user.create({ data: { id: randomUUID(), email, name } });
}

export async function addMember(orgId: string, userId: string, role: string) {
  return prisma.member.create({
    data: { id: randomUUID(), organizationId: orgId, userId, role, createdAt: new Date() },
  });
}

export async function createImage(
  orgId: string,
  data: Partial<Prisma.ImageUncheckedCreateInput> = {},
) {
  const id = data.id ?? randomUUID();
  return prisma.image.create({
    data: {
      id,
      orgId,
      filename: `${id.slice(0, 8)}.jpg`,
      storageKey: `orgs/${orgId}/images/${id}/original`,
      mimeType: "image/jpeg",
      bytes: 1000,
      width: 400,
      height: 300,
      status: "READY",
      ...data,
    },
  });
}

export async function deleteOrg(orgId: string) {
  await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
}
