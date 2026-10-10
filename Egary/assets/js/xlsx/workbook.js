/* =====================================================================
   workbook.js — قراءة/كتابة ملف الإكسيل (ExcelJS) ⇄ الحالة
   • الورقة المعتادة (2026، 2027…) تبقى بنفس شكلها: م | المشروع | الاسم | الممثل القانوني |
     الوحدة | العنوان | العقد من | العقد إلى | تسجيل ضريبي | الرقم القومي/الباسبور | الشهور |
     الاجمالي (=SUM) | ملاحظات — ويُضاف بعدها أعمدة الأكواد (كود العقد/الوحدة/العميل/المشروع).
   • أوراق منظَّمة: المشاريع · الوحدات · أصول الوحدات · العملاء · العقود · المدفوعات · الصيانة ·
     الإعدادات · سجل التعديلات · ملخص المشاريع.
   • ملف بالشكل الأصلي (بلا ورقة «العقود») يُرحَّل تلقائيًا مع استنتاج الإيجار والزيادة.
   • القراءة بأسماء الأعمدة لا بمواضعها، فإعادة ترتيب الأعمدة في الإكسيل لا تكسر شيئًا.
   ===================================================================== */
window.Egary = window.Egary || {};
(function (E) {
  'use strict';
  const U = () => E.U, M = () => E.M, C = () => E.Codes;
  const XL = () => (typeof ExcelJS !== 'undefined' ? ExcelJS : (typeof require === 'function' ? require('exceljs') : null));

  /* ---------- أسماء الأوراق والأعمدة ---------- */
  const SH = { projects: 'المشاريع', units: 'الوحدات', assets: 'أصول الوحدات', clients: 'العملاء', contracts: 'العقود', payments: 'المدفوعات', maintenance: 'الصيانة', settings: 'الإعدادات', audit: 'سجل التعديلات', summary: 'ملخص المشاريع', users: 'المستخدمون' };
  const LEDGER_HEAD = ['م', 'المشروع', 'الاسم', 'الممثل القانوني', 'الوحدة', 'العنوان', 'العقد من', 'العقد الى', 'تسجيل ضريبي', 'الرقم القومي / الباسبور', 'يناير', 'فبراير', 'مارس', 'ابريل', 'مايو', 'يونيو', 'يوليو', 'اغسطس', 'سبتمبر', 'اكتوبر', 'نوفمبر', 'ديسمبر', 'الاجمالي', 'ملاحظات', 'كود العقد', 'كود الوحدة', 'كود العميل', 'كود المشروع'];
  const COLS = {
    projects: [['code', 'كود المشروع'], ['name', 'اسم المشروع'], ['address', 'العنوان'], ['area', 'المنطقة'], ['notes', 'ملاحظات'], ['createdAt', 'تاريخ الإضافة'], ['_units', 'عدد الوحدات (محسوب)'], ['_occupied', 'مؤجَّرة (محسوب)'], ['_vacant', 'شاغرة (محسوب)'], ['_arrears', 'المتأخرات (محسوب)'], ['_ytd', 'محصَّل السنة (محسوب)']],
    units: [['code', 'كود الوحدة'], ['projectCode', 'كود المشروع'], ['_project', 'المشروع'], ['label', 'رقم / اسم الوحدة'], ['type', 'النوع'], ['floor', 'الدور'], ['area', 'المساحة م²'], ['notes', 'ملاحظات'], ['createdAt', 'تاريخ الإضافة'], ['_assets', 'الأصول (ملخص)'], ['_status', 'الحالة (محسوب)'], ['_tenant', 'المستأجر الحالي (محسوب)'], ['_contract', 'العقد الحالي (محسوب)'], ['_rent', 'الإيجار الحالي (محسوب)'], ['_vacantSince', 'شاغرة منذ (محسوب)'], ['_vacantDays', 'أيام الشغور (محسوب)'], ['_statusKey', 'مفتاح الحالة (محسوب)']],
    assets: [['unitCode', 'كود الوحدة'], ['name', 'الأصل'], ['present', 'موجود'], ['details', 'التفاصيل']],
    clients: [['code', 'كود العميل'], ['name', 'الاسم'], ['kind', 'النوع'], ['rep', 'الممثل القانوني'], ['nationalId', 'الرقم القومي / الباسبور'], ['taxId', 'تسجيل ضريبي'], ['phone', 'التليفون'], ['phone2', 'تليفون آخر'], ['email', 'البريد الإلكتروني'], ['address', 'العنوان'], ['notes', 'ملاحظات'], ['createdAt', 'تاريخ الإضافة'], ['_contracts', 'عدد العقود (محسوب)'], ['_active', 'عقود سارية (محسوب)'], ['_arrears', 'المتأخرات (محسوب)'], ['_paid', 'إجمالي المسدَّد (محسوب)']],
    contracts: [['code', 'كود العقد'], ['unitCode', 'كود الوحدة'], ['clientCode', 'كود العميل'], ['_project', 'المشروع'], ['_unit', 'الوحدة'], ['_client', 'العميل'], ['start', 'بداية العقد'], ['end', 'نهاية العقد'], ['rent', 'الإيجار الشهري (السنة الأولى)'], ['increasePct', 'الزيادة السنوية %'], ['rentOverrides', 'إيجار كل سنة (يدوي)'], ['deposit', 'التأمين'], ['depositStatus', 'حالة التأمين'], ['dueDay', 'يوم الاستحقاق'], ['prevCode', 'العقد السابق'], ['notes', 'ملاحظات'], ['ledgerOrder', 'ترتيب الورقة'], ['inferred', 'مستنتج'], ['createdAt', 'تاريخ الإضافة'], ['_status', 'الحالة (محسوب)'], ['_currentRent', 'الإيجار الحالي (محسوب)'], ['_paid', 'المسدَّد (محسوب)'], ['_arrears', 'المتأخرات (محسوب)'], ['_schedule', 'جدول السنوات (محسوب)'], ['_statusKey', 'مفتاح الحالة (محسوب)'], ['_daysLeft', 'أيام متبقية (محسوب)']],
    payments: [['code', 'رقم الفاتورة'], ['contractCode', 'كود العقد'], ['_client', 'العميل'], ['_unit', 'الوحدة'], ['period', 'الشهر'], ['amount', 'المبلغ'], ['paidOn', 'تاريخ السداد'], ['method', 'طريقة السداد'], ['ref', 'مرجع / إيصال'], ['notes', 'ملاحظات'], ['source', 'المصدر'], ['createdAt', 'تاريخ التسجيل']],
    maintenance: [['code', 'كود الصيانة'], ['unitCode', 'كود الوحدة'], ['_project', 'المشروع'], ['_unit', 'الوحدة'], ['date', 'التاريخ'], ['kind', 'النوع'], ['description', 'الوصف'], ['cost', 'التكلفة'], ['borneBy', 'يتحملها'], ['status', 'الحالة'], ['closedOn', 'تاريخ الإغلاق'], ['notes', 'ملاحظات'], ['createdAt', 'تاريخ الإضافة'], ['custodianContract', 'العقد وقتها'], ['custodianName', 'المستأجر وقتها'], ['_custodian', 'المستأجر وقتها (محسوب)'], ['_custodianContract', 'العقد وقتها (محسوب)']],
    users: [['code', 'اسم المستخدم'], ['name', 'الاسم'], ['role', 'الدور'], ['passwordHash', 'كلمة المرور (مشفّرة)'], ['enabled', 'مفعّل'], ['createdAt', 'تاريخ الإضافة'], ['lastLogin', 'آخر دخول']],
  };
  const LISTS = { // الحقول ذات القوائم: مفتاح ⇄ عربي
    'units.type': () => M().UNIT_TYPES, 'clients.kind': () => M().CLIENT_KINDS, 'contracts.depositStatus': () => M().DEPOSIT_STATUS,
    'payments.method': () => [{ key: '', ar: 'غير محدد' }].concat(M().PAY_METHODS), 'payments.source': () => [{ key: 'web', ar: 'الموقع' }, { key: 'excel', ar: 'الإكسيل' }],
    'maintenance.kind': () => M().MAINT_KINDS, 'maintenance.borneBy': () => M().BORNE_BY, 'maintenance.status': () => M().MAINT_STATUS,
    'users.role': () => E.Auth ? E.Auth.ROLES : [{ key: 'admin', ar: 'مدير' }, { key: 'staff', ar: 'موظف' }, { key: 'viewer', ar: 'مشاهدة فقط' }],
  };
  const DATE_FIELDS = new Set(['start', 'end', 'paidOn', 'date', 'closedOn', 'createdAt']);
  const NUM_FIELDS = new Set(['rent', 'increasePct', 'deposit', 'dueDay', 'amount', 'cost', 'area', 'ledgerOrder']);
  const STYLE = { head: 'FF1F4E78', headFont: 'FFFFFFFF', total: 'FFD9D9D9', computed: 'FFEDEDED', rowFills: ['FFFFF2CC', 'FFDDEBF7', 'FFE2EFDA', 'FFFCE4D6', 'FFEDEDED'] };

  /* ---------- أدوات ورقة ---------- */
  function headerMap(ws, headerRow) {
    const map = {}; const row = ws.getRow(headerRow || 1);
    row.eachCell((cell, col) => { const t = U().normalize(U().cellText(cell.value)); if (t) map[t] = col; });
    return map;
  }
  function findCol(map, name) { return map[U().normalize(name)] || 0; }
  function styleHeader(row) {
    row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLE.head } }; cell.font = { bold: true, color: { argb: STYLE.headFont }, size: 11 }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; cell.border = { bottom: { style: 'thin' } }; });
    row.height = 28;
  }
  function rtl(ws, xSplit, ySplit) { ws.views = [{ state: 'frozen', xSplit: xSplit || 0, ySplit: ySplit || 1, rightToLeft: true }]; }
  function listValidation(ws, col, fromRow, toRow, values) {
    for (let r = fromRow; r <= Math.max(toRow, fromRow); r++) ws.getCell(r, col).dataValidation = { type: 'list', allowBlank: true, formulae: ['"' + values.join(',') + '"'], showErrorMessage: true, errorTitle: 'قيمة غير مسموحة', error: 'اختر من القائمة: ' + values.join(' / ') };
  }
  function toDate(isoStr) { const d = U().d(isoStr); return d || null; }

  /* =====================================================================
     القراءة
     ===================================================================== */
  async function read(buf, opts) {
    opts = opts || {};
    const wb = new (XL().Workbook)();
    await wb.xlsx.load(buf);
    const names = wb.worksheets.map(w => w.name);
    const flags = [];
    const state = M().emptyState();
    const isYearName = (n) => /^\d{4}$/.test(U().foldCode(n));
    const ledgerSheets = wb.worksheets.filter(w => isYearName(w.name));
    const normalized = !!wb.getWorksheet(SH.contracts);
    // ورقة تشبه ورقة سنة لكن اسمها ليس سنة («2026 (2)» من «نقل أو نسخ» في Excel) ⇒ لا تُقرأ، وننبّه
    for (const w of wb.worksheets) { if (isYearName(w.name) || Object.values(SH).includes(w.name)) continue; let looks = /^\d{4}\b/.test(U().foldCode(w.name).replace(/\(.*/, '')); if (!looks) { try { const m = headerMap(w, 2); looks = !!(findCol(m, 'المشروع') && findCol(m, 'الاسم') && findCol(m, 'يناير')); } catch (e) { looks = false; } } if (looks) flags.push({ sev: 'warn', entity: 'sheet', code: w.name, text: `الورقة «${w.name}» تشبه ورقة سنة لكن اسمها ليس سنة — سمِّها بالسنة فقط (مثل 2025) لتُقرأ` }); }
    state._newestYear = ledgerSheets.length ? Math.max(...ledgerSheets.map(w => parseInt(U().foldCode(w.name), 10))) : 0;
    if (normalized) readNormalized(wb, state, flags);
    else state.meta.source = 'migrated';
    for (const ws of ledgerSheets) readLedger(ws, state, flags, opts.snapshot || null, !normalized);
    createPriors(state, flags);
    if (normalized && ledgerSheets.length > 1) reconcilePriorYears(state, flags);
    if (!ledgerSheets.length && !normalized) throw new Error('الملف لا يحتوي على ورقة سنة (مثل 2026) ولا أوراق إيجاري');
    state.settings.ledgerYears = Array.from(new Set(ledgerSheets.map(w => parseInt(U().foldCode(w.name), 10)).concat(state.settings.ledgerYears || []))).sort();
    if (!state.settings.trackingFrom || !normalized) state.settings.trackingFrom = String(state.settings.ledgerYears[0] || new Date().getUTCFullYear()) + '-01';
    // ورقة سنة أقدم أُضيفت (مثل 2025 بجوار 2026): تبدأ المحاسبة من أول سنة موجودة فعلًا
    { const y0 = state.settings.ledgerYears[0], ty = parseInt(String(state.settings.trackingFrom || '').slice(0, 4), 10);
      if (y0 && !(ty >= 1900)) state.settings.trackingFrom = String(y0) + '-01';
      else if (y0 && y0 < ty && state.settings.trackingMode !== 'manual') { // ورقة سنة أقدم ظهرت: المحاسبة تبدأ منها (ما لم يثبّت المدير البداية يدويًا)
        const n = state.contracts.filter(c => c.start && c.end && c.start.slice(0, 4) <= String(y0) && c.end.slice(0, 4) >= String(y0)).length;
        state.settings.trackingFrom = String(y0) + '-01';
        flags.push({ sev: 'warn', entity: 'sheet', code: String(y0), text: `ورقة ${y0} جعلت المحاسبة تبدأ ${y0}-01: ${n} عقدًا ساريًا في ${y0} — أي شهر بلا مبلغ فيها سيُحسب متأخرًا. لعرض الأرقام من سنة لاحقة استخدم سلايسر «المحاسبة من» في اللوحة، أو ثبّت «بداية المحاسبة» من الإعدادات` });
      }
      else if (y0 && y0 < ty && state.settings.trackingMode === 'manual') flags.push({ sev: 'info', entity: 'sheet', code: String(y0), text: `ورقة ${y0} موجودة لكن المحاسبة مثبّتة من ${state.settings.trackingFrom} — الشهور قبلها تاريخ فقط` });
    }
    delete state._newestYear;
    C().syncSeq(state); // العدّادات لا تقل عن أعلى كود موجود
    state.flags = flags;
    return { state, flags, migrated: !normalized, sheets: names };
  }

  function readTable(ws, entity, headerRow) {
    const map = headerMap(ws, headerRow || 1), cols = COLS[entity], out = [];
    for (let r = (headerRow || 1) + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r); if (!row || !row.hasValues) continue;
      const rec = M().blank[entity] ? M().blank[entity]() : {};
      let any = false;
      for (const [field, ar] of cols) {
        if (field.startsWith('_') && field !== '_project' && field !== '_unit' && field !== '_client') continue;
        const col = findCol(map, ar); if (!col) continue;
        const v = row.getCell(col).value; const txt = U().cellText(v);
        if (txt !== '') any = true;
        if (field.startsWith('_')) { if (txt !== '') rec[field] = txt; continue; }
        if (DATE_FIELDS.has(field)) rec[field] = U().toIso(v instanceof Date ? v : (v && v.result instanceof Date ? v.result : txt));
        else if (NUM_FIELDS.has(field) && !(entity === 'projects' && field === 'area')) {
          const n = U().toNum(v);
          rec[field] = n == null ? (field === 'dueDay' ? 1 : (field === 'area' ? '' : (field === 'ledgerOrder' ? null : 0))) : n;
        }
        else if (LISTS[entity + '.' + field]) rec[field] = M().keyOf(LISTS[entity + '.' + field](), txt) || (entity === 'users' ? (LISTS['users.role']().find(r => r.key === txt.trim().toLowerCase() || U().normalize(txt).startsWith(U().normalize(r.ar)) || (U().normalize(txt).length >= 3 && U().normalize(r.ar).startsWith(U().normalize(txt)))) || {}).key || (txt.trim() ? 'viewer' : rec[field]) : (field === 'method' || field === 'source' ? '' : rec[field]));
        else if (field === 'rentOverrides') rec[field] = parseOverrides(txt);
        else if (field === 'period') { const iso = v instanceof Date ? U().toIso(v) : (/^\d{4}-\d{2}-\d{2}/.test(txt) ? txt : ''); rec[field] = iso ? iso.slice(0, 7) : txt.replace(/[٠-٩]/g, ch => '٠١٢٣٤٥٦٧٨٩'.indexOf(ch)).replace(/\//g, '-').slice(0, 7); }
        else if (field === 'present' || field === 'inferred') rec[field] = /^(نعم|✓|yes|true|1|موجود)$/i.test(txt);
        else if (field === 'enabled') rec[field] = !/^(لا|no|false|0|معطل|معطَّل|معطّل|x|✗)$/i.test(txt.trim()); // لا يُعطَّل إلا بنفي صريح
        else rec[field] = txt;
      }
      if (any) { rec._row = r; out.push(rec); }
    }
    return out;
  }
  function parseOverrides(txt) { // "2:83600; 3:91960"
    const o = {}; for (const part of String(txt || '').split(/[;،\n]/)) { const m = /^\s*(\d+)\s*[:=]\s*([\d.,]+)/.exec(part); if (m) o[m[1]] = U().toNum(m[2]); } return o;
  }
  function fmtOverrides(o) { return Object.keys(o || {}).sort((a, b) => a - b).map(k => k + ':' + o[k]).join('; '); }

  function readNormalized(wb, state, flags) {
    for (const ent of ['projects', 'units', 'clients', 'contracts', 'payments', 'maintenance']) {
      const ws = wb.getWorksheet(SH[ent]); if (!ws) continue;
      const rows = readTable(ws, ent);
      const seen = new Set();
      for (const r of rows) {
        const rowNo = r._row; delete r._row;
        if (r.code && seen.has(U().foldCode(r.code))) { flags.push({ sev: 'danger', entity: ent, code: r.code, text: `ورقة ${SH[ent]} صف ${rowNo}: الكود ${r.code} مكرر — أُعطي الصف كودًا جديدًا (راجع الصفين)` }); r.code = ''; }
        if (!r.code) { r._needsCode = true; } else seen.add(U().foldCode(r.code));
        state[ent].push(r); r._rowNo = rowNo;
      }
    }
    // مفاتيح مكتوبة بالاسم بدل الكود (صفوف يدوية): نحلّها بالاسم كما في ورقة السنة
    const byName = (list, name) => name ? list.find(x => U().normalize(x.name) === U().normalize(name)) || null : null;
    const unitByLabel = (projectCode, label) => label ? state.units.find(u => (!projectCode || u.projectCode === projectCode) && U().normalize(u.label) === U().normalize(label)) || null : null;
    // أكواد للصفوف المضافة يدويًا في الإكسيل
    for (const p of state.projects) if (p._needsCode) { p.code = C().nextProject(state); flags.push({ sev: 'info', entity: 'projects', code: p.code, text: `صف مشروع جديد من الإكسيل أُعطي الكود ${p.code}` }); }
    for (const u of state.units) {
      if (!u.projectCode && u._project) { const p = byName(state.projects, u._project); if (p) u.projectCode = p.code; }
      if (!u.projectCode && u._needsCode) { flags.push({ sev: 'danger', entity: 'units', code: u.label, text: `ورقة الوحدات صف ${u._rowNo}: الوحدة «${u.label}» بلا مشروع معروف — اكتب كود المشروع أو اسمه كما في ورقة المشاريع` }); u._drop = true; continue; }
      if (u._needsCode) { u.code = C().unitCode(state, u.projectCode || 'P00', u.label); if (!u.type) u.type = C().inferType(u.label); if (!u.floor) u.floor = C().inferFloor(u.label); flags.push({ sev: 'info', entity: 'units', code: u.code, text: `صف وحدة جديد من الإكسيل أُعطي الكود ${u.code}` }); }
    }
    state.units = state.units.filter(u => !u._drop);
    for (const c of state.clients) if (c._needsCode) { c.code = C().nextClient(state); flags.push({ sev: 'info', entity: 'clients', code: c.code, text: `عميل جديد من الإكسيل أُعطي الكود ${c.code}` }); }
    for (const c of state.contracts) {
      if (!c.unitCode && c._unit) { const p = byName(state.projects, c._project); const u = unitByLabel(p ? p.code : '', c._unit); if (u) c.unitCode = u.code; }
      if (!c.clientCode && c._client) { const cl = byName(state.clients, c._client); if (cl) c.clientCode = cl.code; }
      if (c._needsCode) { c.code = C().nextContract(state); flags.push({ sev: 'info', entity: 'contracts', code: c.code, text: `عقد جديد من الإكسيل أُعطي الكود ${c.code}` }); }
    }
    for (const p of state.payments) {
      if (!p.contractCode && (p._client || p._unit)) { const cl = byName(state.clients, p._client); const cands = state.contracts.filter(c => (!cl || c.clientCode === cl.code) && (!p._unit || U().normalize((state.units.find(u => u.code === c.unitCode) || {}).label) === U().normalize(p._unit))); const inRange = cands.find(c => p.period && c.start && c.end && c.start.slice(0, 7) <= p.period && c.end.slice(0, 7) >= p.period); const pick = inRange || cands.sort((a, b) => U().cmp(b.start, a.start))[0]; if (pick) p.contractCode = pick.code; }
      if (p._needsCode) { p.code = C().nextInvoice(state, (p.period || '0000').slice(0, 4)); p.source = p.source || 'excel'; }
    }
    for (const m of state.maintenance) {
      if (!m.unitCode && m._unit) { const p = byName(state.projects, m._project); const u = unitByLabel(p ? p.code : '', m._unit); if (u) m.unitCode = u.code; }
      if (m._needsCode) { m.code = C().nextMaintenance(state); }
    }
    // المفاتيح الأجنبية المكتوبة بصيغة مختلفة (أرقام عربية، حروف صغيرة، مسافات) تُوحَّد إلى الكود الأصلي؛ والمفقودة تُعلَّم
    const canon = (ent) => new Map(state[ent].map(r => [U().foldCode(r.code), r.code]));
    const cP = canon('projects'), cU = canon('units'), cC = canon('clients'), cT = canon('contracts');
    const fix = (rec, field, map, ent, entAr, optional) => {
      const v = rec[field]; if (!v) return;
      const exact = map.get(U().foldCode(v));
      if (exact === undefined) { if (!optional) flags.push({ sev: 'danger', entity: ent, code: rec.code, text: `${M().ENTITY_AR[ent]} ${rec.code}: ${entAr} «${v}» غير موجود — راجع الكود في الإكسيل` }); return; }
      if (exact !== v) { rec[field] = exact; flags.push({ sev: 'info', entity: ent, code: rec.code, text: `${M().ENTITY_AR[ent]} ${rec.code}: ${entAr} كُتب «${v}» وصُحِّح إلى ${exact}` }); }
    };
    for (const u of state.units) fix(u, 'projectCode', cP, 'units', 'كود المشروع');
    for (const c of state.contracts) { fix(c, 'unitCode', cU, 'contracts', 'كود الوحدة'); fix(c, 'clientCode', cC, 'contracts', 'كود العميل'); fix(c, 'prevCode', cT, 'contracts', 'العقد السابق', true); }
    for (const p of state.payments) fix(p, 'contractCode', cT, 'payments', 'كود العقد');
    for (const m of state.maintenance) { fix(m, 'unitCode', cU, 'maintenance', 'كود الوحدة'); fix(m, 'custodianContract', cT, 'maintenance', 'عقد العهدة', true); }
    for (const ent of ['projects', 'units', 'clients', 'contracts', 'payments', 'maintenance']) for (const r of state[ent]) { delete r._needsCode; delete r._rowNo; delete r._project; delete r._unit; delete r._client; delete r._drop; }
    // المستخدمون (حسابات الدخول)
    const wu = wb.getWorksheet(SH.users);
    if (wu) for (const r of readTable(wu, 'users')) { delete r._row; r.code = String(r.code || '').trim().toLowerCase(); if (r.code) state.users.push(r); }
    // الأصول
    const wa = wb.getWorksheet(SH.assets);
    if (wa) {
      const byUnit = new Map();
      const cUnits = new Map(state.units.map(u => [U().foldCode(u.code), u.code]));
      for (const a of readTable(wa, 'assets')) { if (!a.unitCode) continue; const uc = cUnits.get(U().foldCode(a.unitCode)) || a.unitCode; if (!byUnit.has(uc)) byUnit.set(uc, []); byUnit.get(uc).push({ name: a.name, present: !!a.present, details: a.details || '' }); }
      for (const u of state.units) u.assets = byUnit.get(u.code) || [];
    }
    // الإعدادات
    const wsS = wb.getWorksheet(SH.settings);
    if (wsS) {
      for (let r = 2; r <= wsS.rowCount; r++) {
        const k = U().cellText(wsS.getCell(r, 1).value), v = wsS.getCell(r, 2).value, txt = U().cellText(v);
        if (!k) continue;
        const f = SETTINGS_KEYS.find(s => U().normalize(s.ar) === U().normalize(k)); if (!f) continue;
        if (f.type === 'num') state.settings[f.key] = U().toNum(v) == null ? state.settings[f.key] : U().toNum(v);
        else if (f.type === 'years') state.settings[f.key] = txt.split(/[,،\s]+/).map(x => parseInt(x, 10)).filter(x => x > 1900);
        else if (f.type === 'json') { try { const o = JSON.parse(txt || '{}'); state.settings[f.key] = o && typeof o === 'object' ? o : {}; } catch (e) { state.settings[f.key] = state.settings[f.key] || {}; } }
        else if (f.key === 'officeName') state.meta.officeName = txt || state.meta.officeName;
        else state.settings[f.key] = txt || state.settings[f.key];
      }
    }
    const wsA = wb.getWorksheet(SH.audit);
    if (wsA) for (let r = 2; r <= Math.min(wsA.rowCount, 501); r++) { const row = wsA.getRow(r); if (!row.hasValues) continue; state.audit.push({ at: U().cellText(row.getCell(1).value), action: U().cellText(row.getCell(2).value), entity: U().cellText(row.getCell(3).value), code: U().cellText(row.getCell(4).value), summary: U().cellText(row.getCell(5).value), user: U().cellText(row.getCell(6).value) }); }
  }
  const SETTINGS_KEYS = [
    { key: 'officeName', ar: 'اسم المكتب', type: 'text' }, { key: 'graceDays', ar: 'أيام السماح بعد الاستحقاق', type: 'num' }, { key: 'dueDay', ar: 'يوم الاستحقاق الافتراضي', type: 'num' },
    { key: 'vacancyMonths', ar: 'عتبة الشغور الطويل (شهور)', type: 'num' }, { key: 'trackingFrom', ar: 'بداية المحاسبة (سنة-شهر)', type: 'text' }, { key: 'defaultIncreasePct', ar: 'الزيادة السنوية الافتراضية %', type: 'num' },
    { key: 'ledgerYears', ar: 'سنوات الورقة', type: 'years' }, { key: 'codeSeq', ar: 'أعلى أرقام الأكواد الصادرة', type: 'json' }, { key: 'trackingMode', ar: 'بداية المحاسبة (تلقائي/يدوي)', type: 'text' }, { key: 'invoicePrefix', ar: 'بادئة رقم الفاتورة', type: 'text' }, { key: 'currency', ar: 'العملة', type: 'text' },
    { key: 'enteredThrough', ar: 'آخر شهر مسجَّل في الورقة (سنة-شهر أو فارغ = تلقائي)', type: 'text' }, { key: 'tolerancePct', ar: 'فرق مقبول في السداد %', type: 'num' }, { key: 'toleranceMin', ar: 'الحد الأدنى للفرق المقبول (ج)', type: 'num' }, { key: 'prorationBasis', ar: 'أساس الشهر المقطوع (30 أو actual)', type: 'text' },
  ];

  /* ---------- قراءة ورقة سنة (الشكل المعتاد) ---------- */
  function readLedger(ws, state, flags, snapshot, migrating) {
    const year = ws.name.trim();
    let headerRow = 0;
    for (let r = 1; r <= Math.min(ws.rowCount, 10) && !headerRow; r++) { const m = headerMap(ws, r); if (findCol(m, 'المشروع') && findCol(m, 'الاسم') && findCol(m, 'يناير')) headerRow = r; }
    if (!headerRow) { flags.push({ sev: 'danger', entity: 'sheet', code: year, text: `ورقة ${year}: لم يُعثر على صف العناوين (المشروع / الاسم / يناير)` }); return; }
    const map = headerMap(ws, headerRow);
    const col = n => findCol(map, n);
    const cSerial = col('م'), cProj = col('المشروع'), cName = col('الاسم'), cRep = col('الممثل القانوني'), cUnit = col('الوحدة'), cAddr = col('العنوان'), cFrom = col('العقد من'), cTo = col('العقد الى') || col('العقد إلى'), cTax = col('تسجيل ضريبي'), cNid = col('الرقم القومي / الباسبور') || col('الرقم القومي'), cNote = col('ملاحظات');
    const cCodeT = col('كود العقد'), cCodeU = col('كود الوحدة'), cCodeC = col('كود العميل'), cCodeP = col('كود المشروع');
    const monthCols = ['يناير', 'فبراير', 'مارس', 'ابريل', 'مايو', 'يونيو', 'يوليو', 'اغسطس', 'سبتمبر', 'اكتوبر', 'نوفمبر', 'ديسمبر'].map((n, i) => col(n) || col(U().MONTHS_AR[i]));
    const seen = new Set();
    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r); if (!row.hasValues) continue;
      const name = U().cellText(row.getCell(cName).value), proj = U().cellText(row.getCell(cProj).value);
      if (!name && !proj) continue;
      if (/الاجمالي|الإجمالي/.test(name) || /الاجمالي|الإجمالي/.test(proj)) continue;
      if (!name || !proj) { flags.push({ sev: 'warn', entity: 'sheet', code: year + ':' + r, text: `ورقة ${year} صف ${r}: الاسم أو المشروع فارغ — تم تجاهل الصف` }); continue; }
      const L = {
        row: r, serial: r, proj, name, rep: cRep ? U().cellText(row.getCell(cRep).value) : '', unit: U().cellText(row.getCell(cUnit).value), addr: cAddr ? U().cellText(row.getCell(cAddr).value) : '',
        from: U().toIso(row.getCell(cFrom).value instanceof Date ? row.getCell(cFrom).value : U().cellText(row.getCell(cFrom).value)), to: U().toIso(row.getCell(cTo).value instanceof Date ? row.getCell(cTo).value : U().cellText(row.getCell(cTo).value)),
        tax: cTax ? U().cellText(row.getCell(cTax).value) : '', nid: cNid ? U().cellText(row.getCell(cNid).value) : '', note: cNote ? U().cellText(row.getCell(cNote).value) : '',
        codeT: cCodeT ? U().cellText(row.getCell(cCodeT).value) : '', codeU: cCodeU ? U().cellText(row.getCell(cCodeU).value) : '', codeC: cCodeC ? U().cellText(row.getCell(cCodeC).value) : '', codeP: cCodeP ? U().cellText(row.getCell(cCodeP).value) : '',
        months: monthCols.map((cc, i) => { if (!cc) return { period: year + '-' + U().pad(i + 1, 2), num: null, text: '' }; const v = row.getCell(cc).value; const num = U().toNum(v); const text = U().cellText(v); return { period: year + '-' + U().pad(i + 1, 2), num, text: num == null ? text : '', raw: v }; }),
      };
      const L2 = stripStaleCodes(L, year, state, flags);
      if (L2.codeT && seen.has(U().foldCode(L2.codeT))) { flags.push({ sev: 'warn', entity: 'sheet', code: year + ':' + r, text: `ورقة ${year} صف ${r}: كود العقد ${L2.codeT} مكرر — تم تجاهل الصف` }); continue; }
      if (L2.codeT) seen.add(U().foldCode(L2.codeT));
      mergeLedgerRow(L2, year, state, flags, snapshot, migrating);
    }
  }

  function findProject(state, name) { return state.projects.find(p => U().normalize(p.name) === U().normalize(name)) || null; }
  function findClient(state, name) { return state.clients.find(c => U().normalize(c.name) === U().normalize(name)) || null; }
  function isCompany(name) { const n = U().normalize(name); return /شركه|شركة|مؤسسه|للتجاره|للاستشارات|للاستيراد|للتصدير|للانتاج|للخدمات|للتنميه|للمقاولات|للتسويق|company|co\b|ltd|llc|inc|group|قروب|مبادرات|وزاره|جمعيه|مركز|معهد|صالون|مطعم|كافيه|مكتب|برودكشن|ميديا|لابز|زون/.test(n); }

  /* دمج صف ورقة السنة مع الحالة: إنشاء الكيانات الناقصة، مطابقة الأكواد، مطابقة المدفوعات */
  /* صف منسوخ بأعمدة أكواد قديمة (العميل والوحدة فيه لا يطابقان العقد الذي يشير إليه الكود) ⇒ نتجاهل الأكواد ونعامله كصف جديد بدل إعادة تسمية العقد القديم */
  function stripStaleCodes(L, year, state, flags) {
    if (!L.codeT) return L;
    const byT = state.contracts.find(c => U().foldCode(c.code) === U().foldCode(L.codeT));
    if (!byT) return L;
    const cl0 = state.clients.find(c => c.code === byT.clientCode), u0 = state.units.find(u => u.code === byT.unitCode);
    const nameMatch = !!cl0 && U().normalize(L.name) === U().normalize(cl0.name), labelMatch = !!u0 && U().normalize(L.unit) === U().normalize(u0.label);
    if (nameMatch || labelMatch) return L;
    flags.push({ sev: 'warn', entity: 'contracts', code: byT.code, text: `ورقة ${year} صف ${L.row}: الأكواد تشير إلى ${byT.code} (${cl0 ? cl0.name : '?'} / ${u0 ? u0.label : '?'}) لكن الصف باسم «${L.name}» ووحدة «${L.unit}» — عومل كصف جديد والأكواد القديمة تجاهلت` });
    return Object.assign({}, L, { codeT: '', codeU: '', codeC: '' });
  }
  function mergeLedgerRow(L, year, state, flags, snapshot, migrating) {
    // المشروع
    let project = L.codeP ? state.projects.find(p => U().foldCode(p.code) === U().foldCode(L.codeP)) : null;
    if (!project) project = findProject(state, L.proj);
    if (!project) { project = Object.assign(M().blank.projects(), { code: C().nextProject(state), name: L.proj, address: L.addr }); state.projects.push(project); if (!migrating) flags.push({ sev: 'info', entity: 'projects', code: project.code, text: `مشروع جديد «${L.proj}» من ورقة ${year} صف ${L.row} — الكود ${project.code}` }); }
    else if (!project.address && L.addr) project.address = L.addr;
    // العميل
    let client = L.codeC ? state.clients.find(c => U().foldCode(c.code) === U().foldCode(L.codeC)) : null;
    if (!client) client = findClient(state, L.name);
    if (!client) {
      client = Object.assign(M().blank.clients(), { code: C().nextClient(state), name: L.name, kind: isCompany(L.name) ? 'company' : 'person', rep: L.rep && U().normalize(L.rep) !== U().normalize(L.name) ? L.rep : '', nationalId: L.nid, taxId: L.tax });
      state.clients.push(client);
      if (!migrating) flags.push({ sev: 'info', entity: 'clients', code: client.code, text: `عميل جديد «${L.name}» من ورقة ${year} صف ${L.row} — الكود ${client.code}` });
    } else {
      if (!client.nationalId && L.nid) client.nationalId = L.nid; else if (L.nid && client.nationalId && U().foldCode(client.nationalId) !== U().foldCode(L.nid)) flags.push({ sev: 'warn', entity: 'clients', code: client.code, text: `${client.name}: رقم قومي/باسبور مختلف في ورقة ${year} صف ${L.row} (${L.nid}) عن المسجَّل (${client.nationalId})` });
      if (!client.taxId && L.tax) client.taxId = L.tax;
      if (!client.rep && L.rep && U().normalize(L.rep) !== U().normalize(L.name)) client.rep = L.rep;
      else if (client.rep && L.rep && U().normalize(client.rep) !== U().normalize(L.rep) && U().normalize(L.rep) !== U().normalize(L.name)) flags.push({ sev: 'info', entity: 'clients', code: client.code, text: `${client.name}: ممثل قانوني مختلف في ورقة ${year} صف ${L.row} («${L.rep}») عن المسجَّل («${client.rep}»)` });
    }
    // الوحدة (نفس الاسم في نفس المشروع + فترة متداخلة لعقد آخر ⇒ وحدة أخرى بنفس الاسم)
    let unit = L.codeU ? state.units.find(u => U().foldCode(u.code) === U().foldCode(L.codeU)) : null;
    const from = L.from, to = L.to;
    if (!unit) {
      const cands = state.units.filter(u => u.projectCode === project.code && U().normalize(u.label) === U().normalize(L.unit));
      unit = cands.find(u => !state.contracts.some(c => c.unitCode === u.code && c.clientCode !== client.code && from && to && U().d(c.start) <= U().d(to) && U().d(c.end) >= U().d(from))) || null;
      if (!unit && cands.length) flags.push({ sev: 'warn', entity: 'units', code: cands[0].code, text: `«${L.unit}» في ${project.name}: صف ${L.row} بورقة ${year} لعميل آخر بفترة متداخلة مع ${cands[0].code} — أُنشئت وحدة منفصلة بنفس الاسم` });
    }
    if (!unit) { unit = Object.assign(M().blank.units(), { code: C().unitCode(state, project.code, L.unit), projectCode: project.code, label: L.unit, type: C().inferType(L.unit), floor: C().inferFloor(L.unit) }); state.units.push(unit); if (!migrating) flags.push({ sev: 'info', entity: 'units', code: unit.code, text: `وحدة جديدة «${L.unit}» في ${project.name} من ورقة ${year} صف ${L.row} — الكود ${unit.code}` }); }
    // العقد
    let contract = L.codeT ? state.contracts.find(c => U().foldCode(c.code) === U().foldCode(L.codeT)) : null;
    if (!contract) contract = state.contracts.find(c => c.unitCode === unit.code && c.clientCode === client.code && c.start === from) || null;
    const isNew = !contract;
    if (isNew) {
      contract = Object.assign(M().blank.contracts(), { code: C().nextContract(state), unitCode: unit.code, clientCode: client.code, start: from, end: to, dueDay: state.settings.dueDay || 1, notes: L.note, ledgerOrder: L.serial != null ? L.serial : 1e6 });
      if (U().d(from) && U().d(to) && U().d(to) < U().d(from)) {
        const paidPeriods = L.months.filter(m => m.num > 0).map(m => m.period);
        const allBefore = paidPeriods.length && paidPeriods.every(pp => U().monthLast(pp) < U().d(from));
        if (allBefore) { // المبالغ كلها قبل «البداية» ⇒ الخطأ في سنة البداية لا النهاية
          const fixedStart = U().iso(U().addDays(new Date(Date.UTC(U().d(to).getUTCFullYear() - 1, U().d(to).getUTCMonth(), U().d(to).getUTCDate())), 1));
          flags.push({ sev: 'danger', entity: 'contracts', code: contract.code, text: `${client.name} / ${unit.label}: بداية العقد (${U().fmtDate(from)}) بعد نهايته (${U().fmtDate(to)}) في ورقة ${year} صف ${L.row}، والمبالغ كلها قبلها — افتُرضت البداية ${U().fmtDate(fixedStart)} (خطأ في سنة البداية على الأرجح) حتى تُراجَع` });
          contract.start = fixedStart; contract.notes = (contract.notes ? contract.notes + ' | ' : '') + `بداية العقد في الورقة الأصلية ${U().fmtDate(from)} (بعد النهاية) — صُحِّحت تلقائيًا إلى ${U().fmtDate(fixedStart)}`;
        } else {
          const fixed = U().iso(U().addDays(new Date(Date.UTC(U().d(from).getUTCFullYear() + 1, U().d(from).getUTCMonth(), U().d(from).getUTCDate())), -1));
          flags.push({ sev: 'danger', entity: 'contracts', code: contract.code, text: `${client.name} / ${unit.label}: نهاية العقد (${U().fmtDate(to)}) قبل بدايته (${U().fmtDate(from)}) في ورقة ${year} صف ${L.row} — افتُرضت سنة واحدة (${U().fmtDate(fixed)}) حتى تُراجَع` });
          contract.end = fixed; contract.notes = (contract.notes ? contract.notes + ' | ' : '') + `نهاية العقد في الورقة الأصلية ${U().fmtDate(to)} (قبل البداية) — صُحِّحت تلقائيًا إلى ${U().fmtDate(fixed)}`;
        }
      }
      if (!U().d(from) || !U().d(contract.end)) flags.push({ sev: 'danger', entity: 'contracts', code: contract.code, text: `${client.name} / ${unit.label}: تاريخ بداية أو نهاية العقد غير مقروء في ورقة ${year} صف ${L.row}` });
      state.contracts.push(contract);
      if (!migrating) flags.push({ sev: 'info', entity: 'contracts', code: contract.code, text: `عقد جديد (${client.name} / ${unit.label}) من ورقة ${year} صف ${L.row} — الكود ${contract.code}` });
    } else {
      // الورقة المعتادة هي ما يعدّله المكتب: التواريخ والملاحظة والأسماء فيها تتقدم عند الاختلاف
      const snap = snapshot && snapshot.rows ? snapshot.rows[contract.code] : null;
      const changed = (val, cur, snapVal) => val !== '' && val !== (cur || '') && (!snap || (snapVal || '') !== val);
      if (changed(L.name, client.name, snap && snap.name)) { flags.push({ sev: 'info', entity: 'clients', code: client.code, text: `اسم العميل ${client.code} عُدِّل من ورقة ${year}: «${client.name}» ← «${L.name}»` }); client.name = L.name; }
      if (changed(L.rep, client.rep, snap && snap.rep) && U().normalize(L.rep) !== U().normalize(L.name)) client.rep = L.rep;
      if (changed(L.nid, client.nationalId, snap && snap.nid)) { flags.push({ sev: 'info', entity: 'clients', code: client.code, text: `الرقم القومي/الباسبور لـ${client.name} عُدِّل من ورقة ${year}` }); client.nationalId = L.nid; }
      if (changed(L.tax, client.taxId, snap && snap.tax)) client.taxId = L.tax;
      if (changed(L.unit, unit.label, snap && snap.label)) { flags.push({ sev: 'info', entity: 'units', code: unit.code, text: `اسم الوحدة ${unit.code} عُدِّل من ورقة ${year}: «${unit.label}» ← «${L.unit}»` }); unit.label = L.unit; }
      if (changed(L.addr, project.address, snap && snap.addr)) project.address = L.addr;
      const yr = parseInt(year, 10), startYr = parseInt(String(contract.start || '').slice(0, 4), 10) || yr;
      const datesAuthoritative = migrating || !state._newestYear || yr >= state._newestYear || yr === startYr; // التواريخ تُؤخذ من أحدث ورقة أو من ورقة سنة بداية العقد فقط
      if (datesAuthoritative) {
        if (from && from !== contract.start && (!snap || snap.start !== from)) { flags.push({ sev: 'info', entity: 'contracts', code: contract.code, text: `بداية العقد ${contract.code} عُدِّلت من ورقة ${year}: ${U().fmtDate(contract.start)} ← ${U().fmtDate(from)}` }); contract.start = from; }
        if (to && to !== contract.end && (!snap || snap.end !== to)) { flags.push({ sev: 'info', entity: 'contracts', code: contract.code, text: `نهاية العقد ${contract.code} عُدِّلت من ورقة ${year}: ${U().fmtDate(contract.end)} ← ${U().fmtDate(to)}` }); contract.end = to; }
      } else if ((from && from !== contract.start) || (to && to !== contract.end)) {
        const overlaps = U().d(from) && U().d(to) && U().d(contract.start) && U().d(contract.end) && U().d(from) <= U().d(contract.end) && U().d(to) >= U().d(contract.start);
        if (!overlaps && U().d(from) && U().d(to) && U().d(to) >= U().d(from)) { // فترة سابقة منفصلة لنفس المستأجر ⇒ عقد سابق مستقل مربوط بالعقد الحالي
          const prior = Object.assign(M().blank.contracts(), { code: C().nextContract(state), unitCode: unit.code, clientCode: client.code, start: from, end: to, rent: contract.rent, increasePct: 0, dueDay: contract.dueDay || 1, notes: `فترة سابقة من ورقة ${year} صف ${L.row}`, ledgerOrder: L.serial != null ? L.serial : 1e6 });
          state.contracts.push(prior); if (!contract.prevCode) contract.prevCode = prior.code;
          flags.push({ sev: 'info', entity: 'contracts', code: prior.code, text: `${client.name} / ${unit.label}: ورقة ${year} صف ${L.row} بتواريخ (${U().fmtDate(from)} → ${U().fmtDate(to)}) مختلفة عن العقد ${contract.code} — أُنشئت فترة سابقة ${prior.code} مربوطة به` });
          contract = prior;
        } else flags.push({ sev: 'warn', entity: 'contracts', code: contract.code, text: `ورقة ${year} صف ${L.row} تحمل تواريخ (${U().fmtDate(from)} → ${U().fmtDate(to)}) مختلفة عن العقد ${contract.code} (${U().fmtDate(contract.start)} → ${U().fmtDate(contract.end)}) — لم تُطبَّق لأنها ورقة أقدم؛ عدّل العقد من البرنامج أو أضف صفًا للعقد السابق` });
      }
      if (L.note !== (contract.notes || '') && (!snap || (snap.note || '') !== L.note)) contract.notes = L.note;
      if (L.serial != null) contract.ledgerOrder = L.serial;
    }
    // الشهور ⇄ المدفوعات
    const cellNotes = contract.cellNotes || {};
    for (const m of L.months) {
      if (m.text && m.num == null) { cellNotes[m.period] = m.text; flags.push({ sev: 'warn', entity: 'contracts', code: contract.code, text: `${client.name} / ${unit.label}: خانة ${U().periodLabel(m.period, true)} تحتوي نصًا لا رقمًا («${m.text}») — لم تُحتسب كسداد` }); continue; }
      if (cellNotes[m.period] && m.num != null) delete cellNotes[m.period];
      reconcileCell(state, contract, m.period, m.num, snapshot, isNew || migrating, flags);
    }
    if (Object.keys(cellNotes).length) contract.cellNotes = cellNotes; else delete contract.cellNotes;
    // استنتاج الإيجار والزيادة (للعقود الجديدة فقط — العقود الموجودة إيجارها مسجَّل في ورقة العقود)
    if (isNew) inferRent(state, contract, flags, client, unit, migrating);
  }

  /* مطابقة خلية الشهر مع المدفوعات: الورقة المعتادة تتقدم لو تغيّرت عمّا رآه الموقع آخر مرة */
  function reconcileCell(state, contract, period, ledgerVal, snapshot, forceLedger, flags) {
    const pays = state.payments.filter(p => p.contractCode === contract.code && p.period === period);
    const sum = U().sum(pays, p => U().toNum(p.amount));
    const lv = ledgerVal == null ? 0 : ledgerVal;
    if (Math.abs(lv - sum) < 0.5) return;
    if (!forceLedger && snapshot && snapshot.cells) {
      const key = contract.code + '|' + period;
      const snapLedger = snapshot.cells[key];
      if (snapLedger != null && Math.abs((snapLedger || 0) - lv) < 0.5) return; // الورقة لم تتغير ⇒ ورقة المدفوعات هي التي تغيّرت وتتقدم
    }
    // الورقة تغيّرت (أو لا يوجد مرجع): اضبط المدفوعات لتطابق الخلية
    if (lv === 0) { for (const p of pays) state.payments.splice(state.payments.indexOf(p), 1); if (pays.length) flags.push({ sev: 'info', entity: 'contracts', code: contract.code, text: `حُذفت ${pays.length} دفعة لشهر ${U().periodLabel(period, true)} لأن الخلية فُرِّغت في الإكسيل` }); return; }
    if (pays.length === 1) { pays[0].amount = lv; return; }
    if (pays.length > 1) {
      const others = U().sum(pays.slice(0, -1), p => U().toNum(p.amount));
      if (lv - others > 0) { pays[pays.length - 1].amount = lv - others; return; }
      for (const p of pays) state.payments.splice(state.payments.indexOf(p), 1);
    }
    state.payments.push(Object.assign(M().blank.payments(), { code: C().nextInvoice(state, period.slice(0, 4)), contractCode: contract.code, period, amount: lv, paidOn: '', method: '', source: 'excel', createdAt: U().iso(U().today()) }));
  }

  /* استنتاج إيجار كل سنة عقد من المبالغ المسجَّلة في الورقة */
  function inferRent(state, contract, flags, client, unit, migrating) {
    const E_ = E.Engine; if (!E_) return;
    const pays = state.payments.filter(p => p.contractCode === contract.code).sort((a, b) => U().cmp(a.period, b.period));
    const start = U().d(contract.start), end = U().d(contract.end);
    if (!start || !end || !pays.length) { if (!pays.length) flags.push({ sev: 'info', entity: 'contracts', code: contract.code, text: `${client.name} / ${unit.label}: لا توجد مبالغ في الورقة — أدخل الإيجار الشهري من شاشة العقد` }); return; }
    // سنوات العقد
    const years = []; for (let k = 1; k <= 40; k++) { const f = new Date(Date.UTC(start.getUTCFullYear() + k - 1, start.getUTCMonth(), start.getUTCDate())); if (f > end) break; const t0 = U().addDays(new Date(Date.UTC(start.getUTCFullYear() + k, start.getUTCMonth(), start.getUTCDate())), -1); years.push({ k, from: f, to: t0 < end ? t0 : end }); }
    const ov = {};
    for (const y of years) {
      // أول شهر كامل داخل سنة العقد له مبلغ مسجَّل
      for (const p of pays) {
        const mf = U().monthFirst(p.period), ml = U().monthLast(p.period);
        if (mf >= y.from && ml <= y.to && U().toNum(p.amount) > 0) { ov[y.k] = U().toNum(p.amount); break; }
      }
    }
    const ks = Object.keys(ov).map(Number).sort((a, b) => a - b);
    const beforeAll = pays.filter(p => U().monthLast(p.period) < start);
    if (!ks.length) { // لا شهر كامل داخل العقد (عقد بدأ في منتصف شهر قريب): خذ أكبر قيمة متكررة من المبالغ داخل مدته
      const inside = pays.filter(p => U().monthLast(p.period) >= start && U().monthFirst(p.period) <= end);
      const src = inside.length ? inside : pays;
      const freq = new Map(); for (const p of src) { const a = U().toNum(p.amount); freq.set(a, (freq.get(a) || 0) + 1); }
      const best = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
      contract.rent = best ? best[0] : 0; contract.increasePct = 0;
      flags.push({ sev: 'warn', entity: 'contracts', code: contract.code, text: `${client.name} / ${unit.label}: لا يوجد شهر كامل مسجَّل داخل مدة العقد — الإيجار الشهري (${U().fmtMoney(contract.rent)}) تقديري من ${inside.length ? 'المبالغ المقطوعة' : 'مبالغ الورقة'} — صحّحه من شاشة العقد` });
      queuePrior(state, contract, client, unit, beforeAll, start);
      return;
    }
    let inc = null;
    for (let i = 0; i + 1 < ks.length; i++) if (ks[i + 1] === ks[i] + 1 && ov[ks[i]] > 0) { const r = Math.round((ov[ks[i + 1]] / ov[ks[i]] - 1) * 1000) / 10; if (r >= 0 && r <= 60) { inc = r; break; } }
    const k0 = ks[0];
    contract.increasePct = inc == null ? 0 : inc;
    if (inc != null && k0 > 1) contract.rent = Math.round(ov[k0] / Math.pow(1 + inc / 100, k0 - 1)); else contract.rent = ov[k0];
    // تثبيت السنوات الملاحَظة كقيم يدوية حتى تطابق الورقة بالضبط
    contract.rentOverrides = {}; for (const k of ks) if (k > 1 || ov[k] !== contract.rent) contract.rentOverrides[k] = ov[k];
    const parts = [];
    if (k0 > 1 && inc == null) parts.push(`إيجار السنة الأولى غير معروف (الورقة تبدأ من السنة ${k0} للعقد)`);
    if (inc == null && years.length > 1 && end > U().today()) parts.push('الزيادة السنوية غير مسجَّلة — أدخلها من شاشة العقد');
    if (parts.length) flags.push({ sev: 'info', entity: 'contracts', code: contract.code, text: `${client.name} / ${unit.label}: ${parts.join('؛ ')}` });
    queuePrior(state, contract, client, unit, beforeAll, start);
  }
  /* بعد قراءة كل أوراق السنوات (ملف منظَّم بأكثر من سنة): مبالغ قبل بداية العقد، وإيجار سنوات سابقة مختلف عن المفترض */
  function reconcilePriorYears(state, flags) {
    const En = E.Engine; if (!En) return;
    const byContract = U().groupBy(state.payments, p => p.contractCode);
    for (const c of state.contracts) {
      const pays = (byContract.get(c.code) || []).filter(p => p.source !== 'web').sort((a, b) => U().cmp(a.period, b.period));
      if (!pays.length || !U().d(c.start) || !U().d(c.end)) continue;
      const startP = U().periodOf(U().d(c.start));
      const before = pays.filter(p => U().cmp(p.period, startP) < 0);
      if (before.length) {
        if (c.inferred) { const ns = U().iso(U().monthFirst(before[0].period)); flags.push({ sev: 'info', entity: 'contracts', code: c.code, text: `الفترة السابقة ${c.code}: بدايتها التقديرية رُجِّعت إلى ${U().fmtDate(ns)} لوجود مبالغ أقدم في الورقة` }); c.start = ns; }
        else flags.push({ sev: 'warn', entity: 'contracts', code: c.code, text: `${before.length} شهر مسجَّل قبل بداية العقد ${c.code} (${U().fmtDate(c.start)}) في أوراق السنوات — أضف صفًا للعقد السابق في ورقة السنة أو عدّل بداية العقد من البرنامج` });
      }
      // سنوات العقد: لو ورقة سنة سابقة تحمل شهورًا كاملة بمبلغ واحد يختلف عن الإيجار المفترض لتلك السنة ولا يوجد إيجار يدوي لها ⇒ نثبّته بدل اعتبار كل شهر «جزئيًا»
      const s0 = U().d(c.start), e0 = U().d(c.end); c.rentOverrides = c.rentOverrides || {};
      for (let k = 1; k <= 40; k++) {
        const f = new Date(Date.UTC(s0.getUTCFullYear() + k - 1, s0.getUTCMonth(), s0.getUTCDate())); if (f > e0) break;
        if (c.rentOverrides[k] != null) continue;
        const t = U().addDays(new Date(Date.UTC(s0.getUTCFullYear() + k, s0.getUTCMonth(), s0.getUTCDate())), -1);
        const full = pays.filter(p => U().monthFirst(p.period) >= f && U().monthLast(p.period) <= (t < e0 ? t : e0) && U().toNum(p.amount) > 0);
        if (full.length < 2) continue;
        const amounts = new Set(full.map(p => U().toNum(p.amount))); if (amounts.size !== 1) continue;
        const amt = [...amounts][0]; const due = En.dueForMonth(c, full[0].period); const sched = due ? U().toNum(due.amount) : null;
        if (sched == null || Math.abs(sched - amt) <= Math.max((state.settings.toleranceMin || 0), sched * ((state.settings.tolerancePct || 0) / 100))) continue;
        c.rentOverrides[k] = amt;
        flags.push({ sev: 'info', entity: 'contracts', code: c.code, text: `العقد ${c.code}: ${full.length} شهر كامل في السنة ${k} من العقد بمبلغ ${U().fmtMoney(amt)} بدل ${U().fmtMoney(sched)} المفترض — ثُبِّت إيجار تلك السنة على ${U().fmtMoney(amt)} (راجعه من شاشة العقد)` });
      }
    }
  }
  /* دفعات قبل بداية العقد = فترة سابقة لنفس المستأجر ⇒ عقد سابق مستنتج مربوط بالعقد الحالي */
  function queuePrior(state, contract, client, unit, before, start) {
    if (before.length) {
      const first = before.map(p => p.period).sort()[0];
      const priorStart = U().iso(U().monthFirst(first)), priorEnd = U().iso(U().addDays(start, -1));
      const clash = state.contracts.find(c => c.code !== contract.code && c.unitCode === unit.code && U().d(c.start) && U().d(c.end) && U().d(c.start) <= U().d(priorEnd) && U().d(c.end) >= U().d(priorStart));
      if (clash) { flags.push({ sev: 'warn', entity: 'contracts', code: contract.code, text: `${client.name} / ${unit.label}: ${before.length} شهر مسجَّل قبل بداية العقد (${U().fmtDate(contract.start)}) ويتداخل مع العقد ${clash.code} — تُرك كما هو (خارج مدة العقد)` }); return; }
      const freq = new Map(); for (const p of before) { const a = U().toNum(p.amount); freq.set(a, (freq.get(a) || 0) + 1); }
      const mode = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
      // تُنشأ بعد قراءة كل الصفوف حتى تحتفظ صفوف الورقة الأصلية بأكوادها المتسلسلة (T0001…)
      state._priors = state._priors || [];
      state._priors.push({ contract, client, unit, before, priorStart, priorEnd, mode });
    }
  }
  function createPriors(state, flags) {
    for (const q of (state._priors || [])) {
      const { contract, client, unit, before, priorStart, priorEnd, mode } = q;
      const prior = Object.assign(M().blank.contracts(), { code: C().nextContract(state), unitCode: unit.code, clientCode: client.code, start: priorStart, end: priorEnd, rent: mode, increasePct: 0, dueDay: contract.dueDay, inferred: true, ledgerOrder: (contract.ledgerOrder == null ? 0 : contract.ledgerOrder) - 0.5, notes: `فترة سابقة لنفس المستأجر مستنتجة من الورقة (البداية الحقيقية غير معروفة — افتُرضت ${U().fmtDate(priorStart)})` });
      state.contracts.push(prior);
      for (const p of before) p.contractCode = prior.code;
      contract.prevCode = prior.code;
      flags.push({ sev: 'info', entity: 'contracts', code: prior.code, text: `${client.name} / ${unit.label}: ${before.length} شهر مسجَّل قبل بداية العقد الحالي (${U().fmtDate(contract.start)}) — أُنشئ عقد سابق ${prior.code} (${U().fmtDate(priorStart)} → ${U().fmtDate(priorEnd)}، إيجار ${U().fmtMoney(mode)}) مربوط بالعقد ${contract.code}؛ راجع بدايته الحقيقية` });
    }
    delete state._priors;
  }

  /* =====================================================================
     الكتابة
     ===================================================================== */
  async function write(state, opts) {
    opts = opts || {};
    const En = E.Engine, S = E.Store;
    const wb = new (XL().Workbook)();
    // الأوراق غير المعروفة (أضافها المكتب) تُحفظ كما هي: نبدأ من آخر ملف مقروء ونستبدل أوراقنا فقط
    let foreign = [];
    if (opts.base && opts.base.byteLength) {
      try {
        await wb.xlsx.load(opts.base);
        const managed = new Set(Object.values(SH));
        for (const ws of wb.worksheets.slice()) { if (/^\d{4}$/.test(U().foldCode(ws.name)) || managed.has(ws.name)) wb.removeWorksheet(ws.id); else foreign.push(ws.name); }
      } catch (e) { foreign = []; for (const ws of wb.worksheets.slice()) wb.removeWorksheet(ws.id); }
    }
    wb.creator = 'Egary'; wb.created = new Date();
    const asOf = U().today();
    const known = Array.from(new Set((state.settings.ledgerYears || []).concat(state.payments.map(p => parseInt(p.period.slice(0, 4), 10))).concat([asOf.getUTCFullYear()]))).filter(y => y > 1900).sort((a, b) => a - b);
    // كل السنوات من الأقدم إلى الأحدث بلا فجوات: سنة بلا ورقة لا يمكن تسجيل مبالغها
    const years = []; for (let y = known[0]; y <= known[known.length - 1]; y++) years.push(y);
    state.settings.ledgerYears = years;
    const sheetsMeta = {};
    for (const y of years) sheetsMeta[y] = writeLedger(wb, state, String(y), asOf);
    const reportYear = years.filter(y => y <= asOf.getUTCFullYear()).pop() || years[years.length - 1]; // ملخص المشاريع لسنة التقرير لا لسنة قادمة فارغة
    writeSummary(wb, state, String(reportYear), sheetsMeta[reportYear]);
    writeProjects(wb, state, asOf); writeUnits(wb, state, asOf); writeAssets(wb, state); writeClients(wb, state, asOf); writeContracts(wb, state, asOf); writePayments(wb, state); writeMaintenance(wb, state, asOf); writeSettings(wb, state); writeAudit(wb, state); writeUsers(wb, state);
    // ترتيب الأوراق: أوراق السنوات ثم الملخص ثم أوراقنا ثم أوراق المكتب
    let order = 1; for (const ws of wb.worksheets) if (!foreign.includes(ws.name)) ws.orderNo = order++;
    for (const name of foreign) { const ws = wb.getWorksheet(name); if (ws) ws.orderNo = order++; }
    wb.calcProperties = { fullCalcOnLoad: true };
    wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: 'visible', rightToLeft: true }];
    const buf = await wb.xlsx.writeBuffer();
    return buf instanceof ArrayBuffer ? buf : new Uint8Array(buf).buffer.slice(buf.byteOffset || 0, (buf.byteOffset || 0) + buf.byteLength);
  }

  function ledgerRows(state, year) {
    const S = E.Store, En = E.Engine;
    const rows = [];
    for (const c of state.contracts) {
      const s = U().d(c.start), e = U().d(c.end);
      const pays = S.paymentsOf(c.code).filter(p => p.period.startsWith(year));
      const overlaps = s && e && s <= U().d(year + '-12-31') && e >= U().d(year + '-01-01');
      const notes = c.cellNotes && Object.keys(c.cellNotes).some(k => k.startsWith(year));
      if (!pays.length && !overlaps && !notes) continue;
      rows.push(c);
    }
    rows.sort((a, b) => (a.ledgerOrder == null ? 1e9 : a.ledgerOrder) - (b.ledgerOrder == null ? 1e9 : b.ledgerOrder) || U().cmp(a.unitCode, b.unitCode) || U().cmp(a.start, b.start));
    return rows;
  }
  function writeLedger(wb, state, year, asOf) {
    const S = E.Store;
    const ws = wb.addWorksheet(year, { views: [{ state: 'frozen', xSplit: 5, ySplit: 2, rightToLeft: true }] });
    ws.getCell('K1').value = year; ws.mergeCells('K1:V1'); ws.getCell('K1').font = { bold: true, size: 14 }; ws.getCell('K1').alignment = { horizontal: 'center' };
    ws.getCell('A1').value = state.meta.officeName || 'إيجاري'; ws.getCell('A1').font = { bold: true, size: 12, color: { argb: STYLE.head } };
    ws.getRow(2).values = LEDGER_HEAD; styleHeader(ws.getRow(2));
    const widths = [5, 12, 34, 30, 12, 26, 12, 12, 13, 18, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 14, 40, 11, 12, 11, 12];
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    const rows = ledgerRows(state, year);
    const projIdx = new Map(state.projects.map((p, i) => [p.code, i]));
    let r = 3, serial = 1; const colSums = {};
    const monthFirstCol = 11;
    for (const c of rows) {
      const cl = S.client(c.clientCode) || {}, u = S.unit(c.unitCode) || {}, p = S.project(u.projectCode) || {};
      const row = ws.getRow(r);
      row.getCell(1).value = serial++;
      row.getCell(2).value = p.name || ''; row.getCell(3).value = cl.name || ''; row.getCell(4).value = cl.rep || (cl.kind === 'person' ? cl.name : '') || '';
      row.getCell(5).value = u.label || ''; row.getCell(6).value = p.address || '';
      row.getCell(7).value = toDate(c.start); row.getCell(8).value = toDate(c.end);
      row.getCell(7).numFmt = 'dd/mm/yyyy'; row.getCell(8).numFmt = 'dd/mm/yyyy';
      row.getCell(9).value = cl.taxId || ''; row.getCell(9).numFmt = '@'; row.getCell(10).value = cl.nationalId || ''; row.getCell(10).numFmt = '@';
      let rowSum = 0;
      for (let m = 1; m <= 12; m++) {
        const period = year + '-' + U().pad(m, 2);
        const pays = S.paymentsOfCell(c.code, period); const sum = U().sum(pays, x => U().toNum(x.amount));
        const cell = row.getCell(monthFirstCol + m - 1);
        if (pays.length) { cell.value = Math.round(sum * 100) / 100; rowSum += cell.value; colSums[m] = (colSums[m] || 0) + cell.value; } else if (c.cellNotes && c.cellNotes[period]) cell.value = c.cellNotes[period]; else cell.value = null;
        cell.numFmt = '#,##0.00';
      }
      colSums[13] = (colSums[13] || 0) + rowSum;
      row.getCell(23).value = { formula: `SUM(K${r}:V${r})`, result: rowSum }; row.getCell(23).numFmt = '#,##0.00'; row.getCell(23).font = { bold: true };
      row.getCell(24).value = c.notes || '';
      row.getCell(25).value = c.code; row.getCell(26).value = c.unitCode; row.getCell(27).value = c.clientCode; row.getCell(28).value = p.code || '';
      const fill = STYLE.rowFills[(projIdx.get(p.code) || 0) % STYLE.rowFills.length];
      row.eachCell({ includeEmpty: true }, (cell, col) => { if (col <= 28) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }; cell.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } }; } });
      for (let col = 25; col <= 28; col++) row.getCell(col).font = { color: { argb: 'FF7F7F7F' }, size: 9 };
      r++;
    }
    const last = r - 1;
    const tr = ws.getRow(r);
    tr.getCell(3).value = 'الاجمالي العام'; tr.getCell(3).font = { bold: true };
    for (let col = 11; col <= 23; col++) { const L = ws.getColumn(col).letter; tr.getCell(col).value = last >= 3 ? { formula: `SUM(${L}3:${L}${last})`, result: Math.round((colSums[col - 10] || 0) * 100) / 100 } : 0; tr.getCell(col).numFmt = '#,##0.00'; tr.getCell(col).font = { bold: true }; }
    tr.eachCell({ includeEmpty: true }, (cell, col) => { if (col <= 28) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLE.total } }; });
    ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: Math.max(2, last), column: 28 } };
    return { firstRow: 3, lastRow: Math.max(3, last), totalRow: r, count: rows.length, byProject: rows.reduce((m, c) => { const u = S.unit(c.unitCode) || {}; const pc = u.projectCode || ''; m[pc] = m[pc] || { n: 0, sum: 0 }; m[pc].n++; m[pc].sum += U().sum(S.paymentsOf(c.code).filter(x => x.period.startsWith(year)), x => U().toNum(x.amount)); return m; }, {}) };
  }
  function writeSummary(wb, state, year, meta) {
    const En = E.Engine;
    const ws = wb.addWorksheet(SH.summary, { views: [{ state: 'frozen', ySplit: 1, rightToLeft: true }] });
    ws.getRow(1).values = ['المشروع', `عدد الصفوف في ${year}`, `إجمالي ${year}`, 'عدد الوحدات', 'مؤجَّرة', 'شاغرة', 'نسبة الإشغال', 'المتأخرات', 'كود المشروع']; styleHeader(ws.getRow(1));
    [18, 16, 18, 12, 10, 10, 12, 16, 12].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    let r = 2;
    for (const p of state.projects) {
      const k = En.kpis({ projectCode: p.code });
      ws.getCell(r, 1).value = p.name;
      const bp = (meta.byProject && meta.byProject[p.code]) || { n: 0, sum: 0 };
      ws.getCell(r, 2).value = { formula: `COUNTIF('${year}'!B${meta.firstRow}:B${meta.lastRow},A${r})`, result: bp.n };
      ws.getCell(r, 3).value = { formula: `SUMIF('${year}'!B${meta.firstRow}:B${meta.lastRow},A${r},'${year}'!W${meta.firstRow}:W${meta.lastRow})`, result: Math.round(bp.sum * 100) / 100 }; ws.getCell(r, 3).numFmt = '#,##0.00';
      ws.getCell(r, 4).value = k.occupancy.total; ws.getCell(r, 5).value = k.occupancy.occupiedCount; ws.getCell(r, 6).value = k.occupancy.vacant.length;
      ws.getCell(r, 7).value = k.occupancy.rate == null ? '' : k.occupancy.rate; ws.getCell(r, 7).numFmt = '0%';
      ws.getCell(r, 8).value = k.arrears.total; ws.getCell(r, 8).numFmt = '#,##0';
      ws.getCell(r, 9).value = p.code;
      r++;
    }
    ws.getCell(r, 1).value = 'الاجمالي'; ws.getCell(r, 1).font = { bold: true };
    for (const col of [2, 3, 4, 5, 6, 8]) { const L = ws.getColumn(col).letter; let tot = 0; for (let rr = 2; rr < r; rr++) { const v = ws.getCell(rr, col).value; tot += U().toNum(v) || 0; } ws.getCell(r, col).value = r > 2 ? { formula: `SUM(${L}2:${L}${r - 1})`, result: Math.round(tot * 100) / 100 } : 0; ws.getCell(r, col).font = { bold: true }; ws.getCell(r, col).numFmt = col === 3 ? '#,##0.00' : '#,##0'; }
    ws.getRow(r).eachCell({ includeEmpty: true }, (cell, col) => { if (col <= 9) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLE.total } }; });
  }
  function table(wb, name, entity, records, extra, opts) {
    opts = opts || {};
    const cols = COLS[entity];
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', xSplit: opts.xSplit || 1, ySplit: 1, rightToLeft: true }] });
    ws.getRow(1).values = cols.map(c => c[1]); styleHeader(ws.getRow(1));
    cols.forEach((c, i) => { ws.getColumn(i + 1).width = opts.widths && opts.widths[i] ? opts.widths[i] : (c[0] === 'notes' || c[0] === 'description' || c[0] === '_schedule' || c[0] === '_assets' ? 36 : c[1].length > 14 ? 20 : 14); });
    let r = 2;
    for (const rec of records) {
      const ex = extra ? extra(rec) : {};
      cols.forEach((c, i) => {
        const field = c[0]; let v = field.startsWith('_') ? ex[field] : rec[field];
        const cell = ws.getCell(r, i + 1);
        if (DATE_FIELDS.has(field)) { cell.value = toDate(v); cell.numFmt = 'dd/mm/yyyy'; }
        else if (field === 'rentOverrides') cell.value = fmtOverrides(v);
        else if (field === 'present') cell.value = v ? 'نعم' : 'لا';
        else if (field === 'inferred') cell.value = v ? 'نعم' : '';
        else if (field === 'enabled') cell.value = v === false ? 'لا' : 'نعم';
        else if (field === 'passwordHash') { cell.value = v == null ? '' : String(v); cell.numFmt = '@'; }
        else if (LISTS[entity + '.' + field]) cell.value = M().label(LISTS[entity + '.' + field](), v == null ? '' : v);
        else if (field === 'nationalId' || field === 'taxId' || field === 'phone' || field === 'phone2') { cell.value = v == null ? '' : String(v); cell.numFmt = '@'; }
        else if (field === 'period') { cell.value = v == null ? '' : String(v); cell.numFmt = '@'; }
        else if (NUM_FIELDS.has(field) || typeof v === 'number' || v === null) { cell.value = v == null || v === '' ? null : v; if (['rent', 'deposit', 'amount', 'cost', '_currentRent', '_paid', '_arrears', '_rent', '_ytd'].includes(field)) cell.numFmt = '#,##0.00'; }
        else cell.value = v == null ? '' : v;
        if (field.startsWith('_')) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLE.computed } }; cell.font = { color: { argb: 'FF595959' } }; }
      });
      r++;
    }
    const lastRow = Math.max(r - 1, 2);
    cols.forEach((c, i) => { const lk = LISTS[entity + '.' + c[0]]; if (lk) listValidation(ws, i + 1, 2, Math.max(lastRow, 200), lk().map(x => x.ar).filter(Boolean)); });
    if (entity === 'assets') listValidation(ws, 3, 2, Math.max(lastRow, 400), ['نعم', 'لا']);
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: lastRow, column: cols.length } };
    return ws;
  }
  function writeProjects(wb, state, asOf) { const En = E.Engine; table(wb, SH.projects, 'projects', state.projects, p => { const k = En.kpis({ projectCode: p.code }, asOf); return { _units: k.occupancy.total, _occupied: k.occupancy.occupiedCount, _vacant: k.occupancy.vacant.length, _arrears: k.arrears.total, _ytd: k.ytd.collected }; }, { widths: [12, 22, 30, 14, 30, 14, 12, 12, 12, 14, 16] }); }
  function writeUnits(wb, state, asOf) {
    const En = E.Engine, S = E.Store;
    table(wb, SH.units, 'units', state.units, u => { const s = En.unitStatus(u, asOf); const cl = s.contract ? S.client(s.contract.clientCode) : null; return { _project: (S.project(u.projectCode) || {}).name || '', _assets: (u.assets || []).filter(a => a.present).map(a => a.name + (a.details ? ' (' + a.details + ')' : '')).join(' · '), _status: En.USTATUS_AR[s.status], _tenant: cl ? cl.name : '', _contract: s.contract ? s.contract.code : '', _rent: s.contract ? En.currentRent(s.contract, asOf) : null, _vacantSince: s.vacantSince ? U().fmtDate(s.vacantSince) : '', _vacantDays: s.vacantDays == null ? null : s.vacantDays, _statusKey: s.status }; }, { widths: [12, 12, 16, 16, 10, 8, 10, 30, 14, 36, 14, 26, 12, 14, 14, 12], xSplit: 1 });
  }
  function writeAssets(wb, state) { const rows = []; for (const u of state.units) for (const a of (u.assets || [])) rows.push({ unitCode: u.code, name: a.name, present: !!a.present, details: a.details || '' }); table(wb, SH.assets, 'assets', rows, null, { widths: [12, 20, 10, 40] }); }
  function writeClients(wb, state, asOf) {
    const En = E.Engine, S = E.Store;
    table(wb, SH.clients, 'clients', state.clients, c => { const cs = S.contractsOfClient(c.code); const sc = { contracts: cs, contractSet: new Set(cs.map(x => x.code)) }; const ar = En.arrears(sc, asOf); return { _contracts: cs.length, _active: cs.filter(x => En.contractStatus(x, asOf) === 'active').length, _arrears: ar.total, _paid: U().sum(cs, x => U().sum(S.paymentsOf(x.code), p => U().toNum(p.amount))) }; }, { widths: [10, 34, 8, 28, 18, 14, 14, 14, 20, 26, 30, 12, 10, 10, 14, 16] });
  }
  function writeContracts(wb, state, asOf) {
    const En = E.Engine, S = E.Store;
    table(wb, SH.contracts, 'contracts', state.contracts, c => { const u = S.unit(c.unitCode) || {}, cl = S.client(c.clientCode) || {}, p = S.project(u.projectCode) || {}; const sc = { contracts: [c], contractSet: new Set([c.code]) }; return { _project: p.name || '', _unit: u.label || '', _client: cl.name || '', _status: En.CSTATUS_AR[En.contractStatus(c, asOf)], _currentRent: En.currentRent(c, asOf), _paid: U().sum(S.paymentsOf(c.code), x => U().toNum(x.amount)), _arrears: En.arrears(sc, asOf).total, _schedule: En.schedule(c).map(y => `س${y.k} ${U().fmtDate(y.from)}–${U().fmtDate(y.to)}: ${U().fmtNum(y.rent)}`).join(' | '), _statusKey: En.contractStatus(c, asOf), _daysLeft: U().d(c.end) ? U().daysBetween(asOf, U().d(c.end)) : null }; }, { widths: [10, 12, 10, 14, 12, 30, 12, 12, 16, 10, 22, 12, 14, 10, 12, 36, 10, 12, 16, 14, 14, 14, 60] });
  }
  function writePayments(wb, state) { const S = E.Store; const rows = state.payments.slice().sort((a, b) => U().cmp(a.period, b.period) || U().cmp(a.code, b.code)); table(wb, SH.payments, 'payments', rows, p => { const c = S.contract(p.contractCode); const cl = c ? S.client(c.clientCode) : null, u = c ? S.unit(c.unitCode) : null; return { _client: cl ? cl.name : '', _unit: u ? u.label : '' }; }, { widths: [16, 10, 30, 12, 10, 14, 12, 14, 16, 30, 10, 12] }); }
  function writeMaintenance(wb, state, asOf) { const En = E.Engine, S = E.Store; table(wb, SH.maintenance, 'maintenance', state.maintenance, m => { const u = S.unit(m.unitCode); const c = m.custodianContract ? S.contract(m.custodianContract) : (u ? En.activeContractOf(u.code, U().d(m.date) || asOf) : null); const cl = c ? S.client(c.clientCode) : null; return { _project: u ? (S.project(u.projectCode) || {}).name || '' : '', _unit: u ? u.label : '', _custodian: m.custodianName || (cl ? cl.name : ''), _custodianContract: c ? c.code : '' }; }, { widths: [10, 12, 14, 12, 12, 12, 40, 12, 12, 10, 12, 30, 12, 12, 26, 26, 12] }); }
  function writeSettings(wb, state) {
    const ws = wb.addWorksheet(SH.settings, { views: [{ state: 'frozen', ySplit: 1, rightToLeft: true }] });
    ws.getRow(1).values = ['الإعداد', 'القيمة', 'الشرح']; styleHeader(ws.getRow(1)); ws.getColumn(1).width = 30; ws.getColumn(2).width = 20; ws.getColumn(3).width = 60;
    const help = { enteredThrough: 'الشهور بعده تُعرض «بانتظار التسجيل» لا «متأخرة»', tolerancePct: 'يُقبل المبلغ كسداد كامل لو الفرق أقل من هذه النسبة', toleranceMin: 'حد أدنى للفرق المقبول بالجنيه', prorationBasis: '30 = الشهر 30 يومًا (النصف 15/30) كما يحسب المكتب', officeName: 'يظهر أعلى الورقة والموقع', graceDays: 'بعدها يُعتبر الشهر متأخرًا', dueDay: 'يوم الشهر الذي يستحق فيه الإيجار ما لم يحدد العقد غيره', vacancyMonths: 'الوحدة الشاغرة أطول من ذلك تظهر كتنبيه', trackingFrom: 'الشهور قبله لا تُحاسَب (بداية الورقة)', defaultIncreasePct: 'تُقترح عند إنشاء عقد جديد', ledgerYears: 'أوراق السنوات الموجودة (تُضاف تلقائيًا)', codeSeq: 'لا تُعدَّل: تضمن ألا يُعاد استخدام كود محذوف', trackingMode: 'auto = تبدأ من أقدم ورقة سنة · manual = كما ضبطها المدير', invoicePrefix: 'مثل INV-2026-0001', currency: 'رمز العملة في العرض' };
    let r = 2;
    for (const s of SETTINGS_KEYS) { ws.getCell(r, 1).value = s.ar; const v = s.key === 'officeName' ? state.meta.officeName : state.settings[s.key]; ws.getCell(r, 2).value = Array.isArray(v) ? v.join(', ') : (v && typeof v === 'object' ? JSON.stringify(v) : (v == null ? '' : v)); ws.getCell(r, 3).value = help[s.key] || ''; r++; }
    ws.getCell(r + 1, 1).value = 'آخر كتابة من الموقع'; ws.getCell(r + 1, 2).value = new Date().toISOString().slice(0, 19).replace('T', ' ');
    ws.getCell(r + 2, 1).value = 'إصدار البنية'; ws.getCell(r + 2, 2).value = 2;
  }
  /* ورقة المستخدمين: مخفية في الإكسيل (المدير يستطيع إظهارها)، كلمة المرور مشفّرة لا تُقرأ */
  function writeUsers(wb, state) {
    const ws = table(wb, SH.users, 'users', (state.users || []).slice().sort((a, b) => U().cmp(a.code, b.code)), null, { widths: [18, 24, 14, 90, 10, 14, 20] });
    ws.state = 'hidden';
    return ws;
  }
  function writeAudit(wb, state) {
    const ws = wb.addWorksheet(SH.audit, { views: [{ state: 'frozen', ySplit: 1, rightToLeft: true }] });
    ws.getRow(1).values = ['الوقت', 'العملية', 'الكيان', 'الكود', 'التفاصيل', 'المستخدم']; styleHeader(ws.getRow(1)); [20, 10, 10, 14, 60, 18].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    let r = 2; for (const a of (state.audit || []).slice(0, 500)) { ws.getRow(r).values = [a.at, a.action, a.entity, a.code, a.summary, a.user || '']; r++; }
  }

  /* لقطة لما كتبه/قرأه الموقع آخر مرة (لمعرفة أي جهة تغيّرت عند التعارض) */
  function snapshotOf(state) {
    const cells = {}, rows = {};
    for (const p of state.payments) { const k = p.contractCode + '|' + p.period; cells[k] = (cells[k] || 0) + (U().toNum(p.amount) || 0); }
    for (const c of state.contracts) { const cl = (state.clients.find(x => x.code === c.clientCode) || {}), u = (state.units.find(x => x.code === c.unitCode) || {}), p = (state.projects.find(x => x.code === u.projectCode) || {}); rows[c.code] = { start: c.start, end: c.end, note: c.notes || '', name: cl.name || '', rep: cl.rep || '', nid: cl.nationalId || '', tax: cl.taxId || '', label: u.label || '', addr: p.address || '' }; }
    return { cells, rows, at: new Date().toISOString() };
  }

  E.Workbook = { read, write, snapshotOf, SH, COLS, LEDGER_HEAD, SETTINGS_KEYS, fmtOverrides, parseOverrides };
})(window.Egary);
