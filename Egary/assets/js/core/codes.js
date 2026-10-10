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
    for (const x of list || []) { const k = re.exec(U().foldCode(x.code)); if (k) m = Math.max(m, parseInt(k[1], 10)); }
    return m;
  }
  /* الرقم التالي = أعلى من (الموجود فعلًا، وما ورد في سجل التعديلات، وأعلى رقم صدر من قبل) — فالكود المحذوف لا يُعاد لسجل آخر */
  function seqs(state) { if (!state.settings) state.settings = {}; if (!state.settings.codeSeq || typeof state.settings.codeSeq !== 'object') state.settings.codeSeq = {}; return state.settings.codeSeq; }
  function nextSeq(state, kind, list, re) {
    const sq = seqs(state);
    const n = Math.max(maxSeq(list, re), maxSeq(state.audit || [], re), parseInt(sq[kind], 10) || 0) + 1;
    sq[kind] = n; return n;
  }
  function nextProject(state) { return 'P' + U().pad(nextSeq(state, 'P', state.projects, /^P(\d+)$/), 2); }
  function nextClient(state) { return 'C' + U().pad(nextSeq(state, 'C', state.clients, /^C(\d+)$/), 3); }
  function nextContract(state) { return 'T' + U().pad(nextSeq(state, 'T', state.contracts, /^T(\d+)$/), 4); }
  function nextMaintenance(state) { return 'M' + U().pad(nextSeq(state, 'M', state.maintenance, /^M(\d+)$/), 4); }
  /* بادئة الفاتورة تُطبَّع (حروف لاتينية وأرقام فقط، كبيرة) حتى لا تكسر البحث أو تتكرر الأرقام لو كُتبت بحروف صغيرة أو بمسافة */
  function invoicePrefix(state) { return U().foldCode((state.settings && state.settings.invoicePrefix) || 'INV').replace(/[^A-Z0-9]/g, '') || 'INV'; }
  function nextInvoice(state, year) {
    const pfx = invoicePrefix(state);
    const re = new RegExp('^' + pfx + '-' + year + '-(\\d+)$');
    return pfx + '-' + year + '-' + U().pad(nextSeq(state, pfx + '-' + year, state.payments, re), 4);
  }

  const ORDINALS = { 'الارضي': 'G', 'الأرضي': 'G', 'ارضي': 'G', 'الاول': '1', 'الأول': '1', 'الثاني': '2', 'الثالث': '3', 'الرابع': '4', 'الخامس': '5', 'السادس': '6', 'السابع': '7', 'الثامن': '8', 'التاسع': '9', 'العاشر': '10' };
  /* تحليل اسم الوحدة كما يكتبه المكتب → { kind, num } لاستخدامه في الكود والدور */
  const AR_DIGITS = (t) => String(t == null ? '' : t).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const SUFFIX = { 'أ': 'A', 'ا': 'A', 'ب': 'B', 'ج': 'C', 'د': 'D', 'a': 'A', 'b': 'B', 'c': 'C', 'd': 'D' };
  function parseLabel(label) {
    const raw = AR_DIGITS(label).trim();
    const s = U().normalize(label);
    // «3.5» أو «3/5» ⇒ 3-5 (التطبيع يحذف النقطة فنقرأها من النص الخام)
    const dec = /^(\d+)\s*[./,]\s*(\d+)$/.exec(raw); if (dec) return { kind: 'num', num: dec[1] + '-' + dec[2] };
    // حرف لاتيني للنوع: G5 (جراج) · S2 (محل) · M1 (ميزان) · O12 (مكتب) · K3 (عيادة)
    const lat = /^([gsmok])\s*-?\s*(\d+)\s*([a-d])?$/i.exec(raw); if (lat) return { kind: lat[1].toUpperCase(), num: lat[2] + (lat[3] ? lat[3].toUpperCase() : '') };
    // «شقة 12 الدور 3» / «وحدة 7 طابق 2» ⇒ الرقم 12 والدور 3
    const ff = /^(?:شقه|وحده|شقة|وحدة)?\s*(\d+)\s*(?:ال)?(?:دور|طابق)\s*(\d+|\S+)$/.exec(s);
    if (ff) { const fl = /^\d+$/.test(ff[2]) ? ff[2] : (ORDINALS[Object.keys(ORDINALS).find(w => U().normalize(w) === ff[2]) || ''] || ''); return { kind: 'num', num: ff[1], floor: fl }; }
    // لاحقة حرفية: «12 ب» / «محل 2 أ» ⇒ 12B / S2A
    let suffix = ''; const sm = /^(.*\d)\s*([أاب جدabcd])$/.exec(s.replace(/\s+/g, ' '));
    if (sm && SUFFIX[sm[2]]) { suffix = SUFFIX[sm[2]]; }
    const digits = (s.match(/\d+/g) || []);
    const num = (digits.length ? digits.join('-') : '') + (digits.length ? suffix : '');
    if (/^\d+$/.test(s)) return { kind: 'num', num: s };
    if (sm && SUFFIX[sm[2]] && /^\d+ ?[أابجدabcd]$/.test(s)) return { kind: 'num', num };
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
    const implicit = base.endsWith('-') || /-(S|O|G|F|K|U)$/.test(base); // اسم بلا رقم («محل»، «جراج») ⇒ نرقّمه نحن
    if (implicit) base = base + '1';
    const used = new Set(state.units.map(u => U().foldCode(u.code)));
    if (!used.has(U().foldCode(base))) return base;
    if (implicit) { // «محل» مرتين = محل 1 ومحل 2 (الرقم من عندنا أصلًا)
      const stem = base.slice(0, -1); let n = 2; while (used.has(U().foldCode(stem + n))) n++; return stem + n;
    }
    // رقم صريح مكرر («304» بتهجئتين): لاحقة -2 -3 … دون المساس برقم الوحدة حتى لا يُسرق كود وحدة أخرى
    let n = 2; while (used.has(U().foldCode(base + '-' + n))) n++;
    return base + '-' + n;
  }
  /* استنتاج الدور من اسم الوحدة: 304 → 3، 1203 → 12، ميزان → M، محل → G (أرضي) */
  function inferFloor(label) {
    const p = parseLabel(label);
    if (p.floor) return p.floor;
    if (p.kind === 'num' && p.num) {
      const n = p.num.replace(/[A-D]$/, '').split('-')[0];
      if (!/^\d+$/.test(n)) return '';
      if (n.length >= 3) return String(parseInt(n.slice(0, -2), 10));
      if (n.length === 2) return n[0];
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
    if (/^[A-Z0-9]+-\d{4}-\d+$/.test(c)) return 'payments';
    return '';
  }
  E.Codes = { nextProject, nextClient, nextContract, nextMaintenance, nextInvoice, invoicePrefix, unitCode, parseLabel, inferFloor, inferType, kindOf };
})(window.Egary);
