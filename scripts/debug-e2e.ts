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
  await new Promise<void>((r) => server.listen(4501, r));

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const page = await browser.newPage();
  page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('BROWSER PAGEERROR:', err.message));

  console.log('Navigating to http://localhost:4501 ...');
  await page.goto('http://localhost:4501/');
  await page.waitForLoadState('networkidle');

  console.log('Logging in as office...');
  await page.fill('input[type="text"]', 'office');
  await page.fill('input[type="password"]', 'Password@123');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(1000);
  console.log('Current URL after submit:', page.url());

  console.log('Navigating to http://localhost:4501/office/allotment-run ...');
  await page.goto('http://localhost:4501/office/allotment-run');
  await page.waitForTimeout(2000);
  console.log('Current URL after goto:', page.url());

  const h2Text = await page.$$eval('h1, h2, h3', (els) => els.map((e) => e.textContent));
  console.log('Found headings:', h2Text);

  await browser.close();
  server.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
