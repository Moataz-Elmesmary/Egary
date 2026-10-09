/* =====================================================================
   app.js — الهيكل: الإقلاع، ربط الإكسيل، التوجيه، الشريط الجانبي، البحث، الفلاتر، المزامنة
   ===================================================================== */
window.Egary = window.Egary || {};
(function (E) {
  'use strict';
  const U = () => E.U, M = () => E.M, S = () => E.Store, UI = () => E.UI, En = () => E.Engine, W = () => E.Workbook, F = () => E.Forms;
  const h = (...a) => E.UI.h(...a);
  const SNAP_KEY = 'egary-snapshot-v1', THEME_KEY = 'egary-theme', FILTER_KEY = 'egary-filter-v1';

  const VIEWS = [
    { key: 'dashboard', title: 'لوحة المؤشرات', icon: 'home' },
    { key: 'ledger', title: 'كشف التحصيل (الورقة)', icon: 'table' },
    { key: 'insights', title: 'التحليلات والإنسايتس', icon: 'sparkles' },
    { sep: true, label: 'السجلات' },
    { key: 'projects', title: 'المشاريع', icon: 'building', count: s => s.projects.length },
    { key: 'units', title: 'الوحدات', icon: 'door', count: s => s.units.length },
    { key: 'clients', title: 'العملاء', icon: 'users', count: s => s.clients.length },
    { key: 'contracts', title: 'العقود', icon: 'file', count: s => s.contracts.length },
    { key: 'payments', title: 'المدفوعات والفواتير', icon: 'receipt', count: s => s.payments.length },
    { key: 'maintenance', title: 'الصيانة والإصلاحات', icon: 'wrench', count: s => s.maintenance.length },
    { sep: true, label: 'النظام' },
    { key: 'quality', title: 'جودة البيانات', icon: 'shield' },
    { key: 'audit', title: 'سجل التعديلات', icon: 'calendar' },
    { key: 'settings', title: 'الإعدادات والملف', icon: 'settings' },
    { key: 'bi', title: 'لوحة BI التفاعلية', icon: 'bi' },
  ];

  const App = {
    filter: { projectCode: '', unitType: '', status: '', floor: '', q: '' },
    year: String(new Date().getFullYear()),
    route: { view: 'dashboard', id: '', params: {} },
    mode: 'none', // 'linked' | 'preview' | 'file' | 'demo'
    flags: [],
    els: {},
  };

  /* ---------- ثيم ---------- */
  function applyTheme(t) { document.documentElement.dataset.theme = t === 'dark' ? 'dark' : 'light'; try { localStorage.setItem(THEME_KEY, t); } catch (e) { } }
  function toggleTheme() { applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); render(); }

  /* ---------- اللقطة (لحل التعارض) ---------- */
  function saveSnapshot() { try { localStorage.setItem(SNAP_KEY, JSON.stringify(W().snapshotOf(S().state()))); } catch (e) { } }
  function loadSnapshot() { try { return JSON.parse(localStorage.getItem(SNAP_KEY) || 'null'); } catch (e) { return null; } }

  /* ---------- المزامنة ---------- */
  function initSync() {
    E.Sync.init({
      serialize: async () => { const buf = await W().write(S().state()); saveSnapshot(); E.FileLink.saveBackup(buf); return buf; },
      deserialize: async (buf) => { const r = await W().read(buf, { snapshot: loadSnapshot() }); S().load(r.state); App.flags = r.flags; saveSnapshot(); E.FileLink.saveBackup(buf); },
      applyOps: ops => S().applyOps(ops),
      onStatus: renderSync,
      onExternalChange: () => { UI().toast('تم تحديث البيانات من ملف الإكسيل', 'ok'); render(); },
      pollMs: 2000,
    });
  }
  function renderSync(st) {
    const el = App.els.sync; if (!el) return;
    const map = { unlinked: ['غير مرتبط بملف', 'اضغط لربط ملف الإكسيل'], linked: ['متزامن مع ' + (st.name || 'الإكسيل'), st.lastSync ? 'آخر مزامنة ' + new Date(st.lastSync).toLocaleTimeString('ar-EG') : ''], saving: ['جارٍ الحفظ في الإكسيل…', ''], reading: ['جارٍ القراءة من الإكسيل…', ''], locked: ['الملف مفتوح في Excel — ' + st.pending + ' تعديل بانتظار الحفظ', 'أغلق الملف في Excel وسيُحفظ تلقائيًا'], error: ['خطأ في المزامنة', st.error || ''] };
    const [t, sub] = map[st.state] || ['', ''];
    el.className = 'sync ' + st.state; UI().clear(el); el.append(h('span', { class: 'dot' }), h('span', null, t)); el.title = sub;
    const banner = App.els.banner; if (!banner) return; UI().clear(banner);
    if (st.state === 'locked') banner.appendChild(h('div', { class: 'banner warn' }, UI().icon('warning'), h('span', null, `ملف الإكسيل مفتوح في برنامج Excel، لذلك لا يمكن الحفظ الآن. تعديلاتك (${st.pending}) محفوظة مؤقتًا وستُكتب تلقائيًا بمجرد إغلاق الملف.`), h('button', { class: 'btn sm', onclick: () => E.Sync.flush() }, 'حاول الآن')));
    else if (st.state === 'error') banner.appendChild(h('div', { class: 'banner danger' }, UI().icon('warning'), h('span', null, 'خطأ في المزامنة: ' + (st.error || '')), h('button', { class: 'btn sm', onclick: () => E.Sync.flush() }, 'إعادة المحاولة')));
    else if (App.mode === 'preview' || App.mode === 'demo' || App.mode === 'file') banner.appendChild(h('div', { class: 'banner info' }, UI().icon('info'), h('span', null, App.mode === 'demo' ? 'وضع تجريبي ببيانات نموذجية — التعديلات لا تُحفظ. اربط ملف الإكسيل لبدء العمل الحقيقي.' : 'الملف مفتوح للعرض بلا ربط — التعديلات تبقى في الذاكرة فقط. يمكنك تنزيل نسخة إكسيل محدثة أو ربط الملف للحفظ التلقائي.'), E.FileLink.supported ? h('button', { class: 'btn sm primary', onclick: linkFile }, UI().icon('link'), 'ربط ملف الإكسيل') : null, h('button', { class: 'btn sm', onclick: downloadCopy }, UI().icon('download'), 'تنزيل نسخة إكسيل')));
  }
  async function downloadCopy() { const buf = await W().write(S().state()); E.FileLink.downloadBytes(buf, 'Egary.xlsx'); UI().toast('تم تنزيل نسخة الإكسيل', 'ok'); }
  async function downloadBackup() { const b = await E.FileLink.loadBackup(); if (!b || !b.bytes) { UI().toast('لا توجد نسخة احتياطية بعد', 'warn'); return; } E.FileLink.downloadBytes(b.bytes, 'Egary-backup-' + new Date(b.at).toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.xlsx'); UI().toast('تم تنزيل النسخة الاحتياطية (' + new Date(b.at).toLocaleString('ar-EG') + ')', 'ok'); }

  async function linkFile() {
    try {
      const adapter = await E.FileLink.pick();
      await startWith(adapter);
    } catch (e) { if (e && e.name !== 'AbortError') UI().toast('تعذّر ربط الملف: ' + (e.message || e), 'danger'); }
  }
  async function startWith(adapter) {
    const perm = await adapter.permission(true);
    if (perm !== 'granted') { UI().toast('لم يُسمح بالوصول إلى الملف', 'danger'); return false; }
    App.mode = 'linked';
    S().setRecorder(op => E.Sync.record(op));
    try {
      await E.Sync.link(adapter, { writeOnLink: true });
    } catch (e) { UI().toast('تعذّر قراءة الملف: ' + (e.message || e), 'danger'); App.mode = 'none'; S().setRecorder(null); return false; }
    showApp();
    if (App.flags.some(f => f.sev === 'danger' || f.sev === 'warn')) UI().toast(`تمت قراءة الملف — ${App.flags.length} ملاحظة في «جودة البيانات»`, 'warn', 5000);
    else UI().toast('تم ربط ملف الإكسيل — كل تعديل يُحفظ فيه تلقائيًا', 'ok');
    return true;
  }
  async function openWithoutLink(file) {
    const buf = await file.arrayBuffer();
    const r = await W().read(buf, { snapshot: null });
    S().load(r.state); App.flags = r.flags; App.mode = 'file'; S().setRecorder(null);
    showApp(); renderSync(E.Sync.status);
  }
  async function loadDemo() {
    S().load(E.Demo ? E.Demo.state() : M().emptyState()); App.mode = 'demo'; S().setRecorder(null); App.flags = [];
    showApp(); renderSync(E.Sync.status);
  }
  async function tryPreview() { // على استضافة http(s): اعرض Egary.xlsx المجاور للقراءة
    if (!/^https?:/.test(location.protocol)) return false;
    try {
      const res = await fetch('Egary.xlsx', { cache: 'no-store' }); if (!res.ok) return false;
      const buf = await res.arrayBuffer(); const r = await W().read(buf, { snapshot: null });
      S().load(r.state); App.flags = r.flags; App.mode = 'preview'; S().setRecorder(null);
      showApp(); renderSync(E.Sync.status); return true;
    } catch (e) { return false; }
  }

  /* ---------- شاشة البداية ---------- */
  function welcome(restored) {
    const root = App.els.root; UI().clear(root); document.body.classList.add('no-app');
    const fileInput = h('input', { type: 'file', accept: '.xlsx', class: 'hidden', onchange: (e) => { if (e.target.files[0]) openWithoutLink(e.target.files[0]); } });
    const box = h('div', { class: 'box' },
      h('div', { class: 'logo' }, UI().icon('building', 38)),
      h('h1', null, 'إيجاري'),
      h('p', { class: 'muted' }, 'إدارة الإيجارات — مصدر البيانات ملف الإكسيل الموجود بجوار البرنامج'),
      restored ? h('div', { class: 'banner ok mt' }, UI().icon('check'), h('span', null, `الملف المربوط سابقًا: ${restored.name}`)) : null,
      restored ? h('div', { class: 'mt' }, h('button', { class: 'btn primary', id: 'btn-resume', onclick: () => startWith(restored) }, UI().icon('link'), 'متابعة العمل على ' + restored.name)) : null,
      !restored ? h('div', { class: 'steps' },
        h('div', null, h('b', null, '1'), h('span', null, 'اضغط «ربط ملف الإكسيل» واختر ملف ', h('span', { class: 'code' }, 'Egary.xlsx'), ' الموجود في نفس المجلد.')),
        h('div', null, h('b', null, '2'), h('span', null, 'اسمح للمتصفح بالقراءة والكتابة (مرة واحدة). من هنا كل تعديل في البرنامج يُحفظ في الإكسيل فورًا، وأي تعديل في الإكسيل يظهر في البرنامج.')),
        h('div', null, h('b', null, '3'), h('span', null, 'لو ملف الإكسيل مفتوح في برنامج Excel، سيُحفظ التعديل تلقائيًا بعد إغلاقه.')),
      ) : null,
      h('div', { class: 'flex wrap mt', style: { justifyContent: 'center' } },
        E.FileLink.supported ? h('button', { class: 'btn primary', id: 'btn-link', onclick: linkFile }, UI().icon('link'), restored ? 'ربط ملف آخر' : 'ربط ملف الإكسيل') : h('div', { class: 'banner warn' }, UI().icon('warning'), h('span', null, 'هذا المتصفح لا يدعم المزامنة التلقائية — افتح البرنامج بـ Microsoft Edge أو Google Chrome (ملف Open-Egary.bat).')),
        h('button', { class: 'btn', id: 'btn-open', onclick: () => fileInput.click() }, UI().icon('upload'), 'فتح ملف للعرض فقط'),
        h('button', { class: 'btn ghost', id: 'btn-demo', onclick: loadDemo }, UI().icon('eye'), 'تجربة ببيانات نموذجية'),
        fileInput,
      ),
      h('p', { class: 'small muted mt' }, 'يعمل بالكامل على جهازك بلا إنترنت ولا خادم. المتصفح الموصى به: Edge أو Chrome.'),
    );
    root.appendChild(h('div', { class: 'welcome' }, box));
  }

  /* ---------- الهيكل ---------- */
  function showApp() {
    const root = App.els.root; UI().clear(root); document.body.classList.remove('no-app');
    const nav = h('nav', { class: 'nav' });
    const sidebar = h('aside', { class: 'sidebar', id: 'sidebar' }, h('div', { class: 'brand' }, h('div', { class: 'logo' }, UI().icon('building', 22)), h('div', null, h('b', null, S().state().meta.officeName || 'إيجاري'), h('span', null, 'إدارة الإيجارات'))), nav, h('div', { class: 'foot' }, 'Egary v2 — الإكسيل هو مصدر البيانات'));
    App.els.nav = nav;
    const search = h('input', { type: 'search', placeholder: 'ابحث بالكود أو الاسم أو التليفون أو الرقم القومي…', id: 'global-search', 'aria-label': 'بحث' });
    const sugg = h('div', { class: 'suggest hidden', id: 'suggest' });
    App.els.search = search; App.els.suggest = sugg;
    search.addEventListener('input', () => suggest(search.value));
    search.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const on = sugg.querySelector('.item.on') || sugg.querySelector('.item'); if (on && !sugg.classList.contains('hidden')) { on.click(); } else { App.filter.q = search.value.trim(); saveFilter(); go(App.route.view === 'dashboard' || App.route.view === 'bi' ? 'units' : App.route.view); } sugg.classList.add('hidden'); } if (e.key === 'Escape') sugg.classList.add('hidden'); if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { const items = [...sugg.querySelectorAll('.item')]; if (!items.length) return; e.preventDefault(); let i = items.findIndex(x => x.classList.contains('on')); items.forEach(x => x.classList.remove('on')); i = e.key === 'ArrowDown' ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1); items[i].classList.add('on'); } });
    search.addEventListener('focus', () => { if (search.value) suggest(search.value); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.search')) sugg.classList.add('hidden'); });
    const syncEl = h('button', { class: 'sync unlinked', id: 'sync-status', onclick: () => go('settings') }, h('span', { class: 'dot' }), h('span', null, '…'));
    App.els.sync = syncEl;
    const themeBtn = h('button', { class: 'btn icon', title: 'الوضع الداكن/الفاتح', id: 'theme-btn', onclick: toggleTheme }, UI().icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon'));
    const title = h('div', { class: 'title', id: 'page-title' });
    const topbar = h('header', { class: 'topbar' }, h('button', { class: 'btn icon ghost menu-btn', onclick: () => sidebar.classList.toggle('open') }, UI().icon('menu')), title, h('div', { class: 'search' }, UI().icon('search'), search, sugg), syncEl, themeBtn);
    const banner = h('div', { id: 'banner' }); App.els.banner = banner;
    const content = h('div', { class: 'content', id: 'content' }); App.els.content = content;
    root.appendChild(h('div', { id: 'app' }, sidebar, h('main', { class: 'main' }, topbar, h('div', { style: { padding: '0 22px' } }, banner), content)));
    App.els.title = title;
    renderNav();
    renderSync(E.Sync.status);
    if (!App._routed) { window.addEventListener('hashchange', onHash); App._routed = true; }
    onHash();
  }
  function renderNav() {
    const nav = App.els.nav; if (!nav) return; UI().clear(nav);
    const st = S().state();
    for (const v of VIEWS) {
      if (v.sep) { nav.appendChild(h('div', { class: 'sep' })); nav.appendChild(h('div', { class: 'label' }, v.label)); continue; }
      nav.appendChild(h('a', { href: '#/' + v.key, class: App.route.view === v.key ? 'active' : '', dataset: { view: v.key }, onclick: () => { document.getElementById('sidebar').classList.remove('open'); } }, UI().icon(v.icon), h('span', null, v.title), v.count ? h('span', { class: 'cnt' }, v.count(st)) : null));
    }
  }

  /* ---------- التوجيه ---------- */
  function parseHash() {
    const raw = (location.hash || '#/dashboard').replace(/^#\/?/, '');
    const [pathPart, qs] = raw.split('?');
    const parts = pathPart.split('/').filter(Boolean);
    const params = {}; if (qs) for (const kv of qs.split('&')) { const [k, v] = kv.split('='); params[decodeURIComponent(k)] = decodeURIComponent(v || ''); }
    return { view: parts[0] || 'dashboard', id: parts[1] ? decodeURIComponent(parts[1]) : '', params };
  }
  function onHash() {
    App.route = parseHash();
    const known = VIEWS.some(v => v.key === App.route.view) || ['project', 'unit', 'client', 'contract', 'payment', 'maintenance-item'].includes(App.route.view);
    if (!known) { App.route = { view: 'dashboard', id: '', params: {} }; }
    // روابط البروفايلات: #/unit/P03-304 → تفتح الدرج فوق الشاشة المناسبة
    const profileKinds = { project: 'projects', unit: 'units', client: 'clients', contract: 'contracts' };
    if (profileKinds[App.route.view]) { const kind = App.route.view, code = App.route.id; App.route = { view: profileKinds[kind], id: '', params: {} }; render(); open(kind, code); return; }
    if (App.route.params.q != null) { App.filter.q = App.route.params.q; }
    if (App.route.params.project != null) App.filter.projectCode = App.route.params.project;
    if (App.route.params.type != null) App.filter.unitType = App.route.params.type;
    if (App.route.params.status != null) App.filter.status = App.route.params.status;
    if (App.route.params.year) App.year = App.route.params.year;
    UI().closeDrawer();
    render();
  }
  function go(view, params) {
    let hash = '#/' + view;
    if (params && Object.keys(params).length) hash += '?' + Object.entries(params).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
    if (location.hash === hash) onHash(); else location.hash = hash;
  }
  function render() {
    if (!App.els.content) return;
    if (App.route.view === 'bi') { if (E.BI) E.BI.open(); return; }
    const v = VIEWS.find(x => x.key === App.route.view) || VIEWS[0];
    App.els.title.textContent = v.title; document.title = v.title + ' — إيجاري';
    renderNav();
    const c = App.els.content; UI().clear(c);
    if (App.els.search && App.els.search.value !== App.filter.q) App.els.search.value = App.filter.q;
    try { E.Views.render(v.key, c, ctx()); } catch (e) { console.error(e); c.appendChild(h('div', { class: 'banner danger' }, 'خطأ في عرض الشاشة: ' + e.message)); }
  }
  function ctx() { return { filter: App.filter, year: App.year, params: App.route.params, open, evidence, go, rerender: render, filterBar, setYear: (y) => { App.year = String(y); render(); }, mode: App.mode, flags: App.flags, readOnly: App.mode !== 'linked' && App.mode !== 'file' && App.mode !== 'demo' }; }

  /* ---------- الفلاتر ---------- */
  function saveFilter() { try { localStorage.setItem(FILTER_KEY, JSON.stringify(App.filter)); } catch (e) { } }
  function setFilter(patch) { Object.assign(App.filter, patch); saveFilter(); render(); }
  function filterBar(opts) {
    opts = opts || {};
    const st = S().state(), f = App.filter;
    const chip = (label, on, onClick, cls) => h('button', { class: 'chip ' + (on ? 'on' : '') + ' ' + (cls || ''), onclick: onClick }, label, on ? h('span', { class: 'x' }, '×') : null);
    const bar = h('div', { class: 'flex wrap row-gap', id: 'filter-bar' });
    bar.appendChild(h('span', { class: 'muted small flex' }, UI().icon('filter'), 'الفلاتر:'));
    for (const p of st.projects) bar.appendChild(chip(p.name, f.projectCode === p.code, () => setFilter({ projectCode: f.projectCode === p.code ? '' : p.code }), 'f-project'));
    bar.appendChild(h('span', { class: 'muted' }, '|'));
    for (const t of M().UNIT_TYPES) bar.appendChild(chip(t.ar, f.unitType === t.key, () => setFilter({ unitType: f.unitType === t.key ? '' : t.key }), 'f-type'));
    if (opts.status !== false) { bar.appendChild(h('span', { class: 'muted' }, '|')); for (const [k, ar] of [['occupied', 'مؤجَّرة'], ['vacant', 'شاغرة'], ['ending', 'تنتهي قريبًا']]) bar.appendChild(chip(ar, f.status === k, () => setFilter({ status: f.status === k ? '' : k }), 'f-status')); }
    if (opts.year) { const years = st.settings.ledgerYears.length ? st.settings.ledgerYears : [new Date().getFullYear()]; const sel = h('select', { class: 'chip', id: 'year-select', onchange: (e) => { App.year = e.target.value; render(); } }, years.map(y => h('option', { value: y, selected: String(y) === String(App.year) ? true : null }, 'سنة ' + y))); bar.appendChild(sel); }
    if (f.q) bar.appendChild(chip('بحث: ' + f.q, true, () => setFilter({ q: '' }), 'f-q'));
    if (f.projectCode || f.unitType || f.status || f.q || f.floor) bar.appendChild(h('button', { class: 'btn sm ghost', id: 'clear-filters', onclick: () => setFilter({ projectCode: '', unitType: '', status: '', floor: '', q: '' }) }, 'مسح الكل'));
    return bar;
  }

  /* ---------- البحث مع الاقتراحات ---------- */
  function suggest(q) {
    const box = App.els.suggest; if (!box) return;
    const n = U().normalize(q); UI().clear(box);
    if (!n) { box.classList.add('hidden'); return; }
    const st = S().state(), out = [];
    const m = (hay) => U().matches(hay, n);
    for (const p of st.projects) if (m(p.code + ' ' + p.name + ' ' + p.address)) out.push({ k: 'مشروع', code: p.code, label: p.name, sub: p.address, open: () => open('project', p.code) });
    for (const u of st.units) if (m(u.code + ' ' + u.label)) out.push({ k: 'وحدة', code: u.code, label: u.label, sub: (S().project(u.projectCode) || {}).name, open: () => open('unit', u.code) });
    for (const c of st.clients) if (m([c.code, c.name, c.rep, c.phone, c.phone2, c.nationalId, c.taxId].join(' '))) out.push({ k: 'عميل', code: c.code, label: c.name, sub: c.phone || c.nationalId, open: () => open('client', c.code) });
    for (const c of st.contracts) if (m(c.code)) { const cl = S().client(c.clientCode) || {}, u = S().unit(c.unitCode) || {}; out.push({ k: 'عقد', code: c.code, label: `${cl.name || ''} — ${u.label || ''}`, sub: U().fmtDate(c.start) + ' → ' + U().fmtDate(c.end), open: () => open('contract', c.code) }); }
    for (const p of st.payments) if (m(p.code + ' ' + p.ref)) { const c = S().contract(p.contractCode) || {}; const cl = S().client(c.clientCode) || {}; out.push({ k: 'فاتورة', code: p.code, label: `${cl.name || ''} — ${U().periodLabel(p.period, true)}`, sub: U().fmtMoney(p.amount), open: () => F().invoice(p) }); }
    for (const mt of st.maintenance) if (m(mt.code + ' ' + mt.description)) { const u = S().unit(mt.unitCode) || {}; out.push({ k: 'صيانة', code: mt.code, label: mt.description.slice(0, 40), sub: u.label, open: () => open('unit', mt.unitCode) }); }
    const top = out.slice(0, 14);
    if (!top.length) { box.appendChild(h('div', { class: 'item muted' }, 'لا توجد نتائج — اضغط Enter للبحث داخل القوائم')); }
    for (const r of top) box.appendChild(h('div', { class: 'item', onclick: () => { box.classList.add('hidden'); r.open(); } }, h('span', { class: 'k' }, r.k), h('span', { class: 'code' }, r.code), h('span', null, r.label), h('span', { class: 'sub' }, r.sub || '')));
    box.classList.remove('hidden');
  }

  /* ---------- فتح بروفايل / دليل ---------- */
  function open(kind, code) { E.Views.profile(kind, code, ctx()); }
  function evidence(title, rows, cols, opts) {
    opts = opts || {};
    const body = [opts.intro ? h('p', { class: 'muted' }, opts.intro) : null, UI().table({ cols, rows, onRow: opts.onRow, foot: opts.foot, sort: opts.sort, sortDir: opts.sortDir, emptyTitle: opts.emptyTitle, empty: opts.empty })];
    return UI().drawer({ title, body, actions: opts.actions });
  }

  /* ---------- الإقلاع ---------- */
  async function boot() {
    applyTheme((() => { try { return localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { return 'light'; } })());
    try { const f = JSON.parse(localStorage.getItem(FILTER_KEY) || 'null'); if (f) Object.assign(App.filter, f); } catch (e) { }
    App.els.root = document.getElementById('root');
    initSync();
    const yrs = []; App.year = String(new Date().getFullYear());
    if (E.FileLink.supported) {
      const restored = await E.FileLink.restore();
      if (restored) {
        // لو الإذن ما زال ممنوحًا (Chrome يحفظه) نبدأ مباشرة بلا نقرة
        try { if ((await restored.permission(false)) === 'granted') { if (await startWith(restored)) return; } } catch (e) { }
        welcome(restored); return;
      }
    }
    if (await tryPreview()) return;
    welcome(null);
  }
  /* واجهة للاختبارات: ربط محوِّل ذاكرة مباشرة */
  async function linkAdapter(adapter) { App.mode = 'linked'; S().setRecorder(op => E.Sync.record(op)); await E.Sync.link(adapter, { writeOnLink: false }); showApp(); return true; }

  Object.assign(App, { boot, go, open, evidence, render, setFilter, filterBar, linkFile, linkAdapter, downloadCopy, downloadBackup, loadDemo, openWithoutLink, ctx, VIEWS, saveSnapshot, loadSnapshot, toggleTheme });
  E.App = App;
  document.addEventListener('DOMContentLoaded', () => { if (!window.__EGARY_NO_BOOT) boot(); });
})(window.Egary);
