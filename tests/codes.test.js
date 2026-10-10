// نظام الأكواد: لا إعادة استخدام بعد الحذف، بادئة فاتورة مطبَّعة، تكرار الوحدات، قراءة أسماء الوحدات، الأكواد المكررة/المكتوبة بصيغ مختلفة في الإكسيل، والصفوف المنسوخة بأكواد قديمة
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { load, readFile, SOURCE } = require('./helpers/env');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const TODAY = '2026-10-09';
function py(script, ...args) { return JSON.parse(execFileSync('python3', ['-I', '-c', script, ...args], { encoding: 'utf-8' })); }
const toAB = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);

test('codes are never reused: deleting the newest project/client/contract/invoice does not hand its code to the next record, across a workbook round trip', async () => {
  const E = load({ today: TODAY });
  const { state } = await E.Workbook.read(readFile(SOURCE)); E.Store.load(state);
  const S = E.Store, C = E.Codes, M = E.M;
  const p = S.upsert('projects', { ...M.blank.projects(), code: C.nextProject(state), name: 'مشروع مؤقت' }).record;
  assert.equal(p.code, 'P04');
  S.remove('projects', 'P04');
  assert.equal(C.nextProject(state), 'P05', 'deleted P04 is not reused');
  const lastClient = state.clients.map(c => c.code).sort().pop();
  const c1 = S.upsert('clients', { ...M.blank.clients(), code: C.nextClient(state), name: 'عميل مؤقت' }).record;
  S.remove('clients', c1.code);
  const c2 = C.nextClient(state); assert.ok(c2 > c1.code && c1.code > lastClient, `${lastClient} < ${c1.code} < ${c2}`);
  const t1 = C.nextContract(state); const t2 = C.nextContract(state); assert.equal(t1, t2, 'previewing a code has no side effect');
  S.upsert('contracts', { ...M.blank.contracts(), code: t1, unitCode: state.units[0].code, clientCode: state.clients[0].code, start: '2030-01-01', end: '2030-12-31', rent: 1 }); S.remove('contracts', t1);
  assert.ok(C.nextContract(state) > t1, 'a created-then-deleted contract code is not reused');
  const inv1 = C.nextInvoice(state, '2026');
  S.upsert('payments', { ...M.blank.payments(), code: inv1, contractCode: state.contracts[0].code, period: '2026-12', amount: 1 });
  S.remove('payments', inv1);
  assert.notEqual(C.nextInvoice(state, '2026'), inv1, 'deleted invoice number is not reused');
  // العدّادات تُحفظ في الإعدادات وتعود بعد إعادة القراءة
  const buf = await E.Workbook.write(state);
  const E2 = load({ today: TODAY }); const r2 = await E2.Workbook.read(buf); E2.Store.load(r2.state);
  assert.ok(r2.state.settings.codeSeq && r2.state.settings.codeSeq.P >= 4, JSON.stringify(r2.state.settings.codeSeq));
  assert.equal(E2.Codes.nextProject(r2.state), 'P05', 'P04 (created then deleted) stays retired after a round trip');
  const info = py(`
import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1]); ws = wb['الإعدادات']
print(json.dumps({r[0]: r[1] for r in ws.iter_rows(min_row=2, values_only=True) if r[0]}))`, (() => { const f = path.join(OUT, 'codes_seq.xlsx'); fs.writeFileSync(f, Buffer.from(buf)); return f; })());
  assert.ok(String(info['أعلى أرقام الأكواد الصادرة']).includes('"P":4'));
});

test('invoice prefix is normalised (lowercase, spaces, odd characters) so numbering never collides; kindOf recognises it', () => {
  const E = load({ today: TODAY });
  const st = E.M.emptyState(); st.settings.invoicePrefix = ' inv ';
  st.payments.push({ code: 'INV-2026-0007', contractCode: 'T0001', period: '2026-01', amount: 1 });
  assert.equal(E.Codes.nextInvoice(st, '2026'), 'INV-2026-0008');
  st.settings.invoicePrefix = 'eg(1)'; assert.match(E.Codes.nextInvoice(st, '2026'), /^EG1-2026-0001$/);
  st.settings.invoicePrefix = '((('; assert.match(E.Codes.nextInvoice(st, '2027'), /^INV-2027-0001$/);
  assert.equal(E.Codes.kindOf('EG1-2026-0001'), 'payments'); assert.equal(E.Codes.kindOf('INV-2026-0001'), 'payments');
});

test('unit codes: named duplicates get S1/S2, numbered duplicates get a suffix instead of stealing the next number; labels parse (Latin letters, decimals, flat+floor, letter suffix, Arabic digits)', () => {
  const E = load({ today: TODAY }); const C = E.Codes;
  const st = E.M.emptyState(); st.projects.push({ code: 'P01', name: 'x' });
  const add = (label) => { const code = C.unitCode(st, 'P01', label); st.units.push({ code, projectCode: 'P01', label }); return code; };
  assert.equal(add('محل'), 'P01-S1'); assert.equal(add('محل'), 'P01-S2');
  assert.equal(add('304'), 'P01-304'); assert.equal(add('شقة 304'), 'P01-304-2', 'same number spelled differently does not take 305');
  assert.equal(add('305'), 'P01-305');
  assert.deepEqual(C.parseLabel('G5'), { kind: 'G', num: '5' }); assert.equal(C.inferType('G5'), 'garage');
  assert.deepEqual(C.parseLabel('s2'), { kind: 'S', num: '2' }); assert.equal(C.inferType('s2'), 'commercial');
  assert.deepEqual(C.parseLabel('3.5'), { kind: 'num', num: '3-5' });
  assert.deepEqual(C.parseLabel('شقة 12 الدور 3'), { kind: 'num', num: '12', floor: '3' }); assert.equal(C.inferFloor('شقة 12 الدور 3'), '3');
  assert.deepEqual(C.parseLabel('شقة 7 الدور الثاني'), { kind: 'num', num: '7', floor: '2' });
  assert.deepEqual(C.parseLabel('12 ب'), { kind: 'num', num: '12B' }); assert.equal(C.inferFloor('12 ب'), '1');
  assert.deepEqual(C.parseLabel('محل 2 أ'), { kind: 'S', num: '2A' });
  assert.deepEqual(C.parseLabel('٣٠٤'), { kind: 'num', num: '304' }); assert.equal(C.inferFloor('١٢٠٣'), '12');
  assert.equal(add('٣٠٦'), 'P01-306');
  assert.equal(C.inferFloor('304'), '3'); assert.equal(C.inferFloor('ميزان 1'), 'M'); assert.equal(C.inferFloor('محل 3'), 'G');
});

test('normalized sheets typed by hand: duplicate primary codes are flagged and re-coded, foreign keys in Arabic digits/lowercase are canonicalised, a unit row with only the project name resolves, a contract row with names resolves, an unknown FK is flagged', async () => {
  const E = load({ today: TODAY });
  const { state } = await E.Workbook.read(readFile(SOURCE)); E.Store.load(state);
  const buf = await E.Workbook.write(state);
  const base = path.join(OUT, 'codes_base.xlsx'), edited = path.join(OUT, 'codes_edit.xlsx');
  fs.writeFileSync(base, Buffer.from(buf));
  const firstClient = state.clients[0], firstContract = state.contracts.find(c => c.clientCode === firstClient.code), unitOf = state.units.find(u => u.code === firstContract.unitCode), proj = state.projects.find(p => p.code === unitOf.projectCode);
  const arabic = (s) => String(s).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  py(`
import sys, json, openpyxl
src, dst = sys.argv[1], sys.argv[2]; client, contract, unit, projName, projCode = sys.argv[3:8]
wb = openpyxl.load_workbook(src)
def hdr(ws): return {str(c.value).strip(): c.column for c in ws[1] if c.value}
# 1) عميل مكرر الكود (صف يدوي نسخ كود عميل موجود)
ws = wb['العملاء']; h = hdr(ws); ws.append([None]*ws.max_column); r = ws.max_row
ws.cell(r, h['كود العميل']).value = client; ws.cell(r, h['الاسم']).value = 'عميل مكرر الكود'; ws.cell(r, h['النوع']).value = 'فرد'
# 2) دفعة بكود عقد بأرقام عربية وبحروف صغيرة ومسافة
ws = wb['المدفوعات']; h = hdr(ws)
ws.append([None]*ws.max_column); r = ws.max_row; ws.cell(r, h['كود العقد']).value = sys.argv[8]; ws.cell(r, h['الشهر']).value = '2027-01'; ws.cell(r, h['المبلغ']).value = 111
ws.append([None]*ws.max_column); r = ws.max_row; ws.cell(r, h['كود العقد']).value = ' ' + contract.lower() + ' '; ws.cell(r, h['الشهر']).value = '2027-02'; ws.cell(r, h['المبلغ']).value = 222
ws.append([None]*ws.max_column); r = ws.max_row; ws.cell(r, h['كود العقد']).value = 'T9999'; ws.cell(r, h['الشهر']).value = '2027-03'; ws.cell(r, h['المبلغ']).value = 333
# 3) وحدة بلا كود وبلا كود مشروع لكن باسم المشروع
ws = wb['الوحدات']; h = hdr(ws); ws.append([None]*ws.max_column); r = ws.max_row
ws.cell(r, h['المشروع']).value = projName; ws.cell(r, h['رقم / اسم الوحدة']).value = '909'; ws.cell(r, h['النوع']).value = 'إدارية'
# 4) وحدة بلا أي مشروع ⇒ تُرفض بتنبيه
ws.append([None]*ws.max_column); r = ws.max_row; ws.cell(r, h['رقم / اسم الوحدة']).value = '910'
# 5) عقد بلا أكواد لكن بأسماء (المشروع/الوحدة/العميل) ⇒ يُحل بالاسم
ws = wb['العقود']; h = hdr(ws); ws.append([None]*ws.max_column); r = ws.max_row
ws.cell(r, h['المشروع']).value = projName; ws.cell(r, h['الوحدة']).value = '909'; ws.cell(r, h['العميل']).value = 'عميل مكرر الكود'
ws.cell(r, h['بداية العقد']).value = '2027-01-01'; ws.cell(r, h['نهاية العقد']).value = '2027-12-31'; ws.cell(r, h['الإيجار الشهري (السنة الأولى)']).value = 5000
wb.save(dst); print('{}')`, base, edited, firstClient.code, firstContract.code, unitOf.code, proj.name, proj.code, arabic(firstContract.code));
  const E2 = load({ today: TODAY });
  const r2 = await E2.Workbook.read(toAB(fs.readFileSync(edited))); E2.Store.load(r2.state);
  const flags = r2.state.flags || r2.flags;
  // 1) العميل المكرر أُعطي كودًا جديدًا ولم يُدمج مع الأصلي
  assert.equal(E2.Store.client(firstClient.code).name, firstClient.name, 'original client untouched');
  const dup = r2.state.clients.find(c => c.name === 'عميل مكرر الكود'); assert.ok(dup && dup.code !== firstClient.code, 'duplicate re-coded: ' + (dup && dup.code));
  assert.ok(flags.some(f => f.sev === 'danger' && /مكرر/.test(f.text)), 'duplicate code flagged as danger');
  // 2) المفاتيح الأجنبية
  const pays = E2.Store.paymentsOf(firstContract.code).filter(p => p.period >= '2027-01');
  assert.deepEqual(pays.map(p => p.amount).sort(), [111, 222], 'Arabic-digit and lowercase contract codes resolve to the real contract');
  assert.ok(pays.every(p => p.contractCode === firstContract.code));
  assert.ok(flags.some(f => f.sev === 'danger' && /T9999/.test(f.text)), 'unknown contract code flagged');
  // 3/4) الوحدات
  const u909 = r2.state.units.find(u => u.label === '909'); assert.ok(u909 && u909.projectCode === proj.code && u909.code === proj.code + '-909', JSON.stringify(u909));
  assert.ok(!r2.state.units.some(u => u.label === '910'), 'unit without a project is not created with a P00 code');
  assert.ok(flags.some(f => f.sev === 'danger' && /910/.test(f.text)));
  // 5) العقد بالأسماء
  const c909 = r2.state.contracts.find(c => c.unitCode === (u909 && u909.code)); assert.ok(c909 && c909.clientCode === dup.code && /^T\d{4}$/.test(c909.code), JSON.stringify(c909));
});

test('a ledger row copied into another year with stale code columns does not rename the original tenant/unit; it becomes a new contract with a warning', async () => {
  const E = load({ today: TODAY });
  const { state } = await E.Workbook.read(readFile(SOURCE)); E.Store.load(state);
  const buf = await E.Workbook.write(state);
  const base = path.join(OUT, 'codes_copy_base.xlsx'), edited = path.join(OUT, 'codes_copy_edit.xlsx');
  fs.writeFileSync(base, Buffer.from(buf));
  const c = state.contracts.find(x => x.start <= '2026-01-01' && x.end >= '2026-12-31' && !x.inferred);
  const cl = state.clients.find(x => x.code === c.clientCode), u = state.units.find(x => x.code === c.unitCode);
  py(`
import sys, json, openpyxl
src, dst, code = sys.argv[1], sys.argv[2], sys.argv[3]
wb = openpyxl.load_workbook(src); ws = wb['2026']
hdr = {str(c.value).strip(): c.column for c in ws[2] if c.value}
target = [r for r in range(3, ws.max_row + 1) if ws.cell(r, hdr['كود العقد']).value == code][0]
tot = [r for r in range(3, ws.max_row + 1) if str(ws.cell(r, 3).value or '').startswith('الاجمالي')]
ins = tot[0] if tot else ws.max_row + 1
ws.insert_rows(ins)
for c in range(1, ws.max_column + 1): ws.cell(ins, c).value = ws.cell(target, c).value
ws.cell(ins, hdr['الاسم']).value = 'مستأجر جديد منسوخ'; ws.cell(ins, hdr['الوحدة']).value = '777'
ws.cell(ins, hdr['العقد من']).value = '2026-03-01'; ws.cell(ins, hdr['العقد الى']).value = '2027-02-28'
for m in ['يناير','فبراير','مارس','ابريل','مايو','يونيو','يوليو','اغسطس','سبتمبر','اكتوبر','نوفمبر','ديسمبر']:
    col = hdr.get(m) or hdr.get(m.replace('ا','أ',1)); 
    if col: ws.cell(ins, col).value = None
ws.cell(ins, hdr['مارس']).value = 4000
wb.save(dst); print('{}')`, base, edited, c.code);
  const E2 = load({ today: TODAY });
  const r2 = await E2.Workbook.read(toAB(fs.readFileSync(edited))); E2.Store.load(r2.state);
  assert.equal(E2.Store.client(cl.code).name, cl.name, 'original tenant keeps the name');
  assert.equal(E2.Store.unit(u.code).label, u.label, 'original unit keeps the label');
  const orig = E2.Store.contract(c.code); assert.equal(orig.start, c.start); assert.equal(orig.end, c.end);
  const nu = r2.state.units.find(x => x.label === '777'); assert.ok(nu, 'new unit created');
  const nc = r2.state.contracts.find(x => x.unitCode === nu.code); assert.ok(nc && nc.code !== c.code && nc.start === '2026-03-01');
  const ncl = E2.Store.client(nc.clientCode); assert.equal(ncl.name, 'مستأجر جديد منسوخ');
  assert.ok((r2.flags || r2.state.flags).some(f => f.sev === 'warn' && /الأكواد القديمة/.test(f.text)));
  assert.equal(E2.Store.paymentsOf(nc.code).length, 1);
});
