// إصلاحات فحص قراءة/كتابة الإكسيل (workbook.js): أعمدة ناقصة، صفوف الإجمالي، المعادلات بلا قيمة، النِّسَب، صيغ الشهر،
// سنوات الورقة من الأوراق الموجودة فعلًا، اسم ورقة بأرقام عربية، إعادة التأجير بتداخل قصير، تعارض ورقة المدفوعات مع خانة فارغة،
// الأعمدة التي يضيفها المكتب، تعليقات الخلايا، الرسوم البيانية، طابع الكتابة المحلي، وثبات القراءة/الكتابة
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { load, readFile, SOURCE, ROOT } = require('./helpers/env');
const X = require(path.join(ROOT, 'assets/vendor/exceljs.min.js'));
const DEMO = path.join(ROOT, 'Egary.xlsx');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const TODAY = '2026-10-10';
const toAB = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const D = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const HEAD = ['م', 'المشروع', 'الاسم', 'الممثل القانوني', 'الوحدة', 'العنوان', 'العقد من', 'العقد الى', 'تسجيل ضريبي', 'الرقم القومي / الباسبور', 'يناير', 'فبراير', 'مارس', 'ابريل', 'مايو', 'يونيو', 'يوليو', 'اغسطس', 'سبتمبر', 'اكتوبر', 'نوفمبر', 'ديسمبر', 'الاجمالي', 'ملاحظات'];
const ADDR = 'شارع بابل الدقي 39';
/* صف ورقة سنة بالشكل الأصلي */
function L(serial, proj, name, unit, from, to, months, opts) {
  opts = opts || {};
  const m = months.concat(Array(12 - months.length).fill(null));
  return [serial, proj, name, opts.rep || '', unit, opts.addr == null ? ADDR : opts.addr, from, to, opts.tax || null, opts.nid || '111'].concat(m, [null, opts.note || null]);
}
/* ملف بأوراق سنة مبنية بـ ExcelJS (قيم المعادلات مخزّنة كما يحفظها Excel) */
async function ledgerBook(sheets) {
  const wb = new X.Workbook();
  for (const sh of sheets) {
    const ws = wb.addWorksheet(sh.name); const hr = sh.headerRow || 2; const head = sh.head || HEAD;
    if (hr >= 2) ws.getCell(hr - 1, 11).value = sh.name;
    ws.getRow(hr).values = head;
    let r = hr + 1;
    for (const row of sh.rows) { ws.getRow(r).values = row; r++; }
    if (sh.after) sh.after(ws, r);
  }
  return toAB(Buffer.from(await wb.xlsx.writeBuffer()));
}
/* نسخة معدَّلة من الملف التجريبي (المنظَّم) عبر ExcelJS */
async function editDemo(fn, src) {
  const wb = new X.Workbook(); await wb.xlsx.load(src || readFile(DEMO));
  await fn(wb);
  return toAB(Buffer.from(await wb.xlsx.writeBuffer()));
}
function hdr(ws, row) { const h = {}; ws.getRow(row || 1).eachCell((c, i) => { h[String(c.value).trim()] = i; }); return h; }
function rowOf(ws, h, col, val, from) { for (let r = from || 2; r <= ws.rowCount; r++) if (ws.getRow(r).getCell(h[col]).value === val) return r; return 0; }
async function sheetOf(buf, name) { const wb = new X.Workbook(); await wb.xlsx.load(buf); return { wb, ws: wb.getWorksheet(name) }; }
const flagsLike = (flags, re) => flags.filter(f => re.test(f.text));

test('[10] a year sheet missing الوحدة / العقد من / العقد الى is still read (no crash) and the missing columns are flagged once', async () => {
  const E = load({ today: TODAY });
  const noDates = await ledgerBook([{ name: '2025', head: ['م', 'المشروع', 'الاسم', 'الوحدة', 'يناير', 'فبراير', 'مارس', 'ابريل', 'مايو', 'يونيو', 'يوليو', 'اغسطس', 'سبتمبر', 'اكتوبر', 'نوفمبر', 'ديسمبر', 'الاجمالي'], rows: [[1, 'بابل', 'عمرو أيمن زكي', 'محل', 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000]] }]);
  const r1 = await E.Workbook.read(noDates);
  assert.equal(r1.state.payments.length, 12); assert.equal(r1.state.contracts.length, 1);
  const f1 = flagsLike(r1.flags, /الأعمدة الناقصة/); assert.equal(f1.length, 1); assert.match(f1[0].text, /العقد من، العقد الى/); assert.equal(f1[0].sev, 'warn');
  const noUnit = await ledgerBook([{ name: '2025', head: ['م', 'المشروع', 'الاسم', 'العقد من', 'العقد الى', 'يناير', 'فبراير', 'مارس', 'ابريل', 'مايو', 'يونيو', 'يوليو', 'اغسطس', 'سبتمبر', 'اكتوبر', 'نوفمبر', 'ديسمبر', 'الاجمالي'], rows: [[1, 'بابل', 'عمرو أيمن زكي', D(2025, 1, 1), D(2025, 12, 31), 5000, 5000, 5000]] }]);
  const r2 = await E.Workbook.read(noUnit);
  assert.equal(r2.state.payments.length, 3); assert.equal(r2.state.contracts[0].start, '2025-01-01');
  assert.match(flagsLike(r2.flags, /الأعمدة الناقصة/)[0].text, /الوحدة/);
});

test('[17] a year sheet named with Arabic-Indic digits («٢٠٢٦») yields Latin periods and invoice codes, and the website rewrites it as «2026» (the original sheet is replaced, not duplicated)', async () => {
  const E = load({ today: TODAY });
  const buf = await ledgerBook([{ name: '٢٠٢٦', rows: [L(1, 'بابل', 'عمرو أيمن زكي', '101', D(2026, 1, 1), D(2026, 12, 31), [1000, 1000, 1000])] }]);
  const r = await E.Workbook.read(buf); E.Store.load(r.state);
  assert.deepEqual(r.state.payments.map(p => p.period), ['2026-01', '2026-02', '2026-03']);
  assert.ok(r.state.payments.every(p => /^INV-2026-\d{4}$/.test(p.code)), JSON.stringify(r.state.payments.map(p => p.code)));
  assert.deepEqual(r.state.settings.ledgerYears, [2026]); assert.equal(r.state.settings.trackingFrom, '2026-01');
  assert.equal(E.Engine.cell(r.state.contracts[0], '2026-02').status, 'paid');
  const out = await E.Workbook.write(r.state, { base: buf });
  const { wb } = await sheetOf(out, '2026');
  assert.ok(wb.getWorksheet('2026')); assert.equal(wb.getWorksheet('٢٠٢٦'), undefined);
  assert.equal(wb.worksheets.filter(w => /^[\d٠-٩]{4}$/.test(w.name)).length, 1);
});

test('[13] per-project subtotal rows («اجمالي بابل») and a mistyped grand total («الإجمالى العام») are not tenants; a formula-only row without unit and dates is skipped with a note', async () => {
  const E = load({ today: TODAY });
  const buf = await ledgerBook([{ name: '2026', rows: [
    L(1, 'بابل', 'عميل أول', '101', D(2026, 1, 1), D(2026, 12, 31), [6000, 6000, 6000]),
    L(2, 'بابل', 'عميل ثاني', '102', D(2026, 1, 1), D(2026, 12, 31), [4000, 4000, 4000]),
    [null, 'بابل', 'اجمالي بابل', null, null, null, null, null, null, null, { formula: 'SUM(K3:K4)', result: 10000 }, { formula: 'SUM(L3:L4)', result: 10000 }, { formula: 'SUM(M3:M4)', result: 10000 }],
    [null, 'بابل', 'مجموع فرعي', null, null, null, null, null, null, null, { formula: 'SUM(K3:K4)', result: 10000 }],
    L(3, 'محيي الدين', 'عميل ثالث', '301', D(2026, 1, 1), D(2026, 12, 31), [7000, 7000], { addr: 'شارع محيي الدين 30' }),
    [null, 'بابل', 'شركة المعادلات', null, null, null, null, null, null, null, { formula: 'K3*2', result: 12000 }, { formula: 'L3*2', result: 12000 }],
    [null, null, 'الإجمالى العام', null, null, null, null, null, null, null, { formula: 'SUM(K3:K8)', result: 29000 }],
    [null, null, 'Total', null, null, null, null, null, null, null, 29000],
  ] }]);
  const r = await E.Workbook.read(buf);
  assert.deepEqual(r.state.clients.map(c => c.name), ['عميل أول', 'عميل ثاني', 'عميل ثالث']);
  assert.equal(r.state.contracts.length, 3);
  assert.equal(r.state.payments.reduce((s, p) => s + p.amount, 0), 18000 + 12000 + 14000);
  const skipped = flagsLike(r.flags, /صف معادلات بلا وحدة ولا تواريخ/);
  assert.equal(skipped.length, 1); assert.match(skipped[0].text, /شركة المعادلات/); assert.equal(skipped[0].sev, 'info');
});

test('[19] a month cell holding a formula with no cached value or an error result is flagged as a text cell (not silently empty) and the text survives the round trip', async () => {
  const E = load({ today: TODAY });
  const buf = await ledgerBook([{ name: '2026', rows: [
    L(1, 'بابل', 'عميل معادلة', '101', D(2026, 1, 1), D(2026, 12, 31), [6000, { formula: '6000+6000' }, { formula: 'N2*0', result: { error: '#REF!' } }, { sharedFormula: 'L3' }, 5000]),
  ] }]);
  const r = await E.Workbook.read(buf);
  const c = r.state.contracts[0];
  assert.deepEqual(r.state.payments.map(p => [p.period, p.amount]), [['2026-01', 6000], ['2026-05', 5000]]);
  assert.equal(c.cellNotes['2026-03'], '#REF!');
  assert.match(c.cellNotes['2026-02'], /^معادلة بلا قيمة/); assert.match(c.cellNotes['2026-02'], /6000\+6000/);
  assert.match(c.cellNotes['2026-04'], /^معادلة بلا قيمة/);
  const texts = flagsLike(r.flags, /تحتوي نصًا لا رقمًا/);
  assert.equal(texts.length, 3); assert.ok(texts.some(f => /#REF!/.test(f.text)) && texts.some(f => /معادلة بلا قيمة/.test(f.text)));
  E.Store.load(r.state);
  const r2 = await E.Workbook.read(await E.Workbook.write(r.state));
  assert.equal(r2.state.contracts[0].cellNotes['2026-03'], '#REF!');
});

test('[18] a re-let of the same numbered unit with a ≤31-day overlap reuses the unit (with a warning); a longer overlap or a generic label («محل») still splits into a second unit', async () => {
  const E = load({ today: TODAY });
  const buf = await ledgerBook([{ name: '2026', rows: [
    L(1, 'بابل', 'مستأجر أ', '201', D(2025, 1, 1), D(2026, 3, 31), [4000, 4000, 4000]),
    L(2, 'بابل', 'مستأجر ب', '201', D(2026, 3, 1), D(2027, 2, 28), [null, null, 4500, 4500]),
    L(3, 'بابل', 'مستأجر ج', '305', D(2025, 1, 1), D(2026, 6, 30), [3000, 3000]),
    L(4, 'بابل', 'مستأجر د', '305', D(2026, 3, 1), D(2027, 2, 28), [null, null, 3500, 3500]),
    L(5, 'بابل', 'مستأجر هـ', 'محل', D(2025, 1, 1), D(2026, 3, 31), [2000, 2000]),
    L(6, 'بابل', 'مستأجر و', 'محل', D(2026, 3, 1), D(2027, 2, 28), [null, null, 2500]),
  ] }]);
  const r = await E.Workbook.read(buf); E.Store.load(r.state);
  const u201 = r.state.units.filter(u => u.label === '201'); assert.equal(u201.length, 1, 'short overlap: one unit');
  assert.equal(E.Store.contractsOfUnit(u201[0].code).length, 2);
  const w = flagsLike(r.flags, /يتداخل 31 يومًا/); assert.equal(w.length, 1); assert.equal(w[0].sev, 'warn'); assert.equal(w[0].code, u201[0].code);
  assert.equal(r.state.units.filter(u => u.label === '305').length, 2, 'four-month overlap: separate unit');
  assert.equal(r.state.units.filter(u => u.label === 'محل').length, 2, 'generic label: separate unit even for a short overlap');
  assert.ok(flagsLike(r.flags, /أُنشئت وحدة منفصلة/).length >= 2);
});

test('[11] a payment typed by hand in «المدفوعات» for a month whose ledger cell is empty survives the next read: with the snapshot silently, without one with a warning; clearing a non-empty cell with a snapshot still deletes', async () => {
  const E = load({ today: TODAY });
  const base = await E.Workbook.read(readFile(DEMO)); E.Store.load(base.state);
  const snap = E.Workbook.snapshotOf(base.state);
  // شهر داخل عقد ساري بلا أي دفعة
  let pick = null;
  for (const c of base.state.contracts) { for (const p of ['2026-02', '2026-03', '2026-05', '2026-06']) { if (!(c.start <= p + '-01' && c.end >= E.U.iso(E.U.monthLast(p)))) continue; if (!base.state.payments.some(x => x.contractCode === c.code && x.period === p)) { pick = { c, p }; break; } } if (pick) break; }
  assert.ok(pick, 'an active contract with an unpaid month exists');
  assert.ok(!((pick.c.code + '|' + pick.p) in snap.cells), 'the snapshot has no key for the empty cell');
  const edited = await editDemo(wb => {
    const ws = wb.getWorksheet('المدفوعات'); const h = hdr(ws); const r = ws.rowCount + 1;
    ws.getCell(r, h['كود العقد']).value = pick.c.code; ws.getCell(r, h['الشهر']).value = pick.p; ws.getCell(r, h['المبلغ']).value = 2522; ws.getCell(r, h['تاريخ السداد']).value = D(2026, 9, 5); ws.getCell(r, h['طريقة السداد']).value = 'إنستاباي'; ws.getCell(r, h['مرجع / إيصال']).value = 'REF-77';
  });
  const withSnap = await E.Workbook.read(edited, { snapshot: snap });
  const kept = withSnap.state.payments.filter(x => x.contractCode === pick.c.code && x.period === pick.p);
  assert.equal(kept.length, 1); assert.equal(kept[0].amount, 2522); assert.equal(kept[0].method, 'instapay'); assert.equal(kept[0].ref, 'REF-77');
  assert.equal(flagsLike(withSnap.flags, /فُرِّغت/).length, 0);
  const noSnap = await E.Workbook.read(edited);
  const kept2 = noSnap.state.payments.filter(x => x.contractCode === pick.c.code && x.period === pick.p);
  assert.equal(kept2.length, 1, 'no silent deletion without a snapshot');
  const warn = noSnap.flags.filter(f => f.code === pick.c.code && /أُبقيت الدفعات/.test(f.text)); assert.equal(warn.length, 1); assert.equal(warn[0].sev, 'warn');
  // الحالة العكسية: خانة كانت بها قيمة في اللقطة وفُرِّغت في الإكسيل ⇒ الحذف مع التنبيه القديم
  const paid = base.state.payments.find(p => p.period === '2026-01' && p.amount > 0);
  const cleared = await editDemo(wb => { const ws = wb.getWorksheet('2026'); const h = hdr(ws, 2); const r = rowOf(ws, h, 'كود العقد', paid.contractCode, 3); ws.getCell(r, h['يناير']).value = null; });
  const r3 = await E.Workbook.read(cleared, { snapshot: snap });
  assert.equal(r3.state.payments.filter(p => p.contractCode === paid.contractCode && p.period === '2026-01').length, 0);
  assert.equal(r3.flags.filter(f => f.code === paid.contractCode && /فُرِّغت/.test(f.text)).length, 1);
});

test('[12] «بداية المحاسبة» / «آخر شهر مسجَّل» auto-converted by Excel into dates (or typed loosely) read as YYYY-MM; garbage is dropped with a flag; the website writes them as text cells', async () => {
  const E = load({ today: TODAY });
  const setk = (ws, k, v, fmt) => { for (let r = 2; r <= ws.rowCount; r++) if (ws.getCell(r, 1).value === k) { ws.getCell(r, 2).value = v; if (fmt) ws.getCell(r, 2).numFmt = fmt; } };
  const asDates = await editDemo(wb => { const ws = wb.getWorksheet('الإعدادات'); setk(ws, 'بداية المحاسبة (سنة-شهر)', D(2026, 1, 1), 'mmm-yy'); setk(ws, 'آخر شهر مسجَّل في الورقة (سنة-شهر أو فارغ = تلقائي)', D(2026, 6, 1), 'mmm-yy'); });
  const r1 = await E.Workbook.read(asDates); E.Store.load(r1.state);
  assert.equal(r1.state.settings.trackingFrom, '2026-01'); assert.equal(r1.state.settings.enteredThrough, '2026-06');
  const c = r1.state.contracts.find(x => x.start <= '2026-01-01' && x.end >= '2026-12-31');
  assert.notEqual(E.Engine.cell(c, '2026-01').status, 'history', 'January is accounted for (not before a mis-read 2026-01-01 start)');
  assert.equal(E.Engine.enteredThrough(), '2026-06');
  const loose = await editDemo(wb => { const ws = wb.getWorksheet('الإعدادات'); setk(ws, 'بداية المحاسبة (سنة-شهر)', '2026/3'); setk(ws, 'آخر شهر مسجَّل في الورقة (سنة-شهر أو فارغ = تلقائي)', 'كلام'); });
  const r2 = await E.Workbook.read(loose);
  assert.equal(r2.state.settings.trackingFrom, '2026-03'); assert.equal(r2.state.settings.enteredThrough, '');
  assert.equal(flagsLike(r2.flags, /«كلام» غير مقروء/).length, 1);
  const bad = await editDemo(wb => { setk(wb.getWorksheet('الإعدادات'), 'بداية المحاسبة (سنة-شهر)', 'يناير'); });
  const r3 = await E.Workbook.read(bad);
  assert.equal(r3.state.settings.trackingFrom, '2026-01', 'unreadable start falls back to the oldest year sheet');
  assert.ok(flagsLike(r3.flags, /بداية المحاسبة.*غير مقروء/).length === 1);
  const out = await E.Workbook.write(r1.state);
  const { ws } = await sheetOf(out, 'الإعدادات');
  for (let r = 2; r <= ws.rowCount; r++) { const k = ws.getCell(r, 1).value; if (k === 'بداية المحاسبة (سنة-شهر)' || /آخر شهر مسجَّل/.test(String(k)) || k === 'سنوات الورقة') { assert.equal(ws.getCell(r, 2).numFmt, '@', String(k)); assert.equal(typeof ws.getCell(r, 2).value, 'string'); } }
});

test('[14] percent fields: 0.1 with a % format reads as 10, the text «10%» reads as 10, an out-of-range value is flagged; tolerancePct in the settings follows the same rule', async () => {
  const E = load({ today: TODAY });
  const edited = await editDemo(wb => {
    const ws = wb.getWorksheet('العقود'); const h = hdr(ws);
    const put = (code, v, fmt) => { const r = rowOf(ws, h, 'كود العقد', code); ws.getCell(r, h['الزيادة السنوية %']).value = v; if (fmt) ws.getCell(r, h['الزيادة السنوية %']).numFmt = fmt; ws.getCell(r, h['إيجار كل سنة (يدوي)']).value = null; };
    put('T0005', 0.1, '0%'); put('T0003', '10%'); put('T0004', '٧٫٥ ٪'); put('T0006', 250);
    const s = wb.getWorksheet('الإعدادات'); for (let r = 2; r <= s.rowCount; r++) if (s.getCell(r, 1).value === 'فرق مقبول في السداد %') { s.getCell(r, 2).value = 0.005; s.getCell(r, 2).numFmt = '0.0%'; }
  });
  const r = await E.Workbook.read(edited); E.Store.load(r.state);
  const by = code => r.state.contracts.find(c => c.code === code);
  assert.equal(by('T0005').increasePct, 10); assert.equal(by('T0003').increasePct, 10); assert.equal(by('T0004').increasePct, 7.5); assert.equal(by('T0006').increasePct, 250);
  assert.deepEqual(E.Engine.schedule(by('T0005')).map(y => y.rent), [76000, 83600, 91960]);
  const bad = flagsLike(r.flags, /خارج النطاق 0–100/); assert.equal(bad.length, 1); assert.equal(bad[0].code, 'T0006');
  assert.equal(r.state.settings.tolerancePct, 0.5);
});

test('[15] months typed loosely in «المدفوعات» (2026-9 · 9/2026 · 04-2026 · سبتمبر 2026 · a date · a serial · Arabic digits) are normalised; an unreadable month is flagged and skipped; a wrong year (2062-03) is kept, flagged and creates no year sheets', async () => {
  const E = load({ today: TODAY });
  const base = await E.Workbook.read(readFile(DEMO)); E.Store.load(base.state);
  const edited = await editDemo(wb => {
    const ws = wb.getWorksheet('المدفوعات'); const h = hdr(ws); let r = ws.rowCount + 1;
    const rows = [['2026-9', 1000], ['9/2026', 1001], ['04-2026', 1002], ['سبتمبر 2026', 1003], [D(2026, 9, 15), 1004], [46204, 1005], ['٢٠٢٦-٠٩', 1006], ['Sep 2026', 1007], ['15/09/2026', 1008], ['كلام فارغ', 1009], ['2062-03', 1010]];
    for (const [per, amt] of rows) { ws.getCell(r, h['كود العقد']).value = 'T0008'; ws.getCell(r, h['الشهر']).value = per; ws.getCell(r, h['المبلغ']).value = amt; ws.getCell(r, h['تاريخ السداد']).value = D(2026, 9, 20); r++; }
  });
  const r2 = await E.Workbook.read(edited, { snapshot: E.Workbook.snapshotOf(base.state) }); E.Store.load(r2.state); // باللقطة: خانات الورقة لم تتغير ⇒ صفوف المدفوعات المكتوبة باليد تتقدم حتى للشهور المسدَّدة (أبريل/يوليو)
  const news = r2.state.payments.filter(p => p.contractCode === 'T0008' && p.amount >= 1000 && p.amount <= 1010);
  const per = Object.fromEntries(news.map(p => [p.amount, p.period]));
  assert.deepEqual(per, { 1000: '2026-09', 1001: '2026-09', 1002: '2026-04', 1003: '2026-09', 1004: '2026-09', 1005: '2026-07', 1006: '2026-09', 1007: '2026-09', 1008: '2026-09', 1010: '2062-03' });
  assert.equal(per[1009], undefined, 'the unreadable month row is skipped');
  const bad = flagsLike(r2.flags, /الشهر «كلام فارغ» غير مقروء/); assert.equal(bad.length, 1); assert.equal(bad[0].sev, 'danger'); assert.match(bad[0].text, /2026-09/);
  const far = flagsLike(r2.flags, /2062-03 خارج سنوات الورقة/); assert.equal(far.length, 1);
  assert.deepEqual(r2.state.settings.ledgerYears, [2026]);
  assert.equal(E.Engine.cell(E.Store.contract('T0008'), '2026-09').paid, 1000 + 1001 + 1003 + 1004 + 1006 + 1007 + 1008 + base.state.payments.filter(p => p.contractCode === 'T0008' && p.period === '2026-09').reduce((s, p) => s + p.amount, 0));
  const out = await E.Workbook.write(r2.state, { base: edited });
  const { wb } = await sheetOf(out, '2026');
  assert.deepEqual(wb.worksheets.map(w => w.name).filter(n => /^\d{4}$/.test(n)), ['2026'], 'no sheets up to 2062');
  assert.deepEqual(r2.state.settings.ledgerYears, [2026]);
  const pays = wb.getWorksheet('المدفوعات'); const h = hdr(pays);
  const typo = []; for (let r = 2; r <= pays.rowCount; r++) if (pays.getCell(r, h['الشهر']).value === '2062-03') typo.push(pays.getCell(r, h['المبلغ']).value);
  assert.deepEqual(typo, [1010], 'the wrong-year payment is kept in المدفوعات');
  const r3 = await E.Workbook.read(out); assert.deepEqual(r3.state.settings.ledgerYears, [2026]); assert.equal(flagsLike(r3.flags, /2062-03 خارج سنوات الورقة/).length, 1);
});

test('[16] «سنوات الورقة» lists a year whose sheet was deleted by hand: the sheets present win (no accounting-start move, no re-created sheet); a current/next year added from the settings is still honoured', async () => {
  const E = load({ today: TODAY });
  const setYears = (v) => editDemo(wb => { const ws = wb.getWorksheet('الإعدادات'); for (let r = 2; r <= ws.rowCount; r++) if (ws.getCell(r, 1).value === 'سنوات الورقة') ws.getCell(r, 2).value = v; });
  const stale = await setYears('2025, 2026');
  const r1 = await E.Workbook.read(stale); E.Store.load(r1.state);
  assert.deepEqual(r1.state.settings.ledgerYears, [2026]); assert.equal(r1.state.settings.trackingFrom, '2026-01');
  assert.equal(flagsLike(r1.flags, /2025 جعلت المحاسبة/).length, 0);
  assert.equal(flagsLike(r1.flags, /بلا ورقة في الملف \(2025\)/).length, 1);
  const out1 = await E.Workbook.write(r1.state, { base: stale });
  const { wb: wb1 } = await sheetOf(out1, '2026'); assert.equal(wb1.getWorksheet('2025'), undefined);
  const future = await setYears('2026, 2027');
  const r2 = await E.Workbook.read(future); E.Store.load(r2.state);
  assert.deepEqual(r2.state.settings.ledgerYears, [2026, 2027]);
  const out2 = await E.Workbook.write(r2.state, { base: future });
  const { wb: wb2 } = await sheetOf(out2, '2027'); assert.ok(wb2.getWorksheet('2027'));
  // سنة أقدم أُضيفت فعلًا من البرنامج (قبل أول حفظ): الكتابة تنشئها ثم تثبت عند القراءة
  r1.state.settings.ledgerYears = [2025, 2026]; r1.state.settings.trackingFrom = '2025-01';
  const out3 = await E.Workbook.write(r1.state, { base: stale });
  const r3 = await E.Workbook.read(out3); assert.deepEqual(r3.state.settings.ledgerYears, [2025, 2026]); assert.equal(r3.state.settings.trackingFrom, '2025-01');
});

test('[20] columns the office adds to managed sheets (year sheet in the middle and at the end, العقود, العملاء, المدفوعات) survive a website save with their values per row; new website rows get empty cells; users-sheet extras are flagged', async () => {
  const E = load({ today: TODAY });
  const edited = await editDemo(wb => {
    const ws = wb.getWorksheet('2026'); const h = hdr(ws, 2);
    ws.getCell(2, 29).value = 'التليفون'; ws.getCell(3, 29).value = '01001234567'; ws.getCell(4, 29).value = '01112223334'; ws.getCell(3, 29).numFmt = '@';
    ws.spliceColumns(7, 0, []); ws.getCell(2, 7).value = 'رقم العداد'; ws.getCell(3, 7).value = 'E-5566'; ws.getCell(5, 7).value = D(2026, 2, 3); ws.getCell(5, 7).numFmt = 'dd/mm/yyyy';
    const wc = wb.getWorksheet('العقود'); const hc = hdr(wc); const lc = wc.columnCount + 1; wc.getCell(1, lc).value = 'ملاحظة داخلية'; wc.getCell(rowOf(wc, hc, 'كود العقد', 'T0003'), lc).value = 'سري: المحامي يتابع';
    const wp = wb.getWorksheet('العملاء'); const hp = hdr(wp); const lp = wp.columnCount + 1; wp.getCell(1, lp).value = 'واتساب'; wp.getCell(rowOf(wp, hp, 'كود العميل', 'C002'), lp).value = '+201001234567';
    const wy = wb.getWorksheet('المدفوعات'); const hy = hdr(wy); const ly = wy.columnCount + 1; wy.getCell(1, ly).value = 'رقم الشيك'; wy.getCell(rowOf(wy, hy, 'رقم الفاتورة', 'INV-2026-0003'), ly).value = 778899;
    const wu = wb.getWorksheet('المستخدمون'); wu.getCell(1, wu.columnCount + 1).value = 'عمود غريب';
  });
  const r = await E.Workbook.read(edited); E.Store.load(r.state);
  const t1 = r.state.contracts.find(c => c.code === 'T0001'); assert.equal(t1.start, '2023-06-01', 'reading by header name is unaffected by the inserted column');
  assert.ok(flagsLike(r.flags, /ورقة 2026: أعمدة إضافية من المكتب \(رقم العداد، التليفون\)/).length === 1);
  const uf = flagsLike(r.flags, /ورقة المستخدمون: أعمدة غير معروفة \(عمود غريب\)/); assert.equal(uf.length, 1); assert.equal(uf[0].sev, 'danger');
  const codeAt3 = r.state._extra['2026'].rows; assert.ok(Object.keys(codeAt3).length >= 2);
  E.Store.upsert('payments', { code: E.Codes.nextInvoice(r.state, 2026), contractCode: 'T0008', period: '2026-09', amount: 46585, paidOn: '2026-09-03', method: 'cash', source: 'web' });
  const out = await E.Workbook.write(r.state, { base: edited });
  const { wb } = await sheetOf(out, '2026');
  const ws = wb.getWorksheet('2026'); const h = hdr(ws, 2);
  assert.ok(h['التليفون'] > 28 && h['رقم العداد'] > 28, 'office columns appended after the code columns: ' + JSON.stringify([h['التليفون'], h['رقم العداد']]));
  const byCode = {}; for (let rr = 3; rr <= ws.rowCount; rr++) { const code = ws.getCell(rr, h['كود العقد']).value; if (code) byCode[code] = { tel: ws.getCell(rr, h['التليفون']).value, meter: ws.getCell(rr, h['رقم العداد']).value, meterFmt: ws.getCell(rr, h['رقم العداد']).numFmt }; }
  const src = await sheetOf(edited, '2026'); const sh = hdr(src.ws, 2);
  const c3 = src.ws.getCell(3, sh['كود العقد']).value, c4 = src.ws.getCell(4, sh['كود العقد']).value, c5 = src.ws.getCell(5, sh['كود العقد']).value;
  assert.equal(byCode[c3].tel, '01001234567'); assert.equal(byCode[c3].meter, 'E-5566'); assert.equal(byCode[c4].tel, '01112223334');
  assert.equal(E.U.toIso(byCode[c5].meter), '2026-02-03'); assert.equal(byCode[c5].meterFmt, 'dd/mm/yyyy');
  assert.equal(ws.getCell(2, h['التليفون']).font.bold, true, 'extra headers get the header style');
  const wc = wb.getWorksheet('العقود'); const hc = hdr(wc); assert.equal(wc.getCell(rowOf(wc, hc, 'كود العقد', 'T0003'), hc['ملاحظة داخلية']).value, 'سري: المحامي يتابع'); assert.equal(wc.getCell(rowOf(wc, hc, 'كود العقد', 'T0004'), hc['ملاحظة داخلية']).value, null);
  const wp = wb.getWorksheet('العملاء'); const hp = hdr(wp); assert.equal(wp.getCell(rowOf(wp, hp, 'كود العميل', 'C002'), hp['واتساب']).value, '+201001234567');
  const wy = wb.getWorksheet('المدفوعات'); const hy = hdr(wy); assert.equal(wy.getCell(rowOf(wy, hy, 'رقم الفاتورة', 'INV-2026-0003'), hy['رقم الشيك']).value, 778899);
  const newRow = rowOf(wy, hy, 'كود العقد', 'T0008'); assert.ok(newRow && hy['رقم الشيك'] === wy.columnCount);
  // جولة ثانية: القيم تبقى
  const r2 = await E.Workbook.read(out); E.Store.load(r2.state);
  const out2 = await E.Workbook.write(r2.state, { base: out }); const g2 = await sheetOf(out2, 'العقود'); const h2 = hdr(g2.ws);
  assert.equal(g2.ws.getCell(rowOf(g2.ws, h2, 'كود العقد', 'T0003'), h2['ملاحظة داخلية']).value, 'سري: المحامي يتابع');
});

test('[21] «آخر كتابة من الموقع» is stamped with the local wall clock (U.stamp), not UTC', async () => {
  const E = load({ today: TODAY });
  const r = await E.Workbook.read(readFile(DEMO)); E.Store.load(r.state);
  // ساعة المكتب: نجبر المنطقة الزمنية على القاهرة حتى يفشل الاختبار على جهاز اختبار يعمل بتوقيت UTC لو عادت الكتابة إلى toISOString
  const tz0 = process.env.TZ; process.env.TZ = 'Africa/Cairo';
  let before, after, out, utc;
  try { assert.notEqual(new Date().getTimezoneOffset(), 0, 'TZ override applied'); before = E.U.stamp(); out = await E.Workbook.write(r.state); after = E.U.stamp(); utc = new Date().toISOString().slice(0, 19).replace('T', ' '); }
  finally { if (tz0 === undefined) delete process.env.TZ; else process.env.TZ = tz0; }
  const { ws } = await sheetOf(out, 'الإعدادات');
  let v = null; for (let i = 2; i <= ws.rowCount; i++) if (ws.getCell(i, 1).value === 'آخر كتابة من الموقع') v = ws.getCell(i, 2).value;
  assert.match(String(v), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.ok(before <= v && v <= after, `${before} <= ${v} <= ${after}`);
  assert.notEqual(v.slice(0, 13), utc.slice(0, 13), 'differs from UTC (Cairo is UTC+2/+3)');
});

test('[11b] the kept hand-typed payment survives a second poll (app.js refreshes the snapshot from the state after every read, with no website write in between); after a website write a cleared cell still deletes it', async () => {
  const E = load({ today: TODAY });
  const base = await E.Workbook.read(readFile(DEMO)); E.Store.load(base.state);
  const snap0 = E.Workbook.snapshotOf(base.state);
  let pick = null;
  for (const c of base.state.contracts) { for (const p of ['2026-02', '2026-03', '2026-05', '2026-06']) { if (!(c.start <= p + '-01' && c.end >= E.U.iso(E.U.monthLast(p)))) continue; if (!base.state.payments.some(x => x.contractCode === c.code && x.period === p)) { pick = { c, p }; break; } } if (pick) break; }
  assert.ok(pick); const key = pick.c.code + '|' + pick.p; const paysOf = s => s.payments.filter(x => x.contractCode === pick.c.code && x.period === pick.p);
  const edited = await editDemo(wb => { const ws = wb.getWorksheet('المدفوعات'); const h = hdr(ws); const r = ws.rowCount + 1; ws.getCell(r, h['كود العقد']).value = pick.c.code; ws.getCell(r, h['الشهر']).value = pick.p; ws.getCell(r, h['المبلغ']).value = 2522; ws.getCell(r, h['تاريخ السداد']).value = D(2026, 9, 5); });
  const r1 = await E.Workbook.read(edited, { snapshot: snap0 }); E.Store.load(r1.state);
  assert.equal(paysOf(r1.state).length, 1);
  const snap1 = E.Workbook.snapshotOf(r1.state); // ما يحفظه app.js بعد القراءة
  assert.equal(snap1.cells[key], 0, 'the snapshot remembers the ledger cell as read (empty), not the payment sum');
  const edited2 = await editDemo(wb => { wb.getWorksheet('العملاء').getCell(2, 11).value = 'ملاحظة جديدة'; }, edited); // تعديل آخر من المكتب قبل أي كتابة من الموقع
  const r2 = await E.Workbook.read(edited2, { snapshot: snap1 }); E.Store.load(r2.state);
  assert.equal(paysOf(r2.state).length, 1, 'second poll keeps the payment'); assert.equal(flagsLike(r2.flags, /فُرِّغت/).length, 0);
  const out = await E.Workbook.write(r2.state, { base: edited2 });
  const snap2 = E.Workbook.snapshotOf(r2.state); assert.equal(snap2.cells[key], 2522, 'after a write the snapshot is the written sum');
  const monthHead = E.Workbook.LEDGER_HEAD[10 + parseInt(pick.p.slice(5), 10) - 1];
  const cleared = await editDemo(wb => { const ws = wb.getWorksheet('2026'); const h = hdr(ws, 2); const r = rowOf(ws, h, 'كود العقد', pick.c.code, 3); assert.equal(ws.getCell(r, h[monthHead]).value, 2522); ws.getCell(r, h[monthHead]).value = null; }, out);
  const r3 = await E.Workbook.read(cleared, { snapshot: snap2 });
  assert.equal(paysOf(r3.state).length, 0, 'a real clearing after the write still deletes'); assert.equal(r3.flags.filter(f => f.code === pick.c.code && /فُرِّغت/.test(f.text)).length, 1);
});

test('[13b] a tenant whose name contains a total-like word («Total Energies») but has a unit and contract dates is read as a tenant (with a warning), while the bare total rows are still skipped', async () => {
  const E = load({ today: TODAY });
  const buf = await ledgerBook([{ name: '2026', rows: [
    L(1, 'بابل', 'Total Energies Egypt', '101', D(2026, 1, 1), D(2026, 12, 31), [9000, 9000]),
    [null, 'بابل', 'اجمالي بابل', null, null, null, null, null, null, null, { formula: 'SUM(K3:K3)', result: 9000 }],
    [null, null, 'الاجمالي العام', null, null, null, null, null, null, null, { formula: 'SUM(K3:K3)', result: 9000 }],
  ] }]);
  const r = await E.Workbook.read(buf);
  assert.deepEqual(r.state.clients.map(c => c.name), ['Total Energies Egypt']); assert.equal(r.state.payments.length, 2);
  const w = flagsLike(r.flags, /يشبه اسم صف إجمالي/); assert.equal(w.length, 1); assert.equal(w[0].sev, 'warn'); assert.match(w[0].text, /101/);
});

test('[15b] a payments row with an unreadable month is not destroyed by the next website save: it stays at the end of «المدفوعات» as typed, is flagged again on the next read, and is not duplicated by a second save', async () => {
  const E = load({ today: TODAY });
  const base = await E.Workbook.read(readFile(DEMO)); E.Store.load(base.state);
  const edited = await editDemo(wb => { const ws = wb.getWorksheet('المدفوعات'); const h = hdr(ws); const r = ws.rowCount + 1; ws.getCell(r, h['كود العقد']).value = 'T0008'; ws.getCell(r, h['الشهر']).value = 'كلام فارغ'; ws.getCell(r, h['المبلغ']).value = 1009; ws.getCell(r, h['مرجع / إيصال']).value = 'REF-X'; ws.getCell(r, h['طريقة السداد']).value = 'إنستاباي'; });
  const r1 = await E.Workbook.read(edited, { snapshot: E.Workbook.snapshotOf(base.state) }); E.Store.load(r1.state);
  assert.equal(r1.state.payments.filter(p => p.amount === 1009).length, 0, 'not loaded as a payment');
  const rowsIn = async (buf) => { const { ws } = await sheetOf(buf, 'المدفوعات'); const h = hdr(ws); const out = []; for (let r = 2; r <= ws.rowCount; r++) if (ws.getCell(r, h['الشهر']).value === 'كلام فارغ') out.push({ amt: ws.getCell(r, h['المبلغ']).value, ref: ws.getCell(r, h['مرجع / إيصال']).value, code: ws.getCell(r, h['كود العقد']).value, method: ws.getCell(r, h['طريقة السداد']).value, last: r === ws.rowCount }); return out; };
  const out = await E.Workbook.write(r1.state, { base: edited });
  assert.deepEqual(await rowsIn(out), [{ amt: 1009, ref: 'REF-X', code: 'T0008', method: 'إنستاباي', last: true }]);
  const r2 = await E.Workbook.read(out); E.Store.load(r2.state);
  assert.equal(flagsLike(r2.flags, /الشهر «كلام فارغ» غير مقروء/).length, 1); assert.equal(r2.state.payments.filter(p => p.amount === 1009).length, 0);
  const out2 = await E.Workbook.write(r2.state, { base: out });
  assert.equal((await rowsIn(out2)).length, 1, 'a second save keeps exactly one copy');
});

test('[22] a workbook containing a chart or pivot table part is flagged on read (ExcelJS cannot re-emit them); the plain demo is not', async () => {
  const E = load({ today: TODAY });
  const plain = await E.Workbook.read(readFile(DEMO));
  assert.equal(flagsLike(plain.flags, /رسم بياني\/جدول محوري/).length, 0);
  const withChart = path.join(OUT, 'fix_chart.xlsx'), withPivot = path.join(OUT, 'fix_pivot.xlsx');
  execFileSync('python3', ['-I', '-c', `
import sys, zipfile, shutil
src, chart, pivot = sys.argv[1:4]
for dst, name in ((chart, 'xl/charts/chart1.xml'), (pivot, 'xl/pivotTables/pivotTable1.xml')):
    shutil.copyfile(src, dst)
    with zipfile.ZipFile(dst, 'a') as z: z.writestr(name, '<?xml version="1.0"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"/>')
`, DEMO, withChart, withPivot]);
  for (const f of [withChart, withPivot]) {
    const r = await E.Workbook.read(readFile(f));
    const fl = flagsLike(r.flags, /رسم بياني\/جدول محوري لن يُحفظ عند الكتابة من الموقع/); assert.equal(fl.length, 1, f); assert.equal(fl[0].sev, 'warn');
    assert.equal(r.state.contracts.length, plain.state.contracts.length);
  }
});

test('[23] cell notes on the year sheet (month cells, the name cell, the notes cell) are kept on the contract as cellComments and written back on every save, per year', async () => {
  const E = load({ today: TODAY });
  const base = await E.Workbook.read(readFile(DEMO)); E.Store.load(base.state);
  const withNotes = await editDemo(wb => {
    const ws = wb.getWorksheet('2026'); const h = hdr(ws, 2);
    const r = rowOf(ws, h, 'كود العقد', 'T0008', 3);
    ws.getCell(r, h['سبتمبر']).note = 'دفع نقدًا للبواب';
    ws.getCell(r, h['الاسم']).note = { texts: [{ text: 'اسم ' }, { font: { bold: true }, text: 'مركّب' }] };
    ws.getCell(r, h['ملاحظات']).note = 'تجديد قريب';
  });
  const r1 = await E.Workbook.read(withNotes); E.Store.load(r1.state);
  const c = r1.state.contracts.find(x => x.code === 'T0008');
  assert.deepEqual(c.cellComments, { '2026-09': 'دفع نقدًا للبواب', '2026-name': 'اسم مركّب', '2026-notes': 'تجديد قريب' });
  assert.equal(r1.state.contracts.filter(x => x.cellComments).length, 1);
  E.Store.upsert('payments', { code: E.Codes.nextInvoice(r1.state, 2026), contractCode: 'T0008', period: '2026-09', amount: 46585, paidOn: '2026-09-03', method: 'cash', source: 'web' });
  const out = await E.Workbook.write(r1.state, { base: withNotes });
  const { ws } = await sheetOf(out, '2026'); const h = hdr(ws, 2); const r = rowOf(ws, h, 'كود العقد', 'T0008', 3);
  const txt = n => n ? (typeof n === 'string' ? n : n.texts.map(t => t.text).join('')) : null;
  assert.equal(txt(ws.getCell(r, h['سبتمبر']).note), 'دفع نقدًا للبواب'); assert.equal(ws.getCell(r, h['سبتمبر']).value, 46585, 'the value and the note coexist');
  assert.equal(txt(ws.getCell(r, h['الاسم']).note), 'اسم مركّب'); assert.equal(txt(ws.getCell(r, h['ملاحظات']).note), 'تجديد قريب');
  const r2 = await E.Workbook.read(out); E.Store.load(r2.state);
  assert.deepEqual(r2.state.contracts.find(x => x.code === 'T0008').cellComments, c.cellComments, 'second round trip keeps them');
  // ملاحظة في ورقة سنة أخرى تُفتاح بسنتها ولا تختلط
  r2.state.settings.ledgerYears = [2026, 2027];
  const out2 = await E.Workbook.write(r2.state, { base: out });
  const two = await editDemo(wb => { const w7 = wb.getWorksheet('2027'); const h7 = hdr(w7, 2); const rr = rowOf(w7, h7, 'كود العقد', 'T0008', 3); assert.ok(rr, 'T0008 overlaps 2027'); w7.getCell(rr, h7['يناير']).note = 'ملاحظة 2027'; }, out2);
  const r3 = await E.Workbook.read(two);
  assert.deepEqual(r3.state.contracts.find(x => x.code === 'T0008').cellComments, Object.assign({ '2027-01': 'ملاحظة 2027' }, c.cellComments));
});

test('idempotence: read → write → read → write on the source fixture and the demo workbook gives identical states and identical sheet lists', async () => {
  const norm = s => JSON.stringify({ settings: s.settings, meta: { ...s.meta, lastWriteAt: '' }, p: s.projects, u: s.units, c: s.clients, k: s.contracts, pay: s.payments, m: s.maintenance, users: s.users, audit: s.audit, extra: s._extra || null });
  for (const src of [SOURCE, DEMO]) {
    const E = load({ today: TODAY });
    const r0 = await E.Workbook.read(readFile(src)); E.Store.load(r0.state);
    const b1 = await E.Workbook.write(r0.state);
    const r1 = await E.Workbook.read(b1); E.Store.load(r1.state);
    const b2 = await E.Workbook.write(r1.state);
    const r2 = await E.Workbook.read(b2);
    assert.equal(norm(r1.state), norm(r2.state), path.basename(src));
    assert.deepEqual(r2.sheets, r1.sheets);
    assert.deepEqual(r2.flags.filter(f => f.sev !== 'info').map(f => f.text), r1.flags.filter(f => f.sev !== 'info').map(f => f.text));
  }
});
