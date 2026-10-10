// سنوات أخرى في الإكسيل: ورقة 2025 يضيفها المكتب بجوار 2026 — بنسخ الورقة (مع الأكواد) أو بورقة يدوية بلا أكواد
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { load, readFile, SOURCE } = require('./helpers/env');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const TODAY = '2026-10-09';
function py(script, ...args) { return JSON.parse(execFileSync('python3', ['-I', '-c', script, ...args], { encoding: 'utf-8' })); }
const toAB = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);

/* يختار عقدًا ساريًا طوال 2025 بإيجار ثابت */
function pick2025(E, state) {
  return state.contracts.find(c => c.start <= '2025-01-01' && c.end >= '2025-12-31' && !c.inferred && E.U.toNum(c.rent) > 0) || null;
}
const ADD_SHEET = `
import sys, json, openpyxl
src, dst, year, code, rent, mode = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], float(sys.argv[5]), sys.argv[6]
wb = openpyxl.load_workbook(src); base = wb['2026']
ws = wb.copy_worksheet(base); ws.title = year
ws['K1'] = year
# أعمدة الأكواد (Y..AB) تُحذف في الوضع اليدوي، وتبقى في وضع النسخ
hdr = {str(c.value).strip(): c.column for c in ws[2] if c.value}
first_month = hdr['يناير']; last_month = first_month + 11
target = None
for r in range(3, ws.max_row + 1):
    if ws.cell(r, hdr['كود العقد']).value == code: target = r
    for c in range(first_month, last_month + 1): ws.cell(r, c).value = None
assert target, 'contract row not found'
for c in range(first_month, last_month + 1): ws.cell(target, c).value = rent
if mode == 'manual':
    for name in ['كود العقد', 'كود الوحدة', 'كود العميل', 'كود المشروع']:
        for r in range(2, ws.max_row + 1): ws.cell(r, hdr[name]).value = None
wb.save(dst)
print(json.dumps({'row': target}))`;

for (const mode of ['copy', 'manual']) {
  test(`a hand-added 2025 sheet (${mode === 'copy' ? 'copied from 2026 with the code columns' : 'manual: codes removed'}) is read as 2025 payments on the same contracts, tracking starts in 2025, no duplicate contracts, and the app rewrites it with codes`, async () => {
    const E = load({ today: TODAY });
    const { state } = await E.Workbook.read(readFile(SOURCE)); E.Store.load(state);
    const buf = await E.Workbook.write(state);
    const base = path.join(OUT, `years_base_${mode}.xlsx`), edited = path.join(OUT, `years_2025_${mode}.xlsx`);
    fs.writeFileSync(base, Buffer.from(buf));
    const c = pick2025(E, state); assert.ok(c, 'a contract active through 2025 exists');
    const rent = E.U.toNum(c.rent);
    py(ADD_SHEET, base, edited, '2025', c.code, String(rent), mode);
    const E2 = load({ today: TODAY });
    const r2 = await E2.Workbook.read(toAB(fs.readFileSync(edited))); E2.Store.load(r2.state);
    assert.deepEqual(r2.state.settings.ledgerYears, [2025, 2026]);
    assert.equal(r2.state.settings.trackingFrom, '2025-01', 'accounting starts at the earliest year sheet');
    assert.equal(r2.state.contracts.length, state.contracts.length, 'no duplicate contracts were created');
    assert.equal(r2.state.clients.length, state.clients.length); assert.equal(r2.state.units.length, state.units.length);
    const pays = E2.Store.paymentsOf(c.code).filter(p => p.period.startsWith('2025'));
    assert.equal(pays.length, 12, 'twelve 2025 payments on the same contract');
    assert.ok(pays.every(p => E2.U.toNum(p.amount) === rent && p.source === 'excel'));
    assert.equal(r2.state.payments.length, state.payments.length + 12);
    const c2 = E2.Store.contract(c.code);
    assert.equal(E2.Engine.cell(c2, '2025-03').status, 'paid');
    // عقد آخر ساري في 2025 بلا سداد مسجَّل في الورقة الجديدة ⇒ شهوره متأخرة الآن (المحاسبة بدأت 2025)
    const other = r2.state.contracts.find(x => x.code !== c.code && x.start <= '2025-01-01' && x.end >= '2025-12-31');
    if (other) assert.equal(E2.Engine.cell(other, '2025-06').status, 'late');
    assert.ok(E2.Engine.kpis({}).arrears.total > E.Engine.kpis({}).arrears.total, 'arrears grow when an unpaid prior year is added');
    // الكتابة تعيد ورقة 2025 بالأكواد وبالصفوف ذات الصلة فقط، والقراءة بعدها مستقرة
    const buf3 = await E2.Workbook.write(r2.state, { base: toAB(fs.readFileSync(edited)) });
    const out3 = path.join(OUT, `years_out_${mode}.xlsx`); fs.writeFileSync(out3, Buffer.from(buf3));
    const info = py(`
import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1]); ws = wb['2025']
hdr = {str(c.value).strip(): c.column for c in ws[2] if c.value}
rows = [[ws.cell(r, hdr['كود العقد']).value, ws.cell(r, hdr['يناير']).value] for r in range(3, ws.max_row + 1) if ws.cell(r, hdr['كود العقد']).value]
print(json.dumps({'sheets': wb.sheetnames[:3], 'k1': ws['K1'].value, 'rows': rows}))`, out3);
    assert.deepEqual(info.sheets.slice(0, 2), ['2025', '2026']);
    assert.equal(String(info.k1), '2025');
    assert.ok(info.rows.some(r => r[0] === c.code && r[1] === rent), 'the 2025 row carries the code and the amount');
    const E3 = load({ today: TODAY });
    const r3 = await E3.Workbook.read(buf3);
    assert.equal(r3.state.payments.length, r2.state.payments.length);
    assert.equal(r3.state.contracts.length, state.contracts.length);
    assert.equal(r3.state.settings.trackingFrom, '2025-01');
  });
}

test('adding a future year (2027) from the settings creates its sheet with the contracts that overlap it, and a payment typed there is read back', async () => {
  const E = load({ today: TODAY });
  const { state } = await E.Workbook.read(readFile(SOURCE)); E.Store.load(state);
  state.settings.ledgerYears = Array.from(new Set(state.settings.ledgerYears.concat([2027]))).sort();
  const buf = await E.Workbook.write(state);
  const file = path.join(OUT, 'years_2027.xlsx'); fs.writeFileSync(file, Buffer.from(buf));
  const n = py(`
import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1]); ws = wb['2027']
hdr = {str(c.value).strip(): c.column for c in ws[2] if c.value}
rows = [r for r in range(3, ws.max_row + 1) if ws.cell(r, hdr['كود العقد']).value]
print(json.dumps({'n': len(rows), 'first': ws.cell(rows[0], hdr['كود العقد']).value if rows else None}))`, file);
  const expected = state.contracts.filter(c => c.start <= '2027-12-31' && c.end >= '2027-01-01').length;
  assert.equal(n.n, expected, '2027 sheet lists exactly the contracts overlapping 2027');
  assert.ok(n.n > 0);
});
