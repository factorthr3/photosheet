import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";
import { env } from "@/lib/env";

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

const DEFAULT_OUTBOX_DIR = path.join(process.cwd(), ".mail-outbox");

let resend: Resend | undefined;

/**
 * Send an email through Resend. Without RESEND_API_KEY (local dev) the message is written to
 * `.mail-outbox/` as JSON instead, so links can be followed by hand. Setting EMAIL_OUTBOX_DIR
 * forces the outbox even in production builds (used by the e2e suite).
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const { RESEND_API_KEY, EMAIL_FROM, EMAIL_OUTBOX_DIR, NODE_ENV } = env();

  if (RESEND_API_KEY && !EMAIL_OUTBOX_DIR) {
    resend ??= new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo,
    });
    if (error) throw new Error(`Email send failed: ${error.message}`);
    return;
  }

  if (NODE_ENV === "production" && !EMAIL_OUTBOX_DIR) {
    throw new Error("RESEND_API_KEY is not configured; cannot send email in production");
  }

  const dir = EMAIL_OUTBOX_DIR ?? DEFAULT_OUTBOX_DIR;
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
  await writeFile(file, JSON.stringify({ ...message, sentAt: new Date().toISOString() }, null, 2));
  console.info(`[email] "${message.subject}" → ${[message.to].flat().join(", ")} (${file})`);
}
