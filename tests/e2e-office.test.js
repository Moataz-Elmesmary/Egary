// اختبارات «المكتب يعتمد عليه» (E2E عبر Playwright): البحث العام وشارة «بحث:» في كل القوائم، وفلاتر التاريخ في المدفوعات،
// وحقول التاريخ في النماذج، وقوائم الاختيار القابلة للبحث — على ملف الإكسيل الحقيقي (محوِّل ذاكرة) وعلى الوضع التجريبي.
// كل وكيل لاحق يضيف اختباراته في آخر هذا الملف بنفس الأدوات.
// التشغيل: cd /home/user/Egary && NODE_PATH=/opt/node22/lib/node_modules node --test tests/e2e-office.test.js
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const APP = 'file://' + path.resolve(__dirname, '../Egary/index.html');
const XLSX_B64 = fs.readFileSync(path.resolve(__dirname, '../Egary/Egary.xlsx')).toString('base64');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const TODAY = '2026-10-09';           // «اليوم» المثبَّت — كل الأرقام أدناه محسوبة عليه
const TIMEOUT = 90000;

let browser;
before(async () => { browser = await chromium.launch({ executablePath: CHROME }); });
after(async () => { if (browser) await browser.close(); });

/* ---------- أدوات (نفس أدوات tests/e2e.test.js) ---------- */
const num = (t) => { const s = String(t || '').replace(/[^\d.-]/g, ''); return s === '' || s === '-' ? 0 : Number(s); };
async function openApp(opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1440, height: 900 }, locale: opts.locale || 'en-US' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(APP);
  await page.waitForSelector('#btn-demo');
  await page.evaluate(t => Egary.U.setToday(t), TODAY);
  return { page, ctx, errors };
}
function e2e(name, fn, opts) {
  test(name, { timeout: TIMEOUT }, async () => {
    const { page, ctx, errors } = await openApp(opts);
    try {
      await fn(page, errors);
      assert.deepEqual(errors, [], 'console/page errors');
    } catch (e) {
      if (errors.length) e.message += '\n[console/page errors]\n' + errors.join('\n');
      try { await page.screenshot({ path: path.join(OUT, 'office_fail_' + name.slice(0, 3).replace(/\W/g, '') + '.png') }); } catch (x) { }
      throw e;
    } finally { await ctx.close(); }
  });
}
const ADMIN = ['admin', 'admin@2026'], STAFF = ['office', 'office@2026'], VIEWER = ['zaer', 'view@2026'];
async function loginAs(page, creds) {
  await page.waitForSelector('#login[data-stage="auth"] #login-form', { timeout: 20000 });
  await page.fill('#login-user', creds[0]); await page.fill('#login-pass', creds[1]);
  await page.click('#login-go');
  await page.waitForSelector('#login', { state: 'detached', timeout: 20000 });
}
async function linkReal(page, creds) {
  await page.evaluate((b64) => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
    const adapter = Egary.FileLink.memoryAdapter(bytes, 'Egary.xlsx');
    window.__adapter = adapter;
    Egary.App.linkAdapter(adapter);
  }, XLSX_B64);
  await loginAs(page, creds || ADMIN);
  await page.waitForSelector('#content .kpis .kpi');
  await page.waitForFunction(() => Egary.Sync.status.state === 'linked' && Egary.Sync.status.pending === 0);
  await page.evaluate(() => { window.__adapter.writes = 0; });
}
async function demo(page) { await page.click('#btn-demo'); await page.waitForSelector('#content .kpis .kpi'); }
async function go(page, hash, waitSel) {
  await page.evaluate(h => { if (location.hash === h) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = h; }, hash);
  if (waitSel) await page.waitForSelector(waitSel);
}
async function afterRender(page, act) {
  const h = await page.evaluateHandle(() => document.querySelector('#content').firstElementChild);
  await act();
  await page.waitForFunction(el => !el || !el.isConnected, h);
  await h.dispose();
}
async function waitModal(page, text) {
  await page.waitForSelector(`.modal:has-text("${text}")`);
  await page.waitForFunction(() => { const a = document.activeElement; return !!(a && a.closest && a.closest('.modal')); }, null, { timeout: 2000 }).catch(() => {});
}
async function waitWrite(page, prev) {
  await page.waitForFunction(n => window.__adapter.writes > n, prev, { timeout: 20000 });
  await page.waitForFunction(() => Egary.Sync.status.state === 'linked' && Egary.Sync.status.pending === 0);
  return page.evaluate(() => window.__adapter.writes);
}
async function sheetRows(page, name) {
  return page.evaluate(async (name) => {
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(window.__adapter.bytes());
    const ws = wb.getWorksheet(name); if (!ws) return null;
    const plain = v => v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === 'object' ? (v.result != null ? v.result : v.richText ? v.richText.map(r => r.text).join('') : v.text != null ? v.text : v.formula ? '=' + v.formula : null) : v;
    const rows = []; ws.eachRow((row, n) => { const vals = []; for (let c = 1; c <= ws.columnCount; c++) vals.push(plain(row.getCell(c).value)); rows[n - 1] = vals; });
    return rows;
  }, name);
}
const drawerTitle = (page) => page.locator('.drawer .d-head h2').textContent();
const rowsOf = (page, sel) => page.locator((sel || '#content table.tbl') + ' tbody tr:not(:has(.empty))');
/* الاقتراحات الظاهرة: [{k, code}] + الصف المختار حاليًا */
async function suggestions(page, q) {
  await page.fill('#global-search', q);
  await page.waitForSelector('#suggest:not(.hidden) .all');
  return page.evaluate(() => ({
    items: [...document.querySelectorAll('#suggest .item:not(.muted)')].map(e => ({ k: e.querySelector('.k').textContent, code: e.querySelector('.code').textContent, lbl: e.querySelector('.lbl').textContent, sub: e.querySelector('.sub').textContent })),
    on: (() => { const on = document.querySelector('#suggest .on'); return on ? (on.classList.contains('all') ? 'ALL' : on.querySelector('.code').textContent) : null; })(),
    all: (document.querySelector('#suggest .all') || {}).textContent || '',
  }));
}
/* تاريخ الدفعة كما قرره المكتب، محسوب هنا بشكل مستقل من بيانات المخزن الخام: تاريخ السداد المسجَّل، وإلا يوم الاستحقاق في شهرها (أو بداية العقد لو بدأ في نفس الشهر) */
async function expectedPays(page, from, to) {
  return page.evaluate(([from, to]) => {
    const st = Egary.Store.state(); const byCode = new Map(st.contracts.map(c => [c.code, c]));
    const dateOf = (p) => {
      if (p.paidOn) return p.paidOn;
      const c = byCode.get(p.contractCode); if (!c) return p.period + '-01';
      const [y, m] = p.period.split('-').map(Number); const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const d = p.period + '-' + String(Math.min(c.dueDay || 1, dim)).padStart(2, '0');
      return c.start && c.start > d && c.start.slice(0, 7) === p.period ? c.start : d;
    };
    const rows = st.payments.filter(p => { const d = dateOf(p); return (!from || d >= from) && (!to || d <= to); });
    return { n: rows.length, sum: Math.round(rows.reduce((s, p) => s + (Number(p.amount) || 0), 0)) };
  }, [from, to]);
}
const footCount = async (page) => num(((await page.textContent('#content table.tbl tfoot')) || '').match(/\((\d[\d,]*) دفعة\)/)[1]);

/* =====================================================================
   O1. البحث العام: الهمزات، الكود بحروف صغيرة، الأرقام العربية، لوحة المفاتيح، Enter يعرض كل النتائج
   ===================================================================== */
e2e('O1. global search: hamza variants give the same hits, lower-case and zero-less codes open their record on Enter, Arabic-Indic digits, keyboard (default «all results» row, arrows, Tab, ArrowDown reopens), Enter lists every hit with the «بحث:» chip', async (page) => {
  await linkReal(page);
  // الهمزات: أحمد = احمد، إبراهيم = ابراهيم
  const a1 = await suggestions(page, 'أحمد'), a2 = await suggestions(page, 'احمد');
  assert.ok(a1.items.length >= 3, JSON.stringify(a1));
  assert.deepEqual(a1.items, a2.items, 'أحمد = احمد');
  const b1 = await suggestions(page, 'إبراهيم'), b2 = await suggestions(page, 'ابراهيم');
  assert.ok(b1.items.length >= 1); assert.deepEqual(b1.items, b2.items, 'إبراهيم = ابراهيم');
  // الأقرب أولًا: عملاء اسمهم أحمد قبل شركة طابقت باسم ممثلها القانوني
  assert.equal(a2.items[0].k, 'عميل');
  assert.ok(/^أحمد/.test(a2.items[0].lbl), 'first hit is a client named أحمد: ' + a2.items[0].lbl);
  assert.ok(a2.items.some(x => x.sub.startsWith('الممثل: ')), 'a representative hit says why it matched');
  assert.ok(a2.items.findIndex(x => x.sub.startsWith('الممثل: ')) > a2.items.findIndex(x => /أحمد/.test(x.lbl)), 'name hits rank above representative hits');
  // الكلمات بأي ترتيب
  assert.deepEqual((await suggestions(page, 'غانم احمد')).items.map(x => x.code), ['C032']);
  // كود بحروف صغيرة: يُختار تلقائيًا وEnter يفتحه
  const u = await suggestions(page, 'p03-304');
  assert.equal(u.on, 'P03-304', 'an exact code is the default choice');
  await page.press('#global-search', 'Enter'); await page.waitForSelector('.drawer');
  assert.equal(await drawerTitle(page), '304 — ابو بكر');
  // كود بلا أصفار: t16 = T0016 (البروفايل المفتوح لا يمنع البحث: الشريط العلوي فوقه)
  await page.click('#global-search');
  const t = await suggestions(page, 't16');
  assert.equal(t.on, 'T0016');
  await page.press('#global-search', 'Enter'); await page.waitForFunction(() => /عقد T0016/.test((document.querySelector('.drawer .d-head h2') || {}).textContent || ''));
  await page.click('.drawer .d-head button[aria-label="إغلاق"]'); await page.waitForSelector('.drawer', { state: 'detached' });
  // أرقام عربية هندية: الرقم القومي
  const n = await suggestions(page, '٢٩٠٠٥٠٩١٣١٩٥٨٥');
  assert.deepEqual(n.items.map(x => x.code), ['C023']);
  assert.ok((await page.textContent('#suggest')).includes('الرقم القومي: 29005091319585'));
  // لوحة المفاتيح: الصف الأول «اعرض كل النتائج» مختار افتراضيًا، والأسهم تتحرك، وTab يغلق القائمة، والسهم يعيد فتحها
  const g = await suggestions(page, 'غانم');
  assert.equal(g.on, 'ALL'); assert.ok(g.all.includes('«غانم»') && g.all.includes('العملاء'), g.all);
  await page.press('#global-search', 'ArrowDown');
  assert.equal((await suggestions(page, 'غانم')).on, 'ALL', 'retyping resets the choice');
  await page.press('#global-search', 'ArrowDown');
  assert.equal(await page.locator('#suggest .item.on .code').textContent(), g.items[0].code);
  assert.equal(await page.getAttribute('#global-search', 'aria-activedescendant'), await page.locator('#suggest .item.on').getAttribute('id'));
  await page.press('#global-search', 'ArrowUp');
  assert.equal(await page.locator('#suggest .all.on').count(), 1);
  await page.press('#global-search', 'Tab');
  await page.waitForFunction(() => document.getElementById('suggest').classList.contains('hidden'));
  await page.focus('#global-search'); await page.evaluate(() => document.getElementById('suggest').classList.add('hidden'));
  await page.press('#global-search', 'ArrowDown');
  await page.waitForSelector('#suggest:not(.hidden) .all.on');
  // Enter (بلا أسهم) ⇒ قائمة العملاء كلها مفلترة بـ «غانم» — لا يفتح أول اقتراح
  await page.press('#global-search', 'Enter');
  await page.waitForSelector('#filter-bar .chip.f-q');
  assert.equal(await page.evaluate(() => location.hash), '#/clients');
  assert.equal(await page.locator('.drawer').count(), 0, 'no profile opened');
  const expected = await page.evaluate(() => Egary.Store.state().clients.filter(c => [c.name, c.rep].join(' ').includes('غانم')).map(c => c.code).sort());
  const shown = (await page.$$eval('#content table.tbl tbody tr td:first-child .code', e => e.map(x => x.textContent))).sort();
  assert.deepEqual(shown, expected);
  // × على الشارة يمسح الفلتر وصندوق البحث
  await page.click('#filter-bar .chip.f-q');
  await page.waitForFunction(() => !document.querySelector('#filter-bar .chip.f-q'));
  assert.equal(await page.inputValue('#global-search'), '');
  assert.equal(await rowsOf(page).count(), 64);
});

/* =====================================================================
   O2. عميل جديد يُوجد فورًا بالتليفون بأي صيغة، ثم «تأجير وحدة لهذا العميل» بقائمة وحدات قابلة للبحث وحقول تاريخ تُكتب بلوحة المفاتيح
   ===================================================================== */
e2e('O2. staff adds a client, finds him by phone in any form (Arabic digits, +20, spaces), opens «تأجير وحدة لهذا العميل», picks the unit by typing in the unit search box, types the start date by keyboard (end follows, no page errors) and saves — the contract reaches the Excel sheet', async (page) => {
  await linkReal(page, STAFF);
  await go(page, '#/clients', '#content table.tbl');
  await page.click('#content .page-head button:has-text("عميل جديد")'); await waitModal(page, 'عميل جديد');
  await page.fill('#f_name', 'أحمد سيد الجديد'); await page.fill('#f_phone', '0100 999 8877');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.toast:has-text("أُضيف العميل C065")');
  for (const q of ['٠١٠٠٩٩٩٨٨٧٧', '+20 100 999 8877', '00201009998877', '0100-999-8877', '1009998877', 'الجديد سيد']) {
    const s = await suggestions(page, q);
    assert.ok(s.items.some(x => x.code === 'C065'), q + ' → ' + JSON.stringify(s.items));
  }
  // القائمة أيضًا تجده بالتليفون (نفس بحث الاقتراحات)
  await page.fill('#global-search', '+201009998877'); await page.waitForSelector('#suggest:not(.hidden) .all');
  await page.click('#suggest .all');
  await page.waitForSelector('#filter-bar .chip.f-q');
  assert.deepEqual(await page.$$eval('#content table.tbl tbody tr td:first-child .code', e => e.map(x => x.textContent)), ['C065']);
  await page.click('#content table.tbl tbody tr'); await page.waitForSelector('.drawer');
  await page.click('.drawer button:has-text("تأجير وحدة لهذا العميل")'); await waitModal(page, 'عقد جديد');
  assert.equal(await page.inputValue('#f_clientCode'), 'C065', 'client pre-selected');
  // البحث في قائمة الوحدات: نتيجة واحدة ⇒ تُختار تلقائيًا
  await page.fill('#pick_unitCode', 'P03-708');
  await page.waitForFunction(() => document.querySelector('#f_unitCode').value === 'P03-708');
  assert.ok((await page.textContent('#pick_unitCode_count')).includes('نتيجة واحدة'));
  await page.fill('#pick_unitCode', 'ابو بكر 70');
  const opts = await page.$$eval('#f_unitCode option', o => o.map(x => x.value).filter(Boolean));
  assert.ok(opts.length >= 2 && opts.every(v => v.startsWith('P03-70')), opts.join(','));
  assert.equal(await page.inputValue('#f_unitCode'), 'P03-708', 'the chosen unit stays chosen while filtering');
  // كتابة تاريخ البداية بلوحة المفاتيح (شهر/يوم/سنة في Chrome الإنجليزي): السنة تمر بـ 0002/0020/0202 — لا نهاية من سنة ناقصة ولا أخطاء
  await page.focus('#f_start');
  for (const k of '11012026') await page.keyboard.press(k);
  assert.equal(await page.inputValue('#f_start'), '2026-11-01');
  await page.waitForFunction(() => document.querySelector('#f_end').value === '2027-10-31');
  assert.ok((await page.textContent('.field[data-field="start"] .date-echo')).includes('01/11/2026'));
  await page.fill('#f_rent', '9000');
  const w0 = await page.evaluate(() => window.__adapter.writes);
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal', { state: 'detached' });
  const code = await page.evaluate(() => Egary.Store.contractsOfClient('C065')[0].code);
  await waitWrite(page, w0);
  const ks = await sheetRows(page, 'العقود');
  assert.ok(ks.some(r => r && r.includes(code) && r.includes('C065') && r.includes('P03-708')), 'contract row written to «العقود»');
  // والعقد الجديد يُبحث عنه برقمه بلا أصفار
  const t = await suggestions(page, code.replace(/^T0*/, 'عقد '));
  assert.equal(t.on, code);
});

/* =====================================================================
   O3. شارة «بحث:» في كل قائمة: المدفوعات (فاتورة/عقد/وحدة/رقم قومي)، العقود والكشف (عقد المستأجر نفسه فقط)، المشاريع، سجل التعديلات؛ واللوحة لا تتأثر والبحث لا يُحفظ
   ===================================================================== */
e2e('O3. the «بحث:» chip filters every list on the record\'s own text (payments by invoice/contract/unit/ID, contracts and the collection sheet by the tenant\'s own contracts, projects, audit), clears with ×, never zeroes the dashboard and is not saved for the next session', async (page) => {
  await linkReal(page);
  const setQ = async (hash, q) => { await page.evaluate(q => { Egary.App.filter.q = q; }, q); await afterRender(page, () => go(page, hash)); };
  const store = (fn, arg) => page.evaluate(fn, arg);
  // المدفوعات
  await setQ('#/payments', 'INV-2026-0001');
  assert.equal(await rowsOf(page).count(), 1);
  assert.ok((await page.textContent('#filter-bar .chip.f-q')).includes('INV-2026-0001'));
  await setQ('#/payments', 'T0016');
  assert.equal(await rowsOf(page).count(), await store(() => Egary.Store.paymentsOf('T0016').length));
  await setQ('#/payments', 'p02-404');
  assert.equal(await rowsOf(page).count(), await store(() => Egary.Store.state().contracts.filter(c => c.unitCode === 'P02-404').reduce((s, c) => s + Egary.Store.paymentsOf(c.code).length, 0)));
  await setQ('#/payments', '29005091319585');
  assert.equal(await rowsOf(page).count(), await store(() => Egary.Store.contractsOfClient('C023').reduce((s, c) => s + Egary.Store.paymentsOf(c.code).length, 0)));
  // العقود وكشف التحصيل: عقود العميل المطلوب فقط (لا عقد مستأجر آخر على نفس الوحدة)
  await setQ('#/contracts', 'غانم احمد');
  const mine = await store(() => Egary.Store.contractsOfClient('C032').map(c => c.code).sort());
  assert.deepEqual((await page.$$eval('#content table.tbl tbody tr td:first-child .code', e => e.map(x => x.textContent))).sort(), mine);
  await setQ('#/ledger?year=2026', 'غانم احمد');
  const lrows = await page.$$eval('#ledger tbody tr td.fix.c3', e => e.map(x => x.textContent));
  assert.ok(lrows.length >= 1 && lrows.every(t => t === 'أحمد طارق غانم'), lrows.join(','));
  // الوحدات: البحث برقم الوحدة القصير لا يطابق منتصف الأرقام القومية
  await setQ('#/units', '202');
  assert.deepEqual((await page.$$eval('#content table.tbl tbody tr td:first-child .code', e => e.map(x => x.textContent))).sort(), ['P02-202', 'P03-202']);
  // العملاء: «مكتب 42» يُظهر مستأجر الوحدة
  await setQ('#/clients', 'مكتب 42');
  const tenants = await store(() => [...new Set(Egary.Store.contractsOfUnit('P01-O42').map(c => c.clientCode))].sort());
  assert.deepEqual((await page.$$eval('#content table.tbl tbody tr td:first-child .code', e => e.map(x => x.textContent))).sort(), tenants);
  // المشاريع: شارة البحث + رسالة «لا توجد نتائج» بزر مسح
  await setQ('#/projects', 'لا يوجد مشروع بهذا الاسم');
  assert.ok(await page.isVisible('#filter-bar .chip.f-q'));
  assert.ok((await page.textContent('#content')).includes('لا توجد نتائج للبحث'));
  await afterRender(page, () => page.click('#empty-clear-q'));
  assert.equal(await page.locator('#content .grid.g3 > .card').count(), 3);
  // اللوحة: نص بحث قديم لا يصفّر الأرقام، والتنقل إلى اللوحة من القائمة الجانبية يمسحه
  const base = await page.evaluate(() => Egary.Engine.kpis({}).ytd.collected);
  await setQ('#/dashboard', 'نص لا يطابق شيئًا');
  assert.equal(num(await page.textContent('#content .kpi[data-kpi^="محصَّل"] .v')), Math.round(base));
  assert.ok(!(await page.textContent('#content .page-head .sub')).includes('حسب الفلاتر'));
  await setQ('#/units', 'نص لا يطابق شيئًا');
  await page.click('#sidebar a[data-view="dashboard"]');
  await page.waitForFunction(() => Egary.App.filter.q === '' && location.hash === '#/dashboard');
  assert.equal(await page.inputValue('#global-search'), '');
  // لا يُحفظ بين الجلسات (ولا سلايسر «المحاسبة من»)
  await setQ('#/units', 'P03');
  await page.evaluate(() => Egary.App.setFilter({ projectCode: 'P03' }));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('egary-filter-v1') || '{}'));
  assert.equal(saved.q, undefined, 'q not persisted'); assert.equal(saved.from, undefined, 'from not persisted'); assert.equal(saved.projectCode, 'P03');
  // سجل التعديلات يُبحث أيضًا
  await page.evaluate(() => Egary.App.setFilter({ projectCode: '' }));
  await setQ('#/audit', 'admin');
  assert.ok(await page.isVisible('#filter-bar .chip.f-q'));
});

/* =====================================================================
   O4. الوضع التجريبي: صيانة بالوصف/الكود، عقود المستأجر نفسه، التليفون بأي صيغة
   ===================================================================== */
e2e('O4. demo: maintenance list searches description and code, contracts and the collection sheet show only the searched tenant\'s contract, a phone matches in +20/0020/spaced forms in the clients list', async (page) => {
  await demo(page);
  const setQ = async (hash, q) => { await page.evaluate(q => { Egary.App.filter.q = q; }, q); await afterRender(page, () => go(page, hash)); };
  await setQ('#/maintenance', 'تسريب');
  assert.deepEqual(await page.$$eval('#content table.tbl tbody tr td:first-child .code', e => e.map(x => x.textContent)), ['M0002']);
  await setQ('#/maintenance', 'm1');
  assert.deepEqual(await page.$$eval('#content table.tbl tbody tr td:first-child .code', e => e.map(x => x.textContent)), ['M0001']);
  await setQ('#/contracts', 'سامي');
  assert.deepEqual(await page.$$eval('#content table.tbl tbody tr td:first-child .code', e => e.map(x => x.textContent)), ['T0004']);
  await setQ('#/ledger', 'سامي');
  assert.deepEqual(await page.$$eval('#ledger tbody tr td.fix.c3', e => e.map(x => x.textContent)), ['سامي فؤاد']);
  for (const q of ['+201001112233', '00201001112233', '0100 111 2233', '0100-111-2233']) {
    await setQ('#/clients', q);
    assert.deepEqual(await page.$$eval('#content table.tbl tbody tr td:first-child .code', e => e.map(x => x.textContent)), ['C001'], q);
  }
  // الوحدات: اسم مستأجر سابق يظهر بتوضيح «مستأجر سابق»
  await setQ('#/units', 'منى');
  const txt = await page.textContent('#content table.tbl tbody');
  assert.ok(txt.includes('مستأجر سابق: د. منى سعيد') || txt.includes('د. منى سعيد'), txt.slice(0, 300));
});

/* =====================================================================
   O5. فلاتر تاريخ السداد على الملف الحقيقي: عدد مستقل، حدود شاملة، «من» بعد «إلى»، الكتابة بلوحة المفاتيح، الشرائح السريعة
   ===================================================================== */
e2e('O5. payments date range on the real workbook: payments without a paid date count on their due date (marked ≈), counts match an independent computation, both ends inclusive, typing by keyboard keeps focus and never applies a half-typed year, from > to is swapped, broken links are repaired, quick chips and their contrast', async (page) => {
  await linkReal(page);
  await go(page, '#/payments', '#period-bar');
  assert.equal(await rowsOf(page).count(), 509);
  // مدة معروفة: مارس 2026 (بالكتابة في «إلى» ثم «من»)
  const mar = await expectedPays(page, '2026-03-01', '2026-03-31');
  assert.ok(mar.n > 0);
  await page.fill('#pay-to', '2026-03-31');
  await page.fill('#pay-from', '2026-03-01');
  await page.waitForFunction(n => document.querySelectorAll('#content table.tbl tbody tr').length === n, mar.n);
  assert.equal(await footCount(page), mar.n);
  assert.equal(num((await page.textContent('#content table.tbl tfoot td.num'))), mar.sum);
  assert.equal(await page.evaluate(() => location.hash), '#/payments?to=2026-03-31&from=2026-03-01');
  assert.ok((await page.textContent('#pay-summary')).includes('من 01/03/2026 إلى 31/03/2026'));
  assert.ok((await page.textContent('#pay-summary')).includes('تُحسب بتاريخ استحقاق شهرها'));
  assert.ok((await page.textContent('#content table.tbl tbody tr:first-child')).includes('≈ 01/03/2026'), 'undated payment shows its due date, marked');
  // الحدود شاملة: يوم واحد (من = إلى)، والنهاية العليا تشمل آخر يوم
  const day = await expectedPays(page, '2026-03-01', '2026-03-01');
  assert.ok(day.n > 0);
  await page.fill('#pay-to', '2026-03-01');
  await page.waitForFunction(n => document.querySelectorAll('#content table.tbl tbody tr').length === n, day.n);
  const upper = await expectedPays(page, '2026-02-02', '2026-03-01');
  await page.fill('#pay-from', '2026-02-02');
  await page.waitForFunction(n => document.querySelectorAll('#content table.tbl tbody tr:not(:has(.empty))').length === n, upper.n);
  assert.ok(upper.n >= day.n);
  // «من» بعد «إلى»: يُعرض ما بينهما مع تنبيه، ويُبدَّل التاريخان عند الخروج من الحقل
  await page.fill('#pay-from', '2026-04-30'); await page.fill('#pay-to', '2026-03-01');
  const rev = await expectedPays(page, '2026-03-01', '2026-04-30');
  await page.waitForFunction(n => document.querySelectorAll('#content table.tbl tbody tr').length === n, rev.n);
  assert.ok((await page.textContent('#pay-summary')).includes('«من» بعد «إلى»'));
  await page.click('#page-title');
  await page.waitForFunction(() => document.querySelector('#pay-from').value === '2026-03-01' && document.querySelector('#pay-to').value === '2026-04-30');
  await page.waitForSelector('.toast:has-text("تم تبديل التاريخين")');
  assert.equal(await page.evaluate(() => location.hash), '#/payments?to=2026-04-30&from=2026-03-01');
  assert.equal(await footCount(page), rev.n);
  // رابط معكوس أو تالف يُصلَح
  await afterRender(page, () => go(page, '#/payments?from=2026-04-30&to=2026-03-01'));
  assert.equal(await page.inputValue('#pay-from'), '2026-03-01'); assert.equal(await page.inputValue('#pay-to'), '2026-04-30');
  await afterRender(page, () => go(page, '#/payments?from=2026-13-45&to=2026-3-31'));
  assert.equal(await page.inputValue('#pay-from'), ''); assert.equal(await page.inputValue('#pay-to'), '2026-03-31');
  assert.equal(await page.evaluate(() => location.hash), '#/payments?to=2026-03-31');
  assert.equal(await footCount(page), (await expectedPays(page, '', '2026-03-31')).n);
  // الكتابة بلوحة المفاتيح: لا إعادة رسم، التركيز باقٍ، والسنة الناقصة (0002/0020/0202) لا تُطبَّق أبدًا
  await afterRender(page, () => page.click('#pay-clear'));
  await page.evaluate(() => { window.__hashes = []; window.addEventListener('hashchange', () => window.__hashes.push(location.hash)); const c = document.querySelector('#content').firstElementChild; window.__keep = c; });
  await page.click('#pay-from');
  const seen = [];
  for (const k of '02152026') { await page.keyboard.press(k); seen.push(await page.evaluate(() => location.hash)); }
  assert.ok(seen.every(hh => !/from=0/.test(hh)), 'half-typed years never reach the filter: ' + seen.join(' | '));
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'pay-from', 'focus stays in the date field');
  assert.equal(await page.evaluate(() => window.__keep.isConnected), true, 'the page was not re-rendered');
  assert.deepEqual(await page.evaluate(() => window.__hashes), [], 'no hashchange while typing');
  assert.equal(await footCount(page), (await expectedPays(page, '2026-02-15', '')).n);
  // الشرائح السريعة
  await afterRender(page, () => page.click('[data-quick="year"]'));
  const yr = await expectedPays(page, '2026-01-01', TODAY);
  assert.equal(yr.n, 509, 'every imported payment has a due date in 2026');
  assert.equal(await footCount(page), yr.n);
  assert.ok((await page.textContent('#content table.tbl tfoot')).includes('10,339,823'));
  // تباين الشريحة المختارة (كانت أبيض على أبيض)
  for (const theme of ['light', 'dark']) {
    await page.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
    const c = await page.$eval('[data-quick="year"]', el => { const s = getComputedStyle(el); return [s.color, s.backgroundColor]; });
    assert.notEqual(c[0], c[1], theme + ': active chip text differs from its background ' + c.join(' / '));
  }
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  await afterRender(page, () => page.click('[data-quick="30"]'));
  assert.equal(await page.inputValue('#pay-from'), '2026-09-10', '30 days including today');
  assert.equal(await page.inputValue('#pay-to'), TODAY);
  assert.equal(await footCount(page), (await expectedPays(page, '2026-09-10', TODAY)).n);
  assert.ok((await page.textContent('#content table.tbl tbody')).includes('آخر شهر مسجَّل في كشف التحصيل: أغسطس 2026'), 'empty range after the last entered month explains why');
  await afterRender(page, () => page.click('[data-quick="month"]'));
  assert.equal(await page.inputValue('#pay-from'), '2026-10-01');
  assert.equal(await page.locator('[data-quick="month"].on').count(), 1);
  await afterRender(page, () => page.click('[data-quick="month"]'));
  assert.equal(await page.inputValue('#pay-from'), '', 'clicking the active chip clears the range');
  // «غير محدد»: دفعات الكشف بلا طريقة سداد
  assert.equal(num(await page.textContent('[data-method="_none"] .cnt')), 509);
  await afterRender(page, () => page.click('[data-method="_none"]'));
  assert.equal(await rowsOf(page).count(), 509);
  await afterRender(page, () => page.click('[data-method="_none"]'));
  // الترتيب بعمود «تاريخ السداد»: تصاعديًا يبدأ بأقدم تاريخ (لا بالصفوف بلا تاريخ)
  await page.click('#content table.tbl thead th:has-text("تاريخ السداد")');
  assert.ok((await page.textContent('#content table.tbl tbody tr:first-child')).includes('01/01/2026'));
});

/* =====================================================================
   O6. النماذج: الدفعة المسدَّدة لا يُقترح لها مبلغ، سنوات غير منطقية تُرفض، قائمة العقود قابلة للبحث، إعدادات الشهور
   ===================================================================== */
e2e('O6. forms: a fully paid month proposes no amount, an impossible paid-date year and a closing date before the request are refused, the payment contract list is searchable by client name, settings refuse month 13 and accept Arabic digits', async (page) => {
  await linkReal(page);
  await go(page, '#/payments', '#period-bar');
  await page.click('#content .page-head button:has-text("تسجيل دفعة")'); await waitModal(page, 'تسجيل دفعة');
  const name = await page.evaluate(() => Egary.Store.client(Egary.Store.contract('T0016').clientCode).name);
  await page.fill('#pick_contractCode', name.split(' ').slice(-2).join(' '));
  await page.waitForSelector('#f_contractCode option[value="T0016"]', { state: 'attached' });
  assert.ok((await page.$$eval('#f_contractCode option', o => o.length)) < 20, 'the contract list is filtered by the client name');
  await page.selectOption('#f_contractCode', 'T0016');
  await page.fill('#f_period', '2026-01'); await page.dispatchEvent('#f_period', 'change');
  await page.waitForFunction(() => /مسدَّد بالكامل/.test(document.querySelector('.modal .field[data-field="period"] .help').textContent));
  assert.equal(await page.inputValue('#f_amount'), '', 'no amount proposed for a fully paid month');
  await page.fill('#f_period', '2026-09'); await page.dispatchEvent('#f_period', 'change');
  await page.waitForFunction(() => document.querySelector('#f_amount').value === '30250');
  await page.fill('#f_paidOn', '2062-10-09');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal .form-errors');
  assert.ok((await page.textContent('.modal .form-errors')).includes('تاريخ السداد بعيد عن اليوم'));
  await page.keyboard.press('Escape'); await page.waitForSelector('.modal', { state: 'detached' });
  // الصيانة: إغلاق قبل الطلب
  await go(page, '#/maintenance', '#content .page-head');
  await page.click('#content .page-head button:has-text("طلب صيانة")'); await waitModal(page, 'طلب صيانة');
  await page.fill('#pick_unitCode', 'P02-404'); await page.waitForFunction(() => document.querySelector('#f_unitCode').value === 'P02-404');
  await page.fill('#f_date', '2026-10-05'); await page.fill('#f_description', 'اختبار'); await page.selectOption('#f_status', 'closed'); await page.fill('#f_closedOn', '2026-01-01');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal .form-errors');
  assert.ok((await page.textContent('.modal .form-errors')).includes('تاريخ الإغلاق قبل تاريخ الطلب'));
  await page.keyboard.press('Escape'); await page.waitForSelector('.modal', { state: 'detached' });
  // الإعدادات
  await go(page, '#/settings', '#users-card');
  await page.click('#content button:has-text("تعديل الإعدادات")'); await waitModal(page, 'الإعدادات');
  await page.fill('#f_trackingFrom', '2026-13');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal .form-errors');
  assert.ok((await page.textContent('.modal .form-errors')).includes('بداية المحاسبة'));
  await page.fill('#f_trackingFrom', '٢٠٢٦-٠١'); await page.fill('#f_enteredThrough', '2026-12');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForFunction(() => /آخر شهر مسجَّل لا يكون بعد الشهر الحالي/.test((document.querySelector('.modal .form-errors') || {}).textContent || ''));
  await page.fill('#f_enteredThrough', '');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal', { state: 'detached' });
  assert.equal(await page.evaluate(() => Egary.Store.state().settings.trackingFrom), '2026-01', 'Arabic digits accepted and stored as 2026-01');
});

/* =====================================================================
   O7. الشاشة: «كشف التحصيل» بلا «(الورقة)»، البحث على الموبايل، البروفايل لا يغطي البحث، Ctrl+K
   ===================================================================== */
e2e('O7. sidebar says «كشف التحصيل» (no «(الورقة)»), Ctrl+K focuses the search from an open profile', async (page) => {
  await demo(page);
  const nav = await page.textContent('#sidebar');
  assert.ok(nav.includes('كشف التحصيل') && !nav.includes('(الورقة)'));
  await go(page, '#/ledger', '#ledger');
  assert.equal((await page.textContent('#page-title')).trim(), 'كشف التحصيل');
  await page.evaluate(() => Egary.App.open('client', 'C001')); await page.waitForSelector('.drawer');
  await page.click('#global-search', { timeout: 3000 }); // الشريط العلوي فوق البروفايل
  await page.fill('#global-search', 'C004'); await page.waitForSelector('#suggest:not(.hidden) .item');
  await page.click('#suggest .item'); await page.waitForFunction(() => /سامي فؤاد/.test((document.querySelector('.drawer .d-head h2') || {}).textContent || ''));
  await page.click('#page-title');
  await page.keyboard.press('Control+k');
  await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'global-search' && !document.querySelector('.drawer'));
});
e2e('O8. phone width (390px): the search box takes its own full row and the suggestion list is wide enough to read', async (page) => {
  await demo(page);
  const box = await page.$eval('.topbar .search', el => el.getBoundingClientRect().width);
  assert.ok(box >= 330, 'search width ' + box);
  await page.fill('#global-search', 'احمد'); await page.waitForSelector('#suggest:not(.hidden) .item');
  const s = await page.$eval('#suggest', el => el.getBoundingClientRect().width);
  assert.ok(s >= 330, 'suggest width ' + s);
}, { viewport: { width: 390, height: 800 } });

/* =====================================================================
   مسارات المكتب اليومية (موظف): تسجيل عميل سريع ← ربطه بوحدة، عميل جديد من داخل العقد، تأجير وحدة شاغرة،
   التجديد، إنهاء العقد مبكرًا، الدفعة عن عدة شهور، الصيانة، حساب المشاهدة — كل مسار يُتحقق منه في المخزن وفي أوراق الإكسيل
   ===================================================================== */
const findRow = (rows, pred) => (rows || []).find(r => r && pred(r));
async function modalCount(page) { return page.locator('.modal').count(); }

e2e('W1. walk-in: staff registers a client with only a name (a short mobile is refused), the profile opens with «ربطه بوحدة الآن», the contract form comes pre-filled (client, start today, end +1 year, vacant units first), the unit\'s last rent is proposed, a typed deposit becomes «محتفظ به», and «العملاء»/«العقود»/«2026» get the rows', async (page) => {
  await linkReal(page, STAFF);
  await go(page, '#/clients', '#content table.tbl');
  await page.click('#content .page-head button:has-text("عميل جديد")'); await waitModal(page, 'عميل جديد');
  assert.ok((await page.textContent('.modal')).includes('الاسم فقط مطلوب'), 'the form says only the name is required');
  await page.fill('#f_name', 'زائر المكتب الجديد');
  await page.fill('#f_phone', '0100 123 45');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal .form-errors');
  assert.ok((await page.textContent('.modal .form-errors')).includes('رقم الموبايل 11 رقمًا'), 'a 9-digit mobile is refused');
  await page.fill('#f_phone', '');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.toast:has-text("أُضيف العميل C065")');
  await page.waitForSelector('.drawer #client-next');
  assert.equal(await drawerTitle(page), 'عميل: زائر المكتب الجديد', 'the new client profile opens at once');
  assert.ok((await page.textContent('#client-next')).includes('عميل جديد بلا عقد'));
  await page.click('#client-next button:has-text("ربطه بوحدة الآن")'); await waitModal(page, 'عقد جديد');
  assert.equal(await page.inputValue('#f_clientCode'), 'C065', 'client pre-selected');
  assert.equal(await page.inputValue('#f_start'), TODAY, 'start defaults to today');
  assert.equal(await page.inputValue('#f_end'), '2027-10-08', 'end = start + 1 year − 1 day');
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'pick_unitCode', 'the cursor waits in the unit search box');
  // قائمة الوحدات: الشاغرة أولًا في مجموعتها، وكلها شاغرة فعلًا
  const groups = await page.$$eval('#f_unitCode optgroup', g => g.map(x => ({ label: x.label, codes: [...x.querySelectorAll('option')].map(o => o.value) })));
  assert.ok(groups[0].label.startsWith('شاغرة الآن'), groups[0].label);
  const vacant = await page.evaluate(() => Egary.Store.state().units.filter(u => Egary.Engine.unitStatus(u).status === 'vacant').map(u => u.code).sort());
  assert.deepEqual(groups[0].codes.slice().sort(), vacant, 'the first group lists exactly the vacant units');
  assert.ok(groups.slice(1).every(g => g.codes.every(c => !vacant.includes(c))), 'no vacant unit is repeated further down');
  // اختيار الوحدة بالكتابة ⇒ آخر إيجار لها يُقترح
  await page.fill('#pick_unitCode', 'P03-708');
  await page.waitForFunction(() => document.querySelector('#f_unitCode').value === 'P03-708');
  await page.waitForFunction(() => document.querySelector('#f_rent').value === '13000');
  assert.ok((await page.textContent('.modal .field[data-field="unitCode"]')).includes('شاغرة منذ 01/10/2026'));
  assert.ok((await page.textContent('.modal .field[data-field="rent"]')).includes('آخر إيجار لهذه الوحدة: 13,000'));
  assert.equal(await page.inputValue('#f_depositStatus'), 'none');
  await page.fill('#f_deposit', '26000');
  assert.equal(await page.inputValue('#f_depositStatus'), 'held', 'typing a deposit sets «محتفظ به»');
  const w0 = await page.evaluate(() => window.__adapter.writes);
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.toast:has-text("أُضيف العقد T0087")');
  await page.waitForFunction(() => /عقد T0087/.test((document.querySelector('.drawer .d-head h2') || {}).textContent || ''));
  const t = await page.evaluate(() => Egary.Store.contract('T0087'));
  assert.deepEqual([t.clientCode, t.unitCode, t.start, t.end, t.rent, t.deposit, t.depositStatus, t.increasePct, t.dueDay], ['C065', 'P03-708', TODAY, '2027-10-08', 13000, 26000, 'held', 10, 1]);
  assert.equal(await page.evaluate(() => Egary.Engine.unitStatus(Egary.Store.unit('P03-708')).status), 'occupied');
  assert.ok(await page.evaluate(() => Egary.Engine.kpis({}).deposits.held.some(r => r.contractCode === 'T0087')), 'the deposit is tracked in «تأمينات محتفظ بها»');
  await waitWrite(page, w0);
  const cl = findRow(await sheetRows(page, 'العملاء'), r => r[0] === 'C065');
  assert.ok(cl && cl[1] === 'زائر المكتب الجديد', 'C065 in «العملاء»: ' + JSON.stringify(cl));
  const k = findRow(await sheetRows(page, 'العقود'), r => r[0] === 'T0087');
  assert.ok(k && k[1] === 'P03-708' && k[2] === 'C065' && k.includes(26000) && k.includes('محتفظ به'), 'T0087 in «العقود»: ' + JSON.stringify(k));
  const y = findRow(await sheetRows(page, '2026'), r => r[24] === 'T0087');
  assert.ok(y && y[25] === 'P03-708' && y[26] === 'C065' && y[2] === 'زائر المكتب الجديد', 'T0087 row in the 2026 sheet: ' + JSON.stringify(y));
  assert.equal(y[10], null, 'no January amount');
});

e2e('W2. inside the contract form: «＋ عميل جديد» opens the quick client form on top and comes back with what was typed kept; a same-name client offers «استخدم هذا العميل»; a name typed in the client search with no result registers in one click; nested forms do not repeat ids', async (page) => {
  await linkReal(page, STAFF);
  await go(page, '#/unit/P03-206', '.drawer');
  assert.ok(await page.isVisible('.drawer .d-head button:has-text("تأجير")'), 'a vacant unit offers «تأجير» in the header');
  await page.click('.drawer .card button:has-text("تأجير هذه الوحدة")'); await waitModal(page, 'عقد جديد');
  assert.equal(await page.inputValue('#f_unitCode'), 'P03-206');
  await page.waitForFunction(() => document.querySelector('#f_rent').value === '16500');
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'pick_clientCode', 'unit is set ⇒ the cursor waits in the client search box');
  await page.fill('#f_rent', '7777'); await page.fill('#f_notes', 'ملاحظة العقد');
  // (أ) نفس اسم عميل موجود ⇒ تنبيه + «استخدم هذا العميل»
  await page.selectOption('#f_clientCode', '__new'); await page.waitForFunction(() => document.querySelectorAll('.modal').length === 2);
  assert.equal(await page.inputValue('#f_clientCode'), '', 'the «＋ عميل جديد» option is not kept as a value');
  assert.equal(await page.evaluate(() => document.querySelectorAll('[id="f_notes"]').length), 1, 'no duplicate #f_notes with two forms open');
  await page.locator('.modal').nth(1).locator('#f_name').fill('عمرو ايمن زكى');
  await page.locator('.modal').nth(1).locator('.m-foot button:has-text("حفظ")').click();
  await page.waitForSelector('.modal .form-errors .dup-clients');
  assert.ok((await page.textContent('.modal .form-errors')).includes('C001'));
  await page.click('.modal .form-errors button:has-text("استخدم هذا العميل")');
  await page.waitForFunction(() => document.querySelectorAll('.modal').length === 1);
  assert.equal(await page.inputValue('#f_clientCode'), 'C001', 'the existing client is selected instead of a duplicate');
  assert.equal(await page.evaluate(() => Egary.Store.state().clients.length), 64, 'no client added');
  assert.equal(await page.inputValue('#f_rent'), '7777', 'typed rent kept'); assert.equal(await page.inputValue('#f_notes'), 'ملاحظة العقد');
  // (ب) اسم جديد يُكتب في بحث العملاء ولا نتيجة ⇒ زر تسجيله مباشرة
  await page.fill('#pick_clientCode', 'سامح الجديد جدا');
  await page.waitForSelector('#pick_clientCode_count .pick-create');
  await page.click('#pick_clientCode_count .pick-create'); await page.waitForFunction(() => document.querySelectorAll('.modal').length === 2);
  assert.equal(await page.locator('.modal').nth(1).locator('#f_name').inputValue(), 'سامح الجديد جدا', 'the typed name is carried into the client form');
  await page.locator('.modal').nth(1).locator('#f_phone').fill('+20 111 222 3334');
  await page.locator('.modal').nth(1).locator('.m-foot button:has-text("حفظ")').click();
  await page.waitForSelector('.toast:has-text("أُضيف العميل C065")');
  assert.ok((await page.textContent('.toast:has-text("أُضيف العميل C065")')).includes('يبقى محفوظًا حتى لو ألغيت العقد'));
  await page.waitForFunction(() => document.querySelectorAll('.modal').length === 1);
  assert.equal(await page.inputValue('#f_clientCode'), 'C065', 'the new client is selected');
  assert.equal(await page.evaluate(() => Egary.Store.client('C065').phone), '01112223334', '+20 typed ⇒ stored as 01…');
  assert.equal(await page.inputValue('#f_rent'), '7777'); assert.equal(await page.inputValue('#f_unitCode'), 'P03-206');
  const w0 = await page.evaluate(() => window.__adapter.writes);
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.toast:has-text("أُضيف العقد T0087")');
  const t = await page.evaluate(() => Egary.Store.contract('T0087'));
  assert.deepEqual([t.clientCode, t.unitCode, t.rent, t.notes, t.depositStatus], ['C065', 'P03-206', 7777, 'ملاحظة العقد', 'none']);
  await waitWrite(page, w0);
  assert.ok(findRow(await sheetRows(page, 'العملاء'), r => r[0] === 'C065' && r[1] === 'سامح الجديد جدا' && String(r[6]) === '01112223334'), 'C065 with its phone as text in «العملاء»');
  assert.ok(findRow(await sheetRows(page, 'العقود'), r => r[0] === 'T0087' && r[1] === 'P03-206' && r[2] === 'C065'));
  assert.ok(findRow(await sheetRows(page, '2026'), r => r[24] === 'T0087' && r[25] === 'P03-206' && r[26] === 'C065'));
});

e2e('W3. renting from the lists: vacant rows in «الوحدات» and in the dashboard «وحدات شاغرة» drawer carry a rent button (unit pre-filled), an occupied unit moves the proposed start after its current contract, unit suggestions say vacant/rented, and a walk-in typed in the top search is registered from «تسجيل عميل جديد»', async (page) => {
  await linkReal(page, STAFF);
  await go(page, '#/units', '#content table.tbl');
  const vacRows = rowsOf(page).filter({ has: page.locator('button[title="تأجير هذه الوحدة"]') });
  assert.equal(await vacRows.count(), 25, 'every vacant unit row has «تأجير هذه الوحدة»');
  await page.locator('#content tr', { has: page.locator('.code', { hasText: /^P01-S2$/ }) }).locator('button[title="تأجير هذه الوحدة"]').click();
  await waitModal(page, 'عقد جديد');
  assert.equal(await page.inputValue('#f_unitCode'), 'P01-S2');
  await page.waitForFunction(() => document.querySelector('#f_rent').value === '30500');
  // وحدة مؤجَّرة: البداية المقترحة = اليوم التالي لنهاية عقدها الحالي (لا خطأ تداخل)
  await page.selectOption('#f_unitCode', 'P02-404');
  await page.waitForFunction(() => document.querySelector('#f_start').value === '2027-01-01');
  assert.equal(await page.inputValue('#f_end'), '2027-12-31');
  assert.ok((await page.textContent('.modal .field[data-field="unitCode"]')).includes('مؤجَّرة الآن'));
  assert.equal(await page.inputValue('#f_rent'), '', 'an occupied unit proposes no rent');
  await page.keyboard.press('Escape'); await page.waitForSelector('.modal', { state: 'detached' });
  await go(page, '#/dashboard', '#content .kpis .kpi');
  await page.click('#content .kpi[data-kpi="وحدات شاغرة"]'); await page.waitForSelector('.drawer table.tbl');
  assert.equal(await page.locator('.drawer button[title="تأجير الوحدة"]').count(), 25);
  await page.locator('.drawer button[title="تأجير الوحدة"]').first().click(); await waitModal(page, 'عقد جديد');
  assert.ok(await page.evaluate(() => { const u = Egary.Store.unit(document.querySelector('#f_unitCode').value); return !!u && Egary.Engine.unitStatus(u).status === 'vacant'; }), 'a vacant unit is pre-filled');
  await page.keyboard.press('Escape'); await page.waitForSelector('.modal', { state: 'detached' });
  // اقتراحات الوحدة تقول حالتها
  let s = await suggestions(page, 'P03-708');
  assert.ok(s.items.find(x => x.code === 'P03-708').sub.includes('شاغرة'), JSON.stringify(s.items[0]));
  s = await suggestions(page, 'P01-M1-2');
  assert.ok(s.items.find(x => x.code === 'P01-M1-2').sub.includes('مؤجَّرة'), JSON.stringify(s.items[0]));
  // عميل غير مسجَّل: «تسجيل عميل جديد» بالاسم المكتوب ثم بروفايله بالخطوة التالية
  await page.fill('#global-search', 'حازم عبد الستار البدري');
  await page.waitForSelector('#suggest:not(.hidden) #sg-new');
  assert.ok((await page.textContent('#sg-new')).includes('حازم عبد الستار البدري'));
  await page.click('#sg-new'); await waitModal(page, 'عميل جديد');
  assert.equal(await page.inputValue('#f_name'), 'حازم عبد الستار البدري');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.drawer #client-next');
  assert.equal(await drawerTitle(page), 'عميل: حازم عبد الستار البدري');
  // تليفون مكتوب في البحث يذهب لخانة التليفون
  await page.fill('#global-search', '01234567890'); await page.waitForSelector('#suggest:not(.hidden) #sg-new');
  await page.click('#sg-new'); await waitModal(page, 'عميل جديد');
  assert.equal(await page.inputValue('#f_phone'), '01234567890'); assert.equal(await page.inputValue('#f_name'), '');
  await page.keyboard.press('Escape'); await page.waitForSelector('.modal', { state: 'detached' });
});

e2e('W4. «تجديد» opens «تجديد العقد T0069» with the end already filled (same length as the old contract) so one click on «حفظ» saves; the new contract opens and is linked to T0069 in «العقود»', async (page) => {
  await linkReal(page, STAFF);
  await go(page, '#/contract/T0069', '.drawer');
  await page.click('.drawer .d-head button:has-text("تجديد")'); await waitModal(page, 'تجديد العقد T0069');
  assert.equal(await page.inputValue('#f_start'), '2026-10-16');
  assert.equal(await page.inputValue('#f_end'), '2027-10-15', 'end filled in (12 months like T0069)');
  assert.equal(await page.inputValue('#f_prevCode'), 'T0069');
  // تغيير البداية يحرّك النهاية بنفس المدة
  await page.fill('#f_start', '2026-11-01'); await page.waitForFunction(() => document.querySelector('#f_end').value === '2027-10-31');
  await page.fill('#f_start', '2026-10-16'); await page.waitForFunction(() => document.querySelector('#f_end').value === '2027-10-15');
  const w0 = await page.evaluate(() => window.__adapter.writes);
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.toast:has-text("أُضيف العقد T0087")');
  await page.waitForFunction(() => /عقد T0087/.test((document.querySelector('.drawer .d-head h2') || {}).textContent || ''), null, { timeout: 5000 });
  const t = await page.evaluate(() => Egary.Store.contract('T0087'));
  assert.deepEqual([t.unitCode, t.clientCode, t.start, t.end, t.rent, t.prevCode], ['P03-704', 'C061', '2026-10-16', '2027-10-15', 11000, 'T0069']);
  await waitWrite(page, w0);
  const k = findRow(await sheetRows(page, 'العقود'), r => r[0] === 'T0087');
  assert.ok(k && k[1] === 'P03-704' && k[6] === '2026-10-16' && k[7] === '2027-10-15' && k.includes('T0069'), JSON.stringify(k));
  assert.ok(findRow(await sheetRows(page, '2026'), r => r[24] === 'T0087'), 'renewal row in the 2026 sheet');
});

e2e('W5. «إنهاء العقد» (staff): the form proposes today, warns once when payments exist after the chosen last day, then writes the new end + a note; the unit is vacant the next day, the audit says «إنهاء مبكر», and «العقود» has the new end; admins deleting an active contract with payments are pointed to «إنهاء العقد»', async (page) => {
  await linkReal(page, STAFF);
  await go(page, '#/contract/T0016', '.drawer');
  await page.click('.drawer .d-head button:has-text("إنهاء العقد")'); await waitModal(page, 'إنهاء العقد T0016');
  assert.equal(await page.inputValue('#f_end'), TODAY, 'last day defaults to today');
  await page.waitForFunction(() => /شاغرة من 10\/10\/2026/.test((document.querySelector('#terminate-info') || {}).textContent || ''));
  await page.fill('#f_end', '2026-07-31'); await page.fill('#f_reason', 'المستأجر سلّم المفتاح');
  await page.click('.modal .m-foot button:has-text("إنهاء العقد")');
  await page.waitForSelector('.modal .form-errors');
  assert.ok((await page.textContent('.modal .form-errors')).includes('أغسطس 2026'), 'payments after the last day are named');
  await page.fill('#f_end', '2026-10-08');
  const w0 = await page.evaluate(() => window.__adapter.writes);
  await page.click('.modal .m-foot button:has-text("إنهاء العقد")');
  await page.waitForSelector('.toast:has-text("أُنهي العقد T0016")');
  await page.waitForSelector('.modal', { state: 'detached' });
  const c = await page.evaluate(() => Egary.Store.contract('T0016'));
  assert.equal(c.end, '2026-10-08');
  assert.ok(c.notes.includes('أُنهي مبكرًا في 08/10/2026 (كان ينتهي 31/12/2026)') && c.notes.includes('المستأجر سلّم المفتاح'), c.notes);
  assert.equal(await page.evaluate(() => Egary.Engine.unitStatus(Egary.Store.unit('P02-404')).status), 'vacant');
  assert.equal(await page.evaluate(() => Egary.Store.paymentsOf('T0016').length), 8, 'no payment deleted');
  assert.ok((await page.textContent('.drawer')).includes('منتهٍ'), 'the reopened profile shows the contract ended');
  assert.equal(await page.locator('.drawer .d-head button:has-text("إنهاء العقد")').count(), 0, 'no «إنهاء العقد» on an ended contract');
  const a = await page.evaluate(() => Egary.Store.state().audit[0]);
  assert.ok(a.summary.startsWith('إنهاء مبكر') && a.code === 'T0016' && a.user === 'موظف المكتب', JSON.stringify(a));
  await waitWrite(page, w0);
  const k = findRow(await sheetRows(page, 'العقود'), r => r[0] === 'T0016');
  assert.equal(k[7], '2026-10-08', 'new end in «العقود»');
  assert.ok(findRow(await sheetRows(page, 'سجل التعديلات'), r => r[1] === 'تعديل' && r[3] === 'T0016' && String(r[4]).startsWith('إنهاء مبكر')), 'audit row in the workbook');
  // المدير: حذف عقد ساري له دفعات ⇒ تنبيه «إنهاء العقد بدل الحذف»
  await go(page, '#/dashboard', '#content .kpis .kpi');
  await page.click('#user-chip'); await page.waitForSelector('#btn-logout'); await page.click('#btn-logout');
  await page.waitForSelector('#btn-demo', { timeout: 20000 });
  await page.evaluate(t => Egary.U.setToday(t), TODAY);
  await linkReal(page, ADMIN);
  await go(page, '#/contract/T0003', '.drawer');
  await page.click('.drawer .d-head button:has-text("حذف")'); await waitModal(page, 'تأكيد الحذف');
  assert.ok((await page.textContent('.modal .del-note')).includes('استخدم «إنهاء العقد» بدل الحذف'));
  await page.click('.modal .m-foot button:has-text("إلغاء")'); await page.waitForSelector('.modal', { state: 'detached' });
  assert.ok(await page.evaluate(() => !!Egary.Store.contract('T0003')));
});

e2e('W6. payments at the counter: the client profile header pays the first open month, an amount for three months is spread over September–November in one go with «حفظ وطباعة الفاتورة» (one receipt, three invoices, three ledger cells), a too-large amount without spreading is confirmed first, the success toast opens the invoice, and deleting a payment names client, month and amount', async (page) => {
  await linkReal(page, STAFF);
  await go(page, '#/client/C014', '.drawer');
  await page.click('.drawer .d-head button:has-text("تسجيل دفعة")'); await waitModal(page, 'تسجيل دفعة');
  assert.equal(await page.inputValue('#f_contractCode'), 'T0016', 'the client\'s only active contract is fixed');
  assert.equal(await page.inputValue('#f_period'), '2026-09', 'first open month');
  await page.waitForFunction(() => document.querySelector('#f_amount').value === '30250');
  assert.ok(await page.locator('.modal .spread-box').evaluate(e => e.classList.contains('hidden')));
  await page.fill('#f_amount', '90750');
  await page.waitForSelector('.modal .spread-box:not(.hidden)');
  assert.ok((await page.textContent('.modal .field[data-field="period"] .help')).includes('هل الدفعة عن أكثر من شهر'));
  const prev = await page.textContent('.modal .spread-preview');
  assert.ok(prev.includes('سبتمبر 2026: 30,250') && prev.includes('أكتوبر 2026: 30,250') && prev.includes('نوفمبر 2026: 30,250'), prev);
  await page.check('#f_spread');
  await page.selectOption('#f_method', 'instapay'); await page.fill('#f_ref', 'IP-77');
  const w0 = await page.evaluate(() => window.__adapter.writes);
  await page.click('#btn-save-print');
  await page.waitForSelector('.modal #invoice-months');
  assert.deepEqual(await page.$$eval('#invoice-months tbody tr td:first-child', e => e.map(x => x.textContent.trim())), ['INV-2026-0510', 'INV-2026-0511', 'INV-2026-0512']);
  assert.ok((await page.textContent('.modal .invoice .total')).includes('90,750'));
  const pays = await page.evaluate(() => ['INV-2026-0510', 'INV-2026-0511', 'INV-2026-0512'].map(c => { const p = Egary.Store.get('payments', c); return p && [p.contractCode, p.period, p.amount, p.method, p.ref, p.paidOn]; }));
  assert.deepEqual(pays, [['T0016', '2026-09', 30250, 'instapay', 'IP-77', TODAY], ['T0016', '2026-10', 30250, 'instapay', 'IP-77', TODAY], ['T0016', '2026-11', 30250, 'instapay', 'IP-77', TODAY]]);
  await page.keyboard.press('Escape'); await page.waitForSelector('.modal', { state: 'detached' });
  await waitWrite(page, w0);
  const inv = await sheetRows(page, 'المدفوعات');
  for (const [code, per] of [['INV-2026-0510', '2026-09'], ['INV-2026-0511', '2026-10'], ['INV-2026-0512', '2026-11']]) assert.ok(findRow(inv, r => r[0] === code && r[1] === 'T0016' && r[4] === per && r[5] === 30250), code + ' in «المدفوعات»');
  const y = findRow(await sheetRows(page, '2026'), r => r[24] === 'T0016');
  assert.deepEqual([y[18], y[19], y[20], y[21]], [30250, 30250, 30250, null], 'September–November cells filled, December empty');
  // مبلغ أكبر بلا توزيع: تأكيد أولًا ثم يُسجَّل كله على الشهر
  await go(page, '#/contract/T0016', '.drawer');
  await page.click('.drawer .card button:has-text("تسجيل دفعة")'); await waitModal(page, 'تسجيل دفعة');
  assert.equal(await page.inputValue('#f_period'), '2026-12', 'the next open month after the spread');
  await page.fill('#f_amount', '40000');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal .form-errors');
  assert.ok((await page.textContent('.modal .form-errors')).includes('المبلغ أكبر من المتبقي لشهر ديسمبر 2026'));
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.toast:has-text("سُجِّلت الدفعة INV-2026-0513")');
  assert.equal(await page.evaluate(() => Egary.Store.get('payments', 'INV-2026-0513').amount), 40000);
  await page.click('.toast:has-text("سُجِّلت الدفعة INV-2026-0513") button:has-text("الفاتورة")');
  await page.waitForSelector('.modal:has-text("الفاتورة INV-2026-0513")');
  await page.keyboard.press('Escape'); await page.waitForSelector('.modal', { state: 'detached' });
  // حذف دفعة: الرسالة تذكر العميل والشهر والمبلغ
  await go(page, '#/payments', '#content table.tbl');
  await page.locator('#content tr', { has: page.locator('.code', { hasText: /^INV-2026-0513$/ }) }).locator('button[title="حذف"]').click();
  await waitModal(page, 'تأكيد الحذف');
  const txt = await page.textContent('.modal .m-body');
  assert.ok(txt.includes('دفعة «INV-2026-0513»') && txt.includes('د/ فادي سعيد منصور') && txt.includes('ديسمبر 2026') && txt.includes('40,000'), txt);
  await page.click('.modal .m-foot button:has-text("إلغاء")');
});

e2e('W7. client with several active contracts: «تسجيل دفعة» lists only that client\'s contracts; maintenance from the unit profile puts the cursor on the description, and an open request is closed from its row with cost and who pays — written to «الصيانة»', async (page) => {
  await linkReal(page, STAFF);
  await go(page, '#/client/C003', '.drawer');
  await page.click('.drawer .d-head button:has-text("تسجيل دفعة")'); await waitModal(page, 'تسجيل دفعة');
  const own = await page.evaluate(() => Egary.Store.contractsOfClient('C003').map(c => c.code).sort());
  assert.deepEqual((await page.$$eval('#f_contractCode option', o => o.map(x => x.value).filter(Boolean))).sort(), own, 'only C003\'s contracts');
  await page.selectOption('#f_contractCode', own[0]);
  await page.waitForFunction(() => /^\d{4}-\d{2}$/.test(document.querySelector('#f_period').value), null, { timeout: 3000 });
  await page.keyboard.press('Escape'); await page.waitForSelector('.modal', { state: 'detached' });
  await go(page, '#/unit/P02-404', '.drawer');
  await page.click('.drawer button:has-text("تسجيل صيانة")'); await waitModal(page, 'طلب صيانة');
  await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'f_description', null, { timeout: 3000 });
  await page.keyboard.type('تسريب في الحمام');
  await page.selectOption('#f_kind', 'plumbing');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.toast:has-text("سُجِّلت الصيانة M0001")');
  await page.waitForSelector('.drawer button[title="إغلاق الطلب"]');
  await page.click('.drawer button[title="إغلاق الطلب"]'); await waitModal(page, 'إغلاق طلب الصيانة M0001');
  assert.equal(await page.inputValue('#f_closedOn'), TODAY);
  await page.fill('#f_cost', '850'); await page.selectOption('#f_borneBy', 'tenant');
  const w0 = await page.evaluate(() => window.__adapter.writes);
  await page.click('.modal .m-foot button:has-text("إغلاق الطلب")');
  await page.waitForSelector('.toast:has-text("أُغلق طلب الصيانة M0001")');
  const m = await page.evaluate(() => Egary.Store.get('maintenance', 'M0001'));
  assert.deepEqual([m.status, m.closedOn, m.cost, m.borneBy, m.description, m.custodianContract], ['closed', TODAY, 850, 'tenant', 'تسريب في الحمام', 'T0016']);
  assert.equal(await page.locator('.drawer button[title="إغلاق الطلب"]').count(), 0, 'closed requests have no close button');
  await waitWrite(page, w0);
  const row = findRow(await sheetRows(page, 'الصيانة'), r => r[0] === 'M0001');
  assert.ok(row && row[1] === 'P02-404' && row[5] === 'سباكة' && row[7] === 850 && row[8] === 'المستأجر' && row[9] === 'مغلقة' && row[10] === TODAY, JSON.stringify(row));
});

e2e('W8. a view-only account sees a «حساب مشاهدة فقط» bar, gets the same view-only wording on delete, and the walk-in shortcut is not offered in the search', async (page) => {
  await linkReal(page, VIEWER);
  await page.waitForSelector('#viewer-banner');
  assert.ok((await page.textContent('#viewer-banner')).includes('حساب مشاهدة فقط'));
  await go(page, '#/payments', '#content table.tbl');
  await rowsOf(page).first().locator('button[title="حذف"]').click();
  await page.waitForSelector('.toast:has-text("حسابك للمشاهدة فقط")');
  await page.fill('#global-search', 'شخص غير موجود'); await page.waitForSelector('#suggest:not(.hidden) .all');
  assert.equal(await page.locator('#sg-new').count(), 0);
  assert.equal(await page.evaluate(() => window.__adapter.writes + Egary.Sync.status.pending), 0);
});

e2e('W9. Escape on a filled form does not lose the typing: «أُغلق النموذج بدون حفظ — استرجاع ما كتبته» reopens it with the same values and saving still writes the record; an untouched form closes silently', async (page) => {
  await linkReal(page, STAFF);
  await go(page, '#/clients', '#content table.tbl');
  await page.click('#content .page-head button:has-text("عميل جديد")'); await waitModal(page, 'عميل جديد');
  await page.keyboard.press('Escape'); await page.waitForSelector('.modal', { state: 'detached' });
  assert.equal(await page.locator('#btn-restore-form').count(), 0, 'nothing typed ⇒ no restore offer');
  await page.click('#content .page-head button:has-text("عميل جديد")'); await waitModal(page, 'عميل جديد');
  await page.fill('#f_name', 'عميل كاد أن يضيع'); await page.fill('#f_phone', '01098765432');
  await page.keyboard.press('Escape'); await page.waitForSelector('.modal', { state: 'detached' });
  await page.waitForSelector('.toast #btn-restore-form');
  await page.click('#btn-restore-form'); await waitModal(page, 'عميل جديد');
  assert.equal(await page.inputValue('#f_name'), 'عميل كاد أن يضيع'); assert.equal(await page.inputValue('#f_phone'), '01098765432');
  const w0 = await page.evaluate(() => window.__adapter.writes);
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.toast:has-text("أُضيف العميل C065")');
  await waitWrite(page, w0);
  assert.ok(findRow(await sheetRows(page, 'العملاء'), r => r[0] === 'C065' && r[1] === 'عميل كاد أن يضيع' && String(r[6]) === '01098765432'));
});

/* =====================================================================
   V1. مراجعة المُتحقِّق: صف «الإجمالي العام» في كشف التحصيل يُظهر إجماليات الشهور نفسها (لا أرقام صف تحته)،
   والبحث برقم قصير «202» في المدفوعات = دفعات الوحدتين 202 فقط (لا كل دفعات 2026)
   ===================================================================== */
e2e('V1. the collection sheet\'s sticky «الإجمالي العام» row shows the month totals themselves at 1366×768 (no data row showing through), and «202» in the payments search means units 202, not every 2026 invoice', async (page) => {
  await linkReal(page);
  await go(page, '#/ledger?year=2026', '#ledger tfoot');
  await page.waitForTimeout(300);
  const foot = await page.evaluate(() => {
    const wrap = document.querySelector('.ledger-wrap').getBoundingClientRect();
    const tds = [...document.querySelectorAll('#ledger tfoot td.m')];
    return { wrapBottom: wrap.bottom, cells: tds.map(td => ({ t: td.textContent.trim(), bottom: td.getBoundingClientRect().bottom })) };
  });
  assert.equal(foot.cells.length, 12);
  assert.ok(foot.cells.every(c => c.bottom <= foot.wrapBottom + 1), 'month totals sit in the sticky row at the bottom of the sheet: ' + JSON.stringify(foot));
  const tot = await page.evaluate(() => Egary.Engine.ledger(2026, {}).monthTotals['2026-08']);
  assert.equal(num(foot.cells[7].t), Math.round(tot), 'August total');
  // «202» في المدفوعات
  await page.evaluate(() => { Egary.App.filter.q = '202'; });
  await afterRender(page, () => go(page, '#/payments'));
  // المتوقَّع: دفعات الوحدتين 202، ودفعات عميل فيه مجموعة «202» في رقمه الضريبي (321-202-991) — لا أي دفعة لمجرد أنها في 2026
  const expect = await page.evaluate(() => Egary.Store.state().payments.filter(p => { const c = Egary.Store.contract(p.contractCode); if (!c) return false; const cl = Egary.Store.client(c.clientCode) || {}; return ['P02-202', 'P03-202'].includes(c.unitCode) || /(^|\D)202(\D|$)/.test(cl.taxId || ''); }).length);
  assert.ok(expect > 0 && expect < 100, 'expected ' + expect);
  assert.equal(await rowsOf(page).count(), expect, 'only the payments of units 202 (and a tax ID group 202)');
}, { viewport: { width: 1366, height: 768 } });

e2e('V2. phone width (390px), demo: the «وضع تجريبي» bar wraps its buttons instead of widening the page', async (page) => {
  await demo(page);
  for (const v of ['dashboard', 'payments', 'units']) {
    await go(page, '#/' + v, '#content .page-head');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390, v);
  }
}, { viewport: { width: 390, height: 844 } });
