const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const BASE_URL = process.env.CENTINELA_TEST_URL || 'http://127.0.0.1:4173';
const WIDTHS = [320, 360, 375, 390, 414, 430, 600, 768, 800, 820, 912, 1024, 1280, 1366, 1440, 1600, 1920];
const ARTIFACTS = path.join(process.cwd(), 'artifacts', 'responsive');
fs.mkdirSync(ARTIFACTS, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  const summary = [];
  try {
    for (const route of ['/oculus.html', '/index.html']) {
      for (const width of WIDTHS) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
        const pageErrors = [];
        page.on('pageerror', error => pageErrors.push(error.message));
        const response = await page.goto(BASE_URL + route, { waitUntil: 'networkidle', timeout: 45000 }).catch(async error => {
          failures.push({ route, width, type: 'navigation', detail: error.message });
          return null;
        });
        if (!response || !response.ok()) {
          failures.push({ route, width, type: 'http', detail: response ? String(response.status()) : 'sin respuesta' });
          await page.close();
          continue;
        }
        if (route === '/oculus.html') {
          await page.locator('#role').waitFor({ state: 'attached', timeout: 15000 }).catch(error => failures.push({ route, width, type: 'ui-init', detail: error.message }));
          await page.locator('#report').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
        }
        const metrics = await page.evaluate(() => ({
          viewport: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
          title: document.title
        }));
        const horizontalOverflow = Math.max(metrics.scrollWidth, metrics.bodyScrollWidth) > metrics.viewport + 1;
        if (horizontalOverflow) failures.push({ route, width, type: 'horizontal-overflow', detail: JSON.stringify(metrics) });
        if (route === '/oculus.html' && pageErrors.length) failures.push({ route, width, type: 'page-error', detail: pageErrors.join(' | ') });
        summary.push({ route, width, ...metrics, result: horizontalOverflow ? 'FAIL' : 'PASS' });
        if ([320, 390, 768, 1024, 1366, 1920].includes(width)) {
          const file = route.slice(1, -5) + '-' + width + 'px.png';
          await page.screenshot({ path: path.join(ARTIFACTS, file), fullPage: true, animations: 'disabled' }).catch(error => failures.push({ route, width, type: 'screenshot', detail: error.message }));
        }
        await page.close();
      }
    }
    fs.writeFileSync(path.join(ARTIFACTS, 'responsive-results.json'), JSON.stringify({ testedAt: new Date().toISOString(), widths: WIDTHS, summary, failures }, null, 2));
    console.log(JSON.stringify({ testedWidths: WIDTHS.length, pages: 2, checks: summary.length, failures }, null, 2));
    if (failures.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
