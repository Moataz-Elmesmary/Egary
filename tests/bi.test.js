// اختبار لوحة BI: المدخل، العدّادات، الأقسام، الدليل، الخروج يعيد الثيم
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { chromium } = require('playwright');
const URL_ = 'file://' + path.resolve(__dirname, '../Egary/index.html');
let browser;
test.before(async () => { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }); });
test.after(async () => { await browser.close(); });

test('BI: hero with counters, parallax tilt, enter → sections → drill-down drawer → exit restores theme', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL_); await page.waitForSelector('#btn-demo'); await page.evaluate(() => Egary.U.setToday('2026-10-09')); await page.click('#btn-demo'); await page.waitForSelector('.kpi');
  await page.evaluate(() => localStorage.setItem('egary-theme', 'light'));
  await page.goto(URL_ + '#/bi'); await page.waitForSelector('#bi-hero');
  assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
  await page.waitForTimeout(2200);
  const counters = await page.$$eval('#bi .counter b', els => els.map(e => e.textContent));
  assert.equal(counters.length, 4);
  const k = await page.evaluate(() => { const k = Egary.Engine.kpis({}); return { ytd: k.ytd.collected, units: k.counts.units, occ: Math.round((k.occupancy.rate || 0) * 100) }; });
  assert.equal(counters[3], String(k.units));
  assert.equal(counters[1], k.occ + '%');
  assert.ok(counters[0].replace(/[^\d]/g, '') === String(Math.round(k.ytd)), 'ytd counter settles on the exact value: ' + counters[0]);
  // parallax: moving the mouse changes the hero card transform
  await page.mouse.move(200, 150); await page.waitForTimeout(100);
  const t1 = await page.$eval('#bi .hero-card', e => e.style.transform);
  await page.mouse.move(1200, 700); await page.waitForTimeout(100);
  const t2 = await page.$eval('#bi .hero-card', e => e.style.transform);
  assert.ok(t1 && t2 && t1 !== t2, 'tilt changes with mouse: ' + t1 + ' vs ' + t2);
  // canvas is animating (pixels change between frames)
  const px = async () => page.evaluate(() => { const c = document.querySelector('#bi canvas.city'); const d = c.getContext('2d').getImageData(0, c.height - 60, 200, 50).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return s; });
  const a = await px(); await page.waitForTimeout(600); const b = await px();
  assert.notEqual(a, b, 'city canvas animates');
  await page.click('#bi-enter'); await page.waitForSelector('#bi-board.in'); await page.waitForTimeout(500);
  assert.ok(await page.$('#bi.boarded'));
  const tiles = await page.$$('#bi .tile'); assert.ok(tiles.length >= 8, 'overview tiles: ' + tiles.length);
  for (const s of ['collection', 'arrears', 'occupancy', 'contracts', 'projects', 'clients', 'maintenance']) {
    await page.click(`#bi-dock button[data-section="${s}"]`); await page.waitForTimeout(250);
    assert.ok((await page.$$('#bi .tile')).length >= (s === 'projects' ? 1 : 3), s + ' has tiles');
    assert.ok(await page.$('#bi-dock button.on[data-section="' + s + '"]'));
  }
  // الخريطة: وحدة في خريطة الإشغال تفتح بروفايلها
  await page.click('#bi-dock button[data-section="occupancy"]'); await page.waitForTimeout(250);
  await page.click('#bi .building-grid .u'); await page.waitForSelector('.drawer'); 
  assert.ok((await page.textContent('.drawer .d-head')).includes('—'));
  await page.mouse.click(30, 450); await page.waitForTimeout(200);
  // دليل من بطاقة المتأخرات
  await page.click('#bi-dock button[data-section="arrears"]'); await page.waitForTimeout(250);
  await page.click('#bi .tile'); await page.waitForSelector('.drawer table.tbl');
  const arrears = await page.evaluate(() => Egary.Engine.kpis({}).arrears.total);
  const foot = await page.textContent('.drawer tfoot');
  assert.ok(foot.replace(/[^\d]/g, '').includes(String(Math.round(arrears))), 'drawer total shows arrears ' + arrears + ' in ' + foot);
  await page.mouse.click(30, 450); await page.waitForTimeout(200);
  // الفلتر داخل BI يغيّر الأرقام
  await page.click('#bi-dock button[data-section="overview"]'); await page.waitForTimeout(250);
  const before = await page.textContent('#bi .board-head .sub');
  await page.click('#bi .chips button'); await page.waitForTimeout(300);
  const after = await page.textContent('#bi .board-head .sub');
  assert.notEqual(before, after, 'project chip filters the BI scope: ' + before + ' vs ' + after);
  assert.ok(after.includes('مُرشَّح'));
  await page.click('#bi .chips button.on'); await page.waitForTimeout(200);
  await page.click('#bi-exit'); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => location.hash), '#/dashboard');
  assert.equal(await page.getAttribute('html', 'data-theme'), 'light');
  assert.equal(await page.$('#bi'), null);
  assert.deepEqual(errors, []);
  await page.close();
});
