import { execFileSync } from "node:child_process";
import path from "node:path";
import type { Browser, Download } from "@playwright/test";
import sharp from "sharp";
import {
  createOrg,
  expect,
  makePhotos,
  PASSWORD,
  signUp,
  test,
  tiles,
  uniqueEmail,
  uploadFiles,
  waitForEmail,
} from "./helpers";

/**
 * The brief's definition of done, as one journey:
 * sign up → org → invite → upload → board → resize/download → ZIP → share (expiring, password,
 * emailed) → recipient views/downloads without logging in → other orgs see nothing → revoke.
 */

const HEIC_FIXTURE = path.resolve(__dirname, "../src/test/fixtures/sample.heic");

async function newPage(browser: Browser, errors: string[]) {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    if (
      /Failed to load resource: the server responded with a status of (401|403|404|409|410)/.test(
        msg.text(),
      )
    )
      return;
    errors.push(msg.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return page;
}

async function save(download: Download, dir: string) {
  const file = path.join(dir, download.suggestedFilename());
  await download.saveAs(file);
  return file;
}

function zipEntries(file: string) {
  return execFileSync("unzip", ["-Z1", file], { encoding: "utf8" }).trim().split("\n");
}

test("a team can store, organise, resize and share photos — and nobody else can see them", async ({
  page,
  browser,
  consoleErrors,
}, testInfo) => {
  test.setTimeout(6 * 60_000);
  const owner = { name: "Olivia Owner", email: uniqueEmail("owner") };
  const colleague = { name: "Colin Colleague", email: uniqueEmail("colleague") };
  const recipientEmail = uniqueEmail("press");
  const downloads = testInfo.outputPath("downloads");
  let slug = "";
  let boardUrl = "";
  let shareUrl = "";
  let firstImageId = "";

  await test.step("owner signs up and creates an organisation", async () => {
    await signUp(page, owner);
    await expect(page).toHaveURL(/\/onboarding/);
    slug = await createOrg(page, "Acme E2E Studio");
    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
    await expect(page.getByText("No images yet")).toBeVisible();
  });

  await test.step("owner invites a colleague, who joins as an editor", async () => {
    await page.goto(`/o/${slug}/members`);
    await page.getByLabel("Email").fill(colleague.email);
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page.getByText(`Invitation sent to ${colleague.email}`)).toBeVisible();

    const invite = await waitForEmail(colleague.email, /invited you to Acme E2E Studio/);
    expect(invite.link).toMatch(/\/invite\//);

    const colleaguePage = await newPage(browser, consoleErrors);
    await colleaguePage.goto(invite.link!);
    await colleaguePage.getByRole("link", { name: "Create an account to accept" }).click();
    await expect(colleaguePage.getByLabel("Work email")).toHaveValue(colleague.email);
    await colleaguePage.getByLabel("Name").fill(colleague.name);
    await colleaguePage.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
    await colleaguePage.getByRole("button", { name: "Create account" }).click();
    await colleaguePage.getByRole("button", { name: "Accept invitation" }).click();
    await colleaguePage.waitForURL(new RegExp(`/o/${slug}/library`));
    await expect(colleaguePage.getByRole("button", { name: "Upload", exact: true })).toBeVisible(); // editors can upload
    await colleaguePage.context().close();

    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(colleague.email) })).toContainText(
      "Editor",
    );
  });

  await test.step("owner uploads a batch of photos and sees them on the contact sheet", async () => {
    const photos = await makePhotos(testInfo.outputPath("photos"), 6);
    await page.goto(`/o/${slug}/library`);
    await uploadFiles(page, [...photos, HEIC_FIXTURE]);
    await expect(tiles(page)).toHaveCount(7);
    await expect(page.locator("[data-tile-index] img")).toHaveCount(7);
    await expect(page.getByText("7 images in Acme E2E Studio")).toBeVisible();
  });

  await test.step("owner groups the photos into a board and reorders it", async () => {
    await tiles(page).first().click();
    await page.getByRole("button", { name: "Select all 7" }).click();
    await expect(page.getByRole("region", { name: "Selection" })).toContainText("7 selected");
    await page.getByRole("button", { name: "Add to board" }).click();
    await page.getByLabel("Find or create a board").fill("Launch");
    await page.getByRole("button", { name: "Create “Launch”" }).click();
    await expect(page.getByText("Added 7 images to “Launch”")).toBeVisible();

    await page.goto(`/o/${slug}/boards`);
    await page.getByRole("link", { name: /Launch/ }).click();
    await page.waitForURL(/\/boards\//);
    boardUrl = page.url();
    await expect(page.getByText(/7 images · Created by Olivia Owner/)).toBeVisible();

    const before = await tiles(page).evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label")),
    );
    await tiles(page).first().focus();
    const saved = page.waitForResponse((r) => r.url().includes("/reorder") && r.status() === 204);
    await page.keyboard.press("Alt+ArrowRight");
    await saved;
    await page.reload();
    const after = await tiles(page).evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label")),
    );
    expect(after.slice(0, 2)).toEqual([before[1], before[0]]);
    firstImageId = (await page.locator("[data-image-id]").first().getAttribute("data-image-id"))!;
  });

  await test.step("resize one image to a preset and to a custom size, then download", async () => {
    // A 1600 × 1067 JPEG: big enough that neither size is capped at the original.
    await page.getByRole("button", { name: /^photo-2\b/ }).dblclick();
    await page.getByRole("button", { name: "Resize & download" }).click();

    await page.getByRole("radio", { name: /Social square/ }).click();
    const download = page.getByRole("link", { name: "Download" });
    await expect(download).toBeVisible({ timeout: 30_000 });
    const [square] = await Promise.all([page.waitForEvent("download"), download.click()]);
    const squareFile = await save(square, downloads);
    expect(square.suggestedFilename()).toMatch(/-1080x1080\.jpg$/);
    expect(await sharp(squareFile).metadata()).toMatchObject({
      format: "jpeg",
      width: 1080,
      height: 1080,
    });

    await page.getByRole("radio", { name: "Custom size" }).click();
    await page.getByLabel("Width").fill("640");
    await expect(page.getByRole("dialog", { name: "Resize & download" })).toContainText("640 ×");
    await expect(download).toBeVisible({ timeout: 30_000 });
    const [custom] = await Promise.all([page.waitForEvent("download"), download.click()]);
    const customMeta = await sharp(await save(custom, downloads)).metadata();
    expect(customMeta.width).toBe(640);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  });

  await test.step("download the whole board as a ZIP at one preset size", async () => {
    await page.goto(boardUrl);
    await page.getByRole("button", { name: "Download ZIP" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox", { name: "Size" }).click();
    await page.getByRole("option", { name: /^Web medium/ }).click();
    const [zip] = await Promise.all([
      page.waitForEvent("download", { timeout: 60_000 }),
      dialog.getByRole("button", { name: "Create ZIP" }).click(),
    ]);
    const entries = zipEntries(await save(zip, downloads));
    expect(entries).toHaveLength(7);
    for (const name of entries) expect(name).toMatch(/-\d+x\d+\.jpg$/);
    await page.keyboard.press("Escape");
  });

  await test.step("create an expiring, password-protected share link and email it", async () => {
    await page.getByRole("button", { name: "Share" }).click();
    const dialog = page.getByRole("dialog", { name: /Share “Launch”/ });
    await expect(dialog.getByLabel("Expires")).toContainText("In 30 days");
    await dialog.getByRole("switch", { name: "Require a password" }).click();
    await dialog.getByLabel("Link password").fill("press-kit-42");
    await dialog.getByRole("button", { name: "Create link" }).click();
    const linkInput = dialog.getByLabel("Share link").first();
    await expect(linkInput).toHaveValue(/\/s\/[A-Za-z0-9_-]{32}$/);
    shareUrl = await linkInput.inputValue();

    await dialog.getByRole("button", { name: "Email link" }).click();
    await dialog.getByLabel("Recipients").fill(recipientEmail);
    await dialog.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Link emailed to 1 person")).toBeVisible();
    const email = await waitForEmail(recipientEmail, /shared "Launch" with you/);
    expect(email.link).toBe(shareUrl);
    expect(email.text).toMatch(/works until/);
    expect(email.replyTo).toBe(owner.email);
    await page.keyboard.press("Escape");
  });

  await test.step("a recipient views and downloads without logging in", async () => {
    const guest = await newPage(browser, consoleErrors);
    await guest.goto(shareUrl);
    await expect(guest.getByText("Enter the password to view them.")).toBeVisible();
    await guest.getByLabel("Password").fill("wrong-password");
    await guest.getByRole("button", { name: "View photos" }).click();
    await expect(guest.getByText("That password isn't right")).toBeVisible();
    await guest.getByLabel("Password").fill("press-kit-42");
    await guest.getByRole("button", { name: "View photos" }).click();

    await expect(guest.getByRole("heading", { name: "Launch" })).toBeVisible();
    await expect(guest.getByText(/7 photos shared by Acme E2E Studio/)).toBeVisible();
    await expect(guest.getByRole("button", { name: /^Open / })).toHaveCount(7);

    await guest
      .getByRole("button", { name: /^Open / })
      .first()
      .click();
    await guest.getByRole("dialog").getByRole("button", { name: "Download" }).click();
    const [one] = await Promise.all([
      guest.waitForEvent("download"),
      guest.getByRole("menuitem", { name: /Web medium/ }).click(),
    ]);
    const meta = await sharp(await save(one, downloads)).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(1200);
    await guest.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    await expect(guest.getByRole("dialog")).toBeHidden();

    await guest.getByRole("button", { name: "Download all (7)" }).click();
    const [all] = await Promise.all([
      guest.waitForEvent("download", { timeout: 60_000 }),
      guest.getByRole("menuitem", { name: /Web large/ }).click(),
    ]);
    expect(zipEntries(await save(all, downloads))).toHaveLength(7);
    await guest.context().close();
  });

  await test.step("people in another organisation can't see any of it", async () => {
    const outsider = await newPage(browser, consoleErrors);
    await signUp(outsider, { name: "Oscar Outsider", email: uniqueEmail("outsider") });
    const otherSlug = await createOrg(outsider, "Other Co");
    await expect(outsider.getByText("No images yet")).toBeVisible();

    await outsider.goto(boardUrl);
    await expect(outsider.getByText("This page could not be found")).toBeVisible();
    await outsider.goto(`/o/${slug}/library`);
    await expect(outsider.getByText("This page could not be found")).toBeVisible();

    const boardId = boardUrl.split("/").pop()!;
    const api = outsider.request;
    for (const url of [
      `/api/o/${slug}/images`,
      `/api/o/${slug}/boards`,
      `/api/o/${otherSlug}/images/${firstImageId}`,
      `/api/o/${otherSlug}/images/${firstImageId}/download`,
      `/api/o/${otherSlug}/boards/${boardId}`,
      `/api/o/${otherSlug}/boards/${boardId}/images`,
    ]) {
      expect((await api.get(url, { maxRedirects: 0 })).status(), url).toBe(404);
    }
    const search = await (await api.get(`/api/o/${otherSlug}/images`)).json();
    expect(search.total).toBe(0);
    await outsider.context().close();
  });

  await test.step("revoking the link cuts off access immediately", async () => {
    await page.goto(`/o/${slug}/shares`);
    await page
      .getByRole("row", { name: /Launch/ })
      .getByRole("button", { name: "Revoke" })
      .click();
    await expect(page.getByText("Link revoked")).toBeVisible();
    const guest = await newPage(browser, consoleErrors);
    await guest.goto(shareUrl);
    await expect(guest.getByText("This link is no longer available")).toBeVisible();
    await guest.context().close();
  });
});
