// اختبارات انحدار لإصلاحات النواة والمحرّك (الفحص الشامل — مجموعة core+engine)
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { load, readFile, SOURCE, ROOT } = require('./helpers/env');
const DEMO = path.join(ROOT, 'Egary.xlsx');
const TODAY = '2026-10-10';
const tick = (ms) => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (fn()) return true; await tick(20); } return fn(); };

/* بانٍ صغير لحالة مصطنعة (كما في مجسّات الفحص) */
function boot(opts) {
  const E = load({ today: TODAY });
  const st = E.M.emptyState(); Object.assign(st.settings, opts || {});
  st.projects.push(Object.assign(E.M.blank.projects(), { code: 'P01', name: 'برج أ' }));
  let un = 0, cl = 0, ct = 0, pn = 0, mn = 0;
  const api = {
    E, st,
    unit(extra) { const u = Object.assign(E.M.blank.units(), { code: 'P01-' + String(++un), projectCode: 'P01', label: 'وحدة ' + un, type: 'admin' }, extra || {}); st.units.push(u); return u; },
    client(extra) { const c = Object.assign(E.M.blank.clients(), { code: 'C' + String(++cl).padStart(3, '0'), name: 'عميل ' + cl }, extra || {}); st.clients.push(c); return c; },
    contract(extra) { const c = Object.assign(E.M.blank.contracts(), { code: 'T' + String(++ct).padStart(4, '0') }, extra || {}); if (!c.unitCode) c.unitCode = api.unit().code; if (!c.clientCode) c.clientCode = api.client().code; st.contracts.push(c); return c; },
    pay(contractCode, period, amount, extra) { const p = Object.assign(E.M.blank.payments(), { code: 'INV-2026-' + String(++pn).padStart(4, '0'), contractCode, period, amount }, extra || {}); st.payments.push(p); return p; },
    maint(extra) { const m = Object.assign(E.M.blank.maintenance(), { code: 'M' + String(++mn).padStart(4, '0'), date: '2026-03-01', description: 'صيانة', cost: 100 }, extra || {}); st.maintenance.push(m); return m; },
    commit() { E.Store.load(st); return E; },
  };
  return api;
}

/* ---------------- util.js ---------------- */
test('[51] d()/toIso() reject impossible dates instead of rolling them over; valid dates and periods still work', () => {
  const E = load({ today: TODAY }); const U = E.U;
  assert.equal(U.d('2026-02-30'), null);
  assert.equal(U.d('2026-13-01'), null);
  assert.equal(U.d('2026-11-31'), null);
  assert.equal(U.d('2026-05'), null, 'a bare period is not a date (unchanged)');
  assert.equal(U.iso(U.d('2026-02-28')), '2026-02-28');
  assert.equal(U.iso(U.d('2028-02-29')), '2028-02-29', 'leap day accepted');
  assert.equal(U.iso(U.monthFirst('2026-05')), '2026-05-01');
  assert.equal(U.toIso('2026-02-30'), '');
  assert.equal(U.toIso('30/02/2026'), '');
  assert.equal(U.toIso('2026-13-01'), '');
  assert.equal(U.toIso('2026/3/1'), '2026-03-01');
  assert.equal(U.toIso('01/02/2026'), '2026-02-01');
  assert.equal(U.fmtDate('2026-02-30'), '—');
  const M = E.M; const base = { ...M.blank.contracts(), unitCode: 'P01-1', clientCode: 'C001', rent: 1000 };
  const errs = M.validate('contracts', { ...base, start: '2026-02-30', end: '2026-13-01' });
  assert.ok(errs.includes('تاريخ بداية العقد مطلوب') && errs.includes('تاريخ نهاية العقد مطلوب'), errs.join('|'));
});

test('[52] an Excel serial with a time fraction stays on the same day (floor, not round)', () => {
  const U = load({ today: TODAY }).U;
  assert.equal(U.toIso(46023), '2026-01-01');
  assert.equal(U.toIso(46023.75), '2026-01-01');
  assert.equal(U.toIso(46023.9999), '2026-01-01');
  assert.equal(U.toIso(46024), '2026-01-02');
});

test('[53] Persian digits and Arabic decimal/thousands separators are read by toNum/toIso, and the phone rule accepts them', () => {
  const E = load({ today: TODAY }); const U = E.U, M = E.M;
  assert.equal(U.toNum('۱۲۳۴'), 1234);
  assert.equal(U.toNum('٣٫٥'), 3.5);
  assert.equal(U.toNum('١٬٢٣٤'), 1234);
  assert.equal(U.toNum('٥٬٠٠٠٫٥٠'), 5000.5);
  assert.equal(U.toNum('1,234.50'), 1234.5);
  assert.equal(U.toNum('1234 ج.م'), 1234);
  assert.equal(U.toNum('-500'), -500);
  assert.equal(U.toNum('abc'), null);
  assert.equal(U.toIso('۰۱/۰۲/۲۰۲۶'), '2026-02-01');
  assert.equal(U.toIso('٢٠٢٦-٠٣-٠١'), '2026-03-01');
  assert.equal(U.foldDigits('۰۱۰١٢'), '01012');
  assert.equal(U.normalize('٣٠٤ ۳۰۵'), '304 305'); assert.equal(U.foldCode('p۰۱-۳۰۴'), 'P01-304');
  for (const p of ['01012345678', '+20 10 1234 5678', '٠١٠١٢٣٤٥٦٧٨', '۰۱۰۱۲۳۴۵۶۷۸']) assert.deepEqual(M.validate('clients', { ...M.blank.clients(), name: 'x', phone: p }), [], p);
  assert.equal(M.validate('clients', { ...M.blank.clients(), name: 'x', phone: 'abc' }).length, 1);
});

/* ---------------- model.js ---------------- */
test('[19] keyOf matches after Arabic normalisation and accepts masculine/alternate synonyms; unknown text still gives \'\'', () => {
  const M = load({ today: TODAY }).M;
  assert.equal(M.keyOf(M.MAINT_STATUS, 'مغلق'), 'closed');
  assert.equal(M.keyOf(M.MAINT_STATUS, 'مغلقة'), 'closed');
  assert.equal(M.keyOf(M.MAINT_STATUS, 'مفتوح'), 'open');
  assert.equal(M.keyOf(M.MAINT_STATUS, ' مفتوحه '), 'open');
  assert.equal(M.keyOf(M.MAINT_STATUS, 'Closed'), 'closed');
  assert.equal(M.keyOf(M.MAINT_KINDS, 'سباكه'), 'plumbing');
  assert.equal(M.keyOf(M.MAINT_KINDS, 'كهربا'), 'electric');
  assert.equal(M.keyOf(M.MAINT_KINDS, 'اخري'), 'other');
  assert.equal(M.keyOf(M.MAINT_KINDS, 'مغلق'), '', 'a synonym of another list is not accepted here');
  assert.equal(M.keyOf(M.PAY_METHODS, 'كاش'), 'cash'); assert.equal(M.keyOf(M.PAY_METHODS, 'تحويل'), 'transfer'); assert.equal(M.keyOf(M.PAY_METHODS, 'انستا باي'), 'instapay');
  assert.equal(M.keyOf(M.BORNE_BY, 'مستاجر'), 'tenant'); assert.equal(M.keyOf(M.CLIENT_KINDS, 'شركه'), 'company');
  assert.equal(M.keyOf(M.UNIT_TYPES, 'commercial'), 'commercial', 'keys still match');
  assert.equal(M.keyOf(M.UNIT_TYPES, ''), ''); assert.equal(M.keyOf(M.UNIT_TYPES, 'xx'), '');
});

test('[19] workbook read maps «مغلق» to a closed maintenance row and «سباكه» to plumbing', async () => {
  const E = load({ today: TODAY });
  const { state } = await E.Workbook.read(readFile(SOURCE)); E.Store.load(state);
  const u = state.units[0];
  state.maintenance.push({ ...E.M.blank.maintenance(), code: E.Codes.nextMaintenance(state), unitCode: u.code, date: '2026-03-01', kind: 'plumbing', description: 'تسريب', cost: 300, status: 'closed', closedOn: '2026-03-02' });
  const buf = await E.Workbook.write(state);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
  const ws = wb.getWorksheet('الصيانة'); const hdr = {}; ws.getRow(1).eachCell((c, i) => { hdr[String(c.value).trim()] = i; });
  let rowN = 0; ws.eachRow((r, n) => { if (n > 1 && String(r.getCell(hdr['كود الصيانة']).value) === state.maintenance[state.maintenance.length - 1].code) rowN = n; });
  assert.ok(rowN, 'row found'); ws.getRow(rowN).getCell(hdr['الحالة']).value = 'مغلق'; ws.getRow(rowN).getCell(hdr['النوع']).value = 'سباكه';
  const out = await wb.xlsx.writeBuffer();
  const E2 = load({ today: TODAY }); const r2 = await E2.Workbook.read(out instanceof ArrayBuffer ? out : new Uint8Array(out).buffer);
  const m = r2.state.maintenance.find(x => x.code === state.maintenance[state.maintenance.length - 1].code);
  assert.equal(m.status, 'closed'); assert.equal(m.kind, 'plumbing');
});

test('[36] [15/51] payment validation: amount must be > 0, period must be YYYY-MM with a sane year (2027 stays valid today)', () => {
  const E = load({ today: TODAY }); const M = E.M;
  const st = M.emptyState(); st.settings.ledgerYears = [2026]; st.settings.trackingFrom = '2026-01';
  const V = (p) => M.validate('payments', { ...M.blank.payments(), contractCode: 'T0001', ...p }, st);
  assert.deepEqual(V({ period: '2027-01', amount: 1 }), []);
  assert.deepEqual(V({ period: '2025-12', amount: 1 }), [], 'one year before the earliest sheet is allowed');
  assert.deepEqual(V({ period: '2026-01', amount: '١٠٠' }), []);
  assert.deepEqual(V({ period: '2026-01', amount: 0 }), ['المبلغ مطلوب (أكبر من صفر)']);
  assert.deepEqual(V({ period: '2026-01', amount: -500 }), ['المبلغ مطلوب (أكبر من صفر)']);
  assert.deepEqual(V({ period: '2026-13', amount: 1 }), ['الشهر مطلوب']);
  assert.deepEqual(V({ period: '2026-00', amount: 1 }), ['الشهر مطلوب']);
  assert.deepEqual(V({ period: '2026-1', amount: 1 }), ['الشهر مطلوب']);
  assert.deepEqual(V({ period: '2062-01', amount: 1 }), ['سنة الشهر غير منطقية']);
  assert.deepEqual(V({ period: '2028-01', amount: 1 }), ['سنة الشهر غير منطقية']);
  assert.deepEqual(V({ period: '2024-01', amount: 1 }), ['سنة الشهر غير منطقية']);
  st.settings.ledgerYears = [2023, 2026];
  assert.deepEqual(V({ period: '2022-06', amount: 1 }), [], 'an older ledger sheet widens the lower bound');
  assert.deepEqual(V({ period: '2021-06', amount: 1 }), ['سنة الشهر غير منطقية']);
  st.settings.ledgerYears = [2026]; st.settings.trackingFrom = '2024-01';
  assert.deepEqual(V({ period: '2023-06', amount: 1 }), [], 'trackingFrom widens the lower bound too');
  assert.deepEqual(M.validate('payments', { ...M.blank.payments(), contractCode: 'T1', period: '2025-01', amount: 1 }), [], 'no state: current year ± 1');
});

test('[38] editing a unit whose label is already duplicated in the file is allowed with { allowDupLabel }, a new duplicate is still refused', () => {
  const M = load({ today: TODAY }).M;
  const st = M.emptyState();
  st.units.push({ ...M.blank.units(), code: 'P01-S1', projectCode: 'P01', label: 'محل', type: 'commercial' }, { ...M.blank.units(), code: 'P01-S2', projectCode: 'P01', label: 'محل', type: 'commercial' });
  const edit = { ...st.units[1], notes: 'تعديل' };
  assert.deepEqual(M.validate('units', edit, st), ['توجد وحدة بنفس الرقم في هذا المشروع']);
  assert.deepEqual(M.validate('units', edit, st, { allowDupLabel: true }), []);
  assert.deepEqual(M.validate('units', { ...M.blank.units(), code: 'P01-S3', projectCode: 'P01', label: 'محل', type: 'commercial' }, st, {}), ['توجد وحدة بنفس الرقم في هذا المشروع']);
});

/* ---------------- store.js ---------------- */
test('[54] replaying the journal does not duplicate audit (login) rows, across a workbook round trip and a second replay', async () => {
  const E = load({ today: TODAY });
  const { state } = await E.Workbook.read(readFile(SOURCE)); E.Store.load(state);
  await E.Auth.createUser({ code: 'admin', name: 'المدير', role: 'admin' }, 'admin@2026');
  const pending = []; E.Store.setRecorder(op => pending.push(JSON.parse(JSON.stringify(op))));
  await E.Auth.login('admin', 'admin@2026');
  E.Store.upsert('projects', { ...E.M.blank.projects(), code: E.Codes.nextProject(state), name: 'مشروع' }, 'x');
  assert.deepEqual(pending.map(o => o.type), ['audit', 'upsert']);
  const buf = await E.Workbook.write(state);
  const E2 = load({ today: TODAY }); const r2 = await E2.Workbook.read(buf); E2.Store.load(r2.state);
  const loginRows = () => r2.state.audit.filter(a => a.action === 'دخول' && a.code === 'admin').length;
  assert.equal(loginRows(), 1);
  E2.Store.applyOps(pending); E2.Store.applyOps(pending);
  assert.equal(loginRows(), 1, 'the audit op is idempotent');
  assert.equal(r2.state.projects.filter(p => p.name === 'مشروع').length, 1);
  // التسجيل المباشر (لا الإعادة) لا يُسقط سطرًا متطابقًا في نفس الثانية
  const n = r2.state.audit.length;
  E2.Store.log({ action: 'دخول', entity: 'مستخدم', code: 'admin', summary: 'المدير' }); E2.Store.log({ action: 'دخول', entity: 'مستخدم', code: 'admin', summary: 'المدير' });
  assert.equal(r2.state.audit.length, n + 2, 'only the replay deduplicates, live logging never drops a row');
});

test('[1]/[8] a journal edit written by the previous version (isNew:false, no op.changed) that moved a payment\'s month is not a code collision: replaced in place, no duplicate', async () => {
  const E = load({ today: TODAY });
  const { state } = await E.Workbook.read(readFile(SOURCE)); E.Store.load(state);
  const p = state.payments.find(x => E.U.toNum(x.amount) > 0 && x.period === '2026-03');
  const op = E.Store.upsert('payments', { ...p, period: '2026-09' }, 'نقل الشهر');
  const legacy = JSON.parse(JSON.stringify(op)); delete legacy.changed; // دفتر محفوظ قبل هذا الإصدار
  assert.equal(legacy.isNew, false);
  const E2 = load({ today: TODAY }); const r2 = await E2.Workbook.read(readFile(SOURCE)); E2.Store.load(r2.state);
  const n = r2.state.payments.length;
  E2.Store.applyOps([legacy]);
  assert.equal(r2.state.payments.length, n, 'no duplicate payment');
  assert.deepEqual(r2.state.payments.filter(x => x.code === p.code).map(x => x.period + ':' + x.amount), ['2026-09:' + p.amount]);
  assert.deepEqual(E2.Store.replayReport().recoded, []);
});

test('[1] client identity: a pending client without a national ID is the same client once the office completes the ID in Excel (no fork); a different name with the same code is a collision whose contracts follow the re-coded client', async () => {
  const E = load({ today: TODAY });
  const { state } = await E.Workbook.read(readFile(SOURCE)); E.Store.load(state);
  const code = E.Codes.nextClient(state);
  const op = E.Store.upsert('clients', { ...E.M.blank.clients(), code, name: 'شركة النور الجديدة', phone: '01000000000' }, 'عميل');
  const journal = JSON.parse(JSON.stringify([op]));
  const E2 = load({ today: TODAY }); const r2 = await E2.Workbook.read(readFile(SOURCE));
  r2.state.clients.push({ ...E2.M.blank.clients(), code, name: 'شركه النور الجديده', nationalId: '29001011234567' }); E2.Store.load(r2.state);
  const n = r2.state.clients.length; E2.Store.applyOps(journal);
  assert.equal(r2.state.clients.length, n, 'same client (name matches, ID only on one side) — not forked');
  assert.deepEqual(E2.Store.replayReport().recoded, []);
  assert.equal(E2.Store.client(code).phone, '01000000000');
  const E3 = load({ today: TODAY }); const r3 = await E3.Workbook.read(readFile(SOURCE));
  r3.state.clients.push({ ...E3.M.blank.clients(), code, name: 'عميل آخر تمامًا' });
  r3.state.contracts.push({ ...E3.M.blank.contracts(), code: E3.Codes.nextContract(r3.state), unitCode: r3.state.units[0].code, clientCode: code, start: '2031-01-01', end: '2031-12-31', rent: 1 });
  E3.Store.load(r3.state);
  E3.Store.applyOps(journal);
  const rep = E3.Store.replayReport(); assert.equal(rep.recoded.length, 1); assert.equal(rep.recoded[0].entity, 'clients');
  assert.equal(E3.Store.client(code).name, 'شركة النور الجديدة');
  const other = E3.Store.client(rep.recoded[0].to); assert.equal(other.name, 'عميل آخر تمامًا');
  assert.equal(E3.Store.contractsOfClient(other.code).length, 1, 'the Excel contract follows the re-coded client');
  assert.equal(E3.Store.contractsOfClient(code).length, 0);
});

test('[21] audit timestamps are the local wall clock (U.stamp), not UTC', () => {
  const prevTZ = process.env.TZ; process.env.TZ = 'Africa/Cairo'; // ساعة المكتب (UTC+2/+3) — على جهاز UTC كان الاختبار يمر بالصيغة وحدها
  try {
    const E = load({ today: TODAY }); const S = E.Store, U = E.U;
    S.load(E.M.emptyState());
    const before = new Date();
    assert.notEqual(before.getTimezoneOffset(), 0, 'the test runs in a non-UTC zone');
    S.upsert('projects', { ...E.M.blank.projects(), code: 'P01', name: 'x' }, 'إضافة');
    const lg = S.log({ action: 'دخول', entity: 'مستخدم', code: 'u', summary: 's' });
    const after = new Date();
    for (const at of [S.state().audit[1].at, S.state().audit[0].at, lg.record.at]) {
      assert.match(at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      assert.ok(at >= U.stamp(before) && at <= U.stamp(after), `${at} within [${U.stamp(before)}, ${U.stamp(after)}]`);
      assert.notEqual(at.slice(11, 13), before.toISOString().slice(11, 13), 'hour is local, not UTC');
    }
    assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(lg.at), 'op.at stays ISO for ordering');
  } finally { if (prevTZ === undefined) delete process.env.TZ; else process.env.TZ = prevTZ; }
});

test('[8] an edit op carries op.changed; on replay only those fields are merged, so an Excel edit of another field survives (journal JSON round trip)', async () => {
  const E = load({ today: TODAY });
  const { state } = await E.Workbook.read(readFile(SOURCE)); E.Store.load(state);
  const p = state.payments.find(x => E.U.toNum(x.amount) > 0);
  const op = E.Store.upsert('payments', { ...p, amount: E.U.toNum(p.amount) + 1 }, 'تعديل مبلغ');
  assert.deepEqual(op.changed, ['amount']);
  assert.equal(op.isNew, false);
  const create = E.Store.upsert('projects', { ...E.M.blank.projects(), code: E.Codes.nextProject(state), name: 'جديد' }, 'x');
  assert.equal(create.changed, undefined, 'a creation has no changed list');
  const journal = JSON.parse(JSON.stringify([op, create]));
  assert.deepEqual(journal[0].changed, ['amount']); assert.ok(!('changed' in journal[1]));
  // إعادة قراءة الملف: المكتب كتب ملاحظة على نفس الدفعة في الإكسيل (المبلغ القديم ما زال في الملف)
  const E2 = load({ today: TODAY }); const r2 = await E2.Workbook.read(readFile(SOURCE));
  const p2 = r2.state.payments.find(x => x.code === p.code); p2.notes = 'ملاحظة من الإكسيل'; p2.ref = 'إيصال 9';
  E2.Store.load(r2.state);
  assert.equal(E2.Store.applyOps(journal), 2);
  const after = E2.Store.get('payments', p.code);
  assert.equal(E2.U.toNum(after.amount), E2.U.toNum(p.amount) + 1, 'the website amount is applied');
  assert.equal(after.notes, 'ملاحظة من الإكسيل'); assert.equal(after.ref, 'إيصال 9');
  assert.equal(E2.Store.replayReport().merged, 1);
  // السجل الذي اختفى من الملف يُعاد كاملًا
  const E3 = load({ today: TODAY }); const r3 = await E3.Workbook.read(readFile(SOURCE)); r3.state.payments = r3.state.payments.filter(x => x.code !== p.code); E3.Store.load(r3.state);
  E3.Store.applyOps(journal);
  assert.equal(E3.U.toNum(E3.Store.get('payments', p.code).amount), E3.U.toNum(p.amount) + 1);
  // التطبيق المباشر (غير الإعادة) يبقى بكامل السجل
  const E4 = load({ today: TODAY }); const r4 = await E4.Workbook.read(readFile(SOURCE)); E4.Store.load(r4.state);
  E4.Store.get('payments', p.code).notes = 'ستُستبدل';
  E4.Store.applyOp(journal[0]);
  assert.equal(E4.Store.get('payments', p.code).notes, p.notes || '');
});

test('[1] replay collision: a journal creation whose code was meanwhile issued by Excel to a different record re-codes the Excel record and keeps both (Store level, state read from a workbook)', async () => {
  const E = load({ today: TODAY });
  const { state } = await E.Workbook.read(readFile(SOURCE)); E.Store.load(state);
  const [a, b] = state.contracts.filter(c => c.end >= '2026-12-31');
  const code = E.Codes.nextInvoice(state, '2026');
  const op = E.Store.upsert('payments', { ...E.M.blank.payments(), code, contractCode: a.code, period: '2026-12', amount: 41000, paidOn: '2026-12-03' }, 'دفعة');
  const journal = JSON.parse(JSON.stringify([op]));
  // الملف أُعيدت قراءته: المكتب كتب مبلغ ديسمبر للعقد الآخر فأخذ نفس الكود
  const E2 = load({ today: TODAY }); const r2 = await E2.Workbook.read(readFile(SOURCE));
  r2.state.payments.push({ ...E2.M.blank.payments(), code: E2.Codes.nextInvoice(r2.state, '2026'), contractCode: b.code, period: '2026-12', amount: 76000, source: 'excel' });
  assert.equal(r2.state.payments[r2.state.payments.length - 1].code, code, 'same code issued twice');
  E2.Store.load(r2.state);
  const auditBefore = r2.state.audit.length;
  E2.Store.applyOps(journal);
  const web = E2.Store.paymentsOfCell(a.code, '2026-12'), excel = E2.Store.paymentsOfCell(b.code, '2026-12');
  assert.equal(web.length, 1); assert.equal(web[0].code, code); assert.equal(web[0].amount, 41000);
  assert.equal(excel.length, 1, 'the Excel payment is kept'); assert.notEqual(excel[0].code, code); assert.equal(excel[0].amount, 76000);
  assert.equal(new Set(r2.state.payments.map(p => E2.U.foldCode(p.code))).size, r2.state.payments.length, 'codes stay unique');
  const rep = E2.Store.replayReport();
  assert.deepEqual(rep.recoded, [{ entity: 'payments', from: code, to: excel[0].code, kept: code }]);
  assert.equal(r2.state.audit.length, auditBefore + 1); assert.match(r2.state.audit[0].summary, /تعارض أكواد/);
  assert.ok(E2.Codes.nextInvoice(r2.state, '2026') > excel[0].code, 'the counter moved past the new code');
  // الإعادة مرة ثانية لا تغيّر شيئًا
  const snap = JSON.stringify(r2.state.payments); E2.Store.applyOps(journal); assert.equal(JSON.stringify(r2.state.payments), snap);
  // نفس الهوية (نفس العقد والشهر) ⇒ العملية تكسب كما قبل
  const E3 = load({ today: TODAY }); const r3 = await E3.Workbook.read(readFile(SOURCE));
  r3.state.payments.push({ ...E3.M.blank.payments(), code, contractCode: a.code, period: '2026-12', amount: 999, source: 'excel' }); E3.Store.load(r3.state);
  E3.Store.applyOps(journal);
  assert.deepEqual(E3.Store.paymentsOfCell(a.code, '2026-12').map(p => p.code + ':' + p.amount), [code + ':41000']);
  assert.deepEqual(E3.Store.replayReport().recoded, []);
});

test('[1] replay collision on a contract re-codes the Excel contract and moves its payments with it', async () => {
  const E = load({ today: TODAY });
  const { state } = await E.Workbook.read(readFile(SOURCE)); E.Store.load(state);
  const u1 = state.units[0], u2 = state.units[1], cl = state.clients[0];
  const code = E.Codes.nextContract(state);
  const op = E.Store.upsert('contracts', { ...E.M.blank.contracts(), code, unitCode: u1.code, clientCode: cl.code, start: '2031-01-01', end: '2031-12-31', rent: 1000 }, 'عقد');
  const journal = JSON.parse(JSON.stringify([op]));
  const E2 = load({ today: TODAY }); const r2 = await E2.Workbook.read(readFile(SOURCE));
  r2.state.contracts.push({ ...E2.M.blank.contracts(), code, unitCode: u2.code, clientCode: cl.code, start: '2031-01-01', end: '2031-12-31', rent: 500 });
  r2.state.payments.push({ ...E2.M.blank.payments(), code: E2.Codes.nextInvoice(r2.state, '2031'), contractCode: code, period: '2031-01', amount: 500, source: 'excel' });
  E2.Store.load(r2.state);
  E2.Store.applyOps(journal);
  const web = E2.Store.contract(code); assert.equal(web.unitCode, u1.code); assert.equal(web.rent, 1000);
  const moved = r2.state.contracts.find(c => c.unitCode === u2.code && c.start === '2031-01-01');
  assert.ok(moved && moved.code !== code, 'the Excel contract got a new code');
  assert.equal(E2.Store.paymentsOf(moved.code).length, 1, 'its payment follows the new code');
  assert.equal(E2.Store.paymentsOf(code).length, 0);
});

test('[1] end to end through Sync: payment recorded while Excel is locked + the office typing the same month for another tenant → both land in the file', async (t) => {
  const E = load({ today: TODAY });
  t.after(() => E.Sync.stopPolling());
  let lastBytes = null;
  E.Sync.init({
    serialize: async () => { const b = await E.Workbook.write(E.Store.state(), { base: lastBytes }); lastBytes = b; return b; },
    deserialize: async (buf) => { const r = await E.Workbook.read(buf, { snapshot: null }); lastBytes = buf; E.Store.load(r.state); },
    applyOps: ops => E.Store.applyOps(ops),
    pollMs: 40, debounceMs: 0, retryMs: 3000, settleMs: 10,
  });
  E.Store.setRecorder(op => E.Sync.record(op));
  const original = readFile(DEMO);
  const edit = async (bytes, code, period, value) => { // المكتب يكتب مبلغًا في خلية ورقة السنة
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(bytes);
    const ws = wb.getWorksheet(period.slice(0, 4));
    let rowN = 0; ws.eachRow((rw, n) => { if (String(rw.getCell(25).value) === code) rowN = n; });
    assert.ok(rowN, 'ledger row for ' + code);
    ws.getRow(rowN).getCell(10 + parseInt(period.slice(5), 10)).value = value;
    const out = await wb.xlsx.writeBuffer(); return out instanceof ArrayBuffer ? out : new Uint8Array(out).buffer.slice(out.byteOffset || 0, (out.byteOffset || 0) + out.byteLength);
  };
  const edited = await edit(original, 'T0005', '2026-11', 76000);
  const a = E.FileLink.memoryAdapter(original, 'Egary.xlsx');
  await E.Sync.link(a, { writeOnLink: false });
  a.locked = true;
  const code = E.Codes.nextInvoice(E.Store.state(), '2026');
  E.Store.upsert('payments', Object.assign(E.M.blank.payments(), { code, contractCode: 'T0003', period: '2026-11', amount: 41000, paidOn: '2026-11-03', method: 'cash' }), 'دفعة نوفمبر');
  assert.ok(await until(() => E.Sync.status.state === 'locked', 5000), 'locked');
  a.externalWrite(edited); a.locked = false;
  assert.ok(await until(() => E.Sync.status.state === 'linked' && E.Sync.status.pending === 0 && a.writes >= 1, 15000), 'synced: ' + JSON.stringify(E.Sync.status));
  const web = E.Store.paymentsOfCell('T0003', '2026-11'), excel = E.Store.paymentsOfCell('T0005', '2026-11');
  assert.deepEqual(web.map(p => p.code + ':' + p.amount), [code + ':41000']);
  assert.equal(excel.length, 1); assert.equal(excel[0].amount, 76000); assert.notEqual(excel[0].code, code);
  const E2 = load({ today: TODAY }); const r2 = await E2.Workbook.read(a.bytes()); E2.Store.load(r2.state);
  assert.deepEqual(E2.Store.paymentsOfCell('T0003', '2026-11').map(p => p.amount), [41000], 'website payment in the file');
  assert.deepEqual(E2.Store.paymentsOfCell('T0005', '2026-11').map(p => p.amount), [76000], 'office payment in the file');
  assert.ok(r2.state.audit.some(x => /تعارض أكواد/.test(x.summary)), 'the collision is logged in the audit sheet');
});

/* ---------------- engine.js ---------------- */
test('[25] enteredThrough follows in-place edits (payment period / contract end) without a reload', () => {
  const b = boot(); const E = b.E, En = E.Engine, S = E.Store, U = E.U;
  const cs = []; for (let i = 0; i < 4; i++) cs.push(b.contract({ start: '2026-01-01', end: '2026-12-31', rent: 1000 }));
  for (const c of cs) for (const p of U.periods('2026-01', '2026-08')) b.pay(c.code, p, 1000);
  const sep = b.pay(cs[0].code, '2026-09', 1000);
  b.commit();
  assert.equal(En.enteredThrough(), '2026-09');
  assert.deepEqual(cs.map(c => En.cell(c, '2026-09').status), ['paid', 'late', 'late', 'late']);
  S.upsert('payments', { ...sep, period: '2026-08' }, 'تصحيح الشهر'); // نفس عدد السجلات
  assert.equal(En.enteredThrough(), '2026-08');
  assert.deepEqual(cs.map(c => En.cell(c, '2026-09').status), ['pending', 'pending', 'pending', 'pending']);
  assert.equal(En.kpis({}).arrears.total, 0);
  // تقصير عقد (العدد ثابت أيضًا)
  const b2 = boot(); const E2 = b2.E;
  const a = b2.contract({ start: '2026-01-01', end: '2026-12-31', rent: 1000 }), z = b2.contract({ start: '2026-01-01', end: '2026-12-31', rent: 1000 });
  for (const p of E2.U.periods('2026-01', '2026-09')) b2.pay(a.code, p, 1000);
  for (const p of E2.U.periods('2026-01', '2026-06')) b2.pay(z.code, p, 1000);
  b2.commit();
  assert.equal(E2.Engine.enteredThrough(), '2026-09'); assert.equal(E2.Engine.cell(z, '2026-07').status, 'late');
  E2.Store.upsert('contracts', { ...a, end: '2026-06-30' }, 'تقصير');
  assert.equal(E2.Engine.enteredThrough(), '2026-06'); assert.equal(E2.Engine.cell(z, '2026-07').status, 'pending');
  // سلايسر «المحاسبة من» + تعديل إعداد في مكانه: الإعدادات المركّبة لا تبقى قديمة
  E2.Engine.setOverride({ trackingFrom: '2026-03' });
  assert.equal(E2.Engine.trackingFrom(), '2026-03');
  assert.equal(E2.Engine.tolerance(1000), 50);
  E2.Store.applyOp({ type: 'settings', record: { toleranceMin: 200 } });
  assert.equal(E2.Engine.tolerance(1000), 200, 'a settings change is seen while the slicer override is active');
  E2.Store.applyOp({ type: 'settings', record: { enteredThrough: '2026-05' } });
  assert.equal(E2.Engine.enteredThrough(), '2026-05', 'a manual enteredThrough set after the override is honoured');
  E2.Engine.setOverride(null);
});

test('[26] an old-law contract older than 60 years is still charged and counted', () => {
  const b = boot(); const En = b.E.Engine;
  const c = b.contract({ start: '1965-03-01', end: '2032-02-29', rent: 250, increasePct: 0 });
  const c2 = b.contract({ start: '1968-01-01', end: '2027-12-31', rent: 250, increasePct: 0 });
  b.commit();
  assert.equal(En.schedule(c).length, 67);
  assert.deepEqual(En.schedule(c).slice(-1)[0], { k: 67, from: '2031-03-01', to: '2032-02-29', rent: 250 });
  assert.deepEqual(En.dueForMonth(c, '2026-10'), { amount: 250, days: 31, full: true });
  assert.equal(En.cell(c, '2026-10').status, 'late');
  assert.equal(En.currentRent(c), 250);
  assert.deepEqual(En.dueForMonth(c2, '2026-10'), { amount: 250, days: 31, full: true });
  const k = En.kpis({});
  assert.equal(k.month.due, 500); assert.equal(k.monthlyRentRoll, 500); assert.equal(k.activeContracts.length, 2);
  assert.equal(En.schedule({ start: '1600-01-01', end: '2100-01-01', rent: 1 }).length, 400, 'hard bound stops a runaway loop');
});

test('[27] 30-day proration: a contract starting on the 31st is charged one day, not zero; other months are unchanged', () => {
  const b = boot(); const En = b.E.Engine, U = b.E.U;
  const c31 = b.contract({ start: '2026-01-31', end: '2027-01-30', rent: 3000 });
  const c30 = b.contract({ start: '2026-01-30', end: '2027-01-29', rent: 3000 });
  const c16 = b.contract({ start: '2026-01-16', end: '2027-01-15', rent: 3000 });
  const one31 = b.contract({ start: '2026-03-31', end: '2026-03-31', rent: 3000 });
  const cApr30 = b.contract({ start: '2026-04-30', end: '2027-04-29', rent: 3000 });
  const cFeb28 = b.contract({ start: '2026-02-28', end: '2027-02-27', rent: 3000 });
  const mid = b.contract({ start: '2026-01-01', end: '2026-03-15', rent: 3000 });
  const c31y2 = b.contract({ start: '2026-01-31', end: '2028-01-30', rent: 3000 });
  const c31inc = b.contract({ start: '2026-05-31', end: '2028-05-30', rent: 3000, increasePct: 10 });
  b.commit();
  assert.deepEqual(En.dueForMonth(c31, '2026-01'), { amount: 100, days: 1, full: false });
  assert.equal(En.dueForMonth(c31, '2027-01').amount, 3000, 'the last month (1–30 Jan) is a full 30/30');
  assert.equal(U.sum([...U.periods('2026-01', '2027-01')], p => (En.dueForMonth(c31, p) || { amount: 0 }).amount), 36100);
  // ذكرى العقد: الأيام 1–30 سنة أولى (شهر كامل) + يوم 31 سنة ثانية ⇒ شهر واحد لا 31/30
  assert.deepEqual(En.dueForMonth(c31y2, '2027-01'), { amount: 3000, days: 31, full: true }, 'anniversary month of a 31st-start contract is one month, not 31/30');
  assert.equal(En.dueForMonth(c31y2, '2028-01').amount, 3000);
  assert.equal(U.sum([...U.periods('2026-01', '2028-01')], p => (En.dueForMonth(c31y2, p) || { amount: 0 }).amount), 72100, 'two years = 24 months + the first day only');
  assert.equal(En.dueForMonth(c31inc, '2027-05').amount, 3000, 'anniversary month keeps the first-year rent (the 31st does not add 1/30 of the raised rent)');
  assert.equal(En.dueForMonth(c31inc, '2027-06').amount, 3300);
  assert.deepEqual(En.dueForMonth(c31inc, '2026-05'), { amount: 100, days: 1, full: false });
  assert.deepEqual(En.dueForMonth(c30, '2026-01'), { amount: 100, days: 2, full: false });
  assert.equal(En.dueForMonth(c16, '2026-01').amount, 1500);
  assert.deepEqual(En.dueForMonth(one31, '2026-03'), { amount: 100, days: 1, full: false });
  assert.equal(En.dueForMonth(cApr30, '2026-04').amount, 100);
  assert.equal(En.dueForMonth(cFeb28, '2026-02').amount, 300, 'office convention for a 28-day month unchanged');
  assert.equal(En.dueForMonth(mid, '2026-03').amount, 1500);
  assert.equal(En.dueForMonth(mid, '2026-02').amount, 3000);
  assert.notEqual(En.cell(c31, '2026-01').status, 'paid', 'a zero due no longer shows the month as paid');
});

test('[28] orphan payments count in the month header collected (header = drawer footer = YTD)', () => {
  const b = boot({ enteredThrough: '2026-10' }); const En = b.E.Engine, U = b.E.U;
  const c = b.contract({ start: '2026-01-01', end: '2026-12-31', rent: 1000 });
  const ended = b.contract({ start: '2025-05-01', end: '2026-04-30', rent: 2000 });
  for (const p of U.periods('2026-01', '2026-10')) b.pay(c.code, p, 1000);
  for (const p of U.periods('2026-01', '2026-04')) b.pay(ended.code, p, 2000);
  b.pay(ended.code, '2026-05', 2000); // خارج مدة العقد
  b.commit();
  const m = En.monthTotals(En.scope({}), '2026-05');
  assert.equal(m.due, 1000); assert.equal(m.collected, 3000); assert.equal(m.orphanPaid, 2000);
  assert.equal(U.sum(m.rows, r => r.paid), m.collected);
  const k = En.kpis({});
  assert.equal(k.ytd.collected, 20000);
  assert.equal(U.sum(k.trend.filter(t => t.period >= '2026-01'), t => t.collected), 20000);
  assert.equal(En.ledger(2026, {}).total, 20000);
});

test('[29] the over-payment warning is emitted once per month, however many payments the cell holds', () => {
  const b = boot(); const En = b.E.Engine;
  const c = b.contract({ start: '2026-01-01', end: '2026-12-31', rent: 1000 });
  b.pay(c.code, '2026-03', 800); b.pay(c.code, '2026-03', 800); b.pay(c.code, '2026-03', 300);
  b.pay(c.code, '2026-04', 2000);
  b.commit();
  const over = En.dataQuality().filter(f => /أعلى من المستحق/.test(f.text));
  assert.equal(over.length, 2);
  assert.ok(over.some(f => /مارس 2026/.test(f.text)) && over.some(f => /أبريل 2026/.test(f.text)));
});

test('[31] maintenance stats follow the report year in kpis and expose the year used; direct callers keep today\'s year', () => {
  const b = boot({ enteredThrough: '2026-10' }); const En = b.E.Engine;
  const u = b.unit(); const c = b.contract({ unitCode: u.code, start: '2025-01-01', end: '2026-12-31', rent: 1000 });
  b.maint({ unitCode: u.code, date: '2025-06-01', cost: 700, status: 'closed' });
  b.maint({ unitCode: u.code, date: '2026-02-01', cost: 300, status: 'open' });
  b.pay(c.code, '2025-06', 1000); b.pay(c.code, '2026-01', 1000);
  b.commit();
  const k26 = En.kpis({ period: '2026-03' });
  assert.equal(k26.reportYear, '2026'); assert.equal(k26.maintenance.year, '2026'); assert.equal(k26.maintenance.costYtd, 300);
  const k25 = En.kpis({ period: '2025-06' });
  assert.equal(k25.reportYear, '2025'); assert.equal(k25.maintenance.year, '2025'); assert.equal(k25.maintenance.costYtd, 700); assert.equal(k25.maintenance.byBorne.owner, 700);
  assert.equal(k25.maintenance.open.length, 1, 'open requests are not year-bound');
  const direct = En.maintenanceStats(En.scope({}));
  assert.equal(direct.year, '2026'); assert.equal(direct.costYtd, 300);
  assert.equal(En.maintenanceStats(En.scope({}), undefined, 2025).costYtd, 700);
});

test('dataQuality flags maintenance rows pointing at a missing unit and contracts with a missing/invalid start or end date', () => {
  const b = boot(); const En = b.E.Engine;
  const good = b.contract({ start: '2026-01-01', end: '2026-12-31', rent: 1000 });
  const noEnd = b.contract({ start: '2026-01-01', end: '', rent: 1000 });
  const badStart = b.contract({ start: '2026-02-30', end: '2026-12-31', rent: 1000 });
  b.maint({ unitCode: good.unitCode });
  const orphan = b.maint({ unitCode: 'P01-999' });
  b.commit();
  const dq = En.dataQuality();
  const mf = dq.filter(f => f.entity === 'maintenance');
  assert.deepEqual(mf.map(f => [f.sev, f.code]), [['danger', orphan.code]]);
  assert.match(mf[0].text, /^صيانة M0002 تشير إلى وحدة غير موجودة/);
  const cf = dq.filter(f => f.entity === 'contracts' && /مفقود أو غير صحيح/.test(f.text));
  assert.deepEqual(cf.map(f => f.code).sort(), [noEnd.code, badStart.code].sort());
  assert.ok(cf.every(f => f.sev === 'danger'));
  assert.ok(!dq.some(f => f.code === good.code && f.sev === 'danger'));
});

/* ---------------- auth.js ---------------- */
test('[55] a successful login stamps lastLogin on the user record (and it reaches the users sheet); a refused login does not', async () => {
  const E = load({ today: TODAY });
  const { state } = await E.Workbook.read(readFile(SOURCE)); E.Store.load(state);
  await E.Auth.createUser({ code: 'admin', name: 'المدير', role: 'admin' }, 'admin@2026');
  assert.equal(E.Auth.find('admin').lastLogin, '');
  const bad = await E.Auth.login('admin', 'wrong'); assert.equal(bad.ok, false); assert.equal(E.Auth.find('admin').lastLogin, '');
  const auditLen = state.audit.length;
  const before = E.U.stamp();
  const ok = await E.Auth.login('admin', 'admin@2026'); assert.equal(ok.ok, true);
  const ll = E.Auth.find('admin').lastLogin;
  assert.match(ll, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/); assert.ok(ll >= before && ll <= E.U.stamp());
  assert.equal(state.audit.length, auditLen + 1, 'only the login row, no extra edit row');
  const buf = await E.Workbook.write(state);
  const E2 = load({ today: TODAY }); const r2 = await E2.Workbook.read(buf);
  assert.equal(r2.state.users.find(u => u.code === 'admin').lastLogin, ll);
});
