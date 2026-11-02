import path from 'path';
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\hp\\.gemini\\antigravity\\brain\\4b3aae4c-d258-4307-a56a-448addc576f7';

async function capture() {
  console.log('[Screenshot] Launching Chrome headless via puppeteer-core...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
    args: ['--no-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();

    // 1. Notice Hub Screenshot
    console.log('[Screenshot] 1. Capturing Notice Hub...');
    await page.goto('http://localhost:5173/?tab=notices', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 2000));
    const noticeHubPath = path.join(ARTIFACT_DIR, 'notice-hub.png');
    await page.screenshot({ path: noticeHubPath });
    console.log(`[Screenshot] Saved Notice Hub to: ${noticeHubPath}`);

    // 2. Water Quality Surveillance Screenshot
    console.log('[Screenshot] 2. Capturing Water Quality Surveillance & 10-Week Trend...');
    await page.goto('http://localhost:5173/?tab=water', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 2000));
    const waterQualityPath = path.join(ARTIFACT_DIR, 'water-quality.png');
    await page.screenshot({ path: waterQualityPath });
    console.log(`[Screenshot] Saved Water Quality to: ${waterQualityPath}`);

    // 3. Maintenance 7-Day Grid Screenshot
    console.log('[Screenshot] 3. Capturing Maintenance 7-Day Grid...');
    await page.goto('http://localhost:5173/?tab=maintenance', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 2000));
    const maintenancePath = path.join(ARTIFACT_DIR, 'maintenance-grid.png');
    await page.screenshot({ path: maintenancePath });
    console.log(`[Screenshot] Saved Maintenance Grid to: ${maintenancePath}`);

    // 4. Notification Centre (Bell Popover & Dropdown)
    console.log('[Screenshot] 4. Capturing Notification Dropdown Popover...');
    // Click the bell button in topbar to open popover
    const bellBtn = await page.$('header button[title="Notifications"]');
    if (bellBtn) {
      await bellBtn.click();
      await new Promise((r) => setTimeout(r, 800));
    }
    const bellDropdownPath = path.join(ARTIFACT_DIR, 'notifications-dropdown.png');
    await page.screenshot({ path: bellDropdownPath });
    console.log(`[Screenshot] Saved Notification Dropdown to: ${bellDropdownPath}`);

    // 5. Full Notification Centre Page
    console.log('[Screenshot] 5. Capturing Full Notification Centre Page...');
    await page.goto('http://localhost:5173/?tab=notifications', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 2000));
    const notifsPagePath = path.join(ARTIFACT_DIR, 'notifications-full.png');
    await page.screenshot({ path: notifsPagePath });
    console.log(`[Screenshot] Saved Full Notification Centre to: ${notifsPagePath}`);

    console.log('[Screenshot] All Phase 6 screenshots captured successfully!');
  } finally {
    await browser.close();
  }
}

capture().catch((err) => {
  console.error('[Screenshot] Error:', err);
  process.exit(1);
});
