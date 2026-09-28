/**
 * Local dev seed: creates a demo organisation with one user per role.
 *
 *   npm run db:seed
 *
 * All seeded accounts use the password in SEED_PASSWORD (default below — dev only).
 *   owner@example.test · admin@example.test · editor@example.test · viewer@example.test
 */
import "dotenv/config";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const PASSWORD = process.env.SEED_PASSWORD ?? "photosheet-dev-only";
const ORG = { name: "Demo Studio", slug: "demo-studio" };
const USERS = [
  { email: "owner@example.test", name: "Olive Owner", role: "owner" },
  { email: "admin@example.test", name: "Ada Admin", role: "admin" },
  { email: "editor@example.test", name: "Eddie Editor", role: "editor" },
  { email: "viewer@example.test", name: "Vera Viewer", role: "viewer" },
] as const;

async function ensureUser(email: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing.id;
  const res = await auth.api.signUpEmail({ body: { email, name, password: PASSWORD } });
  return res.user.id;
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed in production");

  const ids = new Map<string, string>();
  for (const u of USERS) ids.set(u.email, await ensureUser(u.email, u.name));

  let org = await prisma.organization.findUnique({ where: { slug: ORG.slug } });
  if (!org) {
    const created = await auth.api.createOrganization({
      body: { ...ORG, userId: ids.get(USERS[0].email)! },
    });
    org = await prisma.organization.findUniqueOrThrow({ where: { id: created!.id } });
  }

  for (const u of USERS.slice(1)) {
    const userId = ids.get(u.email)!;
    const member = await prisma.member.findFirst({ where: { organizationId: org.id, userId } });
    if (!member) {
      await auth.api.addMember({ body: { userId, organizationId: org.id, role: u.role } });
    }
  }

  console.log(`Seeded ${ORG.name} (/o/${ORG.slug}) with ${USERS.length} users.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
