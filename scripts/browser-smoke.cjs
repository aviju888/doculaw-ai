const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = process.env.DOCULAW_BASE_URL || "http://127.0.0.1:3001";
  const output = require("node:path").resolve(
    process.env.DOCULAW_SCREENSHOT_DIR || "artifacts/browser",
  );
  fs.mkdirSync(output, { recursive: true });
  await page.goto(base);
  await page.evaluate(() =>
    localStorage.setItem("doculaw_migration_owned", "preserved"),
  );
  await page
    .getByRole("heading", { name: "Read the contract before you sign it." })
    .waitFor();
  await page.screenshot({
    path: output + "/modern-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: /sample lease/i }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page
    .getByRole("button", { name: "New", exact: true })
    .waitFor({ timeout: 20000 });
  await page.screenshot({
    path: output + "/workspace-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  const question = page.getByRole("textbox", { name: "Ask a question" });
  await question.fill("What happens if I pay rent late?");
  await page.getByRole("button", { name: "Send", exact: true }).click();

  const completed = page.getByRole("button", {
    name: "Copy answer",
    exact: true,
  });
  await completed.waitFor({ timeout: 20000 });
  const assistant = page.getByRole("region", {
    name: "Assistant answer",
    exact: true,
  });
  assert.match(
    await assistant.innerText(),
    /\$75/,
    "Completed assistant answer must include the sample's $75 late fee.",
  );
  assert(
    (await assistant.getByRole("button", { name: /Go to §5/ }).count()) > 0,
    "Completed assistant answer must cite the sample late-fee clause.",
  );
  await page.screenshot({
    path: output + "/answer-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.goto(base);
  await page.locator("input[type=file]").setInputFiles({
    name: "owned-browser-fixture.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "SERVICE AGREEMENT\n1. Payment\nThe Client shall pay the Provider $500 per month.\n2. Termination\nEither party may terminate this agreement with 30 days written notice.",
    ),
  });
  const skip = page.getByRole("button", { name: "Skip", exact: true });
  await skip.waitFor({ timeout: 3000 }).catch(() => {});
  if (await skip.isVisible()) await skip.click();
  await page
    .getByRole("button", { name: "New", exact: true })
    .waitFor({ timeout: 20000 });
  await page.getByRole("link", { name: "Documents", exact: true }).click();
  await page
    .getByRole("link", { name: /owned-browser-fixture/ })
    .last()
    .waitFor();
  await page.screenshot({
    path: output + "/library-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("link", { name: /owned-browser-fixture/ })
    .last()
    .click();
  await skip.waitFor({ timeout: 3000 }).catch(() => {});
  if (await skip.isVisible()) await skip.click();
  await page
    .getByRole("button", { name: "New", exact: true })
    .waitFor({ timeout: 20000 });
  await page.getByRole("link", { name: "Classic ↗", exact: true }).click();
  await page.waitForURL(/\/classic\/?$/);
  await page.screenshot({
    path: output + "/classic-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  assert.equal(
    await page.locator('link[href*="index-"]').count(),
    0,
    "Modern CSS must not leak into Classic",
  );
  await page.goto(base + "/upload");
  await page.locator("input[type=file]").setInputFiles({
    name: "classic-owned-browser.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "CLASSIC OWNED FIXTURE. The Client shall pay $700 every month under this agreement.",
    ),
  });
  await page.getByText("Completed", { exact: true }).waitFor();
  await page.goto(base + "/documents");
  await page
    .getByText("owned-browser-fixture.txt", { exact: true })
    .first()
    .waitFor();
  await page.getByRole("link", { name: "View", exact: true }).first().click();
  await page.waitForTimeout(500);
  assert(
    (await page.locator("body").innerText()).includes("owned-browser-fixture"),
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("doculaw_migration_owned")),
    "preserved",
  );
  await page.getByRole("link", { name: "Open new DocuLaw ↗" }).click();
  await page
    .getByRole("heading", { name: "Read the contract before you sign it." })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: output + "/modern-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "No horizontal overflow on mobile",
  );
  await page.goto(base + "/classic");
  await page.screenshot({
    path: output + "/classic-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: modern sample, cited question, upload, library/reopen, Classic switching/library, isolated styles, desktop/mobile; no page errors.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
