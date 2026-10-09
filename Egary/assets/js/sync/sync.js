/* =====================================================================
   sync.js — محرّك المزامنة ثنائي الاتجاه بين الحالة في الذاكرة وملف الإكسيل
   القواعد:
     1. الإكسيل هو مصدر الحقيقة: أي تغيير في ملفه (lastModified) يُقرأ ويُطبَّق.
     2. كل تعديل في الموقع = عملية (op) تُسجَّل في «دفتر العمليات» ثم يُكتب
        الملف كله من الحالة الحالية. لو الكتابة فشلت (الملف مفتوح في Excel)
        تبقى العمليات معلّقة وتُعاد المحاولة تلقائيًا.
     3. لو وصل تعديل خارجي وفي عمليات معلّقة: نقرأ الملف الجديد ثم نعيد تطبيق
        العمليات المعلّقة عليه (كلها upsert/delete بالكود ⇒ آمنة للإعادة) ثم نكتب.
   الواجهة:
     Sync.init({ serialize, deserialize, applyOps, onStatus, pollMs })
     Sync.link(adapter)  Sync.unlink()  Sync.record(op)  Sync.flush()
     Sync.status → { state: 'unlinked'|'linked'|'saving'|'locked'|'error'|'reading', pending, name, lastSync, error }
   ===================================================================== */
window.Egary = window.Egary || {};
(function (E) {
  'use strict';

  const JOURNAL_KEY = 'egary-pending-ops-v1';
  let cfg = null, adapter = null, timer = null, lastSeen = 0, writing = false, flushAgain = false;
  let pending = [];
  const status = { state: 'unlinked', pending: 0, name: '', lastSync: null, error: null, lastExternal: null };

  function emit(patch) {
    Object.assign(status, patch || {}, { pending: pending.length });
    if (cfg && cfg.onStatus) { try { cfg.onStatus({ ...status }); } catch (e) { /* ignore */ } }
  }
  function loadJournal() {
    try { pending = JSON.parse(localStorage.getItem(JOURNAL_KEY) || '[]'); } catch (e) { pending = []; }
    if (!Array.isArray(pending)) pending = [];
  }
  function saveJournal() {
    try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(pending)); } catch (e) { /* ignore */ }
  }

  function init(options) {
    cfg = options;
    loadJournal();
    emit({});
    return status;
  }

  async function link(a, opts) {
    adapter = a;
    opts = opts || {};
    emit({ state: 'reading', name: a.name, error: null });
    try {
      const buf = await a.read();
      lastSeen = await a.lastModified();
      if (buf && buf.byteLength) await cfg.deserialize(buf);
      if (pending.length) {
        // عمليات معلّقة من جلسة سابقة: طبّقها على الملف الحالي ثم اكتب
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

  /* تسجيل عملية + كتابة. الكتابة تُجمَّع (debounce قصير) لتجنّب كتابات متتالية. */
  let flushTimer = null;
  function record(op) {
    if (op) { pending.push(op); saveJournal(); }
    emit({});
    if (!adapter) return Promise.resolve(false);
    clearTimeout(flushTimer);
    return new Promise(resolve => { flushTimer = setTimeout(() => flush().then(resolve, () => resolve(false)), cfg.debounceMs == null ? 150 : cfg.debounceMs); });
  }

  async function flush() {
    if (!adapter) return false;
    if (writing) { flushAgain = true; return false; }
    writing = true;
    emit({ state: 'saving', error: null });
    try {
      const buf = await cfg.serialize();
      await adapter.write(buf);
      lastSeen = await adapter.lastModified();
      pending = []; saveJournal();
      emit({ state: 'linked', lastSync: Date.now(), error: null });
      writing = false;
      if (flushAgain) { flushAgain = false; return flush(); }
      return true;
    } catch (e) {
      writing = false;
      const locked = isLockError(e);
      emit({ state: locked ? 'locked' : 'error', error: locked ? null : errorText(e) });
      // إعادة المحاولة تلقائيًا
      clearTimeout(flushTimer);
      flushTimer = setTimeout(() => { flush().catch(() => {}); }, locked ? (cfg.retryMs || 3000) : (cfg.retryMs || 3000) * 3);
      return false;
    }
  }

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
  async function poll() {
    if (!adapter || writing) return;
    let m;
    try { m = await adapter.lastModified(); } catch (e) { emit({ state: 'error', error: errorText(e) }); return; }
    if (m === lastSeen) return;
    lastSeen = m;
    emit({ state: 'reading' });
    try {
      const buf = await adapter.read();
      await cfg.deserialize(buf);
      status.lastExternal = Date.now();
      if (pending.length) {
        cfg.applyOps(pending.slice());
        emit({ state: 'linked', lastSync: Date.now() });
        await flush();
      } else {
        emit({ state: 'linked', lastSync: Date.now(), error: null });
      }
      if (cfg.onExternalChange) cfg.onExternalChange();
    } catch (e) {
      emit({ state: 'error', error: 'تعذّر قراءة الملف بعد تعديله: ' + errorText(e) });
    }
  }
  function startPolling() {
    stopPolling();
    timer = setInterval(() => { poll().catch(() => {}); }, cfg.pollMs || 1500);
  }
  function stopPolling() { if (timer) clearInterval(timer); timer = null; }

  E.Sync = {
    init, link, unlink, record, flush, poll, startPolling, stopPolling,
    get status() { return { ...status, pending: pending.length }; },
    get adapter() { return adapter; },
    pendingOps() { return pending.slice(); },
    clearPending() { pending = []; saveJournal(); emit({}); },
  };
})(window.Egary);
