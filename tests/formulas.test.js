// معادلات الإكسيل تحت إعادة حساب كاملة في LibreOffice (المُحكِّم المستقل):
// النتيجة المخزَّنة في كل خلية معادلة = ما يحسبه الإكسيل فعلًا، لا خلية خطأ في أي ورقة (حتى الفارغة)، وسيناريوهات تعديل المكتب.
// يُتخطَّى كله برسالة واضحة عندما لا يكون /usr/bin/soffice مثبَّتًا.
// مهم: LibreOffice الافتراضي يعيد حساب سلاسل TODAY() فقط ويثق بباقي القيم المخزَّنة — لذا نفرض إعادة حساب كاملة عبر ملف تعريف خاص (OOXMLRecalcMode=0).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { load, readFile, SOURCE } = require('./helpers/env');
const SOFFICE = '/usr/bin/soffice';
const SKIP = fs.existsSync(SOFFICE) ? false : 'LibreOffice غير مثبَّت (/usr/bin/soffice) — تُتخطَّى اختبارات إعادة الحساب الكاملة';
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const py = (script, ...args) => JSON.parse(execFileSync('python3', ['-I', '-c', script, ...args], { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 }));
const toAB = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const save = (name, buf) => { const f = path.join(OUT, name); fs.writeFileSync(f, Buffer.from(buf)); return f; };
const XCU = `<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="OOXMLRecalcMode" oor:op="fuse"><value>0</value></prop></item>
<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="ODFRecalcMode" oor:op="fuse"><value>0</value></prop></item>
<item oor:path="/org.openoffice.Office.Common/Misc"><prop oor:name="FirstRun" oor:op="fuse"><value>false</value></prop></item>
</oor:items>
`;
/* إعادة حساب كاملة: ملف تعريف خاص بهذه العملية (حتى لا تتصادم عمليتان) ثم تحويل xlsx → xlsx */
function recalc(file) {
  const prof = path.join(OUT, 'lo-profile-' + process.pid); fs.mkdirSync(path.join(prof, 'user'), { recursive: true });
  fs.writeFileSync(path.join(prof, 'user', 'registrymodifications.xcu'), XCU);
  const outDir = path.join(OUT, 'lo-recalc'); fs.mkdirSync(outDir, { recursive: true });
  const t0 = Date.now();
  execFileSync(SOFFICE, ['-env:UserInstallation=file://' + prof, '--headless', '--norestore', '--convert-to', 'xlsx', '--outdir', outDir, file], { stdio: 'pipe', timeout: 300000 });
  const out = path.join(outDir, path.basename(file)); assert.ok(fs.existsSync(out), 'LibreOffice produced ' + out);
  return { file: out, ms: Date.now() - t0 };
}
/* مقارنة كل خلية معادلة: النتيجة المخزَّنة (openpyxl data_only على الملف الأصلي) مع المعاد حسابها (LibreOffice) — المال ± 0.011، النص والتواريخ والأعداد بالضبط؛ وأي خلية تبدأ بـ# في أي ورقة خطأ */
const PY_COMPARE = `
import sys, json, datetime, openpyxl
A = openpyxl.load_workbook(sys.argv[1]); C = openpyxl.load_workbook(sys.argv[1], data_only=True); R = openpyxl.load_workbook(sys.argv[2], data_only=True)
def norm(v):
    if v is None: return ''
    if isinstance(v, datetime.datetime): return v.date().isoformat()
    if isinstance(v, datetime.date): return v.isoformat()
    if isinstance(v, bool): return v
    if isinstance(v, float) and abs(v - round(v)) < 1e-9: return int(round(v))
    if isinstance(v, (int, float)): return round(v, 2)
    return v
def near(a, b):
    if isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool) and not isinstance(b, bool): return abs(a - b) < 0.011
    return a == b
n = 0; bad = []; errs = []; bounded = []
for ws in A.worksheets:
    for row in ws.iter_rows():
        for c in row:
            rv = R[ws.title][c.coordinate].value
            if isinstance(rv, str) and rv.startswith('#'): errs.append((ws.title, c.coordinate, rv))
            if isinstance(c.value, str) and c.value.startswith('='):
                n += 1; cv = norm(C[ws.title][c.coordinate].value); rvn = norm(rv)
                if not near(cv, rvn): bad.append((ws.title, c.coordinate, cv, rvn, c.value[:90]))
                if 'SUMPRODUCT' in c.value:
                    import re
                    for m in re.finditer(r'\\$2:\\$[A-Z]+\\$(\\d+)', c.value): bounded.append(int(m.group(1)))
print(json.dumps({'formulas': n, 'mismatches': len(bad), 'errors': len(errs), 'sample': bad[:20], 'errsample': errs[:10], 'minBound': min(bounded) if bounded else None}, ensure_ascii=False, default=str))
`;
const compare = (orig, rec) => py(PY_COMPARE, orig, rec);
/* قيمة خلية (معاد حسابها) من ملف LibreOffice بالعنوان والكود */
const PY_CELLS = `
import sys, json, datetime, openpyxl
wb = openpyxl.load_workbook(sys.argv[1], data_only=True); out = []
for q in json.loads(sys.argv[2]):
    ws = wb[q['sheet']]; hr = 2 if q['sheet'].isdigit() else 1
    h = {str(c.value).strip(): c.column for c in ws[hr] if c.value}
    r = next((r for r in range(hr + 1, ws.max_row + 1) if str(ws.cell(r, h[q['key']]).value) == q['code']), None)
    v = ws.cell(r, h[q['col']]).value if r else '__norow__'
    if isinstance(v, datetime.datetime): v = v.date().isoformat()
    out.append('' if v is None else v)
print(json.dumps(out, ensure_ascii=False, default=str))
`;
const cells = (file, queries) => py(PY_CELLS, file, JSON.stringify(queries));
async function demoState(E) { const { state } = await E.Workbook.read(readFile(SOURCE)); E.Store.load(state); return state; }
/* نفس الحالة الحدّية في tests/fix-excel-layout.test.js (بتاريخ اليوم الحقيقي هنا حتى تطابق TODAY()) */
function edgeState(E) {
  const M = E.M, B = M.blank; const st = M.emptyState();
  st.projects.push(Object.assign(B.projects(), { code: 'P01', name: 'برج الاختبار' })); st.projects.push(Object.assign(B.projects(), { code: 'P02', name: 'مشروع بلا وحدات' }));
  for (const u of ['U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U8', 'U9']) st.units.push(Object.assign(B.units(), { code: 'P01-' + u, projectCode: 'P01', label: u, type: 'commercial', createdAt: '2025-01-01' }));
  st.clients.push(Object.assign(B.clients(), { code: 'C001', name: 'عميل أ' })); st.clients.push(Object.assign(B.clients(), { code: 'C002', name: 'عميل بلا عقود' }));
  const K = (code, unit, start, end, rent, pct, ov, extra) => st.contracts.push(Object.assign(B.contracts(), { code, unitCode: 'P01-' + unit, clientCode: 'C001', start, end, rent, increasePct: pct, rentOverrides: ov || {}, dueDay: 1 }, extra || {}));
  K('T0001', 'U1', '2024-02-29', '2028-02-28', 1000, 10); K('T0002', 'U2', '2026-12-01', '2027-11-30', 5000, 10); K('T0003', 'U3', '2025-01-01', '2025-12-31', 2000, 0); K('T0004', 'U3', '2026-12-01', '2027-11-30', 2500, 0);
  K('T0005', 'U5', '2024-03-01', '2027-02-28', 76000, 10, { 2: 83600, 3: 91960 }); K('T0006', 'U6', '2026-05-01', '2025-04-30', 3000, 10); K('T0007', 'U7', '2021-06-15', '2026-06-14', 12345, 7.5);
  K('T0008', 'U4', '2025-11-01', '2026-10-31', 4000, 10); K('T0009', 'U4', '2026-11-01', '2027-10-31', 4400, 10, {}, { prevCode: 'T0008' }); K('T0010', 'U8', '2010-01-01', '2030-12-31', 500, 0);
  K('T0011', 'U9', '2024-01-01', '2024-12-31', 900, 0); K('T0012', 'U9', '2022-01-01', '2022-12-31', 800, 0);
  const P = (code, contractCode, period, amount) => st.payments.push(Object.assign(B.payments(), { code, contractCode, period, amount, source: 'web' }));
  P('INV-2026-0001', 'T0005', '2026-09', 91960); P('INV-2026-0002', 'T0005', '2026-08', 91960); P('INV-2026-0003', 'T0001', '2026-08', 1210); P('INV-2026-0004', 'T0010', '2026-01', 500);
  const Mn = (code, unit, date, extra) => st.maintenance.push(Object.assign(B.maintenance(), { code, unitCode: 'P01-' + unit, date, description: code }, extra || {}));
  Mn('M0001', 'U3', '2025-06-15'); Mn('M0002', 'U3', '2026-06-15'); Mn('M0003', 'U5', ''); Mn('M0004', 'U5', '2026-01-10', { custodianContract: 'T0001', custodianName: 'اسم مكتوب' });
  st.settings.ledgerYears = [2026]; st.settings.trackingFrom = '2026-01';
  return st;
}
function bigState(E) {
  const M = E.M, B = M.blank, U = E.U; const st = M.emptyState();
  for (let p = 1; p <= 5; p++) st.projects.push(Object.assign(B.projects(), { code: 'P0' + p, name: 'مشروع ' + p }));
  for (let i = 1; i <= 120; i++) st.units.push(Object.assign(B.units(), { code: 'P0' + (1 + i % 5) + '-' + i, projectCode: 'P0' + (1 + i % 5), label: String(i), type: 'admin', createdAt: '2023-01-01' }));
  for (let i = 1; i <= 100; i++) st.clients.push(Object.assign(B.clients(), { code: 'C' + String(i).padStart(3, '0'), name: 'عميل ' + i }));
  let inv = 0;
  for (let i = 1; i <= 100; i++) {
    const start = U.iso(new Date(Date.UTC(2024, i % 12, 1))), end = U.iso(U.addDays(new Date(Date.UTC(2027, i % 12, 1)), -1));
    st.contracts.push(Object.assign(B.contracts(), { code: 'T' + String(i).padStart(4, '0'), unitCode: st.units[i - 1].code, clientCode: st.clients[i - 1].code, start, end, rent: 1000 + i * 10, increasePct: 10, dueDay: 1 }));
    for (let m = 0; m < 15; m++) { const per = U.addMonths(start.slice(0, 7), m); st.payments.push(Object.assign(B.payments(), { code: 'INV-' + per.slice(0, 4) + '-' + String(++inv).padStart(4, '0'), contractCode: 'T' + String(i).padStart(4, '0'), period: per, amount: 1000 + i * 10, source: 'web' })); }
  }
  st.settings.ledgerYears = [2024, 2025, 2026]; st.settings.trackingFrom = '2024-01';
  return st;
}

test('[A4] demo state (real today, no fake date): every cached result equals the full LibreOffice recalculation and no cell is an error', { skip: SKIP }, async () => {
  const E = load({});
  const st = await demoState(E); st.maintenance.push(Object.assign(E.M.blank.maintenance(), { code: 'M0001', unitCode: 'P01-S1', date: '2026-03-15', description: 'x' }), Object.assign(E.M.blank.maintenance(), { code: 'M0002', unitCode: 'P01-S1', date: '', description: 'y' }));
  const f = save('lo_demo.xlsx', await E.Workbook.write(st));
  const rec = recalc(f); const res = compare(f, rec.file);
  assert.ok(res.formulas > 4000, 'formulas ' + res.formulas);
  assert.deepEqual(res.sample, [], 'cached ≠ recalculated'); assert.equal(res.mismatches, 0);
  assert.deepEqual(res.errsample, [], 'error cells'); assert.equal(res.errors, 0);
});

test('[A4b] edge state (real today): cached == recalculated, no errors, including the leap-day DATEDIF, the override SEARCH chain, the 21-year literal fallback and the SUMPRODUCT lookups', { skip: SKIP }, async () => {
  const E = load({}); const st = edgeState(E); E.Store.load(st);
  const f = save('lo_edge.xlsx', await E.Workbook.write(st));
  const res = compare(f, recalc(f).file);
  assert.ok(res.formulas > 300, 'formulas ' + res.formulas);
  assert.deepEqual(res.sample, [], 'cached ≠ recalculated'); assert.deepEqual(res.errsample, []);
});

test('[A7] empty and partial states never produce an error cell: 0 contracts/payments/maintenance, and 1 contract with 0 payments; SUMPRODUCT ranges are bounded to at least $2:$201', { skip: SKIP }, async () => {
  const E = load({}); const M = E.M, B = M.blank;
  const empty = M.emptyState(); E.Store.load(empty);
  const f0 = save('lo_empty.xlsx', await E.Workbook.write(empty)); const r0 = compare(f0, recalc(f0).file);
  assert.deepEqual(r0.errsample, [], 'empty: errors'); assert.deepEqual(r0.sample, [], 'empty: mismatches');
  const one = M.emptyState(); one.projects.push(Object.assign(B.projects(), { code: 'P01', name: 'مشروع' })); one.units.push(Object.assign(B.units(), { code: 'P01-1', projectCode: 'P01', label: '1', type: 'admin' })); one.clients.push(Object.assign(B.clients(), { code: 'C001', name: 'عميل' }));
  one.contracts.push(Object.assign(B.contracts(), { code: 'T0001', unitCode: 'P01-1', clientCode: 'C001', start: '2026-01-01', end: '2026-12-31', rent: 1000, increasePct: 10, dueDay: 1 }));
  one.maintenance.push(Object.assign(B.maintenance(), { code: 'M0001', unitCode: 'P01-1', date: '2026-02-01', description: 'x' }));
  E.Store.load(one);
  const f1 = save('lo_one.xlsx', await E.Workbook.write(one)); const r1 = compare(f1, recalc(f1).file);
  assert.deepEqual(r1.errsample, [], 'one contract: errors'); assert.deepEqual(r1.sample, [], 'one contract: mismatches');
  assert.ok(r1.minBound >= 201, 'bounded ranges reach at least row 201: ' + r1.minBound);
  assert.ok(r1.formulas > 40);
});

test('[A9] office-edit scenarios recalculated by LibreOffice: a typed payment row moves «إجمالي المسدَّد» of the contract and the client; cleared dates show «تواريخ غير صحيحة» with a blank year block; overrides typed loosely («2 = 83,600 ، 3:91960») feed the year columns; a unit typed by project name and a payment typed by client name are resolved by the app and get their formulas on the next save', { skip: SKIP }, async () => {
  const E = load({}); const U = E.U, S = E.Store;
  const st = await demoState(E);
  const base = save('lo_edit_base.xlsx', await E.Workbook.write(st));
  const code = 'T0001'; const client = S.contract(code).clientCode; const clientName = S.client(client).name;
  const paidBefore = U.sum(S.paymentsOf(code), p => U.toNum(p.amount)), clientBefore = U.sum(S.contractsOfClient(client), c => U.sum(S.paymentsOf(c.code), p => U.toNum(p.amount)));
  // عقد بثلاث سنوات على الأقل لاختبار الإيجار اليدوي المكتوب بصيغة حرة
  const ov = st.contracts.find(c => E.Engine.schedule(c).length >= 3 && U.toNum(c.rent) > 0 && !(c.rentOverrides || {})[1]); assert.ok(ov, 'a contract with 3+ years and no year-1 override');
  const edited = save('lo_edit.xlsx', fs.readFileSync(base));
  py(`
import sys, openpyxl, json
wb = openpyxl.load_workbook(sys.argv[1]); code, ovcode, cname, pname = sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
def H(ws): return {str(c.value).strip(): c.column for c in ws[1] if c.value}
p = wb['المدفوعات']; h = H(p)
r = p.max_row + 1; p.cell(r, h['كود العقد']).value = code; p.cell(r, h['الشهر']).value = '2026-11'; p.cell(r, h['المبلغ']).value = 1234     # صف دفعة بالكود
r = p.max_row + 1; p.cell(r, h['العميل']).value = cname; p.cell(r, h['الشهر']).value = '2026-12'; p.cell(r, h['المبلغ']).value = 555       # صف دفعة باسم العميل بلا كود
k = wb['العقود']; hk = H(k)
for rr in range(2, k.max_row + 1):
    if k.cell(rr, hk['كود العقد']).value == 'T0002': k.cell(rr, hk['بداية العقد']).value = None; k.cell(rr, hk['نهاية العقد']).value = None   # تواريخ ممسوحة
    if k.cell(rr, hk['كود العقد']).value == ovcode: k.cell(rr, hk['إيجار كل سنة (يدوي)']).value = '2 = 83,600 ، 3:91960'                          # إيجار يدوي بصيغة حرة
u = wb['الوحدات']; hu = H(u); r = u.max_row + 1; u.cell(r, hu['المشروع']).value = pname; u.cell(r, hu['رقم / اسم الوحدة']).value = 'وحدة 999'; u.cell(r, hu['النوع']).value = 'تجارية'   # وحدة باسم المشروع بلا كود
wb.save(sys.argv[1]); print('{}')`, edited, code, ov.code, clientName, S.project(S.unit(S.contract(code).unitCode).projectCode).name);
  const rec = recalc(edited).file;
  const [paidAfter, clientAfter, status2, years2, y1of2, cur2, ovY1, ovY2, ovY3] = cells(rec, [
    { sheet: 'العقود', key: 'كود العقد', code, col: 'إجمالي المسدَّد' }, { sheet: 'العملاء', key: 'كود العميل', code: client, col: 'إجمالي المسدَّد' },
    { sheet: 'العقود', key: 'كود العقد', code: 'T0002', col: 'حالة العقد اليوم' }, { sheet: 'العقود', key: 'كود العقد', code: 'T0002', col: 'عدد سنوات العقد' }, { sheet: 'العقود', key: 'كود العقد', code: 'T0002', col: 'إيجار السنة 1' }, { sheet: 'العقود', key: 'كود العقد', code: 'T0002', col: 'الإيجار الشهري الحالي' },
    { sheet: 'العقود', key: 'كود العقد', code: ov.code, col: 'إيجار السنة 1' }, { sheet: 'العقود', key: 'كود العقد', code: ov.code, col: 'إيجار السنة 2' }, { sheet: 'العقود', key: 'كود العقد', code: ov.code, col: 'إيجار السنة 3' },
  ]);
  assert.equal(paidAfter, paidBefore + 1234, 'contract total follows the typed payment row (the name-only row has no code yet, so Excel does not count it)');
  assert.equal(clientAfter, clientBefore + 1234, 'client roll-up follows');
  assert.equal(status2, 'تواريخ غير صحيحة'); assert.equal(years2, ''); assert.equal(y1of2, ''); assert.equal(cur2, '');
  assert.equal(ovY1, U.toNum(ov.rent)); assert.equal(ovY2, 83600); assert.equal(ovY3, 91960, 'loosely typed overrides are normalised by the SUBSTITUTE chain');
  // التطبيق يقرأ نفس الملف: الدفعة بالاسم تُربط بعقد العميل، والوحدة بالاسم تُربط بالمشروع، والحفظ التالي يكتب لهما المعادلات
  const r2 = await E.Workbook.read(toAB(fs.readFileSync(edited))); E.Store.load(r2.state);
  const byName = r2.state.payments.find(p => p.period === '2026-12' && U.toNum(p.amount) === 555); assert.ok(byName && byName.contractCode && S.contract(byName.contractCode).clientCode === client, 'payment typed by client name resolved to one of the client\'s contracts');
  const nu = r2.state.units.find(u => u.label === 'وحدة 999'); assert.ok(nu && nu.projectCode === S.project(S.unit(S.contract(code).unitCode).projectCode).code, 'unit typed by project name resolved');
  const c2 = r2.state.contracts.find(c => c.code === ov.code); assert.deepEqual(c2.rentOverrides, { 2: 83600, 3: 91960 });
  const out = save('lo_edit_out.xlsx', await E.Workbook.write(r2.state));
  const info = py(`
import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1])
def H(ws): return {str(c.value).strip(): c.column for c in ws[1] if c.value}
u = wb['الوحدات']; hu = H(u); r = next(r for r in range(2, u.max_row + 1) if u.cell(r, hu['رقم / اسم الوحدة']).value == 'وحدة 999')
p = wb['المدفوعات']; hp = H(p); rp = next(r for r in range(2, p.max_row + 1) if p.cell(r, hp['المبلغ']).value == 555)
print(json.dumps({'unitC': u.cell(r, hu['المشروع']).value, 'unitB': u.cell(r, hu['كود المشروع']).value, 'payC': p.cell(rp, hp['العميل']).value, 'payB': p.cell(rp, hp['كود العقد']).value}))`, out);
  assert.ok(String(info.unitC).startsWith('=IF($B'), 'next save writes the project-name formula: ' + info.unitC); assert.ok(info.unitB);
  assert.ok(String(info.payC).startsWith('=IF($B'), 'next save writes the client-name formula: ' + info.payC); assert.ok(info.payB);
  const r3 = compare(out, recalc(out).file); assert.deepEqual(r3.errsample, []); assert.deepEqual(r3.sample, []);
});

test('[A15b] performance: the 100-contract × 3-year × 1,500-payment × 120-unit workbook recalculates in LibreOffice in under 30 s with no error cell and no mismatch', { skip: SKIP }, async () => {
  const E = load({}); const st = bigState(E); E.Store.load(st);
  const f = save('lo_big.xlsx', await E.Workbook.write(st));
  const rec = recalc(f); assert.ok(rec.ms < 30000, 'LibreOffice took ' + rec.ms + ' ms');
  const res = compare(f, rec.file); assert.deepEqual(res.errsample, []); assert.deepEqual(res.sample, []); assert.ok(res.formulas > 5000, 'formulas ' + res.formulas);
});
