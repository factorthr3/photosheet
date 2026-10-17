import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test as base } from "@playwright/test";
import sharp from "sharp";
import { OUTBOX_DIR } from "./env";

/** Test-only password used for every account the suite creates. */
export const PASSWORD = "e2e-password-123";

export function uniqueEmail(tag: string) {
  return `${tag}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@e2e.example.test`;
}

/**
 * Pages fail the test if the browser logs an error (other than expected 404/401 resource
 * responses). Catches regressions like React warnings surfacing as console errors.
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const text = msg.text();
        if (
          /Failed to load resource: the server responded with a status of (401|403|404|409|410)/.test(
            text,
          )
        )
          return;
        errors.push(text);
      });
      page.on("pageerror", (err) => errors.push(err.message));
      await use(errors);
      expect(errors, "browser console errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export async function signUp(page: Page, opts: { name: string; email: string; next?: string }) {
  await page.goto(opts.next ? `/signup?next=${encodeURIComponent(opts.next)}` : "/signup");
  await page.getByLabel("Name").fill(opts.name);
  await page.getByLabel("Work email").fill(opts.email);
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/signup"));
}

export async function logIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** Creates an org from /onboarding and returns its slug. */
export async function createOrg(page: Page, name: string) {
  await page.goto("/onboarding");
  await page.getByLabel("Organisation name").fill(name);
  await page.getByRole("button", { name: "Create organisation" }).click();
  await page.waitForURL(/\/o\/[^/]+\/library/);
  return new URL(page.url()).pathname.split("/")[2];
}

export interface OutboxEmail {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

/** Wait for an email to `to` in the outbox (optionally matching the subject). */
export async function waitForEmail(to: string, subject?: RegExp, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const files = await readdir(OUTBOX_DIR).catch(() => [] as string[]);
    for (const f of files.sort().reverse()) {
      const email = JSON.parse(await readFile(path.join(OUTBOX_DIR, f), "utf8")) as OutboxEmail;
      const recipients = [email.to].flat();
      if (recipients.includes(to) && (!subject || subject.test(email.subject))) {
        const link = email.text.match(/https?:\/\/\S+/)?.[0];
        return { ...email, link };
      }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No email to ${to}${subject ? ` matching ${subject}` : ""}`);
}

/** Generate distinct JPEG photos (portrait and landscape, with EXIF) in `dir`. */
export async function makePhotos(dir: string, count: number, prefix = "photo") {
  await mkdir(dir, { recursive: true });
  const files: string[] = [];
  for (let i = 0; i < count; i++) {
    const [w, h] = i % 2 ? [1600, 1067] : [1067, 1600];
    const hue = (i * 47) % 360;
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        <rect width="100%" height="100%" fill="hsl(${hue},65%,45%)"/>
        <circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 4}" fill="hsl(${(hue + 120) % 360},70%,60%)"/>
      </svg>`,
    );
    const file = path.join(dir, `${prefix}-${i + 1}.jpg`);
    await writeFile(
      file,
      await sharp(svg)
        .jpeg({ quality: 85 })
        .withExif({ IFD0: { Make: "Canon", Model: "EOS R6", Artist: "E2E Photographer" } })
        .toBuffer(),
    );
    files.push(file);
  }
  return files;
}

/** Upload through the real picker input and wait until every file has finished processing. */
export async function uploadFiles(page: Page, files: string[]) {
  await page.getByTestId("upload-input").setInputFiles(files);
  const panel = page.getByRole("region", { name: "Uploads" });
  await expect(panel).toContainText(`${files.length} uploaded`, { timeout: 90_000 });
  await panel.getByRole("button", { name: "Close uploads" }).click();
  await expect(panel).toBeHidden();
}

export const tiles = (page: Page) => page.locator("[data-tile-index]");
