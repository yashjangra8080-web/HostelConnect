import http from 'http';
import path from 'path';
import express from 'express';
import { chromium } from 'playwright';

process.env.NODE_ENV = 'test';
import { app } from '../server/src/index.js';

app.use(express.static(path.resolve('web/dist')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.resolve('web/dist/index.html'));
});

async function main() {
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(4502, r));

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  console.log('Logging in at 390px ...');
  await page.goto('http://localhost:4502/');
  await page.fill('input[type="text"]', '2026UCSDS0001');
  await page.fill('input[type="password"]', 'Password@123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('header', { timeout: 10000 });

  // Navigate to student/apply
  await page.goto('http://localhost:4502/student/apply');
  await page.waitForLoadState('networkidle');

  const overflowingElements = await page.evaluate(() => {
    const results: any[] = [];
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const rect = el.getBoundingClientRect();
      if (rect.right > 390.5 || el.scrollWidth > 390.5) {
        results.push({
          tag: el.tagName,
          id: el.id,
          className: (el.className || '').toString().slice(0, 100),
          rectRight: Math.round(rect.right),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          text: (el.textContent || '').trim().slice(0, 40),
        });
      }
    }
    return results;
  });

  console.log('Overflowing elements on /student/apply at 390px:');
  console.table(overflowingElements.slice(0, 15));

  await browser.close();
  server.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
