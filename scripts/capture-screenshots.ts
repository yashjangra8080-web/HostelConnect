import http from 'http';
import path from 'path';
import fs from 'fs';
import express from 'express';
import puppeteer from 'puppeteer-core';
import { app as apiApp } from '../server/src/index.js';
import { closeAllPools } from '../server/src/db.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\hp\\.gemini\\antigravity\\brain\\4af07380-530d-42cd-a772-e19cf31b68fa';
const SCREENSHOT_DIR = path.resolve('docs/screenshots');

async function main() {
  console.log('[Screenshot Automation] 1. Initializing web server...');

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const webApp = express();
  const distPath = path.resolve('web/dist');

  // Forward /api requests into apiApp
  webApp.use('/api', (req, res, next) => {
    req.url = '/api' + req.url;
    apiApp(req, res, next);
  });

  // Serve static dist
  webApp.use(express.static(distPath));

  // Fallback to index.html for client-side routing
  webApp.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  const webServer = http.createServer(webApp);
  await new Promise<void>((resolve) => {
    webServer.listen(5173, () => {
      console.log('[Screenshot Automation] Web frontend listening on http://localhost:5173');
      resolve();
    });
  });

  console.log('[Screenshot Automation] 2. Launching headless Chromium browser...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,850'],
    defaultViewport: { width: 1280, height: 850, deviceScaleFactor: 1.5 },
  });

  const page = await browser.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('[BROWSER ERROR CONSOLE]', msg.text());
    }
  });

  async function capture(urlPath: string, filename: string, waitForSelector?: string) {
    const fullUrl = `http://localhost:5173${urlPath}`;
    console.log(`[Screenshot Automation] Capturing ${filename} from ${fullUrl}...`);
    await page.goto(fullUrl, { waitUntil: 'networkidle0' });

    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout: 10000 });
    }

    // Wait for fonts & layout
    await new Promise((r) => setTimeout(r, 1200));

    const outPath = path.join(SCREENSHOT_DIR, filename);
    await page.screenshot({ path: outPath, fullPage: filename === '05-design-system.png' });
    console.log(`[Screenshot Automation] Saved: ${outPath}`);

    // Also copy to brain artifact directory
    if (fs.existsSync(ARTIFACT_DIR)) {
      const artifactPath = path.join(ARTIFACT_DIR, filename);
      fs.copyFileSync(outPath, artifactPath);
      console.log(`[Screenshot Automation] Copied to artifact dir: ${artifactPath}`);
    }
  }

  try {
    // 1. Capture Login Page
    await capture('/', '01-login-page.png', 'input[type="text"]');

    // 2. Log in as ADMIN
    console.log('[Screenshot Automation] Logging in as ADMIN (admin)...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[type="text"]');
    await page.type('input[type="text"]', 'admin');
    await page.type('input[type="password"]', 'Password@123');
    await page.click('button[type="submit"]');
    await page.waitForSelector('aside', { timeout: 10000 });
    await capture('/', '02-shell-admin.png', 'aside');

    // 3. Log out and log in as WARDEN
    console.log('[Screenshot Automation] Logging out and logging in as WARDEN (warden_bh1)...');
    await page.evaluate(async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    });
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[type="text"]');
    await page.type('input[type="text"]', 'warden_bh1');
    await page.type('input[type="password"]', 'Password@123');
    await page.click('button[type="submit"]');
    await page.waitForSelector('aside', { timeout: 10000 });
    await capture('/', '03-shell-warden.png', 'aside');

    // 4. Log out and log in as STUDENT
    console.log('[Screenshot Automation] Logging out and logging in as STUDENT (2026UCSDS0001)...');
    await page.evaluate(async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    });
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[type="text"]');
    await page.type('input[type="text"]', '2026UCSDS0001');
    await page.type('input[type="password"]', 'Password@123');
    await page.click('button[type="submit"]');
    await page.waitForSelector('aside', { timeout: 10000 });
    await capture('/', '04-shell-student.png', 'aside');

    console.log('[Screenshot Automation] All screenshots captured successfully!');
  } catch (err) {
    console.error('[Screenshot Automation Error in try]:', err);
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => webServer.close(() => resolve()));
    await closeAllPools();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('[Screenshot Automation Fatal]:', err);
  process.exit(1);
});
