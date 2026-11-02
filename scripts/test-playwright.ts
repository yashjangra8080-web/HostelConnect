import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const page = await browser.newPage();
  await page.goto('https://example.com');
  const title = await page.title();
  console.log('Playwright Chrome Launched Successfully! Title:', title);
  await browser.close();
}

main().catch((err) => {
  console.error('Playwright launch error:', err);
  process.exit(1);
});
