// اختبارات انحدار للوحة BI (نتائج الفحص 44 و45 و46 و47 و48 و30) — Playwright على نسخة العرض
// منقولة من مجسّات الفحص scan/bi/probe1..4 — كل اختبار يفتح سياقًا جديدًا، ولا يُشغَّل الملف بـ --test-name-pattern (فيه before()).
// التشغيل: cd /home/user/Egary && NODE_PATH=/opt/node22/lib/node_modules node --test tests/fix-bi.test.js
// EGARY_APP=<مسار index.html> يوجّه الاختبارات إلى نسخة أخرى من التطبيق (للتحقق من أنها تفشل على الشفرة القديمة).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { chromium } = require('playwright');
const APP = 'file://' + (process.env.EGARY_APP || path.resolve(__dirname, '../Egary/index.html'));
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TODAY = '2026-10-09';
let browser;
test.before(async () => { browser = await chromium.launch({ executablePath: CHROME }); });
test.after(async () => { await browser.close(); });

/* ---------- أدوات ---------- */
async function openDemo(hash) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(APP + (hash || ''));
  await page.waitForSelector('#btn-demo');
  await page.evaluate(t => Egary.U.setToday(t), TODAY);
  await page.evaluate(() => localStorage.setItem('egary-theme', 'light'));
  await page.click('#btn-demo');
  await page.waitForSelector('#content .kpis .kpi, #bi', { timeout: 15000 });
  return { page, ctx, errors };
}
async function enterBI(page, hash) {
  await page.evaluate((h) => { location.hash = h; }, hash || '#/bi');
  await page.waitForSelector('#bi-hero', { timeout: 10000 });
  await page.click('#bi-enter');
  await page.waitForSelector('#bi-board.in');
  await page.waitForTimeout(150);
}
const state = (page) => page.evaluate(() => ({ bi: !!document.querySelector('#bi'), drawer: !!document.querySelector('.drawer'), overlay: !!document.querySelector('.overlay'), hash: location.hash, route: Egary.App.route.view, theme: document.documentElement.dataset.theme, title: (document.querySelector('#page-title') || {}).textContent || '' }));
const tipDisplay = (page) => page.evaluate(() => { const t = document.querySelector('.tip'); return t ? t.style.display : null; });
async function keydownListeners(client) {
  const { result } = await client.send('Runtime.evaluate', { expression: 'document' });
  const { listeners } = await client.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
  return listeners.filter(l => l.type === 'keydown').map(l => (l.useCapture ? 'capture' : 'bubble')).sort();
}
async function walkPrev(page, max) {
  let steps = 0;
  while (!(await page.$eval('#bi-period-prev', e => e.disabled)) && steps < (max || 40)) { await page.click('#bi-period-prev'); await page.waitForTimeout(60); steps++; }
  return { steps, period: await page.evaluate(() => Egary.App.filter.period), label: await page.textContent('#bi-period-label') };
}

/* ---------- 44: Escape داخل BI يغلق الطبقة العليا فقط (الدرج/النافذة) ولا يخرج من اللوحة معها ---------- */
test('44: Escape peels modal → drawer → BI one layer at a time (capture-phase handler, removed on close)', async () => {
  const { page, ctx, errors } = await openDemo();
  const client = await ctx.newCDPSession(page);
  const kd0 = await keydownListeners(client);
  await enterBI(page);
  const kd1 = await keydownListeners(client);
  assert.equal(kd1.filter(x => x === 'capture').length, kd0.filter(x => x === 'capture').length + 1, 'BI listens in the capture phase: ' + kd1);
  await page.click('#bi-dock button[data-section="arrears"]'); await page.waitForTimeout(200);
  await page.click('#bi .tile'); await page.waitForSelector('.drawer');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  let s = await state(page);
  assert.deepEqual([s.drawer, s.bi, s.hash, s.theme], [false, true, '#/bi', 'dark'], 'drawer closed, BI kept: ' + JSON.stringify(s));
  await page.evaluate(() => Egary.UI.modal({ title: 'x', body: 'y' })); await page.waitForSelector('.overlay');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  s = await state(page);
  assert.deepEqual([s.overlay, s.bi, s.hash], [false, true, '#/bi'], 'modal closed, BI kept: ' + JSON.stringify(s));
  // درج + نافذة فوقه: ثلاث ضغطات تقشر النافذة ثم الدرج ثم اللوحة
  await page.click('#bi .tile'); await page.waitForSelector('.drawer');
  await page.evaluate(() => Egary.UI.modal({ title: 'x', body: 'y' })); await page.waitForSelector('.overlay');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200); const s1 = await state(page);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200); const s2 = await state(page);
  await page.keyboard.press('Escape'); await page.waitForTimeout(350); const s3 = await state(page);
  assert.deepEqual([s1.overlay, s1.drawer, s1.bi], [false, true, true]);
  assert.deepEqual([s2.overlay, s2.drawer, s2.bi], [false, false, true]);
  assert.deepEqual([s3.bi, s3.hash, s3.route, s3.theme], [false, '#/dashboard', 'dashboard', 'light']);
  assert.deepEqual(await keydownListeners(client), kd0, 'capture listener removed on close');
  assert.deepEqual(errors, []);
  await ctx.close();
});

/* ---------- 46: الخروج يعيد المسار إلى لوحة المؤشرات مهما كان شكل الرابط ---------- */
test('46: exit from #/bi/, #/bi?project=P01 and #/bi/x lands on the dashboard route (App.go / back unchanged)', async () => {
  const { page, ctx, errors } = await openDemo();
  for (const hsh of ['#/bi', '#/bi/', '#/bi?project=P01', '#/bi/x']) {
    await page.evaluate(() => { location.hash = '#/units'; }); await page.waitForTimeout(150);
    await enterBI(page, hsh);
    assert.equal((await state(page)).bi, true, 'BI opened from ' + hsh);
    await page.click('#bi-exit'); await page.waitForTimeout(350);
    const s = await state(page);
    assert.deepEqual([s.bi, s.hash, s.route, s.title, s.theme], [false, '#/dashboard', 'dashboard', 'لوحة المؤشرات', 'light'], 'exit from ' + hsh + ': ' + JSON.stringify(s));
  }
  await enterBI(page, '#/bi/');
  await page.keyboard.press('Escape'); await page.waitForTimeout(350);
  let s = await state(page);
  assert.deepEqual([s.bi, s.hash, s.route], [false, '#/dashboard', 'dashboard'], 'Escape exit from #/bi/');
  // الانتقال بـ go() من داخل اللوحة يحتفظ بالوجهة (render → close(true))، والرجوع بالمتصفح يغلق اللوحة
  await enterBI(page);
  await page.evaluate(() => Egary.App.go('ledger')); await page.waitForTimeout(350);
  s = await state(page);
  assert.deepEqual([s.bi, s.hash, s.route], [false, '#/ledger', 'ledger']);
  await enterBI(page);
  await page.goBack(); await page.waitForTimeout(400);
  s = await state(page);
  assert.deepEqual([s.bi, s.hash], [false, '#/ledger']);
  assert.deepEqual(errors, []);
  await ctx.close();
});

/* ---------- 47: التلميح لا يبقى عالقًا بعد إعادة رسم اللوحة أو إغلاقها تحت المؤشر ---------- */
test('47: tooltip hides when a store change re-renders the board, on section switch, and when BI closes under the cursor', async () => {
  const { page, ctx, errors } = await openDemo();
  const hoverUnit = async () => { await page.mouse.move(700, 120); await page.waitForTimeout(80); await page.locator('#bi .building-grid .u').first().hover(); await page.waitForTimeout(150); };
  await enterBI(page);
  await page.click('#bi-dock button[data-section="occupancy"]'); await page.waitForTimeout(250);
  await hoverUnit();
  assert.equal(await tipDisplay(page), 'block', 'tooltip shows on hover');
  await page.evaluate(() => { Egary.Store.applyOp({ type: 'settings', record: { vacancyMonths: 4 } }); Egary.Store.notify('change'); });
  await page.waitForTimeout(250);
  assert.equal(await tipDisplay(page), 'none', 'hidden after a store-triggered re-render');
  await hoverUnit();
  assert.equal(await tipDisplay(page), 'block', 'works again after the re-render');
  await page.click('#bi-dock button[data-section="overview"]'); await page.waitForTimeout(250);
  assert.equal(await tipDisplay(page), 'none', 'section switch hides it');
  // الخروج من اللوحة (Escape ثم زر الخروج) والمؤشر فوق وحدة
  await page.click('#bi-dock button[data-section="occupancy"]'); await page.waitForTimeout(250);
  await hoverUnit(); assert.equal(await tipDisplay(page), 'block');
  await page.keyboard.press('Escape'); await page.waitForTimeout(350);
  assert.equal((await state(page)).bi, false);
  assert.equal(await tipDisplay(page), 'none', 'hidden after Escape-exit');
  await enterBI(page);
  await page.click('#bi-dock button[data-section="occupancy"]'); await page.waitForTimeout(250);
  await hoverUnit(); assert.equal(await tipDisplay(page), 'block');
  await page.evaluate(() => document.querySelector('#bi-exit').click()); await page.waitForTimeout(350); // نقر برمجي حتى يبقى المؤشر مكانه
  assert.equal((await state(page)).bi, false);
  assert.equal(await tipDisplay(page), 'none', 'hidden after exit-button close');
  assert.deepEqual(errors, []);
  await ctx.close();
});

/* ---------- 45: الحد الأدنى لمتصفح الشهر يتبع «المحاسبة من» الفعلية (السلايسر) لا الإعداد وحده ---------- */
test('45: period navigator lower bound follows the effective accounting start (slicer over setting, both directions)', async () => {
  const { page, ctx, errors } = await openDemo();
  await page.evaluate(() => { Egary.Store.applyOp({ type: 'settings', record: { ledgerYears: [2025, 2026], trackingFrom: '2026-01', trackingMode: 'manual' } }); Egary.App.filter.period = ''; Egary.App.filter.from = '2025-01'; Egary.Store.notify('change'); });
  await enterBI(page);
  const eff = await page.evaluate(() => ({ tf: Egary.Store.state().settings.trackingFrom, eff: Egary.Engine.trackingFrom(), sel: (document.querySelector('#bi-from-pick') || {}).value }));
  assert.deepEqual(eff, { tf: '2026-01', eff: '2025-01', sel: '2025-01' });
  let w = await walkPrev(page);
  assert.deepEqual([w.period, w.steps], ['2025-01', 21], 'slicer 2025-01 over setting 2026-01 walks back to 2025-01: ' + JSON.stringify(w));
  assert.ok(w.label.includes('2025'), w.label);
  // العكس: الإعداد 2025-01 والسلايسر 2026-01 → يقف عند 2026-01
  await page.evaluate(() => { Egary.App.filter.period = ''; Egary.App.filter.from = '2026-01'; Egary.Store.applyOp({ type: 'settings', record: { trackingFrom: '2025-01', trackingMode: 'manual' } }); Egary.Store.notify('change'); });
  await page.waitForTimeout(250);
  w = await walkPrev(page);
  assert.deepEqual([w.period, w.steps], ['2026-01', 9], 'slicer 2026-01 over setting 2025-01 stops at 2026-01: ' + JSON.stringify(w));
  // بلا سلايسر → الإعداد يحكم
  await page.evaluate(() => { Egary.App.filter.period = ''; Egary.App.filter.from = ''; Egary.Store.notify('change'); });
  await page.waitForTimeout(250);
  w = await walkPrev(page);
  assert.deepEqual([w.period, w.steps], ['2025-01', 21], 'no slicer → setting 2025-01 governs: ' + JSON.stringify(w));
  assert.deepEqual(errors, []);
  await ctx.close();
});

/* ---------- 48: تلميح زر الشهر يسمّي الوجهة الحقيقية للنقر ---------- */
test('48: period label title says «آخر شهر مسجَّل» when the default month is the last recorded one, «الشهر الحالي» otherwise', async () => {
  const { page, ctx, errors } = await openDemo();
  // آخر شهر مسجَّل = أغسطس (يدويًا) والشهر الحالي أكتوبر → الافتراضي أغسطس والنقر يعود إليه
  await page.evaluate(() => { Egary.App.filter.period = ''; Egary.Store.applyOp({ type: 'settings', record: { enteredThrough: '2026-08' } }); Egary.Store.notify('change'); });
  await enterBI(page);
  const k0 = await page.evaluate(() => { const k = Egary.Engine.kpis(Egary.App.filter); return { period: k.period, cur: k.currentPeriod, et: k.enteredThrough }; });
  assert.deepEqual(k0, { period: '2026-08', cur: '2026-10', et: '2026-08' });
  assert.equal(await page.$eval('#bi-period-label', e => e.title), 'شهر التقرير');
  const l0 = await page.textContent('#bi-period-label');
  assert.ok(l0.includes('أغسطس'), l0);
  await page.click('#bi-period-prev'); await page.waitForTimeout(200);
  assert.equal(await page.$eval('#bi-period-label', e => e.title), 'العودة إلى آخر شهر مسجَّل');
  await page.click('#bi-period-label'); await page.waitForTimeout(200);
  assert.equal(await page.textContent('#bi-period-label'), l0, 'click returns to the last recorded month');
  // آخر شهر مسجَّل = الشهر الحالي → النقر يعود إلى الشهر الحالي والتلميح يقول ذلك
  await page.evaluate(() => { Egary.App.filter.period = ''; Egary.Store.applyOp({ type: 'settings', record: { enteredThrough: '2026-10' } }); Egary.Store.notify('change'); });
  await page.waitForTimeout(250);
  const l1 = await page.textContent('#bi-period-label');
  assert.ok(l1.includes('أكتوبر'), l1);
  await page.click('#bi-period-prev'); await page.waitForTimeout(200);
  assert.equal(await page.$eval('#bi-period-label', e => e.title), 'العودة إلى الشهر الحالي');
  await page.click('#bi-period-label'); await page.waitForTimeout(200);
  assert.equal(await page.textContent('#bi-period-label'), l1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

/* ---------- 30: بطاقة «محصَّل السنة» تعدّ دفعات السنة لا كل الدفعات ---------- */
test('30: overview tile «محصَّل السنة» detail counts the YTD payments, not all payments', async () => {
  const { page, ctx, errors } = await openDemo();
  await enterBI(page);
  const tileDetail = () => page.$eval('#bi .tile[data-kpi="محصَّل السنة"] .d', e => e.textContent);
  const k0 = await page.evaluate(() => { const k = Egary.Engine.kpis(Egary.App.filter); return { ytdRows: k.ytd.rows.length, payments: k.counts.payments }; });
  assert.equal(await tileDetail(), `${k0.ytdRows} دفعة`);
  // دفعة من سنة سابقة على عقد موجود: counts.payments يزيد، وبطاقة السنة لا تتغيّر
  await page.evaluate(() => { const ct = Egary.Store.state().contracts[0]; Egary.Store.applyOp({ type: 'upsert', entity: 'payments', code: 'INV-2025-9001', record: { code: 'INV-2025-9001', contractCode: ct.code, period: '2025-06', amount: 1000, paidOn: '2025-06-05', source: 'excel' } }); Egary.Store.notify('change'); });
  await page.waitForTimeout(300);
  const k1 = await page.evaluate(() => { const k = Egary.Engine.kpis(Egary.App.filter); return { ytdRows: k.ytd.rows.length, payments: k.counts.payments }; });
  assert.equal(k1.payments, k0.payments + 1);
  assert.equal(k1.ytdRows, k0.ytdRows);
  assert.equal(await tileDetail(), `${k0.ytdRows} دفعة`, 'tile detail unchanged by a prior-year payment');
  await page.click('#bi .tile[data-kpi="محصَّل السنة"]'); await page.waitForSelector('.drawer table.tbl');
  assert.equal(await page.locator('.drawer table.tbl tbody tr').count(), k0.ytdRows, 'drawer lists exactly that many payments');
  assert.deepEqual(errors, []);
  await ctx.close();
});
