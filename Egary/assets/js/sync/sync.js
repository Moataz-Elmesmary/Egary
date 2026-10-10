/* =====================================================================
   sync.js — محرّك المزامنة ثنائي الاتجاه بين الحالة في الذاكرة وملف الإكسيل
   القواعد:
     1. الإكسيل هو مصدر الحقيقة: أي تغيير في ملفه (lastModified) يُقرأ ويُطبَّق.
     2. كل تعديل في الموقع = عملية (op) تُسجَّل في «دفتر العمليات» ثم يُكتب
        الملف كله من الحالة الحالية. لو الكتابة فشلت (الملف مفتوح في Excel)
        تبقى العمليات معلّقة وتُعاد المحاولة تلقائيًا.
     3. لو وصل تعديل خارجي وفي عمليات معلّقة: نقرأ الملف الجديد ثم نعيد تطبيق
        العمليات المعلّقة عليه (كلها upsert/delete بالكود ⇒ آمنة للإعادة) ثم نكتب.
     4. لا نكتب فوق تعديل خارجي لم نقرأه: لو تغيّر الملف أثناء التسلسل نقرأه ونعيد
        التسلسل، ولو تعذّرت قراءته لا نكتب حتى تنجح (أو يطلب المستخدم forceWrite).
   الدفتر في localStorage:
     • لكل تبويب مفتاحه: الأول يستعمل المفتاح الأساسي egary-pending-ops-v1 (مصفوفة عمليات كما كانت)
       والبقية egary-pending-ops-v1:<tab>؛ ولكل مفتاح بيانات وصفية «:meta» {tab, touched, file, mtime}
       تُحدَّث كنبض كل 5 ثوانٍ. دفتر تبويب انقطع نبضه (أُغلق أو انهار) يتبنّاه تبويب آخر ويُطبَّق ويُكتب.
     • الدفتر مربوط باسم الملف: عمليات ملف A لا تُطبَّق على ملف B بل تُحفظ جانبًا (…:stash)
       حتى يُربط A من جديد، ويُبلَّغ عنها في status.note.
   الواجهة:
     Sync.init({ serialize, deserialize, applyOps, onStatus, pollMs })
     Sync.link(adapter)  Sync.unlink()  Sync.record(op)  Sync.flush()  Sync.forceWrite()  Sync.stashed()
     Sync.status → { state: 'unlinked'|'linked'|'saving'|'locked'|'error'|'reading', pending, name, lastSync, error, note }
   ===================================================================== */
window.Egary = window.Egary || {};
(function (E) {
  'use strict';

  const JOURNAL_KEY = 'egary-pending-ops-v1', TAB_KEY = 'egary-tab-id';
  const TABS_KEY = JOURNAL_KEY + ':tabs', STASH_KEY = JOURNAL_KEY + ':stash';
  let cfg = null, adapter = null, timer = null, lastSeen = 0, writing = false, serializing = false, flushAgain = false, forceOnce = false, readError = '';
  let pending = [], journalFile = '';          // العمليات المعلّقة + اسم الملف الذي سُجِّلت عليه ('' = غير معروف ⇒ أي ملف)
  let LS = null, SS = null, tabId = '', ownKey = JOURNAL_KEY, heartbeat = null, listening = false, stashNote = '';
  const status = { state: 'unlinked', pending: 0, name: '', lastSync: null, error: null, lastExternal: null, note: '' };

  function emit(patch) {
    Object.assign(status, patch || {}, { pending: pending.length, note: stashNote });
    if (cfg && cfg.onStatus) { try { cfg.onStatus({ ...status }); } catch (e) { /* ignore */ } }
  }

  /* ---------- التخزين (آمن لو localStorage غير متاح) ---------- */
  function storage(name) { try { return globalThis[name] || null; } catch (e) { return null; } }
  function readJ(k) { try { const v = LS ? LS.getItem(k) : null; return v == null ? null : JSON.parse(v); } catch (e) { return null; } }
  function writeJ(k, v) { try { if (!LS) return; if (v == null) LS.removeItem(k); else LS.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  const arr = v => (Array.isArray(v) ? v : []);
  const keyOf = t => JOURNAL_KEY + ':' + t;
  const metaOf = k => k + ':meta';
  const staleMs = () => (cfg && cfg.staleMs) || 30000;
  const isStale = (m, now) => !m || !m.touched || (now || Date.now()) - m.touched > staleMs();   // touched = 0 ⇒ التبويب أعلن إغلاقه
  const meta = (now, touched) => ({ tab: tabId, touched: touched == null ? now : touched, file: journalFile, mtime: lastSeen });

  function tabIdOf() {
    let id = null; try { id = SS && SS.getItem(TAB_KEY); } catch (e) { }
    if (!id) { id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); try { if (SS) SS.setItem(TAB_KEY, id); } catch (e) { } }
    return id;
  }
  function registerTab(on) { const t = arr(readJ(TABS_KEY)).filter(x => x !== tabId); if (on) t.push(tabId); writeJ(TABS_KEY, t.length ? t : null); }
  /* لو تبويب آخر حيّ يملك المفتاح الأساسي (أخذه حين كان نبضنا قديمًا) نتحوّل إلى مفتاحنا الخاص */
  function ensureOwnKey(now) {
    if (ownKey !== JOURNAL_KEY) return;
    const m = readJ(metaOf(JOURNAL_KEY));
    if (m && m.tab && m.tab !== tabId && !isStale(m, now)) { ownKey = keyOf(tabId); registerTab(true); writeJ(ownKey, pending); }
  }
  function touch(now) { now = now || Date.now(); ensureOwnKey(now); writeJ(metaOf(ownKey), meta(now)); }
  function saveJournal(now) { now = now || Date.now(); ensureOwnKey(now); writeJ(ownKey, pending); writeJ(metaOf(ownKey), meta(now)); }
  const byAt = (a, b) => ((a.at || '') < (b.at || '') ? -1 : (a.at || '') > (b.at || '') ? 1 : 0);
  function merge(ops) { pending = pending.concat(ops); if (pending.every(o => o && o.at)) pending.sort(byAt); }

  /* ---------- عمليات ملف آخر تُحفظ جانبًا حتى يُربط من جديد ---------- */
  const countAr = n => (n === 1 ? 'يوجد تعديل واحد معلّق يخص' : n === 2 ? 'يوجد تعديلان معلّقان يخصان' : n <= 10 ? 'توجد ' + n + ' تعديلات معلّقة تخص' : 'يوجد ' + n + ' تعديلًا معلّقًا يخص');
  function readStash() { const s = readJ(STASH_KEY); return s && typeof s === 'object' && !Array.isArray(s) ? s : {}; }
  function writeStash(s) { writeJ(STASH_KEY, Object.keys(s).length ? s : null); refreshNote(s); }
  function refreshNote(s) { s = s || readStash(); stashNote = Object.keys(s).map(f => countAr(arr(s[f].ops).length) + ' الملف ' + f).join('؛ '); }
  function stash(file, ops, mtime) {
    if (!ops.length) return;
    const s = readStash(), cur = s[file] || { at: 0, mtime: 0, ops: [] };
    cur.ops = arr(cur.ops).concat(ops); cur.at = Date.now(); cur.mtime = mtime || cur.mtime || 0; s[file] = cur;
    writeStash(s);
  }
  function unstash(file) { const s = readStash(), cur = s[file]; if (!cur) return null; delete s[file]; writeStash(s); return arr(cur.ops); }

  /* ---------- تبنّي دفاتر التبويبات المغلقة ---------- */
  /* دمج عمليات تبويب آخر: نفس الملف (أو ملف غير معروف) ⇒ تُطبَّق وتُكتب؛ ملف آخر ⇒ تُحفظ جانبًا */
  function absorb(ops, file, mtime) {
    ops = arr(ops).filter(Boolean); if (!ops.length) return;
    const target = adapter ? adapter.name : journalFile;
    if (file && target && file !== target) { stash(file, ops, mtime); emit({}); return; }
    merge(ops); if (!journalFile) journalFile = file || '';
    saveJournal();
    if (adapter) { try { cfg.applyOps(ops.slice()); } catch (e) { /* تُعاد مع القراءة التالية على أي حال */ } scheduleFlush(); }
    emit({});
  }
  /* التبويبات المعروفة: السجل «:tabs» + مسح مفاتيح localStorage (حين يتيح key()) تحسّبًا لتسجيل ضاع في سباق بدء تبويبين معًا */
  function knownTabs() {
    const set = new Set(arr(readJ(TABS_KEY)));
    try {
      if (LS && typeof LS.key === 'function' && typeof LS.length === 'number') {
        const pre = JOURNAL_KEY + ':';
        for (let i = 0; i < LS.length; i++) { const k = LS.key(i) || ''; if (k.startsWith(pre) && k !== TABS_KEY && k !== STASH_KEY && !k.endsWith(':meta')) set.add(k.slice(pre.length)); }
      }
    } catch (e) { /* ignore */ }
    return [...set];
  }
  function adoptOrphans(now) {
    now = now || Date.now();
    if (ownKey !== JOURNAL_KEY) {       // المفتاح الأساسي صار حرًّا؟ خذ ما فيه وانتقل إليه
      const m = readJ(metaOf(JOURNAL_KEY));
      if (isStale(m, now) || m.tab === tabId) {
        const ops = arr(readJ(JOURNAL_KEY));
        writeJ(keyOf(tabId), null); writeJ(metaOf(keyOf(tabId)), null); registerTab(false);
        ownKey = JOURNAL_KEY; saveJournal(now);
        absorb(ops, m && m.file, m && m.mtime);
      }
    }
    for (const t of knownTabs()) {
      const k = keyOf(t); if (k === ownKey) continue;
      const m = readJ(metaOf(k));
      if (t !== tabId && !isStale(m, now)) continue;        // مفتاحنا القديم (قبل إعادة التحميل) يُؤخذ دائمًا
      const ops = arr(readJ(k));
      writeJ(k, null); writeJ(metaOf(k), null);
      const list = arr(readJ(TABS_KEY)).filter(x => x !== t); writeJ(TABS_KEY, list.length ? list : null);
      absorb(ops, m && m.file, m && m.mtime);
    }
  }

  function init(options) {
    cfg = options || {};
    LS = storage('localStorage'); SS = storage('sessionStorage');
    tabId = tabIdOf();
    const now = Date.now();
    const base = readJ(metaOf(JOURNAL_KEY));
    ownKey = (isStale(base, now) || base.tab === tabId) ? JOURNAL_KEY : keyOf(tabId);   // المفتاح الأساسي لأول تبويب (أو لمن ورثه بعد إغلاق صاحبه)
    const m = readJ(metaOf(ownKey));
    pending = arr(readJ(ownKey)).filter(Boolean);
    journalFile = (m && m.file) || '';
    if (ownKey !== JOURNAL_KEY) registerTab(true);
    saveJournal(now);
    refreshNote();
    adoptOrphans(now);
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = setInterval(() => { try { touch(); adoptOrphans(); } catch (e) { /* ignore */ } }, cfg.heartbeatMs || 5000);
    if (heartbeat && typeof heartbeat.unref === 'function') heartbeat.unref();   // في Node لا يُبقي العملية حيّة
    if (!listening && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      listening = true;
      window.addEventListener('pagehide', () => { try { writeJ(metaOf(ownKey), meta(Date.now(), 0)); } catch (e) { } });   // أعلن الإغلاق ليتبنّى غيرك الدفتر فورًا
      window.addEventListener('pageshow', ev => { if (ev && ev.persisted) { try { saveJournal(); } catch (e) { } } });     // عاد من ذاكرة الرجوع
      window.addEventListener('storage', ev => {
        if (!ev) return;
        if (ev.key === ownKey && ev.newValue === null && pending.length) { pending = []; emit({}); }   // تبويب آخر تبنّى دفترنا
        else if (ev.key === metaOf(ownKey) && ev.newValue) {                                            // تبويب آخر ورث مفتاحنا (كان نبضنا قديمًا) ومعه عملياتنا
          let nm = null; try { nm = JSON.parse(ev.newValue); } catch (e) { }
          if (nm && nm.tab && nm.tab !== tabId) { pending = []; ensureOwnKey(); emit({}); }
        }
      });
    }
    emit({});
    return status;
  }

  async function link(a, opts) {
    clearRetry();   // link يقرّر بنفسه إن كانت كتابة لازمة
    adapter = a;
    opts = opts || {};
    // عمليات مسجَّلة على ملف آخر لا تُطبَّق هنا: تُحفظ جانبًا حتى يُربط ذلك الملف من جديد
    if (pending.length && journalFile && journalFile !== a.name) { stash(journalFile, pending, lastSeen); pending = []; }
    journalFile = a.name;
    const kept = unstash(a.name); if (kept && kept.length) merge(kept);
    saveJournal();
    emit({ state: 'reading', name: a.name, error: null });
    try {
      const buf = await a.read();
      lastSeen = await a.lastModified();
      if (buf && buf.byteLength) await cfg.deserialize(buf);
      if (pending.length) {
        // عمليات معلّقة من جلسة سابقة (أو تبويب مغلق): طبّقها على الملف الحالي ثم اكتب
        cfg.applyOps(pending.slice());
      }
      emit({ state: 'linked', lastSync: Date.now() });
      if (pending.length || opts.writeOnLink) await flush();
      startPolling();
      return true;
    } catch (e) {
      emit({ state: 'error', error: errorText(e) });
      throw e;
    }
  }
  function unlink() {
    stopPolling();
    adapter = null;
    emit({ state: 'unlinked', name: '' });
  }

  /* تسجيل عملية + كتابة. الكتابة تُجمَّع (debounce قصير) لتجنّب كتابات متتالية.
     مؤقّتان: flushTimer للتجميع بعد record، وretryTimer لإعادة المحاولة بعد فشل (قفل/خطأ) — أي كتابة تبدأ تُلغي إعادة المحاولة المعلّقة */
  let flushTimer = null, retryTimer = null;
  function clearRetry() { clearTimeout(retryTimer); retryTimer = null; }
  function scheduleFlush(ms) {
    if (!adapter) return Promise.resolve(false);
    clearTimeout(flushTimer); clearRetry();
    return new Promise(resolve => { flushTimer = setTimeout(() => { flushTimer = null; flush().then(resolve, () => resolve(false)); }, ms != null ? ms : (cfg.debounceMs == null ? 150 : cfg.debounceMs)); });
  }
  function record(op) {
    if (op) { pending.push(op); if (adapter && !journalFile) journalFile = adapter.name; saveJournal(); }
    emit({});
    return scheduleFlush();
  }

  /* نص واحد لحالة «تغيّر الملف وتعذّرت قراءته» يستعمله الاستطلاع والكتابة معًا حتى لا يتذبذب الشريط بين رسالتين كل بضع ثوانٍ */
  function unreadText() {
    return 'تغيّر ملف الإكسيل خارجيًا وتعذّرت قراءته' + (readError ? ' (' + readError + ')' : ' (ربما لم يكتمل حفظه بعد)')
      + (pending.length ? ' — تعديلاتك (' + pending.length + ') محفوظة مؤقتًا ولن تُستبدل نسخته حتى تُقرأ' : '') + '، وستُعاد المحاولة تلقائيًا';
  }
  /* قراءة الملف لو تغيّر خارجيًا (مع إعادة تطبيق المعلّق فوقه). لو تعذّرت قراءته لا نكتب فوقه — الإكسيل مصدر الحقيقة — إلا بطلب صريح (forceWrite) */
  async function readIfChanged(a) {
    if (pollPromise) await pollPromise;
    let m = await a.lastModified();
    if (m === lastSeen) return;
    await pollNow();
    m = await a.lastModified();
    if (m === lastSeen) return;
    if (forceOnce) { lastSeen = m; return; }   // «استبدال الملف بنسخة الموقع»
    const err = new Error(unreadText());
    err.name = 'UnreadExternalChange'; err.retryMs = cfg.retryMs || 3000;
    throw err;
  }

  async function flush() {
    if (!adapter) return false;
    if (writing) { if (serializing) flushAgain = true; return false; }   // طلب يصل قبل بدء التسلسل تغطّيه الكتابة الجارية نفسها
    writing = true; serializing = false; clearRetry();
    const a = adapter, wasLocked = status.state === 'locked';
    emit({ state: 'saving', error: null });
    try {
      // 1) بعد قفل: جسّ القفل أولًا (رخيص) بدل تسلسل المصنّف كاملًا ثم اكتشاف أن Excel ما زال فاتحه
      if (wasLocked && typeof a.probe === 'function') await a.probe();
      // 2) لو تغيّر الملف منذ آخر قراءة (حفظ من Excel أو جهاز آخر) نقرأه أولًا ثم نكتب فوقه بالعمليات المعلّقة
      await readIfChanged(a);
      // 3) التسلسل (0.3–0.6 ثانية) ثم التأكد أن الملف لم يتغيّر أثناءه — وإلا نقرأ ونعيد التسلسل (بحد أقصى)
      let buf, written;
      for (let attempt = 0; ; attempt++) {
        written = new Set(pending); serializing = true;   // ما يُسجَّل أثناء التسلسل/الكتابة ليس في الملف ⇒ يبقى معلّقًا للجولة التالية
        emit({ state: 'saving' });
        buf = await cfg.serialize();
        if (adapter !== a) { writing = false; serializing = false; return false; }   // فُكّ الربط أو رُبط ملف آخر أثناء التسلسل
        if ((await a.lastModified()) === lastSeen) break;
        if (attempt >= 2) { const e = new Error('الملف يتغيّر باستمرار أثناء الحفظ — ستُعاد المحاولة تلقائيًا'); e.retryMs = cfg.retryMs || 3000; throw e; }
        await readIfChanged(a);
      }
      await a.write(buf);
      lastSeen = await a.lastModified();
      forceOnce = false;
      if (adapter === a) { pending = pending.filter(op => !written.has(op)); saveJournal(); }
      emit({ state: 'linked', lastSync: Date.now(), error: null });
      if (cfg.onWritten) { try { cfg.onWritten(buf); } catch (e) { /* النسخ الاحتياطي لا يعطّل الحفظ */ } }
      writing = false; serializing = false;
      if (flushAgain || pending.length) { flushAgain = false; return flush(); }
      return true;
    } catch (e) {
      writing = false; serializing = false;
      const locked = isLockError(e);
      emit({ state: locked ? 'locked' : 'error', error: locked ? null : errorText(e) });
      // إعادة المحاولة تلقائيًا
      clearRetry();
      retryTimer = setTimeout(() => { retryTimer = null; flush().catch(() => {}); }, locked ? (cfg.retryMs || 3000) : (e && e.retryMs) || (cfg.retryMs || 3000) * 3);
      return false;
    }
  }
  /* كتابة قسرية: تستبدل الملف بنسخة الموقع حتى لو تغيّر خارجيًا وتعذّرت قراءته (لزر «استبدال الملف بنسخة الموقع» مستقبلًا) */
  function forceWrite() { forceOnce = true; return flush(); }

  function isLockError(e) {
    const n = (e && e.name) || '';
    const m = String((e && e.message) || '').toLowerCase();
    return n === 'NoModificationAllowedError' || n === 'InvalidStateError' || m.includes('locked') || m.includes('being used') || m.includes('sharing violation');
  }
  function errorText(e) {
    if (!e) return 'خطأ غير معروف';
    if (e.name === 'NotAllowedError') return 'لم يُسمح بالوصول إلى الملف — اضغط «متابعة» للسماح';
    if (e.name === 'NotFoundError') return 'ملف الإكسيل لم يعد موجودًا في مكانه — أعد ربطه';
    return e.message || String(e);
  }

  /* ---------- مراقبة التعديلات الخارجية ---------- */
  let pollPromise = null;
  function poll() {
    if (!adapter || writing) return Promise.resolve(false);
    return pollNow();
  }
  function pollNow() {   // بلا حارس writing: يستدعيه flush نفسه قبل الكتابة
    if (!adapter) return Promise.resolve(false);
    if (pollPromise) return pollPromise;
    pollPromise = doPoll().catch(() => false).then(r => { pollPromise = null; return r; });
    return pollPromise;
  }
  async function doPoll() {
    let m;
    try { m = await adapter.lastModified(); } catch (e) { emit({ state: 'error', error: errorText(e) }); return false; }
    if (m === lastSeen) return false;
    try {
      // ننتظر حتى يستقر الملف (Excel/OneDrive يكتبان على دفعات)
      await new Promise(r => setTimeout(r, cfg.settleMs == null ? 400 : cfg.settleMs));
      const m2 = await adapter.lastModified();
      if (m2 !== m) return false;
    } catch (e) { return false; }
    emit({ state: 'reading' });
    try {
      const buf = await adapter.read();
      await cfg.deserialize(buf);
      lastSeen = m; readError = ''; // لا نعتبر التعديل مقروءًا إلا بعد نجاح القراءة
      status.lastExternal = Date.now();
      let replayed = false;
      if (pending.length) { cfg.applyOps(pending.slice()); replayed = true; } // الكتابة تتم من المستدعي (لا من داخل الاستطلاع)
      emit({ state: 'linked', lastSync: Date.now(), error: null });
      if (cfg.onExternalChange) cfg.onExternalChange();
      return { changed: true, replayed };
    } catch (e) {
      readError = errorText(e);
      emit({ state: 'error', error: unreadText() });
      return false;
    }
  }
  function startPolling() {
    if (timer) clearInterval(timer);   // لا نلغي مؤقّت إعادة المحاولة: قد تكون عمليات معلّقة بانتظار إغلاق Excel
    timer = setInterval(() => {
      poll().then(r => {
        if (r && r.replayed) return flush();
        if (status.state === 'locked' && pending.length && !retryTimer && !flushTimer && !writing) return flush();   // شبكة أمان لو ضاع مؤقّت إعادة المحاولة
      }).catch(() => {});
    }, cfg.pollMs || 1500);
  }
  function stopPolling() { if (timer) clearInterval(timer); timer = null; clearTimeout(flushTimer); flushTimer = null; clearRetry(); }   // الإيقاف الكامل (unlink/الاختبارات)

  E.Sync = {
    init, link, unlink, record, flush, forceWrite, poll, startPolling, stopPolling,
    get status() { return { ...status, pending: pending.length, note: stashNote }; },
    get adapter() { return adapter; },
    get tabId() { return tabId; },
    get journalKey() { return ownKey; },
    pendingOps() { return pending.slice(); },
    clearPending() { pending = []; saveJournal(); emit({}); },
    /* عمليات محفوظة جانبًا تخص ملفات أخرى (لواجهة مستقبلية) */
    stashed() { const s = readStash(); return Object.keys(s).map(f => ({ file: f, count: arr(s[f].ops).length, at: s[f].at || 0, mtime: s[f].mtime || 0, ops: arr(s[f].ops).slice() })); },
    discardStash(file) { const s = readStash(); if (!(file in s)) return false; delete s[file]; writeStash(s); emit({}); return true; },
    adoptOrphans() { adoptOrphans(); },
  };
})(window.Egary);
