// لقطات سريعة لكل شاشة + رصد أخطاء الكونسول (وضع التجربة)
const { chromium } = require('playwright');
const path = require('path');
const SHOTS = process.argv[2] || '/tmp/claude-0/-home-user-Egary/e8cec96e-9e54-59ec-a68b-cc761d4144c6/scratchpad/shots';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  const url = 'file://' + path.resolve(__dirname, '../Egary/index.html');
  await page.goto(url);
  await page.waitForSelector('#btn-demo', { timeout: 10000 });
  await page.screenshot({ path: SHOTS + '/00-welcome.png' });
  await page.click('#btn-demo');
  await page.waitForSelector('.kpi', { timeout: 10000 });
  await page.screenshot({ path: SHOTS + '/01-dashboard.png', fullPage: true });
  for (const v of ['ledger', 'insights', 'projects', 'units', 'clients', 'contracts', 'payments', 'maintenance', 'quality', 'audit', 'settings']) {
    await page.goto(url + '#/' + v); await page.waitForTimeout(400);
    await page.screenshot({ path: SHOTS + `/02-${v}.png`, fullPage: true });
  }
  await page.goto(url + '#/units'); await page.waitForTimeout(300);
  await page.click('table.tbl tbody tr'); await page.waitForSelector('.drawer'); await page.waitForTimeout(300);
  await page.screenshot({ path: SHOTS + '/03-unit-profile.png', fullPage: true });
  await page.keyboard.press('Escape');
  await page.mouse.click(30, 450); await page.waitForTimeout(200);
  await page.goto(url + '#/contracts'); await page.waitForTimeout(300);
  await page.click('table.tbl tbody tr'); await page.waitForSelector('.drawer'); await page.waitForTimeout(300);
  await page.screenshot({ path: SHOTS + '/04-contract-profile.png', fullPage: true });
  await page.mouse.click(30, 450); await page.waitForTimeout(200);
  await page.goto(url + '#/dashboard'); await page.waitForTimeout(300);
  await page.click('.kpi'); await page.waitForTimeout(300);
  await page.screenshot({ path: SHOTS + '/05-evidence.png', fullPage: true });
  await page.mouse.click(30, 450); await page.waitForTimeout(200);
  await page.click('text=عقد جديد'); await page.waitForSelector('.modal'); await page.waitForTimeout(300);
  await page.screenshot({ path: SHOTS + '/06-contract-form.png', fullPage: true });
  await page.keyboard.press('Escape');
  await page.click('#theme-btn'); await page.waitForTimeout(300);
  await page.screenshot({ path: SHOTS + '/07-dark.png', fullPage: true });
  console.log('errors:', errors.length); errors.forEach(e => console.log('  ', e));
  await b.close();
})().catch(e => { console.error('SMOKE FAIL', e.message); process.exit(1); });
