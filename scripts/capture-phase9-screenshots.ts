process.env.NODE_ENV = 'test';
import http from 'http';
import path from 'path';
import fs from 'fs';
import express from 'express';
import puppeteer from 'puppeteer-core';
import { closeAllPools } from '../server/src/db.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\hp\\.gemini\\antigravity\\brain\\d51e72a0-c2f7-474e-87dc-b688a841a3c5';
const SCREENSHOT_DIR = path.resolve('docs/screenshots');

async function main() {
  console.log('[Phase 9 Screenshot Automation] 1. Initializing web server...');
  const { app: apiApp } = await import('../server/src/index.js');

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
      console.log('[Phase 9 Screenshot Automation] Web frontend listening on http://localhost:5173');
      resolve();
    });
  });

  console.log('[Phase 9 Screenshot Automation] 2. Launching headless Chromium browser...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1360,900'],
    defaultViewport: { width: 1360, height: 900, deviceScaleFactor: 1.5 },
  });

  const page = await browser.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('[BROWSER ERROR CONSOLE]', msg.text());
    }
  });

  async function login(username: string, pass = 'Password@123') {
    console.log(`[Phase 9 Screenshot Automation] Logging in as ${username}...`);
    // Clear cookies
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');

    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[type="text"]', { timeout: 10000 });

    // Focus and fill
    await page.click('input[type="text"]', { clickCount: 3 });
    await page.type('input[type="text"]', username);
    await page.click('input[type="password"]', { clickCount: 3 });
    await page.type('input[type="password"]', pass);
    await page.click('button[type="submit"]');

    // Wait for aside/appshell
    await page.waitForSelector('aside', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1000));
  }

  async function capture(urlPath: string, filename: string, waitForSelector?: string, beforeCapture?: () => Promise<void>) {
    const fullUrl = `http://localhost:5173${urlPath}`;
    console.log(`[Phase 9 Screenshot Automation] Navigating to ${fullUrl}...`);
    await page.goto(fullUrl, { waitUntil: 'networkidle0' });

    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout: 10000 });
    }

    if (beforeCapture) {
      await beforeCapture();
    }

    // Wait for fonts & layout stabilization
    await new Promise((r) => setTimeout(r, 1200));

    const outPath = path.join(SCREENSHOT_DIR, filename);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`[Phase 9 Screenshot Automation] Saved: ${outPath}`);

    // Also copy to brain artifact directory
    if (fs.existsSync(ARTIFACT_DIR)) {
      const artifactPath = path.join(ARTIFACT_DIR, filename);
      fs.copyFileSync(outPath, artifactPath);
      console.log(`[Phase 9 Screenshot Automation] Copied to artifact dir: ${artifactPath}`);
    }
  }

  try {
    // 1. Capture Mess Manager Counter Screen (Large QR, Serving Window, Live Count, Search)
    await login('mess_mgr');
    await capture('/mess', '01-mess-counter-qr.png', 'img[alt="Mess Attendance QR Token"]');

    // 2. Capture Student 30-Day x 4-Meal Attendance Strip & Projection Panel
    await login('2026UCSDS0001');
    await capture('/student/mess', '02-student-attendance-strip.png', 'div.min-w-\\[840px\\]', async () => {
      // Hover over an eaten slot cell to trigger tooltip
      const cell = await page.$('div.bg-emerald-50');
      if (cell) {
        await cell.hover();
        await new Promise((r) => setTimeout(r, 600));
      }
    });

    // 3. Capture Mess Manager Refund Console with 300 residents and Confirm Dialog
    await login('mess_mgr');
    await capture('/mess/refunds', '03-manager-refund-console.png', 'table', async () => {
      // Trigger confirmation dialog
      try {
        const buttons = await page.$$('button');
        for (const btn of buttons) {
          const text = await page.evaluate((el) => el.textContent, btn);
          if (text && text.includes('Finalise Refunds')) {
            await btn.click();
            await page.waitForSelector('div[role="alertdialog"]', { timeout: 5000 });
            await new Promise((r) => setTimeout(r, 600));
            break;
          }
        }
      } catch (e) {
        console.log('Dialog trigger skipped or timed out');
      }
    });

    // 4. Capture Mess Config Screen
    await capture('/mess/config', '04-mess-config.png', 'input[type="number"]');

    console.log('[Phase 9 Screenshot Automation] ALL SCREENSHOTS SUCCESSFULLY CAPTURED!');
  } catch (err) {
    console.error('[Phase 9 Screenshot Automation] ERROR:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => webServer.close(() => resolve()));
    await closeAllPools();
    console.log('[Phase 9 Screenshot Automation] Cleaned up server and browser instances.');
  }
}

main().catch(console.error);
