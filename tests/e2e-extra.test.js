// اختبارات E2E إضافية (تغطية المسارات التي لم تغطِّها tests/e2e.test.js): تعديل الوحدة بالأصول، الصيانة والعهدة،
// تطبيع تليفون العميل، التجديد من درج «تنتهي قريبًا»، تعديل الفاتورة من نافذتها، روابط جودة البيانات، عمود المستخدم في
// سجل التعديلات، نموذج الإعدادات ← ورقة «الإعدادات»، إضافة سنة ← ورقة جديدة + سلايسر «المحاسبة من»، أزرار الكشف،
// لوحة المفاتيح في البحث، سلايسرات المدفوعات/العملاء/العقود، إدارة المستخدمين، بوابات الأدوار، الموبايل، BI، النسخ،
// حذف عقد متسلسل، أدلة اللوحة، شبكة شهور العقد.
// التشغيل: cd /home/user/Egary && NODE_PATH=/opt/node22/lib/node_modules node --test tests/e2e-extra.test.js
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const APP = 'file://' + path.resolve(__dirname, '../Egary/index.html');
const XLSX_B64 = fs.readFileSync(path.resolve(__dirname, '../Egary/Egary.xlsx')).toString('base64');
const OUT = process.env.EGARY_E2E_OUT || path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const TODAY = '2026-10-09';           // «اليوم» المثبَّت — كل الأرقام أدناه محسوبة عليه
const TIMEOUT = 120000;

let browser;
before(async () => { browser = await chromium.launch({ executablePath: CHROME }); });
after(async () => { if (browser) await browser.close(); });

/* ---------- أدوات (منسوخة من tests/e2e.test.js) ---------- */
function py(script, ...args) { return JSON.parse(execFileSync('python3', ['-I', '-c', script, ...args], { encoding: 'utf-8' })); }
const num = (t) => { const s = String(t || '').replace(/[^\d.-]/g, ''); return s === '' || s === '-' ? 0 : Number(s); };

async function openApp(opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1440, height: 900 }, acceptDownloads: true });
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
      throw e;
    } finally { await ctx.close(); }
  });
}
const ADMIN = ['admin', 'admin@2026'], STAFF = ['office', 'office@2026'], VIEWER = ['zaer', 'view@2026'];
async function loginAs(page, creds, remember) {
  await page.waitForSelector('#login-form', { timeout: 20000 });
  await page.fill('#login-user', creds[0]); await page.fill('#login-pass', creds[1]);
  if (remember) await page.check('#login-remember');
  await page.click('#login-go');
  await page.waitForSelector('#login', { state: 'detached', timeout: 20000 });
}
async function linkReal(page, creds, b64) {
  await page.evaluate(() => { if (location.hash && location.hash !== '#/dashboard') location.hash = '#/dashboard'; });
  await page.evaluate((b64) => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
    const adapter = Egary.FileLink.memoryAdapter(bytes, 'Egary.xlsx');
    window.__adapter = adapter;
    Egary.App.linkAdapter(adapter);
  }, b64 || XLSX_B64);
  if (creds === null) return;
  await loginAs(page, creds || ADMIN);
  await page.waitForSelector('#content .kpis .kpi');
  await page.waitForFunction(() => Egary.Sync.status.state === 'linked' && Egary.Sync.status.pending === 0);
  await page.evaluate(() => { window.__adapter.writes = 0; });
}
async function go(page, hash, waitSel) {
  // نفس الهاش (مثل إعادة فتح #/contract/T0016): نطلق hashchange حتى يمر بـ onHash (الذي يفتح البروفايل) لا render فقط
  await page.evaluate(h => { if (location.hash === h) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = h; }, hash);
  if (waitSel) await page.waitForSelector(waitSel);
}
/* تنفيذ فعل يغيّر الهاش ثم انتظار إعادة رسم المحتوى فعلًا (الهاش يتغيّر فورًا لكن hashchange غير متزامن) */
async function afterRender(page, act) {
  const h = await page.evaluateHandle(() => document.querySelector('#content').firstElementChild);
  await act();
  await page.waitForFunction(el => !el || !el.isConnected, h);
  await h.dispose();
}
async function closeDrawer(page) {
  await page.click('.drawer .d-head button[aria-label="إغلاق"]');
  await page.waitForSelector('.drawer', { state: 'detached' });
}
async function closeModal(page) { await page.keyboard.press('Escape'); await page.waitForSelector('.modal', { state: 'detached' }); }
/* انتظار نافذة بعنوان معيّن ثم انتظار التركيز التلقائي الذي تضعه UI.modal بعد 30ms على أول حقل —
   وإلا سبق page.fill ذلك المؤقّت فذهب النص المكتوب إلى الحقل الأول بدل الحقل المقصود */
async function waitModal(page, text) {
  await page.waitForSelector(`.modal:has-text("${text}")`);
  await page.waitForFunction(() => { const a = document.activeElement; return !!(a && a.closest && a.closest('.modal')); }, null, { timeout: 2000 }).catch(() => {});
}
const drawerTitle = (page) => page.locator('.drawer .d-head h2').textContent();
const navCount = (page, view) => page.locator(`#sidebar a[data-view="${view}"] .cnt`).textContent();
const rowsOf = (page, sel) => page.locator((sel || '#content table.tbl') + ' tbody tr');
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
const b64Of = (page) => page.evaluate(() => { const u = new Uint8Array(window.__adapter.bytes()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); });
async function exportBytes(page, filename) { const f = path.join(OUT, filename); fs.writeFileSync(f, Buffer.from(await b64Of(page), 'base64')); return f; }
const settingVal = (rows, key) => (rows.find(r => r && r[0] === key) || [])[1];
const kvVal = (scope, label) => scope.locator('.kv div', { has: scope.page().locator('dt', { hasText: new RegExp('^' + label + '$') }) }).locator('dd').textContent();

/* =====================================================================
   E1. تعديل وحدة من جدول الوحدات: أصول مُعلَّمة + أصل مخصص
   ===================================================================== */
e2e('E1. unit edit from the units table: a checked catalogue asset with details + a custom asset show in the profile, in «أصول الوحدات» and in the units summary column; the project stays locked', async (page) => {
  await linkReal(page);
  await go(page, '#/units', '#content table.tbl');
  const row = page.locator('#content table.tbl tbody tr', { has: page.locator('td:first-child .code', { hasText: /^P03-304$/ }) });
  assert.equal((await row.locator('td:nth-child(10)').textContent()).trim(), '0', 'no assets yet');
  await row.locator('button[title="تعديل"]').click();
  await waitModal(page, 'تعديل وحدة P03-304');
  assert.ok(await page.locator('#f_projectCode').isDisabled(), 'project select is locked when editing');
  assert.equal(await page.inputValue('#f_label'), '304');
  assert.equal(await page.locator('.modal .asset-row').count(), 12, 'the full catalogue is offered');
  const ac = page.locator('.modal .asset-row[data-asset="تكييف"]');
  await ac.locator('input[type="checkbox"]').check();
  await ac.locator('input[name="_a_details"]').fill('2 سبليت');
  await page.click('.modal button:has-text("أصل آخر")');
  const custom = page.locator('.modal .asset-row').last();
  assert.ok(await custom.locator('input[type="checkbox"]').isChecked(), 'a custom asset is present by default');
  await custom.locator('input[name="_a_name"]').fill('ثلاجة');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal', { state: 'detached' });
  await page.waitForSelector('.toast:has-text("عُدِّلت الوحدة P03-304")');
  assert.equal(await navCount(page, 'units'), '71', 'edit does not add a unit');
  assert.equal((await row.locator('td:nth-child(10)').textContent()).trim(), '2', 'assets column counts the present ones');

  await go(page, '#/unit/P03-304', '.drawer');
  const card = page.locator('.drawer .card', { hasText: 'الأصول والمحتويات' });
  assert.equal(await card.locator('.badge.ok').count(), 2);
  const t = await card.textContent();
  assert.ok(t.includes('تكييف') && t.includes('— 2 سبليت') && t.includes('ثلاجة'), t);
  await closeDrawer(page);

  await waitWrite(page, 0);
  const assets = (await sheetRows(page, 'أصول الوحدات')).filter(r => r && r[0] === 'P03-304').map(r => [r[0], r[1], r[2], r[3] == null ? '' : r[3]]);
  assert.deepEqual(assets.sort((a, b) => a[1].localeCompare(b[1], 'ar')), [['P03-304', 'تكييف', 'نعم', '2 سبليت'], ['P03-304', 'ثلاجة', 'نعم', '']].sort((a, b) => a[1].localeCompare(b[1], 'ar')));
  const u = (await sheetRows(page, 'الوحدات')).find(r => r && r[0] === 'P03-304');
  assert.equal(u[9], 'تكييف (2 سبليت) · ثلاجة', 'assets summary column');
  assert.equal(u[3], '304'); assert.equal(u[1], 'P03');
  const audit = await sheetRows(page, 'سجل التعديلات');
  assert.deepEqual(audit[1].slice(1, 4), ['تعديل', 'وحدة', 'P03-304']); assert.equal(audit[1][5], 'المدير');
});

/* =====================================================================
   E2. الصيانة: إنشاء (العهدة)، الإغلاق، الفلاتر، الرابط إلى العقد
   ===================================================================== */
e2e('E2. maintenance: a new ticket shows the custodian at that date and is written to «الصيانة»; closing it stamps closedOn = today; status chips filter; the custodian link opens the contract; the unit profile lists it', async (page) => {
  await linkReal(page);
  await go(page, '#/maintenance', '#mstatus-bar');
  assert.equal(await navCount(page, 'maintenance'), '0');
  await page.click('#content button:has-text("طلب صيانة")');
  await waitModal(page, 'طلب صيانة / إصلاح جديد');
  assert.equal(await page.inputValue('#f_date'), TODAY, 'date defaults to today');
  await page.selectOption('#f_unitCode', 'P02-404');
  await page.waitForFunction(() => /في عهدة/.test(document.querySelector('.modal .field[data-field="unitCode"] .help').textContent));
  const hint = await page.textContent('.modal .field[data-field="unitCode"] .help');
  assert.ok(hint.includes('د/ فادي سعيد منصور') && hint.includes('T0016'), hint);
  await page.selectOption('#f_kind', 'plumbing');
  await page.fill('#f_cost', '500');
  await page.fill('#f_description', 'تسريب في حوض المطبخ');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal', { state: 'detached' });
  await page.waitForSelector('.toast:has-text("سُجِّلت الصيانة M0001")');
  assert.equal(await navCount(page, 'maintenance'), '1');
  const sub = await page.textContent('#content .page-head .sub');
  assert.ok(sub.startsWith('1 مفتوحة') && sub.includes('تكلفة هذه السنة 500'), sub);
  const cells = await rowsOf(page).first().locator('td').allTextContents();
  assert.equal(cells[0].trim(), 'M0001'); assert.equal(cells[4].trim(), 'سباكة'); assert.equal(num(cells[6]), 500); assert.equal(cells[7].trim(), 'المالك'); assert.equal(cells[8].trim(), 'د/ فادي سعيد منصور'); assert.equal(cells[9].trim(), 'مفتوحة');
  await rowsOf(page).first().locator('td:nth-child(9) a').click(); await page.waitForSelector('.drawer');
  assert.equal(await drawerTitle(page), 'عقد T0016'); await closeDrawer(page);

  let writes = await waitWrite(page, 0);
  let m = (await sheetRows(page, 'الصيانة')).find(r => r && r[0] === 'M0001');
  assert.ok(m, 'M0001 in الصيانة');
  assert.equal(m[1], 'P02-404'); assert.equal(m[3], '404'); assert.equal(m[4], TODAY); assert.equal(m[5], 'سباكة'); assert.equal(m[6], 'تسريب في حوض المطبخ'); assert.equal(m[7], 500); assert.equal(m[8], 'المالك'); assert.equal(m[9], 'مفتوحة'); assert.equal(m[10], null, 'not closed'); assert.equal(m[13], 'T0016'); assert.equal(m[14], 'د/ فادي سعيد منصور');

  // إغلاق الطلب من زر التعديل
  await rowsOf(page).first().locator('button[title="تعديل"]').click();
  await waitModal(page, 'تعديل صيانة M0001');
  assert.equal(await page.inputValue('#f_closedOn'), '');
  await page.selectOption('#f_status', 'closed');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal', { state: 'detached' });
  await page.waitForSelector('.toast:has-text("عُدِّلت الصيانة M0001")');
  assert.equal((await rowsOf(page).first().locator('td:nth-child(10)').textContent()).trim(), 'مغلقة');
  assert.equal(await page.evaluate(() => Egary.Store.get('maintenance', 'M0001').closedOn), TODAY, 'closedOn auto-stamped');
  assert.ok((await page.textContent('#content .page-head .sub')).startsWith('0 مفتوحة'));
  writes = await waitWrite(page, writes);
  m = (await sheetRows(page, 'الصيانة')).find(r => r && r[0] === 'M0001');
  assert.equal(m[9], 'مغلقة'); assert.equal(m[10], TODAY);

  // فلاتر الحالة
  await afterRender(page, () => page.locator('#mstatus-bar button', { hasText: /^مفتوحة$/ }).click());
  assert.ok((await page.evaluate(() => location.hash)).includes('mstatus=open'));
  assert.equal(await page.locator('#content table.tbl tbody .empty').count(), 1, 'no open tickets');
  await afterRender(page, () => page.locator('#mstatus-bar button', { hasText: /^مغلقة$/ }).click());
  assert.ok((await page.evaluate(() => location.hash)).includes('mstatus=closed'));
  assert.equal(await rowsOf(page).count(), 1);
  await afterRender(page, () => page.locator('#mstatus-bar button[data-mkind="plumbing"]').click());
  assert.ok((await page.evaluate(() => location.hash.includes('mkind=plumbing') && location.hash.includes('mstatus=closed'))));
  assert.equal(await rowsOf(page).count(), 1);
  await afterRender(page, () => page.locator('#mstatus-bar button[data-mkind="electric"]').click());
  assert.equal(await page.locator('#content table.tbl tbody .empty').count(), 1, 'kind filter excludes the plumbing ticket');

  // بروفايل الوحدة
  await go(page, '#/unit/P02-404', '.drawer');
  const mc = page.locator('.drawer .card', { hasText: 'متابعة الصيانة' });
  assert.ok((await mc.locator('h3').textContent()).includes('(1)'));
  const mct = await mc.textContent();
  assert.ok(mct.includes('د/ فادي سعيد منصور') && mct.includes('مغلقة') && mct.includes('سباكة'), mct);
  await closeDrawer(page);
  const audit = await sheetRows(page, 'سجل التعديلات');
  assert.deepEqual(audit[1].slice(1, 4), ['تعديل', 'صيانة', 'M0001']); assert.deepEqual(audit[2].slice(1, 4), ['إضافة', 'صيانة', 'M0001']);
});

/* =====================================================================
   E3. تعديل عميل: تطبيع التليفون + تأكيد الرقم القومي المكرر
   ===================================================================== */
e2e('E3. client edit: an Arabic-digit phone with spaces is normalised to 01005556677 (profile, search, «العملاء»); a duplicate national id warns, a cancelled attempt warns again, confirming saves', async (page) => {
  await linkReal(page);
  await go(page, '#/client/C001', '.drawer');
  await page.click('.drawer .d-head button:has-text("تعديل")');
  await waitModal(page, 'تعديل عميل C001');
  await page.fill('#f_phone', '٠١٠٠ ٥٥٥ ٦٦٧٧');
  await page.fill('#f_email', 'amr@example.com');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal', { state: 'detached' });
  await page.waitForSelector('.toast:has-text("عُدِّل العميل C001")');
  await page.waitForFunction(() => Egary.Store.client('C001').phone === '01005556677');
  await page.waitForFunction(() => /01005556677/.test((document.querySelector('.drawer .profile-head') || {}).textContent || ''), null, { timeout: 10000 });
  assert.ok((await page.textContent('.drawer .profile-head')).includes('ت: 01005556677'));
  const st = await page.evaluate(() => Egary.Store.client('C001'));
  assert.equal(st.phone, '01005556677'); assert.equal(st.email, 'amr@example.com'); assert.equal(st.nationalId, '25138731744548');
  let writes = await waitWrite(page, 0);
  let c = (await sheetRows(page, 'العملاء')).find(r => r && r[0] === 'C001');
  assert.equal(String(c[6]), '01005556677'); assert.equal(c[8], 'amr@example.com'); assert.equal(String(c[4]), '25138731744548');

  // الرقم القومي المكرر: تحذير أولًا
  const dupId = await page.evaluate(() => Egary.Store.client('C002').nationalId);
  await page.click('.drawer .d-head button:has-text("تعديل")');
  await waitModal(page, 'تعديل عميل C001');
  await page.fill('#f_nationalId', dupId);
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal .form-errors');
  const err = await page.textContent('.modal .form-errors');
  assert.ok(err.includes('C002') && err.includes('شركة البركة للمقاولات'), err);
  assert.equal(await page.evaluate(() => Egary.Store.client('C001').nationalId), '25138731744548', 'not saved after the warning');
  // إلغاء ثم محاولة جديدة: التحذير يجب أن يظهر من جديد (التأكيد لمحاولة واحدة لا يلتصق بالسجل)
  await page.click('.modal .m-foot button:has-text("إلغاء")'); await page.waitForSelector('.modal', { state: 'detached' });
  await page.click('.drawer .d-head button:has-text("تعديل")'); await waitModal(page, 'تعديل عميل C001');
  await page.fill('#f_nationalId', dupId);
  await page.click('.modal .m-foot button:has-text("حفظ")');
  // نتيجة واحدة حتمية: إمّا تحذير داخل النموذج أو إغلاقه بعد الحفظ
  const outcome = await (await page.waitForFunction(() => { const m = document.querySelector('.modal'); if (!m) return 'saved'; const e = m.querySelector('.form-errors'); return e && e.textContent.trim() ? 'warned' : false; }, null, { timeout: 10000 })).jsonValue();
  if (outcome === 'warned') { await page.click('.modal .m-foot button:has-text("حفظ")'); await page.waitForSelector('.modal', { state: 'detached' }); }
  await page.waitForFunction(id => Egary.Store.client('C001').nationalId === id, dupId, { timeout: 10000 });
  assert.equal(await page.evaluate(() => Egary.Store.client('C001').nationalId), dupId);
  writes = await waitWrite(page, writes);
  c = (await sheetRows(page, 'العملاء')).find(r => r && r[0] === 'C001');
  assert.equal(String(c[4]), dupId);
  await closeDrawer(page);
  // البحث بالتليفون
  await page.fill('#global-search', '01005556677'); await page.waitForSelector('#suggest:not(.hidden) .item');
  assert.equal(await page.locator('#suggest .item').first().locator('.code').textContent(), 'C001');
  assert.equal(outcome, 'warned', 'the duplicate-id warning must be shown again after a cancelled attempt (confirmation is per attempt)');
});

/* =====================================================================
   E4. التجديد من درج «عقود تنتهي خلال 90 يومًا»
   ===================================================================== */
e2e('E4. renew from the renewals drawer: the form is prefilled (unit, client, start = end+1, rent, previous contract); saving writes «العقود» with the previous-contract column, both profiles link to each other, the tile count drops', async (page) => {
  await linkReal(page);
  const NEXT = await page.evaluate(() => Egary.Codes.nextContract(Egary.Store.state()));
  const soon0 = await page.evaluate(() => Egary.Engine.kpis({}).renewals.soon.length);
  const old = await page.evaluate(() => Egary.Store.contract('T0069'));
  assert.equal(old.end, '2026-10-15');
  await page.click('#content .kpi[data-kpi="عقود تنتهي خلال 90 يومًا"]'); await page.waitForSelector('.drawer table.tbl');
  assert.equal(await rowsOf(page, '.drawer table.tbl').count(), soon0);
  const row = page.locator('.drawer table.tbl tbody tr', { has: page.locator('.code', { hasText: /^T0069$/ }) });
  await row.locator('button[title="تجديد / عقد جديد"]').click();
  await waitModal(page, 'عقد جديد');
  assert.equal(await page.inputValue('#f_unitCode'), 'P03-704');
  assert.equal(await page.inputValue('#f_clientCode'), old.clientCode);
  assert.equal(await page.inputValue('#f_start'), '2026-10-16', 'start = old end + 1');
  assert.equal(await page.inputValue('#f_rent'), '11000', 'rent carried over (0% increase)');
  assert.equal(await page.inputValue('#f_prevCode'), 'T0069');
  assert.equal(await page.inputValue('#f_end'), '', 'end is left for the user');
  await page.fill('#f_end', '2027-10-15');
  await page.fill('#f_rent', '12000');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal', { state: 'detached' });
  await page.waitForSelector(`.toast:has-text("أُضيف العقد ${NEXT}")`);
  await page.waitForSelector('.drawer', { state: 'detached' });
  assert.equal(await navCount(page, 'contracts'), '87');
  assert.equal(num(await page.textContent('#content .kpi[data-kpi="عقود تنتهي خلال 90 يومًا"] .v')), soon0 - 1, 'T0069 now has a successor');

  await go(page, '#/contract/' + NEXT, '.drawer');
  assert.equal((await kvVal(page.locator('.drawer'), 'العقد السابق')).trim(), 'T0069');
  assert.equal((await kvVal(page.locator('.drawer'), 'العقد التالي')).trim(), '—');
  await closeDrawer(page);
  await go(page, '#/contract/T0069', '.drawer');
  assert.equal((await kvVal(page.locator('.drawer'), 'العقد التالي')).trim(), NEXT);
  await closeDrawer(page);

  await waitWrite(page, 0);
  const k = (await sheetRows(page, 'العقود')).find(r => r && r[0] === NEXT);
  assert.ok(k, NEXT + ' in العقود');
  assert.equal(k[1], 'P03-704'); assert.equal(k[2], old.clientCode); assert.equal(k[6], '2026-10-16'); assert.equal(k[7], '2027-10-15'); assert.equal(k[8], 12000); assert.equal(k[14], 'T0069'); assert.equal(k[19], 'لم يبدأ');
  assert.ok((await sheetRows(page, '2026')).find(r => r && r[24] === NEXT), 'the new contract has a 2026 ledger row');
  const audit = await sheetRows(page, 'سجل التعديلات');
  assert.deepEqual(audit[1].slice(1, 4), ['إضافة', 'عقد', NEXT]); assert.equal(audit[1][5], 'المدير');
});

/* =====================================================================
   E5. تعديل الدفعة من نافذة الفاتورة
   ===================================================================== */
e2e('E5. invoice modal → «تعديل» → change method and reference → the invoice reopens with the new values, «المدفوعات» and the audit row are updated, and the payments table underneath shows the change', async (page) => {
  await linkReal(page);
  await go(page, '#/payments', '#content table.tbl');
  const first = rowsOf(page).first();
  const code = (await first.locator('td:first-child .code').textContent()).trim();
  await first.locator('td:first-child').click();
  await page.waitForSelector('.modal #invoice-print');
  assert.ok((await page.textContent('#invoice-print')).includes('غير محدد'), 'imported payment has no method yet');
  await page.click('.modal .m-foot button:has-text("تعديل")');
  await waitModal(page, 'تعديل الفاتورة ' + code + '');
  assert.ok(await page.locator('#f_contractCode').isDisabled(), 'contract is locked when editing');
  await page.selectOption('#f_method', 'transfer');
  await page.fill('#f_ref', 'REF-77');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.toast:has-text("عُدِّلت الدفعة ' + code + '")');
  await page.waitForSelector('.modal #invoice-print');
  assert.equal(await page.textContent('.modal .m-head h3'), 'الفاتورة ' + code);
  const inv = await page.textContent('#invoice-print');
  assert.ok(inv.includes('تحويل بنكي') && inv.includes('REF-77'), inv);
  await closeModal(page);
  const rowNow = page.locator('#content table.tbl tbody tr', { has: page.locator('td:first-child .code', { hasText: new RegExp('^' + code + '$') }) });
  const shownMethod = (await rowNow.locator('td:nth-child(7)').textContent()).trim();

  await waitWrite(page, 0);
  const p = (await sheetRows(page, 'المدفوعات')).find(r => r && r[0] === code);
  assert.equal(p[7], 'تحويل بنكي'); assert.equal(p[8], 'REF-77'); assert.equal(p[10], 'الموقع');
  const audit = await sheetRows(page, 'سجل التعديلات');
  assert.deepEqual(audit[1].slice(1, 4), ['تعديل', 'دفعة', code]); assert.equal(audit[1][5], 'المدير');
  assert.equal(await page.evaluate(c => Egary.Store.get('payments', c).method, code), 'transfer');
  assert.equal(shownMethod, 'تحويل بنكي', 'payments table row reflects the edit made from the invoice modal');
});

/* =====================================================================
   E6. جودة البيانات: روابط الأكواد
   ===================================================================== */
e2e('E6. quality page: the code link of a contract / unit / client flag opens the matching profile; the flag count matches the settings summary', async (page) => {
  await linkReal(page);
  await go(page, '#/quality', '#content table.tbl');
  const n = await rowsOf(page).count();
  const pick = (entityAr) => page.locator('#content table.tbl tbody tr', { has: page.locator('td:nth-child(2)', { hasText: new RegExp('^' + entityAr + '$') }) }).first();
  let r = pick('عقد'); let code = (await r.locator('td:nth-child(3) .code').textContent()).trim();
  await r.locator('td:nth-child(3) a.code').click(); await page.waitForSelector('.drawer');
  assert.equal(await drawerTitle(page), 'عقد ' + code); await closeDrawer(page);
  r = pick('وحدة'); code = (await r.locator('td:nth-child(3) .code').textContent()).trim();
  await r.locator('td:nth-child(3) a.code').click(); await page.waitForSelector('.drawer');
  assert.equal((await page.locator('.drawer .profile-head .code').first().textContent()).trim(), code); await closeDrawer(page);
  r = pick('عميل'); code = (await r.locator('td:nth-child(3) .code').textContent()).trim();
  await r.locator('td:nth-child(3) a.code').click(); await page.waitForSelector('.drawer');
  assert.ok((await drawerTitle(page)).startsWith('عميل: '));
  assert.equal((await page.locator('.drawer .profile-head .code').first().textContent()).trim(), code); await closeDrawer(page);
  // الصف الأول تحذير (لا أخطاء في هذا الملف) والترتيب حسب الأهمية
  const sevs = await page.$$eval('#content table.tbl tbody tr td:first-child .badge', b => b.map(x => x.textContent.trim()));
  const rank = { 'خطأ': 0, 'تحذير': 1, 'ملاحظة': 2 };
  assert.ok(sevs.every((s, i) => i === 0 || rank[sevs[i - 1]] <= rank[s]), 'sorted by severity');
  await go(page, '#/settings', '#users-card');
  assert.equal((await kvVal(page.locator('#content .card', { hasText: 'ملخص البيانات' }), 'ملاحظات جودة البيانات')).trim(), String(n));
});

/* =====================================================================
   E7. سجل التعديلات بعد تعديل مشروع: عمود المستخدم
   ===================================================================== */
e2e('E7. editing a project writes an audit row with the admin name (audit page badge, «سجل التعديلات» sheet, operations log); the card and «المشاريع» carry the new data', async (page) => {
  await linkReal(page);
  await go(page, '#/projects', '#content .page-head');
  await page.locator('#content .card', { hasText: 'بابل' }).locator('button[title="تعديل"]').click();
  await waitModal(page, 'تعديل مشروع P01');
  assert.ok(await page.locator('#f__code').isDisabled(), 'code is read-only');
  await page.fill('#f_area', 'الدقي');
  await page.fill('#f_address', 'شارع التحرير 10');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal', { state: 'detached' });
  await page.waitForSelector('.toast:has-text("عُدِّل المشروع P01")');
  assert.ok((await page.locator('#content .card', { hasText: 'بابل' }).textContent()).includes('شارع التحرير 10'));
  assert.equal(await navCount(page, 'projects'), '3');

  await go(page, '#/audit', '#content table.tbl');
  const tds = await rowsOf(page).first().locator('td').allTextContents();
  assert.equal(tds[1].trim(), 'تعديل'); assert.equal(tds[2].trim(), 'مشروع'); assert.equal(tds[3].trim(), 'P01'); assert.equal(tds[5].trim(), 'المدير');
  assert.equal(await rowsOf(page).first().locator('td:nth-child(6) .badge.role').count(), 1, 'user shown as a badge');
  assert.ok((await rowsOf(page).nth(1).textContent()).includes('دخول'), 'the login line is right below');

  await waitWrite(page, 0);
  const audit = await sheetRows(page, 'سجل التعديلات');
  assert.deepEqual(audit[0], ['الوقت', 'العملية', 'الكيان', 'الكود', 'التفاصيل', 'المستخدم']);
  assert.deepEqual(audit[1].slice(1, 4), ['تعديل', 'مشروع', 'P01']); assert.equal(audit[1][5], 'المدير');
  assert.ok(audit.some(r => r && r[1] === 'دخول' && r[3] === 'admin' && r[5] === 'المدير'), 'login row with user');
  const log = await page.evaluate(() => Egary.Log.entries().slice(-1)[0]);
  assert.equal(log.action, 'تعديل'); assert.equal(log.code, 'P01'); assert.equal(log.user, 'المدير');
  const p = (await sheetRows(page, 'المشاريع')).find(r => r && r[0] === 'P01');
  assert.equal(p[2], 'شارع التحرير 10'); assert.equal(p[3], 'الدقي');
});

/* =====================================================================
   E8. نموذج الإعدادات ← ورقة «الإعدادات»
   ===================================================================== */
e2e('E8. settings form: validation, grace days / office name / last entered month persist to the page, the invoice header, sheet «الإعدادات» and a re-read; the change is logged with the user', async (page) => {
  await linkReal(page);
  await go(page, '#/settings', '#users-card');
  await page.click('#content button:has-text("تعديل الإعدادات")');
  await waitModal(page, 'الإعدادات');
  assert.equal(await page.inputValue('#f_graceDays'), '5'); assert.equal(await page.inputValue('#f_trackingFrom'), '2026-01'); assert.equal(await page.inputValue('#f_officeName'), 'إيجاري');
  await page.fill('#f_enteredThrough', '2026/8');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal .form-errors');
  assert.ok((await page.textContent('.modal .form-errors')).includes('آخر شهر مسجَّل'));
  await page.fill('#f_enteredThrough', '2026-08');
  await page.fill('#f_graceDays', '7');
  await page.fill('#f_officeName', 'مكتب الاختبار');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal', { state: 'detached' });
  await page.waitForSelector('.toast:has-text("حُفظت الإعدادات")');
  const card = page.locator('#content .card', { hasText: 'قواعد الاستحقاق' });
  assert.equal((await kvVal(card, 'أيام السماح')).trim(), '7');
  assert.equal((await kvVal(card, 'اسم المكتب')).trim(), 'مكتب الاختبار');
  assert.ok((await kvVal(card, 'آخر شهر مسجَّل في الورقة')).includes('2026-08 (يدوي)'));
  assert.deepEqual(await page.evaluate(() => { const s = Egary.Store.state(); return [s.settings.graceDays, s.settings.enteredThrough, s.meta.officeName, s.settings.trackingFrom]; }), [7, '2026-08', 'مكتب الاختبار', '2026-01']);
  // الفاتورة تحمل اسم المكتب الجديد
  await go(page, '#/payments', '#content table.tbl');
  await rowsOf(page).first().locator('td:first-child').click(); await page.waitForSelector('.modal #invoice-print');
  assert.equal((await page.textContent('#invoice-print h2')).trim(), 'مكتب الاختبار'); await closeModal(page);

  await waitWrite(page, 0);
  const s = await sheetRows(page, 'الإعدادات');
  assert.equal(settingVal(s, 'أيام السماح بعد الاستحقاق'), 7);
  assert.equal(settingVal(s, 'اسم المكتب'), 'مكتب الاختبار');
  assert.equal(settingVal(s, 'آخر شهر مسجَّل في الورقة (سنة-شهر أو فارغ = تلقائي)'), '2026-08');
  assert.equal(settingVal(s, 'بداية المحاسبة (سنة-شهر)'), '2026-01');
  const rr = await page.evaluate(async () => { const r = await Egary.Workbook.read(window.__adapter.bytes()); return [r.state.settings.graceDays, r.state.meta.officeName, r.state.settings.enteredThrough]; });
  assert.deepEqual(rr, [7, 'مكتب الاختبار', '2026-08'], 're-read of the written bytes');
  // «مَن غيّر الإعدادات» يجب أن يكون في السجل
  const audit = await sheetRows(page, 'سجل التعديلات');
  assert.ok(audit.slice(1, 3).some(r => r && /إعداد/.test(String(r[2]) + String(r[4])) && r[5] === 'المدير'), 'settings change appears in the audit log with the user; top rows: ' + JSON.stringify(audit.slice(1, 3)));
});

/* =====================================================================
   E9. إضافة سنة من قائمة السنة + سلايسر «المحاسبة من» + الملف لا يتأثر بالسلايسر
   ===================================================================== */
e2e('E9. add-year modal from the ledger year select: validation, the 2025 sheet is created with the ledger header and rows, «الإعدادات» gets years/start/auto, an audit row; the «المحاسبة من» slicer appears, changes the figures on screen only, and the next write still uses the setting', async (page) => {
  await linkReal(page);
  const arrears2026 = await page.evaluate(() => Egary.Engine.kpis({}).arrears.total);
  await go(page, '#/ledger?year=2026', 'table.ledger');
  assert.deepEqual(await page.$$eval('#year-select option', o => o.map(x => x.value)), ['2026', '__add']);
  await page.selectOption('#year-select', '__add');
  await waitModal(page, 'إضافة سنة إلى الورقة');
  assert.equal(await page.inputValue('#year-select'), '2026', 'the select snaps back');
  assert.equal(await page.inputValue('#f_year'), '2025', 'suggests the year before the oldest sheet');
  await page.fill('#f_year', '2026'); await page.click('#btn-add-year');
  assert.ok((await page.textContent('.modal .form-errors')).includes('موجودة بالفعل'));
  await page.fill('#f_year', '1999'); await page.click('#btn-add-year');
  assert.ok((await page.textContent('.modal .form-errors')).includes('بين 2000 و2100'));
  await page.fill('#f_year', '2025'); await page.click('#btn-add-year');
  await page.waitForSelector('.modal', { state: 'detached' });
  await page.waitForSelector('.toast:has-text("أُضيفت سنة 2025")');
  assert.equal(await page.textContent('#content .page-head h1'), 'كشف التحصيل 2025');
  assert.equal(await page.inputValue('#year-select'), '2025');
  assert.deepEqual(await page.$$eval('#year-select option', o => o.map(x => x.value)), ['2025', '2026', '__add']);
  assert.equal(await page.locator('#ledger-cur').count(), 0, 'no «go to current month» for a past year');
  const eng = await page.evaluate(() => Egary.Engine.ledger('2025', {}).rows.length);
  assert.ok(eng > 0, '2025 has rows (contracts active in 2025)');
  assert.equal(await page.locator('table.ledger tbody tr').count(), eng);
  assert.deepEqual(await page.evaluate(() => { const s = Egary.Store.state().settings; return [s.ledgerYears, s.trackingFrom, s.trackingMode]; }), [[2025, 2026], '2025-01', 'auto']);

  await waitWrite(page, 0);
  const led = await sheetRows(page, '2025');
  assert.ok(led, 'sheet 2025 exists');
  assert.deepEqual(led[1].slice(0, 5), ['م', 'المشروع', 'الاسم', 'الممثل القانوني', 'الوحدة']);
  assert.equal(led.filter(r => r && /^T\d{4}$/.test(String(r[24]))).length, eng);
  let s = await sheetRows(page, 'الإعدادات');
  assert.equal(String(settingVal(s, 'سنوات الورقة')), '2025, 2026'); assert.equal(settingVal(s, 'بداية المحاسبة (سنة-شهر)'), '2025-01'); assert.equal(settingVal(s, 'بداية المحاسبة (تلقائي/يدوي)'), 'auto');
  const audit = await sheetRows(page, 'سجل التعديلات');
  assert.deepEqual(audit[1].slice(1, 4), ['إضافة', 'سنة', '2025']); assert.equal(audit[1][5], 'المدير');
  const f = await exportBytes(page, 'e2e_extra_year.xlsx');
  const chk = py(`import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1]); out = {'names': wb.sheetnames}
ws = wb['2025']; out['h'] = [ws.cell(2, c).value for c in range(1, 6)]; out['codes'] = [ws.cell(r, 25).value for r in range(3, ws.max_row + 1) if ws.cell(r, 25).value]
st = wb['الإعدادات']; out['years'] = [st.cell(r, 2).value for r in range(2, st.max_row + 1) if st.cell(r, 1).value == 'سنوات الورقة'][0]
print(json.dumps(out, ensure_ascii=False, default=str))`, f);
  assert.ok(chk.names.includes('2025') && chk.names.includes('2026'), chk.names.join(','));
  assert.deepEqual(chk.h, ['م', 'المشروع', 'الاسم', 'الممثل القانوني', 'الوحدة']);
  assert.equal(chk.codes.length, eng); assert.equal(String(chk.years), '2025, 2026');

  // السلايسر يظهر الآن (سنتان)
  await go(page, '#/dashboard', '#from-group');
  const arrears2025 = await page.evaluate(() => Egary.Engine.kpis({}).arrears.total);
  assert.ok(arrears2025 > arrears2026, 'accounting from 2025 adds arrears: ' + arrears2025 + ' > ' + arrears2026);
  assert.equal(num(await page.textContent('#content .kpi[data-kpi="المتأخرات القائمة"] .v')), Math.round(arrears2025));
  await page.selectOption('#from-pick', '2026-01'); await page.waitForSelector('#from-reset');
  assert.equal(num(await page.textContent('#content .kpi[data-kpi="المتأخرات القائمة"] .v')), Math.round(arrears2026));
  assert.ok((await page.textContent('#content .page-head .sub')).includes('المحاسبة من 2026'));
  await go(page, '#/ledger?year=2026', '#from-pick');
  assert.equal(await page.inputValue('#from-pick'), '2026-01', 'the ledger shares the slicer');
  // كتابة أثناء تفعيل السلايسر: الأعمدة المحسوبة في الإكسيل تتبع الإعداد (2025) لا السلايسر
  await go(page, '#/projects', '#content .page-head');
  await page.click('#content button:has-text("مشروع جديد")'); await waitModal(page, 'مشروع جديد');
  await page.fill('#f_name', 'مشروع السلايسر'); await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.toast:has-text("أُضيف المشروع P04")');
  await waitWrite(page, 1);
  const ks = await sheetRows(page, 'العقود');
  const sheetArrears = ks.filter(r => r && /^T\d{4}$/.test(String(r[0]))).reduce((a, r) => a + (Number(r[22]) || 0), 0);
  assert.ok(Math.abs(sheetArrears - arrears2025) < 1, `computed arrears in «العقود» follow the setting (${arrears2025}), not the slicer (${arrears2026}): ${sheetArrears}`);
  s = await sheetRows(page, 'الإعدادات');
  assert.equal(settingVal(s, 'بداية المحاسبة (سنة-شهر)'), '2025-01', 'the slicer never touches the setting');
  assert.equal(await page.evaluate(() => Egary.App.filter.from), '2026-01', 'the slicer is still active after the write');
});

/* =====================================================================
   E10. الكشف: «اذهب إلى»، إجمالي الشهر في التذييل، زر العقد، «فتح العقد»
   ===================================================================== */
e2e('E10. ledger extras: «اذهب إلى أكتوبر» scrolls the current month into view, a footer month opens that month’s evidence with matching totals, the row eye and the cell dialog’s «فتح العقد» open the contract, the fixed client column opens the client', async (page) => {
  await linkReal(page);
  await go(page, '#/ledger?year=2026', 'table.ledger');
  const cur = page.locator('#ledger-cur');
  assert.equal((await cur.textContent()).trim(), 'اذهب إلى أكتوبر');
  const geo = await page.evaluate(() => { const w = document.querySelector('.ledger-wrap'), t = document.querySelector('#ledger'); return { overflow: t.scrollWidth > w.clientWidth + 2, sw: t.scrollWidth, cw: w.clientWidth }; });
  const inView = () => page.evaluate(() => { const r = document.querySelector('#ledger th.cur').getBoundingClientRect(), b = document.querySelector('.ledger-wrap').getBoundingClientRect(); return r.left >= b.left - 1 && r.right <= b.right + 1; });
  if (geo.overflow) {
    await page.evaluate(() => { const w = document.querySelector('.ledger-wrap'); w.scrollLeft = 1e6; const r = document.querySelector('#ledger th.cur').getBoundingClientRect(), b = w.getBoundingClientRect(); if (r.left >= b.left && r.right <= b.right) w.scrollLeft = -1e6; });
    assert.equal(await inView(), false, 'current month scrolled out of view first: ' + JSON.stringify(geo));
    await cur.click(); await page.waitForTimeout(400);
    assert.equal(await inView(), true, 'the button brings the current month back into view');
  } else { await cur.click(); assert.equal(await inView(), true); }
  // تذييل الشهر → دليل الشهر
  const footAug = await page.locator('table.ledger tfoot td.m').nth(7).textContent();
  assert.ok(num(footAug) > 0, 'August has collections');
  await page.locator('table.ledger tfoot td.m').nth(7).click(); await page.waitForSelector('.drawer table.tbl');
  const title = await drawerTitle(page);
  assert.ok(title.startsWith('أغسطس 2026'), title);
  assert.equal(num(/محصَّل ([\d,]+)/.exec(title)[1]), num(footAug), 'drawer title collected = footer');
  const tf = await page.locator('.drawer table.tbl tfoot td').allTextContents();
  assert.equal(num(tf[2]), num(footAug), 'evidence footer paid = ledger footer');
  assert.equal(await rowsOf(page, '.drawer table.tbl').count(), await page.evaluate(() => Egary.Engine.monthTotals(Egary.Engine.scope({}), '2026-08').rows.length));
  await closeDrawer(page);
  // زر العقد في الصف
  const firstRow = page.locator('table.ledger tbody tr').first();
  const firstCode = (await firstRow.locator('td.m').first().getAttribute('data-cell')).split('|')[0];
  await firstRow.locator('button[title="العقد"]').click(); await page.waitForSelector('.drawer');
  assert.equal(await drawerTitle(page), 'عقد ' + firstCode); await closeDrawer(page);
  // «فتح العقد» من خانة الشهر
  await page.click('td.m[data-cell="T0016|2026-08"]'); await waitModal(page, 'خانة الشهر');
  assert.ok((await page.textContent('.modal .m-body')).includes('أغسطس 2026'));
  assert.equal(await page.locator('.modal .m-body table.tbl tbody tr').count(), 1, 'one invoice in August');
  assert.equal(await page.locator('.modal .m-foot button:has-text("إضافة دفعة أخرى")').count(), 1);
  await page.click('.modal .m-foot button:has-text("فتح العقد")'); await page.waitForSelector('.modal', { state: 'detached' }); await page.waitForSelector('.drawer');
  assert.equal(await drawerTitle(page), 'عقد T0016'); await closeDrawer(page);
  // عمود الاسم الثابت → العميل
  await firstRow.locator('td.c3 a').click(); await page.waitForSelector('.drawer');
  assert.ok((await drawerTitle(page)).startsWith('عميل: ')); await closeDrawer(page);
  assert.equal(await page.evaluate(() => window.__adapter.writes), 0, 'pure navigation writes nothing');
});

/* =====================================================================
   E11. لوحة المفاتيح في البحث
   ===================================================================== */
e2e('E11. search box keyboard: ArrowDown/ArrowUp move a single highlight, Enter opens the highlighted suggestion, Escape hides the list, focus shows it again, ArrowUp at the top stays', async (page) => {
  await linkReal(page);
  await page.fill('#global-search', 'P03-10');
  await page.waitForSelector('#suggest:not(.hidden) .item');
  const codes = await page.$$eval('#suggest .item .code', e => e.map(x => x.textContent.trim()));
  assert.ok(codes.length >= 3, codes.join(','));
  assert.equal(await page.locator('#suggest .item.on').count(), 0);
  await page.press('#global-search', 'ArrowDown');
  assert.equal((await page.locator('#suggest .item.on .code').textContent()).trim(), codes[0]);
  await page.press('#global-search', 'ArrowDown');
  assert.equal((await page.locator('#suggest .item.on .code').textContent()).trim(), codes[1]);
  await page.press('#global-search', 'ArrowDown');
  await page.press('#global-search', 'ArrowUp');
  assert.equal((await page.locator('#suggest .item.on .code').textContent()).trim(), codes[1]);
  assert.equal(await page.locator('#suggest .item.on').count(), 1, 'exactly one highlighted item');
  await page.press('#global-search', 'Enter');
  await page.waitForSelector('.drawer');
  assert.equal((await page.locator('.drawer .profile-head .code').first().textContent()).trim(), codes[1], 'Enter opens the highlighted suggestion');
  assert.ok(await page.locator('#suggest').evaluate(e => e.classList.contains('hidden')));
  await closeDrawer(page);
  await page.fill('#global-search', 'P03-10'); await page.waitForSelector('#suggest:not(.hidden) .item');
  await page.press('#global-search', 'Escape');
  assert.ok(await page.locator('#suggest').evaluate(e => e.classList.contains('hidden')), 'Escape hides the list');
  assert.equal(await page.locator('.drawer').count(), 0);
  // (Chromium يفرّغ input[type=search] عند Escape — سلوك المتصفح) ⇒ نكتب من جديد، نخفي بنقرة خارج الصندوق، ثم النقر داخله يعيد الإظهار
  await page.fill('#global-search', 'P03-10'); await page.waitForSelector('#suggest:not(.hidden) .item');
  await page.click('#page-title');
  await page.waitForFunction(() => document.getElementById('suggest').classList.contains('hidden'));
  await page.click('#global-search');
  await page.waitForSelector('#suggest:not(.hidden) .item');
  await page.press('#global-search', 'ArrowDown'); await page.press('#global-search', 'ArrowUp'); await page.press('#global-search', 'ArrowUp');
  assert.equal((await page.locator('#suggest .item.on .code').textContent()).trim(), codes[0], 'ArrowUp at the top stays on the first item');
  await page.press('#global-search', 'Enter'); await page.waitForSelector('.drawer');
  assert.equal((await page.locator('.drawer .profile-head .code').first().textContent()).trim(), codes[0]);
});

/* =====================================================================
   E12. السلايسرات: المدفوعات (تاريخ/طريقة/شهر)، العملاء، العقود
   ===================================================================== */
e2e('E12. slicers: a web payment (today, bank transfer) is the only row under «هذا الشهر»/«آخر 30 يومًا»/transfer; the period select, manual dates and the hash follow; client chips (person/company/active) and contract-status chips match the engine', async (page) => {
  await linkReal(page);
  await go(page, '#/payments', '#period-bar');
  await afterRender(page, () => page.click('[data-quick="month"]')); await page.waitForSelector('#pay-clear');
  assert.equal(await page.locator('#content table.tbl tbody .empty').count(), 1, 'imported payments have no paid date');
  assert.ok((await page.textContent('#content')).includes('تُستبعد الدفعات التي ليس لها تاريخ مسجَّل'));
  await afterRender(page, () => page.click('#pay-clear')); assert.equal(await page.locator('#pay-clear').count(), 0);
  // تسجيل دفعة من زر الصفحة (العقد غير مثبَّت)
  await page.click('#content .page-head button:has-text("تسجيل دفعة")');
  await waitModal(page, 'تسجيل دفعة');
  assert.ok(!(await page.locator('#f_contractCode').isDisabled()));
  await page.selectOption('#f_contractCode', 'T0016');
  await page.fill('#f_period', '2026-09'); await page.dispatchEvent('#f_period', 'change');
  await page.waitForFunction(() => document.querySelector('#f_amount').value === '30250');
  assert.ok((await page.textContent('.modal .field[data-field="period"] .help')).includes('المستحق للشهر 30,250'));
  assert.equal(await page.inputValue('#f_paidOn'), TODAY);
  await page.selectOption('#f_method', 'transfer');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal', { state: 'detached' });
  await page.waitForSelector('.toast:has-text("سُجِّلت الدفعة INV-2026-0510")');
  assert.equal(await navCount(page, 'payments'), '510');
  assert.equal(await rowsOf(page).count(), 510);
  // شرائح التاريخ
  await afterRender(page, () => page.click('[data-quick="month"]'));
  assert.equal(await rowsOf(page).count(), 1);
  assert.equal((await rowsOf(page).first().locator('td:first-child .code').textContent()).trim(), 'INV-2026-0510');
  assert.equal(await page.inputValue('#pay-from'), '2026-10-01'); assert.equal(await page.inputValue('#pay-to'), TODAY);
  assert.equal(await page.locator('[data-quick="month"].on').count(), 1);
  assert.ok((await page.evaluate(() => location.hash)).includes('from=2026-10-01'));
  await afterRender(page, () => page.click('[data-quick="30"]'));
  assert.equal(await page.inputValue('#pay-from'), '2026-09-09');
  assert.equal(await rowsOf(page).count(), 1);
  await afterRender(page, () => page.click('[data-quick="30"]'));
  assert.equal(await page.inputValue('#pay-from'), '');
  assert.equal(await rowsOf(page).count(), 510, 'toggling the active chip clears the range');
  await afterRender(page, async () => { await page.fill('#pay-from', '2026-10-10'); await page.dispatchEvent('#pay-from', 'change'); });
  assert.equal(await page.locator('#content table.tbl tbody .empty').count(), 1, 'from tomorrow → nothing');
  await afterRender(page, () => page.click('#pay-clear'));
  // الطريقة وعن شهر
  await afterRender(page, () => page.click('[data-method="transfer"]'));
  assert.equal(await rowsOf(page).count(), 1);
  assert.equal(await page.locator('[data-method="transfer"].on').count(), 1);
  await afterRender(page, () => page.selectOption('#period-select', '2026-08'));
  assert.ok((await page.evaluate(() => location.hash)).includes('period=2026-08'));
  assert.equal(await page.locator('#content table.tbl tbody .empty').count(), 1, 'transfer + August → none');
  await afterRender(page, () => page.click('[data-method="transfer"]'));
  assert.ok(!(await page.evaluate(() => location.hash)).includes('method='));
  assert.equal(await rowsOf(page).count(), 56);
  assert.ok((await page.textContent('#content table.tbl tfoot')).includes('(56 دفعة)'));
  await afterRender(page, () => page.click('#pay-clear'));
  assert.equal(await rowsOf(page).count(), 510);
  await waitWrite(page, 0);
  const p = (await sheetRows(page, 'المدفوعات')).find(r => r && r[0] === 'INV-2026-0510');
  assert.equal(p[1], 'T0016'); assert.equal(p[4], '2026-09'); assert.equal(p[5], 30250); assert.equal(p[6], TODAY); assert.equal(p[7], 'تحويل بنكي'); assert.equal(p[10], 'الموقع');
  // العملاء
  await go(page, '#/clients', '#cf-bar');
  const exp = await page.evaluate(() => { const st = Egary.Store.state(); return { person: st.clients.filter(c => c.kind === 'person').length, company: st.clients.filter(c => c.kind === 'company').length, active: st.clients.filter(c => Egary.Store.contractsOfClient(c.code).some(x => Egary.Engine.contractStatus(x) === 'active')).length, all: st.clients.length }; });
  assert.equal(exp.person + exp.company, exp.all);
  for (const k of ['person', 'company', 'active']) {
    assert.equal(Number(await page.textContent(`[data-cf="${k}"] .cnt`)), exp[k], 'chip count ' + k);
    await afterRender(page, () => page.click(`[data-cf="${k}"]`));
    assert.ok((await page.evaluate(() => location.hash)).includes('cf=' + k));
    assert.equal(await rowsOf(page).count(), exp[k], 'rows ' + k);
    assert.equal(await page.locator(`[data-cf="${k}"].on`).count(), 1);
  }
  await afterRender(page, () => page.click('[data-cf=""]'));
  assert.ok(!(await page.evaluate(() => location.hash)).includes('cf='));
  assert.equal(await rowsOf(page).count(), exp.all);
  // العقود
  await go(page, '#/contracts', '#cstatus-bar');
  const cs = await page.evaluate(() => { const o = { active: 0, ended: 0, renewed: 0, future: 0 }; for (const c of Egary.Store.state().contracts) { const s = Egary.Engine.contractStatus(c); o[s] = (o[s] || 0) + 1; } o.ending = Egary.Engine.kpis({}).renewals.soon.length; return o; });
  assert.deepEqual([cs.active, cs.ended, cs.renewed, cs.ending], [46, 25, 15, 14]);
  for (const [label, key, n] of [['ساري', 'active', cs.active], ['منتهٍ', 'ended', cs.ended], ['منتهٍ وأُجِّرت بعده', 'renewed', cs.renewed], ['ينتهي خلال 90 يومًا', 'ending', cs.ending], ['لم يبدأ', 'future', cs.future]]) {
    await afterRender(page, () => page.locator('#cstatus-bar button', { hasText: new RegExp('^' + label + '$') }).click());
    assert.ok((await page.evaluate(() => location.hash)).includes('cstatus=' + key));
    if (n) assert.equal(await rowsOf(page).count(), n, 'rows for ' + key); else assert.equal(await page.locator('#content table.tbl tbody .empty').count(), 1, 'empty for ' + key);
  }
  await afterRender(page, () => page.locator('#cstatus-bar button', { hasText: /^الكل$/ }).click());
  assert.ok(!(await page.evaluate(() => location.hash)).includes('cstatus='));
  assert.equal(await rowsOf(page).count(), 86);
});

/* =====================================================================
   E13. إدارة المستخدمين (مدير)
   ===================================================================== */
e2e('E13. users card (admin): disable a user and reset another’s password → «المستخدمون» reflects both; self-disable/self-demote/self-delete are refused; add then delete a user; after logout the disabled user is refused and the reset password works (viewer)', async (page) => {
  await linkReal(page);
  await go(page, '#/settings', '#users-card');
  const rowFor = (code) => page.locator('#users-card table.tbl tbody tr', { has: page.locator('td:first-child .code', { hasText: new RegExp('^' + code + '$') }) });
  const hashBefore = (await sheetRows(page, 'المستخدمون')).find(r => r && r[0] === 'zaer')[3];
  // تعطيل office
  await rowFor('office').locator('button[title="تعديل"]').click();
  await waitModal(page, 'تعديل مستخدم office');
  assert.ok(await page.locator('#f_code').isDisabled(), 'username is read-only');
  assert.equal(await page.locator('#f_password').count(), 0, 'no password fields on edit');
  await page.selectOption('#f_enabled', 'no');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal', { state: 'detached' });
  await page.waitForSelector('.toast:has-text("حُفظ المستخدم")');
  assert.equal((await rowFor('office').locator('td:nth-child(4) .badge').textContent()).trim(), 'معطَّل');
  // لا تعطيل ولا تنزيل للنفس
  await rowFor('admin').locator('button[title="تعديل"]').click();
  await waitModal(page, 'تعديل مستخدم admin');
  await page.selectOption('#f_enabled', 'no');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal .form-errors');
  assert.ok((await page.textContent('.modal .form-errors')).includes('لا يمكنك تعطيل حسابك الحالي'));
  await page.selectOption('#f_enabled', 'yes'); await page.selectOption('#f_role', 'staff');
  await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForFunction(() => /صلاحية المدير عن نفسك/.test((document.querySelector('.modal .form-errors') || {}).textContent || ''));
  await page.click('.modal .m-foot button:has-text("إلغاء")'); await page.waitForSelector('.modal', { state: 'detached' });
  assert.equal((await rowFor('admin').locator('td:nth-child(4) .badge').textContent()).trim(), 'مفعَّل');
  assert.equal((await rowFor('admin').locator('td:nth-child(3)').textContent()).trim(), 'مدير');
  // إعادة تعيين كلمة مرور zaer (بلا كلمة المرور الحالية)
  await rowFor('zaer').locator('button[title="إعادة تعيين كلمة المرور"]').click();
  await waitModal(page, 'إعادة تعيين كلمة مرور زائر');
  assert.equal(await page.locator('#f_old').count(), 0, 'admin reset does not ask the old password');
  await page.fill('#f_password', 'view@2027'); await page.fill('#f_password2', 'view@2028');
  await page.click('.modal .m-foot button:has-text("حفظ")'); await page.waitForSelector('.modal .form-errors');
  await page.fill('#f_password2', 'view@2027'); await page.click('.modal .m-foot button:has-text("حفظ")');
  await page.waitForSelector('.modal', { state: 'detached' }); await page.waitForSelector('.toast:has-text("تم تغيير كلمة المرور")');
  // إضافة ثم حذف مستخدم
  await page.click('#users-card button:has-text("مستخدم جديد")'); await waitModal(page, 'مستخدم جديد');
  await page.fill('#f_code', 'temp1'); await page.fill('#f_name', 'مؤقت'); await page.selectOption('#f_role', 'viewer'); await page.fill('#f_password', 'temp@2026'); await page.fill('#f_password2', 'temp@2026');
  await page.click('.modal .m-foot .btn.primary'); await page.waitForSelector('.modal', { state: 'detached' });
  await page.waitForFunction(() => Egary.Auth.users().length === 4);
  assert.equal(await rowFor('temp1').count(), 1);
  await rowFor('temp1').locator('button[title="حذف"]').click();
  await waitModal(page, 'حذف مستخدم');
  await page.click('.modal .m-foot button:has-text("حذف")');
  await page.waitForSelector('.modal', { state: 'detached' });
  await page.waitForFunction(() => Egary.Auth.users().length === 3);
  assert.equal(await rowFor('temp1').count(), 0);
  await rowFor('admin').locator('button[title="حذف"]').click(); await waitModal(page, 'حذف مستخدم'); await page.click('.modal .m-foot button:has-text("حذف")');
  await page.waitForSelector('.toast:has-text("لا يمكنك حذف حسابك الحالي")');
  assert.equal(await page.evaluate(() => Egary.Auth.users().length), 3);

  await page.waitForFunction(() => Egary.Sync.status.state === 'linked' && Egary.Sync.status.pending === 0);
  const us = await sheetRows(page, 'المستخدمون');
  const office = us.find(r => r && r[0] === 'office'), zaer = us.find(r => r && r[0] === 'zaer');
  assert.equal(office[4], 'لا'); assert.equal(office[2], 'موظف');
  assert.ok(/^pbkdf2\$/.test(zaer[3]) && zaer[3] !== hashBefore, 'password hash replaced');
  assert.equal(zaer[4], 'نعم');
  assert.ok(!us.some(r => r && r[0] === 'temp1'), 'deleted user gone from the sheet');
  assert.ok(!JSON.stringify(us).includes('view@2027') && !JSON.stringify(us).includes('temp@2026'), 'no plaintext passwords');
  const audit = await page.evaluate(() => Egary.Store.state().audit.slice(0, 8).map(a => [a.action, a.entity, a.code, a.user]));
  assert.ok(audit.some(a => a[0] === 'حذف' && a[1] === 'مستخدم' && a[2] === 'temp1' && a[3] === 'المدير'), JSON.stringify(audit));
  assert.ok(audit.some(a => a[0] === 'إضافة' && a[1] === 'مستخدم' && a[2] === 'temp1' && a[3] === 'المدير'));
  assert.ok(audit.some(a => a[0] === 'تعديل' && a[2] === 'zaer' && a[3] === 'المدير'));
  assert.ok(audit.some(a => a[0] === 'تعديل' && a[2] === 'office' && a[3] === 'المدير'));

  // خروج ← إعادة الربط بنفس البايتات: office مرفوض، zaer يدخل بكلمة المرور الجديدة
  const bytes = await b64Of(page);
  await page.click('#user-chip'); await page.waitForSelector('#btn-logout'); await page.click('#btn-logout');
  await page.waitForSelector('#btn-demo', { timeout: 20000 });
  await page.evaluate(t => Egary.U.setToday(t), TODAY);
  await linkReal(page, null, bytes);
  await page.waitForSelector('#login-form');
  await page.fill('#login-user', 'office'); await page.fill('#login-pass', 'office@2026'); await page.click('#login-go');
  await page.waitForSelector('#login-err.on');
  assert.ok((await page.textContent('#login-err')).includes('غير صحيحة'));
  assert.ok(await page.evaluate(() => Egary.Log.entries().some(e => e.action === 'دخول مرفوض' && e.code === 'office' && /معطَّل/.test(e.summary))), 'refused login logged with the reason');
  await page.fill('#login-user', 'zaer'); await page.fill('#login-pass', 'view@2026'); await page.click('#login-go');
  await page.waitForFunction(() => document.querySelector('#login-pass').value === '' && document.querySelector('#login-err').classList.contains('on'));
  await loginAs(page, ['zaer', 'view@2027']);
  await page.waitForSelector('#content .kpis .kpi');
  assert.deepEqual(await page.evaluate(() => [Egary.Auth.user().username, Egary.Auth.user().role]), ['zaer', 'viewer']);
  assert.ok((await page.textContent('#user-chip')).includes('مشاهدة فقط'));
});

/* =====================================================================
   E14. بوابات الأدوار: موظف ومشاهدة
   ===================================================================== */
e2e('E14. role gates: staff cannot delete units/clients/contracts (table + drawer), sees no settings/unlink/users controls, may edit and add a year without moving the accounting start; a viewer gets «للمشاهدة فقط» at every entry point, no add-year option, and never writes', async (page) => {
  await linkReal(page, STAFF);
  assert.ok((await page.textContent('#user-chip')).includes('موظف'));
  await go(page, '#/units', '#content table.tbl');
  await rowsOf(page).first().locator('button[title="حذف"]').click();
  await page.waitForSelector('.toast:has-text("صلاحياتك لا تسمح بحذف وحدة")');
  assert.equal(await page.$('.modal'), null);
  await go(page, '#/clients', '#content table.tbl');
  await rowsOf(page).first().locator('button[title="حذف"]').click();
  await page.waitForSelector('.toast:has-text("صلاحياتك لا تسمح بحذف عميل")');
  await go(page, '#/contracts', '#content table.tbl');
  await rowsOf(page).first().locator('button[title="حذف"]').click();
  await page.waitForSelector('.toast:has-text("صلاحياتك لا تسمح بحذف عقد")');
  await go(page, '#/unit/P03-304', '.drawer');
  await page.click('.drawer .d-head button:has-text("حذف")');
  await page.waitForSelector('.toast:has-text("صلاحياتك لا تسمح بحذف وحدة")');
  assert.equal(await page.$('.modal'), null); await closeDrawer(page);
  await go(page, '#/units', '#content table.tbl');
  await rowsOf(page).first().locator('button[title="تعديل"]').click(); await waitModal(page, 'تعديل وحدة'); await closeModal(page);
  // الإعدادات
  await go(page, '#/settings', '#users-card');
  for (const t of ['إلغاء الربط', 'ربط ملف آخر', 'تعديل الإعدادات', 'مستخدم جديد']) assert.equal(await page.locator(`#content button:has-text("${t}")`).count(), 0, 'staff must not see «' + t + '»');
  assert.equal(await page.locator('#users-card button:has-text("تغيير كلمة مروري")').count(), 1);
  assert.equal(await page.locator('#users-card table.tbl').count(), 0);
  assert.equal((await kvVal(page.locator('#users-card'), 'إدارة المستخدمين')).trim(), 'للمدير فقط');
  assert.ok((await page.locator('#content .card', { hasText: 'قواعد الاستحقاق' }).textContent()).includes('الإعدادات للمدير فقط'));
  await page.evaluate(() => Egary.Forms.settings()); await page.waitForSelector('.toast:has-text("الإعدادات للمدير فقط")'); assert.equal(await page.$('.modal'), null);
  await page.evaluate(() => Egary.Forms.user()); await page.waitForSelector('.toast:has-text("إدارة المستخدمين للمدير فقط")'); assert.equal(await page.$('.modal'), null);
  await page.click('#user-chip'); await page.waitForSelector('#btn-logout');
  assert.equal(await page.locator('.modal .user-menu button:has-text("إدارة المستخدمين")').count(), 0);
  assert.equal(await page.locator('#btn-change-pass').count(), 1); await closeModal(page);
  // الموظف يضيف سنة: الأوراق تزيد لكن بداية المحاسبة لا تتحرك
  await go(page, '#/ledger?year=2026', '#year-select');
  assert.deepEqual(await page.$$eval('#year-select option', o => o.map(x => x.value)), ['2026', '__add']);
  await page.selectOption('#year-select', '__add'); await waitModal(page, 'إضافة سنة إلى الورقة');
  await page.fill('#f_year', '2025'); await page.click('#btn-add-year');
  await page.waitForSelector('.toast:has-text("بداية المحاسبة لا تتغيّر إلا من المدير")');
  assert.deepEqual(await page.evaluate(() => [Egary.Store.state().settings.ledgerYears, Egary.Store.state().settings.trackingFrom]), [[2025, 2026], '2026-01']);
  await waitWrite(page, 0);
  const s = await sheetRows(page, 'الإعدادات');
  assert.equal(String(settingVal(s, 'سنوات الورقة')), '2025, 2026'); assert.equal(settingVal(s, 'بداية المحاسبة (سنة-شهر)'), '2026-01');
  assert.ok(await sheetRows(page, '2025'), '2025 sheet created');
  assert.ok((await sheetRows(page, 'سجل التعديلات')).some(r => r && r[1] === 'إضافة' && r[2] === 'سنة' && r[5] === 'موظف المكتب'), 'year addition logged with the staff name');

  // مشاهدة فقط
  await page.click('#user-chip'); await page.waitForSelector('#btn-logout'); await page.click('#btn-logout');
  await page.waitForSelector('#btn-demo', { timeout: 20000 });
  await page.evaluate(t => Egary.U.setToday(t), TODAY);
  await linkReal(page, VIEWER);
  assert.ok((await page.textContent('#user-chip')).includes('مشاهدة فقط'));
  await page.click('#content .page-head button:has-text("تسجيل دفعة")'); await page.waitForSelector('.toast:has-text("للمشاهدة فقط")'); assert.equal(await page.$('.modal'), null);
  await go(page, '#/units', '#content table.tbl');
  await rowsOf(page).first().locator('button[title="تعديل"]').click(); await page.waitForSelector('.toast:has-text("للمشاهدة فقط")'); assert.equal(await page.$('.modal'), null);
  await rowsOf(page).first().locator('td:nth-child(2)').click(); await page.waitForSelector('.drawer');
  await page.click('.drawer .d-head button:has-text("تعديل")'); await page.waitForSelector('.toast:has-text("للمشاهدة فقط")'); assert.equal(await page.$('.modal'), null);
  await closeDrawer(page);
  await go(page, '#/ledger?year=2026', 'table.ledger');
  assert.deepEqual(await page.$$eval('#year-select option', o => o.map(x => x.value)), ['2026'], 'no add-year for a viewer');
  await page.click('td.m[data-cell="T0016|2026-09"]'); await waitModal(page, 'خانة الشهر');
  await page.click('.modal .m-foot button:has-text("تسجيل دفعة")'); await page.waitForSelector('.toast:has-text("للمشاهدة فقط")');
  assert.equal(await page.$('#f_amount'), null);
  await go(page, '#/payments', '#content table.tbl');
  await rowsOf(page).first().locator('button[title="حذف"]').click(); await page.waitForSelector('.toast:has-text("صلاحياتك لا تسمح بحذف دفعة")');
  await go(page, '#/maintenance', '#mstatus-bar');
  await page.click('#content button:has-text("طلب صيانة")'); await page.waitForSelector('.toast:has-text("للمشاهدة فقط")'); assert.equal(await page.$('.modal'), null);
  await go(page, '#/settings', '#users-card');
  assert.equal(await page.locator('#content button:has-text("تعديل الإعدادات")').count(), 0);
  assert.equal(await page.evaluate(() => window.__adapter.writes + Egary.Sync.status.pending), 0, 'a viewer never writes');
});

/* =====================================================================
   E15. الموبايل: الدرج والنافذة داخل الشاشة
   ===================================================================== */
e2e('E15. mobile (390px): a profile drawer and a form modal stay inside the viewport, the save button is reachable, the form is single-column, the drawer closes from its back button and the page never scrolls sideways', async (page) => {
  await linkReal(page);
  await go(page, '#/unit/P03-304', '.drawer');
  await page.waitForFunction(() => { const r = document.querySelector('.drawer').getBoundingClientRect(); return r.left >= -1 && r.right <= window.innerWidth + 1; }, null, { timeout: 3000 });
  const box = await page.locator('.drawer').boundingBox();
  assert.ok(box.x >= -1 && box.x + box.width <= 391, 'drawer inside the viewport: ' + JSON.stringify(box));
  assert.ok((await page.evaluate(() => document.scrollingElement.scrollWidth)) <= 392, 'no sideways page scroll with the drawer open');
  const edit = await page.locator('.drawer .d-head button:has-text("تعديل")').boundingBox();
  assert.ok(edit && edit.x >= 0 && edit.x + edit.width <= 390, 'drawer action reachable: ' + JSON.stringify(edit));
  await page.click('.drawer .d-head button[aria-label="إغلاق"]'); await page.waitForSelector('.drawer', { state: 'detached' });
  await go(page, '#/units', '#content table.tbl');
  await page.click('#content button:has-text("وحدة جديدة")'); await waitModal(page, 'وحدة جديدة');
  const mb = await page.locator('.modal').boundingBox();
  assert.ok(mb.x >= 0 && mb.x + mb.width <= 390 && mb.y >= 0 && mb.y + mb.height <= 844, 'modal inside the viewport: ' + JSON.stringify(mb));
  const sb = await page.locator('.modal .m-foot button:has-text("حفظ")').boundingBox();
  assert.ok(sb && sb.y + sb.height <= 844 && sb.x >= 0, 'save button reachable without scrolling the page: ' + JSON.stringify(sb));
  assert.equal(await page.$eval('.modal form.form', f => getComputedStyle(f).gridTemplateColumns.trim().split(/\s+/).length), 1, 'single-column form on phones');
  await closeModal(page);
  assert.ok((await page.evaluate(() => document.scrollingElement.scrollWidth)) <= 392);
  assert.ok(!(await page.locator('#user-chip .nm').isVisible()), 'user chip collapses to the avatar');
  await page.click('.menu-btn'); await page.waitForSelector('#sidebar.open');
  await page.click('#sidebar a[data-view="clients"]'); await page.waitForSelector('#content table.tbl');
  assert.equal(await page.textContent('#page-title'), 'العملاء');
  assert.ok((await page.evaluate(() => document.scrollingElement.scrollWidth)) <= 392);
}, { viewport: { width: 390, height: 844 } });

/* =====================================================================
   E16. لوحة BI: Escape، الثيم، سلايسر «المحاسبة من»، بلاطة تنقّل
   ===================================================================== */
e2e('E16. BI: Escape closes the board and restores the theme; a dark theme survives the round-trip; with two ledger years the «المحاسبة من» select appears and moves the arrears tile; a tile with a navigation target leaves BI', async (page) => {
  await linkReal(page);
  await go(page, '#/bi'); await page.waitForSelector('#bi-hero');
  assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#bi', { state: 'detached' });
  assert.equal(await page.evaluate(() => location.hash), '#/dashboard');
  assert.equal(await page.getAttribute('html', 'data-theme'), 'light');
  await page.waitForSelector('#content .kpis .kpi');
  await page.click('#theme-btn'); await page.waitForSelector('html[data-theme="dark"]');
  await go(page, '#/bi'); await page.waitForSelector('#bi-hero');
  await page.click('#bi-exit'); await page.waitForSelector('#bi', { state: 'detached' });
  assert.equal(await page.getAttribute('html', 'data-theme'), 'dark', 'dark stays dark after BI');
  await page.click('#theme-btn'); await page.waitForSelector('html[data-theme="light"]');
  // سنة واحدة ⇒ لا سلايسر
  await go(page, '#/bi'); await page.waitForSelector('#bi-hero'); await page.click('#bi-enter'); await page.waitForSelector('#bi-board.in');
  assert.equal(await page.$('#bi-from-pick'), null);
  await page.click('#bi-exit'); await page.waitForSelector('#bi', { state: 'detached' });
  const a2026 = await page.evaluate(() => Egary.Engine.kpis({}).arrears.total);
  await page.evaluate(() => { const st = Egary.Store.state(); st.settings.ledgerYears = [2025, 2026]; st.settings.trackingFrom = '2025-01'; });
  await go(page, '#/bi'); await page.waitForSelector('#bi-hero'); await page.click('#bi-enter'); await page.waitForSelector('#bi-board.in');
  await page.waitForSelector('#bi-from-pick');
  const a2025 = await page.evaluate(() => Egary.Engine.kpis({}).arrears.total);
  assert.ok(a2025 > a2026);
  const tileV = async () => num(await page.locator('#bi .tile[data-kpi="المتأخرات"] .v').textContent());
  assert.equal(await tileV(), Math.round(a2025));
  await page.selectOption('#bi-from-pick', '2026-01'); await page.waitForTimeout(300);
  assert.equal(await tileV(), Math.round(a2026), 'slicer moves the BI arrears tile');
  assert.equal(await page.locator('#bi-from-pick.on').count(), 1);
  await page.locator('#bi .chips > button', { hasText: 'مسح' }).click(); await page.waitForTimeout(300);
  assert.equal(await tileV(), Math.round(a2025));
  assert.equal(await page.evaluate(() => Egary.App.filter.from), '');
  // بلاطة تنقّل تخرج من BI
  await page.click('#bi-dock button[data-section="clients"]'); await page.waitForSelector('#bi .tile[data-kpi="العملاء"]');
  await page.click('#bi .tile[data-kpi="العملاء"]');
  await page.waitForSelector('#bi', { state: 'detached' });
  assert.equal(await page.evaluate(() => location.hash), '#/clients');
  assert.equal(await page.textContent('#page-title'), 'العملاء');
  assert.equal(await page.getAttribute('html', 'data-theme'), 'light');
  assert.equal(await page.evaluate(() => window.__adapter.writes), 0, 'BI never writes');
});

/* =====================================================================
   E17. بطاقة الملف والنسخ في الإعدادات
   ===================================================================== */
e2e('E17. settings file card: the sync pill opens settings, «حفظ الآن» and «نسخة الآن» (no folder) report correctly, the three download buttons produce files with the expected names and the copy is a valid workbook with the same counts', async (page) => {
  await linkReal(page);
  await page.click('#sync-status'); await page.waitForSelector('#users-card');
  assert.equal(await page.textContent('#page-title'), 'الإعدادات والملف');
  const fileCard = page.locator('#content .card', { hasText: 'ملف الإكسيل' }).first();
  assert.equal((await kvVal(fileCard, 'حالة المزامنة')).trim(), 'مرتبط ومتزامن');
  assert.equal((await kvVal(fileCard, 'الملف')).trim(), 'Egary.xlsx');
  await fileCard.locator('button:has-text("حفظ الآن")').click(); await page.waitForSelector('.toast:has-text("تم الحفظ في الإكسيل")');
  await page.waitForFunction(() => window.__adapter.writes === 1 && Egary.Sync.status.state === 'linked');
  const bkCard = page.locator('#content .card', { hasText: 'النسخ الاحتياطي' }).first();
  assert.ok((await bkCard.textContent()).includes('غير مفعَّل'));
  await bkCard.locator('button:has-text("نسخة الآن")').click(); await page.waitForSelector('.toast:has-text("حُفظت نسخة داخل المتصفح")');
  // Playwright يحفظ التنزيل في مسار مؤقت بلا امتداد؛ openpyxl يحتاج .xlsx ⇒ ننسخه باسمه المقترح
  const dl = async (btn) => { const p = page.waitForEvent('download', { timeout: 15000 }); await btn.click(); const d = await p; const name = d.suggestedFilename(); const file = path.join(OUT, 'e2e_extra_dl_' + name); await d.saveAs(file); return { name, file }; };
  const copy = await dl(fileCard.locator('button:has-text("تنزيل نسخة إكسيل الآن")'));
  assert.equal(copy.name, 'Egary.xlsx');
  await page.waitForSelector('.toast:has-text("تم تنزيل نسخة الإكسيل")');
  const chk = py(`import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1]); out = {'names': wb.sheetnames}
out['contracts'] = sum(1 for r in range(2, wb['العقود'].max_row + 1) if wb['العقود'].cell(r, 1).value)
out['payments'] = sum(1 for r in range(2, wb['المدفوعات'].max_row + 1) if wb['المدفوعات'].cell(r, 1).value)
out['users_hidden'] = wb['المستخدمون'].sheet_state
print(json.dumps(out, ensure_ascii=False))`, copy.file);
  assert.equal(chk.contracts, 86); assert.equal(chk.payments, 509); assert.equal(chk.users_hidden, 'hidden');
  assert.ok(chk.names.includes('2026') && chk.names.includes('الإعدادات'));
  const bk = await dl(fileCard.locator('button:has-text("آخر نسخة احتياطية")'));
  assert.match(bk.name, /^Egary-backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.xlsx$/);
  await page.waitForSelector('.toast:has-text("تم تنزيل النسخة الاحتياطية")');
  const orig = await dl(fileCard.locator('button:has-text("الملف الأصلي قبل أول تحويل")'));
  assert.match(orig.name, /^Egary-original-\d{4}-\d{2}-\d{2}\.xlsx$/);
  await page.waitForSelector('.toast:has-text("تم تنزيل الملف الأصلي")');
  assert.equal(fs.statSync(orig.file).size, Buffer.from(XLSX_B64, 'base64').length, 'the original is byte-for-byte the linked file');
  assert.equal(await page.evaluate(() => window.__adapter.writes), 1, '«حفظ الآن» wrote once; the backup/downloads never write the linked file');
});

/* =====================================================================
   E18. حذف عقد متسلسل (مدير)
   ===================================================================== */
e2e('E18. deleting a contract cascades: the confirmation counts its invoices, the contract leaves «العقود» and the 2026 ledger sheet, its payments leave «المدفوعات», counts and audit rows (with the user) follow, a re-read agrees', async (page) => {
  await linkReal(page);
  const deps = await page.evaluate(() => Egary.Store.dependents('contracts', 'T0007').payments.map(p => p.code));
  assert.equal(deps.length, 3);
  assert.equal(await page.evaluate(() => (Egary.Store.nextContract(Egary.Store.contract('T0007')) || {}).code || ''), '', 'no successor links to T0007');
  await go(page, '#/contract/T0007', '.drawer');
  assert.ok((await page.textContent('.drawer')).includes('الفواتير (3)'));
  await page.click('.drawer .d-head button:has-text("حذف")');
  await waitModal(page, 'تأكيد الحذف');
  const txt = await page.textContent('.modal .m-body');
  assert.ok(txt.includes('عقد «T0007»') && txt.includes('سيُحذف معه أيضًا: 3 دفعة/فاتورة'), txt);
  await page.click('.modal .m-foot button:has-text("نعم، احذف")');
  await page.waitForSelector('.modal', { state: 'detached' });
  await page.waitForSelector('.toast:has-text("تم حذف عقد T0007")');
  await page.waitForSelector('.drawer', { state: 'detached' });
  assert.equal(await navCount(page, 'contracts'), '85'); assert.equal(await navCount(page, 'payments'), '506');
  assert.equal(await page.evaluate(() => Egary.Store.contract('T0007')), null);
  assert.deepEqual(await page.evaluate(codes => codes.map(c => Egary.Store.get('payments', c)), deps), [null, null, null]);
  await waitWrite(page, 0);
  const ks = await sheetRows(page, 'العقود');
  assert.equal(ks.filter(r => r && r[0] === 'T0007').length, 0); assert.equal(ks.filter(r => r && /^T\d{4}$/.test(String(r[0]))).length, 85);
  const ps = await sheetRows(page, 'المدفوعات');
  assert.equal(ps.length, 507, 'header + 506 payments'); assert.ok(!ps.some(r => r && deps.includes(r[0])));
  const led = await sheetRows(page, '2026');
  assert.ok(!led.some(r => r && r[24] === 'T0007')); assert.equal(led.filter(r => r && /^T\d{4}$/.test(String(r[24]))).length, 85);
  const audit = await sheetRows(page, 'سجل التعديلات');
  assert.deepEqual(audit[1].slice(1, 4), ['حذف', 'عقد', 'T0007']);
  assert.deepEqual(audit.slice(2, 5).map(r => [r[1], r[2]]), [['حذف', 'دفعة'], ['حذف', 'دفعة'], ['حذف', 'دفعة']]);
  assert.ok(audit.slice(1, 5).every(r => r[5] === 'المدير'), 'every cascade row names the admin');
  await go(page, '#/unit/P01-O61', '.drawer');
  assert.ok(!(await page.textContent('.drawer')).includes('T0007'), 'unit history no longer lists it');
  await closeDrawer(page);
  const cmp = await page.evaluate(async () => { const r = await Egary.Workbook.read(window.__adapter.bytes()); return [r.state.contracts.length, r.state.payments.length, r.state.payments.some(p => p.contractCode === 'T0007')]; });
  assert.deepEqual(cmp, [85, 506, false]);
});

/* =====================================================================
   E19. أدلة اللوحة: الرسوم والبطاقات والأزرار
   ===================================================================== */
e2e('E19. dashboard drill-downs: the highlighted month bar, the project donut legend, the top-debtors bar, the unit-type donut (→ filtered units), the project card, «كل التحليلات» and the quick-action buttons', async (page) => {
  await linkReal(page);
  const k = await page.evaluate(() => { const k = Egary.Engine.kpis({}); return { period: k.period, label: Egary.U.periodLabel(k.period, true), proj: Egary.Store.state().projects[0] }; });
  await page.click('#content .chart path.bar.hl'); await page.waitForSelector('.drawer table.tbl');
  assert.ok((await drawerTitle(page)).startsWith(k.label), await drawerTitle(page));
  const foot = await page.locator('.drawer table.tbl tfoot td').allTextContents();
  const month = await page.evaluate(p => Egary.Engine.monthTotals(Egary.Engine.scope({}), p), k.period);
  assert.equal(num(foot[2]), Math.round(month.collected), 'evidence paid total = engine');
  assert.equal(num(foot[1]), Math.round(month.due), 'evidence due total = engine');
  await closeDrawer(page);
  await page.locator('#content .card', { hasText: 'حسب المشروع' }).first().locator('.donut-legend span').first().click();
  await page.waitForSelector('.drawer'); assert.ok((await drawerTitle(page)).startsWith('مشروع: ')); await closeDrawer(page);
  await page.locator('#content .card', { hasText: 'أعلى المتأخرين' }).locator('svg.chart g.bar').first().click();
  await page.waitForSelector('.drawer'); assert.ok((await drawerTitle(page)).startsWith('عميل: ')); await closeDrawer(page);
  const typeCard = page.locator('#content .card', { hasText: 'الوحدات حسب النوع' });
  const typeLabel = (await typeCard.locator('.donut-legend span').first().textContent()).split(':')[0].trim();
  await typeCard.locator('.donut-legend span').first().click();
  await page.waitForSelector('#content table.tbl');
  assert.equal(await page.evaluate(() => location.hash), '#/units');
  assert.equal((await page.locator('#filter-bar .chip.f-type.on').textContent()).replace('×', '').trim(), typeLabel);
  assert.equal(await rowsOf(page).count(), await page.evaluate(() => Egary.Engine.scope(Egary.App.filter).units.length));
  await page.click('#clear-filters'); await page.waitForFunction(() => !document.querySelector('#clear-filters'));
  await go(page, '#/dashboard', '#content .kpis .kpi');
  await page.locator('#content .card', { has: page.locator('h3', { hasText: /^المشاريع$/ }) }).locator('.insight').first().click();
  await page.waitForSelector('.drawer'); assert.equal(await drawerTitle(page), 'مشروع: ' + k.proj.name); await closeDrawer(page);
  await afterRender(page, () => page.click('#content button:has-text("كل التحليلات")'));
  await page.waitForSelector('#content .insight');
  assert.equal(await page.textContent('#page-title'), 'التحليلات والإنسايتس');
  assert.equal(await page.evaluate(() => location.hash), '#/insights');
  await go(page, '#/dashboard', '#content .kpis .kpi');
  await page.click('#content .page-head button:has-text("وحدة جديدة")'); await waitModal(page, 'وحدة جديدة'); await closeModal(page);
  await page.click('#content .page-head button:has-text("تسجيل دفعة")'); await waitModal(page, 'تسجيل دفعة'); await closeModal(page);
  await page.click('#content .page-head button:has-text("عقد جديد")'); await waitModal(page, 'عقد جديد'); await closeModal(page);
  assert.equal(await page.evaluate(() => window.__adapter.writes), 0);
});

/* =====================================================================
   E20. شبكة شهور العقد في بروفايله
   ===================================================================== */
e2e('E20. contract profile month grid: a pending month opens the cell dialog, paying from it lands in «المدفوعات»/«2026», and the open profile (grid, invoice count) reflects the payment without reopening', async (page) => {
  await linkReal(page);
  const nPays = await page.evaluate(() => Egary.Store.paymentsOf('T0016').length);
  const pendingAr = await page.evaluate(() => Egary.Engine.STATUS_AR.pending);
  await go(page, '#/contract/T0016', '.drawer');
  assert.ok((await page.textContent('.drawer')).includes(`الفواتير (${nPays})`));
  const btn = page.locator('.drawer button.kpi[data-month="2026-09"]');
  assert.ok((await btn.textContent()).includes(pendingAr), 'September is pending');
  await btn.click(); await waitModal(page, 'خانة الشهر');
  assert.ok((await page.textContent('.modal .m-body')).includes('سبتمبر 2026'));
  await page.click('.modal .m-foot button:has-text("تسجيل دفعة")'); await page.waitForSelector('#f_amount');
  assert.equal(await page.inputValue('#f_amount'), '30250'); assert.equal(await page.inputValue('#f_period'), '2026-09');
  assert.ok(await page.locator('#f_contractCode').isDisabled(), 'contract fixed from the grid');
  await page.click('.modal .m-foot button:has-text("حفظ")'); await page.waitForSelector('#f_amount', { state: 'detached' });
  await page.waitForSelector('.toast:has-text("سُجِّلت الدفعة INV-2026-0510")');
  assert.equal(await page.evaluate(() => Egary.Store.paymentsOfCell('T0016', '2026-09').length), 1);
  const gridCls = await page.locator('.drawer button.kpi[data-month="2026-09"]').getAttribute('class');
  const drawerTxt = await page.textContent('.drawer');
  await waitWrite(page, 0);
  const p = (await sheetRows(page, 'المدفوعات')).find(r => r && r[0] === 'INV-2026-0510');
  assert.ok(p); assert.equal(p[1], 'T0016'); assert.equal(p[4], '2026-09'); assert.equal(p[5], 30250);
  assert.equal((await sheetRows(page, '2026')).find(r => r && r[24] === 'T0016')[18], 30250, 'September cell in the ledger sheet');
  // بعد إعادة الفتح الشهر مسدَّد (الدليل على سلامة البيانات)
  await closeDrawer(page);
  await go(page, '#/contract/T0016', '.drawer');
  assert.ok((await page.locator('.drawer button.kpi[data-month="2026-09"]').getAttribute('class')).includes('ok'));
  assert.ok((await page.textContent('.drawer')).includes(`الفواتير (${nPays + 1})`));
  await closeDrawer(page);
  assert.ok(gridCls.includes('ok') && drawerTxt.includes(`الفواتير (${nPays + 1})`), 'the open profile must refresh after paying from its grid (otherwise the month still looks unpaid): class=' + gridCls);
});
