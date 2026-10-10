/* =====================================================================
   engine.js — محرّك الاستحقاق والمؤشرات والإنسايتس (كل شيء محسوب من السجلات)
   القواعد:
     • الإيجار يتبع «سنة العقد» لا السنة الميلادية؛ سنة العقد k تبدأ في ذكرى البداية.
     • إيجار السنة k = القيمة المحددة يدويًا لتلك السنة (rentOverrides[k]) إن وُجدت،
       وإلا إيجار السنة السابقة × (1 + الزيادة السنوية).
     • الشهر المقطوع بين سنتين أو عند بداية/نهاية العقد يُحسب بالأيام.
     • «متأخر» = مستحق لم يُسدَّد بعد يوم الاستحقاق + أيام السماح؛ لا يُكتب يدويًا أبدًا.
     • الشهور قبل settings.trackingFrom (بداية الورقة) لا تُحاسَب (history).
   ===================================================================== */
window.Egary = window.Egary || {};
(function (E) {
  'use strict';
  const U = () => E.U, S = () => E.Store, M = () => E.M;
  const st = () => S().state();
  /* تجاوز مؤقت للإعدادات من سلايسر «المحاسبة من» (لا يُكتب في الإكسيل) */
  let OVERRIDE = {}, _ovCache = null;
  const settings = () => { const s = st().settings; const tf = OVERRIDE.trackingFrom; if (!tf || tf === s.trackingFrom) return s; const rev = S().rev(); if (!_ovCache || _ovCache.base !== s || _ovCache.tf !== tf || _ovCache.rev !== rev) _ovCache = { base: s, tf, rev, obj: Object.assign({}, s, { trackingFrom: tf }) }; return _ovCache.obj; };
  function setOverride(o) { OVERRIDE = o || {}; _ovCache = null; }
  function overrideOf() { return OVERRIDE; }
  /* بداية المحاسبة الفعلية (الإعداد أو سلايسر «المحاسبة من») — تستخدمها الشاشات بدل قراءة الإعداد الخام */
  function trackingFrom() { return settings().trackingFrom || ''; }

  /* ---------- جدول سنوات العقد ---------- */
  function addYears(date, n) { return new Date(Date.UTC(date.getUTCFullYear() + n, date.getUTCMonth(), date.getUTCDate())); }
  function schedule(c) {
    const start = U().d(c.start), end = U().d(c.end);
    if (!start || !end || end < start) return [];
    const out = []; let rent = U().toNum(c.rent) || 0; const inc = (U().toNum(c.increasePct) || 0) / 100;
    const ov = c.rentOverrides || {};
    for (let k = 1; k <= 400; k++) { // بلا سقف عملي (عقود الإيجار القديم منذ الستينيات) — الحد الأعلى حماية من حلقة لا تنتهي فقط
      const from = addYears(start, k - 1);
      if (from > end) break;
      const to0 = U().addDays(addYears(start, k), -1);
      const to = to0 < end ? to0 : end;
      if (k > 1) rent = Math.round(rent * (1 + inc));
      if (ov[k] != null && U().toNum(ov[k]) != null) rent = U().toNum(ov[k]);
      out.push({ k, from: U().iso(from), to: U().iso(to), rent });
    }
    return out;
  }
  function rentOn(c, date) { const y = schedule(c).find(y => U().d(y.from) <= date && date <= U().d(y.to)); return y ? y.rent : null; }
  function currentRent(c, asOf) { asOf = asOf || U().today(); const r = rentOn(c, asOf); if (r != null) return r; const sch = schedule(c); return sch.length ? (asOf < U().d(sch[0].from) ? sch[0].rent : sch[sch.length - 1].rent) : 0; }

  /* الاستحقاق لشهر: الأيام المغطّاة داخل العقد × إيجار سنتها ÷ أيام الشهر */
  /* الشهر المقطوع: المكتب يحسب الشهر 30 يومًا (النصف = 15/30) — settings.prorationBasis = '30' (افتراضي) أو 'actual' */
  function dueForMonth(c, period) {
    const f = U().monthFirst(period), l = U().monthLast(period), dim = U().daysInMonth(period);
    const basis30 = (settings().prorationBasis || '30') === '30';
    let amount = 0, days = 0;
    for (const y of schedule(c)) {
      const a = U().d(y.from) > f ? U().d(y.from) : f, b = U().d(y.to) < l ? U().d(y.to) : l;
      if (a > b) continue;
      const n = U().daysBetween(a, b) + 1; days += n;
      let frac;
      if (n === dim) frac = 1;
      else if (basis30) { // أول شهر لعقد يبدأ يوم 31 = يوم واحد لا صفر؛ أما يوم 31 عند ذكرى العقد (السنة k>1) فالأيام 1–30 قبله حُسبت شهرًا كاملًا فلا يُضاف فوقها
        const sDay = a.getUTCDate(), eDay = b.getUTCDate();
        frac = (eDay === dim ? (sDay === 31 && y.k > 1 ? 0 : Math.max(1, 31 - Math.min(sDay, 30))) : (eDay - sDay + 1)) / 30; frac = Math.min(1, frac);
      }
      else frac = n / dim;
      amount += y.rent * frac;
    }
    if (!days) return null;
    return { amount: Math.round(amount), days, full: days === dim };
  }
  function dueDateOf(c, period) {
    const start = U().d(c.start);
    const dd = Math.min(c.dueDay || settings().dueDay || 1, U().daysInMonth(period));
    const dt = U().d(period + '-' + U().pad(dd, 2));
    return start && start > dt && U().periodOf(start) === period ? start : dt;
  }

  /* ---------- آخر شهر مكتمل التسجيل في الورقة ----------
     الورقة تتأخر عن الواقع: الشهور بعد آخر شهر مسجَّل لا تُعدّ «متأخرة» بل «بانتظار التسجيل».
     يُكتشف تلقائيًا: آخر شهر (حتى الشهر الحالي) سُجِّل فيه سداد لربع العقود السارية على الأقل. */
  let ET_CACHE = { key: '', value: '' };
  function enteredThrough(asOf) {
    asOf = asOf || U().today();
    const manual = settings().enteredThrough;
    if (manual && /^\d{4}-\d{2}$/.test(manual)) return manual;
    const key = U().periodOf(asOf) + '|' + S().rev(); // أي تعديل في الحالة (حتى تعديل مبلغ في مكانه) يُبطل الذاكرة المؤقتة
    if (ET_CACHE.key === key) return ET_CACHE.value;
    const cur = U().periodOf(asOf);
    let found = cur;
    for (let i = 0; i < 24; i++) {
      const p = U().addMonths(cur, -i);
      let active = 0, paid = 0;
      for (const c of st().contracts) { if (!dueForMonth(c, p)) continue; active++; if (S().paymentsOfCell(c.code, p).length) paid++; }
      if (active && paid / active >= 0.25) { found = p; break; }
      if (!active && i > 0) { found = p; break; }
    }
    ET_CACHE = { key, value: found };
    return found;
  }
  function tolerance(dueAmount) { const sg = settings(); return Math.max(U().toNum(sg.toleranceMin) == null ? 50 : U().toNum(sg.toleranceMin), (U().toNum(sg.tolerancePct) == null ? 0.5 : U().toNum(sg.tolerancePct)) / 100 * (dueAmount || 0)); }

  /* ---------- حالة خلية (عقد × شهر) ---------- */
  function cell(c, period, asOf) {
    asOf = asOf || U().today();
    const pays = S().paymentsOfCell(c.code, period);
    const paid = U().sum(pays, p => U().toNum(p.amount));
    const due = dueForMonth(c, period);
    const base = { contract: c, period, due, paid, payments: pays, remaining: 0, overdueDays: 0, dueDate: '', late: false };
    if (U().cmp(period, settings().trackingFrom || '0000-00') < 0) return { ...base, status: paid > 0 ? 'paid' : 'history' };
    if (!due) return { ...base, status: paid > 0 ? 'orphan' : 'none' };
    const dueDate = dueDateOf(c, period); base.dueDate = U().iso(dueDate);
    base.overdueDays = U().daysBetween(dueDate, asOf);
    const remaining = Math.max(0, due.amount - paid); base.remaining = remaining;
    const tol = tolerance(due.amount);
    if (paid >= due.amount - tol) return { ...base, status: 'paid', over: paid - due.amount > tol, remaining: 0 };
    const cur = U().periodOf(asOf);
    if (U().cmp(period, cur) > 0) return { ...base, status: paid > 0 ? 'advance' : 'upcoming' };
    if (U().cmp(period, enteredThrough(asOf)) > 0 && paid === 0) return { ...base, status: 'pending' };
    const late = base.overdueDays > (settings().graceDays || 0);
    if (paid > 0) return { ...base, status: 'partial', late };
    return { ...base, status: late ? 'late' : 'due', late };
  }
  const STATUS_AR = { paid: 'مسدَّد', partial: 'جزئي', late: 'متأخر', due: 'مستحق', upcoming: 'قادم', advance: 'مقدَّم', pending: 'لم يُسجَّل بعد', none: '—', history: 'قبل بداية المحاسبة', orphan: 'خارج العقد' };

  /* ---------- حالة عقد / وحدة ---------- */
  function contractStatus(c, asOf) {
    asOf = asOf || U().today();
    const s = U().d(c.start), e = U().d(c.end);
    if (!s || !e) return 'invalid';
    if (asOf < s) return 'future';
    if (asOf > e) return S().nextContract(c) || S().contractsOfUnit(c.unitCode).some(o => o !== c && U().d(o.start) > e) ? 'renewed' : 'ended';
    return 'active';
  }
  const CSTATUS_AR = { active: 'ساري', ended: 'منتهٍ', renewed: 'منتهٍ (أُجِّرت بعده)', future: 'لم يبدأ', invalid: 'تواريخ غير صحيحة' };
  function activeContractOf(unitCode, asOf) {
    asOf = asOf || U().today();
    return S().contractsOfUnit(unitCode).find(c => U().d(c.start) && U().d(c.end) && U().d(c.start) <= asOf && asOf <= U().d(c.end)) || null;
  }
  function unitStatus(u, asOf) {
    asOf = asOf || U().today();
    const cs = S().contractsOfUnit(u.code);
    const act = activeContractOf(u.code, asOf);
    if (act) {
      const left = U().daysBetween(asOf, U().d(act.end));
      const hasNext = cs.some(c => U().d(c.start) > U().d(act.end));
      return { status: left <= 90 && !hasNext ? 'ending' : 'occupied', contract: act, daysLeft: left, vacantDays: 0, vacantSince: '' };
    }
    const past = cs.filter(c => U().d(c.end) && U().d(c.end) < asOf);
    const future = cs.find(c => U().d(c.start) && U().d(c.start) > asOf);
    // آخر عقد منتهٍ = أحدث نهاية (لا آخر صف في ترتيب الورقة) — نفس ما تحسبه معادلة «شاغرة منذ» في الإكسيل
    const last = past.length ? past.reduce((a, c) => (U().d(c.end) > U().d(a.end) ? c : a)) : null;
    let since = '';
    if (last) since = U().iso(U().addDays(U().d(last.end), 1));
    else if (u.createdAt && U().d(u.createdAt)) since = u.createdAt;
    const vacantDays = since ? Math.max(0, U().daysBetween(U().d(since), asOf)) : null;
    return { status: 'vacant', contract: null, last, next: future || null, vacantSince: since, vacantDays };
  }
  const USTATUS_AR = { occupied: 'مؤجَّرة', ending: 'تنتهي خلال 90 يومًا', vacant: 'شاغرة' }; // نفس العبارة في الفلتر والبطاقات والجداول

  /* ---------- نطاق الفلاتر ---------- */
  /* filter: { projectCode, unitType, floor, status, q } → مجموعة وحدات + عقود */
  function scope(filter) {
    filter = filter || {};
    const asOf = U().today();
    const q = U().normalize(filter.q || '');
    let units = st().units.slice();
    if (filter.projectCode) units = units.filter(u => u.projectCode === filter.projectCode);
    if (filter.unitType) units = units.filter(u => u.type === filter.unitType);
    if (filter.floor) units = units.filter(u => String(u.floor) === String(filter.floor));
    if (filter.status) units = units.filter(u => unitStatus(u, asOf).status === filter.status || (filter.status === 'occupied' && unitStatus(u, asOf).status === 'ending'));
    if (q) {
      units = units.filter(u => {
        if (U().matches(u.code + ' ' + u.label + ' ' + (S().project(u.projectCode) || {}).name, q)) return true;
        return S().contractsOfUnit(u.code).some(c => { const cl = S().client(c.clientCode); return U().matches(c.code + ' ' + (cl ? cl.code + ' ' + cl.name + ' ' + cl.rep + ' ' + cl.phone + ' ' + cl.nationalId + ' ' + cl.taxId : ''), q); });
      });
    }
    const unitSet = new Set(units.map(u => u.code));
    const contracts = st().contracts.filter(c => unitSet.has(c.unitCode));
    const clientSet = new Set(contracts.map(c => c.clientCode));
    return { units, unitSet, contracts, contractSet: new Set(contracts.map(c => c.code)), clients: st().clients.filter(c => clientSet.has(c.code)), clientSet };
  }

  /* ---------- تجميعات ---------- */
  function row(ci) { // صف دليل موحّد
    const c = ci.contract, cl = S().client(c.clientCode), u = S().unit(c.unitCode), p = u ? S().project(u.projectCode) : null;
    return { ...ci, contractCode: c.code, clientCode: c.clientCode, clientName: cl ? cl.name : '', unitCode: c.unitCode, unitLabel: u ? u.label : '', unitType: u ? u.type : '', projectCode: p ? p.code : '', projectName: p ? p.name : '' };
  }
  function arrears(sc, asOf) {
    asOf = asOf || U().today();
    const to = U().periodOf(asOf), from = settings().trackingFrom || to;
    const rows = [];
    for (const c of sc.contracts) {
      const s = U().d(c.start), e = U().d(c.end); if (!s || !e || e < s) continue;
      const pf = U().cmp(U().periodOf(s), from) > 0 ? U().periodOf(s) : from, pt = U().cmp(U().periodOf(e), to) < 0 ? U().periodOf(e) : to;
      for (const p of U().periods(pf, pt)) {
        const ci = cell(c, p, asOf);
        if ((ci.status === 'late') || (ci.status === 'partial' && ci.late)) rows.push(row({ ...ci, amount: ci.remaining }));
      }
    }
    rows.sort((a, b) => b.overdueDays - a.overdueDays || b.amount - a.amount);
    const total = U().sum(rows, r => r.amount);
    const buckets = { b30: 0, b60: 0, b90: 0, b90p: 0 };
    for (const r of rows) { const dd = r.overdueDays; if (dd <= 30) buckets.b30 += r.amount; else if (dd <= 60) buckets.b60 += r.amount; else if (dd <= 90) buckets.b90 += r.amount; else buckets.b90p += r.amount; }
    const byClient = [...U().groupBy(rows, r => r.clientCode)].map(([code, rs]) => ({ clientCode: code, clientName: rs[0].clientName, amount: U().sum(rs, r => r.amount), months: rs.length, maxDays: Math.max(...rs.map(r => r.overdueDays)), rows: rs })).sort((a, b) => b.amount - a.amount);
    const byProject = [...U().groupBy(rows, r => r.projectCode)].map(([code, rs]) => ({ projectCode: code, projectName: rs[0].projectName, amount: U().sum(rs, r => r.amount), rows: rs })).sort((a, b) => b.amount - a.amount);
    return { rows, total, buckets, byClient, byProject };
  }
  function monthTotals(sc, period, asOf) {
    asOf = asOf || U().today();
    let due = 0, collected = 0, lateCount = 0, paidCount = 0, dueCount = 0, pendingCount = 0, pendingDue = 0, orphanPaid = 0; const rows = [];
    for (const c of sc.contracts) {
      const ci = cell(c, period, asOf);
      if (ci.status === 'none' || ci.status === 'history') continue;
      if (ci.status === 'orphan') { orphanPaid += ci.paid; collected += ci.paid; rows.push(row(ci)); continue; } // محصَّل فعلًا وإن كان خارج مدة العقد
      if (ci.due && ci.status !== 'upcoming' && ci.status !== 'advance') { due += ci.due.amount; dueCount++; }
      if (ci.paid) { collected += ci.paid; }
      if (ci.status === 'paid') paidCount++;
      if (ci.status === 'late' || (ci.status === 'partial' && ci.late)) lateCount++;
      if (ci.status === 'pending') { pendingCount++; pendingDue += ci.due.amount; }
      rows.push(row(ci));
    }
    return { period, due, collected, rate: due > 0 ? collected / due : null, lateCount, paidCount, dueCount, pendingCount, pendingDue, orphanPaid, rows };
  }
  /* الشهور التي لم يسجّلها المكتب بعد (بعد آخر شهر مكتمل) */
  function pendingEntry(sc, asOf) {
    asOf = asOf || U().today();
    const cur = U().periodOf(asOf), et = enteredThrough(asOf);
    const periods = [], rows = []; let due = 0;
    for (let p = U().addMonths(et, 1); U().cmp(p, cur) <= 0; p = U().addMonths(p, 1)) {
      periods.push(p);
      for (const c of sc.contracts) { const ci = cell(c, p, asOf); if (ci.status === 'pending') { rows.push(row({ ...ci, amount: ci.due.amount })); due += ci.due.amount; } }
    }
    return { enteredThrough: et, periods, rows, due, contracts: new Set(rows.map(r => r.contractCode)).size };
  }
  function collectedBetween(sc, fromPeriod, toPeriod) {
    let total = 0; const rows = [];
    for (const p of st().payments) {
      if (!sc.contractSet.has(p.contractCode)) continue;
      if (U().cmp(p.period, fromPeriod) < 0 || U().cmp(p.period, toPeriod) > 0) continue;
      total += U().toNum(p.amount) || 0; rows.push(p);
    }
    return { total, rows };
  }
  function series(sc, endPeriod, n, asOf) { const out = []; for (let i = n - 1; i >= 0; i--) out.push(monthTotals(sc, U().addMonths(endPeriod, -i), asOf)); return out; }
  function occupancy(sc, asOf) {
    asOf = asOf || U().today();
    const occupied = [], ending = [], vacant = [];
    for (const u of sc.units) {
      const s = unitStatus(u, asOf); const r = { unit: u, ...s, projectName: (S().project(u.projectCode) || {}).name, clientName: s.contract ? (S().client(s.contract.clientCode) || {}).name : '' };
      if (s.status === 'vacant') vacant.push(r); else if (s.status === 'ending') ending.push(r); else occupied.push(r);
    }
    vacant.sort((a, b) => (b.vacantDays || 0) - (a.vacantDays || 0));
    ending.sort((a, b) => a.daysLeft - b.daysLeft);
    const total = sc.units.length, occ = occupied.length + ending.length;
    const longVacant = vacant.filter(v => v.vacantDays != null && v.vacantDays >= (settings().vacancyMonths || 3) * 30);
    return { total, occupied, ending, vacant, occupiedCount: occ, rate: total ? occ / total : null, longVacant };
  }
  function renewals(sc, asOf) {
    asOf = asOf || U().today();
    const soon30 = [], soon60 = [], soon90 = [], ended = [];
    for (const c of sc.contracts) {
      const e = U().d(c.end); if (!e) continue;
      const hasNext = S().contractsOfUnit(c.unitCode).some(o => o !== c && U().d(o.start) > e);
      if (hasNext) continue;
      const left = U().daysBetween(asOf, e);
      const r = { ...row({ contract: c }), daysLeft: left, rent: currentRent(c, asOf) };
      if (left < 0) { if (!activeContractOf(c.unitCode, asOf)) ended.push({ ...r, daysAgo: -left }); }
      else if (left <= 30) soon30.push(r); else if (left <= 60) soon60.push(r); else if (left <= 90) soon90.push(r);
    }
    const bySoon = (a, b) => a.daysLeft - b.daysLeft;
    soon30.sort(bySoon); soon60.sort(bySoon); soon90.sort(bySoon); ended.sort((a, b) => b.daysAgo - a.daysAgo);
    return { soon30, soon60, soon90, soon: [...soon30, ...soon60, ...soon90], ended };
  }
  function deposits(sc, asOf) {
    asOf = asOf || U().today();
    const held = sc.contracts.filter(c => c.depositStatus === 'held' && (U().toNum(c.deposit) || 0) > 0).map(c => ({ ...row({ contract: c }), amount: U().toNum(c.deposit), status: contractStatus(c, asOf) }));
    return { held, total: U().sum(held, r => r.amount), endedStillHeld: held.filter(r => r.status === 'ended' || r.status === 'renewed') };
  }
  function contractedRevenue(sc, fromPeriod, n) {
    let total = 0; const months = [];
    for (let i = 0; i < n; i++) {
      const p = U().addMonths(fromPeriod, i); let m = 0;
      for (const c of sc.contracts) { const d = dueForMonth(c, p); if (d) m += d.amount; }
      months.push({ period: p, amount: m }); total += m;
    }
    return { total, months };
  }
  function reletGaps(sc) {
    const gaps = [];
    for (const u of sc.units) {
      const cs = S().contractsOfUnit(u.code);
      for (let i = 1; i < cs.length; i++) {
        const a = U().d(cs[i - 1].end), b = U().d(cs[i].start); if (!a || !b) continue;
        const days = U().daysBetween(a, b) - 1;
        if (days > 0) gaps.push({ unit: u, unitCode: u.code, unitLabel: u.label, projectName: (S().project(u.projectCode) || {}).name, prev: cs[i - 1], next: cs[i], days, lost: Math.round(days / 30 * (schedule(cs[i])[0] || { rent: 0 }).rent) });
      }
    }
    return gaps.sort((a, b) => b.days - a.days);
  }
  function punctuality(sc) {
    const out = [];
    for (const cl of sc.clients) {
      const cs = S().contractsOfClient(cl.code).filter(c => sc.contractSet.has(c.code));
      let known = 0, onTime = 0, months = 0, paidMonths = 0, late = 0;
      for (const c of cs) for (const p of S().paymentsOf(c.code)) {
        months++;
        if (p.paidOn && U().d(p.paidOn)) { known++; const dd = dueDateOf(c, p.period); if (U().daysBetween(dd, U().d(p.paidOn)) <= (settings().graceDays || 0)) onTime++; }
      }
      const ar = arrears({ contracts: cs, contractSet: new Set(cs.map(c => c.code)) });
      out.push({ clientCode: cl.code, clientName: cl.name, contracts: cs.length, payments: months, knownDates: known, onTime, score: known ? onTime / known : null, arrears: ar.total, lateMonths: ar.rows.length, maxDays: ar.rows.length ? Math.max(...ar.rows.map(r => r.overdueDays)) : 0 });
    }
    return out.sort((a, b) => b.arrears - a.arrears || (a.score == null ? 1 : 0) - (b.score == null ? 1 : 0));
  }
  function maintenanceStats(sc, asOf, year) { // year: سنة التقرير (افتراضيًا سنة asOf) — تُعاد في النتيجة حتى تُسمّيها الشاشة
    asOf = asOf || U().today();
    const yr = String(year || asOf.getUTCFullYear());
    const items = st().maintenance.filter(m => sc.unitSet.has(m.unitCode)).map(m => {
      const u = S().unit(m.unitCode); const cAt = m.custodianContract ? S().contract(m.custodianContract) : (u ? activeContractOf(u.code, U().d(m.date) || asOf) : null); const cl = cAt ? S().client(cAt.clientCode) : null;
      return { ...m, unitLabel: u ? u.label : '', projectName: u ? (S().project(u.projectCode) || {}).name : '', custodianContract: cAt ? cAt.code : '', custodianName: m.custodianName || (cl ? cl.name : '') };
    });
    const open = items.filter(m => m.status === 'open');
    const ytd = items.filter(m => (m.date || '').startsWith(yr));
    const byBorne = {}; for (const b of M().BORNE_BY) byBorne[b.key] = U().sum(ytd.filter(m => m.borneBy === b.key), m => U().toNum(m.cost));
    const byUnit = [...U().groupBy(items, m => m.unitCode)].map(([code, ms]) => ({ unitCode: code, unitLabel: ms[0].unitLabel, projectName: ms[0].projectName, count: ms.length, cost: U().sum(ms, m => U().toNum(m.cost)) })).sort((a, b) => b.cost - a.cost);
    return { items, open, ytd, year: yr, costYtd: U().sum(ytd, m => U().toNum(m.cost)), byBorne, byUnit };
  }
  function byDimension(sc, fromPeriod, toPeriod, keyFn) {
    const m = new Map();
    for (const p of st().payments) {
      if (!sc.contractSet.has(p.contractCode) || U().cmp(p.period, fromPeriod) < 0 || U().cmp(p.period, toPeriod) > 0) continue;
      const c = S().contract(p.contractCode); const u = c ? S().unit(c.unitCode) : null; if (!u) continue;
      const k = keyFn(u, c); if (!m.has(k)) m.set(k, { key: k, amount: 0, count: 0 });
      const o = m.get(k); o.amount += U().toNum(p.amount) || 0; o.count++;
    }
    return [...m.values()].sort((a, b) => b.amount - a.amount);
  }

  /* ---------- الحزمة الكاملة للوحة ---------- */
  function kpis(filter, asOf) {
    asOf = asOf || U().today();
    const sc = scope(filter);
    const cur = U().periodOf(asOf), yr = cur.slice(0, 4);
    const et = enteredThrough(asOf);
    // الشهر المعروض: المختار من المستخدم (فلتر الشهر) أو آخر شهر مكتمل التسجيل
    const selected = filter && filter.period && /^\d{4}-\d{2}$/.test(filter.period) && U().cmp(filter.period, cur) <= 0 ? filter.period : '';
    const reportPeriod = selected || (U().cmp(et, cur) < 0 ? et : cur);
    const prev = U().addMonths(reportPeriod, -1);
    const month = monthTotals(sc, reportPeriod, asOf), prevMonth = monthTotals(sc, prev, asOf);
    const pending = pendingEntry(sc, asOf);
    // سنة التقرير: سنة الشهر المعروض (حتى الشهر الحالي لو السنة الحالية، وإلا السنة كاملة)
    const ryr = reportPeriod.slice(0, 4), yEnd = ryr === yr ? cur : ryr + '-12';
    const ytd = collectedBetween(sc, ryr + '-01', yEnd);
    const ytdDue = series(sc, yEnd, +yEnd.slice(5), asOf).reduce((s, m) => s + m.due, 0);
    const ar = arrears(sc, asOf), occ = occupancy(sc, asOf), ren = renewals(sc, asOf), dep = deposits(sc, asOf);
    const next12 = contractedRevenue(sc, U().addMonths(cur, 1), 12);
    const gaps = reletGaps(sc), punct = punctuality(sc), maint = maintenanceStats(sc, asOf, ryr);
    const trend = series(sc, selected || cur, 12, asOf);
    const byProject = byDimension(sc, ryr + '-01', yEnd, u => u.projectCode).map(o => ({ ...o, name: (S().project(o.key) || {}).name || o.key }));
    const byType = byDimension(sc, ryr + '-01', yEnd, u => u.type).map(o => ({ ...o, name: M().label(M().UNIT_TYPES, o.key) }));
    const activeContracts = sc.contracts.filter(c => contractStatus(c, asOf) === 'active');
    const monthlyRentRoll = U().sum(activeContracts, c => currentRent(c, asOf));
    const avgRentByType = M().UNIT_TYPES.map(t => { const cs = activeContracts.filter(c => (S().unit(c.unitCode) || {}).type === t.key); return { key: t.key, name: t.ar, count: cs.length, avg: cs.length ? U().sum(cs, c => currentRent(c, asOf)) / cs.length : null }; }).filter(t => t.count);
    const noIncrease = activeContracts.filter(c => !(U().toNum(c.increasePct) > 0));
    const unknownDates = st().payments.filter(p => sc.contractSet.has(p.contractCode) && !p.paidOn).length;
    return { asOf: U().iso(asOf), period: reportPeriod, selectedPeriod: selected, defaultPeriod: U().cmp(et, cur) < 0 ? et : cur, reportYear: ryr, currentPeriod: cur, enteredThrough: et, pending, scope: sc, month, prevMonth, ytd: { collected: ytd.total, due: ytdDue, rate: ytdDue ? ytd.total / ytdDue : null, rows: ytd.rows }, arrears: ar, occupancy: occ, renewals: ren, deposits: dep, next12, gaps, punctuality: punct, maintenance: maint, trend, byProject, byType, activeContracts, monthlyRentRoll, avgRentByType, noIncrease, unknownDates, counts: { projects: st().projects.filter(p => !filter || !filter.projectCode || p.code === filter.projectCode).length, units: sc.units.length, clients: sc.clients.length, contracts: sc.contracts.length, payments: st().payments.filter(p => sc.contractSet.has(p.contractCode)).length } };
  }

  /* ---------- الإنسايتس (نصوص مولَّدة من الأرقام، كل واحدة بدليلها) ---------- */
  function insights(k) {
    const out = [], f = U().fmtMoney, pct = U().fmtPct;
    const push = (sev, title, text, evidence) => out.push({ sev, title, text, evidence });
    if (k.pending && k.pending.periods.length) push('warn', `مدفوعات ${k.pending.periods.map(p => U().periodLabel(p)).join(' و')} لم تُسجَّل في الورقة بعد`, `${k.pending.contracts} عقدًا بإيجار ${f(k.pending.due)} — آخر شهر مسجَّل: ${U().periodLabel(k.enteredThrough, true)}. تُعدّ هذه الشهور «لم تُسجَّل بعد» لا «متأخرة» حتى تُدخل مدفوعاتها (كشف التحصيل أو زر التسجيل هنا).`, { view: 'pending' });
    if (k.month.due > 0) {
      const r = k.month.rate || 0;
      push(r >= 0.9 ? 'good' : r >= 0.6 ? 'warn' : 'danger', `تحصيل ${U().periodLabel(k.period, true)}: ${pct(r)}`, `محصَّل ${f(k.month.collected)} من مستحق ${f(k.month.due)} — ${k.month.lateCount} عقد لم يُسجَّل له سداد الشهر.`, { view: 'ledger', period: k.period, status: 'late' });
    }
    if (k.prevMonth.due > 0 && k.month.due > 0 && k.prevMonth.collected > 0) {
      const ch = (k.month.collected - k.prevMonth.collected) / k.prevMonth.collected;
      push(Math.abs(ch) < 0.05 ? 'info' : ch > 0 ? 'good' : 'warn', `التحصيل ${ch >= 0 ? 'ارتفع' : 'انخفض'} ${pct(Math.abs(ch))} عن الشهر السابق`, `${U().periodLabel(k.prevMonth.period)}: ${f(k.prevMonth.collected)} ← ${U().periodLabel(k.period)}: ${f(k.month.collected)}.`, { view: 'insights', tab: 'trend' });
    }
    if (k.arrears.total > 0) {
      const top = k.arrears.byClient[0]; const topP = k.arrears.byProject[0];
      push('danger', `متأخرات قائمة ${f(k.arrears.total)} على ${k.arrears.byClient.length} عميل`, `${k.arrears.rows.length} شهر غير مسدَّد. أكبر مدين: ${top.clientName} (${f(top.amount)} عن ${top.months} شهر). ${topP ? `مشروع ${topP.projectName} يمثل ${pct(topP.amount / k.arrears.total)} من المتأخرات.` : ''}`, { view: 'arrears' });
      const old = k.arrears.buckets.b90p;
      if (old > 0) push('danger', `${f(old)} متأخرة أكثر من 90 يومًا`, `تمثل ${pct(old / k.arrears.total)} من إجمالي المتأخرات — أولوية للمتابعة القانونية أو التسوية.`, { view: 'arrears', bucket: 'b90p' });
      const top3 = k.arrears.byClient.slice(0, 3); const t3 = U().sum(top3, c => c.amount);
      if (k.arrears.byClient.length > 3) push('warn', `أكبر 3 مدينين يحملون ${pct(t3 / k.arrears.total)} من المتأخرات`, top3.map(c => `${c.clientName}: ${f(c.amount)}`).join(' · '), { view: 'arrears', tab: 'clients' });
    } else if (k.scope.contracts.length) push('good', 'لا توجد متأخرات قائمة', 'كل الشهور المستحقة حتى اليوم مسدَّدة.', { view: 'ledger' });
    if (k.occupancy.total) {
      push(k.occupancy.rate >= 0.9 ? 'good' : k.occupancy.rate >= 0.75 ? 'info' : 'warn', `الإشغال ${pct(k.occupancy.rate)} (${k.occupancy.occupiedCount} من ${k.occupancy.total} وحدة)`, `${k.occupancy.vacant.length} وحدة شاغرة الآن${k.occupancy.longVacant.length ? `، منها ${k.occupancy.longVacant.length} شاغرة أكثر من ${settings().vacancyMonths} شهور` : ''}.`, { view: 'units', status: 'vacant' });
      const lost = U().sum(k.occupancy.vacant, v => { const last = v.last; return last ? Math.round((Math.min(365, v.vacantDays || 0) / 30) * currentRent(last)) : 0; });
      if (lost > 0) push('warn', `إيجار ضائع تقريبًا بسبب الوحدات الشاغرة ≈ ${f(lost)}`, `تقدير: مدة الشغور × آخر إيجار لكل وحدة شاغرة سبق تأجيرها (الشغور الأطول من سنة يُحسب بسنة).`, { view: 'units', status: 'vacant' });
    }
    if (k.renewals.soon.length) push('warn', `${k.renewals.soon.length} عقد ينتهي خلال 90 يومًا`, `منها ${k.renewals.soon30.length} خلال 30 يومًا. الإيجار الشهري المعرَّض: ${f(U().sum(k.renewals.soon, r => r.rent))}.`, { view: 'contracts', status: 'ending' });
    if (k.renewals.ended.length) push('danger', `${k.renewals.ended.length} عقد انتهى والوحدة ما زالت شاغرة بلا تجديد`, k.renewals.ended.slice(0, 3).map(r => `${r.unitLabel} (${r.projectName}) منذ ${r.daysAgo} يوم`).join(' · '), { view: 'contracts', status: 'ended' });
    if (k.gaps.length) { const g = k.gaps[0]; push('info', `أطول فجوة بين عقدين: ${g.days} يوم على وحدة ${g.unitLabel}`, `${g.projectName} — بين ${g.prev.code} و${g.next.code}؛ فاقد تقديري ${f(g.lost)}. إجمالي الفجوات: ${k.gaps.length}.`, { view: 'insights', tab: 'gaps' }); }
    if (k.deposits.endedStillHeld.length) push('warn', `${k.deposits.endedStillHeld.length} تأمين محتفظ به لعقود منتهية`, `قيمتها ${f(U().sum(k.deposits.endedStillHeld, r => r.amount))} — راجع صيانات الوحدة قبل الرد أو الخصم.`, { view: 'contracts', deposit: 'held-ended' });
    if (k.next12.total) push('info', `إيراد متعاقد عليه للـ12 شهرًا القادمة: ${f(k.next12.total)}`, `متوسط ${f(k.next12.total / 12)} شهريًا بافتراض استمرار العقود السارية دون تجديد العقود المنتهية.`, { view: 'insights', tab: 'forecast' });
    if (k.noIncrease.length) push('info', `${k.noIncrease.length} عقد ساري بلا زيادة سنوية مسجَّلة`, 'افتح العقد وأدخل نسبة الزيادة حتى تكون توقعات الإيراد دقيقة.', { view: 'contracts', increase: 'none' });
    if (k.maintenance.open.length) push('warn', `${k.maintenance.open.length} طلب صيانة مفتوح`, `تكلفة الصيانة هذه السنة ${f(k.maintenance.costYtd)} (المالك ${f(k.maintenance.byBorne.owner)} · المستأجر ${f(k.maintenance.byBorne.tenant)}).`, { view: 'maintenance', status: 'open' });
    if (k.unknownDates) push('info', `${k.unknownDates} دفعة بلا تاريخ سداد`, 'مستوردة من الإكسيل بالمبلغ فقط؛ سجّل تاريخ السداد من الفاتورة لتُحتسب في مؤشر الالتزام.', { view: 'ledger' });
    const sev = { danger: 0, warn: 1, good: 2, info: 3 };
    return out.sort((a, b) => sev[a.sev] - sev[b.sev]);
  }

  /* ---------- الجدول الشبيه بالإكسيل ---------- */
  function ledger(year, filter, asOf) {
    asOf = asOf || U().today();
    const sc = scope(filter);
    const y = String(year);
    const rows = [];
    for (const c of sc.contracts) {
      const s = U().d(c.start), e = U().d(c.end);
      const pays = S().paymentsOf(c.code).filter(p => p.period.startsWith(y));
      const overlaps = s && e && s <= U().d(y + '-12-31') && e >= U().d(y + '-01-01');
      if (!pays.length && !overlaps) continue;
      const months = {}; let total = 0;
      for (let m = 1; m <= 12; m++) { const p = y + '-' + U().pad(m, 2); const ci = cell(c, p, asOf); months[p] = ci; total += ci.paid; }
      rows.push({ ...row({ contract: c }), months, total, order: c.ledgerOrder == null ? 1e9 : c.ledgerOrder });
    }
    rows.sort((a, b) => a.order - b.order || U().cmp(a.projectCode, b.projectCode) || U().cmp(a.contract.start, b.contract.start));
    const monthTotalsArr = {}; for (let m = 1; m <= 12; m++) { const p = y + '-' + U().pad(m, 2); monthTotalsArr[p] = U().sum(rows, r => r.months[p].paid); }
    return { year: y, rows, monthTotals: monthTotalsArr, total: U().sum(rows, r => r.total) };
  }

  /* ---------- جودة البيانات (محسوبة) ---------- */
  function dataQuality() {
    const flags = (st().flags || []).slice();
    const add = (sev, entity, code, text) => flags.push({ sev, entity, code, text });
    for (const c of st().contracts) {
      if (!S().unit(c.unitCode)) add('danger', 'contracts', c.code, 'العقد يشير إلى وحدة غير موجودة');
      if (!S().client(c.clientCode)) add('danger', 'contracts', c.code, 'العقد يشير إلى عميل غير موجود');
      if (!U().d(c.start) || !U().d(c.end)) add('danger', 'contracts', c.code, `${(S().client(c.clientCode) || {}).name || ''} / ${(S().unit(c.unitCode) || {}).label || ''}: تاريخ ${!U().d(c.start) ? 'بداية' : 'نهاية'} العقد مفقود أو غير صحيح (${!U().d(c.start) ? (c.start || 'فارغ') : (c.end || 'فارغ')}) — العقد لا يُحاسَب حتى يُصحَّح`);
      if (U().d(c.start) && U().d(c.end) && U().d(c.end) < U().d(c.start)) add('danger', 'contracts', c.code, 'تاريخ نهاية العقد قبل بدايته');
      if (!(U().toNum(c.rent) > 0)) add('warn', 'contracts', c.code, 'الإيجار الشهري صفر أو غير مسجَّل');
      for (const p of S().paymentsOf(c.code)) { const d = dueForMonth(c, p.period); if (!d) add('info', 'payments', p.code, `دفعة ${U().periodLabel(p.period, true)} خارج مدة العقد ${c.code} (فترة سابقة؟)`); }
    }
    for (const u of st().units) if (!S().project(u.projectCode)) add('danger', 'units', u.code, 'الوحدة تشير إلى مشروع غير موجود');
    for (const p of st().payments) if (!S().contract(p.contractCode)) add('danger', 'payments', p.code, `الدفعة ${p.code} تشير إلى عقد غير موجود (${p.contractCode}) — ربما حُذف صفه من ورقة العقود`);
    for (const m of st().maintenance) if (!S().unit(m.unitCode)) add('danger', 'maintenance', m.code, `صيانة ${m.code} تشير إلى وحدة غير موجودة (${m.unitCode || 'فارغ'}) — راجع كود الوحدة في ورقة الصيانة`);
    // عقدان ساريان اليوم على نفس الوحدة: البرنامج يعتمد الأقدم بداية، ومعادلات الإكسيل تعتمد أول صف في الورقة — صحّحوا تاريخ أحدهما
    for (const u of st().units) { const act = S().contractsOfUnit(u.code).filter(c => contractStatus(c) === 'active'); if (act.length > 1) add('warn', 'units', u.code, `الوحدة ${u.label || u.code} عليها ${act.length} عقود سارية في نفس الوقت (${act.map(c => c.code).join('، ')}) — راجع تواريخ البداية والنهاية`); }
    for (const c of st().contracts) { // تنبيه واحد لكل شهر مهما تعددت دفعاته
      const s0 = U().d(c.start), e0 = U().d(c.end); if (!s0 || !e0) continue;
      for (const period of new Set(S().paymentsOf(c.code).map(p => p.period))) { const ci = cell(c, period); if (ci.status === 'paid' && ci.over) add('warn', 'contracts', c.code, `${(S().client(c.clientCode) || {}).name || ''} / ${(S().unit(c.unitCode) || {}).label || ''}: المسدَّد في ${U().periodLabel(period, true)} (${U().fmtMoney(ci.paid)}) أعلى من المستحق (${U().fmtMoney(ci.due.amount)})`); }
    }
    const byNid = U().groupBy(st().clients.filter(c => c.nationalId), c => U().foldCode(c.nationalId));
    for (const [nid, cs] of byNid) if (cs.length > 1) add('info', 'clients', cs[0].code, `نفس الرقم القومي/الباسبور (${nid}) مسجَّل لأكثر من عميل: ${cs.map(c => c.name + ' (' + c.code + ')').join('، ')}`);
    for (const c of st().contracts) if (c.inferred) add('info', 'contracts', c.code, `${(S().client(c.clientCode) || {}).name || ''} / ${(S().unit(c.unitCode) || {}).label || ''}: فترة سابقة مستنتجة من مبالغ الورقة قبل بداية العقد الحالي — راجع تواريخها وإيجارها`);
    for (const cl of st().clients) { if (!cl.phone) add('info', 'clients', cl.code, 'لا يوجد رقم تليفون'); if (!cl.nationalId) add('info', 'clients', cl.code, 'لا يوجد رقم قومي/باسبور'); }
    const byLabel = U().groupBy(st().units, u => u.projectCode + '|' + U().normalize(u.label));
    for (const [, us] of byLabel) if (us.length > 1) add('warn', 'units', us[0].code, `${us.length} وحدات بنفس الاسم «${us[0].label}» في نفس المشروع (${us.map(u => u.code).join('، ')})`);
    const sev = { danger: 0, warn: 1, info: 2 };
    return flags.sort((a, b) => sev[a.sev] - sev[b.sev]);
  }

  E.Engine = { setOverride, overrideOf, trackingFrom, schedule, rentOn, currentRent, dueForMonth, dueDateOf, cell, enteredThrough, tolerance, pendingEntry, STATUS_AR, contractStatus, CSTATUS_AR, activeContractOf, unitStatus, USTATUS_AR, scope, row, arrears, monthTotals, collectedBetween, series, occupancy, renewals, deposits, contractedRevenue, reletGaps, punctuality, maintenanceStats, byDimension, kpis, insights, ledger, dataQuality };
})(window.Egary);
