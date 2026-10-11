// اختبارات انحدار لمجموعة الواجهة (views/forms/app/ui) — تُشغَّل في Node بنافذة DOM مصغَّرة كافية لبناء الشاشات والنماذج
// والنقر على أزرارها؛ التحقق الكامل في المتصفح يبقى في tests/e2e-extra.test.js (E3/E5/E8/E20) وtests/e2e.test.js.
// التشغيل: cd /home/user/Egary && node --test tests/fix-ui.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { load, readFile, ROOT } = require('./helpers/env');

const TODAY = '2026-10-10';
const tick = (ms) => new Promise(r => setTimeout(r, ms || 10));

/* ---------- DOM مصغَّر: عناصر، سمات، أصناف، مستمعون، value للحقول، querySelector بسيط (tag#id.class، قوائم بفاصلة) ---------- */
function installDom() {
  class N { }
  class Text extends N { constructor(t) { super(); this.nodeType = 3; this.data = String(t); this.parentNode = null; } get textContent() { return this.data; } set textContent(v) { this.data = String(v); } remove() { if (this.parentNode) this.parentNode.removeChild(this); } }
  const parseSel = (sel) => { const m = /^([a-zA-Z][\w-]*|\*)?((?:[#.][\w-]+)*)$/.exec(sel.trim()); if (!m) return null; const parts = m[2].match(/[#.][\w-]+/g) || []; return { tag: m[1] && m[1] !== '*' ? m[1].toUpperCase() : null, id: parts.filter(p => p[0] === '#').map(p => p.slice(1)), cls: parts.filter(p => p[0] === '.').map(p => p.slice(1)) }; };
  const mkEvent = (type) => ({ type, _stop: false, stopPropagation() { this._stop = true; }, preventDefault() { }, key: '' });
  class El extends N {
    constructor(tag) {
      super(); this.nodeType = 1; this.tagName = String(tag).toUpperCase(); this.attrs = {}; this.childNodes = []; this.parentNode = null; this.dataset = {}; this._l = {}; this._cls = new Set(); this._value = null; this.disabled = false; this._html = '';
      this.style = { setProperty(k, v) { this[k] = v; }, getPropertyValue(k) { return this[k] || ''; } };
      const self = this; this.classList = { add: (...c) => c.forEach(x => self._cls.add(x)), remove: (...c) => c.forEach(x => self._cls.delete(x)), toggle: (c, f) => { const on = f === undefined ? !self._cls.has(c) : !!f; if (on) self._cls.add(c); else self._cls.delete(c); return on; }, contains: c => self._cls.has(c) };
    }
    get className() { return [...this._cls].join(' '); } set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
    get id() { return this.attrs.id || ''; } set id(v) { this.attrs.id = String(v); }
    get children() { return this.childNodes.filter(c => c.nodeType === 1); }
    get firstChild() { return this.childNodes[0] || null; }
    get firstElementChild() { return this.children[0] || null; }
    get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === global.document.body; }
    setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'class') this.className = v; }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    removeAttribute(k) { delete this.attrs[k]; }
    hasAttribute(k) { return k in this.attrs; }
    appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.childNodes.push(c); return c; }
    append(...cs) { for (const c of cs) this.appendChild(c instanceof N ? c : new Text(c)); }
    prepend(c) { this.insertBefore(c, this.childNodes[0] || null); }
    insertBefore(c, ref) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; const i = ref ? this.childNodes.indexOf(ref) : -1; if (i < 0) this.childNodes.push(c); else this.childNodes.splice(i, 0, c); return c; }
    removeChild(c) { const i = this.childNodes.indexOf(c); if (i >= 0) { this.childNodes.splice(i, 1); c.parentNode = null; } return c; }
    remove() { if (this.parentNode) this.parentNode.removeChild(this); }
    get textContent() { return this.childNodes.map(c => c.textContent).join(''); }
    set textContent(v) { this.childNodes.length = 0; if (v != null && v !== '') this.appendChild(new Text(v)); }
    get innerHTML() { return this._html; } set innerHTML(v) { this.childNodes.length = 0; this._html = String(v); }
    addEventListener(k, fn) { (this._l[k] = this._l[k] || []).push(fn); }
    removeEventListener(k, fn) { this._l[k] = (this._l[k] || []).filter(f => f !== fn); }
    dispatchEvent(ev) { ev.target = ev.target || this; let n = this; while (n && n.nodeType === 1) { ev.currentTarget = n; for (const fn of (n._l[ev.type] || []).slice()) fn(ev); if (ev._stop) break; n = n.parentNode; } return true; }
    click() { return this.dispatchEvent(mkEvent('click')); }
    focus() { } blur() { } select() { } scrollIntoView() { } getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 }; }
    get value() {
      if (this.tagName === 'SELECT') { const os = this.querySelectorAll('option'); const o = (this._value != null ? os.find(x => x.getAttribute('value') === this._value) : null) || os.find(x => x.hasAttribute('selected')) || os[0]; return o ? o.getAttribute('value') : ''; }
      if (this._value != null) return this._value;
      return this.tagName === 'TEXTAREA' ? this.textContent : (this.attrs.value || '');
    }
    set value(v) { this._value = String(v); }
    get type() { return this.attrs.type || (this.tagName === 'INPUT' ? 'text' : ''); } set type(v) { this.attrs.type = v; }
    get name() { return this.attrs.name || ''; }
    get checked() { return this._checked != null ? this._checked : this.hasAttribute('checked'); } set checked(v) { this._checked = !!v; }
    matches(sel) { return String(sel).split(',').some(s => { const p = parseSel(s); if (!p) return false; if (p.tag && this.tagName !== p.tag) return false; if (p.id.some(i => this.id !== i)) return false; return p.cls.every(c => this._cls.has(c)); }); }
    closest(sel) { let n = this; while (n && n.nodeType === 1) { if (n.matches(sel)) return n; n = n.parentNode; } return null; }
    querySelectorAll(sel) { const out = []; const walk = (n) => { for (const c of n.childNodes) if (c.nodeType === 1) { if (c.matches(sel)) out.push(c); walk(c); } }; walk(this); return out; }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  }
  const document = { body: new El('body'), documentElement: new El('html'), title: '', activeElement: null, createElement: t => new El(t), createElementNS: (ns, t) => new El(t), createTextNode: t => new Text(t), addEventListener() { }, removeEventListener() { }, getElementById(id) { return document.body.querySelector('#' + id); }, querySelector(s) { return document.body.querySelector(s); }, querySelectorAll(s) { return document.body.querySelectorAll(s); }, execCommand() { } };
  global.document = document; global.Node = N;
  global.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  global.getComputedStyle = () => ({ getPropertyValue: () => '' });
  global.navigator = { clipboard: { writeText() { } } };
  global.location = { hash: '', protocol: 'file:', reload() { } };
  Object.assign(global.window, { matchMedia: () => ({ matches: false }), addEventListener() { }, innerWidth: 1200, innerHeight: 800, print() { } });
  return document;
}
async function boot() {
  const E = load({ today: TODAY });
  installDom();
  for (const f of ['ui/ui', 'ui/views', 'ui/forms', 'app']) { const p = path.join(ROOT, 'assets/js', f + '.js'); delete require.cache[p]; require(p); }
  const { state } = await E.Workbook.read(readFile(path.join(ROOT, 'Egary.xlsx'))); E.Store.load(state);
  E.Auth.demo('المدير'); E.App.mode = 'demo';
  E.Engine.setOverride({});
  return E;
}
/* أدوات القراءة من الشجرة */
const body = () => global.document.body;
const lastOverlay = () => { const o = body().querySelectorAll('.overlay'); return o[o.length - 1] || null; };
const modalBtn = (text) => { const m = lastOverlay(); return m ? m.querySelectorAll('button').find(b => b.textContent.includes(text)) : null; };
const byTitle = (root, title) => root.querySelectorAll('button').find(b => b.getAttribute('title') === title);
const drawer = () => body().querySelector('.drawer');
const drawerTitle = () => { const d = drawer(); return d ? d.querySelector('h2').textContent : null; };
const rowsOf = (root) => { const tb = root.querySelector('tbody'); return tb ? tb.querySelectorAll('tr').filter(tr => !tr.querySelector('.empty')) : []; }; // بلا صف «لا توجد بيانات»
const fakeCtx = (E, over) => Object.assign(E.App.ctx(), { rerender() { }, go() { } }, over || {});
function render(E, page, ctx) { const el = global.document.createElement('div'); el.className = 'content'; body().appendChild(el); E.Views.render(page, el, ctx || fakeCtx(E)); return el; }

/* ===================================================================== */
test('49. chart helpers never throw on crafted input and never emit NaN/undefined SVG attributes; spark([]) is an empty svg', async () => {
  const E = await boot(); const UI = E.UI;
  const bad = () => { const out = []; const walk = (n) => { for (const c of n.childNodes || []) { if (c.nodeType !== 1) continue; for (const [k, v] of Object.entries(c.attrs)) if (['x', 'y', 'width', 'height', 'd', 'cx', 'cy', 'r', 'x1', 'x2', 'y1', 'y2', 'stroke-dasharray', 'stroke-dashoffset'].includes(k) && /NaN|undefined|null|Infinity/.test(v)) out.push(k + '=' + v); if (c.attrs.d && c.attrs.d.trim() && !/^M/.test(c.attrs.d.trim())) out.push('d=' + c.attrs.d); walk(c); } }; return out; };
  const b = UI.bars({ data: [{ label: null, value: NaN }, { label: undefined, value: 'abc' }, { label: 'ok', value: 10 }, { value: undefined }] });
  const t = []; const walkT = (n) => { for (const c of n.childNodes || []) { if (c.nodeType === 3) t.push(c.data); else walkT(c); } }; walkT(b);
  assert.ok(!t.some(x => /undefined|null|NaN/.test(x)), 'bar labels/values rendered as text: ' + t.join('|'));
  const walkBad = (el) => { const r = bad.call(null); return r; };
  const svgs = [b, UI.columns({ labels: [null, 'x', undefined], series: [{ name: 's', values: [NaN, undefined, 'q'] }], line: { name: 'l', values: [undefined, NaN] } }), UI.donut({ data: [{ label: null, value: NaN }, { label: 'a', value: undefined }] }), UI.spark([NaN, undefined, 3]), UI.spark([]), UI.spark(null), UI.columns({ labels: [], series: [] }), UI.bars({ data: [] })];
  for (const el of svgs) { const errs = []; const walk = (n) => { for (const c of n.childNodes || []) { if (c.nodeType !== 1) continue; for (const [k, v] of Object.entries(c.attrs)) if (['x', 'y', 'width', 'height', 'd', 'cx', 'cy', 'r', 'x1', 'x2', 'y1', 'y2', 'stroke-dasharray', 'stroke-dashoffset', 'viewBox'].includes(k) && /NaN|undefined|null|Infinity/.test(v)) errs.push(k + '=' + v); if (c.attrs.d != null && c.attrs.d.trim() && !/^M/.test(c.attrs.d.trim())) errs.push('d=' + c.attrs.d); walk(c); } }; walk(el); assert.deepEqual(errs, [], 'invalid svg attributes'); }
  const empty = UI.spark([]); assert.equal(empty.tagName, 'SVG'); assert.equal(empty.childNodes.length, 0, 'spark([]) has no path');
  assert.equal(UI.short(NaN), '0'); assert.equal(UI.short(undefined), '0'); assert.equal(UI.short(Infinity), '0'); assert.equal(UI.short(1500), '2K'); assert.equal(UI.short(2500000), '2.5M');
});

test('40. «تجديد» on a contract with an empty end date warns instead of throwing and does not open the form', async () => {
  const E = await boot();
  let opened = 0; const orig = E.Forms.contract; E.Forms.contract = () => { opened++; return Promise.resolve(null); };
  try {
    const c = Object.assign({}, E.Store.contract('T0016'), { end: '' });
    assert.doesNotThrow(() => E.Views.renew(fakeCtx(E), c));
    assert.doesNotThrow(() => E.Views.renew(fakeCtx(E), Object.assign({}, c, { end: null })));
    const toasts = body().querySelectorAll('.toast').map(t => t.textContent);
    assert.ok(toasts.some(t => t.includes('تاريخ نهاية العقد غير مسجَّل')), toasts.join('|'));
    assert.equal(opened, 0);
    E.Views.renew(fakeCtx(E), E.Store.contract('T0016')); assert.equal(opened, 1, 'a valid contract still opens the renewal form');
  } finally { E.Forms.contract = orig; }
});

test('41. aging bars open the exact bucket: 31–60 / 61–90 have their own evidence (title + total), and the insights chart maps each bar', async () => {
  const E = await boot(); const k = E.Engine.kpis({}); const ctx = fakeCtx(E);
  assert.ok(k.arrears.buckets.b90 > 0 && k.arrears.buckets.b90p > 0, 'demo has 61–90 and >90 arrears');
  E.Views.arrearsEvidence(ctx, k.arrears, 'b61_90');
  assert.equal(drawerTitle(), 'متأخرات 61–90 يومًا');
  assert.ok(drawer().querySelector('p.muted').textContent.includes(E.U.fmtMoney(k.arrears.buckets.b90)), drawer().querySelector('p.muted').textContent);
  assert.equal(rowsOf(drawer()).length, k.arrears.rows.filter(r => r.overdueDays > 60 && r.overdueDays <= 90).length);
  E.Views.arrearsEvidence(ctx, k.arrears, 'b31_60');
  assert.equal(drawerTitle(), 'متأخرات 31–60 يومًا');
  assert.ok(drawer().querySelector('p.muted').textContent.includes(E.U.fmtMoney(k.arrears.buckets.b60)));
  // صفحة التحليلات: الشريط الثالث (61–90) يفتح دليل 61–90 لا كل المتأخرات
  const el = render(E, 'insights', ctx);
  const card = el.querySelectorAll('.card').find(c => c.querySelector('h3') && c.querySelector('h3').textContent === 'المتأخرات حسب مدة التأخير');
  const bars = card.querySelectorAll('g.bar'); assert.equal(bars.length, 4);
  bars[2].click(); assert.equal(drawerTitle(), 'متأخرات 61–90 يومًا');
  bars[1].click(); assert.equal(drawerTitle(), 'متأخرات 31–60 يومًا');
  bars[0].click(); assert.equal(drawerTitle(), 'متأخرات حتى 30 يومًا');
  bars[3].click(); assert.equal(drawerTitle(), 'متأخرات أكثر من 90 يومًا');
});

test('42. unit whose project row is missing: drawer title says «مشروع غير موجود», a danger badge carries the project code, no «undefined»', async () => {
  const E = await boot();
  E.Store.applyOp({ type: 'upsert', entity: 'units', code: 'P09-1', record: { code: 'P09-1', projectCode: 'P09', label: '1', type: 'admin' } });
  E.Views.profile('unit', 'P09-1', fakeCtx(E));
  assert.equal(drawerTitle(), '1 — مشروع غير موجود');
  const txt = drawer().textContent; assert.ok(!/undefined/.test(txt), txt.slice(0, 200));
  const badge = drawer().querySelectorAll('.badge.danger').find(b => b.textContent.includes('مشروع غير موجود'));
  assert.ok(badge && badge.textContent.includes('P09'), 'badge with the project code');
  assert.equal(drawer().querySelectorAll('a').filter(a => a.textContent === 'undefined' || a.textContent === '').length, 0, 'no empty project link');
});

test('43. dead controls now open real evidence: contract KPI «الإيجار الحالي» → schedule drawer; insight cards forecast/trend → drawers, gaps → insights page scrolled to #gaps-card', async () => {
  const E = await boot(); const k = E.Engine.kpis({}); const c = E.Store.contract('T0016');
  const gone = []; const ctx = fakeCtx(E, { go: (v, p) => gone.push([v, p]) });
  E.Views.profile('contract', 'T0016', ctx);
  const kpi = drawer().querySelectorAll('button.kpi').find(b => b.textContent.includes('الإيجار الحالي'));
  assert.ok(kpi); kpi.click();
  assert.ok(drawerTitle().startsWith('جدول إيجار العقد T0016'), drawerTitle());
  assert.equal(rowsOf(drawer()).length, E.Engine.schedule(c).length);
  assert.ok(drawer().textContent.includes(E.U.fmtMoney(E.Engine.currentRent(c))));
  E.Views.openEvidence(ctx, { view: 'insights', tab: 'forecast' }, k);
  assert.ok(drawerTitle().startsWith('الإيراد المتعاقد عليه'), drawerTitle());
  assert.equal(rowsOf(drawer()).length, 12);
  E.Views.openEvidence(ctx, { view: 'insights', tab: 'trend' }, k);
  assert.ok(drawerTitle().startsWith(E.U.periodLabel(k.period, true)), drawerTitle());
  E.Views.openEvidence(ctx, { view: 'insights', tab: 'gaps' }, k);
  assert.deepEqual(gone, [['insights', { tab: 'gaps' }]]);
  const el = render(E, 'insights', fakeCtx(E, { params: { tab: 'gaps' } }));
  const gaps = el.querySelector('#gaps-card'); assert.ok(gaps, 'gaps card has an id to scroll to');
  assert.ok(gaps.querySelector('h3').textContent.includes('الفجوات'));
  // التمرير إلى البطاقة مرة واحدة لكل انتقال: إعادة الرسم التالية (تغيير فلتر مثلًا) لا تُعيد التمرير، والانتقال من بطاقة اللوحة يعيد تفعيله
  const raf = global.requestAnimationFrame; let scrolls = 0; global.requestAnimationFrame = (fn) => { scrolls++; fn(); };
  try {
    render(E, 'insights', fakeCtx(E, { params: { tab: 'gaps' } })); assert.equal(scrolls, 0, 'already scrolled for this navigation');
    E.Views.openEvidence(ctx, { view: 'insights', tab: 'gaps' }, k); render(E, 'insights', fakeCtx(E, { params: { tab: 'gaps' } })); assert.equal(scrolls, 1, 'a new navigation scrolls again');
    render(E, 'insights', fakeCtx(E, { params: {} })); assert.equal(scrolls, 1, 'no tab param ⇒ no scroll');
  } finally { global.requestAnimationFrame = raf; }
  // أزرار الإنسايتس المولَّدة فعلًا من المحرّك كلها تفتح شيئًا (درج أو انتقال) ولا ترمي
  const ins = E.Engine.insights(k); let opened = 0; const ctx2 = fakeCtx(E, { go: () => { opened++; } });
  for (const i of ins) { E.UI.closeDrawer(); const before = opened; E.Views.openEvidence(ctx2, i.evidence, k); assert.ok(drawer() || opened > before, 'insight opens nothing: ' + i.title); }
});

test('32. deposits insight for ended contracts opens only the ended-still-held deposits', async () => {
  const E = await boot();
  const ended = E.Store.state().contracts.find(x => E.Engine.contractStatus(x) === 'ended');
  E.Store.applyOp({ type: 'upsert', entity: 'contracts', code: ended.code, record: Object.assign({}, ended, { deposit: 5000, depositStatus: 'held' }) });
  const act = E.Store.contract('T0016'); E.Store.applyOp({ type: 'upsert', entity: 'contracts', code: 'T0016', record: Object.assign({}, act, { deposit: 7000, depositStatus: 'held' }) });
  const k = E.Engine.kpis({});
  assert.equal(k.deposits.held.length, 2); assert.equal(k.deposits.endedStillHeld.length, 1);
  const ev = E.Engine.insights(k).find(i => i.evidence && i.evidence.deposit === 'held-ended'); assert.ok(ev, 'insight exists');
  E.Views.openEvidence(fakeCtx(E), ev.evidence, k);
  assert.equal(drawerTitle(), 'تأمينات محتفظ بها لعقود منتهية — ' + E.U.fmtMoney(5000));
  assert.equal(rowsOf(drawer()).length, 1);
  assert.ok(drawer().textContent.includes(ended.code) && !drawer().textContent.includes('T0016'));
  E.Views.openEvidence(fakeCtx(E), { view: 'contracts', deposit: 'held' }, k);
  assert.equal(rowsOf(drawer()).length, 2, 'the generic deposits evidence still lists all held deposits');
});

test('31. dashboard maintenance tile labels the year the engine actually computed (k.maintenance.year), not the report year', async () => {
  const E = await boot();
  E.App.filter.period = '2025-03'; // سنة تقرير مختلفة عن سنة اليوم
  const ctx = fakeCtx(E); const k = E.Engine.kpis(ctx.filter);
  assert.equal(k.reportYear, '2025');
  const el = render(E, 'dashboard', ctx);
  const tile = el.querySelectorAll('button.kpi').find(b => b.dataset.kpi === 'صيانة مفتوحة');
  const want = 'تكلفة ' + (k.maintenance.year || String(k.asOf).slice(0, 4)) + ':';
  assert.ok(tile.querySelector('.d').textContent.startsWith(want), tile.querySelector('.d').textContent + ' vs ' + want);
  E.App.filter.period = '';
});

test('33. with the «المحاسبة من» slicer the contract month grid, the client statement and the period navigator start at the effective accounting start', async () => {
  const E = await boot(); const c = E.Store.contract('T0016'); // يبدأ 2024-01-01
  const first = () => { E.Views.profile('contract', 'T0016', fakeCtx(E)); const m = drawer().querySelectorAll('button.kpi').filter(b => b.dataset.month); return m[0].dataset.month; };
  assert.equal(first(), '2026-01', 'setting is 2026-01');
  E.Engine.setOverride({ trackingFrom: '2025-01' });
  assert.equal(first(), '2025-01', 'grid follows the slicer');
  const stm = E.Forms.statement(E.Store.client(c.clientCode));
  const months = stm.body.querySelector('#statement-months'); const r0 = rowsOf(months)[0];
  assert.equal(r0.querySelector('td').textContent, E.U.periodLabel('2025-01', true), 'statement starts at the slicer month');
  const bar = E.App.filterBar({ period: true });
  const opts = bar.querySelector('#period-pick').querySelectorAll('option').map(o => o.getAttribute('value'));
  assert.equal(opts[opts.length - 1], '2025-01'); assert.equal(opts.length, [...E.U.periods('2025-01', '2026-10')].length);
  E.Engine.setOverride({});
  const bar2 = E.App.filterBar({ period: true }); const opts2 = bar2.querySelector('#period-pick').querySelectorAll('option').map(o => o.getAttribute('value'));
  assert.equal(opts2[opts2.length - 1], '2026-01');
});

test('35. «تنزيل نسخة إكسيل» writes the computed columns without the slicer override and restores it afterwards (also when writing fails)', async () => {
  const E = await boot();
  let seen = null, downloaded = 0; const ow = E.Workbook.write, od = E.FileLink.downloadBytes;
  E.Workbook.write = async () => { seen = Object.assign({}, E.Engine.overrideOf()); return new ArrayBuffer(4); };
  E.FileLink.downloadBytes = () => { downloaded++; };
  try {
    E.Engine.setOverride({ trackingFrom: '2025-01' });
    await E.App.downloadCopy();
    assert.equal(seen.trackingFrom, undefined, 'write ran without the override');
    assert.equal(E.Engine.overrideOf().trackingFrom, '2025-01', 'override restored'); assert.equal(downloaded, 1);
    E.Workbook.write = async () => { throw new Error('boom'); };
    await assert.rejects(() => E.App.downloadCopy());
    assert.equal(E.Engine.overrideOf().trackingFrom, '2025-01', 'override restored after a failure');
  } finally { E.Workbook.write = ow; E.FileLink.downloadBytes = od; E.Engine.setOverride({}); }
});

test('56. paying from the contract profile month grid refreshes the open profile (month turns paid, invoice count grows)', async () => {
  const E = await boot(); const n = E.Store.paymentsOf('T0016').length;
  const op = E.Forms.payment; let rerenders = 0;
  E.Forms.payment = async (rec, d) => { const r = { code: 'INV-2026-9001', contractCode: d.contractCode, period: d.period, amount: d.amount, paidOn: TODAY, method: 'cash', source: 'web' }; E.Store.upsert('payments', r, 'x'); return r; };
  try {
    const ctx = fakeCtx(E, { rerender: () => { rerenders++; } });
    E.Views.profile('contract', 'T0016', ctx);
    assert.ok(drawer().textContent.includes(`الفواتير (${n})`));
    const sep = drawer().querySelectorAll('button.kpi').find(b => b.dataset.month === '2026-09');
    assert.ok(sep.textContent.includes(E.Engine.STATUS_AR.pending), 'September pending before');
    sep.click();
    const add = modalBtn('تسجيل دفعة'); assert.ok(add, 'cell dialog has the add button'); add.click(); await tick();
    assert.equal(E.Store.paymentsOfCell('T0016', '2026-09').length, 1);
    assert.equal(rerenders, 1, 'page re-rendered');
    const sep2 = drawer().querySelectorAll('button.kpi').find(b => b.dataset.month === '2026-09');
    assert.ok(sep2.classList.contains('ok'), 'open profile shows September paid: ' + sep2.className);
    assert.ok(drawer().textContent.includes(`الفواتير (${n + 1})`), 'invoice count refreshed');
    // تعديل من نفس النافذة يُحدِّث الدرج أيضًا
    E.Forms.payment = async (rec) => { const r = Object.assign({}, rec, { amount: 123 }); E.Store.upsert('payments', r, 'x'); return r; };
    sep2.click(); const edit = byTitle(lastOverlay(), 'تعديل'); assert.ok(edit, 'edit icon in the cell dialog'); edit.click(); await tick();
    assert.equal(rerenders, 2);
    assert.ok(drawer().querySelectorAll('button.kpi').find(b => b.dataset.month === '2026-09').textContent.includes(E.U.fmtMoney(123, { plain: true })), 'edited amount visible in the refreshed grid');
    // الحذف من النافذة: الدرج يُعاد فتحه والشهر يعود «بانتظار التسجيل»
    const oc = E.UI.confirmDelete; E.UI.confirmDelete = async () => true;
    try { drawer().querySelectorAll('button.kpi').find(b => b.dataset.month === '2026-09').click(); byTitle(lastOverlay(), 'حذف').click(); await tick(30); } finally { E.UI.confirmDelete = oc; }
    assert.equal(E.Store.paymentsOfCell('T0016', '2026-09').length, 0);
    assert.ok(drawer(), 'profile reopened after the delete');
    assert.ok(drawer().querySelectorAll('button.kpi').find(b => b.dataset.month === '2026-09').textContent.includes(E.Engine.STATUS_AR.pending));
    // من كشف التحصيل (بلا after) السلوك كما كان: إعادة رسم فقط
    E.UI.closeDrawer(); E.Forms.payment = async (rec, d) => { const r = { code: 'INV-2026-9002', contractCode: d.contractCode, period: d.period, amount: 1, paidOn: TODAY, method: 'cash', source: 'web' }; E.Store.upsert('payments', r, 'x'); return r; };
    E.Views.cellAction(ctx, E.Store.contract('T0016'), '2026-09', E.Engine.cell(E.Store.contract('T0016'), '2026-09')); modalBtn('تسجيل دفعة').click(); await tick();
    assert.equal(rerenders, 4); assert.equal(drawer(), null);
  } finally { E.Forms.payment = op; }
});

test('57. «تعديل» from the invoice modal re-renders the page underneath before reopening the invoice', async () => {
  const E = await boot(); let renders = 0; const orig = E.App.render; E.App.render = () => { renders++; };
  try {
    const p = E.Store.state().payments.find(x => !x.method && x.paidOn) || E.Store.state().payments[0];
    E.Forms.invoice(p);
    assert.ok(lastOverlay().textContent.includes('الفاتورة ' + p.code));
    modalBtn('تعديل').click(); await tick();
    const form = lastOverlay(); assert.ok(form.textContent.includes('تعديل الفاتورة ' + p.code), 'payment form opened');
    form.querySelector('#f_method').value = 'transfer'; form.querySelector('#f_ref').value = 'REF-77';
    modalBtn('حفظ').click(); await tick(20);
    assert.equal(E.Store.get('payments', p.code).method, 'transfer'); assert.equal(E.Store.get('payments', p.code).ref, 'REF-77');
    assert.equal(renders, 1, 'E.App.render called after the edit');
    const inv = lastOverlay(); assert.ok(inv && inv.textContent.includes('الفاتورة ' + p.code) && inv.textContent.includes('تحويل بنكي') && inv.textContent.includes('REF-77'), 'invoice reopened with the new values');
    // إلغاء التعديل: لا إعادة رسم ولا فاتورة جديدة
    modalBtn('تعديل').click(); await tick(); modalBtn('إلغاء').click(); await tick();
    assert.equal(renders, 1); assert.equal(lastOverlay(), null);
  } finally { E.App.render = orig; }
});

test('37. saving the settings form writes an audit row (user, entity «الإعدادات», before ← after per changed key); an unchanged save writes nothing', async () => {
  const E = await boot(); const before = E.Store.state().audit.length;
  const recorded = []; E.Store.setRecorder(op => recorded.push(op));
  try {
    E.Forms.settings(); const f = lastOverlay();
    f.querySelector('#f_graceDays').value = '7'; f.querySelector('#f_officeName').value = 'مكتب الاختبار'; f.querySelector('#f_enteredThrough').value = '2026-08';
    modalBtn('حفظ').click(); await tick(20);
    assert.equal(lastOverlay(), null, 'form closed');
    const st = E.Store.state(); assert.equal(st.settings.graceDays, 7); assert.equal(st.meta.officeName, 'مكتب الاختبار');
    assert.equal(st.audit.length, before + 1);
    const a = st.audit[0];
    assert.equal(a.action, 'تعديل'); assert.equal(a.entity, 'الإعدادات'); assert.equal(a.code, 'settings'); assert.equal(a.user, 'المدير');
    assert.ok(a.summary.includes('أيام السماح: 5 ← 7'), a.summary); assert.ok(a.summary.includes('اسم المكتب: إيجاري ← مكتب الاختبار'), a.summary); assert.ok(a.summary.includes('آخر شهر مسجَّل في كشف التحصيل: — ← 2026-08'), a.summary);
    assert.ok(!/undefined|null/.test(a.summary), a.summary);
    assert.ok(recorded.some(op => op.type === 'audit' && op.record.entity === 'الإعدادات'), 'audit op handed to the sync recorder (reaches the Excel sheet)');
    E.Forms.settings(); modalBtn('حفظ').click(); await tick(20);
    assert.equal(E.Store.state().audit.length, before + 1, 'nothing changed ⇒ no audit row');
  } finally { E.Store.setRecorder(null); }
});

test('59. duplicate national-id confirmation lives in the form, not on the store record: a cancelled attempt warns again, the record is never tagged', async () => {
  const E = await boot(); const dup = E.Store.client('C002').nationalId, own = E.Store.client('C001').nationalId;
  const openEdit = () => { E.Forms.client(E.Store.client('C001')); const f = lastOverlay(); f.querySelector('#f_nationalId').value = dup; return f; };
  openEdit(); modalBtn('حفظ').click(); await tick();
  let f = lastOverlay(); assert.ok(f && f.querySelector('.form-errors') && f.querySelector('.form-errors').textContent.includes('C002'), 'warned');
  assert.equal(E.Store.client('C001').nationalId, own, 'not saved');
  modalBtn('إلغاء').click(); await tick(); assert.equal(lastOverlay(), null);
  assert.equal(E.Store.client('C001')._dupConfirmed, undefined, 'store record untouched');
  openEdit(); modalBtn('حفظ').click(); await tick();
  f = lastOverlay(); assert.ok(f && f.querySelector('.form-errors'), 'warned again on a fresh form (confirmation is per attempt)');
  assert.equal(E.Store.client('C001').nationalId, own);
  modalBtn('حفظ').click(); await tick();
  assert.equal(lastOverlay(), null, 'second save confirms');
  assert.equal(E.Store.client('C001').nationalId, dup);
  assert.ok(!('_dupConfirmed' in E.Store.client('C001')));
  // تغيير الرقم بعد التحذير إلى رقم مكرر آخر يحتاج تأكيدًا جديدًا
  const third = E.Store.client('C003').nationalId;
  openEdit(); modalBtn('حفظ').click(); await tick(); lastOverlay().querySelector('#f_nationalId').value = third; modalBtn('حفظ').click(); await tick();
  assert.ok(lastOverlay() && lastOverlay().querySelector('.form-errors').textContent.includes('C003'), 'a different duplicate warns anew');
  modalBtn('إلغاء').click(); await tick();
});

test('38. unit form passes allowDupLabel to model.validate: true when editing without renaming, false for a new unit or a renamed one', async () => {
  const E = await boot(); const calls = []; const ov = E.M.validate;
  E.M.validate = (ent, r, st, opts) => { if (ent === 'units') calls.push(opts); return ov(ent, r, st, opts); };
  try {
    E.Forms.unit(E.Store.state().units[0]); modalBtn('حفظ').click(); await tick();
    assert.deepEqual(calls[0], { allowDupLabel: true });
    if (lastOverlay()) { modalBtn('إلغاء').click(); await tick(); }
    E.Forms.unit(E.Store.state().units[0]); lastOverlay().querySelector('#f_label').value = 'اسم جديد ٩٩'; modalBtn('حفظ').click(); await tick();
    assert.deepEqual(calls[1], { allowDupLabel: false });
    if (lastOverlay()) { modalBtn('إلغاء').click(); await tick(); }
    E.Forms.unit(null, { projectCode: 'P01' }); lastOverlay().querySelector('#f_label').value = 'جديدة'; modalBtn('حفظ').click(); await tick();
    assert.deepEqual(calls[2], { allowDupLabel: false });
    if (lastOverlay()) { modalBtn('إلغاء').click(); await tick(); }
  } finally { E.M.validate = ov; }
});

test('39. orphan payments / contracts / maintenance (parent deleted in Excel) are listed with a badge when no scope filter is active, hidden under a filter, and deletable from the quality screen', async () => {
  const E = await boot();
  E.Store.applyOp({ type: 'upsert', entity: 'payments', code: 'INV-2026-9001', record: { code: 'INV-2026-9001', contractCode: 'T-MISSING', period: '2026-03', amount: 500, source: 'excel' } });
  E.Store.applyOp({ type: 'upsert', entity: 'maintenance', code: 'M9001', record: { code: 'M9001', unitCode: 'P09-9', date: '2026-05-01', description: 'صيانة على وحدة محذوفة', status: 'open', kind: 'other', borneBy: 'owner', cost: 10 } });
  E.Store.applyOp({ type: 'upsert', entity: 'contracts', code: 'T9001', record: { code: 'T9001', unitCode: 'P09-8', clientCode: 'C001', start: '2026-01-01', end: '2026-12-31', rent: 1000 } });
  const st = E.Store.state();
  const ctx = fakeCtx(E); Object.assign(ctx.filter, { projectCode: '', unitType: '', status: '', floor: '', q: '' });
  let el = render(E, 'payments', ctx); let rows = rowsOf(el);
  assert.equal(rows.length, st.payments.length, 'payments list = sidebar count');
  const pr = rows.find(r => r.textContent.includes('INV-2026-9001')); assert.ok(pr); assert.ok(pr.querySelectorAll('.badge.danger').some(b => b.textContent.includes('بلا عقد') && b.textContent.includes('T-MISSING')));
  assert.ok(byTitle(pr, 'حذف'), 'orphan payment has a delete icon');
  el = render(E, 'contracts', ctx); rows = rowsOf(el);
  assert.equal(rows.length, st.contracts.length, 'contracts list = sidebar count');
  const cr = rows.find(r => r.textContent.includes('T9001')); assert.ok(cr); assert.ok(cr.querySelectorAll('.badge.danger').some(b => b.textContent.includes('بلا وحدة') && b.textContent.includes('P09-8')));
  el = render(E, 'maintenance', ctx); rows = rowsOf(el);
  assert.equal(rows.length, st.maintenance.length, 'maintenance list = sidebar count');
  const mr = rows.find(r => r.textContent.includes('M9001')); assert.ok(mr); assert.ok(mr.querySelectorAll('.badge.danger').some(b => b.textContent.includes('بلا وحدة')));
  // تحت فلتر مشروع تختفي (لا تنتمي لأي وحدة)
  ctx.filter.projectCode = 'P01';
  assert.ok(!rowsOf(render(E, 'payments', ctx)).some(r => r.textContent.includes('INV-2026-9001')));
  assert.ok(!rowsOf(render(E, 'contracts', ctx)).some(r => r.textContent.includes('T9001')));
  assert.ok(!rowsOf(render(E, 'maintenance', ctx)).some(r => r.textContent.includes('M9001')));
  ctx.filter.projectCode = '';
  // البحث النصي يجد اليتيم بكوده (ولا يُظهر غيره)
  ctx.filter.q = 'T9001'; rows = rowsOf(render(E, 'contracts', ctx)); assert.equal(rows.length, 1); assert.ok(rows[0].textContent.includes('T9001'));
  ctx.filter.q = 'INV-2026-9001'; rows = rowsOf(render(E, 'payments', ctx)); assert.equal(rows.length, 1);
  ctx.filter.q = 'M9001'; rows = rowsOf(render(E, 'maintenance', ctx)); assert.equal(rows.length, 1);
  ctx.filter.q = 'لا يطابق شيئًا'; assert.equal(rowsOf(render(E, 'contracts', ctx)).length, 0); assert.equal(rowsOf(render(E, 'payments', ctx)).length, 0);
  ctx.filter.q = '';
  // شاشة جودة البيانات: زر حذف للدفعة والعقد اليتيمين يحذف فعلًا بعد التأكيد
  el = render(E, 'quality', ctx); rows = rowsOf(el);
  const qp = rows.find(r => r.textContent.includes('INV-2026-9001')); assert.ok(qp, 'orphan payment flagged'); assert.ok(byTitle(qp, 'حذف'));
  const qc = rows.find(r => r.textContent.includes('T9001')); assert.ok(qc, 'orphan contract flagged'); assert.ok(byTitle(qc, 'حذف'));
  assert.ok(!rows.filter(r => r.textContent.includes('عميل')).some(r => byTitle(r, 'حذف')), 'no delete on client/unit flags');
  const oc = E.UI.confirmDelete; let asked = 0; E.UI.confirmDelete = async () => { asked++; return true; };
  try { byTitle(qp, 'حذف').click(); await tick(30); byTitle(qc, 'حذف').click(); await tick(30); } finally { E.UI.confirmDelete = oc; }
  assert.equal(asked, 2); assert.equal(E.Store.get('payments', 'INV-2026-9001'), null); assert.equal(E.Store.get('contracts', 'T9001'), null);
  // بوابة الصلاحيات: الموظف لا يحذف عقدًا، ويحذف دفعة
  E.Store.applyOp({ type: 'upsert', entity: 'contracts', code: 'T9001', record: { code: 'T9001', unitCode: 'P09-8', clientCode: 'C001', start: '2026-01-01', end: '2026-12-31', rent: 1000 } });
  E.Auth.demo('موظف'); E.Auth.user().role = 'staff';
  el = render(E, 'quality', ctx); byTitle(rowsOf(el).find(r => r.textContent.includes('T9001')), 'حذف').click(); await tick(20);
  assert.ok(E.Store.get('contracts', 'T9001'), 'staff cannot delete a contract');
  assert.ok(body().querySelectorAll('.toast').some(t => t.textContent.includes('صلاحياتك لا تسمح')));
  E.Auth.demo('المدير');
});

test('smoke: every page renders with the real ctx without throwing (orphans included)', async () => {
  const E = await boot();
  E.Store.applyOp({ type: 'upsert', entity: 'payments', code: 'INV-2026-9001', record: { code: 'INV-2026-9001', contractCode: 'T-MISSING', period: '2026-03', amount: 500 } });
  E.Store.applyOp({ type: 'upsert', entity: 'units', code: 'P09-1', record: { code: 'P09-1', projectCode: 'P09', label: '1', type: 'admin' } });
  E.Store.applyOp({ type: 'upsert', entity: 'contracts', code: 'T9002', record: { code: 'T9002', unitCode: 'P01-102', clientCode: 'C001', start: '', end: '', rent: 1000 } });
  for (const page of Object.keys(E.App.VIEWS.filter(v => v.key && v.key !== 'bi').reduce((o, v) => (o[v.key] = 1, o), {}))) {
    const el = render(E, page, fakeCtx(E));
    assert.ok(el.childNodes.length > 0, page);
    assert.ok(!/undefined/.test(el.textContent), page + ' shows undefined');
  }
  for (const [kind, code] of [['unit', 'P09-1'], ['unit', 'P01-102'], ['contract', 'T9002'], ['client', 'C001'], ['project', 'P01']]) { E.Views.profile(kind, code, fakeCtx(E)); assert.ok(drawer(), kind + ' ' + code); assert.ok(!/undefined/.test(drawer().textContent), kind + ' ' + code); }
});
