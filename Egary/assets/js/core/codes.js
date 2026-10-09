/* =====================================================================
   codes.js — توليد الأكواد الثابتة القابلة للبحث
     مشروع  P01, P02 …
     وحدة   {مشروع}-{رقم الوحدة}  مثل P03-304 — وللوحدات غير الرقمية حرف نوع + رقم:
            ميزان 1 → M1، محل → S1، مكتب 42 → O42، الدور الثاني → F2، جراج 5 → G5
     عميل   C001 …      عقد T0001 …      فاتورة INV-2026-0001 …      صيانة M0001 …
   الكود لا يتغيّر بعد إنشائه أبدًا (هو هوية السجل في الإكسيل وفي الموقع).
   ===================================================================== */
window.Egary = window.Egary || {};
(function (E) {
  'use strict';
  const U = () => E.U;

  function maxSeq(list, re) {
    let m = 0;
    for (const x of list) { const k = re.exec(U().foldCode(x.code)); if (k) m = Math.max(m, parseInt(k[1], 10)); }
    return m;
  }
  function nextProject(state) { return 'P' + U().pad(maxSeq(state.projects, /^P(\d+)$/) + 1, 2); }
  function nextClient(state) { return 'C' + U().pad(maxSeq(state.clients, /^C(\d+)$/) + 1, 3); }
  function nextContract(state) { return 'T' + U().pad(maxSeq(state.contracts, /^T(\d+)$/) + 1, 4); }
  function nextMaintenance(state) { return 'M' + U().pad(maxSeq(state.maintenance, /^M(\d+)$/) + 1, 4); }
  function nextInvoice(state, year) {
    const prefix = (state.settings && state.settings.invoicePrefix) || 'INV';
    const re = new RegExp('^' + prefix + '-' + year + '-(\\d+)$');
    return prefix + '-' + year + '-' + U().pad(maxSeq(state.payments, re) + 1, 4);
  }

  const ORDINALS = { 'الارضي': 'G', 'الأرضي': 'G', 'ارضي': 'G', 'الاول': '1', 'الأول': '1', 'الثاني': '2', 'الثالث': '3', 'الرابع': '4', 'الخامس': '5', 'السادس': '6', 'السابع': '7', 'الثامن': '8', 'التاسع': '9', 'العاشر': '10' };
  /* تحليل اسم الوحدة كما يكتبه المكتب → { kind, num } لاستخدامه في الكود والدور */
  function parseLabel(label) {
    const s = U().normalize(label);
    const digits = (s.match(/\d+(?:[./]\d+)?/g) || []);
    const num = digits.length ? digits.join('-').replace(/[./]/g, '-') : '';
    if (/^\d+$/.test(s)) return { kind: 'num', num: s };
    if (/ميزان/.test(s)) return { kind: 'M', num: num || '1' };
    if (/محل/.test(s)) return { kind: 'S', num };
    if (/مكتب/.test(s)) return { kind: 'O', num };
    if (/جراج|موقف/.test(s)) return { kind: 'G', num };
    if (/دور|طابق/.test(s)) {
      for (const w of Object.keys(ORDINALS)) if (s.includes(U().normalize(w))) return { kind: 'F', num: ORDINALS[w] };
      return { kind: 'F', num };
    }
    if (/شقه|شقة/.test(s)) return { kind: 'num', num };
    if (/عياده|عيادة/.test(s)) return { kind: 'K', num };
    return { kind: 'U', num };
  }
  function unitCode(state, projectCode, label) {
    const p = parseLabel(label);
    let base = projectCode + '-' + (p.kind === 'num' ? p.num : p.kind + (p.num || ''));
    if (base.endsWith('-') || /-(S|O|G|F|K|U)$/.test(base)) base = base + '1';
    const used = new Set(state.units.map(u => U().foldCode(u.code)));
    if (!used.has(U().foldCode(base))) return base;
    // نفس الاسم موجود (مثل «محل» مرتين): نضيف رقمًا متسلسلًا
    const m = /^(.*?)(\d+)$/.exec(base);
    let stem = m ? m[1] : base + '-', n = m ? parseInt(m[2], 10) + 1 : 2;
    while (used.has(U().foldCode(stem + n))) n++;
    return stem + n;
  }
  /* استنتاج الدور من اسم الوحدة: 304 → 3، 1203 → 12، ميزان → M، محل → G (أرضي) */
  function inferFloor(label) {
    const p = parseLabel(label);
    if (p.kind === 'num' && p.num) {
      if (p.num.length >= 3) return String(parseInt(p.num.slice(0, -2), 10));
      if (p.num.length === 2) return p.num[0];
      return '';
    }
    if (p.kind === 'M') return 'M';
    if (p.kind === 'S') return 'G';
    if (p.kind === 'F') return p.num || '';
    if (p.kind === 'O' && p.num && p.num.length >= 2) return p.num[0];
    return '';
  }
  /* استنتاج النوع من الاسم (يُراجَع من المكتب): محل → تجارية، جراج → جراج، غير ذلك → إدارية */
  function inferType(label) {
    const p = parseLabel(label);
    if (p.kind === 'S') return 'commercial';
    if (p.kind === 'G') return 'garage';
    if (/شقه|شقة|سكن/.test(U().normalize(label))) return 'residential';
    return 'admin';
  }
  /* تمييز نوع الكود من شكله (للبحث السريع) */
  function kindOf(code) {
    const c = U().foldCode(code);
    if (/^P\d+$/.test(c)) return 'projects';
    if (/^P\d+-/.test(c)) return 'units';
    if (/^C\d+$/.test(c)) return 'clients';
    if (/^T\d+$/.test(c)) return 'contracts';
    if (/^M\d+$/.test(c)) return 'maintenance';
    if (/^[A-Z]+-\d{4}-\d+$/.test(c)) return 'payments';
    return '';
  }
  E.Codes = { nextProject, nextClient, nextContract, nextMaintenance, nextInvoice, unitCode, parseLabel, inferFloor, inferType, kindOf };
})(window.Egary);
