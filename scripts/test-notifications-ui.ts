import puppeteer from 'puppeteer-core';
import fs from 'fs';
import { seedNotifications } from './seed-notifications.js';
import { pool, closeAllPools } from '../server/src/db.js';

function getChromePath(): string {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Chrome executable not found on system.');
}

async function run() {
  console.log('[UI Test] 1. Reseeding notifications...');
  await seedNotifications();

  console.log('[UI Test] 2. Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: getChromePath(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    console.log('[UI Test] 3. Navigating to login...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });

    // Fill credentials for Krishna Gupta
    await page.waitForSelector('input[name="loginId"], input[placeholder*="roll" i], input[type="text"]');
    const userInput = await page.$('input[name="loginId"], input[type="text"]');
    const passInput = await page.$('input[name="password"], input[type="password"]');
    if (!userInput || !passInput) throw new Error('Could not find login inputs');

    await userInput.click({ clickCount: 3 });
    await userInput.type('2026UITX0192');
    await passInput.click({ clickCount: 3 });
    await passInput.type('Password@123');

    // Click submit
    const submitBtn = await page.$('button[type="submit"]');
    if (!submitBtn) throw new Error('Could not find submit button');
    await submitBtn.click();

    // Wait for student dashboard to load
    await page.waitForSelector('button[aria-label*="notification" i], button[aria-label*="unread" i]', { timeout: 10000 });
    console.log('[UI Test] Logged in successfully.');

    // Find notification bell
    const bellBtn = await page.$('button[aria-label*="notification" i], button[aria-label*="unread" i]');
    if (!bellBtn) throw new Error('Notification bell button not found');

    // Read initial badge count
    const badgeEl = await bellBtn.$('span.rounded-full');
    const initialBadgeText = badgeEl ? await page.evaluate(el => el.textContent?.trim(), badgeEl) : '0';
    console.log(`[UI Test] Initial notification badge: "${initialBadgeText}"`);
    if (initialBadgeText !== '3') {
      throw new Error(`Expected initial badge 3, got "${initialBadgeText}"`);
    }

    // Click bell to open popover
    console.log('[UI Test] 4. Clicking bell to open popover...');
    await bellBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
    console.log('[UI Test] Popover opened. Waiting for notification items to load...');

    // Wait for the notifications list to populate via async fetch
    await page.waitForSelector('[role="dialog"] button:has(span.bg-saffron)', { timeout: 5000 });

    // Verify unread items inside popover
    const notifButtons = await page.$$('[role="dialog"] button');
    console.log(`[UI Test] Found ${notifButtons.length} interactive elements in popover.`);

    // Find the first unread notification button
    const firstNotif = await page.$('[role="dialog"] button:has(span.bg-saffron)');
    if (!firstNotif) {
      throw new Error('Could not find an unread notification in popover');
    }

    // Click the notification
    console.log('[UI Test] 5. Clicking first unread notification...');
    await firstNotif.click();

    // Wait for navigation and URL update
    await page.waitForFunction(() => window.location.pathname === '/notices', { timeout: 5000 });
    const currentUrl = page.url();
    console.log(`[UI Test] Current URL after click: ${currentUrl}`);
    if (!currentUrl.includes('/notices?open=1')) {
      throw new Error(`Expected URL to include /notices?open=1, got ${currentUrl}`);
    }

    // Verify badge decremented to 2
    await page.waitForFunction(() => {
      const btn = document.querySelector('button[aria-label*="notification" i], button[aria-label*="unread" i]');
      const badge = btn?.querySelector('span.rounded-full');
      return badge?.textContent?.trim() === '2';
    }, { timeout: 5000 });

    const updatedBadge = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label*="notification" i], button[aria-label*="unread" i]');
      return btn?.querySelector('span.rounded-full')?.textContent?.trim();
    });
    console.log(`[UI Test] Decremented badge count: "${updatedBadge}"`);
    if (updatedBadge !== '2') {
      throw new Error(`Expected badge count to decrement to 2, got "${updatedBadge}"`);
    }

    // Test Mark All As Read
    console.log('[UI Test] 6. Testing "Mark all as read"...');
    const freshBellBtn = await page.waitForSelector('button[aria-label*="notification" i], button[aria-label*="unread" i]');
    if (!freshBellBtn) throw new Error('Bell button not found on new page');
    await freshBellBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('[role="dialog"] button'));
      const markAll = buttons.find(b => b.textContent?.includes('Mark all as read'));
      if (markAll) {
        (markAll as HTMLElement).click();
      } else {
        throw new Error('Mark all as read button not found in popover');
      }
    });

    // Verify badge disappears (count becomes 0)
    await page.waitForFunction(() => {
      const btn = document.querySelector('button[aria-label*="notification" i], button[aria-label*="unread" i]');
      const badge = btn?.querySelector('span.rounded-full');
      return !badge;
    }, { timeout: 5000 });
    console.log('[UI Test] Badge successfully disappeared after Mark all as read.');

    console.log('✅ ALL UI NOTIFICATION TESTS PASSED!');
  } finally {
    await browser.close();
    await closeAllPools();
  }
}

run().catch((err) => {
  console.error('[UI Test Error]:', err);
  process.exit(1);
});
