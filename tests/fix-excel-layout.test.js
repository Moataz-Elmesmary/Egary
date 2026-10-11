// تخطيط الإكسيل الجديد (عناوين مفهومة + معادلات حية): توافق العناوين القديمة، ثبات الكتابة، سلامة المعادلات،
// تطابق النتائج المخزَّنة مع المحرّك، الحالات الحدّية، تجاهل الأعمدة التلقائية عند القراءة، صفوف الشهر غير المقروء،
// الأعمدة الإضافية من المكتب، مرادفات الإعدادات، الألوان والملاحظات، عناوين Power Query، والأداء.
// (ما يحتاج إعادة حساب فعلية في LibreOffice موجود في tests/formulas.test.js)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { load, readFile, SOURCE, ROOT } = require('./helpers/env');
const X = require(path.join(ROOT, 'assets/vendor/exceljs.min.js'));
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const FIX_V2 = path.join(__dirname, 'fixtures', 'egary-v2-headers.xlsx'); // ملف الإصدار السابق (الأعمدة «(محسوب)» الثابتة)
const PQ = path.join(ROOT, 'powerbi', 'EgaryQueries.pq');
const TODAY = '2026-10-10';
const py = (script, ...args) => JSON.parse(execFileSync('python3', ['-I', '-c', script, ...args], { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 }));
const toAB = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const save = (name, buf) => { const f = path.join(OUT, name); fs.writeFileSync(f, Buffer.from(buf)); return f; };
const sortedState = s => JSON.stringify({
  p: s.projects, u: s.units, c: s.clients,
  k: s.contracts.map(c => ({ ...c, createdAt: '', ledgerOrder: 0 })).sort((a, b) => a.code.localeCompare(b.code)),
  pay: s.payments.map(p => ({ ...p, createdAt: '' })).sort((a, b) => a.code.localeCompare(b.code)),
  m: s.maintenance, set: { ...s.settings, codeSeq: undefined },
});
/* القيم المخزَّنة كما يراها openpyxl (data_only): {ورقة: [صف {عنوان: قيمة, _formulas: {عنوان: معادلة}, _row}]} — التواريخ بصيغة ISO و'' للفراغ.
   (قراءة ExcelJS تُسقط نتيجة المعادلة عندما تكون 0، لذا المقارنات الرقمية كلها عبر openpyxl) */
const PY_DUMP = `
import sys, json, openpyxl, datetime
wb = openpyxl.load_workbook(sys.argv[1], data_only=True); wf = openpyxl.load_workbook(sys.argv[1])
out = {}
for name in sys.argv[2].split('|'):
    ws = wb[name]; hr = 2 if name.isdigit() else 1
    heads = [c.value for c in ws[hr]]; rows = []
    for r in range(hr + 1, ws.max_row + 1):
        o = {}; f = {}
        for i, h in enumerate(heads):
            if h is None: continue
            v = ws.cell(r, i + 1).value
            if isinstance(v, datetime.datetime): v = v.date().isoformat()
            elif isinstance(v, datetime.date): v = v.isoformat()
            elif v is None: v = ''
            o[h] = v
            fv = wf[name].cell(r, i + 1).value
            if isinstance(fv, str) and fv.startswith('='): f[h] = fv[1:]
        o['_formulas'] = f; o['_row'] = r; rows.append(o)
    out[name] = rows
print(json.dumps(out, ensure_ascii=False, default=str))
`;
const dump = (file, sheets) => py(PY_DUMP, file, sheets.join('|'));
const near = (a, b, msg) => assert.ok(typeof a === 'number' && Math.abs(a - b) < 1e-9, `${msg}: ${a} ≈ ${b}`);
/* قيمة خلية ExcelJS: نتيجة المعادلة المخزَّنة أو القيمة نفسها ('' للفراغ) */
const val = (c) => { const v = c && c.value !== undefined ? c.value : c; if (v && typeof v === 'object' && !(v instanceof Date) && ('formula' in v || 'sharedFormula' in v)) return v.result == null ? '' : v.result; return v == null ? '' : v; };
const fml = (c) => { const v = c.value; return v && typeof v === 'object' && v.formula ? v.formula : null; };
const iso = (v) => v instanceof Date ? v.toISOString().slice(0, 10) : v;
async function book(buf) { const wb = new X.Workbook(); await wb.xlsx.load(buf); return wb; }
function hdr(ws, row) { const h = {}; ws.getRow(row || 1).eachCell((c, i) => { h[String(c.value).trim()] = i; }); return h; }
function rowOf(ws, h, col, code) { for (let r = 2; r <= ws.rowCount; r++) if (String(val(ws.getRow(r).getCell(h[col]))) === code) return r; return 0; }
/* صف كيان ككائن {عنوان: قيمة} من ملف مكتوب */
function rowObj(ws, h, r) { const o = {}; for (const k of Object.keys(h)) o[k] = val(ws.getRow(r).getCell(h[k])); return o; }
async function demoState(E) { const { state } = await E.Workbook.read(readFile(SOURCE)); E.Store.load(state); return state; }

/* حالة حدّية صناعية (نفس حالات النموذج الأولي): ذكرى 29 فبراير، عقد مستقبلي، تواريخ معكوسة، إيجار يدوي، سلسلة تقريب 7.5٪،
   تجديد خلال 90 يومًا، وحدة شاغرة بحجز قادم، عقدان سابقان بترتيب معكوس، عقد 21 سنة، صيانة بتاريخ فارغ وبعقد مكتوب، عميل بلا عقود، مشروع بلا وحدات */
function edgeState(E) {
  const M = E.M, B = M.blank; const st = M.emptyState();
  st.projects.push(Object.assign(B.projects(), { code: 'P01', name: 'برج الاختبار' })); st.projects.push(Object.assign(B.projects(), { code: 'P02', name: 'مشروع بلا وحدات' }));
  for (const u of ['U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U8', 'U9']) st.units.push(Object.assign(B.units(), { code: 'P01-' + u, projectCode: 'P01', label: u, type: 'commercial', createdAt: '2025-01-01' }));
  st.clients.push(Object.assign(B.clients(), { code: 'C001', name: 'عميل أ' })); st.clients.push(Object.assign(B.clients(), { code: 'C002', name: 'عميل بلا عقود' }));
  const K = (code, unit, start, end, rent, pct, ov, extra) => st.contracts.push(Object.assign(B.contracts(), { code, unitCode: 'P01-' + unit, clientCode: 'C001', start, end, rent, increasePct: pct, rentOverrides: ov || {}, dueDay: 1 }, extra || {}));
  K('T0001', 'U1', '2024-02-29', '2028-02-28', 1000, 10);                       // ذكرى 29 فبراير
  K('T0002', 'U2', '2026-12-01', '2027-11-30', 5000, 10);                       // لم يبدأ
  K('T0003', 'U3', '2025-01-01', '2025-12-31', 2000, 0);                        // انتهى ثم حجز قادم على نفس الوحدة
  K('T0004', 'U3', '2026-12-01', '2027-11-30', 2500, 0);
  K('T0005', 'U5', '2024-03-01', '2027-02-28', 76000, 10, { 2: 83600, 3: 91960 }); // إيجار يدوي
  K('T0006', 'U6', '2026-05-01', '2025-04-30', 3000, 10);                       // النهاية قبل البداية
  K('T0007', 'U7', '2021-06-15', '2026-06-14', 12345, 7.5);                     // سلسلة تقريب
  K('T0008', 'U4', '2025-11-01', '2026-10-31', 4000, 10);                       // ينتهي خلال 90 يومًا لكنه مجدَّد
  K('T0009', 'U4', '2026-11-01', '2027-10-31', 4400, 10, {}, { prevCode: 'T0008' });
  K('T0010', 'U8', '2010-01-01', '2030-12-31', 500, 0);                         // 21 سنة (أطول من كتلة الـ10 سنوات)
  K('T0011', 'U9', '2024-01-01', '2024-12-31', 900, 0);                         // عقدان سابقان بترتيب معكوس
  K('T0012', 'U9', '2022-01-01', '2022-12-31', 800, 0);
  const P = (code, contractCode, period, amount) => st.payments.push(Object.assign(B.payments(), { code, contractCode, period, amount, source: 'web' }));
  P('INV-2026-0001', 'T0005', '2026-09', 91960); P('INV-2026-0002', 'T0005', '2026-08', 91960); P('INV-2026-0003', 'T0001', '2026-08', 1210); P('INV-2026-0004', 'T0010', '2026-01', 500);
  const Mn = (code, unit, date, extra) => st.maintenance.push(Object.assign(B.maintenance(), { code, unitCode: 'P01-' + unit, date, description: code }, extra || {}));
  Mn('M0001', 'U3', '2025-06-15'); Mn('M0002', 'U3', '2026-06-15'); Mn('M0003', 'U5', ''); Mn('M0004', 'U5', '2026-01-10', { custodianContract: 'T0001', custodianName: 'اسم مكتوب' });
  st.settings.ledgerYears = [2026]; st.settings.trackingFrom = '2026-01';
  return st;
}
/* حالة كبيرة للأداء: 5 مشاريع × 120 وحدة × 100 عميل × 100 عقد على 3 سنوات × 1500 دفعة */
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

test('[A1] header compatibility: the previous «(محسوب)» layout, the owner\'s original file, and alternative spellings are read without «أعمدة إضافية» flags; the rewrite drops the retired headers and keeps the state', async () => {
  const E = load({ today: TODAY });
  for (const [name, src] of [['v2', FIX_V2], ['source', SOURCE]]) {
    const r1 = await E.Workbook.read(readFile(src)); E.Store.load(r1.state);
    assert.equal(r1.flags.filter(f => /أعمدة إضافية من المكتب/.test(f.text)).length, 0, name + ': no office-extras flag');
    assert.deepEqual(Object.keys(r1.state._extra || {}), [], name + ': nothing captured as extras');
    const out = await E.Workbook.write(r1.state);
    const r2 = await E.Workbook.read(out);
    assert.equal(sortedState(r2.state), sortedState(r1.state), name + ': state survives the rewrite');
    const wb = await book(out);
    for (const ws of wb.worksheets) { const heads = []; ws.getRow(/^\d{4}$/.test(ws.name) ? 2 : 1).eachCell(c => heads.push(String(c.value))); assert.ok(!heads.some(h => /\(محسوب\)/.test(h)), ws.name + ': no «(محسوب)» header'); for (const ret of ['مفتاح الحالة (محسوب)', 'جدول السنوات (محسوب)']) assert.ok(!heads.includes(ret), ws.name + ': retired header gone'); }
  }
  // عناوين بديلة (الإملاء الآخر من التصميم): تُقرأ كمرادفات ولا تُعدّ أعمدة إضافية
  const base = await demoState(E); const out = await E.Workbook.write(base);
  const alt = save('alt_spelling.xlsx', out);
  py(`
import sys, openpyxl, json
wb = openpyxl.load_workbook(sys.argv[1])
ren = {'الوحدات': {'حالة الوحدة اليوم': 'الحالة (محسوب)', 'الإيجار الشهري الحالي': 'الإيجار الحالي'}, 'العقود': {'المتأخرات (من البرنامج)': 'المتأخرات — من البرنامج', 'ترتيب الصف في ورقة السنة': 'ترتيب الورقة', 'مستنتج تلقائيًا من الورقة': 'مستنتج', 'الإيجار الشهري الحالي': 'الإيجار الحالي بعد الزيادات'}, 'العملاء': {'إجمالي المسدَّد': 'إجمالي المسدَّد حتى اليوم'}, 'المشاريع': {'المحصَّل في 2026': 'محصَّل السنة'}}
for sh, m in ren.items():
    ws = wb[sh]
    for c in ws[1]:
        if c.value in m: c.value = m[c.value]
s = wb['الإعدادات']
for r in range(2, s.max_row + 1):
    if s.cell(r, 1).value == 'تنبيه الشغور الطويل بعد (شهور)': s.cell(r, 1).value = 'عتبة الشغور الطويل (شهور)'
wb.save(sys.argv[1]); print('{}')`, alt);
  const r3 = await E.Workbook.read(toAB(fs.readFileSync(alt)));
  assert.equal(r3.flags.filter(f => /أعمدة إضافية من المكتب/.test(f.text)).length, 0, 'alt spellings are known synonyms');
  const r0 = await E.Workbook.read(out);
  assert.equal(sortedState(r3.state), sortedState(r0.state));
});

test('[A2] idempotence: read → write → read → write gives byte-equivalent sheets (values, formulas, numFmt, hidden) and equal states for both fixtures', async () => {
  const E = load({ today: TODAY });
  for (const [name, src] of [['v2', FIX_V2], ['source', SOURCE]]) {
    const r1 = await E.Workbook.read(readFile(src)); E.Store.load(r1.state);
    const o1 = await E.Workbook.write(r1.state);
    const r2 = await E.Workbook.read(o1); E.Store.load(r2.state);
    const f2 = save(`idem_${name}_2.xlsx`, await E.Workbook.write(r2.state));
    const r3 = await E.Workbook.read(toAB(fs.readFileSync(f2))); E.Store.load(r3.state);
    const f3 = save(`idem_${name}_3.xlsx`, await E.Workbook.write(r3.state));
    assert.equal(sortedState(r3.state), sortedState(r2.state), name + ': states equal');
    const diff = py(`
import sys, json, openpyxl
a = openpyxl.load_workbook(sys.argv[1]); b = openpyxl.load_workbook(sys.argv[2])
out = {'sheets_a': a.sheetnames, 'sheets_b': b.sheetnames, 'diffs': [], 'computed_headers': []}
for ws in a.worksheets:
    wb2 = b[ws.title]
    for row in ws.iter_rows():
        for c in row:
            if ws.title == 'الإعدادات' and ws.cell(c.row, 1).value == 'آخر كتابة من الموقع': continue
            d = wb2[c.coordinate]
            if c.value != d.value or c.number_format != d.number_format: out['diffs'].append((ws.title, c.coordinate, str(c.value)[:40], str(d.value)[:40], c.number_format, d.number_format))
    for k, dim in ws.column_dimensions.items():
        if bool(dim.hidden) != bool(wb2.column_dimensions[k].hidden): out['diffs'].append((ws.title, 'hidden', k))
    hr = 2 if ws.title.isdigit() else 1
    out['computed_headers'] += [str(c.value) for c in ws[hr] if c.value and '(محسوب)' in str(c.value)]
print(json.dumps(out, ensure_ascii=False, default=str))`, f2, f3);
    assert.deepEqual(diff.sheets_a, diff.sheets_b, name + ': same sheets');
    assert.deepEqual(diff.diffs, [], name + ': second and third writes are identical');
    assert.deepEqual(diff.computed_headers, [], name + ': no «(محسوب)» header');
  }
});

/* فاحص المعادلات (openpyxl Tokenizer): توازن الدوال، الدوال المسموحة فقط، مراجع الأوراق مقتبسة وموجودة، الحروف داخل عدد أعمدة الورقة،
   لا عمود كامل داخل SUMPRODUCT، وطول معقول */
const PY_TOKENS = `
import sys, json, re, openpyxl
from openpyxl.formula import Tokenizer
from openpyxl.utils import column_index_from_string
layout = json.load(open(sys.argv[2], encoding='utf-8'))
wb = openpyxl.load_workbook(sys.argv[1])
ALLOWED = set(layout['allowed'])
ncols = {name: len(cols) for name, cols in layout['sheets'].items()}
ref_re = re.compile(r"^(?:'([^']+)'!)?\\$?([A-Z]{1,3})\\$?(\\d+)?(?::\\$?([A-Z]{1,3})\\$?(\\d+)?)?$")
problems = []; nform = 0; funcs = set(); maxlen = 0
def width(title):
    if title.isdigit(): return ncols['{Y}']
    return ncols.get(title, 0) + layout.get('extras', {}).get(title, 0)
for ws in wb.worksheets:
    for row in ws.iter_rows():
        for c in row:
            if not (isinstance(c.value, str) and c.value.startswith('=')): continue
            nform += 1; f = c.value; maxlen = max(maxlen, len(f))
            if len(f) >= 1500: problems.append((ws.title, c.coordinate, 'too long', len(f)))
            depth = 0; sp = 0; stack = []
            for t in Tokenizer(f).items:
                if t.type == 'FUNC':
                    if t.subtype == 'OPEN':
                        fn = t.value[:-1].upper(); depth += 1; stack.append(fn); funcs.add(fn)
                        if fn == 'SUMPRODUCT': sp += 1
                        if fn not in ALLOWED: problems.append((ws.title, c.coordinate, 'function not allowed', fn))
                    else:
                        depth -= 1; fn = stack.pop() if stack else ''
                        if fn == 'SUMPRODUCT': sp -= 1
                elif t.type == 'OPERAND' and t.subtype == 'RANGE':
                    m = ref_re.match(t.value)
                    if not m: problems.append((ws.title, c.coordinate, 'unparsed ref', t.value)); continue
                    sh, c1, r1, c2, r2 = m.groups()
                    if '!' in t.value and not t.value.startswith("'"): problems.append((ws.title, c.coordinate, 'unquoted sheet', t.value))
                    target = sh or ws.title
                    if target not in wb.sheetnames: problems.append((ws.title, c.coordinate, 'unknown sheet', target))
                    w = width(target)
                    for cc in (c1, c2):
                        if cc and w and column_index_from_string(cc) > w: problems.append((ws.title, c.coordinate, 'column beyond layout', target, cc, w))
                    if sp > 0 and ':' in t.value and r1 is None: problems.append((ws.title, c.coordinate, 'whole column inside SUMPRODUCT', t.value))
            if depth != 0: problems.append((ws.title, c.coordinate, 'unbalanced'))
print(json.dumps({'formulas': nform, 'functions': sorted(funcs), 'maxlen': maxlen, 'problems': problems[:40], 'nproblems': len(problems)}, ensure_ascii=False, default=str))
`;
const ALLOWED = ['IF', 'AND', 'OR', 'NOT', 'ISNUMBER', 'IFERROR', 'COUNTIF', 'COUNTIFS', 'SUMIF', 'SUMIFS', 'SUMPRODUCT', 'MAX', 'MIN', 'INDEX', 'MATCH', 'ROW', 'SUM', 'TODAY', 'DATEDIF', 'DATE', 'YEAR', 'MONTH', 'DAY', 'ROUND', 'VALUE', 'MID', 'SEARCH', 'SUBSTITUTE', 'CHAR'];
function layoutFile(E, extras) { const lay = E.Workbook.layout(); const f = path.join(OUT, 'layout.json'); fs.writeFileSync(f, JSON.stringify({ allowed: ALLOWED, sheets: lay.sheets, extras: extras || {} })); return f; }

test('[A3] every formula tokenizes cleanly: only Excel-2016 functions, quoted existing sheets, columns inside the layout, bounded ranges in SUMPRODUCT; and the letters in each template hit the headers they are meant to reference', async () => {
  const E = load({ today: TODAY });
  const st = await demoState(E); st.maintenance.push(Object.assign(E.M.blank.maintenance(), { code: 'M0001', unitCode: 'P01-S1', date: '2026-03-15', description: 'x' }));
  const f = save('tokens_demo.xlsx', await E.Workbook.write(st));
  const res = py(PY_TOKENS, f, layoutFile(E));
  assert.deepEqual(res.problems, [], 'tokenizer problems'); assert.equal(res.nproblems, 0);
  assert.ok(res.formulas > 4000, 'formulas: ' + res.formulas); assert.ok(res.maxlen < 1500);
  for (const fn of res.functions) assert.ok(ALLOWED.includes(fn), fn);
  // الحروف داخل القوالب تشير إلى العناوين المقصودة (تُشتق من COLS فلا يمكن أن تنزاح)
  const lay = E.Workbook.layout(); const SH = E.Workbook.SH;
  const headerAt = (sheet, letter) => { const cols = lay.sheets[sheet]; const i = letter.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1; return cols[i] ? cols[i].header : '?'; };
  const refsOf = (tpl, selfSheet) => { const out = {}; const re = /(?:'([^']+)'!)?\$([A-Z]{1,3})(?:\$?(?:\d+|\{r\}|\{NC\}))?(?::\$([A-Z]{1,3})(?:\$?(?:\d+|\{r\}|\{NC\}))?)?/g; let m; while ((m = re.exec(tpl))) { const sh = m[1] || selfSheet; (out[sh] = out[sh] || new Set()).add(headerAt(sh, m[2])); if (m[3]) out[sh].add(headerAt(sh, m[3])); } return out; };
  const tplOf = (sheet, header) => lay.sheets[sheet].find(c => c.header === header).formulaTemplate;
  const expect = [
    [SH.units, 'المستأجر الحالي', { [SH.units]: ['العقد الحالي'], [SH.contracts]: ['العميل', 'كود العقد'] }],
    [SH.units, 'حالة الوحدة اليوم', { [SH.units]: ['العقد الحالي', 'الأيام المتبقية على نهاية العقد', 'نهاية العقد الحالي', 'كود الوحدة'], [SH.contracts]: ['كود الوحدة', 'بداية العقد'] }],
    [SH.units, 'العقد الحالي', { [SH.units]: ['كود الوحدة'], [SH.contracts]: ['كود العقد', 'الوحدة لو العقد ساري (للمعادلات)'] }],
    [SH.units, 'الإيجار الشهري الحالي', { [SH.contracts]: ['الإيجار الشهري الحالي', 'كود العقد'] }],
    [SH.units, 'شاغرة منذ', { [SH.units]: ['كود الوحدة', 'العقد الحالي', 'تاريخ الإضافة'], [SH.contracts]: ['كود الوحدة', 'نهاية العقد'] }],
    [SH.contracts, 'الإيجار الشهري الحالي', { [SH.contracts]: ['سنة العقد الحالية', 'إيجار السنة 1', 'إيجار السنة 10'] }],
    [SH.contracts, 'إجمالي المسدَّد', { [SH.payments]: ['المبلغ', 'كود العقد'] }],
    [SH.contracts, 'حالة العقد اليوم', { [SH.contracts]: ['بداية العقد', 'نهاية العقد', 'العقد السابق', 'كود الوحدة', 'كود العقد'] }],
    [SH.contracts, 'إيجار السنة 2', { [SH.contracts]: ['مفتاح الإيجار اليدوي (للمعادلات)', 'عدد سنوات العقد', 'إيجار السنة 1', 'الزيادة السنوية %'] }],
    [SH.contracts, 'إيجار السنة 1', { [SH.contracts]: ['مفتاح الإيجار اليدوي (للمعادلات)', 'الإيجار الشهري (السنة الأولى)'] }],
    [SH.contracts, 'كود المشروع', { [SH.units]: ['كود المشروع', 'كود الوحدة'] }],
    [SH.contracts, 'المشروع', { [SH.contracts]: ['كود المشروع'], [SH.projects]: ['اسم المشروع', 'كود المشروع'] }],
    [SH.clients, 'إجمالي المسدَّد', { [SH.contracts]: ['إجمالي المسدَّد', 'كود العميل'] }],
    [SH.clients, 'عقود سارية اليوم', { [SH.contracts]: ['حالة العقد اليوم', 'كود العميل'] }],
    [SH.projects, 'مؤجَّرة اليوم', { [SH.units]: ['كود المشروع', 'حالة الوحدة اليوم'] }],
    [SH.projects, 'المتأخرات (من البرنامج)', { [SH.contracts]: ['المتأخرات (من البرنامج)', 'كود المشروع'] }],
    [SH.projects, 'المحصَّل في {Y}', { '{Y}': ['كود المشروع', 'الاجمالي'] }],
    [SH.payments, 'العميل', { [SH.contracts]: ['العميل', 'كود العقد'] }],
    [SH.payments, 'المشروع', { [SH.contracts]: ['المشروع', 'كود العقد'] }],
    [SH.maintenance, 'العقد وقت الصيانة', { [SH.maintenance]: ['العقد وقتها', 'التاريخ', 'كود الوحدة'], [SH.contracts]: ['كود الوحدة', 'بداية العقد', 'نهاية العقد', 'كود العقد'] }],
    [SH.maintenance, 'المستأجر وقت الصيانة', { [SH.maintenance]: ['المستأجر وقتها', 'العقد وقت الصيانة'], [SH.contracts]: ['العميل', 'كود العقد'] }],
    [SH.summary, 'المحصَّل في {Y}', { '{Y}': ['كود المشروع', 'الاجمالي'], [SH.summary]: ['كود المشروع'] }],
    [SH.summary, 'مؤجَّرة اليوم', { [SH.units]: ['كود المشروع', 'حالة الوحدة اليوم'], [SH.summary]: ['كود المشروع'] }],
  ];
  for (const [sheet, header, want] of expect) {
    const tpl = tplOf(sheet, header); assert.ok(tpl, sheet + '/' + header + ' has a template');
    const got = refsOf(tpl, sheet);
    for (const sh of Object.keys(want)) for (const h of want[sh]) assert.ok(got[sh] && got[sh].has(h), `${sheet}/${header}: expected a reference to ${sh}!«${h}» — got ${JSON.stringify(Object.fromEntries(Object.entries(got).map(([k, v]) => [k, [...v]])))}`);
  }
});

test('[A5] cached results equal the engine under the pinned date: contract status/rent/paid/arrears/schedule, unit status/tenant/contract/rent/vacancy, client and project roll-ups, summary', async () => {
  const E = load({ today: TODAY }); const En = E.Engine, S = E.Store, U = E.U, W = E.Workbook;
  const st = await demoState(E); const asOf = U.today();
  const f = save('cached_demo.xlsx', await E.Workbook.write(st));
  const D = dump(f, [W.SH.contracts, W.SH.units, W.SH.clients, W.SH.projects, W.SH.summary, '2026']);
  const find = (sheet, key, code) => { const o = D[sheet].find(x => x[key] === code); assert.ok(o, sheet + '/' + code); return o; };
  // العقود
  let n = 0;
  for (const c of st.contracts) { const o = find(W.SH.contracts, 'كود العقد', c.code); const sch = En.schedule(c); n++;
    assert.equal(o['حالة العقد اليوم'], En.CSTATUS_AR[En.contractStatus(c, asOf)], c.code + ' status');
    assert.equal(o['الإيجار الشهري الحالي'], En.currentRent(c, asOf), c.code + ' current rent');
    assert.equal(o['إجمالي المسدَّد'], U.round2(U.sum(S.paymentsOf(c.code), p => U.toNum(p.amount))), c.code + ' paid == Σ payments (no unread rows)');
    assert.equal(o['المتأخرات (من البرنامج)'], U.round2(En.arrears({ contracts: [c], contractSet: new Set([c.code]) }, asOf).total), c.code + ' arrears');
    assert.equal(o['عدد سنوات العقد'], sch.length, c.code + ' years');
    for (let k = 1; k <= 10; k++) assert.equal(o['إيجار السنة ' + k], sch[k - 1] ? sch[k - 1].rent : '', c.code + ' year ' + k);
    const kIdx = o['سنة العقد الحالية']; assert.ok(kIdx >= 1 && kIdx <= sch.length, c.code + ' year index'); assert.equal(sch[kIdx - 1].rent, En.currentRent(c, asOf), c.code + ' rent of the current contract year');
    assert.equal(o['الأيام المتبقية على نهاية العقد'], U.daysBetween(asOf, U.d(c.end)), c.code + ' days left');
    assert.equal(o['تاريخ الزيادة القادمة'], kIdx < sch.length ? sch[kIdx].from : '', c.code + ' next increase');
    assert.equal(o['الإيجار بعد الزيادة القادمة'], kIdx < sch.length ? sch[kIdx].rent : '', c.code + ' next rent');
    assert.equal(o['كود المشروع'], (S.unit(c.unitCode) || {}).projectCode, c.code + ' project code');
    assert.equal(o['الوحدة لو العقد ساري (للمعادلات)'], En.contractStatus(c, asOf) === 'active' ? c.unitCode : '', c.code + ' active key');
    assert.equal(o['مفتاح الإيجار اليدوي (للمعادلات)'], ';' + W.fmtOverrides(c.rentOverrides).replace(/ /g, '') + ';', c.code + ' override key');
    assert.equal(o['المشروع'], S.project(S.unit(c.unitCode).projectCode).name, c.code + ' project name'); assert.equal(o['العميل'], S.client(c.clientCode).name, c.code + ' client name');
  } assert.equal(n, 86);
  // الوحدات
  for (const u of st.units) { const o = find(W.SH.units, 'كود الوحدة', u.code); const s = En.unitStatus(u, asOf);
    assert.equal(o['حالة الوحدة اليوم'], En.USTATUS_AR[s.status], u.code); assert.equal(o['العقد الحالي'], s.contract ? s.contract.code : '', u.code);
    assert.equal(o['المستأجر الحالي'], s.contract ? S.client(s.contract.clientCode).name : '', u.code); assert.equal(o['الإيجار الشهري الحالي'], s.contract ? En.currentRent(s.contract, asOf) : '', u.code);
    assert.equal(o['شاغرة منذ'], s.contract ? '' : (s.vacantSince || ''), u.code + ' vacant since'); assert.equal(o['أيام الشغور'], s.contract ? '' : (s.vacantDays == null ? '' : s.vacantDays), u.code + ' vacant days');
    assert.equal(o['نهاية العقد الحالي'], s.contract ? s.contract.end : '', u.code); assert.equal(o['الأيام المتبقية على نهاية العقد'], s.contract ? s.daysLeft : '', u.code);
    assert.equal(o['المشروع'], S.project(u.projectCode).name, u.code); }
  // العملاء
  for (const cl of st.clients) { const o = find(W.SH.clients, 'كود العميل', cl.code); const cs = S.contractsOfClient(cl.code);
    assert.equal(o['عدد العقود'], cs.length, cl.code); assert.equal(o['عقود سارية اليوم'], cs.filter(c => En.contractStatus(c, asOf) === 'active').length, cl.code);
    assert.equal(o['المتأخرات (من البرنامج)'], U.round2(En.arrears({ contracts: cs, contractSet: new Set(cs.map(c => c.code)) }, asOf).total), cl.code);
    assert.equal(o['إجمالي المسدَّد'], U.round2(U.sum(cs, c => U.sum(S.paymentsOf(c.code), p => U.toNum(p.amount)))), cl.code); }
  // المشاريع والملخص: «المحصَّل في 2026» = مجموع عمود الاجمالي لصفوف المشروع في ورقة السنة
  for (const p of st.projects) { const k = En.kpis({ projectCode: p.code }, asOf); const o = find(W.SH.projects, 'كود المشروع', p.code);
    assert.equal(o['عدد الوحدات'], k.occupancy.total); assert.equal(o['مؤجَّرة اليوم'], k.occupancy.occupiedCount); assert.equal(o['شاغرة اليوم'], k.occupancy.vacant.length);
    assert.equal(o['المتأخرات (من البرنامج)'], U.round2(k.arrears.total)); near(o['نسبة الإشغال'], k.occupancy.rate, p.code + ' rate');
    const rows = D['2026'].filter(x => x['كود المشروع'] === p.code); const sumW = U.round2(U.sum(rows, x => x['الاجمالي'] || 0));
    assert.equal(o['المحصَّل في 2026'], sumW, p.code + ' collected in 2026 = Σ row totals of the year sheet'); assert.ok(sumW > 0);
    const so = find(W.SH.summary, 'كود المشروع', p.code);
    assert.equal(so['عدد العقود في ورقة 2026'], rows.length); assert.equal(so['المحصَّل في 2026'], sumW); assert.equal(so['عدد الوحدات'], k.occupancy.total); assert.equal(so['مؤجَّرة اليوم'], k.occupancy.occupiedCount); assert.equal(so['شاغرة اليوم'], k.occupancy.vacant.length); assert.equal(so['المتأخرات (من البرنامج)'], U.round2(k.arrears.total)); near(so['نسبة الإشغال'], k.occupancy.rate, p.code + ' summary rate'); }
  const tot = D[W.SH.summary][D[W.SH.summary].length - 1]; assert.equal(tot['المشروع'], 'الاجمالي'); assert.equal(tot['عدد الوحدات'], st.units.length); assert.equal(tot['المحصَّل في 2026'], U.round2(U.sum(D['2026'].filter(x => /^T\d{4}$/.test(String(x['كود العقد']))), x => x['الاجمالي'] || 0)));
});

test('[A6] edge-case state: leap-day anniversary, future and reversed contracts, overrides, the 7.5 % rounding chain, renewal within 90 days, out-of-order past contracts, a 21-year contract, maintenance lookups, a client without contracts and a project without units', async () => {
  const E = load({ today: TODAY }); const U = E.U, W = E.Workbook;
  const st = edgeState(E); E.Store.load(st);
  const f = save('edge.xlsx', await E.Workbook.write(st));
  const D = dump(f, [W.SH.contracts, W.SH.units, W.SH.clients, W.SH.projects, W.SH.maintenance, W.SH.summary]);
  const row = code => D[W.SH.contracts].find(o => o['كود العقد'] === code);
  const t1 = row('T0001'); assert.equal(t1['حالة العقد اليوم'], 'ساري'); assert.equal(t1['عدد سنوات العقد'], 4); assert.equal(t1['سنة العقد الحالية'], 3); assert.equal(t1['الإيجار الشهري الحالي'], 1210); assert.equal(t1['تاريخ الزيادة القادمة'], '2027-03-01', '29 Feb rolls to 1 March like the engine'); assert.equal(t1['الإيجار بعد الزيادة القادمة'], 1331);
  assert.deepEqual([1, 2, 3, 4, 5].map(k => t1['إيجار السنة ' + k]), [1000, 1100, 1210, 1331, '']);
  const t2 = row('T0002'); assert.equal(t2['حالة العقد اليوم'], 'لم يبدأ'); assert.equal(t2['سنة العقد الحالية'], 1); assert.equal(t2['عدد سنوات العقد'], 1); assert.equal(t2['تاريخ الزيادة القادمة'], ''); assert.equal(t2['الإيجار بعد الزيادة القادمة'], ''); assert.equal(t2['الوحدة لو العقد ساري (للمعادلات)'], ''); assert.equal(t2['الإيجار الشهري الحالي'], 5000);
  assert.equal(row('T0003')['حالة العقد اليوم'], 'منتهٍ (أُجِّرت بعده)'); assert.equal(row('T0004')['حالة العقد اليوم'], 'لم يبدأ');
  const t5 = row('T0005'); assert.deepEqual([1, 2, 3, 4].map(k => t5['إيجار السنة ' + k]), [76000, 83600, 91960, '']); assert.equal(t5['الإيجار الشهري الحالي'], 91960); assert.equal(t5['مفتاح الإيجار اليدوي (للمعادلات)'], ';2:83600;3:91960;'); assert.equal(t5['تاريخ الزيادة القادمة'], ''); assert.equal(t5['إجمالي المسدَّد'], 183920);
  const t6 = row('T0006'); assert.equal(t6['حالة العقد اليوم'], 'منتهٍ', 'reversed dates: not renewed by its own row'); assert.equal(t6['عدد سنوات العقد'], ''); assert.equal(t6['سنة العقد الحالية'], ''); assert.equal(t6['الإيجار الشهري الحالي'], ''); assert.equal(t6['إيجار السنة 1'], ''); assert.ok(t6['الأيام المتبقية على نهاية العقد'] < 0);
  const t7 = row('T0007'); assert.deepEqual([1, 2, 3, 4, 5, 6].map(k => t7['إيجار السنة ' + k]), [12345, 13271, 14266, 15336, 16486, '']); assert.equal(t7['الإيجار الشهري الحالي'], 16486); assert.equal(t7['حالة العقد اليوم'], 'منتهٍ'); assert.equal(t7['سنة العقد الحالية'], 5);
  const t8 = row('T0008'); assert.equal(t8['حالة العقد اليوم'], 'ساري'); assert.equal(t8['الأيام المتبقية على نهاية العقد'], 21); assert.equal(t8['الوحدة لو العقد ساري (للمعادلات)'], 'P01-U4');
  const t10 = row('T0010'); assert.equal(t10['عدد سنوات العقد'], 21); assert.equal(t10['سنة العقد الحالية'], 17); assert.equal(t10['الإيجار الشهري الحالي'], 500); assert.deepEqual([1, 5, 10].map(k => t10['إيجار السنة ' + k]), [500, 500, 500]); assert.equal(t10['تاريخ الزيادة القادمة'], '2027-01-01'); assert.equal(t10['الإيجار بعد الزيادة القادمة'], 500);
  assert.match(t10._formulas['الإيجار الشهري الحالي'], />10,500,INDEX/, 'beyond 10 years the engine value is embedded as a literal'); assert.match(t10._formulas['الإيجار بعد الزيادة القادمة'], /\+1>10,500,INDEX/);
  assert.equal(row('T0011')['حالة العقد اليوم'], 'منتهٍ'); assert.equal(row('T0012')['حالة العقد اليوم'], 'منتهٍ (أُجِّرت بعده)');
  // الوحدات
  const unit = code => D[W.SH.units].find(o => o['كود الوحدة'] === code);
  const u1 = unit('P01-U1'); assert.equal(u1['حالة الوحدة اليوم'], 'مؤجَّرة'); assert.equal(u1['المستأجر الحالي'], 'عميل أ'); assert.equal(u1['العقد الحالي'], 'T0001'); assert.equal(u1['الإيجار الشهري الحالي'], 1210); assert.equal(u1['شاغرة منذ'], ''); assert.equal(u1['أيام الشغور'], ''); assert.equal(u1['نهاية العقد الحالي'], '2028-02-28'); assert.equal(u1['الأيام المتبقية على نهاية العقد'], U.daysBetween(U.d(TODAY), U.d('2028-02-28')));
  const u2 = unit('P01-U2'); assert.equal(u2['حالة الوحدة اليوم'], 'شاغرة'); assert.equal(u2['شاغرة منذ'], '2025-01-01', 'no past contract ⇒ تاريخ الإضافة'); assert.equal(u2['أيام الشغور'], U.daysBetween(U.d('2025-01-01'), U.d(TODAY)));
  const u3 = unit('P01-U3'); assert.equal(u3['حالة الوحدة اليوم'], 'شاغرة'); assert.equal(u3['شاغرة منذ'], '2026-01-01', 'ended contract + 1 day, the future booking does not count'); assert.equal(u3['أيام الشغور'], 282);
  const u4 = unit('P01-U4'); assert.equal(u4['حالة الوحدة اليوم'], 'مؤجَّرة', 'ends within 90 days but renewed'); assert.equal(u4['العقد الحالي'], 'T0008'); assert.equal(u4['الأيام المتبقية على نهاية العقد'], 21);
  assert.equal(unit('P01-U5')['الإيجار الشهري الحالي'], 91960);
  assert.equal(unit('P01-U6')['شاغرة منذ'], '2025-05-01', 'reversed contract counts as a past contract by its end date');
  const u7 = unit('P01-U7'); assert.equal(u7['شاغرة منذ'], '2026-06-15'); assert.equal(u7['أيام الشغور'], U.daysBetween(U.d('2026-06-15'), U.d(TODAY)));
  assert.equal(unit('P01-U9')['شاغرة منذ'], '2025-01-01', 'MAX(end) of out-of-order past contracts');
  assert.equal(E.Engine.unitStatus(E.Store.unit('P01-U9')).last.code, 'T0011', 'engine: last contract = latest end, not last row');
  // العملاء والمشاريع والصيانة والملخص
  const c1 = D[W.SH.clients].find(o => o['كود العميل'] === 'C001'), c2 = D[W.SH.clients].find(o => o['كود العميل'] === 'C002');
  assert.equal(c1['عدد العقود'], 12); assert.equal(c1['عقود سارية اليوم'], 4); assert.equal(c1['إجمالي المسدَّد'], 183920 + 1210 + 500);
  assert.deepEqual([c2['عدد العقود'], c2['عقود سارية اليوم'], c2['المتأخرات (من البرنامج)'], c2['إجمالي المسدَّد']], [0, 0, 0, 0]);
  const p1 = D[W.SH.projects].find(o => o['كود المشروع'] === 'P01'), p2 = D[W.SH.projects].find(o => o['كود المشروع'] === 'P02');
  assert.deepEqual([p1['عدد الوحدات'], p1['مؤجَّرة اليوم'], p1['شاغرة اليوم']], [9, 4, 5]); near(p1['نسبة الإشغال'], 4 / 9, 'P01 rate'); assert.equal(p1['المحصَّل في 2026'], 185630);
  assert.deepEqual([p2['عدد الوحدات'], p2['مؤجَّرة اليوم'], p2['شاغرة اليوم'], p2['المتأخرات (من البرنامج)'], p2['المحصَّل في 2026'], p2['نسبة الإشغال']], [0, 0, 0, 0, 0, '']);
  const mt = code => D[W.SH.maintenance].find(o => o['كود الصيانة'] === code);
  assert.equal(mt('M0001')['العقد وقت الصيانة'], 'T0003'); assert.equal(mt('M0001')['المستأجر وقت الصيانة'], 'عميل أ');
  assert.equal(mt('M0002')['العقد وقت الصيانة'], ''); assert.equal(mt('M0002')['المستأجر وقت الصيانة'], '');
  assert.equal(mt('M0003')['العقد وقت الصيانة'], 'T0005', 'blank date ⇒ today\'s contract');
  assert.equal(mt('M0004')['العقد وقت الصيانة'], 'T0001', 'typed contract wins verbatim'); assert.equal(mt('M0004')['المستأجر وقت الصيانة'], 'اسم مكتوب');
  const s1 = D[W.SH.summary].find(o => o['كود المشروع'] === 'P01'); assert.equal(s1['عدد العقود في ورقة 2026'], 8); assert.equal(s1['المحصَّل في 2026'], 185630); assert.equal(s1['مؤجَّرة اليوم'], 4);
  const tot = D[W.SH.summary][D[W.SH.summary].length - 1]; assert.equal(tot['عدد الوحدات'], 9); near(tot['نسبة الإشغال'], 4 / 9, 'totals row ratio');
});

test('[A8] the reader ignores auto columns whatever is typed into them: a status, an arrears number, a count, a constant over a formula and a wrong project name over a coded row all leave the state unchanged, and the next write restores the formulas', async () => {
  const E = load({ today: TODAY });
  const st = await demoState(E); const clean = save('ignore_clean.xlsx', await E.Workbook.write(st));
  const r0 = await E.Workbook.read(toAB(fs.readFileSync(clean)));
  const edited = save('ignore_edited.xlsx', fs.readFileSync(clean));
  const info = py(`
import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1])
def H(ws): return {str(c.value).strip(): c.column for c in ws[1] if c.value}
u = wb['الوحدات']; h = H(u); vac = next(r for r in range(2, u.max_row + 1) if str(u.cell(r, h['العقد الحالي']).value).startswith('=IF') and u.cell(r, h['كود الوحدة']).value == sys.argv[2])
u.cell(vac, h['حالة الوحدة اليوم']).value = 'مؤجَّرة'; u.cell(vac, h['المستأجر الحالي']).value = 'شخص وهمي'
k = wb['العقود']; hk = H(k); k.cell(2, hk['المتأخرات (من البرنامج)']).value = 999; k.cell(2, hk['إجمالي المسدَّد']).value = 5; k.cell(2, hk['المشروع']).value = 'مشروع خطأ'; k.cell(3, hk['إيجار السنة 1']).value = 1
c = wb['العملاء']; hc = H(c); c.cell(2, hc['عدد العقود']).value = 42
wb.save(sys.argv[1]); print(json.dumps({'unit': u.cell(vac, h['كود الوحدة']).value}))`, edited, st.units.find(u => E.Engine.unitStatus(u).status === 'vacant').code);
  const r1 = await E.Workbook.read(toAB(fs.readFileSync(edited))); E.Store.load(r1.state);
  assert.equal(sortedState(r1.state), sortedState(r0.state), 'typed values in auto columns never reach the state');
  assert.equal(E.Engine.unitStatus(E.Store.unit(info.unit)).status, 'vacant');
  const out = save('ignore_out.xlsx', await E.Workbook.write(r1.state)); const D = dump(out, ['الوحدات', 'العقود', 'العملاء']);
  const u = D['الوحدات'].find(o => o['كود الوحدة'] === info.unit); assert.match(u._formulas['حالة الوحدة اليوم'], /^IF\(/); assert.equal(u['حالة الوحدة اليوم'], 'شاغرة'); assert.equal(u['المستأجر الحالي'], '');
  const k = D['العقود']; assert.match(k[0]._formulas['المشروع'], /^IF\(/); assert.match(k[1]._formulas['إيجار السنة 1'], /^IF\(/); assert.notEqual(k[0]['المتأخرات (من البرنامج)'], 999); assert.notEqual(k[0]['إجمالي المسدَّد'], 5); assert.notEqual(k[0]['المشروع'], 'مشروع خطأ');
  assert.notEqual(D['العملاء'][0]['عدد العقود'], 42);
});

test('[A10] a payment row whose month is unreadable: kept at the end of المدفوعات with a red month cell, excluded from the app (S.paymentsOf), but included in the contract\'s cached «إجمالي المسدَّد» exactly as Excel\'s SUMIFS will count it', async () => {
  const E = load({ today: TODAY }); const U = E.U, S = E.Store;
  const st = await demoState(E); const base = save('unread_base.xlsx', await E.Workbook.write(st));
  const code = 'T0001'; const before = U.sum(S.paymentsOf(code), p => U.toNum(p.amount));
  const edited = save('unread_edited.xlsx', fs.readFileSync(base));
  py(`
import sys, openpyxl
wb = openpyxl.load_workbook(sys.argv[1]); ws = wb['المدفوعات']; h = {str(c.value).strip(): c.column for c in ws[1] if c.value}
r = ws.max_row + 1; ws.cell(r, h['كود العقد']).value = sys.argv[2]; ws.cell(r, h['الشهر']).value = 'سبتمر 26'; ws.cell(r, h['المبلغ']).value = 777
wb.save(sys.argv[1]); print('{}')`, edited, code);
  const r1 = await E.Workbook.read(toAB(fs.readFileSync(edited))); E.Store.load(r1.state);
  assert.equal(r1.flags.filter(f => /غير مقروء/.test(f.text) && f.sev === 'danger').length, 1);
  assert.equal(U.sum(S.paymentsOf(code), p => U.toNum(p.amount)), before, 'the app does not count it');
  assert.equal((r1.state._unreadPayments || []).length, 1);
  const out = save('unread_out.xlsx', await E.Workbook.write(r1.state)); const wb = await book(toAB(fs.readFileSync(out))); const D = dump(out, ['العقود', 'العملاء', 'المدفوعات']);
  assert.equal(D['العقود'].find(o => o['كود العقد'] === code)['إجمالي المسدَّد'], U.round2(before + 777), 'cached total mirrors the SUMIFS (includes the unread row)');
  const pw = wb.getWorksheet('المدفوعات'), hp = hdr(pw); const last = pw.getRow(pw.rowCount); const lastD = D['المدفوعات'][D['المدفوعات'].length - 1];
  assert.equal(lastD['كود العقد'], code); assert.equal(lastD['الشهر'], 'سبتمر 26'); assert.equal(lastD['المبلغ'], 777); assert.equal(last.getCell(hp['الشهر']).fill.fgColor.argb, 'FFFFC7CE'); assert.ok(last.getCell(hp['الشهر']).note, 'note on the unread month cell');
  assert.match(lastD._formulas['العميل'], /^IF\(/, 'the name formula is written because the code is filled');
  const clientCode = S.contract(code).clientCode; const cs = S.contractsOfClient(clientCode);
  assert.equal(D['العملاء'].find(o => o['كود العميل'] === clientCode)['إجمالي المسدَّد'], U.round2(U.sum(cs, c => U.sum(S.paymentsOf(c.code), p => U.toNum(p.amount))) + 777), 'the client roll-up follows the contract cache');
});

test('[A11] office extras with the new layout: appended after the last program column (after the hidden helpers in العقود), values/numFmt/formula objects preserved across two round trips, users-sheet extras still a danger flag', async () => {
  const E = load({ today: TODAY });
  const st = await demoState(E); const base = save('extras_base.xlsx', await E.Workbook.write(st));
  const edited = save('extras_edited.xlsx', fs.readFileSync(base));
  py(`
import sys, openpyxl
wb = openpyxl.load_workbook(sys.argv[1])
k = wb['العقود']; lc = k.max_column + 1; k.cell(1, lc).value = 'ملاحظة داخلية'; k.cell(2, lc).value = 'سري'; k.cell(3, lc).value = '=1+1'
u = wb['الوحدات']; lu = u.max_column + 1; u.cell(1, lu).value = 'عداد الكهرباء'; u.cell(2, lu).value = 445566; u.cell(2, lu).number_format = '0'
p = wb['المدفوعات']; lp = p.max_column + 1; p.cell(1, lp).value = 'رقم الشيك'; p.cell(2, lp).value = 778899
us = wb['المستخدمون']; us.cell(1, us.max_column + 1).value = 'عمود غريب'
wb.save(sys.argv[1]); print('{}')`, edited);
  const r1 = await E.Workbook.read(toAB(fs.readFileSync(edited))); E.Store.load(r1.state);
  assert.equal(r1.flags.filter(f => /ورقة العقود: أعمدة إضافية من المكتب \(ملاحظة داخلية\)/.test(f.text)).length, 1);
  assert.equal(r1.flags.filter(f => /ورقة المستخدمون: أعمدة غير معروفة \(عمود غريب\)/.test(f.text) && f.sev === 'danger').length, 1);
  const check = async (buf) => {
    const wb = await book(buf); const W = E.Workbook;
    const k = wb.getWorksheet('العقود'), hk = hdr(k); assert.equal(hk['ملاحظة داخلية'], W.COLS.contracts.length + 1, 'after the helpers'); assert.equal(val(k.getRow(2).getCell(hk['ملاحظة داخلية'])), 'سري'); assert.equal(fml(k.getRow(3).getCell(hk['ملاحظة داخلية'])), '1+1');
    const u = wb.getWorksheet('الوحدات'), hu = hdr(u); assert.equal(hu['عداد الكهرباء'], W.COLS.units.length + 1); assert.equal(val(u.getRow(2).getCell(hu['عداد الكهرباء'])), 445566); assert.equal(u.getRow(2).getCell(hu['عداد الكهرباء']).numFmt, '0');
    const p = wb.getWorksheet('المدفوعات'), hp = hdr(p); assert.equal(hp['رقم الشيك'], W.COLS.payments.length + 1); assert.equal(val(p.getRow(2).getCell(hp['رقم الشيك'])), 778899);
    assert.equal(u.getRow(1).getCell(hu['عداد الكهرباء']).fill.fgColor.argb, 'FF1F4E78', 'office header keeps the input (blue) style');
  };
  const o1 = await E.Workbook.write(r1.state); await check(o1);
  const r2 = await E.Workbook.read(o1); E.Store.load(r2.state); await check(await E.Workbook.write(r2.state));
});

test('[A12] settings: old labels and English values are read as synonyms, Arabic words are written back, info rows and the legend are ignored, the format version is 3 and the detected last month is shown', async () => {
  const E = load({ today: TODAY });
  const st = await demoState(E); const base = save('settings_base.xlsx', await E.Workbook.write(st));
  const variant = async (name, edits) => {
    const f = save(`settings_${name}.xlsx`, fs.readFileSync(base));
    py(`
import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1]); ws = wb['الإعدادات']; edits = json.loads(sys.argv[2])
rows = {ws.cell(r, 1).value: r for r in range(2, ws.max_row + 1) if ws.cell(r, 1).value}
for cur, (label, value) in edits.items():
    r = rows[cur]; ws.cell(r, 1).value = label; ws.cell(r, 2).value = value
wb.save(sys.argv[1]); print('{}')`, f, JSON.stringify(edits));
    return E.Workbook.read(toAB(fs.readFileSync(f)));
  };
  const PB = 'حساب الشهر المقطوع (30 = على أساس 30 يومًا · فعلي = بأيام الشهر الحقيقية)', TM = 'بداية المحاسبة (تلقائي/يدوي)';
  const a = await variant('old_actual', { [PB]: ['أساس الشهر المقطوع (30 أو actual)', 'actual'], [TM]: [TM, 'manual'], 'تنبيه الشغور الطويل بعد (شهور)': ['عتبة الشغور الطويل (شهور)', 7], 'الزيادة السنوية المقترحة للعقود الجديدة %': ['الزيادة السنوية الافتراضية %', 12] });
  assert.equal(a.state.settings.prorationBasis, 'actual'); assert.equal(a.state.settings.trackingMode, 'manual'); assert.equal(a.state.settings.vacancyMonths, 7); assert.equal(a.state.settings.defaultIncreasePct, 12);
  const b = await variant('new_arabic', { [PB]: [PB, 'فعلي'], [TM]: [TM, 'يدوي'] });
  assert.equal(b.state.settings.prorationBasis, 'actual'); assert.equal(b.state.settings.trackingMode, 'manual');
  const c = await variant('auto', { [PB]: [PB, '30'], [TM]: [TM, 'تلقائي'] }); assert.equal(c.state.settings.prorationBasis, '30'); assert.equal(c.state.settings.trackingMode, 'auto');
  const d = await variant('auto_en', { [TM]: [TM, 'auto'] }); assert.equal(d.state.settings.trackingMode, 'auto');
  const e = await variant('blank', { [TM]: [TM, null] }); assert.equal(e.state.settings.trackingMode, undefined, 'blank stays blank');
  // الكتابة بالعربية
  E.Store.load(b.state); const out = await E.Workbook.write(b.state); const wb = await book(out); const ws = wb.getWorksheet('الإعدادات');
  const rows = {}; for (let r = 2; r <= ws.rowCount; r++) if (ws.getCell(r, 1).value) rows[ws.getCell(r, 1).value] = ws.getCell(r, 2).value;
  assert.equal(rows[PB], 'فعلي'); assert.equal(rows[TM], 'يدوي'); assert.equal(rows['إصدار تنسيق الملف'], 3); assert.equal(rows['إصدار البنية'], undefined);
  const et = E.Engine.enteredThrough(E.U.today()); assert.ok(String(rows['آخر شهر مسجَّل (كما اكتشفه البرنامج)']).includes(et), 'detected last month shown: ' + rows['آخر شهر مسجَّل (كما اكتشفه البرنامج)']);
  assert.ok('دليل ألوان العناوين' in rows && 'عنوان أزرق' in rows && 'عنوان أخضر' in rows && 'عنوان رمادي (من البرنامج)' in rows, 'legend rows present');
  for (const label of Object.keys(rows)) assert.ok(!/auto|manual|actual/.test(String(rows[label])), label + ': no English value');
  const r2 = await E.Workbook.read(out); assert.equal(r2.formatVersion, 3); assert.equal(sortedState(r2.state), sortedState(b.state), 'info rows and legend do not touch the state');
  E.Store.load(c.state); const r3 = await E.Workbook.read(await E.Workbook.write(c.state)); assert.equal(r3.state.settings.trackingMode, 'auto'); assert.equal(r3.state.settings.prorationBasis, '30');
  const old = await E.Workbook.read(readFile(FIX_V2)); assert.equal(old.formatVersion, 2, 'the legacy «إصدار البنية» row is read as the format version');
});

test('[A13] structure and visuals: header colours by kind, notes on every auto header, hidden helpers, collapsible rent block, validations, legend swatches, summary keyed by the code column, «المحصَّل في {Y}» over the year sheet', async () => {
  const E = load({ today: TODAY }); const W = E.Workbook;
  const st = await demoState(E); const f = save('visual.xlsx', await E.Workbook.write(st));
  const lay = W.layout();
  const info = py(`
import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1]); out = {'heads': {}, 'notes': {}}
for name in ['المشاريع', 'الوحدات', 'العملاء', 'العقود', 'المدفوعات', 'الصيانة', 'ملخص المشاريع', 'أصول الوحدات']:
    ws = wb[name]; out['heads'][name] = [(c.value, c.fill.fgColor.rgb if c.fill and c.fill.fill_type else None, bool(c.comment)) for c in ws[1] if c.value]
y = wb['2026']; out['year'] = {'W2': y['W2'].fill.fgColor.rgb, 'B2': y['B2'].fill.fgColor.rgb, 'K2note': bool(y['K2'].comment), 'W2note': bool(y['W2'].comment), 'Y2note': bool(y['Y2'].comment), 'B2note': bool(y['B2'].comment)}
k = wb['العقود']; hid = set(); ol = {}
from openpyxl.utils import get_column_letter
for dim in k.column_dimensions.values():   # ExcelJS يدمج الأعمدة المتجاورة المتشابهة في <col min max>
    if dim.min is None: continue
    for i in range(dim.min, dim.max + 1):
        if dim.hidden: hid.add(get_column_letter(i))
        ol[get_column_letter(i)] = dim.outline_level
out['hidden'] = [col for col in ['AN', 'AO'] if col in hid]; out['outline'] = [ol.get(col, 0) for col in ['AD', 'AM', 'AC', 'AN']]
out['validations'] = [(str(dv.sqref)[:12], dv.type, dv.formula1, dv.formula2, dv.error) for dv in k.data_validations.dataValidation if dv.type in ('decimal', 'whole')]
out['datacell'] = {'T2': (k['T2'].fill.fgColor.rgb, k['T2'].font.italic), 'W2': (k['W2'].fill.fgColor.rgb, k['W2'].font.italic), 'U2fmt': k['U2'].number_format, 'AD2fmt': k['AD2'].number_format, 'X2fmt': k['X2'].number_format}
s = wb['الإعدادات']; out['legend'] = [(s.cell(r, 1).value, s.cell(r, 1).fill.fgColor.rgb, s.cell(r, 2).value) for r in range(2, s.max_row + 1) if s.cell(r, 1).value in ('عنوان أزرق', 'عنوان أخضر', 'عنوان رمادي (من البرنامج)')]
out['legend_title'] = any(s.cell(r, 1).value == 'دليل ألوان العناوين' for r in range(2, s.max_row + 1))
out['codeSeq'] = [s.cell(r, 2).fill.fgColor.rgb for r in range(2, s.max_row + 1) if s.cell(r, 1).value == 'أعلى أرقام الأكواد الصادرة'][0]
sm = wb['ملخص المشاريع']; out['summary'] = {'B1': sm['B1'].value, 'C1': sm['C1'].value, 'B2': sm['B2'].value, 'C2': sm['C2'].value, 'H2': sm['H2'].value, 'I1': sm['I1'].value}
p = wb['المشاريع']; out['projK'] = (p['K1'].value, p['K2'].value)
u = wb['الوحدات']; out['unitO'] = (u['O1'].value, u.cell(2, 15).number_format)
print(json.dumps(out, ensure_ascii=False, default=str))`, f);
  const COLOR = { input: 'FF1F4E78', formula: 'FF548235', program: 'FF595959', helper: 'FF595959' };
  for (const name of Object.keys(info.heads)) {
    const spec = lay.sheets[name]; assert.equal(info.heads[name].length, spec.length, name + ' column count');
    info.heads[name].forEach(([text, rgb, hasNote], i) => {
      const col = spec[i]; assert.equal(text, col.header.replace('{Y}', '2026'), name + ' header ' + i);
      assert.equal(rgb, COLOR[col.kind], `${name}/${text}: colour of kind ${col.kind}`);
      if (col.kind !== 'input') assert.ok(hasNote, `${name}/${text}: auto header has a note`);
      else assert.equal(hasNote, !!col.note, `${name}/${text}: input header note only when the layout says so (keys, J/K, N/O)`);
    });
  }
  assert.equal(info.year.W2, 'FF548235'); assert.equal(info.year.B2, 'FF1F4E78'); assert.ok(info.year.K2note && info.year.W2note && info.year.Y2note && !info.year.B2note);
  assert.deepEqual(info.hidden, ['AN', 'AO']); assert.deepEqual(info.outline, [1, 1, 0, 0]);
  assert.ok(info.validations.some(v => v[1] === 'decimal' && v[2] === '0' && v[3] === '100' && /10 تعني 10%/.test(v[4])), JSON.stringify(info.validations));
  assert.ok(info.validations.some(v => v[1] === 'whole' && v[2] === '1' && v[3] === '31'));
  assert.deepEqual(info.datacell.T2, ['FFEBF1DE', false], 'formula cells: light green, upright'); assert.deepEqual(info.datacell.W2, ['FFEDEDED', true]); assert.equal(info.datacell.U2fmt, '#,##0.00'); assert.equal(info.datacell.AD2fmt, '#,##0.00'); assert.equal(info.datacell.X2fmt, '0');
  assert.deepEqual(info.legend.map(l => l[1]), ['FF1F4E78', 'FF548235', 'FF595959']); assert.deepEqual(info.legend.map(l => l[2]), ['تكتبه أنت', 'معادلة إكسيل', 'يحسبه البرنامج عند الحفظ']); assert.ok(info.legend_title); assert.equal(info.codeSeq, 'FFEDEDED');
  assert.equal(info.summary.B1, 'عدد العقود في ورقة 2026'); assert.equal(info.summary.C1, 'المحصَّل في 2026'); assert.equal(info.summary.I1, 'كود المشروع');
  assert.equal(info.summary.B2, "=COUNTIF('2026'!$AB:$AB,$I2)"); assert.equal(info.summary.C2, "=SUMIF('2026'!$AB:$AB,$I2,'2026'!$W:$W)"); assert.match(info.summary.H2, /SUMIFS\('العقود'!\$W:\$W,'العقود'!\$Y:\$Y,\$I2\)/);
  assert.equal(info.projK[0], 'المحصَّل في 2026'); assert.equal(info.projK[1], "=IF($A2=\"\",\"\",SUMIF('2026'!$AB:$AB,$A2,'2026'!$W:$W))");
  assert.equal(info.unitO[0], 'شاغرة منذ'); assert.equal(info.unitO[1], 'dd/mm/yyyy');
  // المحصَّل في السنة يتبع سنة التقرير (آخر سنة ≤ اليوم) حتى مع ورقة سنة قادمة
  st.settings.ledgerYears = [2025, 2026, 2027]; const wb = await book(await E.Workbook.write(st));
  assert.equal(wb.getWorksheet('المشاريع').getRow(1).getCell(11).value, 'المحصَّل في 2026'); assert.match(fml(wb.getWorksheet('المشاريع').getRow(2).getCell(11)), /'2026'!\$AB:\$AB/);
  assert.equal(wb.getWorksheet('ملخص المشاريع').getRow(1).getCell(3).value, 'المحصَّل في 2026');
});

test('[A14] every header the Power BI queries select exists in the written workbook, and the retired «(محسوب)» names are gone from the queries', async () => {
  const E = load({ today: TODAY });
  const st = await demoState(E); const wb = await book(await E.Workbook.write(st));
  const heads = new Set(); for (const ws of wb.worksheets) ws.getRow(/^\d{4}$/.test(ws.name) ? 2 : 1).eachCell(c => heads.add(String(c.value).trim()));
  const pq = fs.readFileSync(PQ, 'utf-8');
  const selected = new Set(); const re = /Table\.(?:SelectColumns|RenameColumns)\([^,]+,\s*\{([^]*?)\}\)/g; let m;
  while ((m = re.exec(pq))) for (const s of m[1].match(/"([^"]+)"/g) || []) { const t = s.slice(1, -1); if (/[\u0600-\u06FF]/.test(t)) selected.add(t); }
  assert.ok(selected.size >= 30, 'selected Arabic headers: ' + selected.size);
  const missing = [...selected].filter(h => !heads.has(h));
  assert.deepEqual(missing, [], 'headers selected in EgaryQueries.pq that the workbook does not have');
  assert.ok(!/\(محسوب\)/.test(pq), 'no «(محسوب)» header selected in the queries');
});

test('[A15] performance smoke: 100 contracts × 3 year sheets × 1,500 payments × 120 units write in under 2 s and under 1 MB; the demo file stays small', async () => {
  const E = load({ today: TODAY });
  const st = bigState(E); E.Store.load(st);
  await E.Workbook.write(st); // تسخين
  const t0 = Date.now(); const buf = await E.Workbook.write(st); const ms = Date.now() - t0;
  save('perf_big.xlsx', buf);
  assert.ok(ms < 2000, 'write took ' + ms + ' ms'); assert.ok(buf.byteLength < 1024 * 1024, 'size ' + buf.byteLength);
  const wb = await book(buf); assert.deepEqual(wb.worksheets.map(w => w.name).filter(n => /^\d{4}$/.test(n)), ['2024', '2025', '2026']);
  const r = await E.Workbook.read(buf); assert.equal(r.state.contracts.length, 100); assert.equal(r.state.payments.length, 1500);
  const demo = await E.Workbook.write(await demoState(E)); assert.ok(demo.byteLength < 400 * 1024, 'demo size ' + demo.byteLength);
});

/* ---------- مقاسات الأوراق: عناوين في سطرين على الأكثر، لا #### ولا قص للأسماء والأكواد والتواريخ والمبالغ ----------
   القياس هنا مستقل عن مقدِّر البرنامج: خطوط حقيقية (DejaVu Sans للنص العربي كما يرسمه ليبر أوفيس — أعرض من خط إكسيل،
   وCarlito المطابق لمقاسات Calibri للأرقام واللاتيني)، ولفّ إكسيل الجشع للعناوين مع زر التصفية (17 بكسل). العمود = 7 بكسل لكل وحدة. */
const DIM_FONTS = ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/crosextra/Carlito-Regular.ttf', '/usr/share/fonts/truetype/crosextra/Carlito-Bold.ttf'];
const dimSkip = (() => { try { execFileSync('python3', ['-I', '-c', 'from PIL import ImageFont']); } catch (e) { return 'PIL غير متاح'; } return DIM_FONTS.every(f => fs.existsSync(f)) ? false : 'خطوط القياس غير موجودة'; })();
const PY_DIMS = `
import sys, json, re, datetime, zipfile, openpyxl
from openpyxl.utils import get_column_letter
from PIL import ImageFont, features
RA = ImageFont.Layout.RAQM if features.check('raqm') else ImageFont.Layout.BASIC
FONTS = json.loads(sys.argv[2]); FC = {}
def font(ar, bold, size):
    k = (ar, bold, size)
    if k not in FC: FC[k] = ImageFont.truetype(FONTS[(0 if ar else 2) + (1 if bold else 0)], size * 96 / 72, layout_engine=RA)
    return FC[k]
AR = re.compile('[\\u0600-\\u06FF]')
def px(s, bold=False, size=11):
    if not s: return 0.0
    if AR.search(s): return font(True, bold, size).getlength(s, direction='rtl')
    return font(False, bold, size).getlength(s)
def shown(v, nf):
    if v is None or v == '': return ''
    if isinstance(v, (datetime.datetime, datetime.date)): return v.strftime('%d/%m/%Y')
    if isinstance(v, bool): return 'TRUE' if v else 'FALSE'
    if isinstance(v, (int, float)):
        nf = nf or ''
        if '#,##0.00' in nf: return f'{v:,.2f}'
        if '#,##0' in nf: return f'{v:,.0f}'
        if '%' in nf: return f'{v*100:.0f}%'
        return str(int(v)) if float(v).is_integer() else str(v)
    return str(v)
def greedy(text, avail, bold=True):
    lines = []; cur = ''
    for w in str(text).split():
        t = (cur + ' ' + w) if cur else w
        if not cur or px(t, bold) <= avail: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines
src = sys.argv[1]
wf = openpyxl.load_workbook(src); wv = openpyxl.load_workbook(src, data_only=True)
out = {'heads': [], 'clips': [], 'height': [], 'widths': {}, 'money': [], 'wrap': [], 'print': {}, 'unnamedFonts': 0, 'totalRow': {}}
styles = zipfile.ZipFile(src).read('xl/styles.xml').decode('utf-8')
out['printTitles'] = zipfile.ZipFile(src).read('xl/workbook.xml').decode('utf-8').count('_xlnm.Print_Titles')
fonts = re.search(r'<fonts[^>]*>(.*?)</fonts>', styles, re.S).group(1)
out['unnamedFonts'] = sum(1 for f in re.findall(r'<font>(.*?)</font>|<font/>', fonts, re.S) if '<name ' not in f)
for ws in wf.worksheets:
    v = wv[ws.title]; hr = 2 if ws.title.isdigit() else 1; filt = bool(ws.auto_filter.ref)
    if ws.title.isdigit(): out['totalRow'][ws.title] = next((r for r in range(3, ws.max_row + 1) if ws.cell(r, 3).value == 'الاجمالي العام'), 0)
    W = {}
    for k, cd in ws.column_dimensions.items():
        for c in range(cd.min or 0, (cd.max or 0) + 1): W[c] = (cd.width or 9, bool(cd.hidden))
    out['widths'][ws.title] = {}
    two = False
    for c in range(1, ws.max_column + 1):
        w, hid = W.get(c, (9, False)); L = get_column_letter(c)
        h = ws.cell(hr, c).value; h = '' if h is None else str(h)
        out['widths'][ws.title][h or L] = w
        if hid or not h: continue
        avail = 7 * w - (17 if filt else 0) - 3
        lines = greedy(h, avail)
        if len(lines) > 2 or any(px(l, True) > avail for l in lines): out['heads'].append([ws.title, L, h, w, lines])
        if len(lines) > 1: two = True
        nf_money = False
        for r in range(hr + 1, ws.max_row + 1):
            cell = ws.cell(r, c); s = shown(v.cell(r, c).value, cell.number_format)
            if '#,##0.00' in (cell.number_format or ''): nf_money = True
            if not s: continue
            b = bool(cell.font and cell.font.b); sz = (cell.font.sz if cell.font and cell.font.sz else 11)
            need = px(s, b, sz) + 3
            if ws.title == 'الإعدادات':
                if need > 7 * w:
                    al = cell.alignment; n = len(greedy(s, 7 * w - 3, b))
                    out['wrap'].append([ws.title, L + str(r), bool(al.wrap_text), ws.row_dimensions[r].height or 15, n])
                continue
            if need > 7 * w: out['clips'].append([ws.title, L, h, s[:60], round(need / 7, 1), w])
        if nf_money and 7 * w < px('9,999,999.00', True) + 3: out['money'].append([ws.title, L, h, w])
    out['height'].append([ws.title, ws.row_dimensions[hr].height, two])
    ps = ws.page_setup
    out['print'][ws.title] = {'landscape': ps.orientation == 'landscape', 'fit': bool(ws.sheet_properties.pageSetUpPr and ws.sheet_properties.pageSetUpPr.fitToPage), 'fitToHeight': ps.fitToHeight, 'titles': ws.print_title_rows, 'freeze': ws.freeze_panes, 'filter': ws.auto_filter.ref, 'hidden': ws.sheet_state != 'visible'}
print(json.dumps(out, ensure_ascii=False, default=str))
`;
const dims = (file) => py(PY_DIMS, file, JSON.stringify(DIM_FONTS));
/* القص المقبول بالتصميم: الملاحظات الطويلة (عمود بحد أقصى)، وكلمة المرور المشفّرة في ورقة المستخدمين المخفية */
const clipAllowed = (c) => c[2] === 'ملاحظات' || c[0] === 'المستخدمون';

test('[A16] sheet dimensions: every visible header reads in at most two lines (with the filter button), names/codes/dates/IDs/money are never cut, money columns hold 9,999,999.00, header rows are two lines high, every font is named, print setup repeats the titles, and freeze/filters are unchanged', { skip: dimSkip }, async () => {
  const E = load({ today: TODAY });
  const st = await demoState(E); const f = save('dims_demo.xlsx', await E.Workbook.write(st));
  const D = dims(f);
  assert.deepEqual(D.heads, [], 'headers that need more than two lines or break inside a word');
  assert.deepEqual(D.clips.filter(c => !clipAllowed(c)), [], 'cut values (need > width)');
  assert.deepEqual(D.money, [], 'money columns narrower than 9,999,999.00');
  for (const [sheet, h, two] of D.height) if (two) assert.ok(h >= 30, `${sheet}: two-line headers need a taller header row (got ${h})`);
  assert.equal(D.unnamedFonts, 0, 'every font record names its font (a nameless font is drawn with a different fallback in each program)');
  // الإعدادات: ما لا يسعه العمود يلتفّ في صفه بارتفاع يكفي أسطره
  for (const [sheet, cell, wrap, height, lines] of D.wrap) { assert.ok(wrap, `${sheet}!${cell} is wider than its column and must wrap`); assert.ok(height >= 15 * Math.min(lines, 3) - 1, `${sheet}!${cell}: ${lines} lines need a taller row (got ${height})`); }
  // الطباعة: أفقي، يتسع للعرض، والعناوين تتكرر — وصفوف التجميد والتصفية كما هي
  for (const [name, p] of Object.entries(D.print)) { if (p.hidden) continue; assert.ok(p.landscape && p.fit && p.titles, name + ': print setup ' + JSON.stringify(p)); assert.equal(String(p.fitToHeight), '0', name + ': as many pages tall as needed'); }
  assert.equal(D.print['2026'].titles, '$1:$2'); assert.equal(D.print['2026'].freeze, 'F3');
  assert.ok(D.totalRow['2026'] > 3); assert.equal(D.print['2026'].filter, 'A2:AB' + (D.totalRow['2026'] - 1), 'the year-sheet filter stops above «الاجمالي العام»');
  assert.equal(D.printTitles, Object.keys(D.print).length, 'one print-titles name per sheet');
  for (const name of ['المشاريع', 'الوحدات', 'العملاء', 'العقود', 'المدفوعات', 'الصيانة']) { assert.equal(D.print[name].freeze, 'B2', name + ' freeze'); assert.match(D.print[name].filter, /^A1:[A-Z]+\d+$/, name + ' filter'); assert.equal(D.print[name].titles, '$1:$1'); }
  // أمثلة يراها المكتب مباشرة: عناوين العقود التي كانت تُقص، والشهور، والأسماء
  const w = D.widths;
  for (const h of ['الإيجار الشهري (السنة الأولى)', 'يوم الاستحقاق', 'ترتيب الصف في ورقة السنة', 'مستنتج تلقائيًا من الورقة', 'الأيام المتبقية على نهاية العقد', 'عدد سنوات العقد']) assert.ok(w['العقود'][h] >= 13, `العقود/${h}: ${w['العقود'][h]}`);
  for (const m of ['يناير', 'يونيو', 'ديسمبر']) assert.ok(w['2026'][m] >= 12, `2026/${m}: ${w['2026'][m]}`);
  assert.ok(w['2026']['الاسم'] >= 30 && w['العقود']['العميل'] >= 30 && w['العملاء']['الاسم'] >= 30 && w['المدفوعات']['العميل'] >= 30, 'name columns hold the longest client name');
});

test('[A17] sizes follow the content and are stable: the same data gives the same widths across read → write → read → write (with the previous file as base, like the app), a 10-million month total and a long client name widen their columns, and office-added columns get a readable width', { skip: dimSkip }, async () => {
  const E = load({ today: TODAY });
  const st = await demoState(E);
  const o1 = await E.Workbook.write(st); const r1 = await E.Workbook.read(o1); E.Store.load(r1.state);
  const o2 = await E.Workbook.write(r1.state, { base: o1 }); const r2 = await E.Workbook.read(o2); E.Store.load(r2.state);
  const f2 = save('dims_idem_2.xlsx', o2), f3 = save('dims_idem_3.xlsx', await E.Workbook.write(r2.state, { base: o2 }));
  const a = dims(f2), b = dims(f3);
  assert.deepEqual(b.widths, a.widths, 'widths are identical on the next save'); assert.deepEqual(b.height, a.height); assert.deepEqual(b.print, a.print);
  assert.equal(b.printTitles, Object.keys(b.print).length, 'one print-titles name per sheet after repeated saves (no duplicates)');
  // محتوى أكبر: اسم عميل طويل ومجموع شهر فوق 10 ملايين
  const big = edgeState(E); big.clients[0].name = 'مؤسسة النيل الكبرى للمقاولات والتوريدات العامة';
  big.payments.push(Object.assign(E.M.blank.payments(), { code: 'INV-2026-0101', contractCode: 'T0005', period: '2026-03', amount: 9999999, source: 'web' }));
  big.payments.push(Object.assign(E.M.blank.payments(), { code: 'INV-2026-0102', contractCode: 'T0001', period: '2026-03', amount: 600000, source: 'web' }));
  E.Store.load(big); big._extra = { contracts: { headers: ['ملاحظة داخلية طويلة للمكتب'], rows: { T0001: { 'ملاحظة داخلية طويلة للمكتب': 'سري' } }, fmts: {} } };
  const D = dims(save('dims_big.xlsx', await E.Workbook.write(big)));
  assert.deepEqual(D.heads, []); assert.deepEqual(D.money, []);
  assert.deepEqual(D.clips.filter(c => !clipAllowed(c)), [], 'nothing cut with the bigger content');
  assert.ok(D.widths['2026']['مارس'] >= 13 && D.widths['2026']['مارس'] > D.widths['2026']['يناير'], 'March total 10,599,999.00 widens March only: ' + D.widths['2026']['مارس'] + ' vs ' + D.widths['2026']['يناير']);
  assert.ok(D.widths['العقود']['العميل'] > a.widths['العقود']['العميل'] || D.widths['العقود']['العميل'] >= 40, 'the long client name widens العقود/العميل');
  assert.ok(D.widths['العقود']['ملاحظة داخلية طويلة للمكتب'] >= 12, 'office-added column has a readable width');
  // المقاس مربوط بالحقل لا بالموضع: كل حقل له نوع مقاس معروف، وقوائم أوراق السنة والملخص بطول عناوينها
  const Z = E.Workbook.sizing;
  assert.equal(Z.LEDGER_SIZE.length, E.Workbook.LEDGER_HEAD.length); assert.equal(Z.SUMMARY_SIZE.length, 9);
  for (const ent of Object.keys(E.Workbook.COLS)) for (const c of E.Workbook.COLS[ent]) assert.ok(Z.SIZES[Z.sizeKind(ent, c[0])], `${ent}.${c[0]} has a size kind`);
  assert.equal(Z.sizeKind('contracts', 'rent'), 'money'); assert.equal(Z.sizeKind('contracts', '_client'), 'name'); assert.equal(Z.sizeKind('payments', 'paidOn'), 'date'); assert.equal(Z.sizeKind('clients', 'nationalId'), 'id');
});

test('[A18] the layout styling never ties input cells together: after loading the written file with ExcelJS, a «%» format put on one «الزيادة السنوية %» cell or on one settings value does not spread to the other rows (cells that share a style index share one style object in ExcelJS)', async () => {
  const E = load({ today: TODAY });
  const st = await demoState(E); const wb = await book(await E.Workbook.write(st));
  const ws = wb.getWorksheet('العقود'), h = hdr(ws);
  for (const head of ['الزيادة السنوية %', 'يوم الاستحقاق']) { const col = h[head]; ws.getCell(2, col).numFmt = '0%'; for (let r = 3; r <= 6; r++) assert.notEqual(ws.getCell(r, col).numFmt, '0%', `العقود/${head} row ${r} keeps its own format`); }
  const u = wb.getWorksheet('الوحدات'), hu = hdr(u); for (const head of ['الدور', 'المساحة م²']) { u.getCell(2, hu[head]).numFmt = '0.0%'; assert.notEqual(u.getCell(3, hu[head]).numFmt, '0.0%', 'الوحدات/' + head); }
  const s = wb.getWorksheet('الإعدادات'); const rows = []; for (let r = 2; r <= s.rowCount; r++) if (typeof s.getCell(r, 2).value === 'number') rows.push(r);
  assert.ok(rows.length >= 4, 'numeric settings rows'); s.getCell(rows[0], 2).numFmt = '0.0%';
  for (const r of rows.slice(1)) assert.notEqual(s.getCell(r, 2).numFmt, '0.0%', `الإعدادات!B${r} keeps its own format`);
});
