// Renders docs/banner/banner.html to banner.png (2000x1008).
// Needs Playwright where node can import it (it is not a dependency of this repo).
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
const dir = fileURLToPath(new URL(".", import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2000, height: 1008 } });
await page.goto(`file://${dir}banner.html`);
await page.screenshot({ path: `${dir}banner.png` });
await browser.close();
