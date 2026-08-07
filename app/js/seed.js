/* =========================================================
   بذرة البيانات
   ── المبنى الأول: تفريغ أمين لكشف «بيان عبدالمنعم سكرية»
      (Main received source data.xlsx — تغطية يناير–يونيو 2026)
      أي تناقض في الأصل لا يُخفى: يُفسَّر الأرجح ويُسجَّل نصّه
      في سجل جودة البيانات (issues).
   ── المبنيان الثاني والثالث: بيانات توضيحية مولَّدة (demo)
      لتجربة النظام كمحفظة متعددة الكشوف — تُحذف بزر واحد.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- المباني ---------- */
  const buildings = [
    { id: 'B1', name: 'بيان عبدالمنعم سكرية', owner: 'عبدالمنعم سكرية', area: 'الدقي — الجيزة', demo: false,
      note: 'الكشف الورقي المستلم — المصدر الفعلي' },
    { id: 'B2', name: 'برج النيل الإداري', owner: 'ورثة محمود النقيب', area: 'المهندسين — الجيزة', demo: true,
      note: 'بيانات توضيحية لتجربة تعدد الكشوف' },
    { id: 'B3', name: 'مركز الحرية التجاري', owner: 'شركة الحرية للاستثمار', area: 'الهرم — الجيزة', demo: true,
      note: 'بيانات توضيحية لتجربة تعدد الكشوف' },
  ];

  /* ---------- المبنى الأول: كما ورد في الكشف حرفيًا ---------- */
  const tenants = [
    { id: 'T1', name: 'صالون علاء',           kind: 'فرد',  phone: '', note: '' },
    { id: 'T2', name: 'حسام سنوسي',           kind: 'فرد',  phone: '', note: '' },
    { id: 'T3', name: 'الدقة',                kind: 'غير محدد', phone: '', note: 'مستأجر لأكثر من وحدة' },
    { id: 'T4', name: 'العنوان',              kind: 'غير محدد', phone: '', note: '' },
    { id: 'T5', name: 'عز الدين',             kind: 'فرد',  phone: '', note: '' },
    { id: 'T6', name: 'مصطفى عثمان',          kind: 'فرد',  phone: '', note: '' },
    { id: 'T7', name: 'علاء الدين محمد حافظ', kind: 'فرد',  phone: '', note: '' },
    { id: 'T8', name: 'تقوى عبدالمنعم',       kind: 'فرد',  phone: '', note: '' },
    { id: 'T9', name: 'غير مسجّل',            kind: 'غير محدد', phone: '', note: 'مستأجر جراج الهدم — الاسم غير وارد في الكشف' },
  ];

  const units = [
    { id: 'U1',  buildingId: 'B1', name: 'محل 1',   type: 'محل',      floor: '', area: null, note: 'ورد في الكشف باسم «محل» — رُقِّم مؤقتًا' },
    { id: 'U2',  buildingId: 'B1', name: 'محل 2',   type: 'محل',      floor: '', area: null, note: 'ورد في الكشف باسم «محل» — رُقِّم مؤقتًا' },
    { id: 'U3',  buildingId: 'B1', name: 'الميزان 1', type: 'غير محدد', floor: '', area: null, note: '' },
    { id: 'U4',  buildingId: 'B1', name: 'الميزان 2', type: 'غير محدد', floor: '', area: null, note: 'وردت في صفّين بمستأجرَين مختلفَين' },
    { id: 'U5',  buildingId: 'B1', name: 'الثاني',  type: 'غير محدد', floor: '', area: null, note: '' },
    { id: 'U6',  buildingId: 'B1', name: '41',      type: 'غير محدد', floor: '', area: null, note: '' },
    { id: 'U7',  buildingId: 'B1', name: '42',      type: 'غير محدد', floor: '', area: null, note: '' },
    { id: 'U8',  buildingId: 'B1', name: '61',      type: 'غير محدد', floor: '', area: null, note: '' },
    { id: 'U9',  buildingId: 'B1', name: 'سكرية',   type: 'غير محدد', floor: '', area: null, note: '' },
    { id: 'U10', buildingId: 'B1', name: 'جراج الهدم', type: 'جراج',  floor: '', area: null, note: 'بلا عقد ولا مستأجر مسجّل' },
    { id: 'U11', buildingId: 'B1', name: 'وحدة غير محددة', type: 'غير محدد', floor: '', area: null, note: 'وحدة تقوى عبدالمنعم — غير مذكورة في الكشف' },
  ];

  /* years[]: قيمة الإيجار مربوطة بسنة العقد لا بالسنة الميلادية.
     estimated: قيمة متوقعة (+10%) لم تُدوَّن في الكشف. */
  const contracts = [
    { id: 'C1', unitId: 'U1', tenantId: 'T1', start: '2025-05-01', end: '2027-04-30', prevId: null,
      dueDay: 1, maintenance: 0, vat: false,
      years: [
        { from: '2025-05-01', to: '2026-04-30', rent: 30500, estimated: false },
        { from: '2026-05-01', to: '2027-04-30', rent: 39000, estimated: false },
      ], deposit: null, source: 'imported' },
    { id: 'C2', unitId: 'U2', tenantId: 'T2', start: '2024-06-01', end: '2026-05-31', prevId: null,
      dueDay: 1, maintenance: 0, vat: false,
      years: [
        { from: '2024-06-01', to: '2025-05-31', rent: 12705, estimated: false },
        { from: '2025-06-01', to: '2026-05-31', rent: 12705, estimated: true },
      ], deposit: null, source: 'imported' },
    { id: 'C3', unitId: 'U2', tenantId: 'T2', start: '2026-06-01', end: '2027-05-31', prevId: 'C2',
      dueDay: 1, maintenance: 0, vat: false,
      years: [
        { from: '2026-06-01', to: '2027-05-31', rent: 30000, estimated: false },
      ], deposit: null, source: 'imported' },
    { id: 'C4', unitId: 'U3', tenantId: 'T3', start: '2024-05-20', end: '2027-05-20', prevId: null,
      dueDay: 20, maintenance: 0, vat: false,
      years: [
        { from: '2024-05-20', to: '2025-05-19', rent: 45100, estimated: false },
        { from: '2025-05-20', to: '2026-05-19', rent: 49610, estimated: false },
        { from: '2026-05-20', to: '2027-05-20', rent: 54571, estimated: true },
      ], deposit: null, source: 'imported' },
    { id: 'C5', unitId: 'U4', tenantId: 'T4', start: '2024-06-01', end: '2026-05-31', prevId: null,
      dueDay: 1, maintenance: 0, vat: false,
      years: [
        { from: '2024-06-01', to: '2025-05-31', rent: 41800, estimated: false },
        { from: '2025-06-01', to: '2026-05-31', rent: 41800, estimated: true },
      ], deposit: null, source: 'imported' },
    { id: 'C6', unitId: 'U4', tenantId: 'T4', start: '2026-06-01', end: '2028-05-31', prevId: 'C5',
      dueDay: 1, maintenance: 0, vat: false,
      years: [
        { from: '2026-06-01', to: '2027-05-31', rent: 69000, estimated: false },
        { from: '2027-06-01', to: '2028-05-31', rent: 75900, estimated: true },
      ], deposit: null, source: 'imported' },
    { id: 'C7', unitId: 'U5', tenantId: 'T3', start: '2024-03-01', end: '2027-02-28', prevId: null,
      dueDay: 1, maintenance: 0, vat: false,
      years: [
        { from: '2024-03-01', to: '2025-02-28', rent: 83600,  estimated: false },
        { from: '2025-03-01', to: '2026-02-28', rent: 91960,  estimated: false },
        { from: '2026-03-01', to: '2027-02-28', rent: 101156, estimated: true },
      ], deposit: null, source: 'imported' },
    { id: 'C8', unitId: 'U6', tenantId: 'T5', start: '2026-01-15', end: '2027-01-14', prevId: null,
      dueDay: 15, maintenance: 0, vat: false,
      years: [
        { from: '2026-01-15', to: '2027-01-14', rent: 36000, estimated: false },
      ], deposit: { amount: 35000, status: 'held', note: 'الوحيد المسجّل في الكشف' }, source: 'imported' },
    { id: 'C9', unitId: 'U7', tenantId: 'T3', start: '2023-08-01', end: '2026-07-30', prevId: null,
      dueDay: 1, maintenance: 0, vat: false,
      years: [
        { from: '2023-08-01', to: '2024-07-31', rent: 27500, estimated: false },
        { from: '2024-08-01', to: '2025-07-31', rent: 30250, estimated: false },
        { from: '2025-08-01', to: '2026-07-30', rent: 33275, estimated: true },
      ], deposit: null, source: 'imported' },
    { id: 'C10', unitId: 'U8', tenantId: 'T6', start: '2026-04-01', end: '2027-03-31', prevId: null,
      dueDay: 1, maintenance: 0, vat: false,
      years: [
        { from: '2026-04-01', to: '2027-03-31', rent: 25325, estimated: false },
      ], deposit: null, source: 'imported' },
    { id: 'C11', unitId: 'U8', tenantId: 'T6', start: '2027-04-01', end: '2028-03-31', prevId: 'C10',
      dueDay: 1, maintenance: 0, vat: false,
      years: [
        { from: '2027-04-01', to: '2028-03-31', rent: 40000, estimated: false },
      ], deposit: null, source: 'imported' },
    { id: 'C12', unitId: 'U11', tenantId: 'T8', start: '2025-10-01', end: '2026-09-30', prevId: null,
      dueDay: 1, maintenance: 0, vat: false,
      years: [
        { from: '2025-10-01', to: '2026-09-30', rent: 66000, estimated: false },
      ], deposit: null, source: 'imported' },
  ];

  /* علامات الكشف المستوردة: mark = 'paid' (✓) أو 'unpaid' (✗). */
  const marks = [];
  const putMarks = (unitId, months, mark) =>
    months.forEach(m => marks.push({ unitId, period: '2026-' + String(m).padStart(2, '0'), mark }));
  const H1 = [1, 2, 3, 4, 5, 6];
  ['U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U8', 'U10'].forEach(u => putMarks(u, H1, 'paid'));
  putMarks('U9', H1, 'unpaid');       // علاء الدين محمد حافظ — ستة أشهر ✗
  putMarks('U11', [4, 5, 6], 'paid'); // تقوى — يناير–مارس بلا علامة أصلًا

  const payments = [];
  const complaints = [];

  /* =========================================================
     المبنيان التوضيحيان — توليد حتمي (بذرة ثابتة، نفس النتيجة كل مرة)
     أنماط سداد: A منتظم · B يدفع متأخرًا · C متعثر جزئيًا · D متوقف
     ========================================================= */
  let _s = 20260803;
  const rnd = () => ((_s = (_s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = a => a[Math.floor(rnd() * a.length)];

  let un = 100, tn = 100, cn = 100, pn = 1000;
  const NOW = '2026-08';

  function periodAdd(p, n) {
    const [y, m] = p.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1 + n, 1));
    return t.getUTCFullYear() + '-' + String(t.getUTCMonth() + 1).padStart(2, '0');
  }
  function yearsFrom(startIso, nYears, rent0, incPct) {
    const out = []; let r = rent0, from = startIso;
    for (let i = 0; i < nYears; i++) {
      const [y, m, dd] = from.split('-').map(Number);
      const to = new Date(Date.UTC(y + 1, m - 1, dd)); to.setUTCDate(to.getUTCDate() - 1);
      out.push({ from, to: to.toISOString().slice(0, 10), rent: Math.round(r / 50) * 50, estimated: false });
      from = new Date(Date.UTC(y + 1, m - 1, dd)).toISOString().slice(0, 10);
      r *= 1 + incPct;
    }
    return out;
  }

  function demoUnit(bid, def) {
    // def: {n,t,f,a, vac, start:'YYYY-MM-DD', yrs, r, dd, mnt, vat, prof, endSoon, ended, renewedAt, tname, tkind}
    const uid = 'U' + (++un);
    units.push({ id: uid, buildingId: bid, name: def.n, type: def.t, floor: def.f || '', area: def.a || null, note: '' });
    if (def.vac) return;
    const tid = 'T' + (++tn);
    tenants.push({
      id: tid, name: def.tname, kind: def.tkind || 'فرد',
      phone: '01' + pick(['0', '1', '2']) + String(ri(10000000, 99999999)), note: '',
    });
    const mkC = (start, nY, r0, prevId) => {
      const cid = 'C' + (++cn);
      const years = yearsFrom(start, nY, r0, 0.10);
      contracts.push({
        id: cid, unitId: uid, tenantId: tid, start, end: years[years.length - 1].to,
        prevId: prevId || null, dueDay: def.dd || 1,
        maintenance: def.mnt || 0, vat: !!def.vat,
        years, deposit: { amount: Math.round(r0 * 2 / 100) * 100, status: 'held', note: '' },
        source: 'entered',
      });
      return contracts[contracts.length - 1];
    };
    let cList = [];
    if (def.renewedAt) {
      const c1 = mkC(def.start, def.renewedAt, def.r);
      const start2 = periodAdd(c1.end.slice(0, 7), 1) + '-01';
      const c2 = mkC(start2, 2, def.r * 1.15, c1.id);
      cList = [c1, c2];
    } else {
      cList = [mkC(def.start, def.yrs || 3, def.r)];
    }
    // توليد الدفعات من يناير 2025 (أو بداية العقد إن كانت أحدث) حتى اليوم
    const prof = def.prof || 'A';
    for (const c of cList) {
      let p = c.start.slice(0, 7) < '2025-01' ? '2025-01' : c.start.slice(0, 7);
      for (; p <= NOW && p <= c.end.slice(0, 7); p = periodAdd(p, 1)) {
        if (p === NOW) break; // شهر أغسطس الجاري لم يستحق سداده بعد في العرض
        const y = c.years.find(v => v.from.slice(0, 7) <= p && p <= v.to.slice(0, 7)) || c.years[0];
        let total = y.rent + (c.maintenance || 0);
        if (c.vat) total = Math.round(total * 1.14);
        let amount = total, dayOff = ri(0, 2), skip = false;
        if (prof === 'B') dayOff = ri(9, 18);
        if (prof === 'C') {
          if (p >= '2026-06') skip = true;
          else if (p === '2026-05') { amount = Math.round(total * 0.6 / 100) * 100; dayOff = ri(3, 9); }
        }
        if (prof === 'D' && p >= '2026-03') skip = true;
        if (skip) continue;
        const dd = Math.min(28, (c.dueDay || 1) + dayOff);
        payments.push({
          id: 'P' + (++pn), contractId: c.id, unitId: uid, period: p,
          amount, date: p + '-' + String(dd).padStart(2, '0'),
          method: pick(['نقدًا', 'نقدًا', 'إنستاباي', 'تحويل بنكي', 'شيك']),
          receiptNo: 'R-' + p.slice(2, 4) + p.slice(5, 7) + '-' + ri(100, 999),
          notes: '', source: 'entered',
        });
      }
    }
  }

  /* برج النيل الإداري — B2 */
  demoUnit('B2', { n: 'محل 1', t: 'محل', f: 'أرضي', a: 52, start: '2025-01-01', yrs: 3, r: 38000, dd: 1, mnt: 1200, vat: true, prof: 'A', tname: 'مطعم بيت الكشري', tkind: 'شركة' });
  demoUnit('B2', { n: 'محل 2', t: 'محل', f: 'أرضي', a: 44, start: '2024-07-01', renewedAt: 2, r: 31000, dd: 1, prof: 'A', tname: 'صيدلية الرحمة', tkind: 'شركة' });
  demoUnit('B2', { n: 'مكتب 101', t: 'مكتب', f: 'الأول', a: 96, start: '2025-03-01', yrs: 3, r: 42000, dd: 1, mnt: 1500, prof: 'B', tname: 'مكتب النخبة للمحاماة', tkind: 'شركة' });
  demoUnit('B2', { n: 'مكتب 102', t: 'مكتب', f: 'الأول', a: 88, start: '2024-11-01', yrs: 2, r: 36000, dd: 10, prof: 'A', endSoon: true, tname: 'شركة أوج للبرمجيات', tkind: 'شركة' });
  demoUnit('B2', { n: 'مكتب 201', t: 'مكتب', f: 'الثاني', a: 140, start: '2025-06-01', yrs: 3, r: 61000, dd: 1, mnt: 2000, vat: true, prof: 'A', tname: 'مركز نبض للأشعة', tkind: 'شركة' });
  demoUnit('B2', { n: 'مكتب 202', t: 'مكتب', f: 'الثاني', a: 76, start: '2026-02-01', yrs: 2, r: 33000, dd: 1, prof: 'C', tname: 'أكاديمية نون التعليمية', tkind: 'شركة' });
  demoUnit('B2', { n: 'شقة 301', t: 'شقة', f: 'الثالث', a: 128, start: '2025-09-01', yrs: 3, r: 29000, dd: 5, prof: 'A', tname: 'ياسر عبد اللطيف', tkind: 'فرد' });
  demoUnit('B2', { n: 'شقة 302', t: 'شقة', f: 'الثالث', a: 124, start: '2026-04-01', yrs: 2, r: 31500, dd: 1, prof: 'A', tname: 'هشام الجندي', tkind: 'فرد' });
  demoUnit('B2', { n: 'شقة 401', t: 'شقة', f: 'الرابع', a: 160, start: '2024-09-01', yrs: 3, r: 37000, dd: 15, prof: 'B', tname: 'شريف قنديل', tkind: 'فرد' });
  demoUnit('B2', { n: 'مخزن ب1', t: 'مخزن', f: 'أرضي', a: 64, vac: true });

  /* مركز الحرية التجاري — B3 */
  demoUnit('B3', { n: 'محل أ', t: 'محل', f: 'أرضي', a: 60, start: '2025-02-01', yrs: 3, r: 44000, dd: 1, mnt: 1000, vat: true, prof: 'A', tname: 'متجر لمسة للأثاث', tkind: 'شركة' });
  demoUnit('B3', { n: 'محل ب', t: 'محل', f: 'أرضي', a: 55, start: '2024-08-01', renewedAt: 2, r: 39000, dd: 1, prof: 'A', tname: 'شركة برق للشحن', tkind: 'شركة' });
  demoUnit('B3', { n: 'محل ج', t: 'محل', f: 'أرضي', a: 33, vac: true });
  demoUnit('B3', { n: 'ميزانين 1', t: 'مكتب', f: 'ميزانين', a: 120, start: '2025-05-01', yrs: 3, r: 35000, dd: 1, prof: 'A', tname: 'معمل تحاليل الدقة الطبية', tkind: 'شركة' });
  demoUnit('B3', { n: 'ميزانين 2', t: 'مكتب', f: 'ميزانين', a: 115, start: '2025-10-01', yrs: 2, r: 33500, dd: 15, prof: 'D', tname: 'ستوديو ريم للتصوير', tkind: 'شركة' });
  demoUnit('B3', { n: 'مكتب 1أ', t: 'مكتب', f: 'الأول', a: 105, start: '2025-01-01', yrs: 3, r: 38000, dd: 1, mnt: 800, prof: 'A', tname: 'مكتب هندسي — م. سعيد حجازي', tkind: 'شركة' });
  demoUnit('B3', { n: 'عيادة 3أ', t: 'مكتب', f: 'الثالث', a: 86, start: '2026-03-01', yrs: 3, r: 31000, dd: 1, prof: 'A', tname: 'عيادات صفا التخصصية', tkind: 'شركة' });
  demoUnit('B3', { n: 'مخزن م1', t: 'مخزن', f: 'أرضي', a: 70, start: '2024-07-01', yrs: 2, r: 16000, dd: 1, prof: 'A', tname: 'شركة الوفاق للتوريدات', tkind: 'شركة' });

  /* عقد ينتهي قريبًا (مكتب 102): قصّ نهايته إلى خلال 90 يومًا */
  (function () {
    const c = contracts.find(c => c.unitId === units.find(u => u.name === 'مكتب 102' && u.buildingId === 'B2').id);
    if (c) { c.end = '2026-10-31'; c.years[c.years.length - 1].to = '2026-10-31'; }
  })();

  /* شكاوى توضيحية */
  const KCATS = [
    ['سباكة', 'تسريب في حمام الوحدة'], ['كهرباء', 'انقطاع في لوحة الكهرباء'],
    ['تشطيبات', 'باب لا يغلق بإحكام'], ['مصاعد ومرافق', 'الأسانسير متوقف'],
    ['سباكة', 'ضعف ضغط المياه'], ['تكييف', 'وحدة التكييف لا تبرّد'],
  ];
  let kn = 0;
  function demoComplaint(unitName, bid, openedAt, ci, closed, cost, borneBy) {
    const u = units.find(x => x.name === unitName && x.buildingId === bid);
    if (!u) return;
    const c = contracts.find(x => x.unitId === u.id);
    complaints.push({
      id: 'K' + (++kn), unitId: u.id, tenantId: c ? c.tenantId : null,
      openedAt, category: KCATS[ci][0], desc: KCATS[ci][1],
      status: closed ? 'closed' : 'open', cost: cost || 0,
      borneBy: borneBy || 'المالك',
      closedAt: closed ? periodAdd(openedAt.slice(0, 7), 0) + '-' + String(Math.min(28, Number(openedAt.slice(8)) + closed)).padStart(2, '0') : null,
    });
  }
  demoComplaint('مكتب 101', 'B2', '2026-06-14', 0, 6, 1800, 'المالك');
  demoComplaint('محل 1',   'B2', '2026-07-02', 1, 3, 900, 'المالك');
  demoComplaint('شقة 401', 'B2', '2026-07-19', 2, 9, 2500, 'المستأجر');
  demoComplaint('مكتب 201','B2', '2026-07-28', 3, 0);
  demoComplaint('محل أ',   'B3', '2026-06-25', 4, 4, 700, 'المالك');
  demoComplaint('ميزانين 1','B3', '2026-07-30', 5, 0);
  demoComplaint('مكتب 1أ', 'B3', '2026-05-11', 2, 12, 3200, 'مشترك');

  /* =========================================================
     التجميعة النهائية
     ========================================================= */
  window.SEED = {
    version: 4,
    meta: {
      sourceName: 'بيان عبدالمنعم سكرية — الكشف الورقي المفرّغ',
      importCoverage: { buildingId: 'B1', from: '2026-01', to: '2026-06' },
      importedAt: '2026-08-02',
    },
    settings: {
      // سؤال مفتوح للعميل: أرقام أعمدة (1/2/3) شهرية أم سنوية؟
      // مبدئيًا «شهري» — تأمين «41» (35,000) يقارب شهرًا واحدًا من 36,000، وهو العرف.
      rentBasis: 'monthly',
      rentBasisConfirmed: false,
      defaultIncreasePct: 10,
      graceDays: 5,
      vatPct: 14,
    },
    buildings, tenants, units, contracts, marks, payments, complaints,
    log: [
      { at: '2026-08-02 10:20', txt: 'استيراد كشف «بيان عبدالمنعم سكرية» (يناير–يونيو 2026) — 12 صفًا، 25 ملاحظة جودة' },
      { at: '2026-08-02 10:05', txt: 'إنشاء الحساب وإضافة المشاريع' },
    ],

    /* سجل جودة البيانات — كل ملاحظة بمصدرها الحرفي وقرار التفسير */
    issues: [
      { id: 'Q1', severity: 'critical', refType: 'unit', refId: 'U9', status: 'open',
        title: 'سكرية: ستة أشهر غير مسدَّدة ولا يوجد عقد مسجّل',
        detail: 'صف «علاء الدين محمد حافظ» كل شهوره ✗ من يناير إلى يونيو بلا أي بيانات عقد أو قيمة إيجار. المتأخرات مؤكدة الوجود لكن قيمتها غير قابلة للحساب من الكشف.',
        action: 'إحضار عقد الوحدة أو تحديد القيمة المتفق عليها لتسجيل المتأخرات بقيمتها.' },
      { id: 'Q2', severity: 'critical', refType: 'unit', refId: 'U4', status: 'open',
        title: 'الميزان 2 واردة في صفّين لمستأجرَين مختلفَين',
        detail: 'صفّ باسم «الدقة» وصفّ باسم «العنوان» وكلاهما على نفس الوحدة وعليهما ✓ من يناير إلى يونيو — لا يمكن أن يسدِّد اثنان لوحدة واحدة. اعتُمدت بيانات صف «العنوان» لوجود عقود به.',
        action: 'تحديد المستأجر الفعلي للوحدة، وتوضيح علاقة «الدقة» بها.' },
      { id: 'Q3', severity: 'critical', refType: 'contract', refId: 'C10', status: 'open',
        title: '61: تواريخ العقد الأصلية متناقضة (النهاية قبل البداية)',
        detail: 'المدوَّن حرفيًا: من «2026/4/1 و2028/4/1» إلى «2026/3/31 و2027/3/31». فُسِّر الأرجح: عقد 2026/4/1 حتى 2027/3/31 بقيمة 25,325 وتجديد 2027/4/1 حتى 2028/3/31 بقيمة 40,000.',
        action: 'مراجعة أصل عقد مصطفى عثمان لتأكيد المدد والقيمتين (القفزة 58٪ خارج نمط الزيادة 10٪).' },
      { id: 'Q4', severity: 'high', refType: 'contract', refId: 'C10', status: 'open',
        title: '61: سداد يناير–مارس سابق لبداية العقد المفسَّرة',
        detail: 'العلامات ✓ من يناير مع أن العقد المفسَّر يبدأ 2026/4/1 — يُرجَّح وجود عقد أقدم غير مدوَّن في الكشف.',
        action: 'التأكد من وجود عقد سابق للوحدة 61 وإدخاله.' },
      { id: 'Q5', severity: 'high', refType: 'contract', refId: 'C1', status: 'open',
        title: 'محل 1 (صالون علاء): مدة سنة واحدة مدوَّنة مقابل قيمتَي سنتين',
        detail: 'المدوَّن: من 2025/5/1 إلى 2026/4/30 مع قيمتين 30,500 و39,000. فُسِّر عقد سنتين حتى 2027/4/30. الزيادة 27.9٪ خارج نمط الـ10٪ المعتاد.',
        action: 'مراجعة أصل العقد: هل المدة سنتان فعلًا؟ وهل القيمة الثانية 39,000 صحيحة؟' },
      { id: 'Q6', severity: 'high', refType: 'unit', refId: 'U10', status: 'open',
        title: 'جراج الهدم: سداد منتظم بلا عقد ولا مستأجر مسجّل',
        detail: 'المدوَّن حرفيًا: «جراج الهدم» في عمود اسم العميل وعمود الوحدة فارغ — كصف تقوى عبدالمنعم تمامًا — مع ✓ ستة أشهر وقيمة 9,000 بلا أي تواريخ عقد. فُسِّر الاسم اسمَ وحدة (جراج) لا اسمَ شخص، فسُجِّلت وحدة «جراج الهدم» ومستأجر «غير مسجّل». التفريغ يصنّف هذا الصف «خارج ترتيب الجدول — ثقة منخفضة جدًا». لا يُحتسب ضمن الإشغال الموثَّق ولا المستحقات إلى أن يُسجَّل عقد.',
        action: 'تسجيل اسم المستأجر وبيانات الاتفاق (القيمة 9,000 شهري؟ سنوي؟ ومنذ متى؟).' },
      { id: 'Q7', severity: 'high', refType: 'contract', refId: 'C12', status: 'open',
        title: 'تقوى عبدالمنعم: يناير–مارس داخل مدة العقد بلا أي علامة',
        detail: 'العقد من 2025/10/1 والعلامات تبدأ من أبريل. الورق لا يفرِّق بين «متأخر» و«لم يُسجَّل» — الأشهر الثلاثة معلَّمة في النظام «غير موثَّق» لحين الحسم.',
        action: 'الحسم: هل يناير–مارس مسدَّدة (تُوثَّق) أم متأخرات (تُسجَّل بقيمتها 3 × 66,000)؟' },
      { id: 'Q8', severity: 'high', refType: 'unit', refId: 'U11', status: 'open',
        title: 'وحدة تقوى عبدالمنعم غير مذكورة في الكشف',
        detail: 'الصف الأخير فيه عقد وقيمة 66,000 بلا اسم وحدة. أُنشئت وحدة مؤقتة باسم «وحدة غير محددة».',
        action: 'تحديد الوحدة الفعلية وربط العقد بها.' },
      { id: 'Q9', severity: 'high', refType: 'contract', refId: 'C5', status: 'open',
        title: 'الميزان 2: قيمة «6,000» غير مفسَّرة',
        detail: 'المدوَّن في عمود السنة الأولى سطران: «41,800» و«6,000». الـ41,800 قيمة العقد الأول والـ69,000 قيمة التجديد — أما 6,000 فقد تكون صيانة شهرية (البند الرابع) أو خطأ قراءة من الصورة. كما افتُرض ثبات قيمة السنة الثانية للعقد الأول (41,800) لعدم تدوين غيرها — كافتراض «محل 2».',
        action: 'مراجعة الأصل: ما دلالة 6,000؟ وتأكيد قيمة السنة الثانية.' },
      { id: 'Q23', severity: 'medium', refType: 'contract', refId: 'C6', status: 'open',
        title: 'الميزان 2: قيمة السنة الثانية للتجديد غير مدوَّنة — قُدِّرت 75,900 (+10٪)',
        detail: 'الكشف يدوِّن 69,000 فقط لتجديد سنتين 2026/6/1 حتى 2028/5/31. قُدِّرت السنة الثانية بزيادة 10٪ وفق النمط العام — علمًا بأن الحالة المماثلة في «محل 2» فُسِّرت بثبات القيمة (Q12).',
        action: 'تأكيد قيمة السنة الثانية من أصل عقد التجديد.' },
      { id: 'Q24', severity: 'low', refType: 'global', refId: null, status: 'open',
        title: 'الخانة البرتقالية الغامضة في التفريغ: تبيَّن من صورة الورقة أنها عنوان الكشف',
        detail: 'شيت «درجة الثقة» ظنّها عمود بيانات («بيان/عهدة»). صورة الورقة الفعلية توضح أنها خانة عنوان الكشف نفسه: «بيان / عبدالمنعم سكرية» — ليست عمود بيانات مفقودًا. كما تُظهر الصورة تظليلات ملوّنة على بعض الشهور (يُرجَّح أنها «آخر شهر بسعر السنة» أو مواضع انتباه) — اللون في الورق يحمل معنى يضيع بالنسخ.',
        action: 'تأكيد دلالة التظليلات الملوّنة على الشهور مع كاتب الورقة، وقيد أي معنى منها في النظام كبيانات صريحة.' },
      { id: 'Q25', severity: 'low', refType: 'global', refId: null, status: 'open',
        title: 'علامات الشهور المستوردة عدُّها تقريبي والصفان الأخيران منخفضا الثقة',
        detail: 'شيت «درجة الثقة»: «عدد العلامات في كل صف تقريبي — يُفضّل عدّها على الأصل»، والصفان 11 و12 (جراج الهدم وتقوى) «مكتوبان خارج ترتيب الجدول وبخط مختلف — ثقة منخفضة جدًا». كل علامات ✓/✗ المستوردة خاضعة لهذا التحفظ حتى تُراجَع على الورقة الأصلية.',
        action: 'مراجعة العلامات على أصل الورقة مرة واحدة عند التوثيق.' },
      { id: 'Q10', severity: 'medium', refType: 'contract', refId: 'C3', status: 'open',
        title: 'محل 2: نهاية التجديد المدوَّنة 2027/5/21 — الأرجح 2027/5/31',
        detail: 'شيت «درجة الثقة» في التفريغ يصنّف قراءة التواريخ منخفضة الثقة. اعتُمد 2027/5/31 (سنة كاملة) مع تسجيل الأصل هنا.',
        action: 'تأكيد التاريخ من أصل العقد.' },
      { id: 'Q11', severity: 'medium', refType: 'contract', refId: 'C7', status: 'open',
        title: 'الثاني: نهاية العقد المدوَّنة 2027/2/25 — الأرجح 2027/2/28',
        detail: 'ثلاث سنوات كاملة من 2024/3/1 تنتهي 2027/2/28. اعتُمد 2027/2/28 مع تسجيل الأصل هنا.',
        action: 'تأكيد التاريخ من أصل العقد.' },
      { id: 'Q12', severity: 'medium', refType: 'contract', refId: 'C2', status: 'open',
        title: 'محل 2: عقد سنتين بقيمة واحدة مدوَّنة',
        detail: 'المدوَّن 12,705 فقط لعقد 2024/6/1 حتى 2026/5/31. افتُرض ثبات القيمة في السنة الثانية.',
        action: 'تأكيد قيمة السنة الثانية.' },
      { id: 'Q13', severity: 'medium', refType: 'contract', refId: 'C4', status: 'open',
        title: 'الميزان 1: قيمة السنة الثالثة غير مدوَّنة — قُدِّرت 54,571 (+10٪)',
        detail: 'السنتان الأوليان 45,100 ثم 49,610 (+10٪). السنة الثالثة (من 2026/5/20) غير مدوَّنة، والاستحقاق الجاري محسوب على قيمة تقديرية.',
        action: 'إدخال القيمة الفعلية للسنة الثالثة من العقد.' },
      { id: 'Q14', severity: 'medium', refType: 'contract', refId: 'C7', status: 'open',
        title: 'الثاني: قيمة السنة الثالثة غير مدوَّنة — قُدِّرت 101,156 (+10٪)',
        detail: 'الاستحقاق الجاري منذ مارس 2026 محسوب على قيمة تقديرية.',
        action: 'إدخال القيمة الفعلية للسنة الثالثة من العقد.' },
      { id: 'Q15', severity: 'medium', refType: 'contract', refId: 'C9', status: 'open',
        title: '42: قيمة السنة الثالثة غير مدوَّنة — قُدِّرت 33,275 (+10٪)',
        detail: 'كامل سنة 2025/8 حتى 2026/7 محسوبة على قيمة تقديرية، وهي فترة انتهت بالفعل.',
        action: 'إدخال القيمة الفعلية للسنة الثالثة من العقد.' },
      { id: 'Q16', severity: 'high', refType: 'contract', refId: 'C9', status: 'open',
        title: '42: العقد انتهى 2026/7/30 ولا يوجد تجديد مسجّل',
        detail: 'انتهت مدة عقد «الدقة» للوحدة 42 ولم يُدوَّن تجديد — الوحدة الآن بلا عقد نشط.',
        action: 'الحسم: هل جُدِّد العقد؟ إن لم يُجدَّد فالوحدة شاغرة ويجب استرداد أو تسوية التأمين إن وُجد.' },
      { id: 'Q17', severity: 'medium', refType: 'global', refId: null, status: 'open',
        title: 'التأمينات مسجَّلة لعقد واحد فقط من 12 (الكشف الحقيقي)',
        detail: 'الكشف يذكر تأمينًا واحدًا (35,000 للوحدة 41). قيم تأمين باقي العقود غير معروفة رغم أنها التزام مالي يجب أن يظهر.',
        action: 'حصر تأمينات كل العقود القائمة وإدخالها.' },
      { id: 'Q18', severity: 'medium', refType: 'global', refId: null, status: 'open',
        title: 'الصيانة الشهرية غير مسجَّلة رغم نصّ البند الرابع',
        detail: 'البند الرابع في العقد ينصّ على مقابل صيانة شهري يُسدَّد مع الإيجار، ولا أثر له في الكشف. (النظام جاهز: خانة صيانة في كل عقد تدخل الاستحقاق تلقائيًا.)',
        action: 'تحديد قيمة الصيانة لكل وحدة.' },
      { id: 'Q19', severity: 'medium', refType: 'global', refId: null, status: 'open',
        title: 'ضريبة القيمة المضافة: غير محدَّد مَن الخاضع لها',
        detail: 'البند العاشر يُحمِّل المستأجر الضريبة. يلزم تحديد العقود الخاضعة لتظهر في الاستحقاق والإيصالات. (النظام جاهز: علامة خضوع في كل عقد.)',
        action: 'حصر المستأجرين الخاضعين للضريبة.' },
      { id: 'Q20', severity: 'low', refType: 'global', refId: null, status: 'open',
        title: 'تواريخ تسليم الوحدات غير مسجَّلة',
        detail: 'بدونها لا يمكن حساب مؤشر «الشكاوى خلال 30 يومًا من التسليم».',
        action: 'إدخال تاريخ التسليم لكل وحدة.' },
      { id: 'Q21', severity: 'low', refType: 'global', refId: null, status: 'open',
        title: 'بيانات التواصل غائبة بالكامل (الكشف الحقيقي)',
        detail: 'لا هاتف ولا رقم بطاقة لأي مستأجر — لازمة للتنبيهات وللتوثيق القانوني.',
        action: 'استكمال بيانات المستأجرين.' },
      { id: 'Q22', severity: 'high', refType: 'global', refId: null, status: 'open',
        title: 'أرقام الإيجار شهرية أم سنوية؟ — عقد العينة يحسمها «شهريًا»',
        detail: 'البند الثالث في عقد العينة ينص حرفيًا: «القيمة الإيجارية للمكان … جنيه شهريًا (فقط لا غير) شهريًا»، والبند الخامس: التأمين «بواقع شهر» (يطابق 41: تأمين 35,000 ≈ شهر من 36,000). النظام محسوب على «شهري». يتبقى التأكيد أن كل العقود على نفس النموذج.',
        action: 'تأكيد أن جميع العقود بنفس نموذج العينة، ثم تعليم «تم التأكيد» في الإعدادات.' },
    ],
  };
})();
