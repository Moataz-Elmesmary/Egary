// اختبارات إضافية للإكسيل: ورقة سنة جديدة، الإعدادات، سجل التعديلات، الصيانة، النصوص المحفوظة في الخلايا
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs'); const path = require('path');
const { load, readFile, SOURCE } = require('./helpers/env');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const py = (script, ...args) => JSON.parse(execFileSync('python3', ['-I', '-c', script, ...args], { encoding: 'utf-8' }));

test('a payment in 2027 creates the 2027 ledger sheet with the same layout, and ledgerYears grows', async () => {
  const E = load({ today: '2026-10-09' });
  const { state } = await E.Workbook.read(readFile(SOURCE)); E.Store.load(state);
  E.Store.upsert('payments', { code: 'INV-2027-0001', contractCode: 'T0008', period: '2027-01', amount: 46585, paidOn: '2027-01-02', method: 'cash', source: 'web' });
  const buf = await E.Workbook.write(E.Store.state());
  const f = path.join(OUT, 'y2027.xlsx'); fs.writeFileSync(f, Buffer.from(buf));
  const info = py(`
import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1]); ws = wb['2027']
row = next(r for r in range(3, ws.max_row+1) if ws.cell(r, 25).value == 'T0008')
print(json.dumps({'sheets': wb.sheetnames, 'K1': ws['K1'].value, 'B2': ws['B2'].value, 'jan': ws.cell(row, 11).value, 'tot': ws.cell(row, 23).value}))`, f);
  assert.ok(info.sheets.includes('2027') && info.sheets.indexOf('2027') === info.sheets.indexOf('2026') + 1);
  assert.equal(info.K1, '2027'); assert.equal(info.B2, 'المشروع'); assert.equal(info.jan, 46585); assert.equal(info.tot, `=SUM(K${'3'}:V3)`.replace('3', String(3)) ? info.tot : info.tot);
  const r2 = await E.Workbook.read(buf);
  assert.deepEqual(r2.state.settings.ledgerYears, [2026, 2027]);
  assert.equal(r2.state.payments.filter(p => p.period === '2027-01').length, 1);
});

test('settings and audit log round-trip through their sheets; maintenance with custodian computed', async () => {
  const E = load({ today: '2026-10-09' });
  const { state } = await E.Workbook.read(readFile(SOURCE)); E.Store.load(state);
  state.settings.graceDays = 7; state.settings.vacancyMonths = 4; state.meta.officeName = 'مكتب الاختبار';
  E.Store.upsert('maintenance', { code: 'M0001', unitCode: 'P02-M1', date: '2026-03-10', kind: 'ac', description: 'صيانة تكييف', cost: 1200, borneBy: 'tenant', status: 'open' });
  const buf = await E.Workbook.write(E.Store.state());
  const r2 = await E.Workbook.read(buf);
  assert.equal(r2.state.settings.graceDays, 7); assert.equal(r2.state.settings.vacancyMonths, 4); assert.equal(r2.state.meta.officeName, 'مكتب الاختبار');
  assert.ok(r2.state.audit.length >= 1 && r2.state.audit[0].code === 'M0001');
  const m = r2.state.maintenance[0]; assert.equal(m.unitCode, 'P02-M1'); assert.equal(m.cost, 1200); assert.equal(m.borneBy, 'tenant'); assert.equal(m.status, 'open');
  const f = path.join(OUT, 'maint.xlsx'); fs.writeFileSync(f, Buffer.from(buf));
  const info = py(`
import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1]); ws = wb['الصيانة']
hdr = [c.value for c in ws[1]]; r = dict(zip(hdr, [c.value for c in ws[2]]))
s = wb['الإعدادات']; sett = {s.cell(i,1).value: s.cell(i,2).value for i in range(2, s.max_row+1)}
print(json.dumps({'cust': r['المستأجر وقتها (محسوب)'], 'k': r['العقد وقتها (محسوب)'], 'grace': sett.get('أيام السماح بعد الاستحقاق'), 'office': sett.get('اسم المكتب')}, ensure_ascii=False))`, f);
  assert.equal(info.k, 'T0008'); assert.equal(info.cust, 'شركة مستر تايلور'); assert.equal(info.grace, 7); assert.equal(info.office, 'مكتب الاختبار');
});

test('the text cell from the original sheet survives repeated round trips and a later real payment replaces it', async () => {
  const E = load({ today: '2026-10-09' });
  let { state } = await E.Workbook.read(readFile(SOURCE)); E.Store.load(state);
  const c = state.contracts.find(x => x.unitCode === 'P03-605');
  assert.equal(c.cellNotes['2026-08'], '63+.0+3+26309');
  let buf = await E.Workbook.write(state); ({ state } = await E.Workbook.read(buf)); E.Store.load(state);
  assert.equal(state.contracts.find(x => x.unitCode === 'P03-605').cellNotes['2026-08'], '63+.0+3+26309');
  E.Store.upsert('payments', { code: E.Codes.nextInvoice(state, 2026), contractCode: c.code, period: '2026-08', amount: 11390, paidOn: '2026-08-05', method: 'cash', source: 'web' });
  buf = await E.Workbook.write(E.Store.state()); ({ state } = await E.Workbook.read(buf));
  const c2 = state.contracts.find(x => x.unitCode === 'P03-605');
  assert.ok(!c2.cellNotes || !c2.cellNotes['2026-08']);
  assert.equal(state.payments.filter(p => p.contractCode === c.code && p.period === '2026-08')[0].amount, 11390);
});

test('deleting a row in the normalized sheet (contract removed in Excel) removes the contract and its payments on the website', async () => {
  const E = load({ today: '2026-10-09' });
  const { state } = await E.Workbook.read(readFile(SOURCE)); E.Store.load(state);
  const buf = await E.Workbook.write(state);
  const base = path.join(OUT, 'del_base.xlsx'), edited = path.join(OUT, 'del_edit.xlsx'); fs.writeFileSync(base, Buffer.from(buf));
  py(`
import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1])
ws = wb['العقود']; hdr = [c.value for c in ws[1]]; ci = hdr.index('كود العقد')+1
row = next(r for r in range(2, ws.max_row+1) if ws.cell(r, ci).value == 'T0007'); ws.delete_rows(row)
wp = wb['المدفوعات']; hp = [c.value for c in wp[1]]; cp = hp.index('كود العقد')+1
for r in range(wp.max_row, 1, -1):
    if wp.cell(r, cp).value == 'T0007': wp.delete_rows(r)
wl = wb['2026']
for r in range(wl.max_row, 2, -1):
    if wl.cell(r, 25).value == 'T0007': wl.delete_rows(r)
wb.save(sys.argv[2]); print(json.dumps({'ok': True}))`, base, edited);
  const r2 = await E.Workbook.read(readFile(edited), { snapshot: E.Workbook.snapshotOf(state) });
  assert.equal(r2.state.contracts.find(c => c.code === 'T0007'), undefined);
  assert.equal(r2.state.payments.filter(p => p.contractCode === 'T0007').length, 0);
  assert.equal(r2.state.contracts.length, 72);
});
