/* =====================================================================
   file-link.js — ربط ملف الإكسيل (File System Access API) + تذكّر الربط
   الواجهة الموحّدة لأي «محوِّل ملف» (adapter):
     { kind, name, canWrite, read(): Promise<ArrayBuffer>,
       write(ArrayBuffer): Promise<void>, lastModified(): Promise<number> }
   نفس الواجهة لها تنفيذ ذاكرة (للاختبارات) وتنفيذ ملف حقيقي.
   ===================================================================== */
window.Egary = window.Egary || {};
(function (E) {
  'use strict';

  const DB_NAME = 'egary-file-link', STORE = 'handles', KEY = 'workbook';

  function openDb() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('no-indexeddb'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function tx(mode, fn) {
    return openDb().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const st = t.objectStore(STORE);
      const r = fn(st);
      t.oncomplete = () => { db.close(); resolve(r && r.result); };
      t.onerror = () => { db.close(); reject(t.error); };
    }));
  }
  const saveHandle = (h) => tx('readwrite', st => st.put(h, KEY)).catch(() => null);
  const loadHandle = () => tx('readonly', st => st.get(KEY)).catch(() => null);
  const clearHandle = () => tx('readwrite', st => st.delete(KEY)).catch(() => null);

  /* ---------- محوِّل ملف حقيقي (Chrome / Edge) ---------- */
  function fileHandleAdapter(handle) {
    return {
      kind: 'file', name: handle.name, canWrite: true, handle,
      async read() { const f = await handle.getFile(); return f.arrayBuffer(); },
      async lastModified() { const f = await handle.getFile(); return f.lastModified; },
      async write(buf) {
        // createWritable يفشل (NoModificationAllowedError) لو الملف مفتوح في Excel — يعالجه sync.js
        const w = await handle.createWritable({ keepExistingData: false });
        try { await w.write(buf); } finally { await w.close(); }
      },
      async permission(ask) {
        const opts = { mode: 'readwrite' };
        let p = await handle.queryPermission(opts);
        if (p !== 'granted' && ask) p = await handle.requestPermission(opts);
        return p;
      },
    };
  }

  /* ---------- محوِّل ذاكرة (الاختبارات + متصفحات بلا File System Access) ---------- */
  function memoryAdapter(initialBytes, name) {
    let bytes = initialBytes ? initialBytes.slice(0) : null;
    let mtime = 1;
    const a = {
      kind: 'memory', name: name || 'Egary.xlsx', canWrite: true, writes: 0, locked: false,
      async read() { return bytes ? bytes.slice(0) : null; },
      async lastModified() { return mtime; },
      async write(buf) {
        if (a.locked) { const e = new Error('locked'); e.name = 'NoModificationAllowedError'; throw e; }
        bytes = buf.slice(0); mtime += 1; a.writes += 1;
      },
      /* محاكاة تعديل خارجي (كأن Excel حفظ الملف) */
      externalWrite(buf) { bytes = buf.slice(0); mtime += 1; },
      bytes() { return bytes; },
      async permission() { return 'granted'; },
    };
    return a;
  }

  const supported = typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';

  async function pick() {
    const [handle] = await window.showOpenFilePicker({
      multiple: false, excludeAcceptAllOption: false,
      types: [{ description: 'Excel', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }],
    });
    await saveHandle(handle);
    return fileHandleAdapter(handle);
  }
  async function restore() {
    const h = await loadHandle();
    return h ? fileHandleAdapter(h) : null;
  }

  /* تنزيل نسخة (الاحتياطي اليدوي / متصفحات بلا ربط) */
  function downloadBytes(buf, filename) {
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename || 'Egary.xlsx';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  E.FileLink = { supported, pick, restore, saveHandle, loadHandle, clearHandle, fileHandleAdapter, memoryAdapter, downloadBytes };
})(window.Egary);
