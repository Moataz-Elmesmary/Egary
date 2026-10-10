// اختبارات الإكسيل: الترحيل من الشكل الأصلي، الذهاب والعودة، واتجاها المزامنة (openpyxl كمُحكِّم مستقل)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { load, readFile, toArrayBuffer, SOURCE } = require('./helpers/env');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const TODAY = '2026-10-09';

function py(script, ...args) { // يشغّل سكربت openpyxl ويعيد JSON
  return JSON.parse(execFileSync('python3', ['-I', '-c', script, ...args], { encoding: 'utf-8' }));
}
const PY_READ = `
import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1], data_only=False)
out = {'sheets': wb.sheetnames}
ws = wb[sys.argv[2]]
out['freeze'] = ws.freeze_panes; out['rtl'] = ws.sheet_view.rightToLeft
out['cells'] = {ref: (ws[ref].value.isoformat() if hasattr(ws[ref].value, 'isoformat') else ws[ref].value) for ref in sys.argv[3].split(',')} if len(sys.argv) > 3 and sys.argv[3] else {}
out['max_row'] = ws.max_row
out['validations'] = [(str(dv.sqref), dv.formula1) for dv in ws.data_validations.dataValidation]
out['fill_B2'] = ws['B2'].fill.fgColor.rgb if ws['B2'].fill and ws['B2'].fill.fill_type else None
print(json.dumps(out, ensure_ascii=False, default=str))
`;
const PY_EDIT = `
import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1])
ws = wb[sys.argv[2]]
for part in sys.argv[3].split(';'):
    ref, val = part.split('=', 1)
    if val == '': ws[ref].value = None
    else:
        try: ws[ref].value = float(val) if '.' in val else int(val)
        except ValueError: ws[ref].value = val
wb.save(sys.argv[4])
print(json.dumps({'ok': True}))
`;
const sortedState = s => JSON.stringify({
  p: s.projects, u: s.units, c: s.clients,
  k: s.contracts.map(c => ({ ...c, createdAt: '', ledgerOrder: 0 })).sort((a, b) => a.code.localeCompare(b.code)),
  pay: s.payments.map(p => ({ ...p, createdAt: '' })).sort((a, b) => a.code.localeCompare(b.code)),
  m: s.maintenance,
});

test('migration of the owner\'s original workbook: counts, totals, codes, re-let units, quirks flagged', async () => {
  const E = load({ today: TODAY });
  const res = await E.Workbook.read(readFile(SOURCE));
  const st = res.state;
  assert.equal(res.migrated, true);
  assert.deepEqual(st.projects.map(p => p.name), ['بابل', 'محيي الدين', 'ابو بكر']);
  assert.deepEqual(st.projects.map(p => p.code), ['P01', 'P02', 'P03']);
  assert.equal(st.contracts.length, 86);                // 73 صف + 13 فترة سابقة مستنتجة (مبالغ قبل بداية العقد الحالي)
  assert.equal(st.contracts.filter(c => c.inferred).length, 13);
  assert.equal(st.clients.length, 64);
  assert.equal(st.units.length, 71);                    // 73 صف − وحدتان أُجِّرتا مرتين (204، 304) ... + محل الثاني مستقل
  assert.equal(st.payments.length, 509);
  assert.equal(st.payments.reduce((s, p) => s + p.amount, 0), 10339823); // الإجمالي العام في الورقة
  // نفس الوحدة مرتين = وحدة واحدة بعقدين
  const u304 = st.units.filter(u => u.projectCode === 'P03' && u.label === '304');
  assert.equal(u304.length, 1);
  E.Store.load(st);
  assert.equal(E.Store.contractsOfUnit(u304[0].code).length, 2);
  assert.equal(u304[0].code, 'P03-304');
  // «محل» مرتين بفترتين متداخلتين = وحدتان
  assert.deepEqual(st.units.filter(u => u.label === 'محل').map(u => u.code), ['P01-S1', 'P01-S2']);
  // الزيادة السنوية مستنتجة (83,600 → 91,960 = 10%)
  const t5 = st.contracts.find(c => c.unitCode === 'P01-F2');
  assert.equal(t5.increasePct, 10);
  assert.deepEqual(E.Engine.schedule(t5).map(y => y.rent), [76000, 83600, 91960]);
  // الأعلام: الخلية النصية، النهاية قبل البداية، الرقم المختلف
  assert.ok(res.flags.some(f => f.text.includes('63+.0+3+26309')));
  assert.ok(res.flags.some(f => f.sev === 'danger' && (f.text.includes('قبل بدايته') || f.text.includes('بعد نهايته'))));
  assert.ok(res.flags.some(f => f.code === 'C020' && f.text.includes('P16126721')));
  // كود العميل يبدأ بـ C والعقد بـ T والفاتورة INV-2026-
  assert.ok(st.clients.every(c => /^C\d{3,}$/.test(c.code)));
  assert.ok(st.contracts.every(c => /^T\d{4,}$/.test(c.code)));
  assert.ok(st.payments.every(p => /^INV-2026-\d{4,}$/.test(p.code)));
});

test('round trip: state → Egary.xlsx → state is identical, and the sheet keeps the familiar look (openpyxl)', async () => {
  const E = load({ today: TODAY });
  const { state } = await E.Workbook.read(readFile(SOURCE));
  E.Store.load(state);
  const buf = await E.Workbook.write(state);
  const file = path.join(OUT, 'roundtrip.xlsx');
  fs.writeFileSync(file, Buffer.from(buf));
  const r2 = await E.Workbook.read(buf);
  assert.equal(r2.migrated, false);
  assert.equal(sortedState(state), sortedState(r2.state));
  const rows = py(`
import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1]); ws = wb['2026']
out = {}
for r in range(3, ws.max_row+1):
    v = ws.cell(r, 25).value
    if v == 'T0001': out['t1'] = r
    if ws.cell(r, 26).value == 'P03-605' and ws.cell(r, 25).value and not str(ws.cell(r, 25).value).startswith('x'): out['u605'] = r
    if ws.cell(r, 3).value == 'الاجمالي العام': out['tot'] = r
print(json.dumps(out))`, file);
  const info = py(PY_READ, file, '2026', `K1,A2,B2,C${rows.t1},E${rows.t1},G${rows.t1},K${rows.t1},W${rows.t1},R${rows.u605},Y${rows.t1},Z${rows.t1},AA${rows.t1},AB${rows.t1},C${rows.tot},K${rows.tot}`);
  const c = (col) => info.cells[col + rows.t1];
  assert.deepEqual(info.sheets.slice(0, 2), ['2026', 'ملخص المشاريع']);
  assert.ok(info.sheets.includes('العقود') && info.sheets.includes('المدفوعات') && info.sheets.includes('الوحدات') && info.sheets.includes('العملاء') && info.sheets.includes('الصيانة') && info.sheets.includes('أصول الوحدات'));
  assert.equal(info.cells.K1, '2026');
  assert.equal(info.cells.B2, 'المشروع');
  assert.equal(c('C'), 'عمرو أيمن زكي');
  assert.equal(c('G'), '2023-06-01T00:00:00');
  assert.equal(c('K'), 12705);
  assert.equal(c('W'), `=SUM(K${rows.t1}:V${rows.t1})`);
  assert.equal(info.cells['R' + rows.u605], '63+.0+3+26309');        // النص الأصلي محفوظ في خليته
  assert.equal(c('Y'), 'T0001'); assert.equal(c('Z'), 'P01-S1'); assert.equal(c('AA'), 'C001'); assert.equal(c('AB'), 'P01');
  assert.equal(info.cells['C' + rows.tot], 'الاجمالي العام'); assert.equal(info.cells['K' + rows.tot], `=SUM(K3:K${rows.tot - 1})`);
  assert.equal(info.rtl, true);
  assert.equal(info.freeze, 'F3');
  assert.equal(info.fill_B2, 'FF1F4E78');
  const units = py(PY_READ, file, 'الوحدات', 'A1,E2');
  assert.ok(units.validations.some(v => v[1].includes('تجارية') && v[1].includes('جراج')));
});

test('Excel → website: a month cell edited in Excel (openpyxl) updates the payment; a cleared cell deletes it; a new row typed by hand becomes a coded contract', async () => {
  const E = load({ today: TODAY });
  const { state } = await E.Workbook.read(readFile(SOURCE));
  E.Store.load(state);
  const buf = await E.Workbook.write(state);
  const base = path.join(OUT, 'base.xlsx'), edited = path.join(OUT, 'edited.xlsx');
  fs.writeFileSync(base, Buffer.from(buf));
  // الصف 3 = T0001: سبتمبر (S3) يُكتب 12705، يناير (K3) يُفرَّغ؛ صف جديد 76؟ لا — الصف 76 إجمالي؛ نضيف الصف بعده بـ openpyxl: نكتب في الصف 77 (أسفل الإجمالي يقرؤه الموقع أيضًا)
  const nr = py(`
import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1]); ws = wb['2026']; print(json.dumps({'n': ws.max_row + 1}))`, base).n;
  py(PY_EDIT, base, '2026', `S3=12705;K3=;B${nr}=ابو بكر;C${nr}=عميل جديد تجريبي;D${nr}=عميل جديد تجريبي;E${nr}=709;F${nr}=شارع ابو بكر الصديق 3;G${nr}=2026-09-01;H${nr}=2027-08-31;J${nr}=29001011234567;S${nr}=9000;T${nr}=9000`, edited);
  const snapshot = E.Workbook.snapshotOf(state);
  const r2 = await E.Workbook.read(readFile(edited), { snapshot });
  const s2 = r2.state;
  const sep = s2.payments.filter(p => p.contractCode === 'T0001' && p.period === '2026-09');
  assert.equal(sep.length, 1); assert.equal(sep[0].amount, 12705); assert.equal(sep[0].source, 'excel');
  assert.equal(s2.payments.filter(p => p.contractCode === 'T0001' && p.period === '2026-01').length, 0);
  const nc = s2.clients.find(c => c.name === 'عميل جديد تجريبي');
  assert.ok(nc && /^C\d+$/.test(nc.code));
  assert.equal(nc.nationalId, '29001011234567');
  const nu = s2.units.find(u => u.label === '709' && u.projectCode === 'P03');
  assert.ok(nu); assert.equal(nu.code, 'P03-709'); assert.equal(nu.floor, '7');
  const nk = s2.contracts.find(c => c.unitCode === 'P03-709');
  assert.ok(nk); assert.equal(nk.start, '2026-09-01'); assert.equal(nk.end, '2027-08-31'); assert.equal(nk.rent, 9000);
  assert.equal(s2.payments.filter(p => p.contractCode === nk.code).length, 2);
  assert.ok(r2.flags.some(f => f.text.includes('عقد جديد') && f.text.includes('709')));
  // بعد إعادة الكتابة يظهر الصف الجديد بأكواده في الورقة
  E.Store.load(s2);
  const buf3 = await E.Workbook.write(s2);
  const file3 = path.join(OUT, 'rewritten.xlsx'); fs.writeFileSync(file3, Buffer.from(buf3));
  const found = py(`
import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1]); ws = wb['2026']
out = {'S3': ws['S3'].value, 'K3': ws['K3'].value}
for r in range(3, ws.max_row+1):
    if ws.cell(r, 26).value == 'P03-709': out['name'] = ws.cell(r, 3).value; out['code'] = ws.cell(r, 25).value
print(json.dumps(out, ensure_ascii=False))`, file3);
  assert.equal(found.name, 'عميل جديد تجريبي'); assert.equal(found.code, nk.code);
  assert.equal(found.S3, 12705); assert.equal(found.K3, null);
});

test('website → Excel: payments, a new unit with assets, a client edit and a delete all land in the workbook (openpyxl)', async () => {
  const E = load({ today: TODAY });
  const { state } = await E.Workbook.read(readFile(SOURCE));
  E.Store.load(state); const S = E.Store;
  // دفعة سبتمبر لعقد T0008 بتاريخ وطريقة
  S.upsert('payments', { code: E.Codes.nextInvoice(S.state(), 2026), contractCode: 'T0008', period: '2026-09', amount: 46585, paidOn: '2026-09-03', method: 'transfer', ref: 'TR-55', source: 'web' });
  // وحدة جديدة جراج بأصول
  const ucode = E.Codes.unitCode(S.state(), 'P02', 'جراج 1');
  S.upsert('units', { code: ucode, projectCode: 'P02', label: 'جراج 1', type: 'garage', floor: 'B', assets: [{ name: 'بوابة أوتوماتيك', present: true, details: 'ريموت 2' }, { name: 'تكييف', present: false, details: '' }] });
  // تعديل عميل
  const cl = { ...S.client('C001'), phone: '01001234567' }; S.upsert('clients', cl);
  // حذف عقد مع دفعاته
  const ops = S.cascadeOps('contracts', 'T0007'); S.batch(ops);
  const buf = await E.Workbook.write(S.state());
  const file = path.join(OUT, 'web_to_excel.xlsx'); fs.writeFileSync(file, Buffer.from(buf));
  const led = py(`
import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1]); ws = wb['2026']
out = {}
for r in range(3, ws.max_row+1):
    if ws.cell(r, 25).value == 'T0008': out['sep'] = ws.cell(r, 19).value; out['row'] = r
    if ws.cell(r, 25).value == 'T0007': out['t7'] = r
print(json.dumps(out))
`, file);
  assert.equal(led.sep, 46585);                               // سبتمبر في صف T0008
  assert.equal(led.t7, undefined);                            // صف T0007 اختفى من الورقة
  const pays = py(`
import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1]); ws = wb['المدفوعات']
hdr = [c.value for c in ws[1]]
rows = [dict(zip(hdr, [c.value for c in r])) for r in ws.iter_rows(min_row=2)]
print(json.dumps({'sep': [r for r in rows if r['كود العقد']=='T0008' and r['الشهر']=='2026-09'], 't7': [r for r in rows if r['كود العقد']=='T0007']}, ensure_ascii=False, default=str))
`, file);
  assert.equal(pays.sep.length, 1); assert.equal(pays.sep[0]['المبلغ'], 46585); assert.equal(pays.sep[0]['طريقة السداد'], 'تحويل بنكي'); assert.equal(String(pays.sep[0]['تاريخ السداد']).slice(0, 10), '2026-09-03');
  assert.equal(pays.t7.length, 0);
  const units = py(`
import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1], data_only=True); ws = wb['الوحدات']   # data_only: الأعمدة التلقائية معادلات ونتيجتها المخزَّنة هي ما يراه المكتب
hdr = [c.value for c in ws[1]]
rows = [dict(zip(hdr, [c.value for c in r])) for r in ws.iter_rows(min_row=2)]
wa = wb['أصول الوحدات']; ha = [c.value for c in wa[1]]
assets = [dict(zip(ha, [c.value for c in r])) for r in wa.iter_rows(min_row=2)]
wc = wb['العملاء']; hc = [c.value for c in wc[1]]
clients = [dict(zip(hc, [c.value for c in r])) for r in wc.iter_rows(min_row=2)]
wk = wb['العقود']; hk = [c.value for c in wk[1]]
ks = [dict(zip(hk, [c.value for c in r])) for r in wk.iter_rows(min_row=2)]
print(json.dumps({'g': [r for r in rows if r['كود الوحدة']==sys.argv[2]], 'a': [a for a in assets if a['كود الوحدة']==sys.argv[2]], 'c1': [c for c in clients if c['كود العميل']=='C001'], 't7': [k for k in ks if k['كود العقد']=='T0007']}, ensure_ascii=False, default=str))
`, file, ucode);
  assert.equal(units.g.length, 1); assert.equal(units.g[0]['النوع'], 'جراج'); assert.equal(units.g[0]['حالة الوحدة اليوم'], 'شاغرة');
  assert.equal(units.a.length, 2); assert.equal(units.a[0]['موجود'], 'نعم'); assert.equal(units.a[0]['التفاصيل'], 'ريموت 2');
  assert.equal(units.c1[0]['التليفون'], '01001234567');
  assert.equal(units.t7.length, 0);
  // وإعادة القراءة تعطي نفس الحالة
  const r2 = await E.Workbook.read(buf);
  assert.equal(sortedState(S.state()), sortedState(r2.state));
  assert.equal(r2.state.units.find(u => u.code === ucode).assets.length, 2);
});

test('conflict rule: when the ledger cell did not change since the last snapshot, the payments sheet wins (detailed payments are not clobbered)', async () => {
  const E = load({ today: TODAY });
  const { state } = await E.Workbook.read(readFile(SOURCE));
  E.Store.load(state);
  const buf = await E.Workbook.write(state);
  const base = path.join(OUT, 'conf_base.xlsx'), edited = path.join(OUT, 'conf_edited.xlsx');
  fs.writeFileSync(base, Buffer.from(buf));
  const snapshot = E.Workbook.snapshotOf(state);
  // تعديل في ورقة المدفوعات فقط (المبلغ في صف INV-2026-0001 يصبح 5000) بينما خلية الورقة لم تتغير
  py(`
import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1]); ws = wb['المدفوعات']
hdr = [c.value for c in ws[1]]; ci = hdr.index('رقم الفاتورة')+1; ca = hdr.index('المبلغ')+1
for r in range(2, ws.max_row+1):
    if ws.cell(r, ci).value == 'INV-2026-0001': ws.cell(r, ca).value = 5000
wb.save(sys.argv[2]); print(json.dumps({'ok':True}))
`, base, edited);
  const r2 = await E.Workbook.read(readFile(edited), { snapshot });
  const p = r2.state.payments.find(p => p.code === 'INV-2026-0001');
  assert.equal(p.amount, 5000);
  // وبدون لقطة (أول قراءة على جهاز جديد) تتقدم الورقة المعتادة
  const r3 = await E.Workbook.read(readFile(edited));
  assert.equal(r3.state.payments.find(p => p.code === 'INV-2026-0001').amount, 12705);
});
