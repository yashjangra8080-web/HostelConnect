import path from 'path';
import fs from 'fs';
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const AFTER_DIR = path.resolve('docs/screenshots/after');

async function main() {
  if (!fs.existsSync(AFTER_DIR)) {
    fs.mkdirSync(AFTER_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Helper to log in as student Krishna Gupta (2026UITX0192)
  async function loginStudent() {
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
    const loginInput = await page.$('input[type="text"]');
    if (loginInput) {
      await loginInput.type('2026UITX0192');
      await page.type('input[type="password"]', 'Password@123');
      await page.click('button[type="submit"]');
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // -------------------------------------------------------------
  // Viewport 1: Desktop 1280 x 800
  // -------------------------------------------------------------
  console.log('[Capture] Capturing 1280px desktop screenshots...');
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await loginStudent();

  // 1. Student Home (1280)
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(AFTER_DIR, 'student-home-1280.png') });
  console.log('✓ student-home-1280.png');

  // 2. Notification Popover (1280)
  const bellBtn = await page.$('button[aria-label="View notifications"]');
  if (bellBtn) {
    await bellBtn.click();
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(AFTER_DIR, 'notifications-1280.png') });
    console.log('✓ notifications-1280.png');
    // Close popover
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 400));
  }

  // 3. Notices Dated Ledger & Detail Drawer (1280)
  await page.goto('http://localhost:5173/student/notices?open=1', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(AFTER_DIR, 'notices-1280.png') });
  console.log('✓ notices-1280.png');

  // 4. Mess Attendance (1280)
  await page.goto('http://localhost:5173/student/mess', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(AFTER_DIR, 'mess-attendance-1280.png') });
  console.log('✓ mess-attendance-1280.png');

  // 5. Refund Ledger (1280)
  await page.goto('http://localhost:5173/student/refunds', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(AFTER_DIR, 'refund-ledger-1280.png') });
  console.log('✓ refund-ledger-1280.png');

  // -------------------------------------------------------------
  // Viewport 2: Mobile 390 x 844
  // -------------------------------------------------------------
  console.log('[Capture] Capturing 390px mobile screenshots...');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });

  // 6. Student Home (390)
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(AFTER_DIR, 'student-home-390.png') });
  console.log('✓ student-home-390.png');

  // 7. Notification Popover (390)
  const mobileBell = await page.$('button[aria-label="View notifications"]');
  if (mobileBell) {
    await mobileBell.click();
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(AFTER_DIR, 'notifications-390.png') });
    console.log('✓ notifications-390.png');
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 400));
  }

  // 8. Notices (390)
  await page.goto('http://localhost:5173/student/notices?open=1', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(AFTER_DIR, 'notices-390.png') });
  console.log('✓ notices-390.png');

  // 9. Mess Attendance (390)
  await page.goto('http://localhost:5173/student/mess', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(AFTER_DIR, 'mess-attendance-390.png') });
  console.log('✓ mess-attendance-390.png');

  // 10. Refund Ledger (390)
  await page.goto('http://localhost:5173/student/refunds', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(AFTER_DIR, 'refund-ledger-390.png') });
  console.log('✓ refund-ledger-390.png');

  await browser.close();
  console.log('[Capture] All 10 screenshots captured successfully in docs/screenshots/after/!');
}

main().catch((err) => {
  console.error('[Capture Error]', err);
  process.exit(1);
});
