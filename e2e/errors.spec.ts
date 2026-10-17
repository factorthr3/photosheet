import { createOrg, expect, PASSWORD, signUp, test, uniqueEmail } from "./helpers";

// The auto `consoleErrors` fixture fails any test that logs a browser error.

test("not-found pages render cleanly", async ({ page }) => {
  await signUp(page, { name: "Nia NotFound", email: uniqueEmail("notfound") });
  const slug = await createOrg(page, "Not Found Co");

  for (const path of [
    "/definitely-not-a-page",
    `/o/${slug}/boards/00000000-0000-4000-8000-000000000000`,
    "/o/an-org-you-are-not-in/library",
  ]) {
    await page.goto(path);
    await expect(page.getByText("This page could not be found"), path).toBeVisible();
  }
});

test("signed-out visitors are sent to log in, then back", async ({ page }) => {
  const email = uniqueEmail("return");
  await signUp(page, { name: "Rhea Return", email });
  const slug = await createOrg(page, "Return Co");
  await page.context().clearCookies();

  await page.goto(`/o/${slug}/boards`);
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${slug}/boards$`));
});
