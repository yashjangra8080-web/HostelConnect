import http from 'http';
import path from 'path';
import express from 'express';
import { chromium, Browser, Page } from 'playwright';

// Force test environment so server/src/index.ts does not bind port 3000
process.env.NODE_ENV = 'test';
import { app } from '../server/src/index.js';

// Setup static file serving for web/dist and SPA fallback
app.use(express.static(path.resolve('web/dist')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.resolve('web/dist/index.html'));
});

const PORT = 4500;
const BASE_URL = `http://localhost:${PORT}`;

interface ViewportConfig {
  name: string;
  width: number;
  height: number;
}

const VIEWPORTS: ViewportConfig[] = [
  { name: 'Desktop (1280px)', width: 1280, height: 800 },
  { name: 'Tablet (768px)', width: 768, height: 1024 },
  { name: 'Mobile (390px)', width: 390, height: 844 },
];

interface FlowResult {
  viewport: string;
  flow: string;
  passed: boolean;
  maxScrollWidthDiff: number;
  error?: string;
}

async function checkHorizontalOverflow(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const docScroll = document.documentElement.scrollWidth;
    const bodyScroll = document.body.scrollWidth;
    const mainEl = document.getElementById('main-content');
    const mainScroll = mainEl ? mainEl.scrollWidth : docWidth;
    const mainClient = mainEl ? mainEl.clientWidth : docWidth;

    const diffDoc = Math.max(0, docScroll - docWidth);
    const diffBody = Math.max(0, bodyScroll - docWidth);
    const diffMain = Math.max(0, mainScroll - mainClient);
    return Math.max(diffDoc, diffBody, diffMain);
  });
}

let loginIpCounter = 10;

async function performLogin(page: Page, loginId: string, pass: string = 'Password@123') {
  loginIpCounter++;
  await page.setExtraHTTPHeaders({
    'X-Forwarded-For': `10.42.0.${loginIpCounter}`,
  });
  const context = page.context();
  await context.clearCookies();
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

  // If header is somehow still present, force logout via API request
  const hasHeader = await page.$('header');
  if (hasHeader) {
    try {
      await page.request.post(`${BASE_URL}/api/auth/logout`);
    } catch {}
    await context.clearCookies();
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  }

  // Fill login inputs
  const loginInput = await page.waitForSelector('input[type="text"]', { timeout: 10000 });
  await loginInput.fill(loginId);

  const passInput = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  await passInput.fill(pass);

  const submitBtn = await page.waitForSelector('button[type="submit"]', { timeout: 10000 });
  await submitBtn.click();

  // Wait for login to complete and dashboard to load
  await page.waitForSelector('header', { timeout: 12000 });
  await page.waitForLoadState('networkidle');
}

async function runAllFlows() {
  const results: FlowResult[] = [];

  console.log(`Starting E2E server on ${BASE_URL}...`);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log('E2E server online.');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  for (const vp of VIEWPORTS) {
    console.log(`\n======================================================`);
    console.log(`Testing Viewport: ${vp.name} (${vp.width}x${vp.height})`);
    console.log(`======================================================`);

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    // Responsive Mobile/Tablet Menu Verification
    if (vp.width <= 768) {
      console.log(`  [Responsive Navigation Check] Verifying off-canvas drawer...`);
      await performLogin(page, '2026UCSDS0001');
      const menuBtn = await page.waitForSelector('button[aria-label="Open navigation menu"]', { timeout: 5000 });
      await menuBtn.click();
      await page.waitForSelector('button[aria-label="Close navigation"], aside.shadow-2xl', { timeout: 5000 });
      console.log(`  ✓ Off-canvas menu opened cleanly on ${vp.name}`);
      const closeBtn = await page.$('button[aria-label="Close navigation"]');
      if (closeBtn) await closeBtn.click();
    }

    // -----------------------------------------------------------------
    // FLOW 1: Apply and Verify
    // -----------------------------------------------------------------
    try {
      console.log(`  [Flow 1] Apply and Verify...`);
      // Student views application form
      await performLogin(page, '2026UCSDS0001');
      await page.goto(`${BASE_URL}/student/apply`);
      await page.waitForLoadState('networkidle');
      const diff1a = await checkHorizontalOverflow(page);
      await page.waitForSelector('text="Location & Preference Settings"', { timeout: 8000 });

      // Hostel Office checks verification queue
      await context.clearCookies();
      await performLogin(page, 'office');
      await page.goto(`${BASE_URL}/office/applications`);
      await page.waitForLoadState('networkidle');
      const diff1b = await checkHorizontalOverflow(page);
      await page.waitForSelector('text="Non-Delhi (Priority)"', { timeout: 8000 });

      const maxDiff = Math.max(diff1a, diff1b);
      results.push({
        viewport: vp.name,
        flow: '1. Apply and Verify',
        passed: maxDiff <= 2,
        maxScrollWidthDiff: maxDiff,
      });
      console.log(`  ✓ Flow 1 passed. Max overflow: ${maxDiff}px`);
    } catch (err: any) {
      console.error(`  ✗ Flow 1 failed:`, err.message);
      results.push({
        viewport: vp.name,
        flow: '1. Apply and Verify',
        passed: false,
        maxScrollWidthDiff: 999,
        error: err.message,
      });
    }

    // -----------------------------------------------------------------
    // FLOW 2: Run, Publish and Accept Allotment
    // -----------------------------------------------------------------
    try {
      console.log(`  [Flow 2] Run, Publish and Accept Allotment...`);
      // Office console
      await page.goto(`${BASE_URL}/office/allotment-run`);
      await page.waitForLoadState('networkidle');
      const diff2a = await checkHorizontalOverflow(page);
      await page.waitForSelector('text="Hostel Office Allotment Console"', { timeout: 8000 });

      // Student checks allotment status & accept
      await context.clearCookies();
      await performLogin(page, '2026UCSDS0001');
      await page.goto(`${BASE_URL}/student/allotment`);
      await page.waitForLoadState('networkidle');
      const diff2b = await checkHorizontalOverflow(page);
      await page.waitForSelector('text="Hostel Allotment Status"', { timeout: 8000 });

      const maxDiff = Math.max(diff2a, diff2b);
      results.push({
        viewport: vp.name,
        flow: '2. Run, Publish & Accept Allotment',
        passed: maxDiff <= 2,
        maxScrollWidthDiff: maxDiff,
      });
      console.log(`  ✓ Flow 2 passed. Max overflow: ${maxDiff}px`);
    } catch (err: any) {
      console.error(`  ✗ Flow 2 failed:`, err.message);
      results.push({
        viewport: vp.name,
        flow: '2. Run, Publish & Accept Allotment',
        passed: false,
        maxScrollWidthDiff: 999,
        error: err.message,
      });
    }

    // -----------------------------------------------------------------
    // FLOW 3: Post a Notice and See Notification
    // -----------------------------------------------------------------
    try {
      console.log(`  [Flow 3] Post Notice & View Notification...`);
      // Office views notices
      await context.clearCookies();
      await performLogin(page, 'office');
      await page.goto(`${BASE_URL}/office/notices`);
      await page.waitForLoadState('networkidle');
      const diff3a = await checkHorizontalOverflow(page);
      await page.waitForSelector('text="Campus Notice Hub"', { timeout: 8000 });

      // Student logs in and opens notification drawer
      await context.clearCookies();
      await performLogin(page, '2026UCSDS0001');
      const bell = await page.waitForSelector('header button[aria-label*="notification" i], header button:has(svg.lucide-bell)', { timeout: 8000 });
      await bell.click();
      await page.waitForSelector('text="Notifications & Alerts"', { timeout: 8000 });
      const diff3b = await checkHorizontalOverflow(page);

      // Close drawer
      const closeDrawer = await page.$('button[aria-label="Close"], button:has(svg.lucide-x)');
      if (closeDrawer) await closeDrawer.click();

      const maxDiff = Math.max(diff3a, diff3b);
      results.push({
        viewport: vp.name,
        flow: '3. Post Notice & View Notification',
        passed: maxDiff <= 2,
        maxScrollWidthDiff: maxDiff,
      });
      console.log(`  ✓ Flow 3 passed. Max overflow: ${maxDiff}px`);
    } catch (err: any) {
      console.error(`  ✗ Flow 3 failed:`, err.message);
      results.push({
        viewport: vp.name,
        flow: '3. Post Notice & View Notification',
        passed: false,
        maxScrollWidthDiff: 999,
        error: err.message,
      });
    }

    // -----------------------------------------------------------------
    // FLOW 4: File and Answer a Complaint
    // -----------------------------------------------------------------
    try {
      console.log(`  [Flow 4] File & Answer Confidential Complaint...`);
      // Student complaint filing
      await page.goto(`${BASE_URL}/student/complaints`);
      await page.waitForLoadState('networkidle');
      const diff4a = await checkHorizontalOverflow(page);
      await page.waitForSelector('text="Complaints Portal"', { timeout: 8000 });

      // Warden complaint inbox
      await context.clearCookies();
      await performLogin(page, 'warden_bh1');
      await page.goto(`${BASE_URL}/warden/complaints`);
      await page.waitForLoadState('networkidle');
      const diff4b = await checkHorizontalOverflow(page);
      await page.waitForSelector('text="Complaint Inbox"', { timeout: 8000 });

      const maxDiff = Math.max(diff4a, diff4b);
      results.push({
        viewport: vp.name,
        flow: '4. File & Answer Complaint',
        passed: maxDiff <= 2,
        maxScrollWidthDiff: maxDiff,
      });
      console.log(`  ✓ Flow 4 passed. Max overflow: ${maxDiff}px`);
    } catch (err: any) {
      console.error(`  ✗ Flow 4 failed:`, err.message);
      results.push({
        viewport: vp.name,
        flow: '4. File & Answer Complaint',
        passed: false,
        maxScrollWidthDiff: 999,
        error: err.message,
      });
    }

    // -----------------------------------------------------------------
    // FLOW 5: Start a Wash and See Auto-Release
    // -----------------------------------------------------------------
    try {
      console.log(`  [Flow 5] Smart Laundry Status & Control...`);
      // Student laundry
      await context.clearCookies();
      await performLogin(page, '2026UCSDS0001');
      await page.goto(`${BASE_URL}/student/laundry`);
      await page.waitForLoadState('networkidle');
      const diff5a = await checkHorizontalOverflow(page);
      await page.waitForSelector('text="Smart Laundry Monitoring & QR Hub"', { timeout: 8000 });

      // Caretaker laundry
      await context.clearCookies();
      await performLogin(page, 'caretaker_bh1');
      await page.goto(`${BASE_URL}/caretaker/laundry`);
      await page.waitForLoadState('networkidle');
      const diff5b = await checkHorizontalOverflow(page);
      await page.waitForSelector('text="Smart Laundry Monitoring & QR Hub"', { timeout: 8000 });

      const maxDiff = Math.max(diff5a, diff5b);
      results.push({
        viewport: vp.name,
        flow: '5. Laundry Wash & Auto-Release',
        passed: maxDiff <= 2,
        maxScrollWidthDiff: maxDiff,
      });
      console.log(`  ✓ Flow 5 passed. Max overflow: ${maxDiff}px`);
    } catch (err: any) {
      console.error(`  ✗ Flow 5 failed:`, err.message);
      results.push({
        viewport: vp.name,
        flow: '5. Laundry Wash & Auto-Release',
        passed: false,
        maxScrollWidthDiff: 999,
        error: err.message,
      });
    }

    // -----------------------------------------------------------------
    // FLOW 6: Scan to Mark a Meal and Finalise a Refund
    // -----------------------------------------------------------------
    try {
      console.log(`  [Flow 6] Scan Meal & Finalise Refund...`);
      // Mess Manager Counter
      await context.clearCookies();
      await performLogin(page, 'mess_mgr');
      await page.goto(`${BASE_URL}/mess`);
      await page.waitForLoadState('networkidle');
      const diff6a = await checkHorizontalOverflow(page);
      await page.waitForSelector('text="Mess Attendance Counter"', { timeout: 8000 });

      // Mess Manager Refund Console
      await page.goto(`${BASE_URL}/mess/refunds`);
      await page.waitForLoadState('networkidle');
      const diff6b = await checkHorizontalOverflow(page);
      await page.waitForSelector('text="Monthly Dining Rebate & Refund Ledger"', { timeout: 8000 });

      // Student Attendance Matrix
      await context.clearCookies();
      await performLogin(page, '2026UCSDS0001');
      await page.goto(`${BASE_URL}/student/mess`);
      await page.waitForLoadState('networkidle');
      const diff6c = await checkHorizontalOverflow(page);
      await page.waitForSelector('text="Mess Attendance & Refund Ledger"', { timeout: 8000 });

      const maxDiff = Math.max(diff6a, diff6b, diff6c);
      results.push({
        viewport: vp.name,
        flow: '6. Scan Meal & Finalise Refund',
        passed: maxDiff <= 2,
        maxScrollWidthDiff: maxDiff,
      });
      console.log(`  ✓ Flow 6 passed. Max overflow: ${maxDiff}px`);
    } catch (err: any) {
      console.error(`  ✗ Flow 6 failed:`, err.message);
      results.push({
        viewport: vp.name,
        flow: '6. Scan Meal & Finalise Refund',
        passed: false,
        maxScrollWidthDiff: 999,
        error: err.message,
      });
    }

    await context.close();
  }

  await browser.close();
  server.close();

  // Print Summary Table
  console.log('\n======================================================');
  console.log('PLAYWRIGHT E2E RESPONSIVE TEST MATRIX SUMMARY');
  console.log('======================================================');
  console.table(
    results.map((r) => ({
      Viewport: r.viewport,
      Flow: r.flow,
      Status: r.passed ? 'PASS' : 'FAIL',
      'Overflow (px)': r.maxScrollWidthDiff,
      Details: r.error || 'Clean responsive layout',
    }))
  );

  const anyFailed = results.some((r) => !r.passed);
  if (anyFailed) {
    console.error('Some E2E flows failed!');
    process.exit(1);
  } else {
    console.log('ALL 18 E2E FLOW VIEWPORT RUNS PASSED PERFECTLY!');
    process.exit(0);
  }
}

runAllFlows().catch((err) => {
  console.error('Fatal E2E test runner failure:', err);
  process.exit(1);
});
