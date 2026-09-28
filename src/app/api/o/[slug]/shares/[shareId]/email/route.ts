import { z } from "zod";
import { HttpError, parseJson, requireOrgApi, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { shareEmail } from "@/lib/email-templates";
import { enforceRateLimit } from "@/lib/rate-limit";
import { shareState, shareUrl } from "@/lib/shares";
import { findManageableShare } from "@/lib/shares-access";

const bodySchema = z.object({
  to: z.array(z.email("One of the addresses isn't valid").trim().toLowerCase()).min(1).max(20),
  message: z.string().trim().max(2000).optional(),
});

/** Email the link (not attachments) to up to 20 recipients. */
export const POST = route(
  async (req: Request, ctx: RouteContext<"/api/o/[slug]/shares/[shareId]/email">) => {
    const { slug, shareId } = await ctx.params;
    const org = await requireOrgApi(req, slug, "share:create");
    const link = await findManageableShare(org, shareId);
    if (shareState(link) !== "active")
      throw new HttpError(409, "This link is no longer active", "inactive");
    const { to, message } = await parseJson(req, bodySchema);
    const recipients = [...new Set(to)];
    await enforceRateLimit(`share-email:${org.user.id}`, 100, 3600);

    const content = shareEmail({
      senderName: org.user.name || org.user.email,
      orgName: org.org.name,
      targetName:
        link.title || link.board?.name || link.image?.title || link.image?.filename || "Photos",
      message: message ?? link.message,
      url: shareUrl(link.token),
      expiresAt: link.expiresAt,
    });
    // One message per recipient so addresses aren't disclosed to each other.
    for (const address of recipients) {
      await sendEmail({ to: address, replyTo: org.user.email, ...content });
    }
    await recordAudit({
      orgId: org.org.id,
      userId: org.user.id,
      action: "share.email",
      targetType: "share",
      targetId: link.id,
      meta: { recipients: recipients.length },
    });
    return Response.json({ sent: recipients.length });
  },
);
