import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { magicLink, organization } from "better-auth/plugins";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { invitationEmail, magicLinkEmail, passwordResetEmail } from "@/lib/email-templates";
import { ac, roles } from "./roles";

const appUrl = process.env.APP_URL ?? "http://localhost:3000";

export const INVITATION_TTL_SECONDS = 60 * 60 * 24 * 7;

export const auth = betterAuth({
  appName: "PhotoSheet",
  baseURL: appUrl,
  secret: process.env.AUTH_SECRET,
  trustedOrigins: [appUrl],
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({ to: user.email, ...passwordResetEmail({ url }) });
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },

  // Brute-force protection on the auth endpoints. Stored in Postgres so limits hold across
  // restarts and instances.
  rateLimit: {
    enabled: process.env.AUTH_RATE_LIMIT !== "off",
    storage: "database",
    window: 60,
    max: 120,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 10 },
      "/sign-in/magic-link": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 5 },
      "/reset-password": { window: 60, max: 10 },
    },
  },

  plugins: [
    organization({
      ac,
      roles,
      creatorRole: "owner",
      invitationExpiresIn: INVITATION_TTL_SECONDS,
      cancelPendingInvitationsOnReInvite: true,
      sendInvitationEmail: async ({ id, email, role, organization, inviter }) => {
        await sendEmail({
          to: email,
          ...invitationEmail({
            orgName: organization.name,
            inviterName: inviter.user.name || inviter.user.email,
            role,
            url: `${appUrl}/invite/${id}`,
          }),
        });
      },
      organizationHooks: {
        afterCreateOrganization: async ({ organization, user }) => {
          await recordAudit({
            orgId: organization.id,
            userId: user.id,
            action: "org.create",
            targetType: "organization",
            targetId: organization.id,
            meta: { name: organization.name },
          });
        },
        afterAcceptInvitation: async ({ invitation, member, user, organization }) => {
          await recordAudit({
            orgId: organization.id,
            userId: user.id,
            action: "member.join",
            targetType: "member",
            targetId: member.id,
            meta: { email: user.email, role: member.role, invitationId: invitation.id },
          });
        },
      },
    }),
    magicLink({
      expiresIn: 60 * 10,
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({ to: email, ...magicLinkEmail({ url }) });
      },
    }),
    // Must stay last: lets server actions set auth cookies.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
