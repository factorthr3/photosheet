import "server-only";
import { prisma } from "@/lib/db";

/** Pending, unexpired invitations addressed to `email`. */
export function pendingInvitationsFor(email: string) {
  return prisma.invitation.findMany({
    where: {
      email: { equals: email, mode: "insensitive" },
      status: "pending",
      expiresAt: { gt: new Date() },
    },
    include: {
      organization: { select: { name: true, slug: true } },
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
