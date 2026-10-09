const { chromium } = require('playwright');
const path = require('path');
const SHOTS = '/tmp/claude-0/-home-user-Egary/e8cec96e-9e54-59ec-a68b-cc761d4144c6/scratchpad/shots';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  const url = 'file://' + path.resolve(__dirname, '../Egary/index.html');
  await page.goto(url); await page.waitForSelector('#btn-demo'); await page.click('#btn-demo'); await page.waitForSelector('.kpi');
  await page.goto(url + '#/bi'); await page.waitForSelector('#bi-hero'); await page.mouse.move(900, 300); await page.waitForTimeout(1800);
  await page.screenshot({ path: SHOTS + '/10-bi-hero.png' });
  await page.click('#bi-enter'); await page.waitForTimeout(900);
  await page.screenshot({ path: SHOTS + '/11-bi-overview.png', fullPage: false });
  for (const s of ['collection', 'arrears', 'occupancy', 'contracts', 'projects', 'clients', 'maintenance']) {
    await page.click(`#bi-dock button[data-section="${s}"]`); await page.waitForTimeout(500);
    await page.screenshot({ path: SHOTS + `/12-bi-${s}.png` });
  }
  await page.click('#bi-dock button[data-section="overview"]'); await page.waitForTimeout(300);
  await page.click('#bi .tile'); await page.waitForSelector('.drawer'); await page.waitForTimeout(300);
  await page.screenshot({ path: SHOTS + '/13-bi-drawer.png' });
  await page.click('#bi-exit').catch(() => {});
  await page.waitForTimeout(300);
  console.log('hash after exit', await page.evaluate(() => location.hash), 'theme', await page.evaluate(() => document.documentElement.dataset.theme));
  console.log('errors:', errors.length); errors.forEach(e => console.log('  ', e));
  await b.close();
})().catch(e => { console.error('BI SMOKE FAIL', e.message); process.exit(1); });
