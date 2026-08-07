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
        if (parsed && parsed.seedVersion === SEED.version) { STATE = parsed; return; }
      }
    } catch (e) { /* تخزين تالف → بذرة جديدة */ }
    STATE = freshFromSeed();
    save();
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(STATE)); } catch (e) { /* تخزين ممتلئ */ }
  }
  function commit() { save(); listeners.forEach(fn => fn()); }
  function subscribe(fn) { listeners.push(fn); }
  function resetData() { STATE = freshFromSeed(); commit(); }

  /* سجل الحركة — كل عملية إدخال تُسجَّل بوقتها */
  function logAct(txt) {
    STATE.log.unshift({ at: new Date().toISOString().slice(0, 16).replace('T', ' '), txt });
    if (STATE.log.length > 60) STATE.log.pop();
  }

  /* ---------- فهارس ---------- */
  function building(id) { return STATE.buildings.find(b => b.id === id) || null; }
  function unit(id) { return STATE.units.find(u => u.id === id) || null; }
  function tenant(id) { return STATE.tenants.find(t => t.id === id) || null; }
  function contract(id) { return STATE.contracts.find(c => c.id === id) || null; }
  function unitContracts(unitId) {
    return STATE.contracts.filter(c => c.unitId === unitId)
      .sort((a, b) => a.start < b.start ? -1 : 1);
  }
  function nextContract(c) {
    return STATE.contracts.find(x => x.prevId === c.id) || null;
  }
  function activeContractOn(unitId, date) {
    return unitContracts(unitId).find(c => d(c.start) <= date && date <= d(c.end)) || null;
  }
  function contractsOverlappingMonth(unitId, period) {
    const f = monthFirst(period), l = monthLast(period);
    return unitContracts(unitId).filter(c => d(c.start) <= l && d(c.end) >= f);
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
    return STATE.payments.filter(p => p.unitId === unitId && p.period === period);
  }
  function markFor(unitId, period) {
    return STATE.marks.find(m => m.unitId === unitId && m.period === period) || null;
  }

  /* الحالة المركّبة لشهر × وحدة — قلب النظام كله */
  function cellInfo(unitId, period, asOf) {
    asOf = asOf || today();
    const cov = STATE.meta.importCoverage;
    const u = unit(unitId);
    const cs = contractsOverlappingMonth(unitId, period);
    const c = cs[0] || null;
    const due = c ? dueForMonth(c, period) : null;
    const pays = paymentsFor(unitId, period);
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

  function addContract(rec) {
    const years = [];
    let from = rec.start;
    for (let i = 0; i < rec.years.length; i++) {
      const [y, m, dd] = from.split('-').map(Number);
      const toDate = new Date(Date.UTC(y + 1, m - 1, dd));
      toDate.setUTCDate(toDate.getUTCDate() - 1);
      years.push({ from, to: iso(toDate), rent: rec.years[i].rent, estimated: !!rec.years[i].estimated });
      const nf = new Date(Date.UTC(y + 1, m - 1, dd));
      from = iso(nf);
    }
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

  function addTenant(rec) {
    const t = { id: genId('T'), name: rec.name, kind: rec.kind || 'فرد', phone: rec.phone || '', note: rec.note || '' };
    STATE.tenants.push(t); commit(); return t;
  }
  function updateTenant(id, patch) {
    const t = tenant(id); if (t) { Object.assign(t, patch); commit(); }
  }
  function addUnit(rec) {
    const u = { id: genId('U'), buildingId: rec.buildingId, name: rec.name, type: rec.type || 'غير محدد', floor: rec.floor || '', note: rec.note || '' };
    STATE.units.push(u);
    logAct(`وحدة جديدة — ${rec.name}`);
    commit(); return u;
  }
  function addBuilding(rec) {
    const b = { id: genId('B'), name: rec.name, owner: rec.owner || '', area: rec.area || '', note: rec.note || '', demo: false };
    STATE.buildings.push(b);
    logAct(`كشف/مبنى جديد — ${rec.name}`);
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
    // مستأجرو المباني التوضيحية فقط (غير المرتبطين بعقود باقية)
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
  function download(filename, text) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
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
    // إدخال
    addPayment, addPaymentsBulk, deletePayment, setMark, addContract, addTenant, updateTenant,
    addUnit, addBuilding, removeDemoData, addComplaint, closeComplaint,
    setIssueStatus, updateSettings,
    // تصدير
    toCSV, download,
  };
})();
