import { describe, it, expect, afterAll } from 'vitest';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import { seedNotifications } from '../scripts/seed-notifications.js';
import { closeAllPools } from '../server/src/db.js';

function getChromePath(): string | null {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

describe('Task 2: Notifications UI End-to-End', () => {
  afterAll(async () => {
    await closeAllPools();
  });

  it('clicking a notification navigates correctly and decrements the badge', async () => {
    const chromePath = getChromePath();
    if (!chromePath) {
      console.warn('Skipping UI test: Chrome executable not found.');
      return;
    }

    // Check if dev server is accessible
    try {
      const resp = await fetch('http://localhost:5173/api/health', { signal: AbortSignal.timeout(1500) }).catch(() =>
        fetch('http://localhost:5173', { signal: AbortSignal.timeout(1500) })
      );
      if (!resp.ok && resp.status !== 404 && resp.status !== 200) {
        console.warn('Skipping UI test: Vite dev server not responding on 5173.');
        return;
      }
    } catch {
      console.warn('Skipping UI test: Local server not reachable.');
      return;
    }

    await seedNotifications();

    const browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });

      await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });

      // Fill credentials for Krishna Gupta
      await page.waitForSelector('input[name="loginId"], input[type="text"]');
      const userInput = await page.$('input[name="loginId"], input[type="text"]');
      const passInput = await page.$('input[name="password"], input[type="password"]');
      expect(userInput).toBeTruthy();
      expect(passInput).toBeTruthy();

      await userInput!.click({ clickCount: 3 });
      await userInput!.type('2026UITX0192');
      await passInput!.click({ clickCount: 3 });
      await passInput!.type('Password@123');

      const submitBtn = await page.$('button[type="submit"]');
      expect(submitBtn).toBeTruthy();
      await submitBtn!.click();

      // Wait for dashboard and bell with unread badge
      await page.waitForSelector('button[aria-label*="notification" i], button[aria-label*="unread" i]', { timeout: 10000 });
      const bellBtn = await page.$('button[aria-label*="notification" i], button[aria-label*="unread" i]');
      expect(bellBtn).toBeTruthy();

      // Read initial badge count (3 unread)
      await page.waitForSelector('button[aria-label*="notification" i] span.rounded-full, button[aria-label*="unread" i] span.rounded-full', { timeout: 5000 });
      const badgeEl = await bellBtn!.$('span.rounded-full');
      const initialBadge = badgeEl ? await page.evaluate(el => el.textContent?.trim(), badgeEl) : '0';
      expect(initialBadge).toBe('3');

      // Click bell to open popover
      await bellBtn!.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 3000 });

      // Wait for list items to render
      await page.waitForSelector('[role="dialog"] button:has(span.bg-saffron)', { timeout: 5000 });
      const unreadItem = await page.$('[role="dialog"] button:has(span.bg-saffron)');
      expect(unreadItem).toBeTruthy();

      // Click first unread notification
      await unreadItem!.click();

      // Verify navigation to /notices?open=1
      await page.waitForFunction(() => window.location.pathname === '/notices', { timeout: 5000 });
      expect(page.url()).toContain('/notices?open=1');

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
      expect(updatedBadge).toBe('2');
    } finally {
      await browser.close();
    }
  }, 35000);
});
