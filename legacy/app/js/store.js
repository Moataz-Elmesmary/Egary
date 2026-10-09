/* =========================================================
   store.js — الحالة، الحفظ المحلي، ومحرّك الاستحقاق
   مبدأ حاكم: الحالة محسوبة لا مكتوبة، والنظام يفرّق بين
   «متأخر مؤكَّد» و«غير موثَّق» — الورق لا يفرّق بينهما.
   ========================================================= */
(function () {
  'use strict';

  const LS_KEY = 'skr-rms-v4';
  const DAY = 24 * 60 * 60 * 1000;

  /* ---------- أدوات تاريخ (كلها UTC لتفادي انزياح المناطق الزمنية) ---------- */
  function d(iso) { // 'YYYY-MM-DD' → Date (UTC)
    const [y, m, dd] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, dd));
  }
  function iso(date) {
    return date.toISOString().slice(0, 10);
  }
  function today() {
    const n = new Date();
    return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
  }
  function monthFirst(period) { return d(period + '-01'); }
  function monthLast(period) {
    const [y, m] = period.split('-').map(Number);
    return new Date(Date.UTC(y, m, 0));
  }
  function daysInMonth(period) { return monthLast(period).getUTCDate(); }
  function periodOf(date) {
    return date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0');
  }
  function addMonths(period, n) {
    const [y, m] = period.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1 + n, 1));
    return periodOf(t);
  }
  function cmpPeriod(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function daysBetween(a, b) { return Math.round((b - a) / DAY); }

  const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                     'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  function periodLabel(period, withYear) {
    const [y, m] = period.split('-').map(Number);
    return MONTHS_AR[m - 1] + (withYear ? ' ' + y : '');
  }

  /* ---------- تحميل/حفظ الحالة ---------- */
  let STATE = null;
  const listeners = [];

  function freshFromSeed() {
    return JSON.parse(JSON.stringify({
      meta: SEED.meta, settings: SEED.settings, buildings: SEED.buildings,
      tenants: SEED.tenants, units: SEED.units, contracts: SEED.contracts,
      marks: SEED.marks, payments: SEED.payments, complaints: SEED.complaints,
      issues: SEED.issues, log: SEED.log || [], seedVersion: SEED.version,
    }));
  }
  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.seedVersion === SEED.version) { STATE = parsed; ensureCodes(); return; }
      }
    } catch (e) { /* تخزين تالف → بذرة جديدة */ }
    STATE = freshFromSeed();
    ensureCodes();
    save();
  }

  /* أكواد قصيرة ثابتة قابلة للبحث: المشروع P1 والوحدة P1-01 —
     تُولَّد مرة واحدة للبيانات القائمة (ترقية بلا مسح) وكود العميل = رقمه القومي يُدخل يدويًا */
  function pad2(n) { return String(n).padStart(2, '0'); }
  function ensureCodes() {
    let changed = false;
    STATE.buildings.forEach((b, i) => { if (!b.code) { b.code = 'P' + (i + 1); changed = true; } });
    for (const b of STATE.buildings) {
      let n = 0;
      for (const u of STATE.units.filter(u => u.buildingId === b.id)) {
        n++;
        if (!u.code) { u.code = b.code + '-' + pad2(n); changed = true; }
      }
    }
    if (changed) save();
  }
  function nextUnitCode(buildingId) {
    const b = building(buildingId);
    if (!b || !b.code) return null;
    const used = new Set(STATE.units.filter(u => u.buildingId === buildingId).map(u => u.code));
    let n = STATE.units.filter(u => u.buildingId === buildingId).length + 1;
    while (used.has(b.code + '-' + pad2(n))) n++;
    return b.code + '-' + pad2(n);
  }
  function nextBuildingCode() {
    const used = new Set(STATE.buildings.map(b => b.code));
    let n = STATE.buildings.length + 1;
    while (used.has('P' + n)) n++;
    return 'P' + n;
  }
  /* توحيد شكل الكود قبل المقارنة: الأرقام العربية والهندية سواء، وبلا مسافات —
     وإلا سُجِّل الرقم القومي نفسه لعميلَين لمجرد اختلاف شكل الأرقام */
  const CODE_DIGITS = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  };
  function foldCode(s) {
    return String(s == null ? '' : s).replace(/[٠-٩۰-۹]/g, d => CODE_DIGITS[d] || d).replace(/\s+/g, '');
  }
  function tenantByCode(code) {
    const c = foldCode(code);
    return c ? STATE.tenants.find(t => foldCode(t.code) === c) || null : null;
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(STATE)); } catch (e) { /* تخزين ممتلئ */ }
  }
  function commit() { IDX = null; CELL_CACHE = new Map(); CELL_SIG = -1; save(); listeners.forEach(fn => fn()); }
  function subscribe(fn) { listeners.push(fn); }
  function resetData() { STATE = freshFromSeed(); ensureCodes(); commit(); }

  /* سجل الحركة — كل عملية إدخال تُسجَّل بوقتها */
  function logAct(txt) {
    STATE.log.unshift({ at: new Date().toISOString().slice(0, 16).replace('T', ' '), txt });
    if (STATE.log.length > 60) STATE.log.pop();
  }

  /* ---------- فهارس ----------
     بدونها كل قراءة تمشي على المصفوفات كلها، فتتضاعف التكلفة مع كل مشروع جديد.
     تُبنى مرة وتُبطَل عند أي تعديل (commit) أو عند تغيّر أعداد السجلات. */
  let IDX = null;
  function idxSig() {
    return STATE.units.length + STATE.contracts.length * 7 + STATE.payments.length * 13
      + STATE.marks.length * 17 + STATE.tenants.length * 23 + STATE.buildings.length * 29;
  }
  function idx() {
    if (IDX && IDX.sig === idxSig()) return IDX;
    const byB = new Map(), byU = new Map(), byT = new Map(), byC = new Map();
    const csByUnit = new Map(), payByCell = new Map(), markByCell = new Map(), nextByPrev = new Map();
    for (const b of STATE.buildings) byB.set(b.id, b);
    for (const u of STATE.units) byU.set(u.id, u);
    for (const t of STATE.tenants) byT.set(t.id, t);
    for (const c of STATE.contracts) {
      byC.set(c.id, c);
      let arr = csByUnit.get(c.unitId);
      if (!arr) { arr = []; csByUnit.set(c.unitId, arr); }
      arr.push(c);
      if (c.prevId) nextByPrev.set(c.prevId, c);
    }
    for (const arr of csByUnit.values()) arr.sort((a, b) => (a.start < b.start ? -1 : 1));
    for (const p of STATE.payments) {
      const k = p.unitId + '|' + p.period;
      let arr = payByCell.get(k);
      if (!arr) { arr = []; payByCell.set(k, arr); }
      arr.push(p);
    }
    for (const mk of STATE.marks) markByCell.set(mk.unitId + '|' + mk.period, mk);
    IDX = { sig: idxSig(), byB, byU, byT, byC, csByUnit, payByCell, markByCell, nextByPrev, empty: [] };
    return IDX;
  }
  function building(id) { return idx().byB.get(id) || null; }
  function unit(id) { return idx().byU.get(id) || null; }
  function tenant(id) { return idx().byT.get(id) || null; }
  function contract(id) { return idx().byC.get(id) || null; }
  function unitContracts(unitId) {
    const i = idx();
    return i.csByUnit.get(unitId) || i.empty;
  }
  function nextContract(c) { return idx().nextByPrev.get(c.id) || null; }
  function activeContractOn(unitId, date) {
    return unitContracts(unitId).find(c => d(c.start) <= date && date <= d(c.end)) || null;
  }
  function contractsOverlappingMonth(unitId, period) {
    const cs = unitContracts(unitId);
    if (!cs.length) return [];
    const f = monthFirst(period), l = monthLast(period);
    return cs.filter(c => d(c.start) <= l && d(c.end) >= f);
  }
  function unitsIn(uset) {
    return uset ? STATE.units.filter(u => uset.has(u.id)) : STATE.units;
  }

  /* ---------- محرّك الاستحقاق ----------
     قيمة الإيجار مربوطة بسنة العقد: الشهر الذي يقطع سنتَي عقد
     يُحسب باليوم على القيمتين. rentBasis سنوي ⇒ القيمة ÷ 12.
     الاستحقاق الشهري = إيجار + صيانة (البند الرابع) + ض.ق.م إن كان العقد خاضعًا (البند العاشر). */
  function monthlyRate(rent) {
    return STATE.settings.rentBasis === 'annual' ? rent / 12 : rent;
  }
  function dueForMonth(c, period) {
    const f = monthFirst(period), l = monthLast(period), dim = daysInMonth(period);
    let rentAmt = 0, estimated = false, covered = 0;
    for (const y of (c.years || [])) {
      const a = d(y.from) > f ? d(y.from) : f;
      const b = d(y.to) < l ? d(y.to) : l;
      if (a > b) continue;
      const days = daysBetween(a, b) + 1;
      covered += days;
      rentAmt += monthlyRate(y.rent) * (days / dim);
      if (y.estimated) estimated = true;
    }
    if (covered === 0) return null;
    const mnt = (c.maintenance || 0) * (covered / dim);
    let amount = rentAmt + mnt, vat = 0;
    if (c.vat) { vat = amount * (STATE.settings.vatPct / 100); amount += vat; }
    return {
      amount: Math.round(amount), rent: Math.round(rentAmt),
      maintenance: Math.round(mnt), vat: Math.round(vat),
      estimated, coveredDays: covered, fullMonth: covered === dim,
    };
  }
  /* يوم الاستحقاق داخل الشهر (افتراضيًا أول الشهر) */
  function dueDateOf(c, period) {
    const dd = c && c.dueDay ? Math.min(c.dueDay, daysInMonth(period)) : 1;
    return d(period + '-' + String(dd).padStart(2, '0'));
  }

  /* ---------- سداد شهر لوحدة ---------- */
  function paymentsFor(unitId, period) {
    const i = idx();
    return i.payByCell.get(unitId + '|' + period) || i.empty;
  }
  function markFor(unitId, period) {
    return idx().markByCell.get(unitId + '|' + period) || null;
  }

  /* الحالة المركّبة لشهر × وحدة — قلب النظام كله.
     تُستدعى آلاف المرات في الرسمة الواحدة (متأخرات، إجماليات، ألارم، تقييم…)
     ونتيجتها ثابتة ما دامت البيانات لم تتغير، فتُحفظ في ذاكرة تُبطَل مع الفهرس. */
  let CELL_CACHE = new Map(), CELL_SIG = -1;
  function cellInfo(unitId, period, asOf) {
    asOf = asOf || today();
    const i = idx();
    if (CELL_SIG !== i.sig) { CELL_CACHE = new Map(); CELL_SIG = i.sig; }
    const key = unitId + '|' + period + '|' + asOf.getTime();
    const hit = CELL_CACHE.get(key);
    if (hit) return hit;
    const res = computeCell(unitId, period, asOf);
    CELL_CACHE.set(key, res);
    return res;
  }
  function computeCell(unitId, period, asOf) {
    const cov = STATE.meta.importCoverage;
    const u = unit(unitId);
    const cs = contractsOverlappingMonth(unitId, period);
    const c = cs[0] || null;
    const due = c ? dueForMonth(c, period) : null;
    // دفعة مختومة بعقد متداخل آخر لا تُحسب على عقد هذا الشهر — لكل عقد دفعاته
    const pays = paymentsFor(unitId, period)
      .filter(p => !p.contractId || !c || p.contractId === c.id || !cs.some(cc => cc.id === p.contractId));
    const entered = pays.reduce((s, p) => s + (p.amount || 0), 0);
    const mark = markFor(unitId, period);
    const dueDate = dueDateOf(c, period);
    const overdueDays = daysBetween(dueDate, asOf);
    const grace = STATE.settings.graceDays;

    const base = {
      unitId, period, contract: c, due, mark,
      payments: pays, paid: entered, overdueDays, dueDate: iso(dueDate),
    };

    // خارج أي عقد — علامة ✗ المؤكدة تتقدم على أي دفعة جزئية:
    // دَين مؤكد بقيمة مجهولة لا يُمحى بتحصيل لا يُعرف هل غطّاه
    if (!c) {
      if (mark && mark.mark === 'unpaid')
        return { ...base, status: 'late', confirmed: true, unknownAmount: true };
      if (pays.length || (mark && mark.mark === 'paid'))
        return { ...base, status: 'orphan_paid' };            // سداد بلا عقد مسجّل
      return { ...base, status: 'none' };
    }

    // داخل عقد
    if (pays.length) {
      const target = due ? due.amount : null;
      if (target != null && entered >= target - 1) {
        const lastDate = pays.map(p => p.date).filter(Boolean).sort().pop();
        const late = lastDate && daysBetween(dueDate, d(lastDate)) > grace;
        return { ...base, status: late ? 'paid_late' : 'paid', paidDate: lastDate || null };
      }
      if (entered > 0) return { ...base, status: 'partial', remaining: due ? due.amount - entered : null };
    }
    if (mark && mark.mark === 'paid' && !pays.length)
      return { ...base, status: 'paid_imported', paid: due ? due.amount : 0, assumed: true };
    if (mark && mark.mark === 'unpaid')
      return { ...base, status: 'late', confirmed: true, remaining: due ? due.amount - entered : null };

    // لا سجل إطلاقًا
    const covered = cov && (!cov.buildingId || (u && u.buildingId === cov.buildingId));
    if (covered && cmpPeriod(period, cov.from) < 0)
      return { ...base, status: 'history' };                  // قبل تغطية الكشف — غير متتبَّع
    if (covered && cmpPeriod(period, cov.to) <= 0)
      return { ...base, status: 'unknown' };                  // داخل التغطية بلا علامة — غير موثَّق
    if (cmpPeriod(period, periodOf(asOf)) > 0)
      return { ...base, status: 'upcoming' };
    if (overdueDays > grace)
      return { ...base, status: 'late', remaining: due ? due.amount - entered : null };
    if (cmpPeriod(period, periodOf(asOf)) === 0)
      return { ...base, status: 'due', remaining: due ? due.amount - entered : null };
    return { ...base, status: 'due', remaining: due ? due.amount - entered : null };
  }

  /* ---------- تجميعات BI (كلها تقبل uset: مجموعة وحدات مرشَّحة) ---------- */
  function allCellInfos(period, asOf, uset) {
    return unitsIn(uset).map(u => cellInfo(u.id, period, asOf));
  }

  /* المتأخرات المؤكدة + الأعمار، والمجهول منفصل — لا يُخلط تقدير بحقيقة */
  function arrears(asOf, uset) {
    asOf = asOf || today();
    const to = periodOf(asOf);
    const rows = [], unknowns = [], undocumented = [];
    for (const u of unitsIn(uset)) {
      const cs = unitContracts(u.id);
      let from = STATE.meta.importCoverage.from;
      if (u.buildingId !== STATE.meta.importCoverage.buildingId && cs.length)
        from = periodOf(d(cs[0].start));
      if (cmpPeriod(from, STATE.meta.importCoverage.from) < 0) from = STATE.meta.importCoverage.from;
      for (let p = from; cmpPeriod(p, to) <= 0; p = addMonths(p, 1)) {
        const ci = cellInfo(u.id, p, asOf);
        if (ci.status === 'late') {
          if (ci.unknownAmount || !ci.due) unknowns.push(ci);
          else rows.push({ ...ci, amount: Math.max(0, ci.due.amount - ci.paid) });
        } else if (ci.status === 'partial') {
          // الجزئي لا يدخل المتأخرات إلا بعد تجاوز السماح — كغير المدفوع تمامًا
          if (ci.overdueDays > STATE.settings.graceDays)
            rows.push({ ...ci, amount: Math.max(0, (ci.due ? ci.due.amount : 0) - ci.paid) });
        } else if (ci.status === 'unknown' && ci.due) {
          undocumented.push({ ...ci, amount: ci.due.amount });
        }
      }
    }
    const total = rows.reduce((s, r) => s + r.amount, 0);
    const buckets = { 'b30': 0, 'b60': 0, 'b90': 0, 'b90p': 0 };
    for (const r of rows) {
      const dd = r.overdueDays;
      if (dd <= 30) buckets.b30 += r.amount;
      else if (dd <= 60) buckets.b60 += r.amount;
      else if (dd <= 90) buckets.b90 += r.amount;
      else buckets.b90p += r.amount;
    }
    const undocumentedTotal = undocumented.reduce((s, r) => s + r.amount, 0);
    return { rows, total, buckets, unknowns, undocumented, undocumentedTotal };
  }

  /* مستحق/محصَّل لشهر — والسداد المستورد يُحسب على أنه كامل (افتراض مُعلَن) */
  function monthTotals(period, asOf, uset) {
    asOf = asOf || today();
    let due = 0, collected = 0, unknownDue = 0, unknownCount = 0, orphanPaid = 0,
        estimatedPart = false, latePaid = 0;
    for (const ci of allCellInfos(period, asOf, uset)) {
      if (ci.status === 'orphan_paid') { orphanPaid++; continue; }
      if (!ci.due) continue;
      if (ci.status === 'history' || ci.status === 'none') continue;
      if (ci.status === 'unknown') { unknownDue += ci.due.amount; unknownCount++; continue; }
      if (ci.status === 'upcoming') continue;
      due += ci.due.amount;
      if (ci.due.estimated) estimatedPart = true;
      // الدفعات المُدخلة تُحتسب بمبلغها الفعلي؛ المستورد من الكشف بقيمة الاستحقاق (افتراض مُعلَن)
      if (ci.status === 'paid_imported') collected += ci.due.amount;
      else if (ci.status === 'paid') collected += ci.paid;
      else if (ci.status === 'paid_late') { collected += ci.paid; latePaid += ci.paid; }
      else if (ci.status === 'partial') collected += ci.paid;
    }
    return {
      period, due, collected, unknownDue, unknownCount, orphanPaid, estimatedPart, latePaid,
      rate: due > 0 ? collected / due : null,
    };
  }

  function collectionSeries(endPeriod, n, asOf, uset) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) out.push(monthTotals(addMonths(endPeriod, -i), asOf, uset));
    return out;
  }

  /* الإشغال: مؤجَّرة / عقد منتهٍ بلا تجديد / بلا عقد مسجّل */
  function occupancy(asOf, uset) {
    asOf = asOf || today();
    const groups = { occupied: [], ended: [], noContract: [] };
    for (const u of unitsIn(uset)) {
      const cs = unitContracts(u.id);
      const act = activeContractOn(u.id, asOf);
      if (act) groups.occupied.push({ unit: u, contract: act });
      else if (cs.length) {
        const last = cs[cs.length - 1];
        groups.ended.push({ unit: u, contract: last, endedDays: daysBetween(d(last.end), asOf) });
      } else groups.noContract.push({ unit: u });
    }
    return { ...groups, total: unitsIn(uset).length };
  }

  /* تجديدات: عقود تنتهي خلال n يوم بلا عقد لاحق + المنتهية فعلًا بلا تجديد */
  function renewals(withinDays, asOf, uset) {
    asOf = asOf || today();
    const soon = [], overdue = [];
    for (const c of STATE.contracts) {
      if (uset && !uset.has(c.unitId)) continue;
      if (nextContract(c)) continue;
      const left = daysBetween(asOf, d(c.end));
      if (left < 0) {
        const stillLast = unitContracts(c.unitId).slice(-1)[0] === c;
        if (stillLast) overdue.push({ contract: c, daysAgo: -left });
      } else if (left <= withinDays) soon.push({ contract: c, daysLeft: left });
    }
    soon.sort((a, b) => a.daysLeft - b.daysLeft);
    overdue.sort((a, b) => b.daysAgo - a.daysAgo);
    return { soon, overdue };
  }

  function depositsHeld(uset) {
    return STATE.contracts
      .filter(c => (!uset || uset.has(c.unitId)) && c.deposit && c.deposit.status === 'held')
      .map(c => ({ contract: c, amount: c.deposit.amount }));
  }

  /* الإيراد المتعاقد عليه للأشهر القادمة */
  function contractedRevenue(fromPeriod, n, uset) {
    let total = 0, anyEstimated = false;
    const series = [];
    for (let i = 0; i < n; i++) {
      const p = addMonths(fromPeriod, i);
      let m = 0;
      for (const u of unitsIn(uset)) {
        // أول عقد مطابق فقط — اتساقًا مع cellInfo حتى لا يتضاعف شهر متداخل
        const c = contractsOverlappingMonth(u.id, p)[0];
        if (c) {
          const due = dueForMonth(c, p);
          if (due) { m += due.amount; if (due.estimated) anyEstimated = true; }
        }
      }
      series.push({ period: p, amount: Math.round(m) });
      total += m;
    }
    return { total: Math.round(total), series, anyEstimated };
  }

  /* توزيع استحقاق شهر على أنواع الوحدات */
  function revenueByType(period, uset) {
    const by = {};
    for (const u of unitsIn(uset)) {
      const c = contractsOverlappingMonth(u.id, period)[0];
      if (c) {
        const due = dueForMonth(c, period);
        if (due) by[u.type] = (by[u.type] || 0) + due.amount;
      }
    }
    return Object.entries(by).map(([type, v]) => ({ type, amount: Math.round(v) }))
      .sort((a, b) => b.amount - a.amount);
  }

  /* =====================================================
     تحليلات المدير: من فوق لتحت — المشروع أولًا ثم التفاصيل
     ===================================================== */

  /* وحدة «شغّالة» تجاريًا: عقد نشط، أو بتدفع فعليًا ولو بلا عقد مسجّل (كجراج الهدم) */
  function unitIsEarning(u, period, asOf) {
    if (activeContractOn(u.id, asOf)) return true;
    const ci = cellInfo(u.id, period, asOf);
    return ci.status === 'orphan_paid';
  }

  /* إحصاءات مشروع (كشف/مبنى) كاملة لشهر */
  function projectStats(bid, period, asOf) {
    asOf = asOf || today();
    const us = STATE.units.filter(u => u.buildingId === bid);
    const uset = new Set(us.map(u => u.id));
    const rented = us.filter(u => unitIsEarning(u, period, asOf));
    const mt = monthTotals(period, asOf, uset);
    const ar = arrears(asOf, uset);
    const ren = renewals(90, asOf, uset);
    const vac = vacancyInfo(asOf, uset);
    return {
      building: building(bid), uset,
      unitsTotal: us.length,
      rented: rented.length,
      vacant: us.length - rented.length,
      monthDue: mt.due + mt.unknownDue,
      monthCollected: mt.collected,
      rate: mt.rate,
      arrears: ar.total,
      unknownArrears: ar.unknowns.length,
      needsConfirm: ar.undocumentedTotal,
      expiringSoon: ren.soon.length + ren.overdue.length,
      overdueRenewals: ren.overdue.length,
      vacancyLossMonthly: vac.totalMonthly,
      deposits: depositsHeld(uset).reduce((s, x) => s + x.amount, 0),
    };
  }
  function allProjectsStats(period, asOf) {
    return STATE.buildings.map(b => projectStats(b.id, period, asOf));
  }

  /* الشواغر: من إمتى فاضية + الخسارة الشهرية التقديرية (آخر إيجار أو متوسط النوع) */
  function typeAvgRent(asOf) {
    const by = {};
    for (const u of STATE.units) {
      const c = activeContractOn(u.id, asOf);
      if (!c) continue;
      const y = c.years.find(yy => d(yy.from) <= asOf && asOf <= d(yy.to));
      if (!y) continue;
      (by[u.type] = by[u.type] || []).push(monthlyRate(y.rent));
    }
    const out = {};
    for (const t in by) out[t] = by[t].reduce((s, v) => s + v, 0) / by[t].length;
    return out;
  }
  function vacancyInfo(asOf, uset) {
    asOf = asOf || today();
    const period = periodOf(asOf);
    const avg = typeAvgRent(asOf);
    const rows = [];
    for (const u of unitsIn(uset)) {
      if (unitIsEarning(u, period, asOf)) continue;
      const cs = unitContracts(u.id);
      const last = cs.length ? cs[cs.length - 1] : null;
      let since = null, months = null, est = null, src = null;
      if (last) {
        since = last.end;
        months = Math.max(0, Math.round(daysBetween(d(last.end), asOf) / 30.44 * 10) / 10);
        const y = last.years[last.years.length - 1];
        est = Math.round(monthlyRate(y.rent));
        src = 'آخر إيجار للوحدة';
      } else if (avg[u.type]) {
        est = Math.round(avg[u.type]);
        src = 'متوسط النوع المماثل';
      }
      rows.push({
        unit: u, since, months, estMonthly: est, src,
        accumLoss: est != null && months != null ? Math.round(est * Math.min(months, 12)) : null,
      });
    }
    rows.sort((a, b) => (b.estMonthly || 0) - (a.estMonthly || 0));
    const withEst = rows.filter(r => r.estMonthly != null);
    return {
      rows,
      count: rows.length,
      totalMonthly: withEst.reduce((s, r) => s + r.estMonthly, 0),
      totalAccum: rows.filter(r => r.accumLoss != null).reduce((s, r) => s + r.accumLoss, 0),
      avgMonths: (function () {
        const m = rows.filter(r => r.months != null).map(r => r.months);
        return m.length ? Math.round(m.reduce((s, v) => s + v, 0) / m.length * 10) / 10 : null;
      })(),
    };
  }

  /* داخل / خارج: عقود بتبدأ وبتنتهي كل شهر قادم + أثرها على الدخل */
  function inOutForecast(fromPeriod, n, uset) {
    const out = [];
    let prevIncome = null;
    for (let i = 0; i < n; i++) {
      const p = addMonths(fromPeriod, i);
      const starts = [], ends = [];
      for (const c of STATE.contracts) {
        if (uset && !uset.has(c.unitId)) continue;
        if (periodOf(d(c.start)) === p) starts.push(c);
        if (periodOf(d(c.end)) === p && !nextContract(c)) ends.push(c);
      }
      const income = contractedRevenue(p, 1, uset).total;
      const deltaPct = prevIncome != null && prevIncome > 0
        ? Math.round((income - prevIncome) / prevIncome * 100) : null;
      out.push({ period: p, starts, ends, income, deltaPct });
      prevIncome = income;
    }
    return out;
  }

  /* الألارم: شهران متتاليان أو أكثر غير مسدَّدين حتى الشهر السابق */
  function consecutiveLateAlarms(asOf, uset) {
    asOf = asOf || today();
    const lastFull = addMonths(periodOf(asOf), -1);
    const from = STATE.meta.importCoverage.from;
    const alarms = [];
    for (const u of unitsIn(uset)) {
      let streak = 0, amount = 0, unknownAmt = false, periods = [];
      for (let p = from; cmpPeriod(p, lastFull) <= 0; p = addMonths(p, 1)) {
        const ci = cellInfo(u.id, p, asOf);
        if (ci.status === 'late' || ci.status === 'partial') {
          streak++;
          periods.push(p);
          if (ci.unknownAmount || !ci.due) unknownAmt = true;
          else amount += Math.max(0, ci.due.amount - ci.paid);
        } else if (ci.status === 'unknown' || ci.status === 'history') {
          // لا يقطع السلسلة ولا يزيدها — معلومة ناقصة
        } else {
          streak = 0; amount = 0; unknownAmt = false; periods = [];
        }
      }
      if (streak >= 2) {
        const cs = unitContracts(u.id);
        const tid = cs.length ? cs[cs.length - 1].tenantId : null;
        alarms.push({
          unit: u, building: building(u.buildingId),
          tenant: tid ? tenant(tid) : null,
          months: streak, periods, amount, unknownAmt,
        });
      }
    }
    alarms.sort((a, b) => b.months - a.months || b.amount - a.amount);
    return alarms;
  }

  /* التزام العملاء من الدفعات الموثَّقة: نقاط = نسبة السداد في الميعاد */
  function complianceBuckets(uset) {
    const grace = STATE.settings.graceDays;
    const perTenant = [];
    // تجميع الدفعات على العملاء في مرور واحد — لا مسحًا كاملًا لكل عميل
    const paysByTenant = new Map();
    for (const p of STATE.payments) {
      if (!p.date || (uset && !uset.has(p.unitId))) continue;
      const c = contract(p.contractId);
      if (!c) continue;
      let arr = paysByTenant.get(c.tenantId);
      if (!arr) { arr = []; paysByTenant.set(c.tenantId, arr); }
      arr.push(p);
    }
    for (const t of STATE.tenants) {
      const pays = paysByTenant.get(t.id) || [];
      if (pays.length < 3) continue;
      let onTime = 0;
      for (const p of pays) {
        const c = contract(p.contractId);
        if (daysBetween(dueDateOf(c, p.period), d(p.date)) <= grace) onTime++;
      }
      perTenant.push({ tenant: t, n: pays.length, onTime, lateN: pays.length - onTime, points: Math.round(onTime / pays.length * 100) });
    }
    perTenant.sort((a, b) => b.points - a.points);
    return {
      perTenant,
      punctual: perTenant.filter(x => x.points >= 90).length,
      sometimesLate: perTenant.filter(x => x.points >= 60 && x.points < 90).length,
      delinquent: perTenant.filter(x => x.points < 60).length,
    };
  }

  /* صحة المحفظة 0–100: تحصيل + إشغال − فجوات − تركّز انتهاءات − تعمّر متأخرات */
  function healthScore(asOf, uset) {
    asOf = asOf || today();
    const m = addMonths(periodOf(asOf), -1);
    const mt = monthTotals(m, asOf, uset);
    const occ = occupancy(asOf, uset);
    const ar = arrears(asOf, uset);
    const ren = renewals(90, asOf, uset);
    const collectScore = (mt.rate == null ? 0.5 : mt.rate) * 40;
    const occScore = (occ.total ? occ.occupied.length / occ.total : 0) * 25;
    const unknownPenalty = Math.min(15, ((mt.unknownDue + ar.undocumentedTotal) / Math.max(1, mt.due + mt.unknownDue)) * 15);
    const agingPenalty = Math.min(10, (ar.buckets.b90p / Math.max(1, ar.total || 1)) * 10);
    const expiringShare = ren.overdue.length * 2 + ren.soon.length;
    const expiringPenalty = Math.min(10, expiringShare * 2.5);
    const score = Math.round(Math.max(0, Math.min(100,
      collectScore + occScore + (15 - unknownPenalty) + (10 - agingPenalty) + (10 - expiringPenalty))));
    return { score, parts: { collectScore: Math.round(collectScore), occScore: Math.round(occScore), unknownPenalty: Math.round(unknownPenalty), agingPenalty: Math.round(agingPenalty), expiringPenalty: Math.round(expiringPenalty) } };
  }

  /* تركّز المخاطر: أكبر عميل كنسبة من دخل الشهر */
  function topTenantShare(period, uset) {
    const by = {};
    for (const u of unitsIn(uset)) {
      const c = contractsOverlappingMonth(u.id, period)[0];
      if (!c) continue;
      const due = dueForMonth(c, period);
      if (due) by[c.tenantId] = (by[c.tenantId] || 0) + due.amount;
    }
    const total = Object.values(by).reduce((s, v) => s + v, 0);
    const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
    if (!top || !total) return null;
    return { tenant: tenant(top[0]), amount: Math.round(top[1]), share: Math.round(top[1] / total * 100) };
  }

  /* الدخل السنوي المتوقع لكل مشروع (التأمينات التزام منفصل — ليست دخلًا) */
  function annualByProject(fromPeriod) {
    return STATE.buildings.map(b => {
      const uset = new Set(STATE.units.filter(u => u.buildingId === b.id).map(u => u.id));
      return {
        building: b,
        annual: contractedRevenue(fromPeriod, 12, uset).total,
        deposits: depositsHeld(uset).reduce((s, x) => s + x.amount, 0),
      };
    }).sort((a, b) => b.annual - a.annual);
  }

  /* ---------- عمليات الإدخال ---------- */
  let idSeq = 1000;
  function genId(prefix) { return prefix + (idSeq++) + '-' + Math.random().toString(36).slice(2, 6); }

  function addPayment(rec) {
    const c = contractsOverlappingMonth(rec.unitId, rec.period)[0] || null;
    STATE.payments.push({
      id: genId('P'), contractId: c ? c.id : null, source: 'entered',
      unitId: rec.unitId, period: rec.period,
      amount: Number(rec.amount) || 0,
      date: rec.date || null, method: rec.method || 'نقدًا',
      receiptNo: rec.receiptNo || '', notes: rec.notes || '',
    });
    logAct(`دفعة ${Math.round(rec.amount).toLocaleString('en-US')} ج.م — ${unit(rec.unitId) ? unit(rec.unitId).name : ''} (${periodLabel(rec.period, true)})`);
    commit();
  }
  /* سداد جماعي: N دفعات في عملية واحدة (لما تكون مأجّر 1000 وحدة) */
  function addPaymentsBulk(recs) {
    for (const rec of recs) {
      const c = contractsOverlappingMonth(rec.unitId, rec.period)[0] || null;
      STATE.payments.push({
        id: genId('P'), contractId: c ? c.id : null, source: 'entered',
        unitId: rec.unitId, period: rec.period,
        amount: Number(rec.amount) || 0,
        date: rec.date || null, method: rec.method || 'نقدًا',
        receiptNo: rec.receiptNo || '', notes: rec.notes || '',
      });
    }
    logAct(`سداد جماعي: ${recs.length} دفعة (${periodLabel(recs[0] ? recs[0].period : '', true)})`);
    commit();
  }

  function deletePayment(id) {
    const p = STATE.payments.find(x => x.id === id);
    STATE.payments = STATE.payments.filter(x => x.id !== id);
    if (p) logAct(`حذف دفعة — ${unit(p.unitId) ? unit(p.unitId).name : ''} (${periodLabel(p.period, true)})`);
    commit();
  }

  /* علامة تفريغ (وضع تفريغ كشف): ✓ / ✗ / مسح */
  function setMark(unitId, period, mark) {
    STATE.marks = STATE.marks.filter(m => !(m.unitId === unitId && m.period === period));
    if (mark) STATE.marks.push({ unitId, period, mark });
    commit();
  }

  /* جدول السنوات بتواريخها من تاريخ بداية العقد — سنة العقد لا السنة الميلادية */
  function buildYears(startIso, list) {
    const years = [];
    let from = startIso;
    for (let i = 0; i < list.length; i++) {
      const [y, m, dd] = from.split('-').map(Number);
      const toDate = new Date(Date.UTC(y + 1, m - 1, dd));
      toDate.setUTCDate(toDate.getUTCDate() - 1);
      years.push({ from, to: iso(toDate), rent: list[i].rent, estimated: !!list[i].estimated });
      from = iso(new Date(Date.UTC(y + 1, m - 1, dd)));
    }
    return years;
  }

  function addContract(rec) {
    const years = buildYears(rec.start, rec.years);
    const c = {
      id: genId('C'), unitId: rec.unitId, tenantId: rec.tenantId,
      start: rec.start, end: years[years.length - 1].to,
      years, prevId: rec.prevId || null,
      dueDay: Math.min(28, Math.max(1, Number(rec.dueDay) || 1)),
      maintenance: Math.max(0, Number(rec.maintenance) || 0),
      vat: !!rec.vat,
      deposit: rec.deposit ? { amount: Number(rec.deposit), status: 'held', note: '' } : null,
      source: 'entered',
    };
    STATE.contracts.push(c);
    logAct(`عقد جديد — ${unit(rec.unitId) ? unit(rec.unitId).name : ''} / ${tenant(rec.tenantId) ? tenant(rec.tenantId).name : ''}`);
    commit();
    return c;
  }

  /* تعديل عقد قائم — يُعاد بناء جدول السنوات من البداية والقيم الجديدة */
  function updateContract(id, rec) {
    const c = contract(id);
    if (!c) return null;
    if (rec.years && rec.years.length) {
      c.years = buildYears(rec.start || c.start, rec.years);
      c.start = rec.start || c.start;
      c.end = c.years[c.years.length - 1].to;
    } else if (rec.start && rec.start !== c.start) {
      c.years = buildYears(rec.start, c.years);
      c.start = rec.start;
      c.end = c.years[c.years.length - 1].to;
    }
    if (rec.unitId) c.unitId = rec.unitId;
    if (rec.tenantId) c.tenantId = rec.tenantId;
    if (rec.dueDay != null) c.dueDay = Math.min(28, Math.max(1, Number(rec.dueDay) || 1));
    if (rec.maintenance != null) c.maintenance = Math.max(0, Number(rec.maintenance) || 0);
    if (rec.vat != null) c.vat = !!rec.vat;
    if ('deposit' in rec) {
      c.deposit = rec.deposit ? { amount: Number(rec.deposit), status: (c.deposit && c.deposit.status) || 'held', note: (c.deposit && c.deposit.note) || '' } : null;
    }
    logAct(`تعديل عقد — ${unit(c.unitId) ? unit(c.unitId).name : ''} / ${tenant(c.tenantId) ? tenant(c.tenantId).name : ''}`);
    commit();
    return c;
  }
  /* حذف عقد: ممنوع ما دامت عليه دفعات مسجَّلة حتى لا تصبح الدفعات بلا سند */
  function contractPayments(id) {
    return STATE.payments.filter(p => p.contractId === id);
  }
  function deleteContract(id) {
    const c = contract(id);
    if (!c) return { ok: false, reason: 'not_found' };
    const pays = contractPayments(id);
    if (pays.length) return { ok: false, reason: 'has_payments', count: pays.length };
    STATE.contracts = STATE.contracts.filter(x => x.id !== id);
    STATE.contracts.forEach(x => { if (x.prevId === id) x.prevId = null; });
    logAct(`حذف عقد — ${unit(c.unitId) ? unit(c.unitId).name : ''}`);
    commit();
    return { ok: true };
  }
  function updateUnit(id, patch) {
    const u = unit(id);
    if (!u) return null;
    Object.assign(u, patch);
    logAct(`تعديل وحدة — ${u.name}`);
    commit();
    return u;
  }
  function updateBuilding(id, patch) {
    const b = building(id);
    if (!b) return null;
    Object.assign(b, patch);
    logAct(`تعديل مشروع — ${b.name}`);
    commit();
    return b;
  }

  function addTenant(rec) {
    const t = { id: genId('T'), name: rec.name, code: foldCode(rec.code) || null, kind: rec.kind || 'فرد', phone: rec.phone || '', note: rec.note || '' };
    STATE.tenants.push(t); commit(); return t;
  }
  function updateTenant(id, patch) {
    const t = tenant(id);
    if (!t) return;
    if ('code' in patch) patch = { ...patch, code: foldCode(patch.code) || null };
    Object.assign(t, patch); commit();
  }
  function addUnit(rec) {
    const u = { id: genId('U'), buildingId: rec.buildingId, code: nextUnitCode(rec.buildingId), name: rec.name, type: rec.type || 'غير محدد', floor: rec.floor || '', note: rec.note || '' };
    STATE.units.push(u);
    logAct(`وحدة جديدة — ${rec.name} (${u.code || ''})`);
    commit(); return u;
  }
  function addBuilding(rec) {
    const b = { id: genId('B'), code: nextBuildingCode(), name: rec.name, owner: rec.owner || '', area: rec.area || '', note: rec.note || '', demo: false };
    STATE.buildings.push(b);
    logAct(`كشف/مبنى جديد — ${rec.name} (${b.code})`);
    commit(); return b;
  }
  /* حذف البيانات التوضيحية عند بدء الاستخدام الفعلي */
  function removeDemoData() {
    const demoB = new Set(STATE.buildings.filter(b => b.demo).map(b => b.id));
    const demoU = new Set(STATE.units.filter(u => demoB.has(u.buildingId)).map(u => u.id));
    const demoT = new Set(STATE.contracts.filter(c => demoU.has(c.unitId)).map(c => c.tenantId));
    STATE.buildings = STATE.buildings.filter(b => !demoB.has(b.id));
    STATE.units = STATE.units.filter(u => !demoU.has(u.id));
    STATE.contracts = STATE.contracts.filter(c => !demoU.has(c.unitId));
    STATE.payments = STATE.payments.filter(p => !demoU.has(p.unitId));
    STATE.marks = STATE.marks.filter(m => !demoU.has(m.unitId));
    STATE.complaints = STATE.complaints.filter(k => !demoU.has(k.unitId));
    // عملاء المباني التوضيحية فقط (غير المرتبطين بعقود باقية)
    STATE.tenants = STATE.tenants.filter(t =>
      !demoT.has(t.id) || STATE.contracts.some(c => c.tenantId === t.id));
    logAct('حذف البيانات التوضيحية');
    commit();
  }

  function addComplaint(rec) {
    STATE.complaints.push({
      id: genId('K'), unitId: rec.unitId || null, tenantId: rec.tenantId || null,
      openedAt: rec.openedAt || iso(today()), category: rec.category, desc: rec.desc || '',
      status: 'open', cost: Number(rec.cost) || 0, borneBy: rec.borneBy || 'المالك',
      closedAt: null,
    });
    logAct(`شكوى — ${unit(rec.unitId) ? unit(rec.unitId).name : ''} (${rec.category})`);
    commit();
  }
  function closeComplaint(id, closedAt) {
    const k = STATE.complaints.find(x => x.id === id);
    if (k) { k.status = 'closed'; k.closedAt = closedAt; logAct('إغلاق شكوى'); commit(); }
  }

  function setIssueStatus(id, status, resolution) {
    const q = STATE.issues.find(x => x.id === id);
    if (q) {
      q.status = status;
      if (resolution != null) q.resolution = resolution;
      logAct((status === 'resolved' ? 'حسم ملاحظة: ' : 'إعادة فتح ملاحظة: ') + q.title.slice(0, 40));
      commit();
    }
  }
  function updateSettings(patch) { Object.assign(STATE.settings, patch); commit(); }

  /* ---------- تصدير CSV (بترويسة UTF-8 BOM ليفتح سليمًا في Excel) ---------- */
  function toCSV(rows) {
    return '﻿' + rows.map(r => r.map(v => {
      v = v == null ? '' : String(v);
      return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(',')).join('\r\n');
  }
  function download(filename, text, mime) {
    const blob = new Blob([text], { type: (mime || 'text/csv') + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  /* ملف Excel حقيقي بجداول منسَّقة وعناوين — يفتح مباشرة في Excel بترميز سليم.
     sheets: [{name, title, note, head:[], rows:[[]], widths:[]}] */
  function toExcel(sheets, docTitle) {
    const esc = v => String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const isNum = v => typeof v === 'number' && isFinite(v);
    const sheetXml = sheets.map(sh => `
  <x:ExcelWorksheet><x:Name>${esc(sh.name)}</x:Name><x:WorksheetOptions>
    <x:DisplayRightToLeft/><x:FreezePanes/><x:FrozenNoSplit/>
    <x:SplitHorizontal>${sh.note ? 3 : 2}</x:SplitHorizontal><x:TopRowBottomPane>${sh.note ? 3 : 2}</x:TopRowBottomPane>
    <x:ActivePane>2</x:ActivePane><x:ProtectObjects>False</x:ProtectObjects>
  </x:WorksheetOptions></x:ExcelWorksheet>`).join('');
    const body = sheets.map(sh => `
<table dir="rtl">
  <tr><td class="t" colspan="${sh.head.length}">${esc(sh.title || sh.name)}</td></tr>
  ${sh.note ? `<tr><td class="n" colspan="${sh.head.length}">${esc(sh.note)}</td></tr>` : ''}
  <tr>${sh.head.map(x => `<th>${esc(x)}</th>`).join('')}</tr>
  ${sh.rows.map(r => `<tr>${r.map(v => isNum(v)
      ? `<td class="num">${v}</td>`
      : `<td>${esc(v)}</td>`).join('')}</tr>`).join('\n  ')}
</table>
<br/>`).join('\n');
    return `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8">
<title>${esc(docTitle || 'إيجاري')}</title>
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>${sheetXml}</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
 table{border-collapse:collapse;font-family:"Segoe UI",Tahoma,sans-serif;font-size:11pt}
 td,th{border:0.5pt solid #cfcbdd;padding:5px 9px;vertical-align:middle}
 th{background:#ede9fe;color:#3b1d80;font-weight:700;text-align:right}
 td.t{background:#7c3aed;color:#fff;font-size:14pt;font-weight:700;text-align:right}
 td.n{background:#f6f5fb;color:#4b4760;font-size:10pt;text-align:right}
 td.num{text-align:left;mso-number-format:"#,##0"}
</style></head><body>${body}</body></html>`;
  }

  /* ---------- الواجهة العامة ---------- */
  window.Store = {
    load, save, commit, subscribe, resetData,
    get state() { return STATE; },
    // تاريخ
    d, iso, today, periodOf, addMonths, cmpPeriod, monthFirst, monthLast,
    daysBetween, periodLabel, MONTHS_AR,
    // كيانات
    building, unit, tenant, contract, unitContracts, nextContract, activeContractOn,
    contractsOverlappingMonth,
    // محرك
    dueForMonth, dueDateOf, cellInfo, allCellInfos, paymentsFor, markFor,
    // BI
    arrears, monthTotals, collectionSeries, occupancy, renewals,
    depositsHeld, contractedRevenue, revenueByType,
    projectStats, allProjectsStats, vacancyInfo, inOutForecast,
    consecutiveLateAlarms, complianceBuckets, healthScore,
    topTenantShare, annualByProject, unitIsEarning,
    tenantByCode, foldCode,
    // إدخال
    addPayment, addPaymentsBulk, deletePayment, setMark, addContract, addTenant, updateTenant,
    updateContract, deleteContract, contractPayments, updateUnit, updateBuilding,
    addUnit, addBuilding, removeDemoData, addComplaint, closeComplaint,
    setIssueStatus, updateSettings,
    // تصدير
    toCSV, toExcel, download,
  };
})();
