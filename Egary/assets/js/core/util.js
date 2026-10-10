/* =====================================================================
   util.js — أدوات مشتركة: تواريخ (UTC دائمًا)، أرقام، تطبيع عربي للبحث، أكواد
   ===================================================================== */
window.Egary = window.Egary || {};
(function (E) {
  'use strict';
  const DAY = 86400000;

  /* ---------- تواريخ: التخزين دائمًا 'YYYY-MM-DD' والحساب بـ UTC ---------- */
  function d(isoStr) { // 'YYYY-MM-DD' → Date(UTC)
    if (isoStr instanceof Date) return new Date(Date.UTC(isoStr.getUTCFullYear(), isoStr.getUTCMonth(), isoStr.getUTCDate()));
    if (!isoStr || typeof isoStr !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoStr);
    if (!m) return null;
    const y = +m[1], mo = +m[2], dd = +m[3];
    const dt = new Date(Date.UTC(y, mo - 1, dd));
    // تاريخ مستحيل (30 فبراير، شهر 13، 31/11) لا يُدوَّر إلى الشهر التالي بل يُرفض
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== dd) return null;
    return dt;
  }
  function iso(date) { return date ? date.toISOString().slice(0, 10) : ''; }
  let FAKE_TODAY = null; // للاختبارات: تثبيت «اليوم»
  function today() {
    if (FAKE_TODAY) return d(FAKE_TODAY);
    const n = new Date();
    return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
  }
  function setToday(isoStr) { FAKE_TODAY = isoStr || null; }
  function periodOf(date) { return date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0'); }
  function monthFirst(period) { return d(period + '-01'); }
  function monthLast(period) { const [y, m] = period.split('-').map(Number); return new Date(Date.UTC(y, m, 0)); }
  function daysInMonth(period) { return monthLast(period).getUTCDate(); }
  function addMonths(period, n) { const [y, m] = period.split('-').map(Number); return periodOf(new Date(Date.UTC(y, m - 1 + n, 1))); }
  function addDays(date, n) { return new Date(date.getTime() + n * DAY); }
  function daysBetween(a, b) { return Math.round((b - a) / DAY); }
  function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function monthsBetween(pa, pb) { const [ya, ma] = pa.split('-').map(Number), [yb, mb] = pb.split('-').map(Number); return (yb - ya) * 12 + (mb - ma); }
  function* periods(from, to) { for (let p = from; cmp(p, to) <= 0; p = addMonths(p, 1)) yield p; }
  /* تحويل أي قيمة (Date من ExcelJS / نص / رقم تسلسلي) إلى 'YYYY-MM-DD' أو '' */
  function toIso(v) {
    if (!v) return '';
    if (v instanceof Date) {
      if (isNaN(v.getTime())) return '';
      // ExcelJS يعطي التاريخ بمنتصف الليل UTC؛ نحميه من انزياح المنطقة الزمنية
      return iso(new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate())));
    }
    if (typeof v === 'number') { // رقم إكسيل تسلسلي (الكسر = وقت داخل نفس اليوم ⇒ لا يُقرَّب إلى اليوم التالي)
      if (!isFinite(v)) return '';
      const base = Date.UTC(1899, 11, 30);
      return iso(new Date(base + Math.floor(v) * DAY));
    }
    const s = foldDigits(String(v).trim());
    const valid = (y, mo, dd) => { const out = `${y}-${mo.padStart(2, '0')}-${dd.padStart(2, '0')}`; return d(out) ? out : ''; }; // تاريخ مستحيل ⇒ ''
    let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
    if (m) return valid(m[1], m[2], m[3]);
    m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(s);
    if (m) return valid(m[3], m[2], m[1]);
    return '';
  }
  const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  function periodLabel(period, withYear) {
    if (!period) return '';
    const [y, m] = period.split('-').map(Number);
    return MONTHS_AR[m - 1] + (withYear ? ' ' + y : '');
  }
  function fmtDate(isoStr) { // عرض: dd/mm/yyyy
    const dt = d(isoStr); if (!dt) return '—';
    return String(dt.getUTCDate()).padStart(2, '0') + '/' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '/' + dt.getUTCFullYear();
  }

  /* الأرقام العربية الهندية (٠-٩) والفارسية (۰-۹) → لاتينية؛ تُستخدم في الأرقام والتواريخ والأكواد والبحث */
  const DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };
  function foldDigits(s) { return String(s == null ? '' : s).replace(/[٠-٩۰-۹]/g, c => DIGITS[c] || c); }

  /* ---------- أرقام ---------- */
  const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  function fmtMoney(n, opts) {
    if (n == null || isNaN(n)) return '—';
    const s = (opts && opts.decimals ? nf2 : nf0).format(Math.round(n * 100) / 100);
    return opts && opts.plain ? s : s + '\u00A0ج'; // مسافة غير قابلة للكسر: الرقم والعملة لا ينفصلان
  }
  /* تاريخ ووقت بصيغة واحدة في كل الشاشات: dd/mm/yyyy hh:mm بأرقام لاتينية (توقيت الجهاز) */
  function fmtDateTime(ts) { const dt = ts instanceof Date ? ts : new Date(ts); if (!ts || isNaN(dt)) return '—'; return pad(dt.getDate(), 2) + '/' + pad(dt.getMonth() + 1, 2) + '/' + dt.getFullYear() + ' ' + pad(dt.getHours(), 2) + ':' + pad(dt.getMinutes(), 2); }
  function fmtTime(ts) { const dt = ts instanceof Date ? ts : new Date(ts); if (!ts || isNaN(dt)) return '—'; return pad(dt.getHours(), 2) + ':' + pad(dt.getMinutes(), 2); }
  function fmtNum(n) { return n == null || isNaN(n) ? '—' : nf0.format(n); }
  function fmtPct(x, digits) { return x == null || isNaN(x) ? '—' : (x * 100).toFixed(digits == null ? 0 : digits) + '%'; }
  function toNum(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (typeof v === 'object' && v.result != null) return toNum(v.result); // خلية معادلة من ExcelJS
    // أرقام عربية/فارسية، الفاصلة العشرية العربية (٫) والفاصلة الألفية (٬ أو ,) والمسافات، ولاحقة «ج» أو «ج.م»
    const s = foldDigits(String(v)).replace(/٫/g, '.').replace(/[٬,\s]/g, '').replace(/(جنيهات|جنيها|جنيه|ج\.?م?\.?|egp|le)$/i, '');
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    return parseFloat(s);
  }
  function round2(n) { return Math.round(n * 100) / 100; }

  /* ---------- تطبيع عربي للبحث ---------- */
  function normalize(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .replace(/[ً-ْـ]/g, '')          // تشكيل وتطويل
      .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىئ]/g, 'ي').replace(/ؤ/g, 'و')
      .replace(/[٠-٩۰-۹]/g, c => DIGITS[c] || c)
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }
  function matches(hay, q) { const n = normalize(q); return !n || normalize(hay).includes(n); }
  function cellText(v) { // نص خلية ExcelJS (قد يكون rich text / معادلة / تاريخ)
    if (v == null) return '';
    if (v instanceof Date) return toIso(v);
    if (typeof v === 'object') {
      if (v.richText) return v.richText.map(r => r.text).join('');
      if (v.result != null) return cellText(v.result);
      if (v.text != null) return String(v.text);
      if (v.formula) return '';
      return '';
    }
    return String(v).trim();
  }

  /* ---------- أكواد ---------- */
  function foldCode(s) { return String(s == null ? '' : s).replace(/[٠-٩۰-۹]/g, c => DIGITS[c] || c).replace(/\s+/g, '').toUpperCase(); }
  function pad(n, w) { return String(n).padStart(w, '0'); }
  /* طابع زمني محلي (ساعة المكتب) 'YYYY-MM-DD HH:MM:SS' — للسجلات والعرض */
  function stamp(dt) { dt = dt || new Date(); return dt.getFullYear() + '-' + pad(dt.getMonth() + 1, 2) + '-' + pad(dt.getDate(), 2) + ' ' + pad(dt.getHours(), 2) + ':' + pad(dt.getMinutes(), 2) + ':' + pad(dt.getSeconds(), 2); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function sum(arr, f) { let s = 0; for (const x of arr) s += f ? (f(x) || 0) : (x || 0); return s; }
  function groupBy(arr, f) { const m = new Map(); for (const x of arr) { const k = f(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  E.U = { DAY, d, iso, today, setToday, periodOf, monthFirst, monthLast, daysInMonth, addMonths, addDays, daysBetween, cmp, monthsBetween, periods, toIso, MONTHS_AR, periodLabel, fmtDate, fmtDateTime, fmtTime, fmtMoney, fmtNum, fmtPct, toNum, round2, foldDigits, normalize, matches, cellText, foldCode, pad, stamp, uid, clone, sum, groupBy, esc };
})(window.Egary);
