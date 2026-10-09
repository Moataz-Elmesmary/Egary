/* =====================================================================
   views.js — الشاشات والبروفايلات والأدلة (كل رقم يفتح الصفوف التي خلفه)
   ===================================================================== */
window.Egary = window.Egary || {};
(function (E) {
  'use strict';
  const U = () => E.U, M = () => E.M, S = () => E.Store, UI = () => E.UI, En = () => E.Engine, F = () => E.Forms;
  const h = (...a) => E.UI.h(...a);
  const fm = (n, o) => U().fmtMoney(n, o), fd = (d) => U().fmtDate(d), fp = (p) => U().fmtPct(p), fn = (n) => U().fmtNum(n);
  const typeAr = k => M().label(M().UNIT_TYPES, k);

  /* ---------- أعمدة مشتركة ---------- */
  const col = {
    client: (ctx) => ({ key: 'clientName', label: 'العميل', render: r => h('a', { class: 'link', onclick: (e) => { e.stopPropagation(); ctx.open('client', r.clientCode); } }, r.clientName || '—') }),
    unit: (ctx) => ({ key: 'unitLabel', label: 'الوحدة', render: r => h('a', { onclick: (e) => { e.stopPropagation(); ctx.open('unit', r.unitCode); } }, `${r.unitLabel || '—'} `, h('span', { class: 'code' }, r.unitCode)) }),
    project: () => ({ key: 'projectName', label: 'المشروع' }),
    contract: (ctx) => ({ key: 'contractCode', label: 'العقد', render: r => UI().codeLink(r.contractCode, c => ctx.open('contract', c)) }),
    period: () => ({ key: 'period', label: 'الشهر', render: r => U().periodLabel(r.period, true) }),
    status: () => ({ key: 'status', label: 'الحالة', render: r => UI().badge(r.status, En().STATUS_AR[r.status] || r.status) }),
    money: (key, label) => ({ key, label, num: true, render: r => fm(typeof r[key] === 'object' && r[key] ? r[key].amount : r[key]) }),
  };
  function cellRows(ctx, cells) { return cells.map(c => En().row(c)); }
  function btn(label, icon, onClick, cls) { return h('button', { class: 'btn ' + (cls || ''), onclick: onClick }, icon ? UI().icon(icon) : null, label); }
  function iconBtn(icon, title, onClick, cls) { return h('button', { class: 'btn icon sm ' + (cls || ''), title, 'aria-label': title, onclick: (e) => { e.stopPropagation(); onClick(e); } }, UI().icon(icon)); }
  function empty(title, text) { return h('div', { class: 'empty' }, h('b', null, title), text || ''); }
  function section(title, body, extra) { return h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', null, title), extra || null), body); }
  async function del(ctx, entity, code, name) {
    const deps = S().dependents(entity, code);
    const ok = await UI().confirmDelete({ entityAr: M().ENTITY_AR[entity], name: name || code, deps });
    if (!ok) return false;
    try { await E.App.backupNow('before-delete'); } catch (e) { /* لا يمنع الحذف */ }
    S().batch(S().cascadeOps(entity, code));
    UI().toast(`تم حذف ${M().ENTITY_AR[entity]} ${code}`, 'ok');
    UI().closeDrawer(); ctx.rerender();
    return true;
  }

  /* =====================================================================
     لوحة المؤشرات
     ===================================================================== */
  function dashboard(el, ctx) {
    const k = En().kpis(ctx.filter);
    const st = S().state();
    el.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'لوحة المؤشرات'), h('div', { class: 'sub' }, `حتى ${fd(k.asOf)} — ${k.counts.units} وحدة · ${k.counts.contracts} عقد · ${k.counts.clients} عميل${ctx.filter.projectCode || ctx.filter.unitType || ctx.filter.status || ctx.filter.q ? ' (حسب الفلاتر)' : ''}`)), h('div', { class: 'flex wrap' }, btn('عقد جديد', 'plus', async () => { if (await F().contract()) ctx.rerender(); }, 'primary'), btn('تسجيل دفعة', 'receipt', async () => { if (await F().payment()) ctx.rerender(); }), btn('وحدة جديدة', 'door', async () => { if (await F().unit()) ctx.rerender(); }))));
    el.appendChild(ctx.filterBar());
    const tiles = h('div', { class: 'kpis' });
    const tile = (cls, label, value, detail, onClick, extra) => { const t = h('button', { class: 'kpi ' + cls, onclick: onClick, dataset: { kpi: label } }, h('span', { class: 'bar' }), h('span', { class: 'go' }, UI().icon('arrow')), h('div', { class: 'l' }, label), h('div', { class: 'v' }, value), detail ? h('div', { class: 'd' }, detail) : null, extra || null); tiles.appendChild(t); return t; };
    const mo = k.month, pm = k.prevMonth;
    const delta = pm.collected ? (mo.collected - pm.collected) / pm.collected : null;
    tile(mo.rate == null ? 'info' : mo.rate >= .9 ? 'ok' : mo.rate >= .6 ? 'warn' : 'danger', `تحصيل ${U().periodLabel(k.period, true)}${k.period !== k.currentPeriod ? ' (آخر شهر مسجَّل)' : ''}`, h('span', null, fm(mo.collected)), h('span', null, `${fp(mo.rate)} من مستحق ${fm(mo.due)}`, delta != null ? h('span', { class: delta >= 0 ? 'up' : 'down' }, ` ${delta >= 0 ? '▲' : '▼'} ${fp(Math.abs(delta))} عن الشهر السابق`) : null), () => monthEvidence(ctx, k.period));
    tile('accent', `محصَّل ${k.period.slice(0, 4)} حتى اليوم`, h('span', null, fm(k.ytd.collected)), `${k.ytd.rows.length} دفعة · معدل التحصيل ${fp(k.ytd.rate)}`, () => paymentsEvidence(ctx, k.ytd.rows, `المدفوعات المسجَّلة في ${k.period.slice(0, 4)}`), UI().spark(k.trend.map(m => m.collected)));
    if (k.pending.periods.length) tile('warn', 'بانتظار التسجيل في الورقة', h('span', null, fn(k.pending.contracts), h('small', null, 'عقد')), `${k.pending.periods.map(p => U().periodLabel(p)).join(' و')} — مستحق ${fm(k.pending.due)} لم يُسجَّل بعد (لا يُحتسب متأخرات)`, () => pendingEvidence(ctx, k.pending));
    tile(k.arrears.total > 0 ? 'danger' : 'ok', 'المتأخرات القائمة', h('span', null, fm(k.arrears.total)), `${k.arrears.rows.length} شهر على ${k.arrears.byClient.length} عميل · >90 يوم: ${fm(k.arrears.buckets.b90p)}`, () => arrearsEvidence(ctx, k.arrears));
    tile(k.occupancy.rate >= .9 ? 'ok' : k.occupancy.rate >= .75 ? 'info' : 'warn', 'نسبة الإشغال', h('span', null, fp(k.occupancy.rate), h('small', null, `${k.occupancy.occupiedCount} / ${k.occupancy.total}`)), `${k.occupancy.ending.length} تنتهي خلال 90 يومًا`, () => unitsEvidence(ctx, [...k.occupancy.occupied, ...k.occupancy.ending], 'الوحدات المؤجَّرة الآن'));
    tile(k.occupancy.vacant.length ? 'warn' : 'ok', 'وحدات شاغرة', h('span', null, fn(k.occupancy.vacant.length), h('small', null, 'وحدة')), `منها ${k.occupancy.longVacant.length} شاغرة أكثر من ${st.settings.vacancyMonths} شهور`, () => unitsEvidence(ctx, k.occupancy.vacant, 'الوحدات الشاغرة (الأطول شغورًا أولًا)'));
    tile(k.occupancy.longVacant.length ? 'danger' : 'ok', `شاغرة أكثر من ${st.settings.vacancyMonths} شهور`, h('span', null, fn(k.occupancy.longVacant.length), h('small', null, 'وحدة')), k.occupancy.longVacant.length ? `أطولها ${k.occupancy.longVacant[0].unit.label}: ${k.occupancy.longVacant[0].vacantDays} يوم` : 'لا يوجد', () => unitsEvidence(ctx, k.occupancy.longVacant, `وحدات شاغرة أكثر من ${st.settings.vacancyMonths} شهور`));
    tile(k.renewals.soon.length ? 'warn' : 'ok', 'عقود تنتهي خلال 90 يومًا', h('span', null, fn(k.renewals.soon.length), h('small', null, 'عقد')), `${k.renewals.soon30.length} خلال 30 يومًا · إيجار شهري ${fm(U().sum(k.renewals.soon, r => r.rent))}`, () => renewalsEvidence(ctx, k.renewals.soon, 'عقود تنتهي خلال 90 يومًا (بلا عقد لاحق)'));
    tile(k.renewals.ended.length ? 'danger' : 'ok', 'منتهية بلا تجديد', h('span', null, fn(k.renewals.ended.length), h('small', null, 'عقد')), 'انتهى العقد والوحدة ما زالت شاغرة', () => renewalsEvidence(ctx, k.renewals.ended, 'عقود انتهت ولم تُؤجَّر الوحدة بعدها', true));
    tile('info', 'تأمينات محتفظ بها', h('span', null, fm(k.deposits.total)), `${k.deposits.held.length} عقد · ${k.deposits.endedStillHeld.length} لعقود منتهية`, () => depositsEvidence(ctx, k.deposits));
    tile('accent', 'إيراد متعاقد عليه (12 شهرًا)', h('span', null, fm(k.next12.total)), `الإيجار الشهري الحالي ${fm(k.monthlyRentRoll)} من ${k.activeContracts.length} عقد ساري`, () => forecastEvidence(ctx, k));
    tile(k.maintenance.open.length ? 'warn' : 'ok', 'صيانة مفتوحة', h('span', null, fn(k.maintenance.open.length), h('small', null, 'طلب')), `تكلفة ${k.period.slice(0, 4)}: ${fm(k.maintenance.costYtd)}`, () => maintenanceEvidence(ctx, k.maintenance.open, 'طلبات الصيانة المفتوحة'));
    tile('info', 'الإيجار الحالي', h('span', null, fm(k.monthlyRentRoll), h('small', null, '/ شهر')), `متوسط ${fm(k.activeContracts.length ? k.monthlyRentRoll / k.activeContracts.length : 0)} للعقد`, () => contractsEvidence(ctx, k.activeContracts, `العقود السارية — إيجار شهري ${fm(k.monthlyRentRoll)}`));
    el.appendChild(tiles);

    // الرسوم
    const g = h('div', { class: 'grid g2' });
    const labels = k.trend.map(m => U().periodLabel(m.period).slice(0, 6));
    g.appendChild(section('التحصيل مقابل المستحق — آخر 12 شهرًا', UI().columns({ labels, series: [{ name: 'المحصَّل', values: k.trend.map(m => m.collected), color: UI().cssVar('--primary') }], line: { name: 'المستحق', values: k.trend.map(m => m.due), color: UI().cssVar('--danger') }, onClick: (i) => monthEvidence(ctx, k.trend[i].period) }), h('span', { class: 'hint' }, 'اضغط على أي شهر لرؤية صفوفه')));
    const projData = st.projects.map((p, i) => ({ label: p.name, value: (k.byProject.find(x => x.key === p.code) || {}).amount || 0, color: UI().PALETTE[i % 10], code: p.code }));
    g.appendChild(section(`محصَّل ${k.period.slice(0, 4)} حسب المشروع`, projData.some(d => d.value) ? UI().donut({ data: projData, fmt: fm, center: UI().short(k.ytd.collected), centerSub: 'إجمالي', onClick: d => ctx.open('project', d.code) }) : empty('لا توجد مدفوعات بعد')));
    if (k.arrears.byClient.length) g.appendChild(section('أعلى المتأخرين', UI().bars({ data: k.arrears.byClient.slice(0, 8).map(c => ({ label: c.clientName, value: c.amount, color: UI().cssVar('--danger'), code: c.clientCode, tip: `${c.clientName}: ${fm(c.amount)} عن ${c.months} شهر` })), fmt: fm, onClick: d => ctx.open('client', d.code) })));
    const typeData = M().UNIT_TYPES.map((t, i) => ({ label: t.ar, value: k.scope.units.filter(u => u.type === t.key).length, color: UI().PALETTE[(i + 4) % 10], key: t.key })).filter(d => d.value);
    g.appendChild(section('الوحدات حسب النوع', typeData.length ? UI().donut({ data: typeData, center: String(k.scope.units.length), centerSub: 'وحدة', onClick: d => { E.App.setFilter({ unitType: d.key }); ctx.go('units'); } }) : empty('لا توجد وحدات')));
    el.appendChild(g);

    // إنسايتس + المشاريع
    const ins = En().insights(k);
    const g2 = h('div', { class: 'grid g2' });
    g2.appendChild(section('أهم الملاحظات', h('div', { class: 'grid', style: { gap: '8px' } }, ins.slice(0, 6).map(i => insightEl(ctx, i, k))), btn('كل التحليلات', 'sparkles', () => ctx.go('insights'), 'sm')));
    const pc = h('div', { class: 'grid', style: { gap: '10px' } });
    for (const p of st.projects.filter(p => !ctx.filter.projectCode || p.code === ctx.filter.projectCode)) {
      const kp = En().kpis(Object.assign({}, ctx.filter, { projectCode: p.code }));
      const occ = kp.occupancy;
      pc.appendChild(h('div', { class: 'insight', onclick: () => ctx.open('project', p.code) }, h('i', { style: { background: UI().PALETTE[st.projects.indexOf(p) % 10] } }), h('div', null, h('b', null, p.name, ' ', h('span', { class: 'code' }, p.code)), h('p', null, `${occ.total} وحدة · مؤجَّر ${occ.occupiedCount} (${fp(occ.rate)}) · شاغر ${occ.vacant.length} · متأخرات ${fm(kp.arrears.total)} · محصَّل السنة ${fm(kp.ytd.collected)}`), h('div', { class: 'gbar', style: { height: '8px', marginTop: '6px' } }, h('span', { style: { insetInlineStart: 0, width: fp(occ.rate || 0) } }))), h('span', { class: 'muted' }, UI().icon('arrow'))));
    }
    g2.appendChild(section('المشاريع', pc.children.length ? pc : empty('لا توجد مشاريع', 'أضف مشروعك الأول'), btn('مشروع جديد', 'plus', async () => { if (await F().project()) ctx.rerender(); }, 'sm')));
    el.appendChild(g2);
  }
  function insightEl(ctx, i, k) {
    return h('div', { class: 'insight ' + i.sev, onclick: () => openEvidence(ctx, i.evidence, k) }, h('i'), h('div', null, h('b', null, i.title), h('p', null, i.text)), h('span', { class: 'muted' }, UI().icon('arrow')));
  }
  function openEvidence(ctx, ev, k) {
    if (!ev) return;
    k = k || En().kpis(ctx.filter);
    switch (ev.view) {
      case 'arrears': return arrearsEvidence(ctx, k.arrears, ev.bucket, ev.tab);
      case 'pending': return pendingEvidence(ctx, k.pending);
      case 'ledger': return ev.period ? monthEvidence(ctx, ev.period) : ctx.go('ledger');
      case 'units': return ev.status === 'vacant' ? unitsEvidence(ctx, k.occupancy.vacant, 'الوحدات الشاغرة') : ctx.go('units');
      case 'contracts': if (ev.status === 'ending') return renewalsEvidence(ctx, k.renewals.soon, 'عقود تنتهي خلال 90 يومًا'); if (ev.status === 'ended') return renewalsEvidence(ctx, k.renewals.ended, 'عقود منتهية بلا تجديد', true); if (ev.deposit) return depositsEvidence(ctx, k.deposits); if (ev.increase) return contractsEvidence(ctx, k.noIncrease, 'عقود سارية بلا زيادة سنوية مسجَّلة'); return ctx.go('contracts');
      case 'maintenance': return maintenanceEvidence(ctx, k.maintenance.open, 'طلبات الصيانة المفتوحة');
      case 'insights': return ctx.go('insights', ev.tab ? { tab: ev.tab } : null);
      default: return ctx.go(ev.view);
    }
  }

  /* ---------- الأدلة (drill-down) ---------- */
  function monthEvidence(ctx, period) {
    const k = En().monthTotals(En().scope(ctx.filter), period);
    const rows = k.rows;
    const cols = [col.contract(ctx), col.client(ctx), col.unit(ctx), col.project(), { key: 'due', label: 'المستحق', num: true, render: r => r.due ? fm(r.due.amount) : '—' }, col.money('paid', 'المسدَّد'), { key: 'remaining', label: 'المتبقي', num: true, render: r => fm(r.remaining) }, col.status(), { key: '_a', label: '', sortable: false, cls: 'actions', render: r => r.status !== 'paid' && r.due ? iconBtn('receipt', 'تسجيل دفعة', async () => { if (await F().payment(null, { contractCode: r.contractCode, period })) { UI().closeDrawer(); ctx.rerender(); } }, 'primary') : null }];
    ctx.evidence(`${U().periodLabel(period, true)} — مستحق ${fm(k.due)} · محصَّل ${fm(k.collected)} (${fp(k.rate)})`, rows, cols, { onRow: r => ctx.open('contract', r.contractCode), sort: 'status', foot: (d) => h('tr', null, h('td', { colspan: 4 }, 'الإجمالي'), h('td', { class: 'num' }, fm(U().sum(d, r => r.due ? r.due.amount : 0))), h('td', { class: 'num' }, fm(U().sum(d, r => r.paid))), h('td', { class: 'num' }, fm(U().sum(d, r => r.remaining))), h('td', { colspan: 2 })) });
  }
  function pendingEvidence(ctx, pending) {
    ctx.evidence(`شهور بانتظار التسجيل — ${pending.periods.map(p => U().periodLabel(p, true)).join('، ')}`, pending.rows, [col.contract(ctx), col.client(ctx), col.unit(ctx), col.project(), col.period(), col.money('amount', 'المستحق'), { key: '_a', label: '', sortable: false, cls: 'actions', render: r => iconBtn('receipt', 'تسجيل الدفعة', async () => { if (await F().payment(null, { contractCode: r.contractCode, period: r.period })) { UI().closeDrawer(); ctx.rerender(); } }, 'primary') }], { intro: `آخر شهر مكتمل التسجيل في الورقة: ${U().periodLabel(pending.enteredThrough, true)}. هذه الشهور لم يُسجَّل لها تحصيل بعد فلا تُحتسب متأخرات — سجّل الدفعات أو غيّر «آخر شهر مسجَّل» من الإعدادات.`, onRow: r => ctx.open('contract', r.contractCode), foot: d => h('tr', null, h('td', { colspan: 5 }, `${d.length} شهر × عقد`), h('td', { class: 'num' }, fm(U().sum(d, r => r.amount))), h('td')) });
  }
  function arrearsEvidence(ctx, ar, bucket, tab) {
    let rows = ar.rows;
    if (bucket === 'b90p') rows = rows.filter(r => r.overdueDays > 90);
    else if (bucket === 'b31_90') rows = rows.filter(r => r.overdueDays > 30 && r.overdueDays <= 90);
    else if (bucket === 'b30') rows = rows.filter(r => r.overdueDays <= 30);
    const body = h('div');
    const tabs = h('div', { class: 'tabs' });
    const views = {
      months: () => UI().table({ cols: [col.client(ctx), col.unit(ctx), col.project(), col.period(), { key: 'dueDate', label: 'تاريخ الاستحقاق', render: r => fd(r.dueDate) }, { key: 'overdueDays', label: 'أيام التأخير', num: true }, col.money('amount', 'المتبقي'), col.status(), { key: '_a', label: '', sortable: false, cls: 'actions', render: r => iconBtn('receipt', 'تسجيل دفعة', async () => { if (await F().payment(null, { contractCode: r.contractCode, period: r.period })) { UI().closeDrawer(); ctx.rerender(); } }, 'primary') }], rows, onRow: r => ctx.open('contract', r.contractCode), sort: 'overdueDays', sortDir: -1, foot: d => h('tr', null, h('td', { colspan: 6 }, `الإجمالي (${d.length} شهر)`), h('td', { class: 'num' }, fm(U().sum(d, r => r.amount))), h('td', { colspan: 2 })) }),
      clients: () => UI().table({ cols: [{ key: 'clientName', label: 'العميل', render: r => h('a', { onclick: () => ctx.open('client', r.clientCode) }, r.clientName) }, { key: 'months', label: 'عدد الشهور', num: true }, { key: 'maxDays', label: 'أقصى تأخير (يوم)', num: true }, col.money('amount', 'المتأخرات')], rows: ar.byClient, onRow: r => ctx.open('client', r.clientCode), sort: 'amount', sortDir: -1 }),
      aging: () => h('div', null, UI().bars({ data: [['b30', 'حتى 30 يومًا'], ['b60', '31–60 يومًا'], ['b90', '61–90 يومًا'], ['b90p', 'أكثر من 90 يومًا']].map(([k, l], i) => ({ label: l, value: ar.buckets[k], color: [UI().cssVar('--info'), UI().cssVar('--warn'), UI().cssVar('--danger'), '#8B1E1B'][i] })), fmt: fm, padL: 160 }), h('p', { class: 'muted small mt-s' }, 'عمر التأخير يُحسب من تاريخ استحقاق كل شهر حتى اليوم.')),
      projects: () => UI().table({ cols: [{ key: 'projectName', label: 'المشروع' }, { key: 'n', label: 'عدد الشهور', num: true, render: r => r.rows.length }, col.money('amount', 'المتأخرات')], rows: ar.byProject, sort: 'amount', sortDir: -1 }),
    };
    const content = h('div');
    const show = (key) => { [...tabs.children].forEach(b => b.classList.toggle('on', b.dataset.t === key)); UI().clear(content); content.appendChild(views[key]()); };
    for (const [key, label] of [['months', 'بالشهر'], ['clients', 'بالعميل'], ['projects', 'بالمشروع'], ['aging', 'أعمار المتأخرات']]) tabs.appendChild(h('button', { dataset: { t: key }, onclick: () => show(key) }, label));
    body.append(h('p', { class: 'muted' }, `إجمالي المتأخرات ${fm(U().sum(rows, r => r.amount))} — كل شهر مستحق لم يُسدَّد بعد يوم الاستحقاق + أيام السماح (${S().state().settings.graceDays} أيام).`), tabs, content);
    show(tab === 'clients' ? 'clients' : 'months');
    UI().drawer({ title: bucket === 'b90p' ? 'متأخرات أكثر من 90 يومًا' : bucket === 'b31_90' ? 'متأخرات 31–90 يومًا' : bucket === 'b30' ? 'متأخرات حتى 30 يومًا' : 'المتأخرات القائمة', body });
  }
  function unitsEvidence(ctx, list, title) {
    const rows = list.map(r => ({ ...r, unitCode: r.unit.code, unitLabel: r.unit.label, type: r.unit.type, floor: r.unit.floor }));
    ctx.evidence(title, rows, [col.unit(ctx), { key: 'projectName', label: 'المشروع' }, { key: 'type', label: 'النوع', render: r => typeAr(r.type) }, { key: 'floor', label: 'الدور' }, { key: 'status', label: 'الحالة', render: r => UI().badge(r.status, En().USTATUS_AR[r.status]) }, { key: 'clientName', label: 'المستأجر', render: r => r.contract ? h('a', { onclick: (e) => { e.stopPropagation(); ctx.open('client', r.contract.clientCode); } }, r.clientName) : '—' }, { key: 'rent', label: 'الإيجار الحالي', num: true, render: r => r.contract ? fm(En().currentRent(r.contract)) : (r.last ? h('span', { class: 'muted' }, 'آخر: ' + fm(En().currentRent(r.last))) : '—') }, { key: 'vacantDays', label: 'أيام الشغور', num: true, render: r => r.status === 'vacant' ? (r.vacantDays == null ? 'لم تُؤجَّر من قبل' : `${r.vacantDays} (منذ ${fd(r.vacantSince)})`) : (r.daysLeft != null ? `ينتهي بعد ${r.daysLeft} يوم` : '—') }], { onRow: r => ctx.open('unit', r.unitCode), sort: 'vacantDays', sortDir: -1 });
  }
  function renewalsEvidence(ctx, rows, title, ended) {
    ctx.evidence(title, rows, [col.contract(ctx), col.client(ctx), col.unit(ctx), col.project(), { key: 'end', label: 'نهاية العقد', render: r => fd(r.contract.end) }, ended ? { key: 'daysAgo', label: 'منذ (يوم)', num: true } : { key: 'daysLeft', label: 'متبقٍ (يوم)', num: true }, col.money('rent', 'الإيجار الشهري'), { key: '_a', label: '', sortable: false, cls: 'actions', render: r => iconBtn('plus', 'تجديد / عقد جديد', () => renew(ctx, r.contract), 'primary') }], { onRow: r => ctx.open('contract', r.contractCode), sort: ended ? 'daysAgo' : 'daysLeft', sortDir: ended ? -1 : 1 });
  }
  function depositsEvidence(ctx, dep) {
    ctx.evidence(`تأمينات محتفظ بها — ${fm(dep.total)}`, dep.held, [col.contract(ctx), col.client(ctx), col.unit(ctx), col.money('amount', 'التأمين'), { key: 'status', label: 'حالة العقد', render: r => UI().badge(r.status, En().CSTATUS_AR[r.status]) }, { key: 'end', label: 'نهاية العقد', render: r => fd(r.contract.end) }], { onRow: r => ctx.open('contract', r.contractCode), intro: 'عند نهاية العقد راجع صيانات الوحدة في فترة العميل قبل رد التأمين أو الخصم منه.' });
  }
  function forecastEvidence(ctx, k) {
    ctx.evidence(`الإيراد المتعاقد عليه — ${fm(k.next12.total)} خلال 12 شهرًا`, k.next12.months, [{ key: 'period', label: 'الشهر', render: r => U().periodLabel(r.period, true) }, col.money('amount', 'المستحق المتوقع')], { intro: 'محسوب من العقود المسجَّلة (السارية والمستقبلية) بجداول زياداتها السنوية، دون افتراض تجديد العقود المنتهية.', foot: d => h('tr', null, h('td', null, 'الإجمالي'), h('td', { class: 'num' }, fm(U().sum(d, r => r.amount)))) });
  }
  function maintenanceEvidence(ctx, items, title) {
    ctx.evidence(title, items, [{ key: 'code', label: 'الكود', render: r => h('span', { class: 'code' }, r.code) }, { key: 'date', label: 'التاريخ', render: r => fd(r.date) }, { key: 'unitLabel', label: 'الوحدة', render: r => h('a', { onclick: (e) => { e.stopPropagation(); ctx.open('unit', r.unitCode); } }, r.unitLabel) }, { key: 'projectName', label: 'المشروع' }, { key: 'kind', label: 'النوع', render: r => M().label(M().MAINT_KINDS, r.kind) }, { key: 'description', label: 'الوصف' }, col.money('cost', 'التكلفة'), { key: 'borneBy', label: 'يتحملها', render: r => M().label(M().BORNE_BY, r.borneBy) }, { key: 'custodianName', label: 'في عهدة', render: r => r.custodianName || h('span', { class: 'muted' }, 'شاغرة') }, { key: 'status', label: 'الحالة', render: r => UI().badge(r.status, M().label(M().MAINT_STATUS, r.status)) }], { onRow: r => ctx.open('unit', r.unitCode), sort: 'date', sortDir: -1 });
  }
  function contractsEvidence(ctx, contracts, title) {
    const rows = contracts.map(c => ({ ...En().row({ contract: c }), rent: En().currentRent(c), start: c.start, end: c.end, cstatus: En().contractStatus(c) }));
    ctx.evidence(title, rows, [col.contract(ctx), col.client(ctx), col.unit(ctx), col.project(), { key: 'start', label: 'من', render: r => fd(r.start) }, { key: 'end', label: 'إلى', render: r => fd(r.end) }, col.money('rent', 'الإيجار الحالي'), { key: 'increasePct', label: 'الزيادة', num: true, render: r => fp((r.contract.increasePct || 0) / 100) }, { key: 'cstatus', label: 'الحالة', render: r => UI().badge(r.cstatus, En().CSTATUS_AR[r.cstatus]) }], { onRow: r => ctx.open('contract', r.contractCode), foot: d => h('tr', null, h('td', { colspan: 6 }, `${d.length} عقد`), h('td', { class: 'num' }, fm(U().sum(d, r => r.rent))), h('td', { colspan: 2 })) });
  }
  function paymentsEvidence(ctx, pays, title) {
    const rows = pays.map(p => { const c = S().contract(p.contractCode) || {}; const cl = S().client(c.clientCode) || {}, u = S().unit(c.unitCode) || {}; return { ...p, clientName: cl.name, clientCode: cl.code, unitLabel: u.label, unitCode: u.code, projectName: (S().project(u.projectCode) || {}).name }; });
    ctx.evidence(title, rows, paymentCols(ctx), { onRow: r => F().invoice(r), sort: 'period', sortDir: -1, foot: d => h('tr', null, h('td', { colspan: 5 }, `الإجمالي (${d.length} دفعة)`), h('td', { class: 'num' }, fm(U().sum(d, r => r.amount))), h('td', { colspan: 3 })) });
  }
  function paymentCols(ctx) {
    return [{ key: 'code', label: 'رقم الفاتورة', render: r => h('span', { class: 'code' }, r.code) }, { key: 'paidOn', label: 'تاريخ السداد', render: r => r.paidOn ? fd(r.paidOn) : h('span', { class: 'muted' }, 'غير مسجَّل') }, col.client(ctx), col.unit(ctx), col.period(), col.money('amount', 'المبلغ'), { key: 'method', label: 'الطريقة', render: r => M().label([{ key: '', ar: 'غير محدد' }].concat(M().PAY_METHODS), r.method || '') }, { key: 'ref', label: 'مرجع' }, { key: '_a', label: '', sortable: false, cls: 'actions', render: r => h('span', null, iconBtn('print', 'الفاتورة', () => F().invoice(r)), ' ', iconBtn('edit', 'تعديل', async () => { if (await F().payment(r)) ctx.rerender(); }), ' ', iconBtn('trash', 'حذف', () => del(ctx, 'payments', r.code, r.code))) }];
  }
  function renew(ctx, c) {
    const d = U().d(c.end); const start = U().iso(U().addDays(d, 1));
    const rent = Math.round(En().currentRent(c, d) * (1 + (U().toNum(c.increasePct) || 0) / 100));
    F().contract(null, { unitCode: c.unitCode, clientCode: c.clientCode, start, rent, increasePct: c.increasePct, deposit: c.deposit, depositStatus: c.depositStatus, dueDay: c.dueDay, prevCode: c.code }).then(r => { if (r) { UI().closeDrawer(); ctx.rerender(); } });
  }

  /* =====================================================================
     كشف التحصيل (الورقة)
     ===================================================================== */
  function ledger(el, ctx) {
    const year = String(ctx.year);
    const L = En().ledger(year, ctx.filter);
    el.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, `كشف التحصيل ${year}`), h('div', { class: 'sub' }, 'نفس شكل ورقة الإكسيل: كل صف عقد، وكل خانة شهر = المبلغ المحصَّل. اضغط على الخانة لتسجيل دفعة أو تعديلها.')), h('div', { class: 'flex wrap' }, btn('عقد جديد', 'plus', async () => { if (await F().contract()) ctx.rerender(); }, 'primary'))));
    el.appendChild(ctx.filterBar({ year: true }));
    el.appendChild(h('div', { class: 'legend' }, [['paid', 'مسدَّد'], ['partial', 'جزئي'], ['late', 'متأخر'], ['due', 'مستحق (في فترة السماح)'], ['pending', 'بانتظار التسجيل'], ['upcoming', 'قادم'], ['orphan', 'خارج مدة العقد']].map(([k, l]) => h('span', null, h('i', { style: { background: `var(--${k === 'orphan' ? 'info' : k === 'pending' ? 'upcoming' : k}-soft)`, border: `1px solid var(--${k === 'orphan' ? 'info' : k === 'pending' ? 'upcoming' : k})` } }), l))));
    const months = []; for (let m = 1; m <= 12; m++) months.push(year + '-' + U().pad(m, 2));
    const thead = h('thead', null, h('tr', null, h('th', { class: 'fix c1' }, 'م'), h('th', { class: 'fix c2' }, 'المشروع'), h('th', { class: 'fix c3' }, 'الاسم'), h('th', null, 'الوحدة'), h('th', null, 'العقد من'), h('th', null, 'إلى'), ...months.map(p => h('th', { style: { textAlign: 'center' } }, U().periodLabel(p))), h('th', null, 'الإجمالي'), h('th', null, '')));
    const tbody = h('tbody');
    L.rows.forEach((r, i) => {
      const tr = h('tr');
      tr.append(h('td', { class: 'fix c1 muted' }, i + 1), h('td', { class: 'fix c2' }, r.projectName), h('td', { class: 'fix c3' }, h('a', { onclick: () => ctx.open('client', r.clientCode), title: r.clientName }, r.clientName)), h('td', null, h('a', { onclick: () => ctx.open('unit', r.unitCode) }, r.unitLabel, ' ', h('span', { class: 'code' }, r.unitCode))), h('td', null, fd(r.contract.start)), h('td', null, fd(r.contract.end)));
      for (const p of months) {
        const c = r.months[p];
        const td = h('td', { class: 'm ' + c.status, dataset: { cell: r.contractCode + '|' + p }, title: `${U().periodLabel(p, true)} — ${En().STATUS_AR[c.status]}${c.due ? ' · مستحق ' + fm(c.due.amount) : ''}${c.paid ? ' · مسدَّد ' + fm(c.paid) : ''}`, onclick: () => cellAction(ctx, r.contract, p, c) });
        td.appendChild(h('span', null, c.paid ? fm(c.paid, { plain: true }) : (c.status === 'late' || c.status === 'due' ? '—' : '')));
        if (c.status === 'partial' && c.due) td.appendChild(h('span', { class: 'hint' }, 'متبقٍ ' + fm(c.remaining, { plain: true })));
        if (c.status === 'late' && c.due) td.appendChild(h('span', { class: 'hint' }, fm(c.due.amount, { plain: true }) + ' متأخر'));
        if (c.status === 'pending' && c.due) td.appendChild(h('span', { class: 'hint' }, 'لم يُسجَّل'));
        if (r.contract.cellNotes && r.contract.cellNotes[p] && !c.paid) td.appendChild(h('span', { class: 'hint', title: r.contract.cellNotes[p] }, 'نص: ' + r.contract.cellNotes[p].slice(0, 10)));
        tr.appendChild(td);
      }
      tr.append(h('td', { class: 'tot' }, fm(r.total, { plain: true })), h('td', { class: 'actions' }, iconBtn('eye', 'العقد', () => ctx.open('contract', r.contractCode))));
      tbody.appendChild(tr);
    });
    if (!L.rows.length) tbody.appendChild(h('tr', null, h('td', { colspan: 20 }, empty('لا توجد صفوف لهذه السنة', 'غيّر السنة أو الفلاتر، أو أضف عقدًا'))));
    const tfoot = h('tfoot', null, h('tr', null, h('td', { class: 'fix c1' }), h('td', { class: 'fix c2' }), h('td', { class: 'fix c3' }, 'الإجمالي العام'), h('td', { colspan: 3 }, `${L.rows.length} صف`), ...months.map(p => h('td', { class: 'm', style: { cursor: 'pointer' }, onclick: () => monthEvidence(ctx, p) }, fm(L.monthTotals[p], { plain: true }))), h('td', { class: 'tot' }, fm(L.total, { plain: true })), h('td')));
    el.appendChild(h('div', { class: 'ledger-wrap' }, h('table', { class: 'ledger', id: 'ledger' }, thead, tbody, tfoot)));
  }
  function cellAction(ctx, c, period, cell) {
    const pays = cell.payments;
    const cl = S().client(c.clientCode) || {}, u = S().unit(c.unitCode) || {};
    const body = h('div', null,
      h('p', null, h('b', null, cl.name), ' — ', u.label, ' — ', h('b', null, U().periodLabel(period, true)), ' ', UI().badge(cell.status, En().STATUS_AR[cell.status])),
      UI().kv([['المستحق للشهر', cell.due ? fm(cell.due.amount) + (cell.due.full ? '' : ` (${cell.due.days} يوم)`) : 'خارج مدة العقد'], ['المسدَّد', fm(cell.paid)], ['المتبقي', fm(cell.remaining)], ['تاريخ الاستحقاق', cell.dueDate ? fd(cell.dueDate) : '—']]),
      pays.length ? UI().table({ cols: [{ key: 'code', label: 'الفاتورة', render: r => h('span', { class: 'code' }, r.code) }, { key: 'paidOn', label: 'التاريخ', render: r => r.paidOn ? fd(r.paidOn) : '—' }, col.money('amount', 'المبلغ'), { key: 'method', label: 'الطريقة', render: r => M().label([{ key: '', ar: 'غير محدد' }].concat(M().PAY_METHODS), r.method || '') }, { key: '_a', label: '', sortable: false, cls: 'actions', render: r => h('span', null, iconBtn('print', 'الفاتورة', () => { m.close(); F().invoice(r); }), ' ', iconBtn('edit', 'تعديل', async () => { m.close(); if (await F().payment(r)) ctx.rerender(); }), ' ', iconBtn('trash', 'حذف', async () => { m.close(); await del(ctx, 'payments', r.code, r.code); })) }], rows: pays }) : h('p', { class: 'muted mt-s' }, 'لا توجد دفعات مسجَّلة لهذا الشهر.'),
    );
    const addBtn = h('button', { class: 'btn primary', onclick: async () => { m.close(); if (await F().payment(null, { contractCode: c.code, period, amount: cell.due ? Math.max(0, cell.due.amount - cell.paid) : '' })) ctx.rerender(); } }, UI().icon('receipt'), pays.length ? 'إضافة دفعة أخرى' : 'تسجيل دفعة');
    const m = UI().modal({ title: 'خانة الشهر', body, footer: [h('button', { class: 'btn', onclick: () => { m.close(); ctx.open('contract', c.code); } }, 'فتح العقد'), addBtn] });
  }

  /* =====================================================================
     القوائم
     ===================================================================== */
  function projects(el, ctx) {
    const st = S().state();
    el.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'المشاريع'), h('div', { class: 'sub' }, 'كل مشروع له كود ثابت، وتحته الوحدات بأكوادها')), btn('مشروع جديد', 'plus', async () => { if (await F().project()) ctx.rerender(); }, 'primary')));
    const grid = h('div', { class: 'grid g3' });
    const q = ctx.filter.q;
    for (const p of st.projects.filter(p => !q || U().matches(p.code + ' ' + p.name + ' ' + p.address, q))) {
      const k = En().kpis({ projectCode: p.code });
      grid.appendChild(h('div', { class: 'card', style: { cursor: 'pointer' }, onclick: () => ctx.open('project', p.code) },
        h('div', { class: 'card-head' }, h('div', null, h('h3', null, p.name), h('span', { class: 'code' }, p.code)), h('div', null, iconBtn('edit', 'تعديل', async () => { if (await F().project(p)) ctx.rerender(); }), ' ', iconBtn('trash', 'حذف', () => del(ctx, 'projects', p.code, p.name)))),
        h('p', { class: 'muted small' }, p.address || '—'),
        h('div', { class: 'kv mt-s' }, h('div', null, h('dt', null, 'الوحدات'), h('dd', null, k.occupancy.total)), h('div', null, h('dt', null, 'الإشغال'), h('dd', null, fp(k.occupancy.rate))), h('div', null, h('dt', null, 'المتأخرات'), h('dd', { style: { color: k.arrears.total ? 'var(--danger)' : '' } }, fm(k.arrears.total))), h('div', null, h('dt', null, 'محصَّل السنة'), h('dd', null, fm(k.ytd.collected)))),
        h('div', { class: 'gbar', style: { height: '8px', marginTop: '10px' } }, h('span', { style: { insetInlineStart: 0, width: fp(k.occupancy.rate || 0) } })),
      ));
    }
    el.appendChild(grid.children.length ? grid : empty('لا توجد مشاريع', 'أضف مشروعًا جديدًا'));
  }
  function units(el, ctx) {
    const sc = En().scope(ctx.filter);
    el.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'الوحدات'), h('div', { class: 'sub' }, `${sc.units.length} وحدة — التجارية والسكنية والإدارية والجراجات`)), btn('وحدة جديدة', 'plus', async () => { if (await F().unit(null, { projectCode: ctx.filter.projectCode })) ctx.rerender(); }, 'primary')));
    el.appendChild(ctx.filterBar());
    const floors = [...new Set(En().scope(Object.assign({}, ctx.filter, { floor: '' })).units.map(u => u.floor).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
    if (floors.length > 1) el.appendChild(h('div', { class: 'flex wrap', id: 'floor-bar' }, h('span', { class: 'muted small' }, 'الدور:'), floors.map(f => h('button', { class: 'chip ' + (ctx.filter.floor === String(f) ? 'on' : ''), onclick: () => E.App.setFilter({ floor: ctx.filter.floor === String(f) ? '' : String(f) }) }, f))));
    const rows = sc.units.filter(u => !ctx.filter.floor || String(u.floor) === ctx.filter.floor).map(u => { const s = En().unitStatus(u); const cl = s.contract ? S().client(s.contract.clientCode) : null; return { ...u, unitCode: u.code, unitLabel: u.label, projectName: (S().project(u.projectCode) || {}).name, status: s.status, clientName: cl ? cl.name : '', clientCode: cl ? cl.code : '', rent: s.contract ? En().currentRent(s.contract) : null, vacantDays: s.vacantDays, daysLeft: s.daysLeft, assetsCount: (u.assets || []).filter(a => a.present).length, maint: S().maintenanceOf(u.code).length }; });
    el.appendChild(h('div', { class: 'card pad-0' }, UI().table({ cols: [{ key: 'code', label: 'الكود', render: r => h('span', { class: 'code' }, r.code) }, { key: 'label', label: 'الوحدة', render: r => h('b', null, r.label) }, col.project(), { key: 'type', label: 'النوع', render: r => typeAr(r.type) }, { key: 'floor', label: 'الدور' }, { key: 'status', label: 'الحالة', render: r => UI().badge(r.status, En().USTATUS_AR[r.status]) }, { key: 'clientName', label: 'المستأجر الحالي', render: r => r.clientName ? h('a', { onclick: (e) => { e.stopPropagation(); ctx.open('client', r.clientCode); } }, r.clientName) : h('span', { class: 'muted' }, '—') }, col.money('rent', 'الإيجار الحالي'), { key: 'vacantDays', label: 'شغور / متبقٍ', num: true, render: r => r.status === 'vacant' ? (r.vacantDays == null ? '—' : r.vacantDays + ' يوم') : (r.daysLeft + ' يوم') }, { key: 'assetsCount', label: 'أصول', num: true }, { key: 'maint', label: 'صيانات', num: true }, { key: '_a', label: '', sortable: false, cls: 'actions', render: r => h('span', null, iconBtn('edit', 'تعديل', async () => { if (await F().unit(r)) ctx.rerender(); }), ' ', iconBtn('trash', 'حذف', () => del(ctx, 'units', r.code, r.label))) }], rows, onRow: r => ctx.open('unit', r.code), emptyTitle: 'لا توجد وحدات مطابقة', empty: 'غيّر الفلاتر أو أضف وحدة' })));
  }
  function clients(el, ctx) {
    const st = S().state(), q = ctx.filter.q, sc = En().scope(ctx.filter);
    const scoped = ctx.filter.projectCode || ctx.filter.unitType || ctx.filter.status;
    el.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'العملاء'), h('div', { class: 'sub' }, 'كل عميل له كود ثابت وبروفايل يجمع عقوده ومدفوعاته والتزامه')), btn('عميل جديد', 'plus', async () => { if (await F().client()) ctx.rerender(); }, 'primary')));
    el.appendChild(ctx.filterBar({ status: false }));
    const rows = st.clients.filter(c => (!scoped || sc.clientSet.has(c.code)) && (!q || U().matches([c.code, c.name, c.rep, c.phone, c.phone2, c.nationalId, c.taxId, c.email].join(' '), q))).map(c => { const cs = S().contractsOfClient(c.code); const ar = En().arrears({ contracts: cs, contractSet: new Set(cs.map(x => x.code)) }); const active = cs.filter(x => En().contractStatus(x) === 'active'); return { ...c, contracts: cs.length, active: active.length, arrears: ar.total, lateMonths: ar.rows.length, units: active.map(x => (S().unit(x.unitCode) || {}).label).join('، '), paid: U().sum(cs, x => U().sum(S().paymentsOf(x.code), p => U().toNum(p.amount))) }; });
    el.appendChild(h('div', { class: 'card pad-0' }, UI().table({ cols: [{ key: 'code', label: 'الكود', render: r => h('span', { class: 'code' }, r.code) }, { key: 'name', label: 'الاسم', render: r => h('b', null, r.name) }, { key: 'kind', label: 'النوع', render: r => M().label(M().CLIENT_KINDS, r.kind) }, { key: 'phone', label: 'التليفون', render: r => h('span', { class: 'ltr' }, r.phone || '—') }, { key: 'nationalId', label: 'الرقم القومي / الباسبور', render: r => h('span', { class: 'ltr' }, r.nationalId || '—') }, { key: 'units', label: 'الوحدات الحالية' }, { key: 'contracts', label: 'العقود', num: true }, col.money('paid', 'إجمالي المسدَّد'), { key: 'arrears', label: 'المتأخرات', num: true, render: r => h('span', { style: { color: r.arrears ? 'var(--danger)' : '', fontWeight: r.arrears ? 700 : 400 } }, fm(r.arrears)) }, { key: '_a', label: '', sortable: false, cls: 'actions', render: r => h('span', null, iconBtn('edit', 'تعديل', async () => { if (await F().client(r)) ctx.rerender(); }), ' ', iconBtn('trash', 'حذف', () => del(ctx, 'clients', r.code, r.name))) }], rows, onRow: r => ctx.open('client', r.code), sort: 'arrears', sortDir: -1, emptyTitle: 'لا يوجد عملاء مطابقون' })));
  }
  function contracts(el, ctx) {
    const sc = En().scope(ctx.filter), p = ctx.params || {};
    el.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'العقود'), h('div', { class: 'sub' }, 'بداية – نهاية – تأمين – زيادة سنوية، وكل عقد مرتبط بوحدة وعميل')), btn('عقد جديد', 'plus', async () => { if (await F().contract()) ctx.rerender(); }, 'primary')));
    el.appendChild(ctx.filterBar({ status: false }));
    const cst = p.cstatus || '';
    const chips = h('div', { class: 'flex wrap', id: 'cstatus-bar' }, h('span', { class: 'muted small' }, 'حالة العقد:'), [['', 'الكل'], ['active', 'ساري'], ['ending', 'ينتهي خلال 90 يومًا'], ['ended', 'منتهٍ'], ['renewed', 'منتهٍ وأُجِّرت بعده'], ['future', 'لم يبدأ']].map(([k, l]) => h('button', { class: 'chip ' + (cst === k ? 'on' : ''), onclick: () => ctx.go('contracts', k ? { cstatus: k } : {}) }, l)));
    el.appendChild(chips);
    const asOf = U().today();
    let rows = sc.contracts.map(c => { const s = En().contractStatus(c, asOf); const left = U().d(c.end) ? U().daysBetween(asOf, U().d(c.end)) : null; const hasNext = S().contractsOfUnit(c.unitCode).some(o => o !== c && U().d(o.start) > U().d(c.end)); const ar = En().arrears({ contracts: [c], contractSet: new Set([c.code]) }); return { ...En().row({ contract: c }), cstatus: s, ending: s === 'active' && left <= 90 && !hasNext, daysLeft: left, rent: En().currentRent(c, asOf), paid: U().sum(S().paymentsOf(c.code), x => U().toNum(x.amount)), arrears: ar.total, start: c.start, end: c.end, deposit: c.deposit, depositStatus: c.depositStatus, increasePct: c.increasePct }; });
    if (cst === 'ending') rows = rows.filter(r => r.ending); else if (cst) rows = rows.filter(r => r.cstatus === cst);
    el.appendChild(h('div', { class: 'card pad-0' }, UI().table({ cols: [{ key: 'contractCode', label: 'الكود', render: r => h('span', { class: 'code' }, r.contractCode) }, col.client(ctx), col.unit(ctx), col.project(), { key: 'start', label: 'من', render: r => fd(r.start) }, { key: 'end', label: 'إلى', render: r => h('span', null, fd(r.end), r.ending ? h('span', { class: 'badge warn', style: { marginInlineStart: '6px' } }, `${r.daysLeft} يوم`) : null) }, col.money('rent', 'الإيجار الحالي'), { key: 'increasePct', label: 'الزيادة', num: true, render: r => (r.increasePct || 0) + '%' }, { key: 'deposit', label: 'التأمين', num: true, render: r => r.deposit ? h('span', null, fm(r.deposit), ' ', h('span', { class: 'muted small' }, M().label(M().DEPOSIT_STATUS, r.depositStatus))) : '—' }, col.money('paid', 'المسدَّد'), { key: 'arrears', label: 'المتأخرات', num: true, render: r => h('span', { style: { color: r.arrears ? 'var(--danger)' : '' } }, fm(r.arrears)) }, { key: 'cstatus', label: 'الحالة', render: r => UI().badge(r.cstatus, En().CSTATUS_AR[r.cstatus]) }, { key: '_a', label: '', sortable: false, cls: 'actions', render: r => h('span', null, iconBtn('edit', 'تعديل', async () => { if (await F().contract(r.contract)) ctx.rerender(); }), ' ', iconBtn('trash', 'حذف', () => del(ctx, 'contracts', r.contractCode, r.contractCode))) }], rows, onRow: r => ctx.open('contract', r.contractCode), sort: 'end', emptyTitle: 'لا توجد عقود مطابقة' })));
  }
  function payments(el, ctx) {
    const sc = En().scope(ctx.filter), p = ctx.params || {};
    el.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'المدفوعات والفواتير الإلكترونية'), h('div', { class: 'sub' }, 'كل دفعة لها رقم فاتورة ثابت قابل للطباعة')), btn('تسجيل دفعة', 'plus', async () => { if (await F().payment()) ctx.rerender(); }, 'primary')));
    el.appendChild(ctx.filterBar({ status: false }));
    const periods = [...new Set(S().state().payments.map(x => x.period))].sort().reverse();
    el.appendChild(h('div', { class: 'flex wrap', id: 'period-bar' }, h('span', { class: 'muted small' }, 'الشهر:'), h('select', { class: 'chip', id: 'period-select', onchange: (e) => ctx.go('payments', e.target.value ? { period: e.target.value } : {}) }, h('option', { value: '' }, 'كل الشهور'), periods.map(x => h('option', { value: x, selected: p.period === x ? true : null }, U().periodLabel(x, true))))));
    let pays = S().state().payments.filter(x => sc.contractSet.has(x.contractCode));
    if (p.period) pays = pays.filter(x => x.period === p.period);
    if (ctx.filter.q) pays = pays.filter(x => { const c = S().contract(x.contractCode) || {}; const cl = S().client(c.clientCode) || {}; return U().matches([x.code, x.ref, cl.name, cl.code].join(' '), ctx.filter.q); });
    const rows = pays.map(x => { const c = S().contract(x.contractCode) || {}; const cl = S().client(c.clientCode) || {}, u = S().unit(c.unitCode) || {}; return { ...x, clientName: cl.name, clientCode: cl.code, unitLabel: u.label, unitCode: u.code, projectName: (S().project(u.projectCode) || {}).name }; });
    el.appendChild(h('div', { class: 'card pad-0' }, UI().table({ cols: paymentCols(ctx), rows, onRow: r => F().invoice(r), sort: 'period', sortDir: -1, foot: d => h('tr', null, h('td', { colspan: 5 }, `الإجمالي (${d.length} دفعة)`), h('td', { class: 'num' }, fm(U().sum(d, r => r.amount))), h('td', { colspan: 3 })), emptyTitle: 'لا توجد دفعات مطابقة' })));
  }
  function maintenance(el, ctx) {
    const sc = En().scope(ctx.filter), p = ctx.params || {};
    const ms = En().maintenanceStats(sc);
    el.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'الصيانة والإصلاحات'), h('div', { class: 'sub' }, `${ms.open.length} مفتوحة · تكلفة هذه السنة ${fm(ms.costYtd)} (المالك ${fm(ms.byBorne.owner)} · المستأجر ${fm(ms.byBorne.tenant)})`)), btn('طلب صيانة', 'plus', async () => { if (await F().maintenance(null, { unitCode: '' })) ctx.rerender(); }, 'primary')));
    el.appendChild(ctx.filterBar({ status: false }));
    const stt = p.mstatus || '';
    el.appendChild(h('div', { class: 'flex wrap', id: 'mstatus-bar' }, h('span', { class: 'muted small' }, 'الحالة:'), [['', 'الكل'], ['open', 'مفتوحة'], ['closed', 'مغلقة']].map(([k, l]) => h('button', { class: 'chip ' + (stt === k ? 'on' : ''), onclick: () => ctx.go('maintenance', k ? { mstatus: k } : {}) }, l))));
    let items = ms.items; if (stt) items = items.filter(m => m.status === stt);
    if (ctx.filter.q) items = items.filter(m => U().matches([m.code, m.description, m.unitLabel, m.custodianName].join(' '), ctx.filter.q));
    el.appendChild(h('div', { class: 'card pad-0' }, UI().table({ cols: [{ key: 'code', label: 'الكود', render: r => h('span', { class: 'code' }, r.code) }, { key: 'date', label: 'التاريخ', render: r => fd(r.date) }, { key: 'unitLabel', label: 'الوحدة', render: r => h('a', { onclick: (e) => { e.stopPropagation(); ctx.open('unit', r.unitCode); } }, r.unitLabel, ' ', h('span', { class: 'code' }, r.unitCode)) }, { key: 'projectName', label: 'المشروع' }, { key: 'kind', label: 'النوع', render: r => M().label(M().MAINT_KINDS, r.kind) }, { key: 'description', label: 'الوصف' }, col.money('cost', 'التكلفة'), { key: 'borneBy', label: 'يتحملها', render: r => M().label(M().BORNE_BY, r.borneBy) }, { key: 'custodianName', label: 'في عهدة', render: r => r.custodianName ? h('a', { onclick: (e) => { e.stopPropagation(); ctx.open('contract', r.custodianContract); } }, r.custodianName) : h('span', { class: 'muted' }, 'شاغرة') }, { key: 'status', label: 'الحالة', render: r => UI().badge(r.status, M().label(M().MAINT_STATUS, r.status)) }, { key: '_a', label: '', sortable: false, cls: 'actions', render: r => h('span', null, iconBtn('edit', 'تعديل', async () => { if (await F().maintenance(r)) ctx.rerender(); }), ' ', iconBtn('trash', 'حذف', () => del(ctx, 'maintenance', r.code, r.description.slice(0, 30)))) }], rows: items, onRow: r => ctx.open('unit', r.unitCode), sort: 'date', sortDir: -1, emptyTitle: 'لا توجد سجلات صيانة', empty: 'سجّل أول طلب صيانة من زر «طلب صيانة»' })));
  }

  /* =====================================================================
     التحليلات
     ===================================================================== */
  function insights(el, ctx) {
    const k = En().kpis(ctx.filter), ins = En().insights(k);
    el.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'التحليلات والإنسايتس'), h('div', { class: 'sub' }, 'كل ملاحظة محسوبة لحظيًا من السجلات، واضغط عليها لرؤية الدليل'))));
    el.appendChild(ctx.filterBar());
    el.appendChild(section(`الملاحظات (${ins.length})`, h('div', { class: 'grid', style: { gap: '8px' } }, ins.map(i => insightEl(ctx, i, k)))));
    const g = h('div', { class: 'grid g2' });
    const labels = k.trend.map(m => U().periodLabel(m.period).slice(0, 6));
    g.appendChild(section('التحصيل مقابل المستحق — 12 شهرًا', UI().columns({ labels, series: [{ name: 'المحصَّل', values: k.trend.map(m => m.collected), color: UI().cssVar('--primary') }], line: { name: 'المستحق', values: k.trend.map(m => m.due), color: UI().cssVar('--danger') }, onClick: (i) => monthEvidence(ctx, k.trend[i].period) })));
    g.appendChild(section('معدل التحصيل الشهري', UI().columns({ labels, series: [{ name: 'نسبة التحصيل %', values: k.trend.map(m => m.rate == null ? 0 : Math.round(m.rate * 100)), color: UI().cssVar('--accent') }], onClick: (i) => monthEvidence(ctx, k.trend[i].period) })));
    g.appendChild(section('أعمار المتأخرات', UI().bars({ data: [['b30', 'حتى 30 يومًا'], ['b60', '31–60'], ['b90', '61–90'], ['b90p', 'أكثر من 90']].map(([key, l], i) => ({ label: l, value: k.arrears.buckets[key], color: [UI().cssVar('--info'), UI().cssVar('--warn'), UI().cssVar('--danger'), '#8B1E1B'][i], key })), fmt: fm, padL: 150, onClick: d => arrearsEvidence(ctx, k.arrears, d.key === 'b90p' ? 'b90p' : null) })));
    g.appendChild(section('أعلى 10 مدينين', k.arrears.byClient.length ? UI().bars({ data: k.arrears.byClient.slice(0, 10).map(c => ({ label: c.clientName, value: c.amount, color: UI().cssVar('--danger'), code: c.clientCode })), fmt: fm, onClick: d => ctx.open('client', d.code) }) : empty('لا توجد متأخرات')));
    g.appendChild(section('محصَّل السنة حسب المشروع', UI().donut({ data: k.byProject.map((o, i) => ({ label: o.name, value: o.amount, color: UI().PALETTE[i % 10], code: o.key })), fmt: fm, center: UI().short(k.ytd.collected), onClick: d => ctx.open('project', d.code) })));
    g.appendChild(section('محصَّل السنة حسب نوع الوحدة', UI().donut({ data: k.byType.map((o, i) => ({ label: o.name, value: o.amount, color: UI().PALETTE[(i + 4) % 10], key: o.key })), fmt: fm, center: UI().short(k.ytd.collected), onClick: d => { E.App.setFilter({ unitType: d.key }); ctx.go('ledger'); } })));
    g.appendChild(section('متوسط الإيجار الشهري حسب النوع (العقود السارية)', UI().bars({ data: k.avgRentByType.map((t, i) => ({ label: `${t.name} (${t.count})`, value: Math.round(t.avg), color: UI().PALETTE[(i + 4) % 10], key: t.key })), fmt: fm, onClick: d => { E.App.setFilter({ unitType: d.key }); ctx.go('contracts'); } })));
    g.appendChild(section('الإيراد المتعاقد عليه — 12 شهرًا قادمة', UI().columns({ labels: k.next12.months.map(m => U().periodLabel(m.period).slice(0, 6)), series: [{ name: 'المستحق المتوقع', values: k.next12.months.map(m => m.amount), color: UI().cssVar('--accent') }], onClick: () => forecastEvidence(ctx, k) })));
    el.appendChild(g);
    el.appendChild(section('التزام العملاء بالسداد', UI().table({ cols: [{ key: 'clientName', label: 'العميل', render: r => h('a', { onclick: () => ctx.open('client', r.clientCode) }, r.clientName) }, { key: 'contracts', label: 'العقود', num: true }, { key: 'payments', label: 'الدفعات', num: true }, { key: 'score', label: 'في الموعد', num: true, render: r => r.score == null ? h('span', { class: 'muted', title: 'لا توجد دفعات بتاريخ سداد مسجَّل' }, '—') : UI().badge(r.score >= .8 ? 'ok' : r.score >= .5 ? 'warn' : 'danger', fp(r.score)) }, { key: 'lateMonths', label: 'شهور متأخرة', num: true }, { key: 'maxDays', label: 'أقصى تأخير (يوم)', num: true }, col.money('arrears', 'المتأخرات')], rows: k.punctuality, onRow: r => ctx.open('client', r.clientCode), sort: 'arrears', sortDir: -1 }), h('span', { class: 'hint' }, 'نسبة «في الموعد» تُحسب من الدفعات التي لها تاريخ سداد مسجَّل')));
    el.appendChild(section('الفجوات بين عقود الوحدة الواحدة (فاقد إعادة التأجير)', k.gaps.length ? UI().table({ cols: [{ key: 'unitLabel', label: 'الوحدة', render: r => h('a', { onclick: () => ctx.open('unit', r.unitCode) }, r.unitLabel, ' ', h('span', { class: 'code' }, r.unitCode)) }, { key: 'projectName', label: 'المشروع' }, { key: 'prev', label: 'العقد السابق', render: r => h('span', null, UI().codeLink(r.prev.code, c => ctx.open('contract', c)), ' حتى ', fd(r.prev.end)) }, { key: 'next', label: 'العقد التالي', render: r => h('span', null, UI().codeLink(r.next.code, c => ctx.open('contract', c)), ' من ', fd(r.next.start)) }, { key: 'days', label: 'أيام الشغور', num: true }, col.money('lost', 'فاقد تقديري')], rows: k.gaps, sort: 'days', sortDir: -1 }) : empty('لا توجد فجوات', 'كل وحدة أُعيد تأجيرها مباشرة بعد انتهاء العقد السابق')));
    el.appendChild(section('الصيانة حسب الوحدة', k.maintenance.byUnit.length ? UI().table({ cols: [{ key: 'unitLabel', label: 'الوحدة', render: r => h('a', { onclick: () => ctx.open('unit', r.unitCode) }, r.unitLabel) }, { key: 'projectName', label: 'المشروع' }, { key: 'count', label: 'عدد السجلات', num: true }, col.money('cost', 'إجمالي التكلفة')], rows: k.maintenance.byUnit, sort: 'cost', sortDir: -1 }) : empty('لا توجد سجلات صيانة بعد')));
  }
  function quality(el, ctx) {
    const flags = En().dataQuality();
    el.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'جودة البيانات'), h('div', { class: 'sub' }, 'ملاحظات اكتُشفت عند قراءة الإكسيل أو من تناقضات السجلات — راجعها وصحّحها من مكانها'))));
    const kinds = { projects: 'project', units: 'unit', clients: 'client', contracts: 'contract' };
    el.appendChild(h('div', { class: 'card pad-0' }, UI().table({ cols: [{ key: 'sev', label: 'الأهمية', render: r => UI().badge(r.sev, { danger: 'خطأ', warn: 'تحذير', info: 'ملاحظة' }[r.sev]) }, { key: 'entity', label: 'الكيان', render: r => M().ENTITY_AR[r.entity] || r.entity }, { key: 'code', label: 'الكود', render: r => kinds[r.entity] ? UI().codeLink(r.code, c => ctx.open(kinds[r.entity], c)) : (r.entity === 'payments' ? UI().codeLink(r.code, c => { const p = S().get('payments', c); if (p) F().invoice(p); }) : h('span', { class: 'code' }, r.code)) }, { key: 'text', label: 'الملاحظة' }], rows: flags, emptyTitle: 'لا توجد ملاحظات', empty: 'البيانات متّسقة' })));
  }
  function audit(el, ctx) {
    const st = S().state();
    el.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'سجل التعديلات'), h('div', { class: 'sub' }, 'كل إضافة وتعديل وحذف من البرنامج (آخر 500) — يُحفظ في ورقة «سجل التعديلات»'))));
    el.appendChild(h('div', { class: 'card pad-0' }, UI().table({ cols: [{ key: 'at', label: 'الوقت', render: r => h('span', { class: 'ltr' }, r.at) }, { key: 'action', label: 'العملية', render: r => UI().badge(r.action === 'حذف' ? 'danger' : r.action === 'إضافة' ? 'ok' : 'info', r.action) }, { key: 'entity', label: 'الكيان' }, { key: 'code', label: 'الكود', render: r => h('span', { class: 'code' }, r.code) }, { key: 'summary', label: 'التفاصيل' }], rows: st.audit, emptyTitle: 'لا توجد تعديلات بعد' })));
  }
  function settings(el, ctx) {
    const st = S().state(), sy = E.Sync.status;
    el.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'الإعدادات والملف'), h('div', { class: 'sub' }, 'ربط ملف الإكسيل، وقواعد الاستحقاق، وبيانات المكتب'))));
    const stateAr = { unlinked: 'غير مرتبط', linked: 'مرتبط ومتزامن', saving: 'جارٍ الحفظ', reading: 'جارٍ القراءة', locked: 'الملف مفتوح في Excel (بانتظار الإغلاق)', error: 'خطأ' };
    const modeAr = { linked: 'مرتبط بملف الإكسيل — كل تعديل يُحفظ تلقائيًا', preview: 'عرض فقط (نسخة من الاستضافة)', file: 'ملف مفتوح للعرض بلا ربط', demo: 'بيانات تجريبية', none: '—' };
    el.appendChild(h('div', { class: 'grid g2' },
      section('ملف الإكسيل', h('div', null, UI().kv([['الوضع', modeAr[ctx.mode] || ctx.mode], ['الملف', sy.name || '—'], ['حالة المزامنة', stateAr[sy.state] || sy.state], ['تعديلات بانتظار الحفظ', sy.pending], ['آخر مزامنة', sy.lastSync ? new Date(sy.lastSync).toLocaleString('ar-EG') : '—'], ['سنوات الورقة', (st.settings.ledgerYears || []).join('، ')]]), h('div', { class: 'flex wrap mt' }, E.FileLink.supported ? btn(ctx.mode === 'linked' ? 'ربط ملف آخر' : 'ربط ملف الإكسيل', 'link', () => E.App.linkFile(), 'primary') : null, btn('تنزيل نسخة إكسيل الآن', 'download', () => E.App.downloadCopy()), btn('آخر نسخة احتياطية', 'shield', () => E.App.downloadBackup()), btn('الملف الأصلي قبل أول تحويل', 'file', () => E.App.downloadOriginal()), ctx.mode === 'linked' ? btn('حفظ الآن', 'check', () => E.Sync.flush().then(ok => UI().toast(ok ? 'تم الحفظ في الإكسيل' : 'تعذّر الحفظ الآن', ok ? 'ok' : 'warn'))) : null, ctx.mode === 'linked' ? btn('إلغاء الربط', 'x', async () => { if (await UI().confirm({ title: 'إلغاء ربط الملف', text: 'سيتوقف الحفظ التلقائي حتى تربط الملف مرة أخرى. البيانات في الإكسيل لن تُمس.', okText: 'إلغاء الربط' })) { E.Sync.unlink(); await E.FileLink.clearHandle(); location.reload(); } }, 'ghost') : null), h('p', { class: 'small muted mt-s' }, 'القاعدة: الإكسيل هو مصدر الحقيقة. البرنامج يراقب الملف كل ثانيتين ويقرأ أي تعديل، ويكتب كل تعديل منه فورًا. لو الملف مفتوح في Excel تُحفظ التعديلات مؤقتًا وتُكتب بعد إغلاقه.'))),
      section('قواعد الاستحقاق والمكتب', h('div', null, UI().kv([['اسم المكتب', st.meta.officeName], ['أيام السماح', st.settings.graceDays], ['يوم الاستحقاق الافتراضي', st.settings.dueDay], ['عتبة الشغور الطويل', st.settings.vacancyMonths + ' شهور'], ['بداية المحاسبة', st.settings.trackingFrom], ['آخر شهر مسجَّل في الورقة', st.settings.enteredThrough ? st.settings.enteredThrough + ' (يدوي)' : U().periodLabel(En().enteredThrough(), true) + ' (تلقائي)'], ['فرق مقبول في السداد', `${st.settings.tolerancePct}% وبحد أدنى ${st.settings.toleranceMin} ج`], ['الزيادة الافتراضية', st.settings.defaultIncreasePct + '%'], ['بادئة الفاتورة', st.settings.invoicePrefix], ['العملة', st.settings.currency]]), h('div', { class: 'flex wrap mt' }, btn('تعديل الإعدادات', 'edit', async () => { if (await F().settings()) ctx.rerender(); }, 'primary'), btn(document.documentElement.dataset.theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن', document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', () => E.App.toggleTheme())))),
    ));
    const bk = E.Backup.status();
    el.appendChild(section('النسخ الاحتياطي', h('div', null,
      UI().kv([['على القرص (مجلد backups)', bk.enabled ? h('span', { class: 'badge ok' }, 'مفعَّل في ' + bk.dirName) : h('span', { class: 'badge warn' }, 'غير مفعَّل')], ['آخر نسخة على القرص', bk.lastAt ? new Date(bk.lastAt).toLocaleString('ar-EG') + ' — ' + bk.lastName : '—'], ['عدد النسخ على القرص', bk.enabled ? bk.count : '—'], ['داخل المتصفح', 'آخر 12 ملفًا سليمًا + الملف الأصلي (تلقائي دائمًا)'], ['السياسة', 'نسخة بعد كل تعديل (كل 20 دقيقة على الأكثر) + نسخة فورية قبل أي حذف + نسخة أصلية لا تُحذف · الاحتفاظ بآخر 60 نسخة دورية'], bk.error ? ['خطأ', h('span', { style: { color: 'var(--danger)' } }, bk.error)] : null]),
      h('div', { class: 'flex wrap mt' }, E.FileLink.dirSupported && ctx.mode === 'linked' ? btn(bk.enabled ? 'تغيير مجلد النسخ' : 'تفعيل النسخ على القرص (اختر مجلد البرنامج)', 'shield', () => E.App.enableBackups(), bk.enabled ? '' : 'primary') : null, btn('نسخة الآن', 'check', () => E.App.backupNow().then(r => { if (r === 'browser') UI().toast('حُفظت نسخة داخل المتصفح (فعّل المجلد لنسخة على القرص)', 'ok'); ctx.rerender(); })), btn('تنزيل نسخة إكسيل', 'download', () => E.App.downloadCopy())),
      h('p', { class: 'small muted mt-s' }, 'النسخ على القرص ملفات إكسيل عادية في مجلد backups بجوار البرنامج؛ لاستعادة نسخة: أغلق البرنامج وانسخ الملف المطلوب فوق Egary.xlsx.'),
    )));
    el.appendChild(section('ملخص البيانات', UI().kv([['المشاريع', st.projects.length], ['الوحدات', st.units.length], ['العملاء', st.clients.length], ['العقود', st.contracts.length], ['الدفعات / الفواتير', st.payments.length], ['سجلات الصيانة', st.maintenance.length], ['ملاحظات جودة البيانات', En().dataQuality().length]])));
  }

  /* =====================================================================
     البروفايلات (أدراج)
     ===================================================================== */
  function profile(kind, code, ctx) {
    const fn = { project: projectProfile, unit: unitProfile, client: clientProfile, contract: contractProfile }[kind];
    if (!fn) return;
    const rec = S().get({ project: 'projects', unit: 'units', client: 'clients', contract: 'contracts' }[kind], code);
    if (!rec) { UI().toast('غير موجود: ' + code, 'warn'); return; }
    fn(rec, ctx);
  }
  function head(avatarText, title, code, badges, meta) {
    return h('div', { class: 'card' }, h('div', { class: 'profile-head' }, h('div', { class: 'avatar' }, avatarText), h('div', { class: 'grow' }, h('div', { class: 'flex wrap' }, h('h2', null, title), h('span', { class: 'code' }, code), ...(badges || [])), h('div', { class: 'meta' }, ...(meta || []).filter(Boolean).map(m => h('span', null, m))))));
  }
  function projectProfile(p, ctx) {
    const k = En().kpis({ projectCode: p.code });
    const unitsRows = S().unitsOf(p.code).map(u => { const s = En().unitStatus(u); const cl = s.contract ? S().client(s.contract.clientCode) : null; return { ...u, unitCode: u.code, unitLabel: u.label, status: s.status, clientName: cl ? cl.name : '', clientCode: cl ? cl.code : '', rent: s.contract ? En().currentRent(s.contract) : null, vacantDays: s.vacantDays, contractCode: s.contract ? s.contract.code : '' }; });
    const body = [
      head(p.name.slice(0, 2), p.name, p.code, [], [p.address, p.area, `${k.occupancy.total} وحدة`]),
      h('div', { class: 'kpis' }, kpiMini('الإشغال', fp(k.occupancy.rate), `${k.occupancy.occupiedCount} / ${k.occupancy.total}`, () => unitsEvidence(ctx, [...k.occupancy.occupied, ...k.occupancy.ending], 'المؤجَّرة في ' + p.name)), kpiMini('شاغرة', k.occupancy.vacant.length, `${k.occupancy.longVacant.length} أكثر من ${S().state().settings.vacancyMonths} شهور`, () => unitsEvidence(ctx, k.occupancy.vacant, 'الشاغرة في ' + p.name), 'warn'), kpiMini('المتأخرات', fm(k.arrears.total), `${k.arrears.byClient.length} عميل`, () => arrearsEvidence(ctx, k.arrears), 'danger'), kpiMini('محصَّل السنة', fm(k.ytd.collected), `${fp(k.ytd.rate)} من المستحق`, () => paymentsEvidence(ctx, k.ytd.rows, 'مدفوعات ' + p.name)), kpiMini('الإيجار الشهري', fm(k.monthlyRentRoll), `${k.activeContracts.length} عقد ساري`, () => contractsEvidence(ctx, k.activeContracts, 'العقود السارية في ' + p.name)), kpiMini('تنتهي خلال 90 يومًا', k.renewals.soon.length, 'عقد', () => renewalsEvidence(ctx, k.renewals.soon, 'تنتهي قريبًا في ' + p.name), 'warn')),
      section(`الوحدات (${unitsRows.length}) — الأكواد المرتبطة بالمشروع`, UI().table({ cols: [{ key: 'code', label: 'الكود', render: r => h('span', { class: 'code' }, r.code) }, { key: 'label', label: 'الوحدة', render: r => h('b', null, r.label) }, { key: 'type', label: 'النوع', render: r => typeAr(r.type) }, { key: 'floor', label: 'الدور' }, { key: 'status', label: 'الحالة', render: r => UI().badge(r.status, En().USTATUS_AR[r.status]) }, { key: 'clientName', label: 'المستأجر', render: r => r.clientName ? h('a', { onclick: (e) => { e.stopPropagation(); ctx.open('client', r.clientCode); } }, r.clientName) : '—' }, col.money('rent', 'الإيجار'), { key: 'vacantDays', label: 'أيام الشغور', num: true, render: r => r.status === 'vacant' ? (r.vacantDays == null ? '—' : r.vacantDays) : '' }], rows: unitsRows, onRow: r => ctx.open('unit', r.code), sort: 'label' }), btn('وحدة جديدة', 'plus', async () => { if (await F().unit(null, { projectCode: p.code })) { ctx.rerender(); projectProfile(S().project(p.code), ctx); } }, 'sm primary')),
      section('ملاحظات', h('p', null, p.notes || h('span', { class: 'muted' }, '—'))),
    ];
    UI().drawer({ title: 'مشروع: ' + p.name, body, actions: [btn('تعديل', 'edit', async () => { if (await F().project(p)) { ctx.rerender(); projectProfile(S().project(p.code), ctx); } }, 'sm'), btn('حذف', 'trash', () => del(ctx, 'projects', p.code, p.name), 'sm danger')] });
  }
  function kpiMini(label, value, detail, onClick, cls) { return h('button', { class: 'kpi ' + (cls || ''), onclick: onClick }, h('span', { class: 'bar' }), h('div', { class: 'l' }, label), h('div', { class: 'v', style: { fontSize: '20px' } }, value), h('div', { class: 'd' }, detail)); }

  function unitProfile(u, ctx) {
    const p = S().project(u.projectCode) || {}, s = En().unitStatus(u), cl = s.contract ? S().client(s.contract.clientCode) : null;
    const cs = S().contractsOfUnit(u.code).slice().reverse();
    const maint = S().maintenanceOf(u.code).map(m => { const c = m.custodianContract ? S().contract(m.custodianContract) : En().activeContractOf(u.code, U().d(m.date) || U().today()); const cc = c ? S().client(c.clientCode) : null; return { ...m, custodianName: m.custodianName || (cc ? cc.name : ''), custodianContract: c ? c.code : '' }; });
    const assets = u.assets || [];
    const body = [
      head(u.label.slice(0, 3), `وحدة ${u.label}`, u.code, [UI().badge(s.status, En().USTATUS_AR[s.status]), h('span', { class: 'badge info' }, typeAr(u.type))], [h('a', { onclick: () => ctx.open('project', p.code) }, p.name), p.address, u.floor ? 'الدور ' + u.floor : '', u.area ? u.area + ' م²' : '']),
      h('div', { class: 'grid g2' },
        section('الحالة الآن', s.contract ? h('div', null, UI().kv([['المستأجر', h('a', { onclick: () => ctx.open('client', cl.code) }, cl.name)], ['العقد', UI().codeLink(s.contract.code, c => ctx.open('contract', c))], ['من', fd(s.contract.start)], ['إلى', `${fd(s.contract.end)} (${s.daysLeft} يوم)`], ['الإيجار الحالي', fm(En().currentRent(s.contract))], ['التأمين', s.contract.deposit ? `${fm(s.contract.deposit)} — ${M().label(M().DEPOSIT_STATUS, s.contract.depositStatus)}` : '—'], ['متأخرات العقد', fm(En().arrears({ contracts: [s.contract], contractSet: new Set([s.contract.code]) }).total)]])) : h('div', null, UI().kv([['شاغرة منذ', s.vacantSince ? `${fd(s.vacantSince)} (${s.vacantDays} يوم)` : 'لم تُؤجَّر من قبل'], ['آخر مستأجر', s.last ? h('a', { onclick: () => ctx.open('client', s.last.clientCode) }, (S().client(s.last.clientCode) || {}).name) : '—'], ['آخر إيجار', s.last ? fm(En().currentRent(s.last, U().d(s.last.end))) : '—'], ['عقد قادم', s.next ? UI().codeLink(s.next.code, c => ctx.open('contract', c)) : '—']]), btn('عقد جديد لهذه الوحدة', 'plus', () => F().contract(null, { unitCode: u.code }).then(r => { if (r) { ctx.rerender(); unitProfile(u, ctx); } }), 'primary mt-s'))),
        section('الأصول والمحتويات', assets.length ? h('div', { class: 'grid', style: { gap: '6px' } }, assets.map(a => h('div', { class: 'flex' }, h('span', { class: 'badge ' + (a.present ? 'ok' : 'muted') }, a.present ? 'موجود' : 'غير موجود'), h('b', null, a.name), a.details ? h('span', { class: 'muted' }, '— ' + a.details) : null))) : empty('لم تُسجَّل أصول', 'عدّل الوحدة لتحديد التكييف والفرش وغيرها'), btn('تعديل', 'edit', async () => { if (await F().unit(u)) { ctx.rerender(); unitProfile(S().unit(u.code), ctx); } }, 'sm')),
      ),
      section(`تاريخ الإيجار (${cs.length} عقد) — من سكن الوحدة ومتى وبكم`, cs.length ? h('div', { class: 'timeline' }, cs.map(c => { const cc = S().client(c.clientCode) || {}; const cst = En().contractStatus(c); const paid = U().sum(S().paymentsOf(c.code), x => U().toNum(x.amount)); const ar = En().arrears({ contracts: [c], contractSet: new Set([c.code]) }).total; return h('div', { class: 'tl ' + cst }, h('span', { class: 'dot' }), h('div', { class: 'body', style: { cursor: 'pointer' }, onclick: () => ctx.open('contract', c.code) }, h('div', { class: 'flex wrap between' }, h('b', null, cc.name || '—'), h('span', { class: 'flex' }, UI().badge(cst, En().CSTATUS_AR[cst]), h('span', { class: 'code' }, c.code))), h('div', { class: 'muted small' }, `${fd(c.start)} → ${fd(c.end)} · الإيجار ${En().schedule(c).map(y => fm(y.rent, { plain: true })).join(' ← ')} · زيادة ${c.increasePct || 0}% · تأمين ${c.deposit ? fm(c.deposit) : '—'}`), h('div', { class: 'small' }, `المسدَّد ${fm(paid)}`, ar ? h('span', { style: { color: 'var(--danger)' } }, ` · متأخرات ${fm(ar)}`) : null))); })) : empty('لم تُؤجَّر من قبل')),
      section(`متابعة الصيانة والإصلاحات (${maint.length})`, UI().table({ cols: [{ key: 'date', label: 'التاريخ', render: r => fd(r.date) }, { key: 'kind', label: 'النوع', render: r => M().label(M().MAINT_KINDS, r.kind) }, { key: 'description', label: 'الوصف' }, col.money('cost', 'التكلفة'), { key: 'borneBy', label: 'يتحملها', render: r => M().label(M().BORNE_BY, r.borneBy) }, { key: 'custodianName', label: 'كانت في عهدة', render: r => r.custodianName ? h('a', { onclick: (e) => { e.stopPropagation(); ctx.open('contract', r.custodianContract); } }, r.custodianName) : h('span', { class: 'muted' }, 'شاغرة') }, { key: 'status', label: 'الحالة', render: r => UI().badge(r.status, M().label(M().MAINT_STATUS, r.status)) }, { key: '_a', label: '', sortable: false, cls: 'actions', render: r => h('span', null, iconBtn('edit', 'تعديل', async () => { if (await F().maintenance(r)) { ctx.rerender(); unitProfile(u, ctx); } }), ' ', iconBtn('trash', 'حذف', async () => { if (await del(ctx, 'maintenance', r.code, r.description.slice(0, 30))) unitProfile(u, ctx); })) }], rows: maint, sort: 'date', sortDir: -1, emptyTitle: 'لا توجد سجلات صيانة', empty: 'سجّل أي إصلاح هنا ليُعرف في عهدة مَن كانت الوحدة' }), btn('تسجيل صيانة', 'wrench', () => F().maintenance(null, { unitCode: u.code }).then(r => { if (r) { ctx.rerender(); unitProfile(u, ctx); } }), 'sm primary')),
      u.notes ? section('ملاحظات', h('p', null, u.notes)) : null,
    ];
    UI().drawer({ title: `${u.label} — ${p.name}`, body, actions: [btn('تعديل', 'edit', async () => { if (await F().unit(u)) { ctx.rerender(); unitProfile(S().unit(u.code), ctx); } }, 'sm'), btn('حذف', 'trash', () => del(ctx, 'units', u.code, u.label), 'sm danger')] });
  }
  function clientProfile(c, ctx) {
    const cs = S().contractsOfClient(c.code).slice().sort((a, b) => U().cmp(b.start, a.start));
    const sc = { contracts: cs, contractSet: new Set(cs.map(x => x.code)) };
    const ar = En().arrears(sc);
    const pays = cs.flatMap(x => S().paymentsOf(x.code)).sort((a, b) => U().cmp(b.period, a.period));
    const paid = U().sum(pays, p => U().toNum(p.amount));
    const active = cs.filter(x => En().contractStatus(x) === 'active');
    const punct = En().punctuality({ clients: [c], contractSet: sc.contractSet })[0];
    const rows = cs.map(x => ({ ...En().row({ contract: x }), cstatus: En().contractStatus(x), start: x.start, end: x.end, rent: En().currentRent(x), paid: U().sum(S().paymentsOf(x.code), p => U().toNum(p.amount)), arrears: En().arrears({ contracts: [x], contractSet: new Set([x.code]) }).total, deposit: x.deposit, depositStatus: x.depositStatus }));
    const body = [
      head(c.name.slice(0, 2), c.name, c.code, [h('span', { class: 'badge info' }, M().label(M().CLIENT_KINDS, c.kind)), ar.total ? UI().badge('danger', 'عليه متأخرات') : UI().badge('ok', 'لا متأخرات')], [c.rep ? 'الممثل القانوني: ' + c.rep : '', c.phone ? h('span', { class: 'ltr' }, c.phone) : '', c.nationalId ? 'رقم قومي/باسبور: ' + c.nationalId : '', c.taxId ? 'تسجيل ضريبي: ' + c.taxId : '', c.email]),
      h('div', { class: 'kpis' }, kpiMini('العقود', cs.length, `${active.length} ساري`, () => contractsEvidence(ctx, cs, 'عقود ' + c.name)), kpiMini('إجمالي المسدَّد', fm(paid), `${pays.length} دفعة`, () => paymentsEvidence(ctx, pays, 'مدفوعات ' + c.name), 'accent'), kpiMini('المتأخرات', fm(ar.total), `${ar.rows.length} شهر · أقصى تأخير ${ar.rows.length ? Math.max(...ar.rows.map(r => r.overdueDays)) : 0} يوم`, () => arrearsEvidence(ctx, ar), ar.total ? 'danger' : 'ok'), kpiMini('الالتزام بالموعد', punct && punct.score != null ? fp(punct.score) : '—', punct && punct.knownDates ? `من ${punct.knownDates} دفعة بتاريخ` : 'لا دفعات بتاريخ مسجَّل', () => paymentsEvidence(ctx, pays, 'مدفوعات ' + c.name), 'info'), kpiMini('الوحدات الحالية', active.length, active.map(x => (S().unit(x.unitCode) || {}).label).join('، ') || '—', () => contractsEvidence(ctx, active, 'الوحدات الحالية لـ' + c.name))),
      section('بيانات العميل', UI().kv([['الاسم', c.name], ['النوع', M().label(M().CLIENT_KINDS, c.kind)], ['الممثل القانوني', c.rep], ['الرقم القومي / الباسبور', c.nationalId ? h('span', { class: 'ltr' }, c.nationalId) : ''], ['رقم التسجيل الضريبي', c.taxId ? h('span', { class: 'ltr' }, c.taxId) : ''], ['التليفون', c.phone ? h('span', { class: 'ltr' }, c.phone) : ''], ['تليفون آخر', c.phone2 ? h('span', { class: 'ltr' }, c.phone2) : ''], ['البريد', c.email], ['العنوان', c.address], ['تفاصيل', c.notes]])),
      section(`العقود (${cs.length}) — أين سكن ومتى وبكم`, UI().table({ cols: [{ key: 'contractCode', label: 'العقد', render: r => h('span', { class: 'code' }, r.contractCode) }, col.unit(ctx), col.project(), { key: 'start', label: 'من', render: r => fd(r.start) }, { key: 'end', label: 'إلى', render: r => fd(r.end) }, col.money('rent', 'الإيجار'), { key: 'deposit', label: 'التأمين', num: true, render: r => r.deposit ? `${fm(r.deposit)} (${M().label(M().DEPOSIT_STATUS, r.depositStatus)})` : '—' }, col.money('paid', 'المسدَّد'), { key: 'arrears', label: 'المتأخرات', num: true, render: r => h('span', { style: { color: r.arrears ? 'var(--danger)' : '' } }, fm(r.arrears)) }, { key: 'cstatus', label: 'الحالة', render: r => UI().badge(r.cstatus, En().CSTATUS_AR[r.cstatus]) }], rows, onRow: r => ctx.open('contract', r.contractCode), emptyTitle: 'لا توجد عقود' }), btn('عقد جديد لهذا العميل', 'plus', () => F().contract(null, { clientCode: c.code }).then(r => { if (r) { ctx.rerender(); clientProfile(c, ctx); } }), 'sm primary')),
      ar.rows.length ? section('الشهور المتأخرة', UI().table({ cols: [col.unit(ctx), col.period(), { key: 'dueDate', label: 'الاستحقاق', render: r => fd(r.dueDate) }, { key: 'overdueDays', label: 'أيام التأخير', num: true }, col.money('amount', 'المتبقي'), { key: '_a', label: '', sortable: false, cls: 'actions', render: r => iconBtn('receipt', 'تسجيل دفعة', async () => { if (await F().payment(null, { contractCode: r.contractCode, period: r.period })) { ctx.rerender(); clientProfile(c, ctx); } }, 'primary') }], rows: ar.rows, sort: 'overdueDays', sortDir: -1 })) : null,
      section(`آخر المدفوعات (${pays.length})`, UI().table({ cols: paymentCols(ctx).filter(cc => cc.key !== 'clientName'), rows: pays.slice(0, 24), onRow: r => F().invoice(r), emptyTitle: 'لا توجد مدفوعات' })),
    ];
    UI().drawer({ title: 'عميل: ' + c.name, body, actions: [btn('تعديل', 'edit', async () => { if (await F().client(c)) { ctx.rerender(); clientProfile(S().client(c.code), ctx); } }, 'sm'), btn('حذف', 'trash', () => del(ctx, 'clients', c.code, c.name), 'sm danger')] });
  }
  function contractProfile(c, ctx) {
    const cl = S().client(c.clientCode) || {}, u = S().unit(c.unitCode) || {}, p = S().project(u.projectCode) || {};
    const cst = En().contractStatus(c), sch = En().schedule(c);
    const pays = S().paymentsOf(c.code).slice().sort((a, b) => U().cmp(b.period, a.period));
    const paid = U().sum(pays, x => U().toNum(x.amount));
    const ar = En().arrears({ contracts: [c], contractSet: new Set([c.code]) });
    const prev = c.prevCode ? S().contract(c.prevCode) : null, next = S().nextContract(c) || S().contractsOfUnit(c.unitCode).find(o => o !== c && U().d(o.start) > U().d(c.end)) || null;
    // شبكة شهور العقد
    const s = U().d(c.start), e = U().d(c.end);
    const months = [];
    if (s && e && e >= s) { const from = U().cmp(U().periodOf(s), S().state().settings.trackingFrom) > 0 ? U().periodOf(s) : S().state().settings.trackingFrom; for (const pr of U().periods(from, U().periodOf(e))) months.push(En().cell(c, pr)); }
    const orphan = pays.filter(x => !En().dueForMonth(c, x.period));
    const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '6px' } }, months.map(m => h('button', { class: 'kpi ' + ({ paid: 'ok', partial: 'warn', late: 'danger', due: 'info', upcoming: '', advance: 'info' }[m.status] || ''), style: { padding: '8px 10px' }, dataset: { month: m.period }, onclick: () => cellAction(ctx, c, m.period, m) }, h('span', { class: 'bar' }), h('div', { class: 'l' }, U().periodLabel(m.period, true)), h('div', { class: 'v', style: { fontSize: '15px' } }, m.paid ? fm(m.paid, { plain: true }) : '—'), h('div', { class: 'd' }, UI().badge(m.status, En().STATUS_AR[m.status])))));
    const body = [
      head('عقد', `${cl.name || '—'} — ${u.label || '—'}`, c.code, [UI().badge(cst, En().CSTATUS_AR[cst])], [h('a', { onclick: () => ctx.open('client', cl.code) }, 'بروفايل العميل'), h('a', { onclick: () => ctx.open('unit', u.code) }, 'بروفايل الوحدة'), p.name]),
      h('div', { class: 'kpis' }, kpiMini('الإيجار الحالي', fm(En().currentRent(c)), `زيادة سنوية ${c.increasePct || 0}%`, () => { }, 'accent'), kpiMini('المسدَّد', fm(paid), `${pays.length} دفعة`, () => paymentsEvidence(ctx, pays, 'مدفوعات العقد ' + c.code)), kpiMini('المتأخرات', fm(ar.total), `${ar.rows.length} شهر`, () => arrearsEvidence(ctx, ar), ar.total ? 'danger' : 'ok'), kpiMini('التأمين', c.deposit ? fm(c.deposit) : '—', M().label(M().DEPOSIT_STATUS, c.depositStatus), () => ctx.open('unit', u.code), 'info')),
      section('بيانات العقد', UI().kv([['بداية العقد', fd(c.start)], ['نهاية العقد', fd(c.end)], ['المدة', s && e ? Math.round(U().daysBetween(s, e) / 30.4) + ' شهر' : ''], ['يوم الاستحقاق', c.dueDay || 1], ['الإيجار (السنة الأولى)', fm(c.rent)], ['الزيادة السنوية', (c.increasePct || 0) + '%'], ['التأمين', c.deposit ? `${fm(c.deposit)} — ${M().label(M().DEPOSIT_STATUS, c.depositStatus)}` : 'بدون'], ['العقد السابق', prev ? UI().codeLink(prev.code, x => ctx.open('contract', x)) : '—'], ['العقد التالي', next ? UI().codeLink(next.code, x => ctx.open('contract', x)) : '—'], ['ملاحظات', c.notes]])),
      section('جدول سنوات العقد', UI().table({ cols: [{ key: 'k', label: 'السنة', render: r => 'السنة ' + r.k }, { key: 'from', label: 'من', render: r => fd(r.from) }, { key: 'to', label: 'إلى', render: r => fd(r.to) }, col.money('rent', 'الإيجار الشهري'), { key: 'ov', label: '', sortable: false, render: r => c.rentOverrides && c.rentOverrides[r.k] != null ? h('span', { class: 'muted small' }, 'قيمة يدوية') : '' }], rows: sch, emptyTitle: 'تواريخ العقد غير صحيحة' })),
      section('شهور العقد — اضغط على أي شهر لتسجيل أو مراجعة السداد', months.length ? grid : empty('لا شهور ضمن فترة المحاسبة')),
      orphan.length ? section('دفعات خارج مدة العقد (فترة سابقة لنفس المستأجر)', UI().table({ cols: [col.period(), col.money('amount', 'المبلغ'), { key: 'code', label: 'الفاتورة', render: r => h('span', { class: 'code' }, r.code) }], rows: orphan })) : null,
      section(`الفواتير (${pays.length})`, UI().table({ cols: paymentCols(ctx).filter(cc => cc.key !== 'clientName' && cc.key !== 'unitLabel'), rows: pays, onRow: r => F().invoice(r), emptyTitle: 'لا توجد دفعات' }), btn('تسجيل دفعة', 'receipt', () => F().payment(null, { contractCode: c.code }).then(r => { if (r) { ctx.rerender(); contractProfile(c, ctx); } }), 'sm primary')),
    ];
    UI().drawer({ title: 'عقد ' + c.code, body, actions: [btn('تجديد', 'plus', () => renew(ctx, c), 'sm primary'), btn('تعديل', 'edit', async () => { if (await F().contract(c)) { ctx.rerender(); contractProfile(S().contract(c.code), ctx); } }, 'sm'), btn('حذف', 'trash', () => del(ctx, 'contracts', c.code, c.code), 'sm danger')] });
  }

  const PAGES = { dashboard, ledger, insights, projects, units, clients, contracts, payments, maintenance, quality, audit, settings };
  function render(name, el, ctx) { (PAGES[name] || dashboard)(el, ctx); }
  E.Views = { render, profile, monthEvidence, arrearsEvidence, pendingEvidence, unitsEvidence, renewalsEvidence, depositsEvidence, forecastEvidence, maintenanceEvidence, contractsEvidence, paymentsEvidence, openEvidence, insightEl, renew, del };
})(window.Egary);
