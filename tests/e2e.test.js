// اختبارات شاملة (E2E) للموقع عبر Playwright: شاشة البداية، الوضع التجريبي، الربط بملف الإكسيل الحقيقي
// (محوِّل ذاكرة)، الفلاتر، البحث، الروابط العميقة، الإضافة/التعديل/الحذف مع الكتابة في الإكسيل،
// المزامنة في الاتجاهين، القفل، الفاتورة، الثيم، تكامل كشف التحصيل، التحليلات، الموبايل.
// التشغيل: cd /home/user/Egary && NODE_PATH=/opt/node22/lib/node_modules node --test tests/e2e.test.js
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const APP = 'file://' + path.resolve(__dirname, '../Egary/index.html');
const XLSX_B64 = fs.readFileSync(path.resolve(__dirname, '../Egary/Egary.xlsx')).toString('base64');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const TODAY = '2026-10-09';           // «اليوم» المثبَّت — كل الأرقام أدناه محسوبة عليه
const TIMEOUT = 60000;

/* أرقام الملف الحقيقي (Egary/Egary.xlsx) كما في 2026-10-09 */
const REAL = { projects: 3, units: 71, clients: 64, contracts: 73, payments: 509, ledgerRows: 73, ledgerTotal: '10,339,823' };
// عقد ساري طوال 2026 بإيجار ثابت 30,250: يناير مسدَّد، سبتمبر وأكتوبر متأخران بلا سداد
// (T0001 في الملف ينتهي 2026-05-31، فخانة سبتمبر له «خارج العقد» ولا يُقترح لها مبلغ — لذا نستخدم T0016)
const CT = { code: 'T0016', unit: 'P02-404', rent: 30250, rentFmt: '30,250' };

let browser;
before(async () => { browser = await chromium.launch({ executablePath: CHROME }); });
after(async () => { if (browser) await browser.close(); });

/* ---------- أدوات ---------- */
function py(script, ...args) { return JSON.parse(execFileSync('python3', ['-I', '-c', script, ...args], { encoding: 'utf-8' })); }
const num = (t) => { const s = String(t || '').replace(/[^\d.-]/g, ''); return s === '' || s === '-' ? 0 : Number(s); };

async function openApp(opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(APP);
  await page.waitForSelector('#btn-demo');
  await page.evaluate(t => Egary.U.setToday(t), TODAY); // قبل أي نقرة: «اليوم» ثابت
  return { page, ctx, errors };
}
/* اختبار بصفحة جديدة + جمع أخطاء الكونسول وفحصها في النهاية */
function e2e(name, fn, opts) {
  test(name, { timeout: TIMEOUT }, async () => {
    const { page, ctx, errors } = await openApp(opts);
    try {
      await fn(page, errors);
      assert.deepEqual(errors, [], 'console/page errors');
    } catch (e) {
      if (errors.length) e.message += '\n[console/page errors]\n' + errors.join('\n');
      throw e;
    } finally { await ctx.close(); }
  });
}
/* الوضع المرتبط: الملف الحقيقي في محوِّل ذاكرة (بلا منتقي ملفات) */
async function linkReal(page) {
  await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
    const adapter = Egary.FileLink.memoryAdapter(bytes, 'Egary.xlsx');
    window.__adapter = adapter;
    await Egary.App.linkAdapter(adapter);
  }, XLSX_B64);
  await page.waitForSelector('#content .kpis .kpi');
  await page.waitForFunction(() => Egary.Sync.status.state === 'linked');
}
async function go(page, hash, waitSel) {
  await page.evaluate(h => { if (location.hash === h) Egary.App.render(); else location.hash = h; }, hash);
  if (waitSel) await page.waitForSelector(waitSel);
}
async function closeDrawer(page) {
  await page.click('.drawer .d-head button[aria-label="إغلاق"]');
  await page.waitForSelector('.drawer', { state: 'detached' });
}
async function closeModal(page) { await page.keyboard.press('Escape'); await page.waitForSelector('.modal', { state: 'detached' }); }
const drawerTitle = (page) => page.locator('.drawer .d-head h2').textContent();
const navCount = (page, view) => page.locator(`#sidebar a[data-view="${view}"] .cnt`).textContent();
const rowsOf = (page, sel) => page.locator((sel || '#content table.tbl') + ' tbody tr');
/* انتظار كتابة الإكسيل: عدد الكتابات يزيد عن قيمة سابقة ثم تعود الحالة «linked» بلا عمليات معلّقة */
async function waitWrite(page, prev) {
  await page.waitForFunction(n => window.__adapter.writes > n, prev, { timeout: 15000 });
  await page.waitForFunction(() => Egary.Sync.status.state === 'linked' && Egary.Sync.status.pending === 0);
  return page.evaluate(() => window.__adapter.writes);
}
/* قراءة ورقة من بايتات المحوِّل داخل الصفحة بـ ExcelJS → مصفوفة صفوف (قيم بسيطة) */
async function sheetRows(page, name) {
  return page.evaluate(async (name) => {
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(window.__adapter.bytes());
    const ws = wb.getWorksheet(name); if (!ws) return null;
    const plain = v => v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === 'object' ? (v.result != null ? v.result : v.richText ? v.richText.map(r => r.text).join('') : v.text != null ? v.text : v.formula ? '=' + v.formula : null) : v;
    const rows = []; ws.eachRow((row, n) => { const vals = []; for (let c = 1; c <= ws.columnCount; c++) vals.push(plain(row.getCell(c).value)); rows[n - 1] = vals; });
    return rows;
  }, name);
}
/* تصدير بايتات المحوِّل إلى ملف ليحكم عليها openpyxl (مستقل عن ExcelJS) */
async function exportBytes(page, filename) {
  const b64 = await page.evaluate(() => { const u = new Uint8Array(window.__adapter.bytes()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); });
  const f = path.join(OUT, filename); fs.writeFileSync(f, Buffer.from(b64, 'base64')); return f;
}
/* نموذج الدفعة من خانة الورقة: فتح الخانة → «تسجيل دفعة» → حفظ (مع تحقق المبلغ المقترح) */
async function payFromCell(page, cellKey, expectAmount) {
  await page.click(`td.m[data-cell="${cellKey}"]`);
  await page.waitForSelector('.modal:has-text("خانة الشهر")');
  await page.click('.modal .m-foot button:has-text("تسجيل دفعة")');
  await page.waitForSelector('#f_amount');
  assert.equal(await page.inputValue('#f_amount'), String(expectAmount), 'المبلغ المقترح = المتبقي للشهر');
  assert.equal(await page.inputValue('#f_period'), cellKey.split('|')[1]);
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('#f_amount', { state: 'detached' });
}

/* =====================================================================
   1. شاشة البداية + الوضع التجريبي
   ===================================================================== */
e2e('1. welcome screen shows the three buttons; demo mode renders the dashboard tiles and the info banner', async (page) => {
  for (const id of ['#btn-link', '#btn-open', '#btn-demo']) assert.ok(await page.isVisible(id), id + ' visible');
  assert.ok((await page.textContent('.welcome')).includes('Egary.xlsx'));
  await page.click('#btn-demo');
  await page.waitForSelector('#content .kpis .kpi');
  assert.equal(await page.locator('#content .kpis .kpi').count(), 12);
  assert.ok((await page.textContent('#banner .banner.info')).includes('وضع تجريبي ببيانات نموذجية'));
  assert.equal(await navCount(page, 'projects'), '2');
  assert.equal(await navCount(page, 'units'), '8');
  assert.equal(await navCount(page, 'clients'), '5');
  assert.equal(await navCount(page, 'contracts'), '6');
  assert.equal(await page.textContent('#page-title'), 'لوحة المؤشرات');
  assert.ok(/غير مرتبط/.test(await page.textContent('#sync-status')));
});

/* =====================================================================
   2. الوضع المرتبط بالملف الحقيقي: العدادات، مؤشر المتأخرات ودرجه، كل البلاطات
   ===================================================================== */
e2e('2. linked mode: nav counts, arrears KPI equals the engine and its drawer footer, all 12 tiles open drawers', async (page) => {
  await linkReal(page);
  assert.ok(/متزامن مع Egary\.xlsx/.test(await page.textContent('#sync-status')));
  assert.equal(await navCount(page, 'projects'), String(REAL.projects));
  assert.equal(await navCount(page, 'units'), String(REAL.units));
  assert.equal(await navCount(page, 'clients'), String(REAL.clients));
  assert.equal(await navCount(page, 'contracts'), String(REAL.contracts));
  assert.equal(await navCount(page, 'payments'), String(REAL.payments));
  assert.equal(await page.textContent('#banner'), '', 'no banner in linked mode');

  const expected = await page.evaluate(() => { const k = Egary.Engine.kpis({}); return { total: k.arrears.total, fmt: Egary.U.fmtMoney(k.arrears.total), rows: k.arrears.rows.length, clients: k.arrears.byClient.length }; });
  assert.equal(expected.fmt, '2,398,539 ج');
  const tile = page.locator('#content .kpi[data-kpi="المتأخرات القائمة"]');
  assert.equal((await tile.locator('.v').textContent()).trim(), expected.fmt);
  assert.ok((await tile.locator('.d').textContent()).includes(`${expected.rows} شهر على ${expected.clients} عميل`));
  await tile.click();
  await page.waitForSelector('.drawer');
  assert.equal(await drawerTitle(page), 'المتأخرات القائمة');
  assert.equal(await rowsOf(page, '.drawer table.tbl').count(), expected.rows);
  const foot = await page.locator('.drawer table.tbl tfoot td').allTextContents();
  assert.ok(foot[0].includes(`(${expected.rows} شهر)`));
  assert.equal(foot[1].trim(), expected.fmt, 'drawer footer total = KPI');
  const domSum = (await page.locator('.drawer table.tbl tbody tr td:nth-child(7)').allTextContents()).reduce((s, t) => s + num(t), 0);
  assert.equal(domSum, expected.total, 'sum of drawer rows = KPI');
  await closeDrawer(page);

  const tiles = page.locator('#content .kpis .kpi');
  assert.equal(await tiles.count(), 12);
  const seen = [];
  for (let i = 0; i < 12; i++) {
    const label = (await tiles.nth(i).getAttribute('data-kpi'));
    await tiles.nth(i).click();
    await page.waitForSelector('.drawer');
    const t = await drawerTitle(page);
    assert.ok(t && t.trim(), 'drawer has a title for ' + label);
    seen.push(label + ' → ' + t.trim());
    await closeDrawer(page);
  }
  assert.equal(new Set(seen.map(s => s.split(' → ')[0])).size, 12, 'tiles have distinct labels');
});

/* =====================================================================
   3. الفلاتر
   ===================================================================== */
e2e('3. filters on #/units (project, type, status, floor) and persistence to #/contracts and #/ledger', async (page) => {
  await linkReal(page);
  await go(page, '#/units', '#content table.tbl');
  const rows = () => rowsOf(page);
  const colTexts = (i) => page.$$eval(`#content table.tbl tbody tr td:nth-child(${i})`, tds => tds.map(td => td.textContent.trim()));
  assert.equal(await rows().count(), 71);
  assert.equal(await page.locator('#clear-filters').count(), 0);

  await page.locator('#filter-bar .chip.f-project', { hasText: 'بابل' }).click();
  await page.waitForSelector('#clear-filters');
  assert.equal(await rows().count(), 7);
  assert.deepEqual(await colTexts(3), Array(7).fill('بابل'));
  assert.ok((await page.textContent('#content .page-head .sub')).startsWith('7 وحدة'));

  await page.locator('#filter-bar .chip.f-type', { hasText: 'تجارية' }).click();
  await page.waitForFunction(() => document.querySelectorAll('#content table.tbl tbody tr').length === 2);
  assert.deepEqual(await colTexts(2), ['محل', 'محل']);
  assert.deepEqual(await colTexts(1), ['P01-S1', 'P01-S2']);
  assert.deepEqual(await colTexts(4), ['تجارية', 'تجارية']);

  await page.click('#clear-filters');
  await page.waitForFunction(() => document.querySelectorAll('#content table.tbl tbody tr').length === 71);
  assert.equal(await page.locator('#clear-filters').count(), 0);

  await page.locator('#filter-bar .chip.f-status', { hasText: 'شاغرة' }).click();
  await page.waitForSelector('#clear-filters');
  const vacant = await page.evaluate(() => Egary.Engine.scope({ status: 'vacant' }).units.length);
  assert.equal(vacant, 24);
  assert.equal(await rows().count(), vacant);
  assert.deepEqual(new Set(await page.$$eval('#content table.tbl tbody tr td:nth-child(6) .badge', b => b.map(x => x.textContent.trim()))), new Set(['شاغرة']));
  await page.click('#clear-filters');
  await page.waitForFunction(() => document.querySelectorAll('#content table.tbl tbody tr').length === 71);

  // الدور
  const floorChips = await page.locator('#floor-bar .chip').allTextContents();
  assert.deepEqual(floorChips.map(t => t.trim()), ['1', '2', '3', '4', '5', '6', '7', 'G', 'M']);
  await page.locator('#floor-bar .chip').filter({ hasText: /^1$/ }).click();
  await page.waitForSelector('#clear-filters');
  assert.equal(await rows().count(), 7);
  assert.deepEqual(await colTexts(5), Array(7).fill('1'));
  assert.equal(await page.evaluate(() => Egary.App.filter.floor), '1');
  // (the selected floor chip itself is covered by test 3b — known bug)
  await page.click('#clear-filters');
  await page.waitForFunction(() => document.querySelectorAll('#content table.tbl tbody tr').length === 71);

  // تبقى الفلاتر عند التنقل
  await page.locator('#filter-bar .chip.f-project', { hasText: 'بابل' }).click();
  await page.waitForSelector('#clear-filters');
  await go(page, '#/contracts', '#content table.tbl');
  assert.equal((await page.locator('#filter-bar .chip.f-project.on').textContent()).replace('×', '').trim(), 'بابل');
  assert.equal(await rows().count(), 7);
  assert.deepEqual(await colTexts(4), Array(7).fill('بابل'));
  await go(page, '#/ledger?year=2026', 'table.ledger');
  assert.equal((await page.locator('#filter-bar .chip.f-project.on').textContent()).replace('×', '').trim(), 'بابل');
  assert.equal(await page.locator('table.ledger tbody tr').count(), 7);
  assert.equal(await page.evaluate(() => Egary.Engine.ledger('2026', { projectCode: 'P01' }).rows.length), 7);
  assert.ok((await page.textContent('table.ledger tfoot')).includes('7 صف'));
  await page.click('#clear-filters');
  await page.waitForFunction(() => document.querySelectorAll('table.ledger tbody tr').length === 73);
  assert.ok((await page.textContent('table.ledger tfoot')).includes('73 صف'));
});

// ⚠ KNOWN APP BUG (views.js:228-229): the floor chips are built from `En().scope(ctx.filter)`, which already
// applies `filter.floor`; after choosing a floor only that floor remains, `floors.length > 1` is false and the
// whole #floor-bar disappears — the selected chip is never shown "on" and cannot be toggled off (only «مسح الكل»).
e2e('3b. floor chip stays visible and selected after choosing a floor, and toggles off', async (page) => {
  await linkReal(page);
  await go(page, '#/units', '#floor-bar');
  await page.locator('#floor-bar .chip').filter({ hasText: /^1$/ }).click();
  await page.waitForSelector('#clear-filters');
  assert.equal(await rowsOf(page).count(), 7);
  assert.equal(await page.locator('#floor-bar .chip').count(), 9, 'all floors still offered');
  assert.equal((await page.locator('#floor-bar .chip.on').textContent()).trim(), '1');
  await page.locator('#floor-bar .chip.on').click();
  await page.waitForFunction(() => document.querySelectorAll('#content table.tbl tbody tr').length === 71);
  assert.equal(await page.evaluate(() => Egary.App.filter.floor), '');
});

/* =====================================================================
   4. البحث العام
   ===================================================================== */
e2e('4a. global search: unit code, national id, client code suggestions open the right profiles; no-results item', async (page) => {
  await linkReal(page);
  const items = page.locator('#suggest .item');
  await page.fill('#global-search', 'P03-304');
  await page.waitForSelector('#suggest:not(.hidden) .item');
  assert.equal(await items.first().locator('.k').textContent(), 'وحدة');
  assert.equal(await items.first().locator('.code').textContent(), 'P03-304');
  await items.first().click();
  await page.waitForSelector('.drawer');
  assert.equal(await drawerTitle(page), '304 — ابو بكر');
  assert.ok((await page.textContent('.drawer')).includes('تاريخ الإيجار (2 عقد)'));
  assert.equal(await page.locator('.drawer .timeline .tl').count(), 2);
  assert.deepEqual(await page.$$eval('.drawer .timeline .tl .code', c => c.map(x => x.textContent.trim())), ['T0041', 'T0040']);
  await closeDrawer(page);

  await page.fill('#global-search', '28408191301751');
  await page.waitForSelector('#suggest:not(.hidden) .item');
  assert.equal(await items.count(), 1);
  assert.equal(await items.first().locator('.k').textContent(), 'عميل');
  assert.equal(await items.first().locator('.code').textContent(), 'C023');
  assert.ok((await items.first().textContent()).includes('محمد هلال احمد'));

  await page.fill('#global-search', 'C001');
  await page.waitForSelector('#suggest:not(.hidden) .item');
  assert.equal(await items.first().locator('.k').textContent(), 'عميل');
  assert.equal(await items.first().locator('.code').textContent(), 'C001');
  await items.first().click();
  await page.waitForSelector('.drawer');
  assert.equal(await drawerTitle(page), 'عميل: حسام حسن سنوسي');
  assert.ok((await page.textContent('.drawer')).includes('T0001'));
  await closeDrawer(page);

  await page.fill('#global-search', 'ZZZ-NOPE-999');
  await page.waitForSelector('#suggest:not(.hidden) .item.muted');
  assert.equal(await items.count(), 1);
  assert.ok((await items.first().textContent()).includes('لا توجد نتائج'));
});

// ⚠ KNOWN APP BUG (app.js:144 + app.js:243): the "no results" placeholder is a `.item` without a click
// handler, so Enter on free text clicks it and does nothing instead of applying the «بحث:» chip that the
// placeholder text promises («اضغط Enter للبحث داخل القوائم»). This test asserts the promised behaviour.
e2e('4b. global search: Enter with free text applies the «بحث:» chip and filters the table', async (page) => {
  await linkReal(page);
  await go(page, '#/units', '#content table.tbl');
  assert.equal(await rowsOf(page).count(), 71);
  await page.fill('#global-search', 'ZZZ-NOPE-999');
  await page.waitForSelector('#suggest:not(.hidden) .item.muted');
  await page.press('#global-search', 'Enter');
  await page.waitForSelector('#filter-bar .chip.f-q', { timeout: 5000 });
  assert.equal((await page.textContent('#filter-bar .chip.f-q')).replace('×', '').trim(), 'بحث: ZZZ-NOPE-999');
  assert.equal(await page.evaluate(() => Egary.App.filter.q), 'ZZZ-NOPE-999');
  assert.equal(await page.locator('#content table.tbl tbody .empty').count(), 1, 'no unit matches → empty state');
  await page.click('#clear-filters');
  await page.waitForFunction(() => document.querySelectorAll('#content table.tbl tbody tr').length === 71);
});

/* =====================================================================
   5. الروابط العميقة
   ===================================================================== */
e2e('5. deep links #/unit, #/client, #/contract, #/project open the matching drawers', async (page) => {
  await linkReal(page);
  const cases = [
    ['#/unit/P03-304', '304 — ابو بكر', 'units', 'P03-304'],
    ['#/client/C001', 'عميل: حسام حسن سنوسي', 'clients', 'C001'],
    ['#/contract/T0001', 'عقد T0001', 'contracts', 'T0001'],
    ['#/project/P01', 'مشروع: بابل', 'projects', 'P01'],
  ];
  for (const [hash, title, view, code] of cases) {
    await go(page, hash, '.drawer');
    assert.equal(await drawerTitle(page), title, hash);
    assert.equal((await page.locator('.drawer .profile-head .code').first().textContent()).trim(), code, hash + ' head shows ' + code);
    assert.equal(await page.evaluate(() => Egary.App.route.view), view, hash + ' lands on the list view underneath');
    await closeDrawer(page);
  }
  await go(page, '#/unit/NOPE-1');
  await page.waitForSelector('.toast:has-text("غير موجود: NOPE-1")');
  assert.equal(await page.locator('.drawer').count(), 0);
});

/* =====================================================================
   6. الإضافة / التعديل / الحذف مع الكتابة في الإكسيل
   ===================================================================== */
e2e('6a. project: empty name is rejected, a valid one is saved, counted and written to sheet «المشاريع»', async (page) => {
  await linkReal(page);
  await go(page, '#/projects', '#content .page-head');
  await page.click('#content button:has-text("مشروع جديد")');
  await page.waitForSelector('.modal:has-text("مشروع جديد")');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal .form-errors');
  assert.ok((await page.textContent('.modal .form-errors')).includes('اسم المشروع مطلوب'));
  assert.equal(await navCount(page, 'projects'), '3', 'nothing saved yet');
  await page.fill('#f_name', 'مشروع اختبار E2E');
  await page.fill('#f_area', 'المعادي');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal', { state: 'detached' });
  await page.waitForSelector('.toast:has-text("أُضيف المشروع P04")');
  assert.equal(await navCount(page, 'projects'), '4');
  assert.ok((await page.textContent('#content')).includes('مشروع اختبار E2E'));
  const writes = await waitWrite(page, 0);
  assert.ok(writes >= 1);
  const rows = await sheetRows(page, 'المشاريع');
  assert.equal(rows[0][0], 'كود المشروع');
  const row = rows.find(r => r && r[0] === 'P04');
  assert.ok(row, 'P04 row exists in المشاريع');
  assert.equal(row[1], 'مشروع اختبار E2E');
  assert.equal(row[3], 'المعادي');
  assert.equal(row[5], TODAY, 'createdAt = frozen today');
  assert.equal(rows.length, 5, 'header + 4 projects');
  // ولا يُسمح بتكرار الاسم
  await page.click('#content button:has-text("مشروع جديد")');
  await page.fill('#f_name', 'مشروع اختبار E2E');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal .form-errors');
  assert.ok((await page.textContent('.modal .form-errors')).includes('يوجد مشروع بنفس الاسم'));
  await closeModal(page);
  assert.equal(await navCount(page, 'projects'), '4');
});

e2e('6b. unit (جراج) with a checked asset + details: profile shows it and sheet «أصول الوحدات» has the row', async (page) => {
  await linkReal(page);
  await go(page, '#/units', '#content table.tbl');
  await page.click('#content button:has-text("وحدة جديدة")');
  await page.waitForSelector('.modal:has-text("وحدة جديدة")');
  await page.selectOption('#f_projectCode', 'P01');
  await page.fill('#f_label', 'جراج 9');
  assert.equal(await page.inputValue('#f_type'), 'garage', 'type inferred from label');
  assert.ok((await page.textContent('.modal .field[data-field="label"] .help')).includes('P01-G9'), 'code preview');
  await page.selectOption('#f_type', 'garage');
  await page.fill('#f_floor', 'B');
  const row = page.locator('.modal .asset-row[data-asset="موقف سيارة"]');
  await row.locator('input[type="checkbox"]').check();
  await row.locator('input[name="_a_details"]').fill('رقم 9 بالبدروم');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal', { state: 'detached' });
  await page.waitForSelector('.toast:has-text("أُضيفت الوحدة P01-G9")');
  assert.equal(await navCount(page, 'units'), '72');
  assert.equal(await rowsOf(page).count(), 72);

  await go(page, '#/unit/P01-G9', '.drawer');
  assert.equal(await drawerTitle(page), 'جراج 9 — بابل');
  const assetsCard = page.locator('.drawer .card', { hasText: 'الأصول والمحتويات' });
  assert.equal(await assetsCard.locator('.badge.ok').textContent(), 'موجود');
  assert.ok((await assetsCard.textContent()).includes('موقف سيارة'));
  assert.ok((await assetsCard.textContent()).includes('— رقم 9 بالبدروم'));
  assert.equal(await assetsCard.locator('.badge').count(), 1, 'only the present asset is kept');
  assert.ok((await page.textContent('.drawer .profile-head')).includes('جراج'));
  await closeDrawer(page);

  await waitWrite(page, 0);
  const assets = await sheetRows(page, 'أصول الوحدات');
  assert.deepEqual(assets[0], ['كود الوحدة', 'الأصل', 'موجود', 'التفاصيل']);
  const arow = assets.find(r => r && r[0] === 'P01-G9');
  assert.deepEqual(arow, ['P01-G9', 'موقف سيارة', 'نعم', 'رقم 9 بالبدروم']);
  const units = await sheetRows(page, 'الوحدات');
  const urow = units.find(r => r && r[0] === 'P01-G9');
  assert.ok(urow, 'P01-G9 in الوحدات');
  assert.equal(urow[1], 'P01'); assert.equal(urow[2], 'بابل'); assert.equal(urow[3], 'جراج 9'); assert.equal(urow[4], 'جراج'); assert.equal(urow[5], 'B');
  assert.equal(urow[9], 'موقف سيارة (رقم 9 بالبدروم)', 'assets summary column');
  assert.equal(urow[10], 'شاغرة');
});

e2e('6c. client: invalid phone is rejected, valid client saved, counted and written to sheet «العملاء»', async (page) => {
  await linkReal(page);
  await go(page, '#/clients', '#content table.tbl');
  await page.click('#content button:has-text("عميل جديد")');
  await page.waitForSelector('.modal:has-text("عميل جديد")');
  await page.fill('#f_name', 'عميل اختبار E2E');
  await page.fill('#f_phone', 'abc');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal .form-errors');
  assert.ok((await page.textContent('.modal .form-errors')).includes('رقم التليفون غير صحيح'));
  await page.fill('#f_phone', '01000000001');
  await page.fill('#f_nationalId', '29901011234567');
  await page.selectOption('#f_kind', 'company');
  await page.fill('#f_rep', 'ممثل الاختبار');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal', { state: 'detached' });
  await page.waitForSelector('.toast:has-text("أُضيف العميل C065")');
  assert.equal(await navCount(page, 'clients'), '65');
  assert.equal(await rowsOf(page).count(), 65);
  await waitWrite(page, 0);
  const rows = await sheetRows(page, 'العملاء');
  const row = rows.find(r => r && r[0] === 'C065');
  assert.ok(row, 'C065 in العملاء');
  assert.equal(row[1], 'عميل اختبار E2E'); assert.equal(row[2], 'شركة'); assert.equal(row[3], 'ممثل الاختبار');
  assert.equal(row[4], '29901011234567'); assert.equal(String(row[6]), '01000000001');
  assert.equal(row[12], 0, 'no contracts yet (computed column)');
  // ويظهر في البحث فورًا
  await page.fill('#global-search', 'C065');
  await page.waitForSelector('#suggest:not(.hidden) .item');
  assert.ok((await page.locator('#suggest .item').first().textContent()).includes('عميل اختبار E2E'));
});

e2e('6d. contract: end-before-start and overlap are rejected; a valid one lands in «العقود» and in the «2026» ledger sheet', async (page) => {
  await linkReal(page);
  await go(page, '#/contracts', '#content table.tbl');
  await page.click('#content button:has-text("عقد جديد")');
  await page.waitForSelector('.modal:has-text("عقد جديد")');
  await page.selectOption('#f_unitCode', CT.unit);           // وحدة مؤجَّرة حاليًا (T0016 حتى 2026-12-31)
  await page.selectOption('#f_clientCode', 'C001');
  await page.fill('#f_start', '2026-11-01');
  await page.fill('#f_end', '2026-10-01');
  await page.fill('#f_rent', '5000');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal .form-errors');
  assert.ok((await page.textContent('.modal .form-errors')).includes('تاريخ النهاية قبل تاريخ البداية'));

  await page.fill('#f_end', '2027-10-31');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForFunction(() => /يتداخل/.test((document.querySelector('.modal .form-errors') || {}).textContent || ''));
  const err = await page.textContent('.modal .form-errors');
  assert.ok(err.includes('يتداخل') && err.includes(CT.code), 'overlap names the conflicting contract');
  assert.ok(!err.includes('تاريخ النهاية قبل'), 'date error cleared');

  await page.selectOption('#f_unitCode', 'P03-708');          // شاغرة (آخر عقد T0073 انتهى 2026-09-30)
  assert.ok((await page.textContent('.modal')).includes('جدول سنوات العقد'), 'schedule preview rendered');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal', { state: 'detached' });
  await page.waitForSelector('.toast:has-text("أُضيف العقد T0074")');
  assert.equal(await navCount(page, 'contracts'), '74');
  const saved = await page.evaluate(() => Egary.Store.contract('T0074'));
  assert.equal(saved.unitCode, 'P03-708'); assert.equal(saved.clientCode, 'C001'); assert.equal(saved.rent, 5000); assert.equal(saved.increasePct, 10);
  assert.equal(saved.start, '2026-11-01'); assert.equal(saved.end, '2027-10-31');

  await waitWrite(page, 0);
  const ks = await sheetRows(page, 'العقود');
  const krow = ks.find(r => r && r[0] === 'T0074');
  assert.ok(krow, 'T0074 in العقود');
  assert.equal(krow[1], 'P03-708'); assert.equal(krow[2], 'C001'); assert.equal(krow[3], 'ابو بكر'); assert.equal(krow[5], 'حسام حسن سنوسي');
  assert.equal(krow[6], '2026-11-01'); assert.equal(krow[7], '2027-10-31'); assert.equal(krow[8], 5000); assert.equal(krow[9], 10);
  assert.equal(krow[18], 'لم يبدأ', 'computed status');
  const led = await sheetRows(page, '2026');
  const lrow = led.find(r => r && r[24] === 'T0074');
  assert.ok(lrow, 'T0074 row in the 2026 ledger sheet');
  assert.equal(lrow[25], 'P03-708'); assert.equal(lrow[26], 'C001'); assert.equal(lrow[27], 'P03');
  assert.equal(lrow[2], 'حسام حسن سنوسي'); assert.equal(lrow[6], '2026-11-01');
  assert.equal(lrow[10], null, 'no January amount');
  assert.equal(led.filter(r => r && /^T\d{4}$/.test(String(r[24]))).length, 74);
  await go(page, '#/ledger?year=2026', 'table.ledger');
  assert.equal(await page.locator('table.ledger tbody tr').count(), 74);
  assert.ok((await page.getAttribute('td.m[data-cell="T0074|2026-11"]', 'class')).includes('upcoming'));
  assert.ok((await page.getAttribute('td.m[data-cell="T0074|2026-10"]', 'class')).includes('none'));
});

e2e('6e+6f+7a. ledger cell → payment prefilled → cell «paid» and written to «2026»/«المدفوعات»; edit to 6000 → «partial»; workbook re-read matches the store', async (page) => {
  await linkReal(page);
  await go(page, '#/ledger?year=2026', 'table.ledger');
  const cell = `td.m[data-cell="${CT.code}|2026-09"]`;
  assert.ok((await page.getAttribute(cell, 'class')).includes('late'));
  assert.ok((await page.textContent(cell)).includes(CT.rentFmt + ' متأخر'));
  await payFromCell(page, `${CT.code}|2026-09`, CT.rent);
  await page.waitForFunction(sel => document.querySelector(sel).classList.contains('paid'), cell);
  assert.equal((await page.locator(cell + ' span').first().textContent()).trim(), CT.rentFmt);
  const code = await page.evaluate(c => Egary.Store.paymentsOfCell(c, '2026-09')[0].code, CT.code);
  assert.equal(code, 'INV-2026-0510');
  assert.equal(await navCount(page, 'payments'), '510');
  assert.equal(await page.evaluate(() => Egary.Store.state().audit[0].action), 'إضافة');

  let writes = await waitWrite(page, 0);
  // تحكيم مستقل: openpyxl يقرأ البايتات المكتوبة
  const f1 = await exportBytes(page, 'e2e_payment.xlsx');
  const chk = py(`
import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1]); ws = wb['2026']; out = {}
for r in range(3, ws.max_row + 1):
    if ws.cell(r, 25).value == sys.argv[2]: out['S'] = ws.cell(r, 19).value; out['K'] = ws.cell(r, 11).value; out['W'] = ws.cell(r, 23).value; out['row'] = r
wp = wb['المدفوعات']; hdr = [c.value for c in wp[1]]
rows = [dict(zip(hdr, [c.value for c in r])) for r in wp.iter_rows(min_row=2)]
out['inv'] = [r for r in rows if r['رقم الفاتورة'] == sys.argv[3]]
out['count'] = len(rows)
print(json.dumps(out, ensure_ascii=False, default=str))
`, f1, CT.code, code);
  assert.equal(chk.S, CT.rent, 'September cell (col S) of the contract row');
  assert.equal(chk.K, CT.rent, 'January untouched');
  assert.equal(chk.W, `=SUM(K${chk.row}:V${chk.row})`);
  assert.equal(chk.count, 510);
  assert.equal(chk.inv.length, 1);
  assert.equal(chk.inv[0]['كود العقد'], CT.code); assert.equal(chk.inv[0]['الشهر'], '2026-09'); assert.equal(chk.inv[0]['المبلغ'], CT.rent);
  assert.equal(chk.inv[0]['طريقة السداد'], 'نقدي'); assert.equal(chk.inv[0]['المصدر'], 'الموقع'); assert.equal(String(chk.inv[0]['تاريخ السداد']).slice(0, 10), TODAY);

  // (f) تعديل المبلغ إلى 6000 → جزئي
  await page.click(cell);
  await page.waitForSelector('.modal:has-text("خانة الشهر")');
  assert.ok((await page.textContent('.modal')).includes(code));
  await page.click('.modal button[title="تعديل"]');
  await page.waitForSelector('.modal:has-text("تعديل الفاتورة ' + code + '")');
  assert.equal(await page.inputValue('#f_amount'), String(CT.rent));
  await page.fill('#f_amount', '6000');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal', { state: 'detached' });
  await page.waitForFunction(sel => document.querySelector(sel).classList.contains('partial'), cell);
  assert.equal((await page.locator(cell + ' span').first().textContent()).trim(), '6,000');
  assert.ok((await page.textContent(cell)).includes('متبقٍ ' + (CT.rent - 6000).toLocaleString('en-US')));
  writes = await waitWrite(page, writes);
  const led = await sheetRows(page, '2026');
  assert.equal(led.find(r => r && r[24] === CT.code)[18], 6000, 'S cell now 6000');

  // (7a) الموقع → الإكسيل: إعادة قراءة البايتات تعطي نفس عدد الدفعات ونفس المبلغ
  assert.ok(writes >= 2);
  const cmp = await page.evaluate(async (code) => { const r = await Egary.Workbook.read(window.__adapter.bytes()); const p = r.state.payments.find(p => p.code === code); return { file: r.state.payments.length, store: Egary.Store.state().payments.length, amount: p && p.amount, flags: r.flags.length }; }, code);
  assert.equal(cmp.file, cmp.store);
  assert.equal(cmp.file, 510);
  assert.equal(cmp.amount, 6000);
});

e2e('6g. delete a payment from #/payments: «إلغاء» keeps it, «نعم، احذف» removes it from the table, the count and the workbook', async (page) => {
  await linkReal(page);
  await go(page, '#/payments', '#content table.tbl');
  const rows = rowsOf(page);
  assert.equal(await rows.count(), 509);
  const first = rows.first();
  const code = (await first.locator('td:first-child .code').textContent()).trim();
  assert.match(code, /^INV-2026-\d{4}$/);
  await first.locator('button[title="حذف"]').click();
  await page.waitForSelector('.modal:has-text("تأكيد الحذف")');
  assert.ok((await page.textContent('.modal .m-body')).includes(`دفعة «${code}»`));
  await page.click('.modal .m-foot button:has-text("إلغاء")');
  await page.waitForSelector('.modal', { state: 'detached' });
  assert.equal(await rows.count(), 509);
  assert.equal(await navCount(page, 'payments'), '509');
  assert.equal(await page.evaluate(() => window.__adapter.writes), 0, 'cancel writes nothing');

  await rows.first().locator('button[title="حذف"]').click();
  await page.waitForSelector('.modal:has-text("تأكيد الحذف")');
  await page.click('.modal .m-foot button:has-text("نعم، احذف")');
  await page.waitForSelector('.modal', { state: 'detached' });
  await page.waitForSelector(`.toast:has-text("تم حذف دفعة ${code}")`);
  await page.waitForFunction(() => document.querySelectorAll('#content table.tbl tbody tr').length === 508);
  assert.equal(await navCount(page, 'payments'), '508');
  assert.equal(await page.locator(`#content table.tbl .code:text-is("${code}")`).count(), 0);
  assert.equal(await page.evaluate(c => Egary.Store.get('payments', c), code), null);
  await waitWrite(page, 0);
  const sheet = await sheetRows(page, 'المدفوعات');
  assert.equal(sheet.length, 509, 'header + 508 payments');
  assert.equal(sheet.filter(r => r && r[0] === code).length, 0, code + ' gone from المدفوعات');
  const audit = await sheetRows(page, 'سجل التعديلات');
  assert.deepEqual(audit[1].slice(1, 4), ['حذف', 'دفعة', code]);
});

e2e('6h. deleting a project with units shows the cascade warning with counts; cancel keeps everything', async (page) => {
  await linkReal(page);
  await go(page, '#/projects', '#content .page-head');
  const deps = await page.evaluate(() => { const d = Egary.Store.dependents('projects', 'P01'); return { units: d.units.length, contracts: d.contracts.length, payments: d.payments.length }; });
  assert.deepEqual(deps, { units: 7, contracts: 7, payments: 41 });
  await page.locator('#content .card', { hasText: 'بابل' }).locator('button[title="حذف"]').click();
  await page.waitForSelector('.modal:has-text("تأكيد الحذف")');
  const text = await page.textContent('.modal .m-body');
  assert.ok(text.includes('مشروع «بابل»'));
  assert.ok(text.includes(`سيُحذف معه أيضًا: ${deps.units} وحدة · ${deps.contracts} عقد · ${deps.payments} دفعة/فاتورة`), text);
  assert.ok(text.includes('لا يمكن التراجع'));
  await page.click('.modal .m-foot button:has-text("إلغاء")');
  await page.waitForSelector('.modal', { state: 'detached' });
  assert.equal(await navCount(page, 'projects'), '3');
  assert.equal(await navCount(page, 'units'), '71');
  assert.equal(await page.locator('#content .card', { hasText: 'بابل' }).count(), 1);
  assert.equal(await page.evaluate(() => window.__adapter.writes + Egary.Sync.status.pending), 0);
});

/* =====================================================================
   7. المزامنة في الاتجاهين + القفل
   ===================================================================== */
e2e('7b. Excel → website: an external edit (September filled, January cleared) is picked up by polling and shown in the ledger', async (page) => {
  await linkReal(page);
  await go(page, '#/ledger?year=2026', 'table.ledger');
  const sep = `td.m[data-cell="${CT.code}|2026-09"]`, jan = `td.m[data-cell="${CT.code}|2026-01"]`;
  assert.ok((await page.getAttribute(sep, 'class')).includes('late'));
  assert.ok((await page.getAttribute(jan, 'class')).includes('paid'));
  assert.equal((await page.locator(jan + ' span').first().textContent()).trim(), CT.rentFmt);
  const before = await page.evaluate(() => Egary.Store.state().payments.length);

  // «المكتب» يعدّل الملف في Excel: نفس البايتات تُقرأ وتُعدَّل وتُكتب خارجيًا
  const edited = await page.evaluate(async ([code, amount]) => {
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(window.__adapter.bytes());
    const ws = wb.getWorksheet('2026'); let rowNo = 0;
    ws.eachRow((row, n) => { if (String(row.getCell(25).value) === code) rowNo = n; });
    const row = ws.getRow(rowNo);
    row.getCell(19).value = amount; row.getCell(11).value = null; row.commit();
    const out = await wb.xlsx.writeBuffer();
    const ab = out instanceof ArrayBuffer ? out : out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
    window.__adapter.externalWrite(ab);
    return { rowNo, writes: window.__adapter.writes };
  }, [CT.code, CT.rent]);
  assert.ok(edited.rowNo >= 3);
  assert.equal(edited.writes, 0);

  await page.waitForSelector('.toast:has-text("تم تحديث البيانات من ملف الإكسيل")', { timeout: 8000 });
  await page.waitForFunction(sel => document.querySelector(sel).classList.contains('paid'), sep, { timeout: 6000 });
  assert.equal((await page.locator(sep + ' span').first().textContent()).trim(), CT.rentFmt);
  await page.waitForFunction(sel => /\b(late|due)\b/.test(document.querySelector(sel).className), jan);
  assert.equal((await page.locator(jan + ' span').first().textContent()).trim(), '—', 'January shows no paid amount');
  assert.ok((await page.textContent(jan)).includes(CT.rentFmt + ' متأخر'));
  const st = await page.evaluate((code) => ({ sep: Egary.Store.paymentsOfCell(code, '2026-09').map(p => ({ amount: p.amount, source: p.source })), jan: Egary.Store.paymentsOfCell(code, '2026-01').length, total: Egary.Store.state().payments.length, sync: Egary.Sync.status.state, ext: !!Egary.Sync.status.lastExternal }), CT.code);
  assert.deepEqual(st.sep, [{ amount: CT.rent, source: 'excel' }]);
  assert.equal(st.jan, 0);
  assert.equal(st.total, before, 'one payment added, one removed');
  assert.equal(st.sync, 'linked'); assert.ok(st.ext);
  assert.ok(/متزامن مع Egary\.xlsx/.test(await page.textContent('#sync-status')));
  // الدليل في «جودة البيانات» وفي الكشف: إجمالي الصف لم يتغيّر (خانة بدل خانة)
  const rowTotal = await page.evaluate(code => { const r = Egary.Engine.ledger('2026', {}).rows.find(r => r.contractCode === code); return r.total; }, CT.code);
  assert.equal(rowTotal, CT.rent * 8);
});

e2e('7c. locked file (open in Excel): the change waits, status/banner say so, and it is written once unlocked', async (page) => {
  await linkReal(page);
  await go(page, '#/ledger?year=2026', 'table.ledger');
  await page.evaluate(() => { window.__adapter.locked = true; });
  const cell = `td.m[data-cell="${CT.code}|2026-10"]`;
  await payFromCell(page, `${CT.code}|2026-10`, CT.rent);
  await page.waitForFunction(sel => document.querySelector(sel).classList.contains('paid'), cell);
  await page.waitForFunction(() => document.querySelector('#sync-status').classList.contains('locked'), null, { timeout: 10000 });
  assert.ok((await page.textContent('#sync-status')).includes('الملف مفتوح في Excel — 1 تعديل بانتظار الحفظ'));
  const banner = await page.textContent('#banner');
  assert.ok(banner.includes('مفتوح في برنامج Excel'), banner);
  assert.ok(banner.includes('(1)'));
  assert.equal(await page.locator('#banner .banner.warn button:has-text("حاول الآن")').count(), 1);
  assert.equal(await page.evaluate(() => window.__adapter.writes), 0);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('egary-pending-ops-v1')).length), 1, 'journal persisted');
  // ما زال مقفولًا بعد محاولة يدوية
  await page.click('#banner button:has-text("حاول الآن")');
  await page.waitForFunction(() => document.querySelector('#sync-status').classList.contains('locked'));
  assert.equal(await page.evaluate(() => window.__adapter.writes), 0);

  await page.evaluate(() => { window.__adapter.locked = false; });
  await page.waitForFunction(() => document.querySelector('#sync-status').classList.contains('linked'), null, { timeout: 6000 });
  assert.equal(await page.evaluate(() => Egary.Sync.status.pending), 0);
  assert.equal(await page.textContent('#banner'), '');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('egary-pending-ops-v1')).length), 0);
  assert.ok((await page.evaluate(() => window.__adapter.writes)) >= 1);
  const pays = await sheetRows(page, 'المدفوعات');
  const row = pays.find(r => r && r[1] === CT.code && r[4] === '2026-10');
  assert.ok(row, 'October payment written after unlock');
  assert.equal(row[5], CT.rent);
  const led = await sheetRows(page, '2026');
  assert.equal(led.find(r => r && r[24] === CT.code)[19], CT.rent, 'T cell (October) in the ledger sheet');
});

/* =====================================================================
   8. الفاتورة
   ===================================================================== */
e2e('8. clicking a payment row opens the invoice modal with its code and a print button', async (page) => {
  await linkReal(page);
  await go(page, '#/payments', '#content table.tbl');
  const first = rowsOf(page).first();
  const code = (await first.locator('td:first-child .code').textContent()).trim();
  const amount = (await first.locator('td:nth-child(6)').textContent()).trim();
  await first.locator('td:first-child').click();   // الخلية الأولى (الكود) — وسط الصف يقع على رابط العميل الذي يفتح بروفايله
  await page.waitForSelector('.modal #invoice-print');
  assert.equal(await page.textContent('.modal .m-head h3'), 'الفاتورة ' + code);
  const inv = await page.textContent('.modal #invoice-print');
  assert.ok(inv.includes(code));
  assert.ok(inv.includes('فاتورة إلكترونية'));
  assert.ok(inv.includes('المبلغ المسدَّد: ' + amount));
  assert.ok(inv.includes('إيجاري'), 'office name');
  assert.equal(await page.locator('.modal .m-foot button:has-text("طباعة")').count(), 1);
  assert.equal(await page.locator('.modal .m-foot button:has-text("تعديل")').count(), 1);
  await closeModal(page);
  // ومن البحث أيضًا
  await page.fill('#global-search', code);
  await page.waitForSelector('#suggest:not(.hidden) .item');
  assert.equal(await page.locator('#suggest .item').first().locator('.k').textContent(), 'فاتورة');
  await page.locator('#suggest .item').first().click();
  await page.waitForSelector('.modal #invoice-print');
  assert.equal(await page.textContent('.modal .m-head h3'), 'الفاتورة ' + code);
});

/* =====================================================================
   9. الثيم
   ===================================================================== */
e2e('9. theme toggle switches to dark, stores it in localStorage and survives a reload', async (page) => {
  await page.click('#btn-demo');
  await page.waitForSelector('#theme-btn');
  assert.equal(await page.getAttribute('html', 'data-theme'), 'light');
  await page.click('#theme-btn');
  await page.waitForSelector('html[data-theme="dark"]');
  assert.equal(await page.evaluate(() => localStorage.getItem('egary-theme')), 'dark');
  assert.equal(await page.locator('#content .kpis .kpi').count(), 12, 'dashboard re-rendered');
  await page.reload();
  await page.waitForSelector('#btn-demo');
  assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
  await page.click('#btn-demo');
  await page.waitForSelector('#theme-btn');
  await page.click('#theme-btn');
  await page.waitForSelector('html[data-theme="light"]');
  assert.equal(await page.evaluate(() => localStorage.getItem('egary-theme')), 'light');
});

/* =====================================================================
   10. تكامل كشف التحصيل
   ===================================================================== */
e2e('10. ledger 2026: every footer month total equals the DOM column sum and Engine.ledger monthTotals', async (page) => {
  await linkReal(page);
  await go(page, '#/ledger?year=2026', 'table.ledger');
  assert.equal(await page.inputValue('#year-select'), '2026');
  assert.equal(await page.locator('table.ledger tbody tr').count(), REAL.ledgerRows);
  const engine = await page.evaluate(() => { const L = Egary.Engine.ledger('2026', {}); return { monthTotals: L.monthTotals, total: L.total, rows: L.rows.length }; });
  assert.equal(engine.rows, REAL.ledgerRows);
  const footer = (await page.locator('table.ledger tfoot td.m').allTextContents()).map(num);
  assert.equal(footer.length, 12);
  for (let m = 1; m <= 12; m++) {
    const p = '2026-' + String(m).padStart(2, '0');
    const domSum = await page.$$eval(`table.ledger tbody td.m[data-cell$="|${p}"]`, (tds) => tds.reduce((s, td) => { const t = td.querySelector('span').textContent.trim(); const n = Number(t.replace(/[^\d.-]/g, '')); return s + (t === '—' || t === '' || isNaN(n) ? 0 : n); }, 0));
    assert.equal(footer[m - 1], domSum, 'footer = DOM column sum for ' + p);
    assert.equal(footer[m - 1], engine.monthTotals[p], 'footer = engine for ' + p);
    assert.equal(await page.locator(`table.ledger tbody td.m[data-cell$="|${p}"]`).count(), REAL.ledgerRows);
  }
  assert.equal(footer.reduce((a, b) => a + b, 0), engine.total);
  assert.equal(num(await page.textContent('table.ledger tfoot td.tot')), engine.total);
  assert.equal((await page.textContent('table.ledger tfoot td.tot')).trim(), REAL.ledgerTotal);
  // إجمالي كل صف = مجموع خاناته
  const rowCheck = await page.$$eval('table.ledger tbody tr', trs => trs.map(tr => { const cells = [...tr.querySelectorAll('td.m')].reduce((s, td) => { const t = td.querySelector('span').textContent.trim(); const n = Number(t.replace(/[^\d.-]/g, '')); return s + (t === '—' || t === '' || isNaN(n) ? 0 : n); }, 0); const tot = Number(tr.querySelector('td.tot').textContent.replace(/[^\d.-]/g, '')) || 0; return cells === tot; }));
  assert.ok(rowCheck.every(Boolean), 'row totals');
  // ولا شهر مستقبلي محصَّل
  assert.deepEqual(footer.slice(8), [0, 0, 0, 0]);
  // الخانات التي تحمل نصًا في الإكسيل تُعرض كملاحظة لا كمبلغ
  assert.ok((await page.textContent('table.ledger')).includes('نص: 63+.0+3+26'));
});

/* =====================================================================
   11. التحليلات + جودة البيانات
   ===================================================================== */
e2e('11. insights page lists ≥ 8 insights (first one opens evidence); quality page lists the known flags', async (page) => {
  await linkReal(page);
  await go(page, '#/insights', '#content .insight');
  const n = await page.locator('#content .insight').count();
  assert.ok(n >= 8, 'insights: ' + n);
  assert.equal(n, await page.evaluate(() => Egary.Engine.insights(Egary.Engine.kpis({})).length));
  assert.ok((await page.textContent('#content')).includes(`الملاحظات (${n})`));
  const firstTitle = (await page.locator('#content .insight b').first().textContent()).trim();
  assert.ok(firstTitle.includes('تحصيل أكتوبر 2026'), firstTitle);
  const hashBefore = await page.evaluate(() => location.hash);
  await page.locator('#content .insight').first().click();
  await page.waitForFunction(h => document.querySelector('.drawer') || location.hash !== h, hashBefore);
  const opened = await page.locator('.drawer').count();
  if (opened) { assert.ok((await drawerTitle(page)).includes('أكتوبر 2026')); await closeDrawer(page); }
  else assert.notEqual(await page.evaluate(() => location.hash), hashBefore);
  // جدول الالتزام يُعرض
  assert.ok((await page.textContent('#content')).includes('التزام العملاء بالسداد'));

  await go(page, '#/quality', '#content table.tbl');
  const flags = await page.evaluate(() => Egary.Engine.dataQuality().length);
  assert.ok(flags >= 100, 'flags: ' + flags);
  assert.equal(await rowsOf(page).count(), flags);
  const text = await page.textContent('#content table.tbl');
  assert.ok(text.includes('63+.0+3+26309'), 'text-in-cell flag');
  assert.ok(text.includes('لا يوجد رقم تليفون'));
  assert.ok((await page.locator('#content table.tbl tbody tr').first().locator('.badge').textContent()) === 'تحذير', 'sorted by severity (no danger flags in this file)');
});

/* =====================================================================
   12. الموبايل
   ===================================================================== */
e2e('12. mobile viewport: the menu button opens the sidebar and the dashboard has no horizontal page scroll', async (page) => {
  await linkReal(page);
  assert.ok(await page.isVisible('.menu-btn'));
  const scrollW = await page.evaluate(() => document.scrollingElement.scrollWidth);
  assert.ok(scrollW <= 390 + 2, 'scrollWidth ' + scrollW);
  assert.ok(!(await page.evaluate(() => document.getElementById('sidebar').classList.contains('open'))));
  await page.click('.menu-btn');
  await page.waitForSelector('#sidebar.open');
  // الانزلاق 220ms: ننتظر حتى يستقر داخل الشاشة (بدل قياسه في منتصف الحركة)
  await page.waitForFunction(() => { const r = document.getElementById('sidebar').getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth + 1; }, null, { timeout: 3000 });
  const box = await page.locator('#sidebar').boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= 390 + 1, 'sidebar inside the viewport: ' + JSON.stringify(box));
  await page.click('#sidebar a[data-view="units"]');
  await page.waitForSelector('#content table.tbl');
  assert.ok(!(await page.evaluate(() => document.getElementById('sidebar').classList.contains('open'))), 'sidebar closes after navigation');
  assert.equal(await page.textContent('#page-title'), 'الوحدات');
  assert.ok((await page.evaluate(() => document.scrollingElement.scrollWidth)) <= 392);
}, { viewport: { width: 390, height: 844 } });
