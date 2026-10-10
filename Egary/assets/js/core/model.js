/* =====================================================================
   model.js — تعريف الكيانات، القوائم الثابتة، الحالة الفارغة، والتحقق
   كل التواريخ 'YYYY-MM-DD'، الشهور 'YYYY-MM'، المبالغ أرقام بالجنيه.
   ===================================================================== */
window.Egary = window.Egary || {};
(function (E) {
  'use strict';

  const UNIT_TYPES = [
    { key: 'commercial', ar: 'تجارية' },
    { key: 'residential', ar: 'سكنية' },
    { key: 'admin', ar: 'إدارية' },
    { key: 'garage', ar: 'جراج' },
  ];
  const CLIENT_KINDS = [{ key: 'person', ar: 'فرد' }, { key: 'company', ar: 'شركة' }];
  const DEPOSIT_STATUS = [
    { key: 'held', ar: 'محتفظ به' }, { key: 'returned', ar: 'مردود' }, { key: 'deducted', ar: 'مخصوم' }, { key: 'none', ar: 'بدون تأمين' },
  ];
  const PAY_METHODS = [
    { key: 'cash', ar: 'نقدي' }, { key: 'transfer', ar: 'تحويل بنكي' }, { key: 'cheque', ar: 'شيك' }, { key: 'instapay', ar: 'إنستاباي' }, { key: 'other', ar: 'أخرى' },
  ];
  const MAINT_KINDS = [
    { key: 'plumbing', ar: 'سباكة' }, { key: 'electric', ar: 'كهرباء' }, { key: 'ac', ar: 'تكييف' }, { key: 'paint', ar: 'دهانات' }, { key: 'carpentry', ar: 'نجارة' }, { key: 'elevator', ar: 'مصعد' }, { key: 'cleaning', ar: 'نظافة' }, { key: 'other', ar: 'أخرى' },
  ];
  const BORNE_BY = [{ key: 'owner', ar: 'المالك' }, { key: 'tenant', ar: 'المستأجر' }, { key: 'shared', ar: 'مناصفة' }];
  const MAINT_STATUS = [{ key: 'open', ar: 'مفتوحة' }, { key: 'closed', ar: 'مغلقة' }];
  /* قائمة الأصول الافتراضية التي تظهر كخانات اختيار عند تسجيل الوحدة */
  const ASSET_CATALOG = ['تكييف', 'فرش', 'مطبخ', 'سخان', 'عداد كهرباء', 'عداد مياه', 'عداد غاز', 'إنترنت / تليفون', 'ستائر', 'أجهزة كهربائية', 'إنتركم / باب أمان', 'موقف سيارة'];

  const label = (list, key) => { const f = list.find(x => x.key === key); return f ? f.ar : (key || ''); };
  const keyOf = (list, ar) => { const n = String(ar || '').trim(); const f = list.find(x => x.ar === n || x.key === n); return f ? f.key : ''; };

  function emptyState() {
    return {
      meta: { version: 2, officeName: 'إيجاري', createdAt: '', lastWriteAt: '', source: '' },
      settings: {
        graceDays: 5,            // أيام السماح بعد يوم الاستحقاق قبل اعتبار الشهر متأخرًا
        dueDay: 1,               // يوم الاستحقاق الافتراضي داخل الشهر
        vacancyMonths: 3,        // عتبة «شاغرة طويلًا»
        trackingFrom: '2026-01', // أول شهر تُحاسَب عليه العقود (بداية الورقة)
        defaultIncreasePct: 10,
        ledgerYears: [2026],     // أوراق السنوات الموجودة في الإكسيل
        invoicePrefix: 'INV',
        codeSeq: {},             // أعلى رقم تسلسلي صدر لكل نوع كود (لا يُعاد استخدام كود محذوف): { P, C, T, M, 'INV-2026' }
        currency: 'ج',
        enteredThrough: '',      // آخر شهر مكتمل التسجيل في الورقة ('' = يُكتشف تلقائيًا)
        tolerancePct: 0.5,       // فرق مقبول بين المسدَّد والمستحق (٪ من المستحق) قبل اعتبار الشهر جزئيًا
        toleranceMin: 50,        // وبحد أدنى بالجنيه (تقريب المكتب للكسور)
        prorationBasis: '30',    // الشهر المقطوع يُحسب على 30 يومًا كما يفعل المكتب ('actual' = بالأيام الفعلية)
      },
      projects: [], units: [], clients: [], contracts: [], payments: [], maintenance: [],
      users: [],  // حسابات الدخول (كلمة المرور مشفّرة)
      audit: [],
      flags: [], // ملاحظات جودة البيانات المكتشفة عند القراءة (محسوبة، لا تُحفظ)
    };
  }

  /* قوالب السجلات (كل الحقول موجودة دائمًا حتى تبقى الأوراق متّسقة) */
  const blank = {
    projects: () => ({ code: '', name: '', address: '', area: '', notes: '', createdAt: '' }),
    units: () => ({ code: '', projectCode: '', label: '', type: 'admin', floor: '', area: '', notes: '', assets: [], createdAt: '' }),
    clients: () => ({ code: '', name: '', kind: 'person', rep: '', nationalId: '', taxId: '', phone: '', phone2: '', email: '', address: '', notes: '', createdAt: '' }),
    contracts: () => ({ code: '', unitCode: '', clientCode: '', start: '', end: '', rent: 0, increasePct: 0, rentOverrides: {}, deposit: 0, depositStatus: 'none', dueDay: 1, prevCode: '', notes: '', inferred: false, createdAt: '' }),
    payments: () => ({ code: '', contractCode: '', period: '', amount: 0, paidOn: '', method: 'cash', ref: '', notes: '', source: 'web', createdAt: '' }),
    maintenance: () => ({ code: '', unitCode: '', date: '', kind: 'other', description: '', cost: 0, borneBy: 'owner', status: 'open', closedOn: '', notes: '', custodianContract: '', custodianName: '', createdAt: '' }),
    users: () => ({ code: '', name: '', role: 'staff', passwordHash: '', enabled: true, createdAt: '', lastLogin: '' }),
  };
  const ENTITIES = Object.keys(blank);
  const ENTITY_AR = { projects: 'مشروع', units: 'وحدة', clients: 'عميل', contracts: 'عقد', payments: 'دفعة', maintenance: 'صيانة', users: 'مستخدم' };

  /* تحقق بسيط يعيد قائمة أخطاء بالعربية (فارغة = سليم) */
  function validate(entity, r, state) {
    const errs = [];
    const need = (cond, msg) => { if (!cond) errs.push(msg); };
    const U = E.U;
    switch (entity) {
      case 'projects':
        need(r.name && r.name.trim(), 'اسم المشروع مطلوب');
        need(!state || !state.projects.some(p => p.code !== r.code && U.normalize(p.name) === U.normalize(r.name)), 'يوجد مشروع بنفس الاسم');
        break;
      case 'units':
        need(r.projectCode, 'المشروع مطلوب');
        need(r.label && String(r.label).trim(), 'رقم/اسم الوحدة مطلوب');
        need(UNIT_TYPES.some(t => t.key === r.type), 'نوع الوحدة غير صحيح');
        need(!state || !state.units.some(u => u.code !== r.code && u.projectCode === r.projectCode && U.normalize(u.label) === U.normalize(r.label)), 'توجد وحدة بنفس الرقم في هذا المشروع');
        break;
      case 'clients':
        need(r.name && r.name.trim(), 'اسم العميل مطلوب');
        need(!r.phone || /^[+\d\s-]{6,20}$/.test(String(r.phone).replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c))), 'رقم التليفون غير صحيح');
        break;
      case 'contracts':
        need(r.unitCode, 'الوحدة مطلوبة');
        need(r.clientCode, 'العميل مطلوب');
        need(U.d(r.start), 'تاريخ بداية العقد مطلوب');
        need(U.d(r.end), 'تاريخ نهاية العقد مطلوب');
        need(!(U.d(r.start) && U.d(r.end)) || U.d(r.end) >= U.d(r.start), 'تاريخ النهاية قبل تاريخ البداية');
        need(U.toNum(r.rent) != null && U.toNum(r.rent) > 0, 'الإيجار الشهري مطلوب (أكبر من صفر)');
        need(U.toNum(r.increasePct) == null || (U.toNum(r.increasePct) >= 0 && U.toNum(r.increasePct) <= 100), 'نسبة الزيادة بين 0 و100');
        need(U.toNum(r.deposit) == null || U.toNum(r.deposit) >= 0, 'التأمين لا يكون سالبًا');
        need(!r.dueDay || (r.dueDay >= 1 && r.dueDay <= 28), 'يوم الاستحقاق بين 1 و28');
        if (state && U.d(r.start) && U.d(r.end)) {
          const overlap = state.contracts.find(c => c.code !== r.code && c.unitCode === r.unitCode && U.d(c.start) <= U.d(r.end) && U.d(c.end) >= U.d(r.start));
          need(!overlap, overlap ? `يتداخل مع العقد ${overlap.code} على نفس الوحدة (${U.fmtDate(overlap.start)} → ${U.fmtDate(overlap.end)}) — ابدأ من ${U.fmtDate(U.iso(U.addDays(U.d(overlap.end), 1)))} أو عدّل العقد السابق` : '');
        }
        break;
      case 'payments':
        need(r.contractCode, 'العقد مطلوب');
        need(/^\d{4}-\d{2}$/.test(r.period || ''), 'الشهر مطلوب');
        need(U.toNum(r.amount) != null && U.toNum(r.amount) !== 0, 'المبلغ مطلوب');
        need(!r.paidOn || U.d(r.paidOn), 'تاريخ السداد غير صحيح');
        break;
      case 'maintenance':
        need(r.unitCode, 'الوحدة مطلوبة');
        need(U.d(r.date), 'التاريخ مطلوب');
        need(r.description && r.description.trim(), 'وصف الصيانة مطلوب');
        need(U.toNum(r.cost) == null || U.toNum(r.cost) >= 0, 'التكلفة لا تكون سالبة');
        break;
    }
    return errs.filter(Boolean);
  }

  E.M = { UNIT_TYPES, CLIENT_KINDS, DEPOSIT_STATUS, PAY_METHODS, MAINT_KINDS, BORNE_BY, MAINT_STATUS, ASSET_CATALOG, label, keyOf, emptyState, blank, ENTITIES, ENTITY_AR, validate };
})(window.Egary);
