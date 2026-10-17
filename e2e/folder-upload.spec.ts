import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createOrg, expect, makePhotos, signUp, test, tiles, uniqueEmail } from "./helpers";

test("upload a whole folder and tag it from the words its file names share", async ({
  page,
}, testInfo) => {
  await signUp(page, { name: "Fiona Folder", email: uniqueEmail("folder") });
  const slug = await createOrg(page, "Folder Co");

  // A typical camera dump: numbered files in a named folder, plus clutter that isn't an image.
  const folder = testInfo.outputPath("Launch Party");
  await makePhotos(folder, 3, "IMG");
  await writeFile(path.join(folder, ".DS_Store"), "");
  await writeFile(path.join(folder, "notes.txt"), "shot list");

  await page.getByTestId("upload-folder-input").setInputFiles(folder);
  await expect(page.getByText("Skipped 2 files that aren't an image")).toBeVisible();

  const prompt = page.getByRole("form", { name: "Suggested tags" });
  await expect(prompt).toContainText("All 3 file names mention “launch party”. Tag them?");
  const input = prompt.getByLabel("Tags to add");
  await expect(input).toHaveValue("launch party");
  await input.fill("launch party, press");
  await prompt.getByRole("button", { name: "Add tags" }).click();
  await expect(page.getByText("Tagged 3 images “launch party”, “press”")).toBeVisible();
  await expect(prompt).toBeHidden();

  const panel = page.getByRole("region", { name: "Uploads" });
  await expect(panel).toContainText("3 uploaded", { timeout: 90_000 });
  await expect(tiles(page)).toHaveCount(3);

  for (const tag of ["launch party", "press"]) {
    const res = await page.request.get(`/api/o/${slug}/images?tags=${encodeURIComponent(tag)}`);
    expect((await res.json()).total, tag).toBe(3);
  }
});

test("declining the suggestion leaves the photos untagged", async ({ page }, testInfo) => {
  await signUp(page, { name: "Nora Nothanks", email: uniqueEmail("nothanks") });
  const slug = await createOrg(page, "No Thanks Co");
  const dir = testInfo.outputPath("loose");
  const photos = await makePhotos(dir, 2, "Harbour_Sunset");

  await page.getByTestId("upload-input").setInputFiles(photos);
  const prompt = page.getByRole("form", { name: "Suggested tags" });
  await expect(prompt).toContainText("Both file names mention “harbour sunset”.");
  await prompt.getByRole("button", { name: "No thanks" }).click();
  await expect(prompt).toBeHidden();

  await expect(page.getByRole("region", { name: "Uploads" })).toContainText("2 uploaded", {
    timeout: 90_000,
  });
  const res = await page.request.get(`/api/o/${slug}/images?tags=harbour%20sunset`);
  expect((await res.json()).total).toBe(0);
});
