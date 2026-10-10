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
    filter: { projectCode: '', unitType: '', status: '', floor: '', q: '', period: '' }, // period: شهر التقرير المختار (لا يُحفظ بين الجلسات)
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
  function snapName() { return (E.Sync.adapter && E.Sync.adapter.name) || ''; }
  function saveSnapshot() { try { const snap = W().snapshotOf(S().state()); snap.file = snapName(); localStorage.setItem(SNAP_KEY, JSON.stringify(snap)); } catch (e) { } }
  function loadSnapshot() { try { const snap = JSON.parse(localStorage.getItem(SNAP_KEY) || 'null'); return snap && (!snap.file || snap.file === snapName()) ? snap : null; } catch (e) { return null; } }

  /* ---------- المزامنة ---------- */
  let lastBytes = null; // آخر ملف مقروء/مكتوب — لحفظ الأوراق التي أضافها المكتب كما هي
  function initSync() {
    E.Sync.init({
      serialize: async () => { const buf = await W().write(S().state(), { base: lastBytes }); lastBytes = buf; saveSnapshot(); E.FileLink.saveBackup(buf); return buf; },
      deserialize: async (buf) => { if (App.mode === 'linked' && E.Sync.adapter) await E.FileLink.saveOriginal(buf, E.Sync.adapter.name); const r = await W().read(buf, { snapshot: loadSnapshot() }); lastBytes = buf; S().load(r.state); App.flags = r.flags; saveSnapshot(); E.FileLink.saveBackup(buf); },
      applyOps: ops => S().applyOps(ops),
      onStatus: renderSync,
      onExternalChange: () => { if (E.Auth.user() && !E.Auth.revalidate()) { UI().toast('أُلغي حسابك أو عُطِّل من المدير — سيُعاد فتح شاشة الدخول', 'warn', 4000); setTimeout(() => location.reload(), 1500); return; } UI().toast('تم تحديث البيانات من ملف الإكسيل', 'ok'); render(); },
      onWritten: (buf) => { E.Backup.write(buf, '', false); },
      pollMs: 2000,
    });
    E.Backup.subscribe(() => { if (App.route.view === 'settings') render(); });
  }
  /* ---------- النسخ الاحتياطي على القرص ---------- */
  async function restoreBackupDir() {
    if (!E.FileLink.dirSupported) return false;
    const h = await E.FileLink.loadDirHandle(); if (!h) return false;
    try { if ((await E.FileLink.dirPermission(h, true)) !== 'granted') return false; } catch (e) { return false; }
    await E.Backup.setDir(h); return true;
  }
  async function enableBackups() {
    try {
      const h = await E.FileLink.pickDirectory();
      await E.Backup.setDir(h);
      if (lastBytes) await E.Backup.write(lastBytes, 'original', true);
      UI().toast('تم تفعيل النسخ الاحتياطي التلقائي في مجلد backups', 'ok');
      render(); return true;
    } catch (e) { if (e && e.name !== 'AbortError') UI().toast('تعذّر اختيار المجلد: ' + (e.message || e), 'danger'); return false; }
  }
  async function backupNow(label) {
    if (!lastBytes) { UI().toast('لا توجد بيانات محمَّلة بعد', 'warn'); return false; }
    if (!E.Backup.status().enabled) { E.FileLink.saveBackup(lastBytes); return 'browser'; }
    const n = await E.Backup.write(lastBytes, label || 'manual', true);
    if (n && !label) UI().toast('حُفظت نسخة احتياطية: ' + n, 'ok');
    return n;
  }
  function offerBackupFolder() {
    if (!E.FileLink.dirSupported || App.mode !== 'linked' || E.Backup.status().enabled) return;
    let shown = false; try { shown = localStorage.getItem('egary-backup-offered') === '1'; } catch (e) { }
    if (shown) return;
    try { localStorage.setItem('egary-backup-offered', '1'); } catch (e) { }
    const m = UI().modal({ title: 'تفعيل النسخ الاحتياطي التلقائي', size: 'sm', body: h('div', null, h('p', null, 'ليبقى عندك دائمًا نسخة من الإكسيل على القرص: اختر مجلد البرنامج نفسه (المجلد الذي فيه Egary.xlsx) مرة واحدة، وسيحفظ البرنامج نسخًا تلقائية في مجلد فرعي باسم ', h('span', { class: 'code' }, 'backups'), ' بعد كل تعديل وقبل أي حذف.'), h('p', { class: 'muted small mt-s' }, 'يمكنك تفعيله لاحقًا من الإعدادات.')), footer: [h('button', { class: 'btn', onclick: () => m.close() }, 'لاحقًا'), h('button', { class: 'btn primary', id: 'btn-enable-backups', onclick: async () => { m.close(); await enableBackups(); } }, UI().icon('shield'), 'اختيار مجلد البرنامج')] });
  }
  function renderSync(st) {
    const el = App.els.sync; if (!el) return;
    const map = { unlinked: ['غير مرتبط بملف', 'اضغط لربط ملف الإكسيل'], linked: ['متزامن مع ' + (st.name || 'الإكسيل'), st.lastSync ? 'آخر مزامنة ' + U().fmtTime(st.lastSync) : ''], saving: ['جارٍ الحفظ في الإكسيل…', ''], reading: ['جارٍ القراءة من الإكسيل…', ''], locked: ['الملف مفتوح في Excel — ' + st.pending + ' تعديل بانتظار الحفظ', 'أغلق الملف في Excel وسيُحفظ تلقائيًا'], error: ['خطأ في المزامنة', st.error || ''] };
    const [t, sub] = map[st.state] || ['', ''];
    el.className = 'sync ' + st.state; UI().clear(el); el.append(h('span', { class: 'dot' }), h('span', null, t)); el.title = sub;
    const banner = App.els.banner; if (!banner) return; UI().clear(banner);
    if (st.state === 'locked') banner.appendChild(h('div', { class: 'banner warn' }, UI().icon('warning'), h('span', null, `ملف الإكسيل مفتوح في برنامج Excel، لذلك لا يمكن الحفظ الآن. تعديلاتك (${st.pending}) محفوظة مؤقتًا وستُكتب تلقائيًا بمجرد إغلاق الملف.`), h('button', { class: 'btn sm', onclick: () => E.Sync.flush() }, 'حاول الآن')));
    else if (st.state === 'error') banner.appendChild(h('div', { class: 'banner danger' }, UI().icon('warning'), h('span', null, 'خطأ في المزامنة: ' + (st.error || '')), h('button', { class: 'btn sm', onclick: () => E.Sync.flush() }, 'إعادة المحاولة'), E.FileLink.supported && (!E.Auth.user() || E.Auth.can('unlink')) ? h('button', { class: 'btn sm primary', onclick: linkFile }, UI().icon('link'), 'ربط الملف من جديد') : null));
    else if (App.mode === 'preview' || App.mode === 'demo' || App.mode === 'file') banner.appendChild(h('div', { class: 'banner info' }, UI().icon('info'), h('span', null, App.mode === 'demo' ? 'وضع تجريبي ببيانات نموذجية — التعديلات لا تُحفظ. اربط ملف الإكسيل لبدء العمل الحقيقي.' : 'الملف مفتوح للعرض بلا ربط — التعديلات تبقى في الذاكرة فقط. يمكنك تنزيل نسخة إكسيل محدثة أو ربط الملف للحفظ التلقائي.'), E.FileLink.supported ? h('button', { class: 'btn sm primary', onclick: linkFile }, UI().icon('link'), 'ربط ملف الإكسيل') : null, h('button', { class: 'btn sm', onclick: downloadCopy }, UI().icon('download'), 'تنزيل نسخة إكسيل')));
  }
  async function downloadCopy() { const buf = await W().write(S().state(), { base: lastBytes }); E.FileLink.downloadBytes(buf, 'Egary.xlsx'); UI().toast('تم تنزيل نسخة الإكسيل', 'ok'); }
  async function downloadOriginal() { const b = await E.FileLink.loadOriginal(); if (!b || !b.bytes) { UI().toast('لا يوجد ملف أصلي محفوظ (يُحفظ عند أول ربط)', 'warn'); return; } E.FileLink.downloadBytes(b.bytes, 'Egary-original-' + new Date(b.at).toISOString().slice(0, 10) + '.xlsx'); UI().toast('تم تنزيل الملف الأصلي كما كان قبل أول تحويل (' + new Date(b.at).toLocaleDateString('ar-EG') + ')', 'ok'); }
  async function downloadBackup() { const b = await E.FileLink.loadBackup(); if (!b || !b.bytes) { UI().toast('لا توجد نسخة احتياطية بعد', 'warn'); return; } E.FileLink.downloadBytes(b.bytes, 'Egary-backup-' + new Date(b.at).toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.xlsx'); UI().toast('تم تنزيل النسخة الاحتياطية (' + U().fmtDateTime(b.at) + ')', 'ok'); }

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
    await gate();
    showApp();
    if (App.flags.some(f => f.sev === 'danger' || f.sev === 'warn')) UI().toast(`تمت قراءة الملف — ${App.flags.length} ملاحظة في «جودة البيانات»`, 'warn', 5000);
    else UI().toast('تم ربط ملف الإكسيل — كل تعديل يُحفظ فيه تلقائيًا', 'ok');
    restoreBackupDir().then(ok => { if (ok && lastBytes) E.Backup.write(lastBytes, '', false); else setTimeout(offerBackupFolder, 1200); });
    return true;
  }
  async function openWithoutLink(file) {
    const buf = await file.arrayBuffer();
    const r = await W().read(buf, { snapshot: null }); lastBytes = buf;
    S().load(r.state); App.flags = r.flags; App.mode = 'file'; S().setRecorder(null);
    await gate();
    showApp(); renderSync(E.Sync.status);
  }
  async function loadDemo() {
    S().load(E.Demo ? E.Demo.state() : M().emptyState()); App.mode = 'demo'; S().setRecorder(null); App.flags = [];
    await gate();
    showApp(); renderSync(E.Sync.status);
  }
  async function tryPreview() { // على استضافة http(s): اعرض Egary.xlsx المجاور (أو المضمَّن) للقراءة
    let buf = null;
    if (window.__EGARY_XLSX_B64) { try { buf = Uint8Array.from(atob(window.__EGARY_XLSX_B64), c => c.charCodeAt(0)).buffer; } catch (e) { buf = null; } }
    if (!buf && !/^https?:/.test(location.protocol)) return false;
    try {
      if (!buf) { const res = await fetch('Egary.xlsx', { cache: 'no-store' }); if (!res.ok) return false; buf = await res.arrayBuffer(); }
      const r = await W().read(buf, { snapshot: null }); lastBytes = buf;
      S().load(r.state); App.flags = r.flags; App.mode = 'preview'; S().setRecorder(null);
      await gate();
      showApp(); renderSync(E.Sync.status); return true;
    } catch (e) { return false; }
  }

  /* ---------- بوابة الدخول ---------- */
  async function gate() {
    const A = E.Auth;
    if (App.mode === 'demo') { A.demo('تجربة'); return true; }
    if (!A.supported) { A.demo('بلا تسجيل دخول'); UI().toast('المتصفح لا يدعم تشفير كلمات المرور هنا — فُتح البرنامج بلا تسجيل دخول', 'warn', 6000); return true; }
    if (!A.hasUsers() || (App.mode === 'linked' && !A.hasAdmin())) {
      if (App.mode === 'linked') { await setupScreen(A.hasUsers() ? 'recover' : ''); return true; } // لا مدير مفعَّل (ورقة المستخدمين عُدِّلت يدويًا) ⇒ استعادة
      A.demo('عرض'); return true; // ملف للعرض بلا حسابات بعد
    }
    if (A.restore()) return true;
    await loginScreen(); return true;
  }
  function loginShell(card) {
    const root = App.els.root; UI().clear(root); document.body.classList.add('no-app');
    const skyHost = h('div', { class: 'skyline-host' });
    const box = h('div', { id: 'login' }, h('div', { class: 'sky' }), h('div', { class: 'aurora' }), h('div', { class: 'layer stars' }), h('div', { class: 'moon' }), skyHost, h('div', { class: 'vignette' }), card);
    root.appendChild(box);
    let city = null; try { if (E.BI && E.BI.makeSkyline) city = E.BI.makeSkyline(skyHost); } catch (e) { }
    const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    box.addEventListener('mousemove', (e) => { if (reduced) return; const x = (e.clientX / window.innerWidth - .5) * 2, y = (e.clientY / window.innerHeight - .5) * 2; if (city && city.setTilt) city.setTilt(x, y); box.style.setProperty('--px', x.toFixed(3)); box.style.setProperty('--py', y.toFixed(3)); card.style.transform = `rotateY(${(x * 4).toFixed(2)}deg) rotateX(${(-y * 3).toFixed(2)}deg)`; });
    return box;
  }
  function loginScreen() {
    return new Promise(resolve => {
      const st = S().state();
      const err = h('div', { class: 'err', id: 'login-err', role: 'alert' });
      const user = h('input', { type: 'text', id: 'login-user', name: 'username', autocomplete: 'username', placeholder: 'اسم المستخدم', autocapitalize: 'off', spellcheck: false, dir: 'auto' });
      const pass = h('input', { type: 'password', id: 'login-pass', name: 'password', autocomplete: 'current-password', placeholder: '••••••••', dir: 'ltr' });
      const eye = h('button', { type: 'button', class: 'eye', title: 'إظهار/إخفاء كلمة المرور', onclick: () => { pass.type = pass.type === 'password' ? 'text' : 'password'; } }, UI().icon('eye'));
      const remember = h('input', { type: 'checkbox', id: 'login-remember' });
      const go = h('button', { type: 'submit', class: 'btn-go', id: 'login-go' }, UI().icon('key'), 'دخول');
      const kb = h('div', { class: 'kb-hint', id: 'kb-hint', role: 'status' });
      const kbCheck = (e) => { const ar = /[\u0600-\u06FF]/.test(user.value + pass.value); const caps = e && e.getModifierState && e.getModifierState('CapsLock'); kb.textContent = ar ? 'لوحة المفاتيح على العربية — بدّلها إلى English (Alt+Shift) ثم أعد الكتابة' : caps ? 'زر Caps Lock مفعَّل' : ''; kb.classList.toggle('on', !!kb.textContent); };
      user.addEventListener('input', kbCheck); pass.addEventListener('input', kbCheck); pass.addEventListener('keyup', kbCheck);
      const form = h('form', { class: 'lf', id: 'login-form', onsubmit: async (e) => { e.preventDefault(); err.classList.remove('on'); if (!user.value.trim() || !pass.value) { err.textContent = 'أدخل اسم المستخدم وكلمة المرور'; err.classList.add('on'); return; } go.disabled = true; let r; try { r = await E.Auth.login(user.value, pass.value, remember.checked); } catch (ex) { r = { ok: false, error: 'تعذّر التحقق من كلمة المرور (سجل المستخدم تالف؟) — اطلب من المدير إعادة تعيينها' }; } go.disabled = false; if (!r.ok) { err.textContent = r.error; err.classList.add('on'); pass.value = ''; pass.focus(); return; } resolve(r.user); } },
        h('div', null, h('label', { for: 'login-user' }, 'اسم المستخدم'), user),
        h('div', null, h('label', { for: 'login-pass' }, 'كلمة المرور'), h('div', { class: 'in' }, pass, eye), kb),
        h('div', { class: 'row' }, h('label', null, remember, 'تذكرني على هذا الجهاز (14 يومًا)'), h('span', { class: 'file-tag' }, UI().icon('excel'), E.Sync.status.name || '')),
        err, go);
      const hint = App.mode === 'preview' ? h('div', { class: 'hint' }, 'نسخة العرض — للتجربة: ', h('b', null, 'admin / admin@2026'), ' (مدير) أو ', h('b', null, 'office / office@2026'), ' (موظف)') : h('div', { class: 'hint' }, 'نسيت كلمة المرور؟ يعيد المدير تعيينها من الإعدادات ← المستخدمون.');
      const card = h('div', { class: 'login-card' }, h('div', { class: 'login-logo' }, UI().icon('building', 32)), h('h1', null, st.meta.officeName || 'إيجاري'), h('div', { class: 'sub' }, 'تسجيل الدخول إلى نظام إدارة الإيجارات'), form, hint,
        App.mode === 'linked' ? h('div', { class: 'foot-links' }, h('button', { type: 'button', id: 'login-other-file', onclick: async () => { E.Sync.unlink(); await E.FileLink.clearHandle(); location.reload(); } }, 'ربط ملف إكسيل آخر')) : null);
      loginShell(card); setTimeout(() => user.focus(), 60);
    });
  }
  function setupScreen(mode) {
    const recover = mode === 'recover';
    return new Promise(resolve => {
      let adminDone = false;
      const err = h('div', { class: 'err', id: 'setup-err', role: 'alert' });
      const f = (id, label, type, ph, auto) => { const i = h('input', { type: type || 'text', id, placeholder: ph || '', autocomplete: auto || 'off', dir: type === 'password' ? 'ltr' : /user/.test(id) ? 'auto' : null }); const eyeBtn = type === 'password' ? h('button', { type: 'button', class: 'eye', title: 'إظهار/إخفاء', onclick: () => { i.type = i.type === 'password' ? 'text' : 'password'; } }, UI().icon('eye')) : null; return [i, h('div', null, h('label', { for: id }, label), type === 'password' ? h('div', { class: 'in' }, i, eyeBtn) : i)]; };
      const [au, auEl] = f('su-admin-user', 'اسم مستخدم المدير', 'text', 'مثال: admin', 'username'), [an, anEl] = f('su-admin-name', 'اسم المدير (يظهر في سجل التعديلات)', 'text', 'مثال: أ. محمد'), [ap, apEl] = f('su-admin-pass', 'كلمة مرور المدير', 'password', '6 أحرف على الأقل', 'new-password'), [ap2, ap2El] = f('su-admin-pass2', 'تأكيد كلمة مرور المدير', 'password', '', 'new-password');
      const [su, suEl] = f('su-staff-user', 'اسم مستخدم الموظف', 'text', 'مثال: office'), [sn, snEl] = f('su-staff-name', 'اسم الموظف', 'text', 'مثال: موظف المكتب'), [sp, spEl] = f('su-staff-pass', 'كلمة مرور الموظف', 'password', '6 أحرف على الأقل', 'new-password'), [sp2, sp2El] = f('su-staff-pass2', 'تأكيد كلمة مرور الموظف', 'password', '', 'new-password');
      const go = h('button', { type: 'submit', class: 'btn-go', id: 'setup-go' }, UI().icon('check'), 'إنشاء الحسابات والدخول');
      const form = h('form', { class: 'lf two', id: 'setup-form', onsubmit: async (e) => {
        e.preventDefault(); err.classList.remove('on'); const errs = [];
        // التحقق من الكتلتين معًا قبل إنشاء أي حساب حتى لا نقف في منتصف الطريق
        if (!adminDone) { const e1 = E.Auth.validateUsername(au.value); if (e1) errs.push('المدير: ' + e1); const e2 = E.Auth.validatePassword(ap.value); if (e2) errs.push('المدير: ' + e2); if (ap.value !== ap2.value) errs.push('تأكيد كلمة مرور المدير غير مطابق'); }
        if (!recover) { const e3 = E.Auth.validateUsername(su.value); if (e3) errs.push('الموظف: ' + e3); const e4 = E.Auth.validatePassword(sp.value); if (e4) errs.push('الموظف: ' + e4); if (sp.value !== sp2.value) errs.push('تأكيد كلمة مرور الموظف غير مطابق'); if (E.Auth.normUser(au.value) && E.Auth.normUser(au.value) === E.Auth.normUser(su.value)) errs.push('اسما المستخدمين متطابقان'); }
        if (errs.length) { err.textContent = errs.join(' · '); err.classList.add('on'); return; }
        go.disabled = true;
        if (!adminDone) {
          const r1 = await E.Auth.createUser({ code: au.value, name: an.value || au.value, role: 'admin' }, ap.value);
          if (r1.errors) { go.disabled = false; err.textContent = 'المدير: ' + r1.errors.join(' · '); err.classList.add('on'); return; }
          adminDone = true; [au, an, ap, ap2].forEach(i => { i.disabled = true; });
        }
        if (!recover) {
          const r2 = await E.Auth.createUser({ code: su.value, name: sn.value || su.value, role: 'staff' }, sp.value);
          if (r2.errors) { go.disabled = false; err.textContent = 'الموظف: ' + r2.errors.join(' · ') + ' — حساب المدير أُنشئ؛ صحّح بيانات الموظف واضغط مرة أخرى.'; err.classList.add('on'); return; }
        }
        const r = await E.Auth.login(au.value, ap.value, false); go.disabled = false;
        if (r.ok) resolve(r.user); else { err.textContent = r.error; err.classList.add('on'); }
      } },
        recover
          ? h('div', { class: 'full role-note' }, h('b', null, 'استعادة الدخول:'), ' لا يوجد حساب مدير مفعَّل في ورقة «المستخدمون» (عُدِّلت يدويًا على الأرجح). أنشئ حساب مدير جديدًا وستبقى الحسابات الأخرى كما هي، ويمكنك إصلاحها من الإعدادات بعد الدخول.')
          : h('div', { class: 'full role-note' }, h('b', null, 'أول تشغيل:'), ' أنشئ حسابين على الأقل — ', h('b', null, 'مدير'), ' (كل الصلاحيات: الإعدادات والمستخدمون والحذف) و', h('b', null, 'موظف'), ' (الإدخال والتعديل، بلا إعدادات ولا حذف للمشاريع والوحدات والعملاء والعقود). تُحفظ الحسابات داخل Egary.xlsx وكلمات المرور مشفّرة.'),
        auEl, anEl, apEl, ap2El,
        recover ? null : h('div', { class: 'full', style: { height: '1px', background: 'rgba(255,255,255,.08)', margin: '2px 0' } }),
        recover ? null : suEl, recover ? null : snEl, recover ? null : spEl, recover ? null : sp2El,
        h('div', { class: 'full' }, err), h('div', { class: 'full' }, go));
      const card = h('div', { class: 'login-card wide' }, h('div', { class: 'login-logo' }, UI().icon('shield', 32)), h('h1', null, recover ? 'استعادة حساب المدير' : 'إنشاء حسابات الدخول'), h('div', { class: 'sub' }, (S().state().meta.officeName || 'إيجاري') + ' — ' + (E.Sync.status.name || 'Egary.xlsx')), form);
      loginShell(card); setTimeout(() => au.focus(), 60);
    });
  }
  const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('');
  function userChip() {
    const u = E.Auth.user() || { name: '—', role: '' };
    return h('button', { class: 'user-chip', id: 'user-chip', title: 'الحساب', onclick: userMenu }, h('span', { class: 'av' }, initials(u.name)), h('span', { class: 'nm' }, h('b', null, u.name), h('span', null, E.Auth.ROLE_AR(u.role) || '')));
  }
  function userMenu() {
    const u = E.Auth.user(); if (!u) return;
    const m = UI().modal({ title: 'الحساب', size: 'sm', body: h('div', { class: 'user-menu' },
      h('div', { class: 'who' }, h('div', { class: 'av' }, initials(u.name)), h('div', null, h('b', null, u.name), h('div', { class: 'small muted' }, E.Auth.ROLE_AR(u.role) + (u.source !== 'demo' ? ' · ' + u.username : ' · وضع تجريبي')))),
      u.source !== 'demo' ? h('button', { class: 'item', id: 'btn-change-pass', onclick: async () => { m.close(); await F().changePassword(u.username, true); } }, UI().icon('key'), 'تغيير كلمة المرور') : null,
      E.Auth.can('users') && u.source !== 'demo' ? h('button', { class: 'item', onclick: () => { m.close(); go('settings'); } }, UI().icon('users'), 'إدارة المستخدمين') : null,
      u.source !== 'demo' ? h('button', { class: 'item danger', id: 'btn-logout', onclick: () => { m.close(); logout(); } }, UI().icon('x'), 'تسجيل الخروج') : h('p', { class: 'small muted' }, 'في وضع التجربة لا يوجد تسجيل دخول.'),
    ) });
  }
  async function logout() {
    try { if (E.Sync && E.Sync.status.pending) await E.Sync.flush(); } catch (e) { }
    E.Auth.logout(); location.reload();
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
        fileInput,
      ),
      h('div', { class: 'flex wrap mt-s small', style: { justifyContent: 'center' } }, h('span', { class: 'muted' }, 'خيارات أخرى:'), h('button', { class: 'btn ghost sm', id: 'btn-open', onclick: () => fileInput.click() }, UI().icon('upload'), 'فتح ملف للعرض فقط'), h('button', { class: 'btn ghost sm', id: 'btn-demo', onclick: loadDemo }, UI().icon('eye'), 'تجربة ببيانات نموذجية')),
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
    search.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const on = sugg.querySelector('.item.on:not(.muted)') || sugg.querySelector('.item:not(.muted)'); if (on && !sugg.classList.contains('hidden')) { on.click(); } else { App.filter.q = search.value.trim(); saveFilter(); go(App.route.view === 'dashboard' || App.route.view === 'bi' ? 'units' : App.route.view); } sugg.classList.add('hidden'); } if (e.key === 'Escape') sugg.classList.add('hidden'); if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { const items = [...sugg.querySelectorAll('.item')]; if (!items.length) return; e.preventDefault(); let i = items.findIndex(x => x.classList.contains('on')); items.forEach(x => x.classList.remove('on')); i = e.key === 'ArrowDown' ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1); items[i].classList.add('on'); } });
    search.addEventListener('focus', () => { if (search.value) suggest(search.value); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.search')) sugg.classList.add('hidden'); });
    const syncEl = h('button', { class: 'sync unlinked', id: 'sync-status', onclick: () => go('settings') }, h('span', { class: 'dot' }), h('span', null, '…'));
    App.els.sync = syncEl;
    const themeBtn = h('button', { class: 'btn icon', title: 'الوضع الداكن/الفاتح', id: 'theme-btn', onclick: toggleTheme }, UI().icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon'));
    const title = h('div', { class: 'title', id: 'page-title' });
    const chipHost = h('span', { id: 'user-chip-host' }, userChip());
    const topbar = h('header', { class: 'topbar' }, h('button', { class: 'btn icon ghost menu-btn', onclick: () => sidebar.classList.toggle('open') }, UI().icon('menu')), title, h('div', { class: 'search' }, UI().icon('search'), search, sugg), syncEl, themeBtn, chipHost);
    if (!App._authSub) { App._authSub = E.Auth.subscribe(() => { const host = document.getElementById('user-chip-host'); if (host) { UI().clear(host); host.appendChild(userChip()); } }); }
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
    if (E.BI && E.BI.isOpen) E.BI.close(true);
    const v = VIEWS.find(x => x.key === App.route.view) || VIEWS[0];
    App.els.title.textContent = v.title; document.title = v.title + ' — إيجاري';
    renderNav();
    const c = App.els.content; UI().clear(c);
    if (App.els.search && App.els.search.value !== App.filter.q) App.els.search.value = App.filter.q;
    try { E.Views.render(v.key, c, ctx()); } catch (e) { console.error(e); c.appendChild(h('div', { class: 'banner danger' }, 'خطأ في عرض الشاشة: ' + e.message)); }
  }
  function ctx() { return { auth: E.Auth, filter: App.filter, year: App.year, params: App.route.params, open, evidence, go, rerender: render, filterBar, setYear: (y) => { App.year = String(y); render(); }, mode: App.mode, flags: App.flags, readOnly: App.mode !== 'linked' && App.mode !== 'file' && App.mode !== 'demo' }; }

  /* ---------- إضافة سنة (ورقة جديدة في الإكسيل بنفس الشكل) ---------- */
  function addYear() {
    const st = S().state(); const years = st.settings.ledgerYears || [];
    const inp = h('input', { type: 'number', id: 'f_year', min: 2000, max: 2100, value: (years.length ? years[0] - 1 : new Date().getFullYear()), style: { width: '100%', height: '40px', border: '1px solid var(--line)', borderRadius: '10px', padding: '0 12px', background: 'var(--surface)' } });
    const err = h('div', { class: 'form-errors', style: { display: 'none' } });
    const m = UI().modal({ title: 'إضافة سنة إلى الورقة', size: 'sm', body: h('div', null, h('p', { class: 'muted' }, 'تُنشأ ورقة جديدة في الإكسيل بنفس شكل ورقة السنة (كل عقد ساري في تلك السنة في صف)، وتبدأ المحاسبة من أول سنة موجودة. سجّلوا فيها كل المدفوعات وإلا ظهرت شهورها متأخرات.'), h('label', { class: 'small', for: 'f_year', style: { display: 'block', margin: '12px 0 6px' } }, 'السنة'), inp, err), footer: [h('button', { class: 'btn', onclick: () => m.close() }, 'إلغاء'), h('button', { class: 'btn primary', id: 'btn-add-year', onclick: () => {
      const y = parseInt(inp.value, 10);
      if (!(y >= 2000 && y <= 2100)) { err.textContent = 'أدخل سنة بين 2000 و2100'; err.style.display = 'block'; return; }
      if (years.includes(y)) { err.textContent = 'هذه السنة موجودة بالفعل'; err.style.display = 'block'; return; }
      const next = Array.from(new Set(years.concat([y]))).sort();
      const rec = { ledgerYears: next };
      const canSettings = !E.Auth || E.Auth.can('settings');
      if (canSettings && y < (parseInt(String(st.settings.trackingFrom || '9999').slice(0, 4), 10) || 9999)) { rec.trackingFrom = String(y) + '-01'; rec.trackingMode = 'auto'; } // لا تتحرك البداية إلا لو السنة المضافة أقدم منها
      if (y < years[0] - 1) { for (let yy = y + 1; yy < years[0]; yy++) if (!next.includes(yy)) next.push(yy); next.sort(); rec.ledgerYears = next; } // لا فجوات: السنوات الوسيطة تُضاف أيضًا
      S().applyOp({ type: 'settings', record: rec }); S().notify('change');
      if (E.Sync && App.mode === 'linked') E.Sync.record({ type: 'settings', at: new Date().toISOString(), record: rec }); // في وضع العرض لا نكتب في دفتر المزامنة
      try { S().log({ action: 'إضافة', entity: 'سنة', code: String(y), summary: 'ورقة سنة جديدة ' + y }); } catch (e) { }
      App.year = String(y); m.close(); render(); UI().toast(`أُضيفت سنة ${y} — ستظهر ورقتها في الإكسيل مع أول حفظ` + (!canSettings && U().cmp(String(y) + '-01', st.settings.trackingFrom || '9999-99') < 0 ? ' (بداية المحاسبة لا تتغيّر إلا من المدير في الإعدادات)' : ''), 'ok', 5000);
    } }, 'إضافة')] });
  }

  /* ---------- الفلاتر ---------- */
  function saveFilter() { try { const { period, ...rest } = App.filter; localStorage.setItem(FILTER_KEY, JSON.stringify(rest)); } catch (e) { } }
  function setFilter(patch) { Object.assign(App.filter, patch); saveFilter(); render(); }
  function filterBar(opts) {
    opts = opts || {};
    const st = S().state(), f = App.filter;
    const chip = (label, on, onClick, cls) => h('button', { class: 'chip ' + (on ? 'on' : '') + ' ' + (cls || ''), onclick: onClick }, label, on ? h('span', { class: 'x' }, '×') : null);
    const bar = h('div', { class: 'flex wrap row-gap', id: 'filter-bar' });
    bar.appendChild(h('span', { class: 'muted small flex' }, UI().icon('filter'), 'الفلاتر:'));
    if (opts.period) { // متصفح الشهر: ◀ الشهر ▶ — يغيّر شهر التقرير في اللوحة والتحليلات ولوحة BI
      const cur = U().periodOf(U().today()); const from = st.settings.trackingFrom && U().cmp(st.settings.trackingFrom, cur) <= 0 ? st.settings.trackingFrom : cur.slice(0, 4) + '-01';
      const sel = f.period || opts.defaultPeriod || cur; const months = [...U().periods(from, cur)].reverse();
      const setP = (p) => setFilter({ period: p && p !== (opts.defaultPeriod || cur) ? p : '' });
      bar.appendChild(h('span', { class: 'period-nav fgroup', id: 'period-nav' }, h('span', { class: 'lbl' }, 'شهر التقرير'),
        h('button', { class: 'chip icon', id: 'period-prev', title: 'الشهر السابق', disabled: U().cmp(sel, from) <= 0 ? true : null, onclick: () => setP(U().addMonths(sel, -1)) }, UI().icon('chevR')),
        h('select', { class: 'chip', id: 'period-pick', title: 'شهر التقرير', onchange: (e) => setP(e.target.value) }, months.map(p => h('option', { value: p, selected: p === sel ? true : null }, U().periodLabel(p, true) + (p === cur ? ' — الشهر الحالي' : p === opts.defaultPeriod && opts.defaultPeriod !== cur ? ' — آخر شهر مسجَّل' : '')))),
        h('button', { class: 'chip icon', id: 'period-next', title: 'الشهر التالي', disabled: U().cmp(sel, cur) >= 0 ? true : null, onclick: () => setP(U().addMonths(sel, 1)) }, UI().icon('chevL')),
        f.period ? h('button', { class: 'chip', id: 'period-reset', title: 'العودة إلى الشهر الافتراضي', onclick: () => setFilter({ period: '' }) }, '↩ ' + (opts.defaultPeriod && opts.defaultPeriod !== cur ? 'آخر شهر مسجَّل' : 'الشهر الحالي')) : null));
    }
    const gP = h('span', { class: 'fgroup' }, h('span', { class: 'lbl' }, 'المشروع')); for (const p of st.projects) gP.appendChild(chip(p.name, f.projectCode === p.code, () => setFilter({ projectCode: f.projectCode === p.code ? '' : p.code }), 'f-project')); bar.appendChild(gP);
    const gT = h('span', { class: 'fgroup' }, h('span', { class: 'lbl' }, 'النوع')); for (const t of M().UNIT_TYPES) gT.appendChild(chip(t.ar, f.unitType === t.key, () => setFilter({ unitType: f.unitType === t.key ? '' : t.key }), 'f-type')); bar.appendChild(gT);
    if (opts.status !== false) { const gS = h('span', { class: 'fgroup' }, h('span', { class: 'lbl' }, 'الحالة')); for (const k of ['occupied', 'vacant', 'ending']) gS.appendChild(chip(En().USTATUS_AR[k], f.status === k, () => setFilter({ status: f.status === k ? '' : k }), 'f-status')); bar.appendChild(gS); }
    if (opts.year) { const years = st.settings.ledgerYears.length ? st.settings.ledgerYears : [new Date().getFullYear()]; const sel = h('select', { class: 'chip', id: 'year-select', onchange: (e) => { if (e.target.value === '__add') { e.target.value = String(App.year); addYear(); return; } App.year = e.target.value; render(); } }, years.map(y => h('option', { value: y, selected: String(y) === String(App.year) ? true : null }, 'سنة ' + y)), (!E.Auth || E.Auth.can('edit')) && App.mode === 'linked' ? h('option', { value: '__add' }, '＋ إضافة سنة…') : null); bar.appendChild(sel); }
    if (f.q) bar.appendChild(chip('بحث: ' + f.q, true, () => setFilter({ q: '' }), 'f-q'));
    if (f.projectCode || f.unitType || f.status || f.q || f.floor) bar.appendChild(h('button', { class: 'btn sm ghost', id: 'clear-filters', onclick: () => setFilter({ projectCode: '', unitType: '', status: '', floor: '', q: '', period: '' }) }, 'مسح الكل'));
    return bar;
  }

  /* ---------- البحث مع الاقتراحات ---------- */
  function suggest(q) {
    const box = App.els.suggest; if (!box) return;
    const n = U().normalize(q); UI().clear(box);
    if (!n) { box.classList.add('hidden'); return; }
    const st = S().state(), out = [];
    const tokens = n.split(' ').filter(Boolean);
    const m = (hay) => { const H = U().normalize(hay); const Hs = H.replace(/\s+/g, ''); return tokens.every(t => H.includes(t) || Hs.includes(t.replace(/\s+/g, ''))) || Hs.includes(n.replace(/\s+/g, '')); };
    for (const p of st.projects) if (m(p.code + ' ' + p.name + ' ' + p.address)) out.push({ k: 'مشروع', code: p.code, label: p.name, sub: p.address, open: () => open('project', p.code) });
    for (const u of st.units) if (m(u.code + ' ' + u.label + ' ' + ((S().project(u.projectCode) || {}).name || ''))) out.push({ k: 'وحدة', code: u.code, label: u.label, sub: (S().project(u.projectCode) || {}).name, open: () => open('unit', u.code) });
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
    applyTheme((() => { try { return localStorage.getItem(THEME_KEY) || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch (e) { return 'light'; } })());
    try { const f = JSON.parse(localStorage.getItem(FILTER_KEY) || 'null'); if (f) { delete f.period; Object.assign(App.filter, f); } } catch (e) { }
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
  async function linkAdapter(adapter) { App.mode = 'linked'; S().setRecorder(op => E.Sync.record(op)); await E.Sync.link(adapter, { writeOnLink: false }); await gate(); showApp(); return true; }

  Object.assign(App, { boot, go, open, evidence, render, setFilter, filterBar, linkFile, linkAdapter, logout, gate, downloadCopy, downloadBackup, downloadOriginal, enableBackups, backupNow, loadDemo, openWithoutLink, ctx, VIEWS, saveSnapshot, loadSnapshot, toggleTheme });
  E.App = App;
  document.addEventListener('DOMContentLoaded', () => { if (!window.__EGARY_NO_BOOT) boot(); });
})(window.Egary);
