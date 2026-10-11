/* =====================================================================
   log.js — سجل العمليات خارج الإكسيل: مَن فعل ماذا ومتى
   • كل عملية (إضافة/تعديل/حذف/دخول/خروج/دخول مرفوض) تُضاف هنا فورًا وتبقى في المتصفح (آخر 3000)،
     وعند تفعيل مجلد البرنامج تُكتب في ملفات شهرية backups/logs/Egary-log-YYYY-MM.csv (إلحاق فقط، UTF-8 مع BOM ليفتحها Excel عربيًا).
   • ورقة «سجل التعديلات» داخل الإكسيل تحتفظ بآخر 500 عملية؛ ملفات السجل لا تُقصّ.
   ===================================================================== */
window.Egary = window.Egary || {};
(function (E) {
  'use strict';
  const FL = () => E.FileLink;
  const SUB = 'logs', BUF_KEY = 'egary-log-buffer-v1', MAX = 3000;
  const state = { dir: null, written: 0, error: null, lastAt: 0, lastFile: '' };
  let buf = []; try { buf = JSON.parse(localStorage.getItem(BUF_KEY) || '[]'); if (!Array.isArray(buf)) buf = []; } catch (e) { buf = []; }
  const listeners = new Set();
  function emit() { for (const fn of listeners) { try { fn(status()); } catch (e) { } } }
  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function status() { return { enabled: !!state.dir, buffered: buf.length, written: state.written, lastAt: state.lastAt, lastFile: state.lastFile, error: state.error }; }
  const csvCell = v => { const s = String(v == null ? '' : v).replace(/\r?\n/g, ' '); return /[",;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const line = e => [e.at, e.user, e.action, e.entity, e.code, e.summary, e.device || ''].map(csvCell).join(',') + '\r\n';
  const HEADER = '﻿' + ['الوقت', 'المستخدم', 'العملية', 'الكيان', 'الكود', 'التفاصيل', 'الجهاز'].join(',') + '\r\n';
  const fileFor = at => 'Egary-log-' + String(at || '').slice(0, 7) + '.csv';
  const deviceName = () => { try { return (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || ''; } catch (e) { return ''; } };
  function save() { try { localStorage.setItem(BUF_KEY, JSON.stringify(buf.slice(-MAX))); } catch (e) { } }
  /* الوقت المحلي للجهاز (لا UTC) حتى يطابق ما يراه المستخدم في الإكسيل والسجل */
  const stampNow = () => (E.U && E.U.stamp) ? E.U.stamp() : new Date().toISOString().slice(0, 19).replace('T', ' ');
  function append(entry) {
    const e = Object.assign({ at: stampNow(), user: '', action: '', entity: '', code: '', summary: '', device: deviceName() }, entry || {});
    buf.push(e); if (buf.length > MAX) buf = buf.slice(-MAX); save(); emit();
    if (state.dir) flush();
    return e;
  }
  let flushP = null;
  /* كتابة ما في الذاكرة إلى ملفات الشهر (إلحاق). استدعاء متزامن ينتظر الكتابة الجارية ثم يكمل ما وصل أثناءها.
     • الجسم يبدأ بـ await حتى لا يكتمل متزامنًا قبل إسناد flushP (وإلا بقي flushP وعدًا منتهيًا ولم يُكتب شيء بعده).
     • صفوف كل شهر تُحذف من الذاكرة فور نجاح إلحاقها، فلو فشل ملف الشهر التالي لا تُكرَّر في المحاولة القادمة. */
  function flush() {
    if (!state.dir) return Promise.resolve(false);
    if (flushP) return flushP;
    flushP = (async () => {
      await null;
      try {
        while (buf.length && state.dir) {
          const groups = new Map(); for (const e of buf) { const n = fileFor(e.at); if (!groups.has(n)) groups.set(n, []); groups.get(n).push(e); }
          for (const [name, rows] of groups) {
            await FL().appendFileIn(state.dir, SUB, name, rows.map(line).join(''), HEADER);
            state.written += rows.length; state.lastAt = Date.now(); state.lastFile = name;
            const done = new Set(rows); buf = buf.filter(e => !done.has(e)); save();
          }
          state.error = null;
        }
      } catch (e) { state.error = e.message || String(e); }
      finally { flushP = null; emit(); }
      return !state.error;
    })();
    return flushP;
  }
  async function setDir(dir) { state.dir = dir; state.error = null; await flush(); emit(); }
  function entries() { return buf.slice(); }
  /* تنزيل CSV يجمع ما في الإكسيل (آخر 500) وما لم يُكتب بعد في ملف */
  function downloadCsv(auditRows) {
    const seen = new Set(), all = [];
    for (const e of buf.concat(auditRows || [])) { const k = [e.at, e.action, e.code, e.summary].join('|'); if (seen.has(k)) continue; seen.add(k); all.push(e); }
    all.sort((a, b) => (b.at > a.at ? 1 : b.at < a.at ? -1 : 0));
    const text = HEADER + all.map(line).join('');
    FL().downloadBytes(new TextEncoder().encode(text).buffer, 'Egary-log-' + stampNow().slice(0, 10) + '.csv');
    return all.length;
  }
  /* نفس التنزيل لكن ملف Excel حقيقي (.xlsx): يفتح صحيحًا مهما كانت إعدادات ويندوز الإقليمية */
  async function downloadXlsx(auditRows) {
    if (typeof ExcelJS === 'undefined') return downloadCsv(auditRows);
    const seen = new Set(), all = [];
    for (const e of buf.concat(auditRows || [])) { const k = [e.at, e.action, e.code, e.summary].join('|'); if (seen.has(k)) continue; seen.add(k); all.push(e); }
    all.sort((a, b) => (b.at > a.at ? 1 : b.at < a.at ? -1 : 0));
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('سجل العمليات', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
    ws.getRow(1).values = ['الوقت', 'المستخدم', 'العملية', 'الكيان', 'الكود', 'التفاصيل', 'الجهاز'];
    ws.getRow(1).eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } }; c.alignment = { horizontal: 'center' }; });
    all.forEach((e, i) => { ws.getRow(2 + i).values = [e.at || '', e.user || '', e.action || '', e.entity || '', e.code || '', e.summary || '', e.device || '']; });
    [20, 16, 12, 14, 16, 70, 14].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, all.length + 1), column: 7 } };
    FL().downloadBytes(await wb.xlsx.writeBuffer(), 'Egary-log-' + stampNow().slice(0, 10) + '.xlsx');
    return all.length;
  }
  E.Log = { append, flush, setDir, status, subscribe, entries, downloadCsv, downloadXlsx, line, HEADER, _state: state };
})(window.Egary);
