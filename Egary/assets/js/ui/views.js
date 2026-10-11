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
    client: (ctx) => ({ key: 'clientName', label: 'العميل', cls: 'wrap', render: r => h('a', { class: 'link', onclick: (e) => { e.stopPropagation(); ctx.open('client', r.clientCode); } }, r.clientName || '—') }),
    // وحدة محذوفة من الإكسيل (العقد/الصيانة يشير إلى كود غير موجود): شارة واضحة بدل رابط لا يفتح شيئًا
    unit: (ctx) => ({ key: 'unitLabel', label: 'الوحدة', render: r => r.unitCode && !S().unit(r.unitCode) ? orphanBadge('بلا وحدة', r.unitCode) : h('a', { onclick: (e) => { e.stopPropagation(); ctx.open('unit', r.unitCode); } }, `${r.unitLabel || '—'} `, h('span', { class: 'code' }, r.unitCode)) }),
    project: () => ({ key: 'projectName', label: 'المشروع' }),
    contract: (ctx) => ({ key: 'contractCode', label: 'العقد', render: r => UI().codeLink(r.contractCode, c => ctx.open('contract', c)) }),
    period: () => ({ key: 'period', label: 'الشهر', render: r => U().periodLabel(r.period, true) }),
    status: () => ({ key: 'status', label: 'الحالة', render: r => UI().badge(r.status, En().STATUS_AR[r.status] || r.status) }),
    money: (key, label) => ({ key, label, num: true, render: r => fm(typeof r[key] === 'object' && r[key] ? r[key].amount : r[key]) }),
  };
  function cellRows(ctx, cells) { return cells.map(c => En().row(c)); }
  function orphanBadge(text, code) { return h('span', { class: 'badge danger', title: `${text} — الكود ${code} غير موجود في الإكسيل` }, text, ' ', h('span', { class: 'code' }, code)); }
  function btn(label, icon, onClick, cls) { return h('button', { class: 'btn ' + (cls || ''), onclick: onClick }, icon ? UI().icon(icon) : null, label); }
  function iconBtn(icon, title, onClick, cls) { return h('button', { class: 'btn icon sm ' + (cls || ''), title, 'aria-label': title, onclick: (e) => { e.stopPropagation(); onClick(e); } }, UI().icon(icon)); }
  function empty(title, text) { return h('div', { class: 'empty' }, h('b', null, title), text || ''); }
  /* ---------- تذكير بالمتأخرات عبر واتساب (رسالة جاهزة من الأرقام) ---------- */
  function waNumber(phone) { let d = String(phone || '').replace(/\D/g, ''); if (!d) return ''; if (d.startsWith('00')) d = d.slice(2); if (d.startsWith('0')) d = '20' + d.slice(1); else if (d.length === 10 && d.startsWith('1')) d = '20' + d; return d; }
  function reminderText(c, ar) {
    const st = S().state(); const rows = (ar.rows || []).slice().sort((a, b) => U().cmp(a.period, b.period));
    const byUnit = [...U().groupBy(rows, r => r.unitCode)].map(([code, rs]) => { const u = S().unit(code) || {}; return `${u.label || code}: ${rs.map(r => U().periodLabel(r.period, true)).join('، ')} (${fm(U().sum(rs, r => r.amount))})`; });
    return `السلام عليكم ${c.name}،\nنذكّركم بأن الإيجار المستحق لم يُسدَّد بعد:\n${byUnit.map(x => '• ' + x).join('\n')}\nالإجمالي المستحق: ${fm(ar.total != null ? ar.total : U().sum(rows, r => r.amount))}.\nبرجاء السداد في أقرب وقت، ولأي استفسار تواصلوا معنا.\n${st.meta.officeName || 'إيجاري'}`;
  }
  function remind(c, ar) {
    if (!c) return null;
    const txt = reminderText(c, ar), n = waNumber(c.phone || c.phone2);
    const ta = h('textarea', { class: 'reminder-text', id: 'reminder-text', rows: 8, style: { width: '100%', border: '1px solid var(--line)', borderRadius: '10px', padding: '10px 12px', background: 'var(--surface)', resize: 'vertical' } }, txt);
    const link = () => 'https://wa.me/' + n + '?text=' + encodeURIComponent(ta.value);
    const m = UI().modal({ title: 'تذكير بالمتأخرات — ' + c.name, size: 'md', body: h('div', null, ta, h('p', { class: 'small muted mt-s' }, n ? 'سيُفتح واتساب على الرقم ' + n + ' والرسالة جاهزة للإرسال (يمكنك تعديلها قبل الفتح).' : 'لا يوجد رقم تليفون مسجَّل للعميل — انسخ النص وأرسله يدويًا، أو أضف الرقم من «تعديل».')), footer: [
      h('button', { class: 'btn', id: 'btn-copy-reminder', onclick: () => { try { navigator.clipboard.writeText(ta.value); UI().toast('تم نسخ نص التذكير', 'ok'); } catch (e) { ta.select(); document.execCommand && document.execCommand('copy'); UI().toast('تم نسخ نص التذكير', 'ok'); } } }, UI().icon('copy'), 'نسخ النص'),
      n ? h('a', { class: 'btn primary', id: 'btn-wa', href: link(), target: '_blank', rel: 'noopener', onclick: (e) => { e.currentTarget.href = link(); setTimeout(() => m.close(), 200); } }, UI().icon('chat'), 'فتح واتساب') : null,
    ] });
    return m;
  }
  function section(title, body, extra) { return h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', null, title), extra || null), body); }
  async function del(ctx, entity, code, name, detail) {
    if (E.Auth && !E.Auth.can('delete', entity)) { UI().toast(E.Auth.can('edit') ? `صلاحياتك لا تسمح بحذف ${M().ENTITY_AR[entity] || entity} — اطلب من المدير` : `حسابك للمشاهدة فقط — صلاحياتك لا تسمح بحذف ${M().ENTITY_AR[entity] || entity}`, 'warn'); return false; }
    const deps = S().dependents(entity, code);
    // عقد ساري له دفعات: الحذف يمسح تاريخ التحصيل — نوجّه إلى «إنهاء العقد»
    const c = entity === 'contracts' ? S().contract(code) : null;
    const note = c && deps.payments.length && En().contractStatus(c) === 'active' ? 'لإنهاء عقد ساري (المستأجر ترك الوحدة) استخدم «إنهاء العقد» بدل الحذف — الحذف يمسح دفعاته من الإكسيل.' : '';
    if (entity === 'payments' && !detail) { const p = S().get('payments', code); if (p) detail = payDesc(p); }
    const ok = await UI().confirmDelete({ entityAr: M().ENTITY_AR[entity], name: name || code, deps, detail, note });
    if (!ok) return false;
    try { await E.App.backupNow('before-delete'); } catch (e) { /* لا يمنع الحذف */ }
    S().batch(S().cascadeOps(entity, code));
    UI().toast(`تم حذف ${M().ENTITY_AR[entity]} ${code}`, 'ok');
    UI().closeDrawer(); ctx.rerender();
    return true;
  }

  /* وصف الدفعة في رسائل التأكيد: العميل — الشهر — المبلغ */
  function payDesc(p) { const c = S().contract(p.contractCode) || {}; const cl = S().client(c.clientCode) || {}, u = S().unit(c.unitCode) || {}; return `${cl.name || '—'}${u.label ? ' — ' + u.label : ''} — ${U().periodLabel(p.period, true)} — ${fm(p.amount)}`; }
  /* بعد إضافة سجل: الصفحة تُعاد ويُفتح بروفايله مباشرة (فيه الخطوة التالية: تأجير / تسجيل دفعة) */
  function created(ctx, kind, r) { if (!r) return r; ctx.rerender(); ctx.open(kind, r.code); return r; }
  const newClient = (ctx, defaults) => F().client(null, defaults).then(r => created(ctx, 'client', r));
  const newUnit = (ctx, defaults) => F().unit(null, defaults).then(r => created(ctx, 'unit', r));
  const newContract = (ctx, defaults) => F().contract(null, defaults).then(r => created(ctx, 'contract', r));
  /* تأجير وحدة شاغرة / تأجير وحدة لعميل: نموذج العقد جاهز بالوحدة أو العميل، وبعد الحفظ يُفتح العقد الجديد */
  const rentUnit = (ctx, unitCode) => newContract(ctx, { unitCode });
  const rentToClient = (ctx, clientCode) => newContract(ctx, { clientCode });
  /* تسجيل دفعة لعميل: عقد واحد ساري ⇒ مثبَّت، وإلا قائمة عقوده فقط؛ الشهر = أول شهر مفتوح */
  const payFor = (ctx, clientCode, after) => F().payment(null, { clientCode }).then(r => { if (r) { ctx.rerender(); if (after) after(); } return r; });

  /* =====================================================================
     لوحة المؤشرات
     ===================================================================== */
  /* نص البحث يفلتر القوائم فقط: اللوحة والتحليلات تُحسب بلا بحث (حتى لا تصفر الأرقام بسبب بحث قديم) */
  function withoutQ(ctx) { return ctx.filter && ctx.filter.q ? Object.assign({}, ctx, { filter: Object.assign({}, ctx.filter, { q: '' }) }) : ctx; }
  function dashboard(el, ctx) {
    ctx = withoutQ(ctx);
    const k = En().kpis(ctx.filter);
    const st = S().state();
    el.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'لوحة المؤشرات'), h('div', { class: 'sub' }, `حتى ${fd(k.asOf)} — ${k.counts.units} وحدة · ${k.counts.contracts} عقد · ${k.counts.clients} عميل${ctx.filter.projectCode || ctx.filter.unitType || ctx.filter.status || ctx.filter.period || ctx.filter.from ? ' (حسب الفلاتر)' : ''}${ctx.filter.from ? ' · المحاسبة من ' + ctx.filter.from.slice(0, 4) : ''}`)), h('div', { class: 'flex wrap' }, btn('عقد جديد', 'plus', () => newContract(ctx), 'primary'), btn('تسجيل دفعة', 'receipt', async () => { if (await F().payment()) ctx.rerender(); }), btn('عميل جديد', 'users', () => newClient(ctx)), btn('وحدة جديدة', 'door', () => newUnit(ctx)))));
    el.appendChild(ctx.filterBar({ period: true, q: false, defaultPeriod: k.defaultPeriod || k.period }));
    const tiles = h('div', { class: 'kpis secondary' }), tilesP = h('div', { class: 'kpis primary' });
    const tile = (cls, label, value, detail, onClick, extra, primary) => { const t = h('button', { class: 'kpi ' + cls, onclick: onClick, dataset: { kpi: label } }, h('span', { class: 'bar' }), h('span', { class: 'go' }, UI().icon('arrow')), h('div', { class: 'l' }, label), h('div', { class: 'v' }, value), detail ? h('div', { class: 'd' }, detail) : null, extra || null); if (primary && detail) t.title = label + ' — ' + (typeof detail === 'string' ? detail : detail.textContent); (primary ? tilesP : tiles).appendChild(t); return t; };
    const ptile = (cls, label, value, detail, onClick, extra) => tile(cls, label, value, detail, onClick, extra, true);
    const mo = k.month, pm = k.prevMonth;
    const delta = pm.collected ? (mo.collected - pm.collected) / pm.collected : null;
    ptile(mo.rate == null ? 'info' : mo.rate >= .9 ? 'ok' : mo.rate >= .6 ? 'warn' : 'danger', `تحصيل ${U().periodLabel(k.period, true)}${k.selectedPeriod ? ' (الشهر المختار)' : k.period !== k.currentPeriod ? ' (آخر شهر مسجَّل)' : ''}`, h('span', null, fm(mo.collected)), h('span', null, `${fp(mo.rate)} من مستحق ${fm(mo.due)}`, delta != null ? h('span', { class: delta >= 0 ? 'up' : 'down' }, ` ${delta >= 0 ? '▲' : '▼'} ${fp(Math.abs(delta))} عن الشهر السابق`) : null), () => monthEvidence(ctx, k.period));
    ptile('accent', `محصَّل ${k.reportYear}${k.reportYear === k.currentPeriod.slice(0, 4) ? ' حتى اليوم' : ' (السنة كاملة)'}`, h('span', null, fm(k.ytd.collected)), `${k.ytd.rows.length} دفعة · معدل التحصيل ${fp(k.ytd.rate)}`, () => paymentsEvidence(ctx, k.ytd.rows, `المدفوعات المسجَّلة في ${k.period.slice(0, 4)}`), UI().spark(k.trend.map(m => m.collected)));
    if (k.pending.periods.length) { const pt = ptile('warn', 'إيجار شهور لم تُسجَّل بعد', h('span', null, fm(k.pending.due)), `${k.pending.periods.map(p => U().periodLabel(p)).join(' و')} · ${fn(k.pending.contracts)} عقدًا · آخر شهر مسجَّل: ${U().periodLabel(k.enteredThrough, true)} — لا تُعدّ متأخرات حتى تُسجَّل مدفوعاتها`, () => pendingEvidence(ctx, k.pending)); pt.title = 'كشف التحصيل متأخر عن الواقع: أي شهر بعد آخر شهر فيه تسجيل يُعتبر «لم يُسجَّل بعد» لا «متأخرًا» حتى لا تظهر متأخرات وهمية. سجِّلوا مدفوعات هذه الشهور (من كشف التحصيل أو من هنا) فينتقل الحساب تلقائيًا. يمكن ضبط آخر شهر مسجَّل يدويًا من الإعدادات.'; }
    ptile(k.arrears.total > 0 ? 'danger' : 'ok', 'المتأخرات القائمة', h('span', null, fm(k.arrears.total)), `${k.arrears.rows.length} شهر على ${k.arrears.byClient.length} عميل · أكثر من 90 يومًا: ${fm(k.arrears.buckets.b90p)}`, () => arrearsEvidence(ctx, k.arrears));
    ptile(k.occupancy.rate >= .9 ? 'ok' : k.occupancy.rate >= .75 ? 'info' : 'warn', 'نسبة الإشغال', h('span', null, fp(k.occupancy.rate), h('small', null, `${k.occupancy.occupiedCount} / ${k.occupancy.total}`)), `${k.occupancy.ending.length} تنتهي خلال 90 يومًا`, () => unitsEvidence(ctx, [...k.occupancy.occupied, ...k.occupancy.ending], 'الوحدات المؤجَّرة الآن'));
    tile(k.occupancy.vacant.length ? 'warn' : 'ok', 'وحدات شاغرة', h('span', null, fn(k.occupancy.vacant.length), h('small', null, 'وحدة')), `منها ${k.occupancy.longVacant.length} شاغرة أكثر من ${st.settings.vacancyMonths} شهور`, () => unitsEvidence(ctx, k.occupancy.vacant, 'الوحدات الشاغرة (الأطول شغورًا أولًا)'));
    tile(k.occupancy.longVacant.length ? 'danger' : 'ok', `شاغرة أكثر من ${st.settings.vacancyMonths} شهور`, h('span', null, fn(k.occupancy.longVacant.length), h('small', null, 'وحدة')), k.occupancy.longVacant.length ? `أطولها ${k.occupancy.longVacant[0].unit.label}: ${k.occupancy.longVacant[0].vacantDays} يوم` : 'لا يوجد', () => unitsEvidence(ctx, k.occupancy.longVacant, `وحدات شاغرة أكثر من ${st.settings.vacancyMonths} شهور`));
    tile(k.renewals.soon.length ? 'warn' : 'ok', 'عقود تنتهي خلال 90 يومًا', h('span', null, fn(k.renewals.soon.length), h('small', null, 'عقد')), `${k.renewals.soon30.length} خلال 30 يومًا · إيجار شهري ${fm(U().sum(k.renewals.soon, r => r.rent))}`, () => renewalsEvidence(ctx, k.renewals.soon, 'عقود تنتهي خلال 90 يومًا (بلا عقد لاحق)'));
    tile(k.renewals.ended.length ? 'danger' : 'ok', 'منتهية بلا تجديد', h('span', null, fn(k.renewals.ended.length), h('small', null, 'عقد')), 'انتهى العقد والوحدة ما زالت شاغرة', () => renewalsEvidence(ctx, k.renewals.ended, 'عقود انتهت ولم تُؤجَّر الوحدة بعدها', true));
    tile('info', 'تأمينات محتفظ بها', h('span', null, fm(k.deposits.total)), `${k.deposits.held.length} عقد · ${k.deposits.endedStillHeld.length} لعقود منتهية`, () => depositsEvidence(ctx, k.deposits));
    tile('accent', 'إيراد متعاقد عليه (12 شهرًا)', h('span', null, fm(k.next12.total)), `الإيجار الشهري الحالي ${fm(k.monthlyRentRoll)} من ${k.activeContracts.length} عقد ساري`, () => forecastEvidence(ctx, k));
    tile(k.maintenance.open.length ? 'warn' : 'ok', 'صيانة مفتوحة', h('span', null, fn(k.maintenance.open.length), h('small', null, 'طلب')), `تكلفة ${k.maintenance.year || String(k.asOf).slice(0, 4)}: ${fm(k.maintenance.costYtd)}`, () => maintenanceEvidence(ctx, k.maintenance.open, 'طلبات الصيانة المفتوحة'));
    tile('info', 'الإيجار الحالي', h('span', null, fm(k.monthlyRentRoll), h('small', null, '/ شهر')), `متوسط ${fm(k.activeContracts.length ? k.monthlyRentRoll / k.activeContracts.length : 0)} للعقد`, () => contractsEvidence(ctx, k.activeContracts, `العقود السارية — إيجار شهري ${fm(k.monthlyRentRoll)}`));
    tilesP.style.setProperty('--n', String(tilesP.children.length)); tiles.style.setProperty('--n2x', String(tiles.children.length)); // الشاشات الواسعة: كل البطاقات الثانوية في صف واحد
    el.appendChild(tilesP);
    el.appendChild(h('div', { class: 'kpis-head' }, h('span', null, 'مؤشرات إضافية — كل بطاقة تفتح صفوفها'), h('span', null, `حتى ${fd(k.asOf)}`)));
    el.appendChild(tiles);

    // الرسوم
    const g = h('div', { class: 'grid g2' });
    const labels = k.trend.map(m => U().periodLabel(m.period).slice(0, 6));
    g.appendChild(section(k.selectedPeriod ? `التحصيل مقابل المستحق — 12 شهرًا حتى ${U().periodLabel(k.period, true)}` : 'التحصيل مقابل المستحق — آخر 12 شهرًا', UI().columns({ labels, series: [{ name: 'المحصَّل', values: k.trend.map(m => m.collected), color: UI().cssVar('--primary') }], line: { name: 'المستحق', values: k.trend.map(m => m.due), color: UI().cssVar('--warn') }, highlight: k.trend.findIndex(m => m.period === k.period), onClick: (i) => monthEvidence(ctx, k.trend[i].period) }), h('span', { class: 'hint' }, 'اضغط على أي شهر لرؤية صفوفه')));
    const projData = st.projects.map((p, i) => ({ label: p.name, value: (k.byProject.find(x => x.key === p.code) || {}).amount || 0, color: UI().PALETTE[i % 10], code: p.code }));
    g.appendChild(section(`محصَّل ${k.reportYear} حسب المشروع`, projData.some(d => d.value) ? UI().donut({ data: projData, fmt: fm, center: UI().short(k.ytd.collected), centerSub: 'إجمالي', onClick: d => ctx.open('project', d.code) }) : empty('لا توجد مدفوعات بعد')));
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
      case 'contracts': if (ev.status === 'ending') return renewalsEvidence(ctx, k.renewals.soon, 'عقود تنتهي خلال 90 يومًا'); if (ev.status === 'ended') return renewalsEvidence(ctx, k.renewals.ended, 'عقود منتهية بلا تجديد', true); if (ev.deposit === 'held-ended') { const held = k.deposits.endedStillHeld; return depositsEvidence(ctx, { held, total: U().sum(held, r => r.amount), endedStillHeld: held }, 'تأمينات محتفظ بها لعقود منتهية'); } if (ev.deposit) return depositsEvidence(ctx, k.deposits); if (ev.increase) return contractsEvidence(ctx, k.noIncrease, 'عقود سارية بلا زيادة سنوية مسجَّلة'); return ctx.go('contracts');
      case 'maintenance': return maintenanceEvidence(ctx, k.maintenance.open, 'طلبات الصيانة المفتوحة');
      // بطاقات التحليلات: كل واحدة تفتح دليلها الحقيقي بدل إعادة رسم الصفحة نفسها
      case 'insights': if (ev.tab === 'forecast') return forecastEvidence(ctx, k); if (ev.tab === 'trend') return monthEvidence(ctx, k.period); if (ev.tab === 'gaps') gapsScrolled = false; return ctx.go('insights', ev.tab ? { tab: ev.tab } : null);
      default: return ctx.go(ev.view);
    }
  }

  /* ---------- الأدلة (drill-down) ---------- */
  function monthEvidence(ctx, period) {
    const k = En().monthTotals(En().contractScope(ctx.filter), period); // نفس صفوف كشف التحصيل (البحث على مستوى العقد)
    const rows = k.rows;
    const cols = [col.contract(ctx), col.client(ctx), col.unit(ctx), col.project(), { key: 'due', label: 'المستحق', num: true, render: r => r.due ? fm(r.due.amount) : '—' }, col.money('paid', 'المسدَّد'), { key: 'remaining', label: 'المتبقي', num: true, render: r => fm(r.remaining) }, col.status(), { key: '_a', label: '', sortable: false, cls: 'actions', render: r => r.status !== 'paid' && r.due ? iconBtn('receipt', 'تسجيل دفعة', async () => { if (await F().payment(null, { contractCode: r.contractCode, period })) { UI().closeDrawer(); ctx.rerender(); } }, 'primary') : null }];
    ctx.evidence(`${U().periodLabel(period, true)} — مستحق ${fm(k.due)} · محصَّل ${fm(k.collected)} (${fp(k.rate)})`, rows, cols, { onRow: r => ctx.open('contract', r.contractCode), sort: 'status', foot: (d) => h('tr', null, h('td', { colspan: 4 }, 'الإجمالي'), h('td', { class: 'num' }, fm(U().sum(d, r => r.due ? r.due.amount : 0))), h('td', { class: 'num' }, fm(U().sum(d, r => r.paid))), h('td', { class: 'num' }, fm(U().sum(d, r => r.remaining))), h('td', { colspan: 2 })) });
  }
  function pendingEvidence(ctx, pending) {
    ctx.evidence(`شهور لم تُسجَّل في كشف التحصيل بعد — ${pending.periods.map(p => U().periodLabel(p, true)).join('، ')}`, pending.rows, [col.contract(ctx), col.client(ctx), col.unit(ctx), col.project(), col.period(), col.money('amount', 'المستحق'), { key: '_a', label: '', sortable: false, cls: 'actions', render: r => iconBtn('receipt', 'تسجيل الدفعة', async () => { if (await F().payment(null, { contractCode: r.contractCode, period: r.period })) { UI().closeDrawer(); ctx.rerender(); } }, 'primary') }], { intro: `آخر شهر مكتمل التسجيل في كشف التحصيل: ${U().periodLabel(pending.enteredThrough, true)}. هذه الشهور لم يُسجَّل لها تحصيل بعد فلا تُحتسب متأخرات — سجّل الدفعات أو غيّر «آخر شهر مسجَّل» من الإعدادات.`, onRow: r => ctx.open('contract', r.contractCode), foot: d => h('tr', null, h('td', { colspan: 5 }, `${d.length} شهر × عقد`), h('td', { class: 'num' }, fm(U().sum(d, r => r.amount))), h('td')) });
  }
  function arrearsEvidence(ctx, ar, bucket, tab) {
    let rows = ar.rows;
    if (bucket === 'b90p') rows = rows.filter(r => r.overdueDays > 90);
    else if (bucket === 'b31_90') rows = rows.filter(r => r.overdueDays > 30 && r.overdueDays <= 90);
    else if (bucket === 'b31_60') rows = rows.filter(r => r.overdueDays > 30 && r.overdueDays <= 60);
    else if (bucket === 'b61_90') rows = rows.filter(r => r.overdueDays > 60 && r.overdueDays <= 90);
    else if (bucket === 'b30') rows = rows.filter(r => r.overdueDays <= 30);
    const BUCKET_AR = { b90p: 'متأخرات أكثر من 90 يومًا', b31_90: 'متأخرات 31–90 يومًا', b31_60: 'متأخرات 31–60 يومًا', b61_90: 'متأخرات 61–90 يومًا', b30: 'متأخرات حتى 30 يومًا' };
    const body = h('div');
    const tabs = h('div', { class: 'tabs' });
    const views = {
      months: () => UI().table({ cols: [col.client(ctx), col.unit(ctx), col.project(), col.period(), { key: 'dueDate', label: 'تاريخ الاستحقاق', render: r => fd(r.dueDate) }, { key: 'overdueDays', label: 'أيام التأخير', num: true }, col.money('amount', 'المتبقي'), col.status(), { key: '_a', label: '', sortable: false, cls: 'actions', render: r => iconBtn('receipt', 'تسجيل دفعة', async () => { if (await F().payment(null, { contractCode: r.contractCode, period: r.period })) { UI().closeDrawer(); ctx.rerender(); } }, 'primary') }], rows, onRow: r => ctx.open('contract', r.contractCode), sort: 'overdueDays', sortDir: -1, foot: d => h('tr', null, h('td', { colspan: 6 }, `الإجمالي (${d.length} شهر)`), h('td', { class: 'num' }, fm(U().sum(d, r => r.amount))), h('td', { colspan: 2 })) }),
      clients: () => UI().table({ cols: [{ key: 'clientName', label: 'العميل', render: r => h('a', { onclick: () => ctx.open('client', r.clientCode) }, r.clientName) }, { key: 'months', label: 'عدد الشهور', num: true }, { key: 'maxDays', label: 'أقصى تأخير (يوم)', num: true }, col.money('amount', 'المتأخرات'), { key: '_a', label: '', sortable: false, cls: 'actions', render: r => h('span', null, iconBtn('chat', 'تذكير واتساب', () => remind(S().client(r.clientCode), { rows: ar.rows.filter(x => x.clientCode === r.clientCode), total: r.amount })), ' ', iconBtn('statement', 'كشف حساب', () => F().statement(S().client(r.clientCode)))) }], rows: ar.byClient, onRow: r => ctx.open('client', r.clientCode), sort: 'amount', sortDir: -1 }),
      aging: () => h('div', null, UI().bars({ data: [['b30', 'حتى 30 يومًا'], ['b60', '31–60 يومًا'], ['b90', '61–90 يومًا'], ['b90p', 'أكثر من 90 يومًا']].map(([k, l], i) => ({ label: l, value: ar.buckets[k], color: [UI().cssVar('--info'), UI().cssVar('--warn'), UI().cssVar('--danger'), '#8B1E1B'][i] })), fmt: fm, padL: 160 }), h('p', { class: 'muted small mt-s' }, 'عمر التأخير يُحسب من تاريخ استحقاق كل شهر حتى اليوم.')),
      projects: () => UI().table({ cols: [{ key: 'projectName', label: 'المشروع' }, { key: 'n', label: 'عدد الشهور', num: true, render: r => r.rows.length }, col.money('amount', 'المتأخرات')], rows: ar.byProject, sort: 'amount', sortDir: -1 }),
    };
    const content = h('div');
    const show = (key) => { [...tabs.children].forEach(b => b.classList.toggle('on', b.dataset.t === key)); UI().clear(content); content.appendChild(views[key]()); };
    for (const [key, label] of [['months', 'بالشهر'], ['clients', 'بالعميل'], ['projects', 'بالمشروع'], ['aging', 'حسب مدة التأخير']]) tabs.appendChild(h('button', { dataset: { t: key }, onclick: () => show(key) }, label));
    body.append(h('p', { class: 'muted' }, `إجمالي المتأخرات ${fm(U().sum(rows, r => r.amount))} — كل شهر مستحق لم يُسدَّد بعد يوم الاستحقاق + أيام السماح (${S().state().settings.graceDays} أيام).`), tabs, content);
    show(tab === 'clients' ? 'clients' : 'months');
    UI().drawer({ title: BUCKET_AR[bucket] || 'المتأخرات القائمة', body });
  }
  function unitsEvidence(ctx, list, title) {
    const rows = list.map(r => ({ ...r, unitCode: r.unit.code, unitLabel: r.unit.label, type: r.unit.type, floor: r.unit.floor }));
    ctx.evidence(title, rows, [col.unit(ctx), { key: 'projectName', label: 'المشروع' }, { key: 'type', label: 'النوع', render: r => typeAr(r.type) }, { key: 'floor', label: 'الدور' }, { key: 'status', label: 'الحالة', render: r => UI().badge(r.status, En().USTATUS_AR[r.status]) }, { key: 'clientName', label: 'المستأجر', render: r => r.contract ? h('a', { onclick: (e) => { e.stopPropagation(); ctx.open('client', r.contract.clientCode); } }, r.clientName) : '—' }, { key: 'rent', label: 'الإيجار الحالي', num: true, render: r => r.contract ? fm(En().currentRent(r.contract)) : (r.last ? h('span', { class: 'muted' }, 'آخر: ' + fm(En().currentRent(r.last))) : '—') }, { key: 'vacantDays', label: 'أيام الشغور', num: true, render: r => r.status === 'vacant' ? (r.vacantDays == null ? 'لم تُؤجَّر من قبل' : `${r.vacantDays} (منذ ${fd(r.vacantSince)})`) : (r.daysLeft != null ? `ينتهي بعد ${r.daysLeft} يوم` : '—') }, { key: '_a', label: '', sortable: false, cls: 'actions', render: r => r.status === 'vacant' ? iconBtn('plus', 'تأجير الوحدة', () => rentUnit(ctx, r.unitCode), 'primary') : null }], { onRow: r => ctx.open('unit', r.unitCode), sort: 'vacantDays', sortDir: -1 });
  }
  function renewalsEvidence(ctx, rows, title, ended) {
    ctx.evidence(title, rows, [col.contract(ctx), col.client(ctx), col.unit(ctx), col.project(), { key: 'end', label: 'نهاية العقد', render: r => fd(r.contract.end) }, ended ? { key: 'daysAgo', label: 'منذ (يوم)', num: true } : { key: 'daysLeft', label: 'متبقٍ (يوم)', num: true }, col.money('rent', 'الإيجار الشهري'), { key: '_a', label: '', sortable: false, cls: 'actions', render: r => iconBtn('plus', 'تجديد / عقد جديد', () => renew(ctx, r.contract), 'primary') }], { onRow: r => ctx.open('contract', r.contractCode), sort: ended ? 'daysAgo' : 'daysLeft', sortDir: ended ? -1 : 1 });
  }
  function depositsEvidence(ctx, dep, title) {
    ctx.evidence(`${title || 'تأمينات محتفظ بها'} — ${fm(dep.total)}`, dep.held, [col.contract(ctx), col.client(ctx), col.unit(ctx), col.money('amount', 'التأمين'), { key: 'status', label: 'حالة العقد', render: r => UI().badge(r.status, En().CSTATUS_AR[r.status]) }, { key: 'end', label: 'نهاية العقد', render: r => fd(r.contract.end) }], { onRow: r => ctx.open('contract', r.contractCode), intro: 'عند نهاية العقد راجع صيانات الوحدة في فترة العميل قبل رد التأمين أو الخصم منه.' });
  }
  function forecastEvidence(ctx, k) {
    ctx.evidence(`الإيراد المتعاقد عليه — ${fm(k.next12.total)} خلال 12 شهرًا`, k.next12.months, [{ key: 'period', label: 'الشهر', render: r => U().periodLabel(r.period, true) }, col.money('amount', 'المستحق المتوقع')], { intro: 'مأخوذ من العقود المسجَّلة (السارية والمستقبلية) بجداول زياداتها السنوية، دون افتراض تجديد العقود المنتهية.', foot: d => h('tr', null, h('td', null, 'الإجمالي'), h('td', { class: 'num' }, fm(U().sum(d, r => r.amount)))) });
  }
  function maintenanceEvidence(ctx, items, title) {
    ctx.evidence(title, items, [{ key: 'code', label: 'الكود', render: r => h('span', { class: 'code' }, r.code) }, { key: 'date', label: 'التاريخ', render: r => fd(r.date) }, { key: 'unitLabel', label: 'الوحدة', render: r => h('a', { onclick: (e) => { e.stopPropagation(); ctx.open('unit', r.unitCode); } }, r.unitLabel) }, { key: 'projectName', label: 'المشروع' }, { key: 'kind', label: 'النوع', render: r => M().label(M().MAINT_KINDS, r.kind) }, { key: 'description', label: 'الوصف', cls: 'wrap wide' }, col.money('cost', 'التكلفة'), { key: 'borneBy', label: 'يتحملها', render: r => M().label(M().BORNE_BY, r.borneBy) }, { key: 'custodianName', label: 'في عهدة', render: r => r.custodianName || h('span', { class: 'muted' }, 'شاغرة') }, { key: 'status', label: 'الحالة', render: r => UI().badge(r.status, M().label(M().MAINT_STATUS, r.status)) }], { onRow: r => ctx.open('unit', r.unitCode), sort: 'date', sortDir: -1 });
  }
  function contractsEvidence(ctx, contracts, title) {
    const rows = contracts.map(c => ({ ...En().row({ contract: c }), rent: En().currentRent(c), start: c.start, end: c.end, cstatus: En().contractStatus(c) }));
    ctx.evidence(title, rows, [col.contract(ctx), col.client(ctx), col.unit(ctx), col.project(), { key: 'start', label: 'من', render: r => fd(r.start) }, { key: 'end', label: 'إلى', render: r => fd(r.end) }, col.money('rent', 'الإيجار الحالي'), { key: 'increasePct', label: 'الزيادة', num: true, render: r => fp((r.contract.increasePct || 0) / 100) }, { key: 'cstatus', label: 'الحالة', render: r => UI().badge(r.cstatus, En().CSTATUS_AR[r.cstatus]) }], { onRow: r => ctx.open('contract', r.contractCode), foot: d => h('tr', null, h('td', { colspan: 6 }, `${d.length} عقد`), h('td', { class: 'num' }, fm(U().sum(d, r => r.rent))), h('td', { colspan: 2 })) });
  }
  /* جدول إيجار العقد سنة بسنة (دليل مؤشر «الإيجار الحالي» في بروفايل العقد) */
  function scheduleEvidence(ctx, c) {
    const sch = En().schedule(c), cur = En().currentRent(c), today = U().iso(U().today());
    ctx.evidence(`جدول إيجار العقد ${c.code} — الحالي ${fm(cur)}`, sch, [{ key: 'k', label: 'السنة', render: r => 'السنة ' + r.k }, { key: 'from', label: 'من', render: r => fd(r.from) }, { key: 'to', label: 'إلى', render: r => fd(r.to) }, col.money('rent', 'الإيجار الشهري'), { key: 'ov', label: '', sortable: false, render: r => h('span', null, c.rentOverrides && c.rentOverrides[r.k] != null ? h('span', { class: 'muted small' }, 'قيمة يدوية ') : null, r.from <= today && today <= r.to ? UI().badge('ok', 'السنة الحالية') : null) }], { intro: `الإيجار الشهري ${fm(c.rent)} في السنة الأولى، بزيادة سنوية ${c.increasePct || 0}% تُطبَّق في ذكرى بداية العقد.`, emptyTitle: 'تواريخ العقد غير صحيحة', actions: [btn('فتح العقد', 'file', () => ctx.open('contract', c.code), 'sm')] });
  }
  function paymentsEvidence(ctx, pays, title) {
    const rows = pays.map(p => { const c = S().contract(p.contractCode) || {}; const cl = S().client(c.clientCode) || {}, u = S().unit(c.unitCode) || {}; return { ...p, clientName: cl.name, clientCode: cl.code, unitLabel: u.label, unitCode: u.code, projectName: (S().project(u.projectCode) || {}).name }; });
    ctx.evidence(title, rows, paymentCols(ctx), { onRow: r => F().invoice(r), sort: 'period', sortDir: -1, foot: d => h('tr', null, h('td', { colspan: 5 }, `الإجمالي (${d.length} دفعة)`), h('td', { class: 'num' }, fm(U().sum(d, r => r.amount))), h('td', { colspan: 3 })) });
  }
  /* تاريخ السداد: المسجَّل، وإلا تاريخ استحقاق الشهر باهتًا بعلامة ≈ (دفعات كشف التحصيل بلا تاريخ) — نفس التاريخ الذي يفلتر به «تاريخ السداد» */
  const APPROX_TIP = 'لا يوجد تاريخ سداد مسجَّل — هذا تاريخ استحقاق الشهر';
  function payDateCell(r) { const pd = En().payDate(r); return !pd.approx ? fd(pd.d) : pd.d ? h('span', { class: 'muted approx', title: APPROX_TIP }, '≈ ' + fd(pd.d)) : h('span', { class: 'muted' }, 'غير مسجَّل'); }
  const payDateCol = (label) => ({ key: 'paidOn', label: label || 'تاريخ السداد', render: payDateCell, sortVal: r => En().payDate(r).d || null });
  function paymentCols(ctx) {
    const client = col.client(ctx); // دفعة عقدها محذوف من الإكسيل: شارة «بلا عقد» بدل اسم عميل فارغ
    return [{ key: 'code', label: 'رقم الفاتورة', render: r => h('span', { class: 'code' }, r.code) }, payDateCol(), { ...client, render: r => r.contractCode && !S().contract(r.contractCode) ? orphanBadge('بلا عقد', r.contractCode) : client.render(r) }, col.unit(ctx), col.period(), col.money('amount', 'المبلغ'), { key: 'method', label: 'الطريقة', render: r => M().label([{ key: '', ar: 'غير محدد' }].concat(M().PAY_METHODS), r.method || '') }, { key: 'ref', label: 'مرجع' }, { key: '_a', label: '', sortable: false, cls: 'actions', render: r => h('span', null, iconBtn('print', 'الفاتورة', () => F().invoice(r)), ' ', iconBtn('edit', 'تعديل', async () => { if (await F().payment(r)) ctx.rerender(); }), ' ', iconBtn('trash', 'حذف', () => del(ctx, 'payments', r.code, r.code, payDesc(r)))) }];
  }
  /* التجديد: البداية = اليوم التالي لنهاية العقد، والنهاية بنفس مدة العقد السابق (سنة غالبًا)، والإيجار بعد الزيادة؛ بعد الحفظ يُفتح العقد الجديد */
  function renew(ctx, c) {
    const d = U().d(c.end);
    if (!d) { UI().toast('تاريخ نهاية العقد غير مسجَّل — عدّل العقد أولًا', 'warn'); return; }
    const start = U().iso(U().addDays(d, 1));
    const s0 = U().d(c.start), b = U().addDays(d, 1);
    const months = s0 && s0 <= d ? Math.max(1, Math.round((b.getUTCFullYear() - s0.getUTCFullYear()) * 12 + (b.getUTCMonth() - s0.getUTCMonth()) + (b.getUTCDate() - s0.getUTCDate()) / 30)) : 12;
    const sd = U().d(start), end = U().iso(U().addDays(new Date(Date.UTC(sd.getUTCFullYear(), sd.getUTCMonth() + months, sd.getUTCDate())), -1));
    const rent = Math.round(En().currentRent(c, d) * (1 + (U().toNum(c.increasePct) || 0) / 100));
    F().contract(null, { unitCode: c.unitCode, clientCode: c.clientCode, start, end, rent, increasePct: c.increasePct, deposit: c.deposit, depositStatus: c.depositStatus, dueDay: c.dueDay, prevCode: c.code }).then(r => { if (r) { UI().closeDrawer(); created(ctx, 'contract', r); } });
  }

  /* =====================================================================
     كشف التحصيل
     ===================================================================== */
  function ledger(el, ctx) {
    const year = String(ctx.year);
    const L = En().ledger(year, ctx.filter);
    el.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, `كشف التحصيل ${year}`), h('div', { class: 'sub' }, 'نفس شكل ورقة الإكسيل: كل صف عقد، وكل خانة شهر = المبلغ المحصَّل. اضغط على الخانة لتسجيل دفعة أو تعديلها.')), h('div', { class: 'flex wrap' }, btn('عقد جديد', 'plus', async () => { if (await F().contract()) ctx.rerender(); }, 'primary'))));
    el.appendChild(ctx.filterBar({ year: true }));
    el.appendChild(h('div', { class: 'legend' }, [['paid', 'مسدَّد'], ['partial', 'جزئي'], ['late', 'متأخر'], ['due', 'مستحق (في فترة السماح)'], ['pending', 'لم يُسجَّل بعد'], ['upcoming', 'قادم'], ['orphan', 'خارج مدة العقد']].map(([k, l]) => h('span', null, h('i', { style: { background: `var(--${k === 'orphan' ? 'info' : k === 'pending' ? 'upcoming' : k}-soft)`, border: `1px solid var(--${k === 'orphan' ? 'info' : k === 'pending' ? 'upcoming' : k})` } }), l))));
    const months = []; for (let m = 1; m <= 12; m++) months.push(year + '-' + U().pad(m, 2));
    const curP = U().periodOf(U().today());
    const thead = h('thead', null, h('tr', null, h('th', { class: 'fix c1' }, 'م'), h('th', { class: 'fix c2' }, 'المشروع'), h('th', { class: 'fix c3' }, 'الاسم'), h('th', null, 'الوحدة'), h('th', null, 'العقد من'), h('th', null, 'إلى'), ...months.map(p => h('th', { style: { textAlign: 'center' }, class: p === curP ? 'cur' : '', title: p === curP ? 'الشهر الحالي' : '' }, U().periodLabel(p))), h('th', null, 'الإجمالي'), h('th', null, '')));
    const tbody = h('tbody');
    L.rows.forEach((r, i) => {
      const tr = h('tr');
      tr.append(h('td', { class: 'fix c1 muted' }, i + 1), h('td', { class: 'fix c2' }, r.projectName), h('td', { class: 'fix c3' }, h('a', { onclick: () => ctx.open('client', r.clientCode), title: r.clientName }, r.clientName)), h('td', null, h('a', { onclick: () => ctx.open('unit', r.unitCode) }, r.unitLabel, ' ', h('span', { class: 'code' }, r.unitCode))), h('td', null, fd(r.contract.start)), h('td', null, fd(r.contract.end)));
      for (const p of months) {
        const c = r.months[p];
        const td = h('td', { class: 'm ' + c.status + (p === curP ? ' cur' : ''), dataset: { cell: r.contractCode + '|' + p }, title: `${U().periodLabel(p, true)} — ${En().STATUS_AR[c.status]}${c.due ? ' · مستحق ' + fm(c.due.amount) : ''}${c.paid ? ' · مسدَّد ' + fm(c.paid) : ''}`, onclick: () => cellAction(ctx, r.contract, p, c) });
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
    const wrap = h('div', { class: 'ledger-wrap' }, h('table', { class: 'ledger', id: 'ledger' }, thead, tbody, tfoot));
    el.appendChild(wrap);
    requestAnimationFrame(fitLedger);
    if (!fitLedger.bound) { fitLedger.bound = true; window.addEventListener('resize', fitLedger); }
    // الشهر الحالي هو ما يُسجَّل فيه يوميًا: نُظهره مباشرة بدل يناير (مع زر للعودة إليه)
    const toCur = () => { const th = wrap.querySelector('th.cur'); if (th) th.scrollIntoView({ inline: window.innerWidth <= 640 ? 'end' : 'center', block: 'nearest' }); }; // الموبايل: الشهر الحالي وما قبله بجوار الاسم الثابت
    if (year === curP.slice(0, 4)) { requestAnimationFrame(toCur); const bar = el.querySelector('#filter-bar'); if (bar) bar.appendChild(h('button', { class: 'chip', id: 'ledger-cur', onclick: toCur }, UI().icon('calendar'), 'اذهب إلى ' + U().periodLabel(curP))); }
  }
  /* ارتفاع الكشف = ما تبقى من الشاشة تحت الفلاتر (صف «الإجمالي العام» الثابت يظهر بلا تمرير للصفحة) */
  function fitLedger() { const w = document.querySelector ? document.querySelector('#content .ledger-wrap') : null; if (!w || !w.getBoundingClientRect) return; const top = w.getBoundingClientRect().top + (window.scrollY || 0); w.style.maxHeight = Math.max(320, window.innerHeight - top - 14) + 'px'; }
  /* نافذة خانة الشهر — after: ما يُعاد فتحه بعد أي كتابة (بروفايل العقد مثلًا) حتى لا يبقى الدرج المفتوح على بيانات قديمة */
  function cellAction(ctx, c, period, cell, after) {
    const pays = cell.payments;
    const cl = S().client(c.clientCode) || {}, u = S().unit(c.unitCode) || {};
    const done = () => { ctx.rerender(); if (after) after(); };
    const body = h('div', null,
      h('p', null, h('b', null, cl.name), ' — ', u.label, ' — ', h('b', null, U().periodLabel(period, true)), ' ', UI().badge(cell.status, En().STATUS_AR[cell.status])),
      UI().kv([['المستحق للشهر', cell.due ? fm(cell.due.amount) + (cell.due.full ? '' : ` (${cell.due.days} يوم)`) : 'خارج مدة العقد'], ['المسدَّد', fm(cell.paid)], ['المتبقي', fm(cell.remaining)], ['تاريخ الاستحقاق', cell.dueDate ? fd(cell.dueDate) : '—']]),
      pays.length ? UI().table({ cols: [{ key: 'code', label: 'الفاتورة', render: r => h('span', { class: 'code' }, r.code) }, payDateCol('التاريخ'), col.money('amount', 'المبلغ'), { key: 'method', label: 'الطريقة', render: r => M().label([{ key: '', ar: 'غير محدد' }].concat(M().PAY_METHODS), r.method || '') }, { key: '_a', label: '', sortable: false, cls: 'actions', render: r => h('span', null, iconBtn('print', 'الفاتورة', () => { m.close(); F().invoice(r); }), ' ', iconBtn('edit', 'تعديل', async () => { m.close(); if (await F().payment(r)) done(); }), ' ', iconBtn('trash', 'حذف', async () => { m.close(); if (await del(ctx, 'payments', r.code, r.code, payDesc(r)) && after) after(); })) }], rows: pays }) : h('p', { class: 'muted mt-s' }, 'لا توجد دفعات مسجَّلة لهذا الشهر.'),
    );
    const addBtn = h('button', { class: 'btn primary', onclick: async () => { m.close(); if (await F().payment(null, { contractCode: c.code, period, amount: cell.due ? Math.max(0, cell.due.amount - cell.paid) : '' })) done(); } }, UI().icon('receipt'), pays.length ? 'إضافة دفعة أخرى' : 'تسجيل دفعة');
    const m = UI().modal({ title: 'خانة الشهر', body, footer: [h('button', { class: 'btn', onclick: () => { m.close(); ctx.open('contract', c.code); } }, 'فتح العقد'), addBtn] });
  }

  /* =====================================================================
     القوائم
     ===================================================================== */
  function projects(el, ctx) {
    const st = S().state();
    el.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'المشاريع'), h('div', { class: 'sub' }, 'كل مشروع له كود ثابت، وتحته الوحدات بأكوادها')), btn('مشروع جديد', 'plus', async () => { if (await F().project()) ctx.rerender(); }, 'primary')));
    const grid = h('div', { class: 'grid g3' });
    const q = ctx.filter.q, pq = En().prepQ(q);
    if (q || ctx.filter.from) el.appendChild(ctx.filterBar({ qOnly: true }));
    for (const p of st.projects.filter(p => !pq || En().matchQ([p.code, p.name, p.area, p.address].join(' '), pq))) {
      const k = En().kpis({ projectCode: p.code });
      grid.appendChild(h('div', { class: 'card', style: { cursor: 'pointer' }, onclick: () => ctx.open('project', p.code) },
        h('div', { class: 'card-head' }, h('div', null, h('h3', null, p.name), h('span', { class: 'code' }, p.code)), h('div', null, iconBtn('edit', 'تعديل', async () => { if (await F().project(p)) ctx.rerender(); }), ' ', iconBtn('trash', 'حذف', () => del(ctx, 'projects', p.code, p.name)))),
        h('p', { class: 'muted small' }, p.address || '—'),
        h('div', { class: 'kv mt-s' }, h('div', null, h('dt', null, 'الوحدات'), h('dd', null, k.occupancy.total)), h('div', null, h('dt', null, 'الإشغال'), h('dd', null, fp(k.occupancy.rate))), h('div', null, h('dt', null, 'المتأخرات'), h('dd', { style: { color: k.arrears.total ? 'var(--danger)' : '' } }, fm(k.arrears.total))), h('div', null, h('dt', null, 'محصَّل السنة'), h('dd', null, fm(k.ytd.collected)))),
        h('div', { class: 'gbar', style: { height: '8px', marginTop: '10px' } }, h('span', { style: { insetInlineStart: 0, width: fp(k.occupancy.rate || 0) } })),
      ));
    }
    el.appendChild(grid.children.length ? grid : q ? h('div', { class: 'empty' }, h('b', null, `لا توجد نتائج للبحث «${q}»`), h('button', { class: 'btn sm mt-s', id: 'empty-clear-q', onclick: () => E.App.setFilter({ q: '' }) }, 'مسح البحث')) : empty('لا توجد مشاريع', 'أضف مشروعًا جديدًا'));
  }
  function units(el, ctx) {
    const sc = En().scope(ctx.filter);
    el.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'الوحدات'), h('div', { class: 'sub' }, `${sc.units.length} وحدة — التجارية والسكنية والإدارية والجراجات`)), btn('وحدة جديدة', 'plus', () => newUnit(ctx, { projectCode: ctx.filter.projectCode }), 'primary')));
    el.appendChild(ctx.filterBar());
    const floors = [...new Set(En().scope(Object.assign({}, ctx.filter, { floor: '' })).units.map(u => u.floor).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
    if (floors.length > 1) el.appendChild(h('div', { class: 'flex wrap', id: 'floor-bar' }, h('span', { class: 'muted small' }, 'الدور:'), floors.map(f => h('button', { class: 'chip ' + (ctx.filter.floor === String(f) ? 'on' : ''), onclick: () => E.App.setFilter({ floor: ctx.filter.floor === String(f) ? '' : String(f) }) }, f))));
    const pq = En().prepQ(ctx.filter.q);
    // البحث باسم مستأجر سابق: الوحدة تظهر مع توضيح «مستأجر سابق» بدل أن يبدو المستأجر الحالي هو المقصود
    const pastHit = (u, cur) => { if (!pq || En().matchQ(En().unitText(u), pq) || (cur && En().matchQ(cur.code + ' ' + En().clientText(S().client(cur.clientCode)), pq))) return ''; const c = S().contractsOfUnit(u.code).find(x => x !== cur && En().matchQ(x.code + ' ' + En().clientText(S().client(x.clientCode)), pq)); return c ? ((S().client(c.clientCode) || {}).name || c.code) : ''; };
    const rows = sc.units.filter(u => !ctx.filter.floor || String(u.floor) === ctx.filter.floor).map(u => { const s = En().unitStatus(u); const cl = s.contract ? S().client(s.contract.clientCode) : null; return { ...u, pastTenant: pastHit(u, s.contract), unitCode: u.code, unitLabel: u.label, projectName: (S().project(u.projectCode) || {}).name, status: s.status, clientName: cl ? cl.name : '', clientCode: cl ? cl.code : '', rent: s.contract ? En().currentRent(s.contract) : null, vacantDays: s.vacantDays, daysLeft: s.daysLeft, assetsCount: (u.assets || []).filter(a => a.present).length, maint: S().maintenanceOf(u.code).length }; });
    el.appendChild(h('div', { class: 'card pad-0' }, UI().table({ cols: [{ key: 'code', label: 'الكود', render: r => h('span', { class: 'code' }, r.code) }, { key: 'label', label: 'الوحدة', render: r => h('b', null, r.label) }, col.project(), { key: 'type', label: 'النوع', render: r => typeAr(r.type) }, { key: 'floor', label: 'الدور' }, { key: 'status', label: 'الحالة', render: r => UI().badge(r.status, En().USTATUS_AR[r.status]) }, { key: 'clientName', label: 'المستأجر الحالي', cls: 'wrap', render: r => h('span', null, r.clientName ? h('a', { onclick: (e) => { e.stopPropagation(); ctx.open('client', r.clientCode); } }, r.clientName) : h('span', { class: 'muted' }, '—'), r.pastTenant ? h('div', { class: 'muted small past-tenant' }, 'مستأجر سابق: ' + r.pastTenant) : null) }, col.money('rent', 'الإيجار الحالي'), { key: 'vacantDays', label: 'شغور / متبقٍ', num: true, render: r => r.status === 'vacant' ? (r.vacantDays == null ? '—' : r.vacantDays + ' يوم') : (r.daysLeft + ' يوم') }, { key: 'assetsCount', label: 'أصول', num: true, cls: 'hide-md' }, { key: 'maint', label: 'صيانات', num: true, cls: 'hide-md' }, { key: '_a', label: '', sortable: false, cls: 'actions', render: r => h('span', null, r.status === 'vacant' ? iconBtn('plus', 'تأجير هذه الوحدة', () => rentUnit(ctx, r.code), 'primary') : null, r.status === 'vacant' ? ' ' : null, iconBtn('edit', 'تعديل', async () => { if (await F().unit(S().unit(r.code) || r)) ctx.rerender(); }), ' ', iconBtn('trash', 'حذف', () => del(ctx, 'units', r.code, r.label))) }], rows, onRow: r => ctx.open('unit', r.code), emptyTitle: 'لا توجد وحدات مطابقة', empty: 'غيّر الفلاتر أو أضف وحدة' })));
  }
  function clients(el, ctx) {
    const st = S().state(), q = ctx.filter.q, sc = En().scope(Object.assign({}, ctx.filter, { q: '' })); // البحث يُطبَّق أدناه على نص العميل نفسه
    const scoped = ctx.filter.projectCode || ctx.filter.unitType || ctx.filter.status;
    el.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'العملاء'), h('div', { class: 'sub' }, 'كل عميل له كود ثابت وبروفايل يجمع عقوده ومدفوعاته والتزامه')), btn('عميل جديد', 'plus', () => newClient(ctx), 'primary')));
    el.appendChild(ctx.filterBar({ status: false }));
    const pq = En().prepQ(q);
    // البحث في العملاء يشمل عقودهم ووحداتهم: «مكتب 42» أو «T0016» يُظهر المستأجر
    const hay = c => [En().clientText(c), ...S().contractsOfClient(c.code).map(x => x.code + ' ' + En().unitText(S().unit(x.unitCode)))].join(' ');
    const all = st.clients.filter(c => (!scoped || sc.clientSet.has(c.code)) && (!pq || En().matchQ(hay(c), pq))).map(c => { const cs = S().contractsOfClient(c.code); const ar = En().arrears({ contracts: cs, contractSet: new Set(cs.map(x => x.code)) }); const active = cs.filter(x => En().contractStatus(x) === 'active'); return { ...c, contracts: cs.length, active: active.length, arrears: ar.total, lateMonths: ar.rows.length, units: active.map(x => (S().unit(x.unitCode) || {}).label).join('، '), paid: U().sum(cs, x => U().sum(S().paymentsOf(x.code), p => U().toNum(p.amount))) }; });
    const cf = (ctx.params || {}).cf || '';
    const cfCount = { arrears: all.filter(r => r.arrears > 0).length, clean: all.filter(r => !r.arrears).length, active: all.filter(r => r.active > 0).length, company: all.filter(r => r.kind === 'company').length, person: all.filter(r => r.kind === 'person').length };
    el.appendChild(h('div', { class: 'flex wrap', id: 'cf-bar' }, h('span', { class: 'muted small' }, 'عرض:'), [['', 'الكل'], ['arrears', 'عليهم متأخرات'], ['clean', 'منتظمون'], ['active', 'لهم عقد ساري'], ['company', 'شركات'], ['person', 'أفراد']].map(([key, l]) => h('button', { class: 'chip ' + (cf === key ? 'on' : ''), dataset: { cf: key }, onclick: () => ctx.go('clients', key ? { cf: key } : {}) }, l, key ? h('span', { class: 'cnt' }, cfCount[key]) : null))));
    const rows = all.filter(r => cf === 'arrears' ? r.arrears > 0 : cf === 'clean' ? !r.arrears : cf === 'active' ? r.active > 0 : (cf === 'company' || cf === 'person') ? r.kind === cf : true);
    el.appendChild(h('div', { class: 'card pad-0' }, UI().table({ cols: [{ key: 'code', label: 'الكود', render: r => h('span', { class: 'code' }, r.code) }, { key: 'name', label: 'الاسم', cls: 'wrap', render: r => h('b', null, r.name) }, { key: 'kind', label: 'النوع', render: r => M().label(M().CLIENT_KINDS, r.kind) }, { key: 'phone', label: 'التليفون', render: r => h('span', { class: 'ltr' }, r.phone || '—') }, { key: 'nationalId', label: 'الرقم القومي / الباسبور', render: r => h('span', { class: 'ltr' }, r.nationalId || '—') }, { key: 'units', label: 'الوحدات الحالية', cls: 'wrap' }, { key: 'contracts', label: 'العقود', num: true }, col.money('paid', 'إجمالي المسدَّد'), { key: 'arrears', label: 'المتأخرات', num: true, render: r => h('span', { style: { color: r.arrears ? 'var(--danger)' : '', fontWeight: r.arrears ? 700 : 400 } }, fm(r.arrears)) }, { key: '_a', label: '', sortable: false, cls: 'actions', render: r => h('span', null, iconBtn('edit', 'تعديل', async () => { if (await F().client(r)) ctx.rerender(); }), ' ', iconBtn('trash', 'حذف', () => del(ctx, 'clients', r.code, r.name))) }], rows, onRow: r => ctx.open('client', r.code), sort: 'arrears', sortDir: -1, emptyTitle: 'لا يوجد عملاء مطابقون' })));
  }
  function contracts(el, ctx) {
    const sc = En().contractScope(ctx.filter), p = ctx.params || {}; // كل عقد يُطابَق بنصه هو (لا عقود مستأجرين آخرين على نفس الوحدة)
    el.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'العقود'), h('div', { class: 'sub' }, 'بداية – نهاية – تأمين – زيادة سنوية، وكل عقد مرتبط بوحدة وعميل')), btn('عقد جديد', 'plus', () => newContract(ctx), 'primary')));
    el.appendChild(ctx.filterBar({ status: false }));
    const cst = p.cstatus || '';
    const chips = h('div', { class: 'flex wrap', id: 'cstatus-bar' }, h('span', { class: 'muted small' }, 'حالة العقد:'), [['', 'الكل'], ['active', 'ساري'], ['ending', 'ينتهي خلال 90 يومًا'], ['ended', 'منتهٍ'], ['renewed', 'منتهٍ وأُجِّرت بعده'], ['future', 'لم يبدأ']].map(([k, l]) => h('button', { class: 'chip ' + (cst === k ? 'on' : ''), onclick: () => ctx.go('contracts', k ? { cstatus: k } : {}) }, l)));
    el.appendChild(chips);
    const asOf = U().today();
    // بلا فلتر نطاق: العقود التي حُذفت وحدتها من الإكسيل تظهر أيضًا (بشارة «بلا وحدة») حتى يمكن حذفها أو تصحيحها من هنا
    const q = ctx.filter.q;
    const list = scopeActive(ctx) ? sc.contracts : sc.contracts.concat(S().state().contracts.filter(c => { if (sc.contractSet.has(c.code) || S().unit(c.unitCode)) return false; return !q || En().matchQ(En().contractText(c), q); }));
    let rows = list.map(c => { const s = En().contractStatus(c, asOf); const left = U().d(c.end) ? U().daysBetween(asOf, U().d(c.end)) : null; const hasNext = S().contractsOfUnit(c.unitCode).some(o => o !== c && U().d(o.start) > U().d(c.end)); const ar = En().arrears({ contracts: [c], contractSet: new Set([c.code]) }); return { ...En().row({ contract: c }), cstatus: s, ending: s === 'active' && left <= 90 && !hasNext, daysLeft: left, rent: En().currentRent(c, asOf), paid: U().sum(S().paymentsOf(c.code), x => U().toNum(x.amount)), arrears: ar.total, start: c.start, end: c.end, deposit: c.deposit, depositStatus: c.depositStatus, increasePct: c.increasePct }; });
    if (cst === 'ending') rows = rows.filter(r => r.ending); else if (cst) rows = rows.filter(r => r.cstatus === cst);
    el.appendChild(h('div', { class: 'card pad-0' }, UI().table({ cols: [{ key: 'contractCode', label: 'الكود', render: r => h('span', { class: 'code' }, r.contractCode) }, col.client(ctx), col.unit(ctx), { ...col.project(), cls: 'hide-md' }, { key: 'start', label: 'من', render: r => fd(r.start) }, { key: 'end', label: 'إلى', render: r => fd(r.end) }, col.money('rent', 'الإيجار الحالي'), { key: 'increasePct', label: 'الزيادة', num: true, cls: 'hide-md', render: r => (r.increasePct || 0) + '%' }, { key: 'deposit', label: 'التأمين', num: true, cls: 'hide-md', render: r => r.deposit ? h('span', null, fm(r.deposit), ' ', h('span', { class: 'muted small' }, M().label(M().DEPOSIT_STATUS, r.depositStatus))) : '—' }, col.money('paid', 'المسدَّد'), { key: 'arrears', label: 'المتأخرات', num: true, render: r => h('span', { style: { color: r.arrears ? 'var(--danger)' : '' } }, fm(r.arrears)) }, { key: 'cstatus', label: 'الحالة', render: r => h('span', null, UI().badge(r.cstatus, En().CSTATUS_AR[r.cstatus]), r.ending ? h('span', { class: 'ends warn-text', title: 'ينتهي في ' + fd(r.end) }, `ينتهي بعد ${r.daysLeft} يوم`) : null) }, { key: '_a', label: '', sortable: false, cls: 'actions', render: r => h('span', null, iconBtn('edit', 'تعديل', async () => { if (await F().contract(r.contract)) ctx.rerender(); }), ' ', iconBtn('trash', 'حذف', () => del(ctx, 'contracts', r.contractCode, r.contractCode))) }], rows, onRow: r => ctx.open('contract', r.contractCode), sort: 'end', emptyTitle: 'لا توجد عقود مطابقة' })));
  }
  /* تحديث رابط الصفحة بلا إعادة رسم (لا hashchange) — للحقول التي تُكتب حرفًا حرفًا مثل التواريخ */
  function replaceHash(view, params) {
    const qs = Object.entries(params || {}).filter(([, v]) => v !== '' && v != null).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
    try { history.replaceState(history.state, '', '#/' + view + (qs ? '?' + qs : '')); } catch (e) { /* بيئة بلا history */ }
  }
  /* تاريخ صالح للفلترة: 2026-3-5 ⇒ 2026-03-05، والسنة الناقصة أثناء الكتابة (0002، 0202) أو التاريخ المستحيل ⇒ '' */
  function okDate(v) { const d = U().toIso(v); const y = d ? +d.slice(0, 4) : 0; return y >= 1990 && y <= 2100 ? d : ''; }
  function payments(el, ctx) {
    const p = ctx.params || {};
    // روابط بتاريخ تالف أو «من» بعد «إلى»: نصلحها هنا بدل جدول فارغ بلا سبب
    let fixed = false;
    for (const key of ['from', 'to']) if (p[key] != null) { const v = okDate(p[key]); if (v !== p[key]) { fixed = true; if (v) p[key] = v; else delete p[key]; } }
    if (p.from && p.to && p.from > p.to) { [p.from, p.to] = [p.to, p.from]; fixed = true; UI().toast('تم تبديل التاريخين: «من» كان بعد «إلى»', 'warn'); }
    if (fixed) replaceHash('payments', p);
    const asOf = U().today(), todayIso = U().iso(asOf);
    const scoped = scopeActive(ctx);
    const sc = En().scope(Object.assign({}, ctx.filter, { q: '' })), pq = En().prepQ(ctx.filter.q);
    // بلا فلتر نطاق: الدفعات التي حُذف عقدها من الإكسيل تظهر أيضًا (بشارة «بلا عقد») حتى يمكن حذفها من هنا. البحث على نص الدفعة كله (الفاتورة، العقد، العميل، الوحدة، الشهر…)
    const base = S().state().payments.filter(x => (sc.contractSet.has(x.contractCode) || (!scoped && !S().contract(x.contractCode))) && (!pq || En().matchQ(En().paymentText(x), pq)));
    const toRow = x => { const c = S().contract(x.contractCode) || {}; const cl = S().client(c.clientCode) || {}, u = S().unit(c.unitCode) || {}; return { ...x, clientName: cl.name, clientCode: cl.code, unitLabel: u.label, unitCode: u.code, projectName: (S().project(u.projectCode) || {}).name }; };
    const range = () => { let a = p.from || '', b = p.to || ''; if (a && b && a > b) [a, b] = [b, a]; return [a, b]; };
    const METHODS = M().PAY_METHODS.concat([{ key: '_none', ar: 'غير محدد' }]);
    const methodOk = (x, m) => !m || (m === '_none' ? !x.method : x.method === m);
    const filtered = (skipMethod) => { const [a, b] = range(); return base.filter(x => { if (p.period && x.period !== p.period) return false; if (!skipMethod && !methodOk(x, p.method)) return false; if (a || b) { const d = En().payDate(x).d; if (!d || (a && d < a) || (b && d > b)) return false; } return true; }); };
    const goP = (patch) => { const q = { ...p, ...patch }; for (const key of Object.keys(q)) if (!q[key]) delete q[key]; ctx.go('payments', q); };
    const quick = [['month', 'هذا الشهر', todayIso.slice(0, 8) + '01', todayIso], ['30', 'آخر 30 يومًا', U().iso(U().addDays(asOf, -29)), todayIso], ['year', 'هذه السنة', todayIso.slice(0, 4) + '-01-01', todayIso]];
    let current = [];
    const exportCsv = () => downloadPaymentsCsv(current, summaryText());
    const printList = () => printPayments(current, summaryText());
    el.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'المدفوعات والفواتير'), h('div', { class: 'sub' }, 'كل دفعة لها رقم فاتورة ثابت قابل للطباعة')), h('div', { class: 'flex wrap' }, btn('طباعة القائمة', 'print', printList, 'no-print'), btn('تنزيل القائمة (Excel)', 'download', exportCsv), btn('تسجيل دفعة', 'plus', async () => { if (await F().payment()) ctx.rerender(); }, 'primary'))));
    el.appendChild(ctx.filterBar({ status: false }));
    const periods = [...new Set(S().state().payments.map(x => x.period))].sort().reverse();
    const quickEls = quick.map(([key, l, from, to]) => h('button', { class: 'chip', dataset: { quick: key }, title: `${fd(from)} ← ${fd(to)}`, onclick: () => goP(p.from === from && p.to === to ? { from: '', to: '' } : { from, to }) }, l));
    // حقلا التاريخ: الفلترة تتحدث مكانها أثناء الكتابة (بلا إعادة رسم تضيّع التركيز)، والسنة الناقصة لا تُطبَّق
    const onDate = (key) => (e) => {
      const v = e.target.value;
      if (v && !okDate(v)) return;
      if (v) p[key] = v; else delete p[key];
      replaceHash('payments', p); update();
    };
    const fromIn = h('input', { class: 'chip', type: 'date', id: 'pay-from', value: p.from || '', min: '1990-01-01', max: p.to || '2100-12-31', title: 'من تاريخ', 'aria-label': 'من تاريخ', oninput: onDate('from'), onchange: onDate('from') });
    const toIn = h('input', { class: 'chip', type: 'date', id: 'pay-to', value: p.to || '', min: p.from || '1990-01-01', max: '2100-12-31', title: 'إلى تاريخ', 'aria-label': 'إلى تاريخ', oninput: onDate('to'), onchange: onDate('to') });
    const swapIfReversed = () => { if (!(p.from && p.to && p.from > p.to)) return; [p.from, p.to] = [p.to, p.from]; fromIn.value = p.from; toIn.value = p.to; replaceHash('payments', p); update(); UI().toast('تم تبديل التاريخين: «من» كان بعد «إلى»', 'warn'); };
    const rangeGroup = h('span', { class: 'fgroup', id: 'pay-range', onfocusout: (e) => { if (e.relatedTarget && rangeGroup.contains(e.relatedTarget)) return; swapIfReversed(); } }, h('span', { class: 'lbl' }, 'تاريخ السداد'), quickEls, h('span', { class: 'muted small' }, 'من'), fromIn, h('span', { class: 'muted small' }, 'إلى'), toIn);
    const methodEls = METHODS.map(mth => { const cnt = h('span', { class: 'cnt' }, '0'); const b = h('button', { class: 'chip', dataset: { method: mth.key }, onclick: () => goP({ method: p.method === mth.key ? '' : mth.key }) }, mth.ar, cnt); b._cnt = cnt; b._key = mth.key; return b; });
    const clearHost = h('span');
    el.appendChild(h('div', { class: 'flex wrap row-gap', id: 'period-bar' },
      h('span', { class: 'fgroup' }, h('span', { class: 'lbl' }, 'عن شهر'), h('select', { class: 'chip', id: 'period-select', onchange: (e) => goP({ period: e.target.value }) }, h('option', { value: '' }, 'كل الشهور'), periods.map(x => h('option', { value: x, selected: p.period === x ? true : null }, U().periodLabel(x, true))))),
      rangeGroup,
      h('span', { class: 'fgroup' }, h('span', { class: 'lbl' }, 'الطريقة'), methodEls),
      clearHost));
    const summary = h('div', { class: 'pay-summary small', id: 'pay-summary' });
    el.appendChild(summary);
    const et = En().enteredThrough(asOf), etEnd = U().iso(U().monthLast(et));
    const tOpts = { cols: paymentCols(ctx), rows: [], onRow: r => F().invoice(r), sort: 'period', sortDir: -1, foot: d => h('tr', null, h('td', { colspan: 5 }, `الإجمالي (${d.length} دفعة)`), h('td', { class: 'num' }, fm(U().sum(d, r => r.amount))), h('td', { colspan: 3 })), emptyTitle: 'لا توجد دفعات مطابقة' };
    const tbl = UI().table(tOpts);
    el.appendChild(h('div', { class: 'card pad-0' }, tbl));
    function summaryText() {
      const [a, b] = range(); const parts = [];
      if (a || b) parts.push(a && b ? `من ${fd(a)} إلى ${fd(b)}` : a ? `من ${fd(a)}` : `حتى ${fd(b)}`);
      if (p.period) parts.push('عن شهر ' + U().periodLabel(p.period, true));
      if (p.method) parts.push('الطريقة: ' + M().label(METHODS, p.method));
      if (ctx.filter.q) parts.push(`بحث: «${ctx.filter.q}»`);
      parts.push(`${fn(current.length)} دفعة`, fm(U().sum(current, r => U().toNum(r.amount))));
      return parts.join(' — ');
    }
    function update() {
      const [a, b] = range();
      fromIn.max = p.to || '2100-12-31'; toIn.min = p.from || '1990-01-01';
      for (const [i, q] of quick.entries()) quickEls[i].classList.toggle('on', p.from === q[2] && p.to === q[3]);
      const noMethod = filtered(true);
      for (const b2 of methodEls) { b2.classList.toggle('on', p.method === b2._key); b2._cnt.textContent = fn(noMethod.filter(x => methodOk(x, b2._key)).length); }
      UI().clear(clearHost);
      if (p.period || p.from || p.to || p.method) clearHost.appendChild(h('button', { class: 'btn sm ghost', id: 'pay-clear', onclick: () => ctx.go('payments', {}) }, 'مسح'));
      current = filtered(false).map(toRow);
      UI().clear(summary);
      const active = a || b || p.period || p.method || ctx.filter.q;
      if (active) summary.appendChild(h('div', { class: 'line' }, UI().icon('filter'), h('b', null, summaryText())));
      if (p.from && p.to && p.from > p.to) summary.appendChild(h('div', { class: 'warn-line' }, 'تاريخ «من» بعد «إلى» — عُرضت الدفعات بين التاريخين، وسيُصحَّح الترتيب عند الخروج من الحقل.'));
      if ((a || b) && base.some(x => !x.paidOn)) summary.appendChild(h('div', { class: 'muted' }, 'الدفعات التي ليس لها تاريخ سداد مسجَّل (المنقولة من كشف التحصيل) تُحسب بتاريخ استحقاق شهرها، ويظهر تاريخها باهتًا بعلامة ≈.'));
      const afterEntered = !current.length && a && a > etEnd;
      tOpts.emptyTitle = afterEntered ? 'لا توجد دفعات مسجَّلة في هذه المدة' : 'لا توجد دفعات مطابقة';
      tOpts.empty = afterEntered ? `آخر شهر مسجَّل في كشف التحصيل: ${U().periodLabel(et, true)} — دفعات الشهور بعده لم تُسجَّل بعد` : '';
      tbl.update(current);
    }
    update();
  }
  /* تقرير المدفوعات المعروضة: صفوف التقرير (تُكتب في ملف Excel) */
  function paymentsReportRows(rows) {
    const mAr = (m) => M().label([{ key: '', ar: 'غير محدد' }].concat(M().PAY_METHODS), m || '');
    return rows.slice().sort((a, b) => U().cmp(En().payDate(a).d, En().payDate(b).d) || U().cmp(a.code, b.code)).map(r => { const pd = En().payDate(r); return [r.code, pd.d ? U().fmtDate(pd.d) : '', pd.approx ? 'تاريخ استحقاق (لا يوجد تاريخ سداد)' : 'تاريخ سداد', r.clientName || '', r.unitLabel || '', r.unitCode || '', r.projectName || '', U().periodLabel(r.period, true), U().toNum(r.amount) || 0, mAr(r.method), r.ref || '', r.contractCode || '']; });
  }
  const REPORT_HEAD = ['رقم الفاتورة', 'التاريخ', 'نوع التاريخ', 'العميل', 'الوحدة', 'كود الوحدة', 'المشروع', 'عن شهر', 'المبلغ', 'الطريقة', 'مرجع', 'العقد'];
  /* ملف Excel حقيقي (.xlsx) لا CSV: CSV بالفاصلة يفتح في عمود واحد على ويندوز بإعدادات إقليمية عربية */
  async function downloadPaymentsCsv(rows, title) {
    try {
      const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('المدفوعات', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 2 }] });
      ws.getCell(1, 1).value = title; ws.getCell(1, 1).font = { bold: true, size: 12 };
      ws.getRow(2).values = REPORT_HEAD; ws.getRow(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(2).eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } }; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; });
      const body = paymentsReportRows(rows);
      body.forEach((r, i) => { const row = ws.getRow(3 + i); row.values = r.map((v, j) => j === 8 ? (U().toNum(v) || 0) : v); row.getCell(9).numFmt = '#,##0.00'; });
      const tr = ws.getRow(3 + body.length); tr.getCell(8).value = 'الإجمالي'; tr.getCell(9).value = U().sum(rows, r => U().toNum(r.amount)); tr.getCell(9).numFmt = '#,##0.00'; tr.font = { bold: true };
      const widths = [16, 12, 22, 30, 14, 12, 16, 14, 14, 12, 14, 10];
      widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
      const buf = await wb.xlsx.writeBuffer();
      E.FileLink.downloadBytes(buf, 'Egary-payments-' + U().iso(U().today()) + '.xlsx');
      UI().toast(`نُزِّل تقرير المدفوعات (${fn(rows.length)} دفعة) — ملف Excel`, 'ok');
    } catch (e) { UI().toast('تعذّر إنشاء ملف التقرير: ' + (e.message || e), 'danger'); }
  }
  function printPayments(rows, title) {
    const st = S().state(), data = paymentsReportRows(rows);
    const box = h('div', { class: 'invoice statement', id: 'payments-print' },
      h('div', { class: 'inv-head' }, h('div', null, h('h2', null, st.meta.officeName || 'إيجاري'), h('div', { class: 'muted small' }, 'تقرير التحصيل')), h('div', { style: { textAlign: 'left' } }, h('div', { class: 'small' }, 'حتى ' + fd(U().iso(U().today()))))),
      h('p', { class: 'bold' }, title),
      h('table', null, h('thead', null, h('tr', null, ['رقم الفاتورة', 'التاريخ', 'العميل', 'الوحدة', 'عن شهر', 'المبلغ', 'الطريقة'].map((t, i) => h('th', { class: i === 5 ? 'num' : '' }, t)))),
        h('tbody', null, data.map(r => h('tr', null, h('td', null, h('span', { class: 'code' }, r[0])), h('td', null, r[2].startsWith('تاريخ استحقاق') ? '≈ ' + r[1] : r[1]), h('td', null, r[3]), h('td', null, r[4]), h('td', null, r[7]), h('td', { class: 'num' }, fm(r[8])), h('td', null, r[9])))),
        h('tfoot', null, h('tr', null, h('td', { colspan: 5 }, `الإجمالي (${fn(rows.length)} دفعة)`), h('td', { class: 'num' }, fm(U().sum(rows, r => U().toNum(r.amount)))), h('td')))),
      data.some(r => r[2].startsWith('تاريخ استحقاق')) ? h('p', { class: 'small muted mt-s' }, '≈ دفعة بلا تاريخ سداد مسجَّل: التاريخ المعروض تاريخ استحقاق شهرها.') : null,
      h('p', { class: 'small muted', style: { marginTop: '18px' } }, 'أُصدر من نظام إيجاري — ' + U().fmtDateTime(new Date())));
    const printBtn = h('button', { class: 'btn primary', onclick: () => { document.body.classList.add('printing'); window.print(); setTimeout(() => document.body.classList.remove('printing'), 500); } }, UI().icon('print'), 'طباعة / حفظ PDF');
    return UI().modal({ title: 'تقرير المدفوعات المعروضة', size: 'lg', body: box, footer: [printBtn] });
  }
  function maintenance(el, ctx) {
    const sc = En().scope(Object.assign({}, ctx.filter, { q: '' })), p = ctx.params || {}; // البحث يُطبَّق على كل سجل صيانة بنصه (الكود، الوصف، الوحدة، العهدة…)
    const ms = En().maintenanceStats(sc);
    el.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'الصيانة والإصلاحات'), h('div', { class: 'sub' }, `${ms.open.length} مفتوحة · تكلفة هذه السنة ${fm(ms.costYtd)} (المالك ${fm(ms.byBorne.owner)} · المستأجر ${fm(ms.byBorne.tenant)})`)), btn('طلب صيانة', 'plus', async () => { if (await F().maintenance(null, { unitCode: '' })) ctx.rerender(); }, 'primary')));
    el.appendChild(ctx.filterBar({ status: false }));
    const stt = p.mstatus || '', mk = p.mkind || '';
    const goM = (patch) => { const q = { mstatus: stt, mkind: mk, ...patch }; for (const key of Object.keys(q)) if (!q[key]) delete q[key]; ctx.go('maintenance', q); };
    el.appendChild(h('div', { class: 'flex wrap row-gap', id: 'mstatus-bar' }, h('span', { class: 'fgroup' }, h('span', { class: 'lbl' }, 'حالة الطلب'), [['', 'الكل'], ['open', 'مفتوحة'], ['closed', 'مغلقة']].map(([k, l]) => h('button', { class: 'chip ' + (stt === k ? 'on' : ''), onclick: () => goM({ mstatus: k }) }, l))),
      h('span', { class: 'fgroup' }, h('span', { class: 'lbl' }, 'نوع الصيانة'), [['', 'الكل']].concat(M().MAINT_KINDS.map(x => [x.key, x.ar])).map(([k, l]) => h('button', { class: 'chip ' + (mk === k ? 'on' : ''), dataset: { mkind: k }, onclick: () => goM({ mkind: k }) }, l)))));
    // بلا فلتر نطاق: سجلات الصيانة التي حُذفت وحدتها من الإكسيل تظهر أيضًا (بشارة «بلا وحدة») حتى يمكن حذفها من هنا
    let items = scopeActive(ctx) ? ms.items : ms.items.concat(S().state().maintenance.filter(m => !sc.unitSet.has(m.unitCode) && !S().unit(m.unitCode)).map(m => ({ ...m, unitLabel: '', projectName: '', custodianContract: m.custodianContract || '', custodianName: m.custodianName || '' })));
    if (stt) items = items.filter(m => m.status === stt); if (mk) items = items.filter(m => m.kind === mk);
    if (ctx.filter.q) { const pq = En().prepQ(ctx.filter.q); items = items.filter(m => En().matchQ(En().maintenanceText(m) + ' ' + (m.unitLabel || '') + ' ' + (m.projectName || ''), pq)); }
    el.appendChild(h('div', { class: 'card pad-0' }, UI().table({ cols: [{ key: 'code', label: 'الكود', render: r => h('span', { class: 'code' }, r.code) }, { key: 'date', label: 'التاريخ', render: r => fd(r.date) }, { key: 'unitLabel', label: 'الوحدة', render: r => S().unit(r.unitCode) ? h('a', { onclick: (e) => { e.stopPropagation(); ctx.open('unit', r.unitCode); } }, r.unitLabel, ' ', h('span', { class: 'code' }, r.unitCode)) : orphanBadge('بلا وحدة', r.unitCode) }, { key: 'projectName', label: 'المشروع' }, { key: 'kind', label: 'نوع الصيانة', render: r => M().label(M().MAINT_KINDS, r.kind) }, { key: 'description', label: 'الوصف', cls: 'wrap wide' }, col.money('cost', 'التكلفة'), { key: 'borneBy', label: 'يتحملها', render: r => M().label(M().BORNE_BY, r.borneBy) }, { key: 'custodianName', label: 'في عهدة', render: r => r.custodianName ? h('a', { onclick: (e) => { e.stopPropagation(); ctx.open('contract', r.custodianContract); } }, r.custodianName) : h('span', { class: 'muted' }, 'شاغرة') }, { key: 'status', label: 'الحالة', render: r => UI().badge(r.status, M().label(M().MAINT_STATUS, r.status)) }, { key: '_a', label: '', sortable: false, cls: 'actions', render: r => h('span', null, r.status === 'open' ? iconBtn('check', 'إغلاق الطلب', async () => { if (await F().closeMaintenance(r)) ctx.rerender(); }, 'primary') : null, r.status === 'open' ? ' ' : null, iconBtn('edit', 'تعديل', async () => { if (await F().maintenance(S().get('maintenance', r.code) || r)) ctx.rerender(); }), ' ', iconBtn('trash', 'حذف', () => del(ctx, 'maintenance', r.code, String(r.description || '').slice(0, 30)))) }], rows: items, onRow: r => { if (S().unit(r.unitCode)) ctx.open('unit', r.unitCode); }, sort: 'date', sortDir: -1, emptyTitle: 'لا توجد سجلات صيانة', empty: 'سجّل أول طلب صيانة من زر «طلب صيانة»' })));
  }
  /* هل يوجد فلتر يضيّق النطاق على الوحدات (مشروع/نوع/حالة/دور)؟ عندها تُخفى السجلات اليتيمة لأنها لا تنتمي لأي وحدة (البحث النصي تطبّقه كل قائمة بنفسها) */
  function scopeActive(ctx) { const f = ctx.filter || {}; return !!(f.projectCode || f.unitType || f.status || f.floor); }

  /* =====================================================================
     التحليلات
     ===================================================================== */
  let gapsScrolled = false; // هل مُرِّرت الصفحة إلى بطاقة الفجوات منذ آخر انتقال إليها؟
  function insights(el, ctx) {
    ctx = withoutQ(ctx);
    const k = En().kpis(ctx.filter), ins = En().insights(k);
    el.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'التحليلات والملاحظات'), h('div', { class: 'sub' }, 'كل ملاحظة مأخوذة من السجلات لحظة فتح الصفحة، واضغط عليها لرؤية الدليل'))));
    el.appendChild(ctx.filterBar({ period: true, q: false, defaultPeriod: k.defaultPeriod || k.period }));
    el.appendChild(section(`الملاحظات (${ins.length})`, h('div', { class: 'grid', style: { gap: '8px' } }, ins.map(i => insightEl(ctx, i, k)))));
    const g = h('div', { class: 'grid g2' });
    const labels = k.trend.map(m => U().periodLabel(m.period).slice(0, 6));
    g.appendChild(section('التحصيل مقابل المستحق — 12 شهرًا', UI().columns({ labels, series: [{ name: 'المحصَّل', values: k.trend.map(m => m.collected), color: UI().cssVar('--primary') }], line: { name: 'المستحق', values: k.trend.map(m => m.due), color: UI().cssVar('--warn') }, highlight: k.trend.findIndex(m => m.period === k.period), onClick: (i) => monthEvidence(ctx, k.trend[i].period) })));
    g.appendChild(section('معدل التحصيل الشهري', UI().columns({ labels, series: [{ name: 'نسبة التحصيل %', values: k.trend.map(m => m.rate == null ? 0 : Math.round(m.rate * 100)), color: UI().cssVar('--accent') }], fmt: v => v + '%', unit: '%', highlight: k.trend.findIndex(m => m.period === k.period), onClick: (i) => monthEvidence(ctx, k.trend[i].period) })));
    g.appendChild(section('المتأخرات حسب مدة التأخير', UI().bars({ data: [['b30', 'حتى 30 يومًا'], ['b60', '31–60'], ['b90', '61–90'], ['b90p', 'أكثر من 90']].map(([key, l], i) => ({ label: l, value: k.arrears.buckets[key], color: [UI().cssVar('--info'), UI().cssVar('--warn'), UI().cssVar('--danger'), '#8B1E1B'][i], key })), fmt: fm, padL: 150, onClick: d => arrearsEvidence(ctx, k.arrears, ({ b30: 'b30', b60: 'b31_60', b90: 'b61_90', b90p: 'b90p' })[d.key]) })));
    g.appendChild(section('أعلى 10 مدينين', k.arrears.byClient.length ? UI().bars({ data: k.arrears.byClient.slice(0, 10).map(c => ({ label: c.clientName, value: c.amount, color: UI().cssVar('--danger'), code: c.clientCode })), fmt: fm, onClick: d => ctx.open('client', d.code) }) : empty('لا توجد متأخرات')));
    g.appendChild(section(`محصَّل ${k.reportYear} حسب المشروع`, UI().donut({ data: k.byProject.map((o, i) => ({ label: o.name, value: o.amount, color: UI().PALETTE[i % 10], code: o.key })), fmt: fm, center: UI().short(k.ytd.collected), onClick: d => ctx.open('project', d.code) })));
    g.appendChild(section(`محصَّل ${k.reportYear} حسب نوع الوحدة`, UI().donut({ data: k.byType.map((o, i) => ({ label: o.name, value: o.amount, color: UI().PALETTE[(i + 4) % 10], key: o.key })), fmt: fm, center: UI().short(k.ytd.collected), onClick: d => { E.App.setFilter({ unitType: d.key }); ctx.go('ledger'); } })));
    g.appendChild(section('متوسط الإيجار الشهري حسب النوع (العقود السارية)', UI().bars({ data: k.avgRentByType.map((t, i) => ({ label: `${t.name} (${t.count})`, value: Math.round(t.avg), color: UI().PALETTE[(i + 4) % 10], key: t.key })), fmt: fm, onClick: d => { E.App.setFilter({ unitType: d.key }); ctx.go('contracts'); } })));
    g.appendChild(section('الإيراد المتعاقد عليه — 12 شهرًا قادمة', UI().columns({ labels: k.next12.months.map(m => U().periodLabel(m.period).slice(0, 6)), series: [{ name: 'المستحق المتوقع', values: k.next12.months.map(m => m.amount), color: UI().cssVar('--accent') }], onClick: () => forecastEvidence(ctx, k) })));
    el.appendChild(g);
    el.appendChild(section('التزام العملاء بالسداد', UI().table({ cols: [{ key: 'clientName', label: 'العميل', render: r => h('a', { onclick: () => ctx.open('client', r.clientCode) }, r.clientName) }, { key: 'contracts', label: 'العقود', num: true }, { key: 'payments', label: 'الدفعات', num: true }, { key: 'score', label: 'في الموعد', num: true, render: r => r.score == null ? h('span', { class: 'muted', title: 'لا توجد دفعات بتاريخ سداد مسجَّل' }, '—') : UI().badge(r.score >= .8 ? 'ok' : r.score >= .5 ? 'warn' : 'danger', fp(r.score)) }, { key: 'lateMonths', label: 'شهور متأخرة', num: true }, { key: 'maxDays', label: 'أقصى تأخير (يوم)', num: true }, col.money('arrears', 'المتأخرات')], rows: k.punctuality, onRow: r => ctx.open('client', r.clientCode), sort: 'arrears', sortDir: -1 }), h('span', { class: 'hint' }, 'نسبة «في الموعد» تُحسب من الدفعات التي لها تاريخ سداد مسجَّل')));
    const gapsCard = section('الفجوات بين عقود الوحدة الواحدة (فاقد إعادة التأجير)', k.gaps.length ? UI().table({ cols: [{ key: 'unitLabel', label: 'الوحدة', render: r => h('a', { onclick: () => ctx.open('unit', r.unitCode) }, r.unitLabel, ' ', h('span', { class: 'code' }, r.unitCode)) }, { key: 'projectName', label: 'المشروع' }, { key: 'prev', label: 'العقد السابق', render: r => h('span', null, UI().codeLink(r.prev.code, c => ctx.open('contract', c)), ' حتى ', fd(r.prev.end)) }, { key: 'next', label: 'العقد التالي', render: r => h('span', null, UI().codeLink(r.next.code, c => ctx.open('contract', c)), ' من ', fd(r.next.start)) }, { key: 'days', label: 'أيام الشغور', num: true }, col.money('lost', 'فاقد تقديري')], rows: k.gaps, sort: 'days', sortDir: -1 }) : empty('لا توجد فجوات', 'كل وحدة أُعيد تأجيرها مباشرة بعد انتهاء العقد السابق'));
    gapsCard.id = 'gaps-card'; el.appendChild(gapsCard);
    if ((ctx.params || {}).tab === 'gaps' && !gapsScrolled) { gapsScrolled = true; requestAnimationFrame(() => { if (gapsCard.isConnected) gapsCard.scrollIntoView({ block: 'start', behavior: 'smooth' }); }); } // بطاقة «أطول فجوة» في اللوحة تهبط إلى هنا — مرة واحدة لكل انتقال، لا مع كل إعادة رسم (تغيير شهر التقرير مثلًا) ما دام ?tab=gaps في العنوان
    el.appendChild(section('الصيانة حسب الوحدة', k.maintenance.byUnit.length ? UI().table({ cols: [{ key: 'unitLabel', label: 'الوحدة', render: r => h('a', { onclick: () => ctx.open('unit', r.unitCode) }, r.unitLabel) }, { key: 'projectName', label: 'المشروع' }, { key: 'count', label: 'عدد السجلات', num: true }, col.money('cost', 'إجمالي التكلفة')], rows: k.maintenance.byUnit, sort: 'cost', sortDir: -1 }) : empty('لا توجد سجلات صيانة بعد')));
  }
  function quality(el, ctx) {
    const flags = En().dataQuality();
    el.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'جودة البيانات'), h('div', { class: 'sub' }, 'ملاحظات اكتُشفت عند قراءة الإكسيل أو من تناقضات السجلات — راجعها وصحّحها من مكانها'))));
    const kinds = { projects: 'project', units: 'unit', clients: 'client', contracts: 'contract' };
    // «حذف» للدفعات والصيانة والعقود المعلَّمة (السجلات اليتيمة خصوصًا) — بنفس التأكيد وبوابة الصلاحيات
    const delName = (r) => { const rec = S().get(r.entity, r.code) || {}; return r.entity === 'maintenance' ? String(rec.description || r.code).slice(0, 30) : r.code; };
    el.appendChild(h('div', { class: 'card pad-0' }, UI().table({ cols: [{ key: 'sev', label: 'الأهمية', render: r => UI().badge(r.sev, { danger: 'خطأ', warn: 'تحذير', info: 'ملاحظة' }[r.sev]) }, { key: 'entity', label: 'الكيان', render: r => M().ENTITY_AR[r.entity] || r.entity }, { key: 'code', label: 'الكود', render: r => kinds[r.entity] ? UI().codeLink(r.code, c => ctx.open(kinds[r.entity], c)) : (r.entity === 'payments' ? UI().codeLink(r.code, c => { const p = S().get('payments', c); if (p) F().invoice(p); }) : h('span', { class: 'code' }, r.code)) }, { key: 'text', label: 'الملاحظة', cls: 'wrap wide' }, { key: '_a', label: '', sortable: false, cls: 'actions', render: r => ['payments', 'maintenance', 'contracts'].includes(r.entity) && S().get(r.entity, r.code) ? iconBtn('trash', 'حذف', () => del(ctx, r.entity, r.code, delName(r)), 'danger') : null }], rows: flags, emptyTitle: 'لا توجد ملاحظات', empty: 'البيانات متّسقة' })));
  }
  function audit(el, ctx) {
    const st = S().state(), q = ctx.filter.q, pq = En().prepQ(q);
    el.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'سجل التعديلات'), h('div', { class: 'sub' }, 'كل إضافة وتعديل وحذف من البرنامج (آخر 500) — يُحفظ في ورقة «سجل التعديلات»'))));
    if (q) el.appendChild(ctx.filterBar({ qOnly: true, from: false }));
    const rows = pq ? st.audit.filter(r => En().matchQ([r.at, r.action, r.entity, r.code, r.summary, r.user].join(' '), pq)) : st.audit;
    el.appendChild(h('div', { class: 'card pad-0' }, UI().table({ cols: [{ key: 'at', label: 'الوقت', render: r => h('span', { class: 'ltr' }, r.at) }, { key: 'action', label: 'العملية', render: r => UI().badge(r.action === 'حذف' ? 'danger' : r.action === 'إضافة' ? 'ok' : r.action === 'دخول' ? 'role' : 'info', r.action) }, { key: 'entity', label: 'الكيان' }, { key: 'code', label: 'الكود', render: r => h('span', { class: 'code' }, r.code) }, { key: 'summary', label: 'التفاصيل', cls: 'wrap wide' }, { key: 'user', label: 'المستخدم', render: r => r.user ? h('span', { class: 'badge role' }, r.user) : h('span', { class: 'muted' }, '—') }], rows, emptyTitle: q ? `لا توجد تعديلات مطابقة للبحث «${q}»` : 'لا توجد تعديلات بعد' })));
  }
  function settings(el, ctx) {
    const st = S().state(), sy = E.Sync.status;
    el.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'الإعدادات والملف'), h('div', { class: 'sub' }, 'ربط ملف الإكسيل، وقواعد الاستحقاق، وبيانات المكتب'))));
    const stateAr = { unlinked: 'غير مرتبط', linked: 'مرتبط ومتزامن', saving: 'جارٍ الحفظ', reading: 'جارٍ القراءة', locked: 'الملف مفتوح في Excel (بانتظار الإغلاق)', error: 'خطأ' };
    const modeAr = { linked: 'مرتبط بملف الإكسيل — كل تعديل يُحفظ تلقائيًا', preview: 'عرض فقط (نسخة من الاستضافة)', file: 'ملف مفتوح للعرض بلا ربط', demo: 'بيانات تجريبية', none: '—' };
    el.appendChild(h('div', { class: 'grid g2' },
      section('ملف الإكسيل', h('div', null, UI().kv([['الوضع', modeAr[ctx.mode] || ctx.mode], ['الملف', sy.name || '—'], ['حالة المزامنة', stateAr[sy.state] || sy.state], ['تعديلات بانتظار الحفظ', sy.pending], ['آخر مزامنة', sy.lastSync ? U().fmtDateTime(sy.lastSync) : '—'], ['سنوات كشف التحصيل', (st.settings.ledgerYears || []).join('، ')]]), h('div', { class: 'flex wrap mt' }, E.FileLink.supported && (!E.Auth || E.Auth.can('unlink')) ? btn(ctx.mode === 'linked' ? 'ربط ملف آخر' : 'ربط ملف الإكسيل', 'link', () => E.App.linkFile(), 'primary') : null, btn('تنزيل نسخة إكسيل الآن', 'download', () => E.App.downloadCopy()), btn('آخر نسخة احتياطية', 'shield', () => E.App.downloadBackup()), btn('الملف الأصلي قبل أول تحويل', 'file', () => E.App.downloadOriginal()), ctx.mode === 'linked' ? btn('حفظ الآن', 'check', () => E.Sync.flush().then(ok => UI().toast(ok ? 'تم الحفظ في الإكسيل' : 'تعذّر الحفظ الآن', ok ? 'ok' : 'warn'))) : null, ctx.mode === 'linked' && (!E.Auth || E.Auth.can('unlink')) ? btn('إلغاء الربط', 'x', async () => { if (await UI().confirm({ title: 'إلغاء ربط الملف', text: 'سيتوقف الحفظ التلقائي حتى تربط الملف مرة أخرى. البيانات في الإكسيل لن تُمس.', okText: 'إلغاء الربط' })) { E.Sync.unlink(); await E.FileLink.clearHandle(); location.reload(); } }, 'ghost') : null), h('p', { class: 'small muted mt-s' }, 'القاعدة: الإكسيل هو مصدر الحقيقة. البرنامج يراقب الملف كل ثانيتين ويقرأ أي تعديل، ويكتب كل تعديل منه فورًا. لو الملف مفتوح في Excel تُحفظ التعديلات مؤقتًا وتُكتب بعد إغلاقه.'))),
      section('قواعد الاستحقاق والمكتب', h('div', null, UI().kv([['اسم المكتب', st.meta.officeName], ['أيام السماح', st.settings.graceDays], ['يوم الاستحقاق الافتراضي', st.settings.dueDay], ['تنبيه الشغور الطويل بعد', st.settings.vacancyMonths + ' شهور'], ['بداية المحاسبة', st.settings.trackingFrom], ['آخر شهر مسجَّل في كشف التحصيل', st.settings.enteredThrough ? st.settings.enteredThrough + ' (يدوي)' : U().periodLabel(En().enteredThrough(), true) + ' (تلقائي)'], ['فرق مقبول في السداد', `${st.settings.tolerancePct}% وبحد أدنى ${st.settings.toleranceMin} ج`], ['الزيادة الافتراضية', st.settings.defaultIncreasePct + '%'], ['بادئة الفاتورة', st.settings.invoicePrefix], ['العملة', st.settings.currency]]), h('div', { class: 'flex wrap mt' }, (!E.Auth || E.Auth.can('settings')) ? btn('تعديل الإعدادات', 'edit', async () => { if (await F().settings()) ctx.rerender(); }, 'primary') : h('span', { class: 'badge role' }, 'الإعدادات للمدير فقط'), btn(document.documentElement.dataset.theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن', document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', () => E.App.toggleTheme())))),
    ));
    // المستخدمون وتسجيل الدخول
    const me = E.Auth.user(); const admin = E.Auth.can('users');
    const usersTable = () => UI().table({ cols: [{ key: 'code', label: 'اسم المستخدم', render: r => h('span', { class: 'code' }, r.code) }, { key: 'name', label: 'الاسم', render: r => h('b', null, r.name) }, { key: 'role', label: 'الدور', render: r => h('span', { class: 'badge role' }, E.Auth.ROLE_AR(r.role)) }, { key: 'enabled', label: 'الحالة', render: r => UI().badge(r.enabled === false ? 'danger' : 'ok', r.enabled === false ? 'معطَّل' : 'مفعَّل') }, { key: 'createdAt', label: 'أُنشئ', render: r => r.createdAt ? fd(r.createdAt) : '—' }, { key: '_a', label: '', sortable: false, cls: 'actions', render: r => h('span', null, iconBtn('edit', 'تعديل', async () => { if (await F().user(r)) ctx.rerender(); }), ' ', iconBtn('key', 'إعادة تعيين كلمة المرور', async () => { if (await F().changePassword(r.code, false)) ctx.rerender(); }), ' ', iconBtn('trash', 'حذف', async () => { if (await UI().confirm({ title: 'حذف مستخدم', text: `حذف حساب ${r.name} (${r.code})؟ لن يستطيع الدخول بعدها.`, okText: 'حذف' })) { const res = E.Auth.removeUser(r.code); if (res.errors) UI().toast(res.errors.join(' · '), 'danger'); ctx.rerender(); } }, 'danger')) }], rows: E.Auth.users().slice(), emptyTitle: 'لا يوجد مستخدمون' });
    el.appendChild(section('المستخدمون وتسجيل الدخول', h('div', { id: 'users-card' },
      admin ? usersTable() : UI().kv([['المستخدم الحالي', me ? me.name : '—'], ['الدور', me ? E.Auth.ROLE_AR(me.role) : '—'], ['إدارة المستخدمين', 'للمدير فقط']]),
      h('div', { class: 'flex wrap mt' }, admin ? btn('مستخدم جديد', 'plus', async () => { if (await F().user()) ctx.rerender(); }, 'primary') : null, me && me.source !== 'demo' ? btn('تغيير كلمة مروري', 'key', () => F().changePassword(me.username, true)) : null, me && me.source !== 'demo' ? btn('تسجيل الخروج', 'x', () => E.App.logout(), 'ghost') : null),
      h('p', { class: 'small muted mt-s' }, 'الأدوار: مدير = كل شيء · موظف = إدخال وتعديل، وحذف الدفعات والصيانة فقط (بلا إعدادات ولا مستخدمين ولا حذف للمشاريع/الوحدات/العملاء/العقود) · مشاهدة فقط = بلا أي تعديل. الحسابات محفوظة في ورقة «المستخدمون» (مخفية) داخل الإكسيل وكلمات المرور مشفّرة لا تُقرأ. بوابة الدخول تحمي البرنامج لا ملف الإكسيل: من يفتح الإكسيل مباشرة يرى بياناته.'),
    )));
    const bk = E.Backup.status();
    el.appendChild(section('النسخ الاحتياطي', h('div', null,
      UI().kv([['على القرص (مجلد backups)', bk.enabled ? h('span', { class: 'badge ok' }, 'مفعَّل في ' + bk.dirName) : h('span', { class: 'badge warn' }, 'غير مفعَّل')], ['آخر نسخة على القرص', bk.lastAt ? U().fmtDateTime(bk.lastAt) + ' — ' + bk.lastName : '—'], ['عدد النسخ على القرص', bk.enabled ? bk.count : '—'], ['داخل المتصفح', 'آخر 12 ملفًا سليمًا + الملف الأصلي (تلقائي دائمًا)'], ['السياسة', 'نسخة بعد كل تعديل (كل 20 دقيقة على الأكثر) + نسخة فورية قبل أي حذف + نسخة أصلية لا تُحذف · الاحتفاظ بآخر 60 نسخة دورية'], bk.error ? ['خطأ', h('span', { style: { color: 'var(--danger)' } }, bk.error)] : null]),
      h('div', { class: 'flex wrap mt' }, E.FileLink.dirSupported && ctx.mode === 'linked' ? btn(bk.enabled ? 'تغيير مجلد النسخ' : 'تفعيل النسخ على القرص (اختر مجلد البرنامج)', 'shield', () => E.App.enableBackups(), bk.enabled ? '' : 'primary') : null, btn('نسخة الآن', 'check', () => E.App.backupNow().then(r => { if (r === 'browser') UI().toast('حُفظت نسخة داخل المتصفح (فعّل المجلد لنسخة على القرص)', 'ok'); ctx.rerender(); })), btn('تنزيل نسخة إكسيل', 'download', () => E.App.downloadCopy())),
      h('p', { class: 'small muted mt-s' }, 'النسخ على القرص ملفات إكسيل عادية في مجلد backups بجوار البرنامج؛ لاستعادة نسخة: أغلق البرنامج وانسخ الملف المطلوب فوق Egary.xlsx.'),
    )));
    const lg = E.Log ? E.Log.status() : null;
    if (lg) el.appendChild(section('سجل العمليات (مَن فعل ماذا ومتى)', h('div', { id: 'log-card' },
      UI().kv([['في الإكسيل', 'ورقة «سجل التعديلات» — آخر 500 عملية مع اسم المستخدم'], ['ملفات السجل على القرص', lg.enabled ? h('span', { class: 'badge ok' }, 'مفعَّلة في backups/logs (ملف لكل شهر)') : h('span', { class: 'badge warn' }, 'تُفعَّل مع مجلد النسخ الاحتياطي')], ['آخر كتابة', lg.lastAt ? U().fmtDateTime(lg.lastAt) + ' — ' + lg.lastFile : '—'], ['بانتظار الكتابة', lg.buffered + ' عملية محفوظة في المتصفح' + (lg.enabled ? '' : ' (تُكتب عند تفعيل المجلد)')], lg.error ? ['خطأ', h('span', { style: { color: 'var(--danger)' } }, lg.error)] : null]),
      h('div', { class: 'flex wrap mt' }, btn('تنزيل السجل (Excel)', 'download', async () => { try { const n = await E.Log.downloadXlsx(S().state().audit); UI().toast(`نُزِّل السجل (${n} عملية)`, 'ok'); } catch (e) { UI().toast('تعذّر تنزيل السجل: ' + (e.message || e), 'danger'); } }), lg.enabled ? btn('كتابة الآن', 'check', () => E.Log.flush().then(() => ctx.rerender())) : null),
      h('p', { class: 'small muted mt-s' }, 'يُسجَّل: إضافة/تعديل/حذف أي سجل، الدخول والخروج، ومحاولات الدخول المرفوضة، مع اسم المستخدم والوقت والجهاز. الملفات CSV تُفتح في Excel.'),
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
    const pr = S().project(u.projectCode), p = pr || {}, s = En().unitStatus(u), cl = s.contract ? S().client(s.contract.clientCode) : null;
    const pName = pr ? pr.name : 'مشروع غير موجود'; // صف المشروع محذوف من الإكسيل: لا نعرض undefined ولا رابطًا لا يفتح
    const cs = S().contractsOfUnit(u.code).slice().reverse();
    const maint = S().maintenanceOf(u.code).map(m => { const c = m.custodianContract ? S().contract(m.custodianContract) : En().activeContractOf(u.code, U().d(m.date) || U().today()); const cc = c ? S().client(c.clientCode) : null; return { ...m, custodianName: m.custodianName || (cc ? cc.name : ''), custodianContract: c ? c.code : '' }; });
    const assets = u.assets || [];
    const body = [
      head(u.label.slice(0, 3), `وحدة ${u.label}`, u.code, [UI().badge(s.status, En().USTATUS_AR[s.status]), h('span', { class: 'badge info' }, typeAr(u.type))], [pr ? h('a', { onclick: () => ctx.open('project', p.code) }, p.name) : orphanBadge(pName, u.projectCode), p.address, u.floor ? 'الدور ' + u.floor : '', u.area ? u.area + ' م²' : '']),
      h('div', { class: 'grid g2' },
        section('الحالة الآن', s.contract ? h('div', null, UI().kv([['المستأجر', h('a', { onclick: () => ctx.open('client', cl.code) }, cl.name)], ['العقد', UI().codeLink(s.contract.code, c => ctx.open('contract', c))], ['من', fd(s.contract.start)], ['إلى', `${fd(s.contract.end)} (${s.daysLeft} يوم)`], ['الإيجار الحالي', fm(En().currentRent(s.contract))], ['التأمين', s.contract.deposit ? `${fm(s.contract.deposit)} — ${M().label(M().DEPOSIT_STATUS, s.contract.depositStatus)}` : '—'], ['متأخرات العقد', fm(En().arrears({ contracts: [s.contract], contractSet: new Set([s.contract.code]) }).total)]])) : h('div', null, UI().kv([['شاغرة منذ', s.vacantSince ? `${fd(s.vacantSince)} (${s.vacantDays} يوم)` : 'لم تُؤجَّر من قبل'], ['آخر مستأجر', s.last ? h('a', { onclick: () => ctx.open('client', s.last.clientCode) }, (S().client(s.last.clientCode) || {}).name) : '—'], ['آخر إيجار', s.last ? fm(En().currentRent(s.last, U().d(s.last.end))) : '—'], ['عقد قادم', s.next ? UI().codeLink(s.next.code, c => ctx.open('contract', c)) : '—']]), btn('تأجير هذه الوحدة', 'plus', () => rentUnit(ctx, u.code), 'primary mt-s rent-unit'))),
        section('الأصول والمحتويات', assets.length ? h('div', { class: 'grid', style: { gap: '6px' } }, assets.map(a => h('div', { class: 'flex' }, h('span', { class: 'badge ' + (a.present ? 'ok' : 'muted') }, a.present ? 'موجود' : 'غير موجود'), h('b', null, a.name), a.details ? h('span', { class: 'muted' }, '— ' + a.details) : null))) : empty('لم تُسجَّل أصول', 'عدّل الوحدة لتحديد التكييف والفرش وغيرها'), btn('تعديل', 'edit', async () => { if (await F().unit(u)) { ctx.rerender(); unitProfile(S().unit(u.code), ctx); } }, 'sm')),
      ),
      section(`تاريخ الإيجار (${cs.length} عقد) — من سكن الوحدة ومتى وبكم`, cs.length ? h('div', { class: 'timeline' }, cs.map(c => { const cc = S().client(c.clientCode) || {}; const cst = En().contractStatus(c); const paid = U().sum(S().paymentsOf(c.code), x => U().toNum(x.amount)); const ar = En().arrears({ contracts: [c], contractSet: new Set([c.code]) }).total; return h('div', { class: 'tl ' + cst }, h('span', { class: 'dot' }), h('div', { class: 'body', style: { cursor: 'pointer' }, onclick: () => ctx.open('contract', c.code) }, h('div', { class: 'flex wrap between' }, h('b', null, cc.name || '—'), h('span', { class: 'flex' }, UI().badge(cst, En().CSTATUS_AR[cst]), h('span', { class: 'code' }, c.code))), h('div', { class: 'muted small' }, `${fd(c.start)} → ${fd(c.end)} · الإيجار ${En().schedule(c).map(y => fm(y.rent, { plain: true })).join(' ← ')} · زيادة ${c.increasePct || 0}% · تأمين ${c.deposit ? fm(c.deposit) : '—'}`), h('div', { class: 'small' }, `المسدَّد ${fm(paid)}`, ar ? h('span', { style: { color: 'var(--danger)' } }, ` · متأخرات ${fm(ar)}`) : null))); })) : empty('لم تُؤجَّر من قبل')),
      section(`متابعة الصيانة والإصلاحات (${maint.length})`, UI().table({ cols: [{ key: 'date', label: 'التاريخ', render: r => fd(r.date) }, { key: 'kind', label: 'النوع', render: r => M().label(M().MAINT_KINDS, r.kind) }, { key: 'description', label: 'الوصف', cls: 'wrap wide' }, col.money('cost', 'التكلفة'), { key: 'borneBy', label: 'يتحملها', render: r => M().label(M().BORNE_BY, r.borneBy) }, { key: 'custodianName', label: 'كانت في عهدة', render: r => r.custodianName ? h('a', { onclick: (e) => { e.stopPropagation(); ctx.open('contract', r.custodianContract); } }, r.custodianName) : h('span', { class: 'muted' }, 'شاغرة') }, { key: 'status', label: 'الحالة', render: r => UI().badge(r.status, M().label(M().MAINT_STATUS, r.status)) }, { key: '_a', label: '', sortable: false, cls: 'actions', render: r => h('span', null, r.status === 'open' ? iconBtn('check', 'إغلاق الطلب', async () => { if (await F().closeMaintenance(r)) { ctx.rerender(); unitProfile(S().unit(u.code) || u, ctx); } }, 'primary') : null, r.status === 'open' ? ' ' : null, iconBtn('edit', 'تعديل', async () => { if (await F().maintenance(S().get('maintenance', r.code) || r)) { ctx.rerender(); unitProfile(u, ctx); } }), ' ', iconBtn('trash', 'حذف', async () => { if (await del(ctx, 'maintenance', r.code, String(r.description || '').slice(0, 30))) unitProfile(u, ctx); })) }], rows: maint, sort: 'date', sortDir: -1, emptyTitle: 'لا توجد سجلات صيانة', empty: 'سجّل أي إصلاح هنا ليُعرف في عهدة مَن كانت الوحدة' }), btn('تسجيل صيانة', 'wrench', () => F().maintenance(null, { unitCode: u.code }).then(r => { if (r) { ctx.rerender(); unitProfile(u, ctx); } }), 'sm primary')),
      u.notes ? section('ملاحظات', h('p', null, u.notes)) : null,
    ];
    UI().drawer({ title: `${u.label} — ${pName}`, body, actions: [s.status === 'vacant' ? btn('تأجير', 'plus', () => rentUnit(ctx, u.code), 'sm primary') : null, btn('تعديل', 'edit', async () => { if (await F().unit(u)) { ctx.rerender(); unitProfile(S().unit(u.code), ctx); } }, 'sm'), btn('حذف', 'trash', () => del(ctx, 'units', u.code, u.label), 'sm danger')].filter(Boolean) });
  }
  function clientProfile(c, ctx) {
    const cs = S().contractsOfClient(c.code).slice().sort((a, b) => U().cmp(b.start, a.start));
    const sc = { contracts: cs, contractSet: new Set(cs.map(x => x.code)) };
    const ar = En().arrears(sc);
    const pays = cs.flatMap(x => { const u = S().unit(x.unitCode) || {}; return S().paymentsOf(x.code).map(p => ({ ...p, unitLabel: u.label, unitCode: u.code || x.unitCode })); }).sort((a, b) => U().cmp(b.period, a.period));
    const paid = U().sum(pays, p => U().toNum(p.amount));
    const active = cs.filter(x => En().contractStatus(x) === 'active');
    const punct = En().punctuality({ clients: [c], contractSet: sc.contractSet })[0];
    const upcoming = cs.filter(x => En().contractStatus(x) === 'future');
    const reopen = () => clientProfile(S().client(c.code) || c, ctx);
    const payable = cs.filter(x => { const st0 = En().contractStatus(x); return st0 === 'active' || st0 === 'future'; }).length || ar.total > 0;
    // عميل بلا عقد ساري ولا قادم: الخطوة التالية واضحة في أول البروفايل
    const linkCard = !active.length && !upcoming.length ? h('div', { class: 'banner info next-step', id: 'client-next' }, UI().icon('info'), h('span', null, cs.length ? 'لا يوجد عقد ساري لهذا العميل الآن — كل عقوده منتهية.' : 'عميل جديد بلا عقد — اربطه بوحدة لبدء الإيجار والتحصيل.'), btn('ربطه بوحدة الآن', 'link', () => rentToClient(ctx, c.code), 'sm primary btn-link-unit')) : null;
    const rows = cs.map(x => ({ ...En().row({ contract: x }), cstatus: En().contractStatus(x), start: x.start, end: x.end, rent: En().currentRent(x), paid: U().sum(S().paymentsOf(x.code), p => U().toNum(p.amount)), arrears: En().arrears({ contracts: [x], contractSet: new Set([x.code]) }).total, deposit: x.deposit, depositStatus: x.depositStatus }));
    const body = [
      linkCard,
      head(c.name.slice(0, 2), c.name, c.code, [h('span', { class: 'badge info' }, M().label(M().CLIENT_KINDS, c.kind)), ar.total ? UI().badge('danger', 'عليه متأخرات') : UI().badge('ok', 'لا متأخرات')], [c.rep ? h('span', null, 'الممثل القانوني: ' + c.rep) : null, c.phone ? h('span', null, 'ت: ', h('span', { class: 'ltr' }, c.phone)) : null, c.nationalId ? h('span', null, 'الرقم القومي / الباسبور: ', h('span', { class: 'ltr' }, c.nationalId)) : null, c.taxId ? h('span', null, 'تسجيل ضريبي: ', h('span', { class: 'ltr' }, c.taxId)) : null, c.email ? h('span', null, c.email) : null]),
      h('div', { class: 'kpis' }, kpiMini('العقود', cs.length, `${active.length} ساري`, () => contractsEvidence(ctx, cs, 'عقود ' + c.name)), kpiMini('إجمالي المسدَّد', fm(paid), `${pays.length} دفعة`, () => paymentsEvidence(ctx, pays, 'مدفوعات ' + c.name), 'accent'), kpiMini('المتأخرات', fm(ar.total), `${ar.rows.length} شهر · أقصى تأخير ${ar.rows.length ? Math.max(...ar.rows.map(r => r.overdueDays)) : 0} يوم`, () => arrearsEvidence(ctx, ar), ar.total ? 'danger' : 'ok'), kpiMini('الالتزام بالموعد', punct && punct.score != null ? fp(punct.score) : '—', punct && punct.knownDates ? `من ${punct.knownDates} دفعة بتاريخ` : 'لا دفعات بتاريخ مسجَّل', () => paymentsEvidence(ctx, pays, 'مدفوعات ' + c.name), 'info'), kpiMini('الوحدات الحالية', active.length, active.map(x => (S().unit(x.unitCode) || {}).label).join('، ') || '—', () => contractsEvidence(ctx, active, 'الوحدات الحالية لـ' + c.name))),
      section('بيانات العميل', UI().kv([['الاسم', c.name], ['النوع', M().label(M().CLIENT_KINDS, c.kind)], ['الممثل القانوني', c.rep], ['الرقم القومي / الباسبور', c.nationalId ? h('span', { class: 'ltr' }, c.nationalId) : ''], ['رقم التسجيل الضريبي', c.taxId ? h('span', { class: 'ltr' }, c.taxId) : ''], ['التليفون', c.phone ? h('span', { class: 'ltr' }, c.phone) : ''], ['تليفون آخر', c.phone2 ? h('span', { class: 'ltr' }, c.phone2) : ''], ['البريد', c.email], ['العنوان', c.address], ['تفاصيل', c.notes]])),
      section(`العقود (${cs.length}) — أين سكن ومتى وبكم`, UI().table({ cols: [{ key: 'contractCode', label: 'العقد', render: r => h('span', { class: 'code' }, r.contractCode) }, col.unit(ctx), col.project(), { key: 'start', label: 'من', render: r => fd(r.start) }, { key: 'end', label: 'إلى', render: r => fd(r.end) }, col.money('rent', 'الإيجار'), { key: 'deposit', label: 'التأمين', num: true, render: r => r.deposit ? `${fm(r.deposit)} (${M().label(M().DEPOSIT_STATUS, r.depositStatus)})` : '—' }, col.money('paid', 'المسدَّد'), { key: 'arrears', label: 'المتأخرات', num: true, render: r => h('span', { style: { color: r.arrears ? 'var(--danger)' : '' } }, fm(r.arrears)) }, { key: 'cstatus', label: 'الحالة', render: r => UI().badge(r.cstatus, En().CSTATUS_AR[r.cstatus]) }], rows, onRow: r => ctx.open('contract', r.contractCode), emptyTitle: 'لا توجد عقود' }), btn('تأجير وحدة لهذا العميل', 'plus', () => rentToClient(ctx, c.code), 'sm primary')),
      ar.rows.length ? section('الشهور المتأخرة', UI().table({ cols: [col.unit(ctx), col.period(), { key: 'dueDate', label: 'الاستحقاق', render: r => fd(r.dueDate) }, { key: 'overdueDays', label: 'أيام التأخير', num: true }, col.money('amount', 'المتبقي'), { key: '_a', label: '', sortable: false, cls: 'actions', render: r => iconBtn('receipt', 'تسجيل دفعة', async () => { if (await F().payment(null, { contractCode: r.contractCode, period: r.period })) { ctx.rerender(); reopen(); } }, 'primary') }], rows: ar.rows, sort: 'overdueDays', sortDir: -1 }), btn('تذكير واتساب', 'chat', () => remind(c, ar), 'sm primary')) : null,
      section(`آخر المدفوعات (${pays.length})`, UI().table({ cols: paymentCols(ctx).filter(cc => cc.key !== 'clientName'), rows: pays.slice(0, 24), onRow: r => F().invoice(r), emptyTitle: 'لا توجد مدفوعات' })),
    ];
    UI().drawer({ title: 'عميل: ' + c.name, body, actions: [payable ? btn('تسجيل دفعة', 'receipt', () => payFor(ctx, c.code, reopen), 'sm primary') : null, active.length || upcoming.length ? btn('تأجير وحدة', 'plus', () => rentToClient(ctx, c.code), 'sm') : null, btn('كشف حساب', 'statement', () => F().statement(c), 'sm'), ar.total ? btn('تذكير', 'chat', () => remind(c, ar), 'sm') : null, btn('تعديل', 'edit', async () => { if (await F().client(c)) { ctx.rerender(); clientProfile(S().client(c.code), ctx); } }, 'sm'), btn('حذف', 'trash', () => del(ctx, 'clients', c.code, c.name), 'sm danger')].filter(Boolean) });
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
    // بداية الشبكة = بداية المحاسبة الفعلية (الإعداد أو سلايسر «المحاسبة من») حتى تطابق مؤشر المتأخرات في البروفايل
    const tf = En().trackingFrom();
    if (s && e && e >= s) { const from = U().cmp(U().periodOf(s), tf) > 0 ? U().periodOf(s) : tf; for (const pr of U().periods(from, U().periodOf(e))) months.push(En().cell(c, pr)); }
    const orphan = pays.filter(x => !En().dueForMonth(c, x.period));
    const refresh = () => contractProfile(S().contract(c.code) || c, ctx); // بعد أي كتابة من خانة شهر: أعد فتح البروفايل ببيانات جديدة
    const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '6px' } }, months.map(m => h('button', { class: 'kpi ' + ({ paid: 'ok', partial: 'warn', late: 'danger', due: 'info', upcoming: '', advance: 'info' }[m.status] || ''), style: { padding: '8px 10px' }, dataset: { month: m.period }, onclick: () => cellAction(ctx, c, m.period, m, refresh) }, h('span', { class: 'bar' }), h('div', { class: 'l' }, U().periodLabel(m.period, true)), h('div', { class: 'v', style: { fontSize: '15px' } }, m.paid ? fm(m.paid, { plain: true }) : '—'), h('div', { class: 'd' }, UI().badge(m.status, En().STATUS_AR[m.status])))));
    const body = [
      head('عقد', `${cl.name || '—'} — ${u.label || '—'}`, c.code, [UI().badge(cst, En().CSTATUS_AR[cst])], [h('a', { onclick: () => ctx.open('client', cl.code) }, 'بروفايل العميل'), h('a', { onclick: () => ctx.open('unit', u.code) }, 'بروفايل الوحدة'), p.name]),
      h('div', { class: 'kpis' }, kpiMini('الإيجار الحالي', fm(En().currentRent(c)), `زيادة سنوية ${c.increasePct || 0}%`, () => scheduleEvidence(ctx, c), 'accent'), kpiMini('المسدَّد', fm(paid), `${pays.length} دفعة`, () => paymentsEvidence(ctx, pays, 'مدفوعات العقد ' + c.code)), kpiMini('المتأخرات', fm(ar.total), `${ar.rows.length} شهر`, () => arrearsEvidence(ctx, ar), ar.total ? 'danger' : 'ok'), kpiMini('التأمين', c.deposit ? fm(c.deposit) : '—', M().label(M().DEPOSIT_STATUS, c.depositStatus), () => ctx.open('unit', u.code), 'info')),
      section('بيانات العقد', UI().kv([['بداية العقد', fd(c.start)], ['نهاية العقد', fd(c.end)], ['المدة', s && e ? Math.round(U().daysBetween(s, e) / 30.4) + ' شهر' : ''], ['يوم الاستحقاق', c.dueDay || 1], ['الإيجار (السنة الأولى)', fm(c.rent)], ['الزيادة السنوية', (c.increasePct || 0) + '%'], ['التأمين', c.deposit ? `${fm(c.deposit)} — ${M().label(M().DEPOSIT_STATUS, c.depositStatus)}` : 'بدون'], ['العقد السابق', prev ? UI().codeLink(prev.code, x => ctx.open('contract', x)) : '—'], ['العقد التالي', next ? UI().codeLink(next.code, x => ctx.open('contract', x)) : '—'], ['ملاحظات', c.notes]])),
      section('جدول سنوات العقد', UI().table({ cols: [{ key: 'k', label: 'السنة', render: r => 'السنة ' + r.k }, { key: 'from', label: 'من', render: r => fd(r.from) }, { key: 'to', label: 'إلى', render: r => fd(r.to) }, col.money('rent', 'الإيجار الشهري'), { key: 'ov', label: '', sortable: false, render: r => c.rentOverrides && c.rentOverrides[r.k] != null ? h('span', { class: 'muted small' }, 'قيمة يدوية') : '' }], rows: sch, emptyTitle: 'تواريخ العقد غير صحيحة' })),
      section('شهور العقد — اضغط على أي شهر لتسجيل أو مراجعة السداد', months.length ? grid : empty('لا شهور ضمن فترة المحاسبة')),
      orphan.length ? section('دفعات خارج مدة العقد (فترة سابقة لنفس المستأجر)', UI().table({ cols: [col.period(), col.money('amount', 'المبلغ'), { key: 'code', label: 'الفاتورة', render: r => h('span', { class: 'code' }, r.code) }], rows: orphan })) : null,
      section(`الفواتير (${pays.length})`, UI().table({ cols: paymentCols(ctx).filter(cc => cc.key !== 'clientName' && cc.key !== 'unitLabel'), rows: pays, onRow: r => F().invoice(r), emptyTitle: 'لا توجد دفعات' }), btn('تسجيل دفعة', 'receipt', () => F().payment(null, { contractCode: c.code }).then(r => { if (r) { ctx.rerender(); refresh(); } }), 'sm primary')),
    ];
    UI().drawer({ title: 'عقد ' + c.code, body, actions: [btn('تجديد', 'plus', () => renew(ctx, c), 'sm primary'), cst === 'active' && U().cmp(c.end, U().iso(U().today())) > 0 ? btn('إنهاء العقد', 'x', async () => { if (await F().terminate(c)) { ctx.rerender(); refresh(); } }, 'sm terminate') : null, btn('تعديل', 'edit', async () => { if (await F().contract(c)) { ctx.rerender(); contractProfile(S().contract(c.code), ctx); } }, 'sm'), btn('حذف', 'trash', () => del(ctx, 'contracts', c.code, c.code), 'sm danger')].filter(Boolean) });
  }

  const PAGES = { dashboard, ledger, insights, projects, units, clients, contracts, payments, maintenance, quality, audit, settings };
  function render(name, el, ctx) { (PAGES[name] || dashboard)(el, ctx); }
  E.Views = { render, profile, monthEvidence, arrearsEvidence, pendingEvidence, unitsEvidence, renewalsEvidence, depositsEvidence, forecastEvidence, maintenanceEvidence, contractsEvidence, paymentsEvidence, scheduleEvidence, openEvidence, insightEl, renew, del, remind, reminderText, waNumber, cellAction, scopeActive };
})(window.Egary);
