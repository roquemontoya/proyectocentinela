import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const targetUrl = process.env.CENTINELA_URL ?? 'https://proyectocentinela.vercel.app/';
const startedAt = new Date();
const report = {
  startedAt: startedAt.toISOString(),
  targetUrl,
  browser: 'Chromium (Playwright)',
  checks: {},
  javascriptErrors: [],
  httpErrors: [],
  requestFailures: [],
  status: 'NOT_RUN',
  notes: [
    'Read-only smoke test. Does not log in, submit forms, click module controls, or modify application data.',
    'Unauthenticated checks verify that module entries exist in the page markup and that the router is registered; they do not prove that authenticated modules load or work.',
    'Database operations and Pulmon inventory transactions are not tested.'
  ]
};

await mkdir('artifacts', { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.on('pageerror', error => report.javascriptErrors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) {
      report.httpErrors.push({ status: response.status(), url: response.url() });
    }
  });
  page.on('requestfailed', request => {
    report.requestFailures.push({
      url: request.url(),
      reason: request.failure()?.errorText ?? 'Unknown'
    });
  });

  const response = await page.goto(targetUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 45000
  });
  await page.waitForTimeout(2500);

  report.httpStatus = response?.status() ?? null;
  report.title = await page.title();

  const heading = page.getByRole('heading', { name: 'Acceso al sistema' });
  const email = page.locator('input[type="email"]');
  const password = page.locator('input[type="password"]').first();
  const loginButton = page.getByRole('button', { name: 'Ingresar', exact: true });

  // These entries are inside the hidden authenticated navigation shell.
  // Count/inspect them without opening the menu or triggering application actions.
  const menuText = await page.locator('#side-menu').textContent().catch(() => '');
  const routerRegistered = await page.evaluate(() => typeof window.cargarModulo === 'function');

  report.checks = {
    pageResponded: Boolean(response && response.status() < 500),
    expectedTitle: report.title === 'Centinela 3.0',
    accessHeadingVisible: await heading.isVisible().catch(() => false),
    emailVisible: await email.isVisible().catch(() => false),
    passwordVisible: await password.isVisible().catch(() => false),
    loginButtonVisible: await loginButton.isVisible().catch(() => false),
    loginButtonEnabled: await loginButton.isEnabled().catch(() => false),
    moduleRouterRegistered: routerRegistered,
    extintoresMenuEntryPresent: menuText.includes('Extintores en planta'),
    pulmonMenuEntryPresent: menuText.includes('Pulmón / reserva'),
    hidrantesMenuEntryPresent: menuText.includes('Hidrantes')
  };

  const criticalChecksPassed =
    Object.values(report.checks).every(Boolean) &&
    report.javascriptErrors.length === 0 &&
    report.requestFailures.length === 0;

  report.status = criticalChecksPassed ? 'PASS' : 'CHECK_REQUIRED';
} catch (error) {
  report.status = 'TEST_INTERRUPTED';
  report.fatalError = error instanceof Error ? error.message : String(error);
} finally {
  await browser.close();
}

report.finishedAt = new Date().toISOString();
const outputPath = 'artifacts/centinela-diagnostic-report.json';
await writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8');

console.log(JSON.stringify(report, null, 2));
console.log(`Report saved to ${outputPath}`);

if (report.status !== 'PASS') process.exitCode = 1;
