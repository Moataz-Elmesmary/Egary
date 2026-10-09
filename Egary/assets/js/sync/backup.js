/* =====================================================================
   backup.js — نسخ احتياطي تلقائي على القرص داخل مجلد البرنامج (backups/)
   السياسة:
     • بعد كل كتابة ناجحة: نسخة باسم Egary-YYYY-MM-DD-HHMMSS.xlsx إن مرّ 20 دقيقة على آخر نسخة.
     • قبل أي حذف: نسخة فورية باسم Egary-before-delete-….xlsx.
     • عند أول ربط: نسخة Egary-original-….xlsx لا تُحذف أبدًا.
     • الاحتفاظ بآخر 60 نسخة دورية (+ النسخ الأصلية وما قبل الحذف لا تُحسب ولا تُحذف تلقائيًا).
   يعمل فقط عندما يختار المستخدم مجلد البرنامج (مرة واحدة). وإلى جانبه نسخ داخل المتصفح دائمًا.
   ===================================================================== */
window.Egary = window.Egary || {};
(function (E) {
  'use strict';
  const FL = () => E.FileLink;
  const SUB = 'backups';
  const state = { dir: null, lastAt: 0, lastName: '', count: 0, error: null, keep: 60, minIntervalMs: 20 * 60 * 1000 };
  const listeners = new Set();
  function emit() { for (const fn of listeners) { try { fn(status()); } catch (e) { } } }
  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function status() { return { enabled: !!state.dir, lastAt: state.lastAt, lastName: state.lastName, count: state.count, error: state.error, dirName: state.dir ? state.dir.name : '' }; }
  function stamp(d) { d = d || new Date(); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; }
  /* اسم فريد: لو وُجد ملف بنفس الاسم في نفس الثانية نضيف لاحقة -2، -3 … حتى لا تُستبدل نسخة بأخرى */
  async function uniqueName(base) {
    let existing = new Set();
    try { existing = new Set((await FL().listFilesIn(state.dir, SUB)).map(f => f.name)); } catch (e) { }
    if (!existing.has(base + '.xlsx')) return base + '.xlsx';
    for (let i = 2; i < 1000; i++) { const n = `${base}-${i}.xlsx`; if (!existing.has(n)) return n; }
    return `${base}-${Date.now()}.xlsx`;
  }
  async function setDir(dir) { state.dir = dir; state.error = null; await refresh(); emit(); }
  async function refresh() {
    if (!state.dir) return;
    try { const files = await FL().listFilesIn(state.dir, SUB); state.count = files.length; if (files[0]) { state.lastAt = files[0].at; state.lastName = files[0].name; } } catch (e) { state.error = e.message || String(e); }
  }
  /* يكتب نسخة (force لتجاوز فاصل 20 دقيقة) */
  async function write(buf, label, force) {
    if (!state.dir || !buf || !buf.byteLength) return false;
    const now = Date.now();
    if (!force && now - state.lastAt < state.minIntervalMs) return false;
    const name = await uniqueName(`Egary-${label ? label + '-' : ''}${stamp(new Date(now))}`);
    try {
      await FL().writeFileIn(state.dir, SUB, name, buf);
      state.lastAt = now; state.lastName = name; state.error = null; state.count++;
      await prune();
      emit();
      return name;
    } catch (e) { state.error = e.message || String(e); emit(); return false; }
  }
  async function prune() {
    try {
      const files = await FL().listFilesIn(state.dir, SUB);
      const periodic = files.filter(f => !/original|before-delete/.test(f.name));
      for (const f of periodic.slice(state.keep)) await FL().removeFileIn(state.dir, SUB, f.name);
      state.count = files.length - Math.max(0, periodic.length - state.keep);
    } catch (e) { }
  }
  async function list() { if (!state.dir) return []; try { return await FL().listFilesIn(state.dir, SUB); } catch (e) { return []; } }
  E.Backup = { setDir, write, list, status, subscribe, refresh, _state: state };
})(window.Egary);
