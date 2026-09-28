/** Plain, inline-styled transactional emails. Every interpolated value is HTML-escaped. */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface Rendered {
  subject: string;
  html: string;
  text: string;
}

function layout({
  heading,
  body,
  cta,
  footer,
}: {
  heading: string;
  body: string;
  cta: { label: string; url: string };
  footer?: string;
}): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#171717">
  <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
    <tr><td>
      <p style="margin:0 0 24px;font-weight:600;font-size:14px;letter-spacing:.02em">PhotoSheet</p>
      <h1 style="margin:0 0 16px;font-size:20px">${heading}</h1>
      <div style="font-size:15px;line-height:1.6">${body}</div>
      <p style="margin:28px 0">
        <a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${escapeHtml(cta.label)}</a>
      </p>
      <p style="font-size:12px;color:#737373;word-break:break-all">Or paste this link into your browser: ${escapeHtml(cta.url)}</p>
      ${footer ? `<p style="font-size:12px;color:#737373">${footer}</p>` : ""}
    </td></tr>
  </table>
</body></html>`;
}

export function magicLinkEmail({ url }: { url: string }): Rendered {
  return {
    subject: "Your PhotoSheet sign-in link",
    html: layout({
      heading: "Sign in to PhotoSheet",
      body: "<p>Click the button below to sign in. This link expires in 10 minutes and can only be used once.</p>",
      cta: { label: "Sign in", url },
      footer: "If you didn't request this, you can safely ignore this email.",
    }),
    text: `Sign in to PhotoSheet: ${url}\n\nThis link expires in 10 minutes. If you didn't request it, ignore this email.`,
  };
}

export function passwordResetEmail({ url }: { url: string }): Rendered {
  return {
    subject: "Reset your PhotoSheet password",
    html: layout({
      heading: "Reset your password",
      body: "<p>We received a request to reset your password. This link expires in 1 hour.</p>",
      cta: { label: "Choose a new password", url },
      footer:
        "If you didn't request a reset, you can ignore this email — your password won't change.",
    }),
    text: `Reset your PhotoSheet password: ${url}\n\nThis link expires in 1 hour. If you didn't request it, ignore this email.`,
  };
}

export function invitationEmail({
  orgName,
  inviterName,
  role,
  url,
}: {
  orgName: string;
  inviterName: string;
  role: string;
  url: string;
}): Rendered {
  return {
    subject: `${inviterName} invited you to ${orgName} on PhotoSheet`,
    html: layout({
      heading: `Join ${escapeHtml(orgName)} on PhotoSheet`,
      body: `<p>${escapeHtml(inviterName)} has invited you to join <strong>${escapeHtml(orgName)}</strong> as ${escapeHtml(role === "admin" || role === "editor" ? `an ${role}` : `a ${role}`)}.</p>`,
      cta: { label: "Accept invitation", url },
      footer: "This invitation expires in 7 days.",
    }),
    text: `${inviterName} invited you to join ${orgName} on PhotoSheet as ${role}.\n\nAccept: ${url}\n\nThis invitation expires in 7 days.`,
  };
}

export function shareEmail({
  senderName,
  orgName,
  targetName,
  message,
  url,
  expiresAt,
}: {
  senderName: string;
  orgName: string;
  targetName: string;
  message?: string | null;
  url: string;
  expiresAt?: Date | null;
}): Rendered {
  const expiry = expiresAt
    ? `This link expires on ${expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`
    : undefined;
  const note = message?.trim()
    ? `<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #d4d4d4;color:#404040;white-space:pre-wrap">${escapeHtml(message.trim())}</blockquote>`
    : "";
  return {
    subject: `${senderName} shared "${targetName}" with you`,
    html: layout({
      heading: `${escapeHtml(senderName)} shared photos with you`,
      body: `<p>${escapeHtml(senderName)} from ${escapeHtml(orgName)} shared <strong>${escapeHtml(targetName)}</strong> with you.</p>${note}`,
      cta: { label: "View photos", url },
      footer: expiry,
    }),
    text: `${senderName} from ${orgName} shared "${targetName}" with you.\n\n${message?.trim() ? `${message.trim()}\n\n` : ""}View: ${url}${expiry ? `\n\n${expiry}` : ""}`,
  };
}

export function boardSharedInternallyEmail({
  senderName,
  boardName,
  url,
}: {
  senderName: string;
  boardName: string;
  url: string;
}): Rendered {
  return {
    subject: `${senderName} shared the board "${boardName}" with you`,
    html: layout({
      heading: `You now have access to "${escapeHtml(boardName)}"`,
      body: `<p>${escapeHtml(senderName)} shared the board <strong>${escapeHtml(boardName)}</strong> with you on PhotoSheet.</p>`,
      cta: { label: "Open board", url },
    }),
    text: `${senderName} shared the board "${boardName}" with you on PhotoSheet.\n\nOpen: ${url}`,
  };
}
