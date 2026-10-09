/* demo.js — بيانات نموذجية صغيرة لوضع التجربة (بلا ملف) */
window.Egary = window.Egary || {};
(function (E) {
  'use strict';
  function state() {
    const M = E.M, U = E.U, st = M.emptyState();
    const y = U.today().getUTCFullYear();
    st.meta.officeName = 'إيجاري — تجربة';
    st.settings.trackingFrom = y + '-01'; st.settings.ledgerYears = [y];
    st.projects.push({ ...M.blank.projects(), code: 'P01', name: 'برج النيل', address: 'شارع النيل 12، الدقي', area: 'الدقي' }, { ...M.blank.projects(), code: 'P02', name: 'مركز الحرية', address: 'شارع الحرية 5، المهندسين', area: 'المهندسين' });
    const units = [['P01', '101', 'residential', '1'], ['P01', '102', 'residential', '1'], ['P01', '201', 'admin', '2'], ['P01', 'محل 1', 'commercial', 'G'], ['P01', 'جراج 3', 'garage', 'B'], ['P02', 'ميزان 1', 'admin', 'M'], ['P02', '301', 'admin', '3'], ['P02', '302', 'admin', '3']];
    for (const [p, l, t, f] of units) st.units.push({ ...M.blank.units(), code: E.Codes.unitCode(st, p, l), projectCode: p, label: l, type: t, floor: f, assets: t === 'residential' ? [{ name: 'تكييف', present: true, details: '2 شارب' }, { name: 'فرش', present: true, details: 'كامل' }] : [] });
    const clients = [['أحمد محمود', 'person', '01001112233', '29001011234567'], ['شركة النور للاستشارات', 'company', '01112223344', '28801011234567'], ['د. منى سعيد', 'person', '01223334455', '27901011234567'], ['سامي فؤاد', 'person', '01004445566', '30001011234567'], ['شركة الأفق', 'company', '01005556677', '28501011234567']];
    for (const [n, k, ph, id] of clients) st.clients.push({ ...M.blank.clients(), code: E.Codes.nextClient(st), name: n, kind: k, phone: ph, nationalId: id, rep: k === 'company' ? 'الممثل القانوني' : '' });
    const mk = (uc, cc, start, end, rent, inc, dep, prev) => { const c = { ...M.blank.contracts(), code: E.Codes.nextContract(st), unitCode: uc, clientCode: cc, start, end, rent, increasePct: inc, deposit: dep, depositStatus: dep ? 'held' : 'none', dueDay: 1, prevCode: prev || '' }; st.contracts.push(c); return c; };
    const c1 = mk('P01-101', 'C001', (y - 1) + '-03-01', (y + 1) + '-02-28', 12000, 10, 24000);
    const c2 = mk('P01-201', 'C002', y + '-01-01', y + '-12-31', 30000, 0, 60000);
    const c3 = mk('P01-S1', 'C003', (y - 2) + '-06-01', y + '-05-31', 15000, 10, 0);
    mk('P01-S1', 'C004', y + '-08-01', (y + 1) + '-07-31', 20000, 10, 20000, c3.code);
    mk('P02-M1', 'C005', y + '-02-15', (y + 1) + '-02-14', 25000, 7.5, 50000);
    mk('P02-301', 'C002', (y - 1) + '-10-01', y + '-04-30', 18000, 0, 0);
    const cur = U.periodOf(U.today());
    const pay = (c, period, amount, paidOn, method) => st.payments.push({ ...M.blank.payments(), code: E.Codes.nextInvoice(st, period.slice(0, 4)), contractCode: c.code, period, amount, paidOn, method: method || 'cash', source: 'web' });
    for (const c of st.contracts) { const s = U.d(c.start), e = U.d(c.end); for (const p of U.periods(U.cmp(U.periodOf(s), y + '-01') > 0 ? U.periodOf(s) : y + '-01', U.cmp(U.periodOf(e), cur) < 0 ? U.periodOf(e) : cur)) { const d = E.Engine.dueForMonth(c, p); if (!d) continue; const idx = st.contracts.indexOf(c); if (U.cmp(p, U.addMonths(cur, -1)) >= 0 && idx % 2 === 0) continue; if (idx === 1 && p.endsWith('-05')) { pay(c, p, Math.round(d.amount / 2), p + '-20', 'transfer'); continue; } pay(c, p, d.amount, p + '-0' + (3 + (idx % 5)), ['cash', 'transfer', 'instapay'][idx % 3]); } }
    st.maintenance.push({ ...M.blank.maintenance(), code: 'M0001', unitCode: 'P01-101', date: y + '-04-10', kind: 'ac', description: 'تنظيف وصيانة التكييفات', cost: 1500, borneBy: 'owner', status: 'closed', closedOn: y + '-04-12' }, { ...M.blank.maintenance(), code: 'M0002', unitCode: 'P01-S1', date: y + '-07-05', kind: 'plumbing', description: 'تسريب بالحمام بعد خروج المستأجر', cost: 900, borneBy: 'tenant', status: 'open' });
    return st;
  }
  E.Demo = { state };
})(window.Egary);
