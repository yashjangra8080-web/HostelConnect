import path from 'path';
import fs from 'fs';
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BEFORE_DIR = path.resolve('docs/screenshots/before');

async function main() {
  if (!fs.existsSync(BEFORE_DIR)) {
    fs.mkdirSync(BEFORE_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });

  // Check if login needed
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  const loginInput = await page.$('input[type="text"]');
  if (loginInput) {
    await loginInput.type('2026UITX0192');
    await page.type('input[type="password"]', 'Password@123');
    await page.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 1500));
  }

  // A. Student Home
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(BEFORE_DIR, 'student-home-390.png') });
  console.log('Captured student-home-390');

  // B. Notification bell / drawer
  const bellBtn = await page.$('button[aria-label="View notifications"]');
  if (bellBtn) {
    await bellBtn.click();
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(BEFORE_DIR, 'notifications-390.png') });
    console.log('Captured notifications-390');
  }

  // C. Notices
  await page.goto('http://localhost:5173/student/notices', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(BEFORE_DIR, 'notices-390.png') });
  console.log('Captured notices-390');

  // D. Mess Attendance
  await page.goto('http://localhost:5173/student/mess', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(BEFORE_DIR, 'mess-attendance-390.png') });
  console.log('Captured mess-attendance-390');

  // E. Refund Ledger
  await page.goto('http://localhost:5173/student/refunds', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(BEFORE_DIR, 'refund-ledger-390.png') });
  console.log('Captured refund-ledger-390');

  await browser.close();
  console.log('390px Before screenshots captured successfully!');
}

main().catch(console.error);
