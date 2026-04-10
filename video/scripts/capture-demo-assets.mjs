import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(projectRoot, "public", "demo");
const frontendUrl = process.env.DEMO_FRONTEND_URL || "http://127.0.0.1:3000";
const backendUrl = process.env.DEMO_BACKEND_URL || "http://127.0.0.1:8000";

const viewport = { width: 1920, height: 1080 };

await mkdir(outputDir, { recursive: true });

async function waitForCycleDone(timeoutMs = 120000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${backendUrl}/log`);
      const payload = await response.json();
      const cycles = Array.isArray(payload.cycles) ? payload.cycles : [];
      if (cycles.some((entry) => entry.node === "done")) {
        return;
      }
    } catch {
      // Backend may still be warming up.
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error("Timed out waiting for the dashboard cycle to complete.");
}

async function startCycle() {
  const response = await fetch(`${backendUrl}/cycle`, { method: "POST" });

  if (response.ok) {
    return;
  }

  if (response.status === 409 || response.status === 429) {
    return;
  }

  throw new Error(`Failed to start demo cycle: ${response.status}`);
}

async function capturePage(page, route, fileName, readySelector, extraWait = 1000) {
  await page.goto(`${frontendUrl}${route}`, { waitUntil: "domcontentloaded" });

  if (readySelector) {
    await page.getByText(readySelector).first().waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
  }

  if (extraWait > 0) {
    await page.waitForTimeout(extraWait);
  }

  await page.screenshot({
    path: path.join(outputDir, fileName),
    fullPage: false,
  });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });

try {
  const page = await context.newPage();

  await capturePage(page, "/", "home.png", "APEX", 1200);

  await page.goto(`${frontendUrl}/dashboard`, { waitUntil: "domcontentloaded" });
  await startCycle();
  await waitForCycleDone();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outputDir, "dashboard.png"), fullPage: false });

  await capturePage(page, "/dashboard/agents", "agents.png", "Agent Registry", 2000);
  await capturePage(page, "/dashboard/veto-log", "veto-log.png", "Veto Log", 1500);
  await capturePage(page, "/dashboard/portfolio", "portfolio.png", "Portfolio & Yield", 2000);
  await capturePage(page, "/dashboard/settings", "settings.png", "Settings", 1500);

  await page.close();
} finally {
  await context.close();
  await browser.close();
}
