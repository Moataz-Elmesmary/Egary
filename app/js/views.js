/* =========================================================
   views.js — شاشات النظام (محفظة متعددة المباني/الكشوف)
   ========================================================= */
(function () {
  'use strict';
  const { h, money, pct, icon, statusChip, bindTip, openDrawer, closeDrawer,
          toast, field, input, select, emptyState, shortDate } = UI;

  /* حالة عرض عابرة (لا تُحفظ) */
  const VS = {
    dashMonth: null,
    matrixYear: 2026,
    tafrigh: false,          // وضع تفريغ كشف: النقر يقلّب ✓/✗
    qualitySev: 'all',
    qualityStatus: 'open',
    collectionAsTable: false,
  };

  /* عملاء الوحدات بلا عقود (معلومون من الكشف) */
  const ORPHAN_TENANT = { U9: 'T7', U10: 'T9' };

  function currentPeriod() { return Store.periodOf(Store.today()); }
  function defaultDashMonth() { return Store.addMonths(currentPeriod(), -1); }

  /* صيغ العدد والمعدود العربية */
  function pluralDays(n) {
    if (n === 1) return 'يوم واحد';
    if (n === 2) return 'يومين';
    if (n >= 3 && n <= 10) return n + ' أيام';
    return n + ' يومًا';
  }
  function pluralMonths(n) {
    if (n === 1) return 'شهر واحد';
    if (n === 2) return 'شهرين';
    if (n >= 3 && n <= 10) return n + ' أشهر';
    return n + ' شهرًا';
  }

  /* عنصر قابل للنقر يجب أن يكون قابلًا للوصول بالكيبورد أيضًا */
  function keyClickable(el) {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
    });
    return el;
  }

  /* ========================================================
     المرشِّحات العامة (السلايسرز) — تسري على كل الشاشات
     ======================================================== */
  function F() { return App.filters; }

  function unitTenantIds(u) {
    const ids = Store.unitContracts(u.id).map(c => c.tenantId);
    if (ORPHAN_TENANT[u.id]) ids.push(ORPHAN_TENANT[u.id]);
    return [...new Set(ids)];
  }
  function unitHasActivity(u) {
    return Store.state.marks.some(m => m.unitId === u.id) ||
           Store.state.payments.some(p => p.unitId === u.id);
  }
  function unitStatusKey(u, asOf) {
    const act = Store.activeContractOn(u.id, asOf);
    if (act) {
      return Store.daysBetween(asOf, Store.d(act.end)) <= 90 ? 'ending' : 'occupied';
    }
    if (Store.unitContracts(u.id).length) return 'ended';
    return unitHasActivity(u) ? 'noContract' : 'vacant';
  }

  function filteredUnits(asOf) {
    asOf = asOf || Store.today();
    const f = F();
    let arrearsSet = null;
    if (f.st === 'arrears') {
      const ar = Store.arrears(asOf);
      arrearsSet = new Set([...ar.rows.map(r => r.unitId), ...ar.unknowns.map(r => r.unitId)]);
    }
    const q = (f.q || '').trim();
    return Store.state.units.filter(u => {
      if (f.b && u.buildingId !== f.b) return false;
      if (f.ty && u.type !== f.ty) return false;
      if (f.tn && !unitTenantIds(u).includes(f.tn)) return false;
      if (f.st) {
        if (f.st === 'arrears') { if (!arrearsSet.has(u.id)) return false; }
        else {
          const k = unitStatusKey(u, asOf);
          if (f.st === 'notEarning') {
            // «الشاغرة» بمنطق البيزنس: مش داخلة فلوس منها الشهر ده
            if (Store.unitIsEarning(u, Store.periodOf(asOf), asOf)) return false;
          } else if (f.st === 'occupied' ? (k !== 'occupied' && k !== 'ending') : k !== f.st) return false;
        }
      }
      if (q) {
        // البحث يغطي ما يبحث عنه المكتب فعلًا: اسم/كود/وحدة/كشف/مالك/منطقة/تليفون/رقم إيصال
        const ts = unitTenantIds(u).map(id => Store.tenant(id)).filter(Boolean);
        const b = Store.building(u.buildingId) || {};
        const receipts = Store.state.payments
          .filter(p => p.unitId === u.id && p.receiptNo).map(p => p.receiptNo).join(' ');
        const hay = [
          u.name, u.code || '', u.type, u.floor || '', b.name || '', b.code || '', b.owner || '', b.area || '',
          ts.map(t => t.name).join(' '), ts.map(t => t.code || '').join(' '),
          ts.map(t => t.phone || '').join(' '), receipts,
        ].join(' ');
        if (!UI.arMatch(hay, q)) return false;
      }
      return true;
    });
  }
  function fset(asOf) { return new Set(filteredUnits(asOf).map(u => u.id)); }
  function anyFilterOn() {
    const f = F();
    return !!(f.b || f.ty || f.tn || f.st || (f.q || '').trim());
  }

  /* شريط السلايسرز — يُبنى من app.js أعلى كل شاشة.
     الشريط يبقى حيًّا بين عمليات الرسم، لذا نكتب دائمًا في App.filters الحالي
     لا في نسخة مُلتقطة وقت البناء — وإلا توقّف الترشيح بصمت بعد أي استبدال للكائن */
  function slicerBar() {
    const f = {
      get b() { return F().b; }, set b(v) { F().b = v; },
      get ty() { return F().ty; }, set ty(v) { F().ty = v; },
      get tn() { return F().tn; }, set tn(v) { F().tn = v; },
      get st() { return F().st; }, set st(v) { F().st = v; },
      get q() { return F().q; }, set q(v) { F().q = v; },
    };
    const asOf = Store.today();
    const types = [...new Set(Store.state.units.map(u => u.type))];
    const bSel = UI.combo({
      placeholder: 'كل المشاريع',
      items: [
        { value: '', label: 'كل المشاريع' },
        ...Store.state.buildings.map(b => ({ value: b.id, label: (b.code ? b.code + ' · ' : '') + b.name + (b.demo ? ' · تجريبي' : '') })),
      ],
      value: f.b,
      onPick: v => { f.b = v; App.render(); },
    });
    const tySel = select({ 'aria-label': 'النوع' }, [
      { value: '', label: 'كل الأنواع' },
      ...types.map(t => ({ value: t, label: t })),
    ], f.ty);
    const tnSel = UI.combo({
      placeholder: 'كل العملاء',
      items: [
        { value: '', label: 'كل العملاء' },
        ...[...Store.state.tenants].sort((a, b) => a.name.localeCompare(b.name, 'ar'))
          .map(t => ({ value: t.id, label: t.name })),
      ],
      value: f.tn,
      onPick: v => { f.tn = v; App.render(); },
    });
    const stSel = select({ 'aria-label': 'الحالة' }, [
      { value: '', label: 'كل الحالات' },
      { value: 'occupied', label: 'مؤجَّرة' },
      { value: 'ending', label: 'تنتهي خلال 90 يوم' },
      { value: 'ended', label: 'عقد منتهٍ بلا تجديد' },
      { value: 'noContract', label: 'بلا عقد مسجّل' },
      { value: 'vacant', label: 'شاغرة' },
      { value: 'arrears', label: 'عليها متأخرات' },
    ], f.st);
    const qIn = input({ type: 'search', placeholder: 'ابحث بالاسم أو الكود — عميل أو وحدة أو مشروع…', value: f.q || '',
      role: 'combobox', 'aria-expanded': 'false', 'aria-autocomplete': 'list' });
    bSel.addEventListener('change', () => { f.b = bSel.value; App.render(); });
    tySel.addEventListener('change', () => { f.ty = tySel.value; App.render(); });
    tnSel.addEventListener('change', () => { f.tn = tnSel.value; App.render(); });
    stSel.addEventListener('change', () => { f.st = stSel.value; App.render(); });

    /* اقتراحات فورية أثناء الكتابة: كلمات مفتاحية جاهزة يضغطها فتفلتر */
    const sugList = h('div.sug-list', { role: 'listbox', hidden: true });
    function sugPool() {
      // raw = النص العربي المخزَّن (هو ما يُفلتَر به)، label = المعروض بلغة الواجهة، code = للبحث بالكود
      const en = I18N.lang === 'en';
      const mk = (raw, cat, code) => ({ raw, label: en ? I18N.tt(raw) : raw, cat, code: code || '' });
      const pool = [];
      for (const tn of Store.state.tenants) pool.push(mk(tn.name, 'عميل', tn.code));
      for (const u of Store.state.units) pool.push(mk(u.name, 'وحدة', u.code));
      for (const b of Store.state.buildings) pool.push(mk(b.name, 'مشروع', b.code));
      for (const ty of new Set(Store.state.units.map(u => u.type).filter(Boolean))) pool.push(mk(ty, 'نوع'));
      for (const fl of new Set(Store.state.units.map(u => u.floor).filter(Boolean))) pool.push(mk(fl, 'دور'));
      return pool;
    }
    let sugIdx = -1;
    function renderSugs() {
      const q = qIn.value.trim();
      sugIdx = -1;
      sugList.innerHTML = '';
      if (!q) { sugList.hidden = true; qIn.setAttribute('aria-expanded', 'false'); return; }
      const hits = sugPool().filter(s =>
        UI.arMatch(s.label, q) || UI.arMatch(s.raw, q) || (s.code && UI.arMatch(s.code, q))).slice(0, 8);
      if (!hits.length) { sugList.hidden = true; qIn.setAttribute('aria-expanded', 'false'); return; }
      for (const s of hits) {
        const item = h('button.sug-item', { type: 'button', role: 'option' }, [
          h('span', [s.label, s.code ? h('span.sug-code', ' · ' + s.code) : null]), h('span.sug-cat', s.cat),
        ]);
        item.addEventListener('mousedown', e => {
          e.preventDefault();
          // لو المطابقة كانت على الكود نحتفظ به — الاسم وحده قد يطابق وحدات أخرى
          // وفيما عدا ذلك نفلتر بالنص العربي المخزَّن لأن المعروض قد يكون ترجمة
          const byCode = !!(s.code && UI.arMatch(s.code, qIn.value.trim()));
          qIn.value = byCode ? s.code : s.label;
          f.q = byCode ? s.code : s.raw;
          sugList.hidden = true; qIn.setAttribute('aria-expanded', 'false');
          App.render();
        });
        sugList.appendChild(item);
      }
      I18N.translateNode(sugList);
      sugList.hidden = false; qIn.setAttribute('aria-expanded', 'true');
    }
    qIn.addEventListener('keydown', e => {
      if (sugList.hidden) return;
      const items = [...sugList.children];
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        sugIdx = (sugIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach((el, i) => el.classList.toggle('sug-active', i === sugIdx));
      } else if (e.key === 'Enter' && sugIdx >= 0) {
        e.preventDefault();
        items[sugIdx].dispatchEvent(new window.Event('mousedown'));
      } else if (e.key === 'Escape') {
        sugList.hidden = true; qIn.setAttribute('aria-expanded', 'false');
      }
    });
    qIn.addEventListener('blur', () => { setTimeout(() => { sugList.hidden = true; qIn.setAttribute('aria-expanded', 'false'); }, 150); });
    let qT;
    qIn.addEventListener('input', () => {
      renderSugs();
      clearTimeout(qT); qT = setTimeout(() => { f.q = qIn.value; App.render(); }, 250);
    });
    const n = filteredUnits(asOf).length;
    function refreshSlicerCount(el) {
      const c = el.querySelector('.slicer-count');
      const k = filteredUnits(Store.today()).length;
      if (c) c.textContent = I18N.lang === 'en' ? k + ' units' : k + ' وحدة';
    }
    Views.refreshSlicerCount = refreshSlicerCount;
    return h('div.slicers', [
      h('span.slicer-item.slicer-q', [qIn, sugList]),
      h('span.slicer-item', bSel),
      h('span.slicer-item', tySel),
      h('span.slicer-item', tnSel),
      h('span.slicer-item', stSel),
      anyFilterOn() ? h('button.btn.btn-ghost', {
        onclick: () => { App.filters = { b: '', ty: '', tn: '', st: '', q: '' }; App.render(); },
      }, 'مسح') : null,
      h('span.slicer-count', `${n} وحدة`),
    ]);
  }

  function demoBanner() {
    const f = F();
    if (!f.b) return null;
    const b = Store.building(f.b);
    if (!b || !b.demo) return null;
    return h('div.banner.banner-info', [
      icon('question'),
      h('div', [h('b', b.name + ': '), 'بيانات توضيحية مولَّدة لتجربة تعدد الكشوف — ليست بيانات فعلية. تُحذف بزر واحد من الإعدادات.']),
    ]);
  }

  /* ========================================================
     مكوّنات مشتركة
     ======================================================== */
  function pageHead(title, sub, actions) {
    return h('div.page-head', [
      h('div', [h('h2.page-title', title), sub ? h('p.page-sub', sub) : null]),
      actions ? h('div.page-actions', actions) : null,
    ]);
  }

  function statTile(o) {
    const delta = o.delta ? h('span.delta.' + (o.delta.good ? 'delta-good' : 'delta-bad'), [
      icon(o.delta.dir === 'up' ? 'up' : 'down'), h('span', o.delta.text),
    ]) : null;
    const t = h('div.tile' + (o.onclick ? '.tile-click' : ''), { onclick: o.onclick }, [
      o.ic ? h('span.tile-ic.tone-' + (o.tone || 'accent'), icon(o.ic)) : null,
      h('div.tile-top', [h('span.tile-label', o.label), o.chip || null]),
      h('div.tile-value-row', [
        h('span.tile-value' + (o.valueClass ? '.' + o.valueClass : ''), o.value),
        delta,
      ]),
      o.sub ? h('div.tile-sub', o.sub) : null,
      o.spark ? h('div.tile-spark', o.spark) : null,
    ]);
    if (o.onclick) keyClickable(t);
    return t;
  }

  /* أساس الإيجار «شهري» محسوم من البند الثالث في عقد العينة — لا لافتة تحذير.
     التبديل يظل متاحًا من الإعدادات لو ظهر عقد بنموذج مختلف. */
  function basisBanner() { return null; }

  function sectionCard(title, node, actions) {
    return h('section.card', [
      h('div.card-head', [h('h3.card-title', title), actions ? h('div.card-actions', actions) : null]),
      node,
    ]);
  }

  function unitLabel(unitId) {
    const u = Store.unit(unitId);
    return u ? u.name : '—';
  }
  function tenantLabel(tid) {
    const t = Store.tenant(tid);
    return t ? t.name : '—';
  }
  function bLabel(bid) {
    const b = Store.building(bid);
    return b ? b.name : '—';
  }
  function severityChip(sev) {
    return sev === 'critical' ? statusChip('critical', 'حرجة')
      : sev === 'high' ? statusChip('serious', 'عالية')
      : sev === 'medium' ? statusChip('warning', 'متوسطة')
      : statusChip('neutral', 'منخفضة');
  }

  /* ========================================================
     مخطط واجهة المبنى: طوابق × وحدات بحالة الشهر المختار
     ======================================================== */
  const FLOOR_ORDER = ['السادس', 'الخامس', 'الرابع', 'الثالث', 'الثاني', 'الأول', 'ميزانين', 'أرضي', 'بدروم', 'غير محدد'];
  const EV_CLS = {
    paid: 'ev-ok', paid_imported: 'ev-ok', paid_late: 'ev-warn', orphan_paid: 'ev-ok',
    partial: 'ev-warn', late: 'ev-bad', unknown: 'ev-unk', due: 'ev-due',
    upcoming: 'ev-emp', history: 'ev-emp', none: 'ev-emp',
  };
  function elevationCard(month, uset, asOf) {
    const f = F();
    const bs = Store.state.buildings.filter(b => !f.b || b.id === f.b);
    const blocks = bs.map(b => {
      const us = filteredUnits(asOf).filter(u => u.buildingId === b.id);
      if (!us.length) return null;
      const byFloor = {};
      us.forEach(u => {
        const fl = u.floor || 'غير محدد';
        (byFloor[fl] = byFloor[fl] || []).push(u);
      });
      const floors = FLOOR_ORDER.filter(x => byFloor[x]);
      const buset = new Set(us.map(u => u.id));
      const mt = Store.monthTotals(month, asOf, buset);
      const lateN = us.filter(u => {
        const st = Store.cellInfo(u.id, month, asOf).status;
        return st === 'late' || st === 'partial';
      }).length;
      const vacN = us.filter(u => unitStatusKey(u, asOf) === 'vacant' || unitStatusKey(u, asOf) === 'ended').length;
      return h('div.bldg', [
        h('div.bldg-head', [
          h('b', b.name),
          b.demo ? h('span.chip.chip-neutral', 'تجريبي') : h('span.chip.chip-unknown', 'مشروع فعلي'),
          b.owner ? h('span.bldg-owner', 'المالك: ' + b.owner) : null,
          h('span.bldg-area', b.area),
        ]),
        h('div.elev', floors.map(fl => h('div.flr', [
          h('span.flr-name', fl),
          h('span.flr-cells', byFloor[fl].map(u => {
            const ci = Store.cellInfo(u.id, month, asOf);
            const cls = EV_CLS[ci.status] || 'ev-emp';
            const chip = h('button.evc.' + cls, { onclick: () => openUnitDrawer(u) }, [
              h('span.evc-name', u.name),
              (ci.due && ci.due.estimated) ? h('span.evc-approx', '≈') : null,
            ]);
            bindTip(chip, () => {
              const def = CELL_DEFS[ci.status] || CELL_DEFS.none;
              let html = `<b>${u.name}</b> — ${u.type}<br>${def.label}`;
              const tid = unitTenantIds(u)[0];
              if (tid) html += `<br>${tenantLabel(tid)}`;
              if (ci.due) html += `<br>مستحق ${Store.periodLabel(month)}: ${money(ci.due.amount)}`;
              return html + '<br><i>اضغط لفتح ملف الوحدة</i>';
            });
            return chip;
          })),
        ]))),
        h('div.bldg-stat', [
          h('span', ['تحصيل ' + Store.periodLabel(month) + ' ', h('b.val-accent', mt.rate == null ? '—' : pct(mt.rate))]),
          h('span', ['متعثر ', h('b.val-critical', String(lateN))]),
          h('span', ['بلا عقد نشط ', h('b', String(vacN))]),
          h('span.grow'),
          h('span', ['مستحق الشهر ', h('b', money(mt.due + mt.unknownDue, { bare: true }))]),
        ]),
      ]);
    }).filter(Boolean);
    return blocks.length ? h('div.bldgs', blocks) : emptyState('لا وحدات ضمن الترشيح الحالي');
  }

  /* ========================================================
     1) لوحة المؤشرات
     ======================================================== */
  function viewDashboard() {
    if (!VS.dashMonth) VS.dashMonth = defaultDashMonth();
    const asOf = Store.today();
    const uset = fset(asOf);
    const m = VS.dashMonth;
    const mt = Store.monthTotals(m, asOf, uset);
    const ar = Store.arrears(asOf, uset);
    const occ = Store.occupancy(asOf, uset);
    const ren = Store.renewals(90, asOf, uset);
    const deps = Store.depositsHeld(uset);
    const rev = Store.contractedRevenue(currentPeriod(), 12, uset);
    const types = Store.revenueByType(m, uset);
    const openIssues = Store.state.issues.filter(q => q.status === 'open');
    const critIssues = openIssues.filter(q => q.severity === 'critical').length;

    const rateSeries = Store.collectionSeries(m, 6, asOf, uset).map(x => x.rate);
    const collSeries = Store.collectionSeries(m, 12, asOf, uset);

    const filters = h('div.filter-row', [
      h('span.filter-label', 'شهر التقرير'),
      h('div.month-nav', [
        h('button.btn-icon', { onclick: () => { VS.dashMonth = Store.addMonths(VS.dashMonth, -1); App.render(); }, 'aria-label': 'شهر أسبق' }, icon('right')),
        h('span.month-name', Store.periodLabel(m, true)),
        h('button.btn-icon', { onclick: () => { VS.dashMonth = Store.addMonths(VS.dashMonth, 1); App.render(); }, 'aria-label': 'شهر أحدث' }, icon('left')),
      ]),
      h('button.btn.btn-ghost', { onclick: () => { VS.dashMonth = defaultDashMonth(); App.render(); } }, 'آخر شهر مكتمل'),
    ]);

    const mtPrev = Store.monthTotals(Store.addMonths(m, -1), asOf, uset);
    const rateDelta = (mt.rate != null && mtPrev.rate != null)
      ? Math.round((mt.rate - mtPrev.rate) * 100) : null;
    const tiles = h('div.tiles', [
      statTile({
        label: 'تحصيل ' + Store.periodLabel(m, true),
        value: mt.rate == null ? '—' : pct(mt.rate),
        ic: 'money', tone: 'accent',
        delta: rateDelta == null || rateDelta === 0 ? null : {
          dir: rateDelta > 0 ? 'up' : 'down', good: rateDelta > 0,
          text: Math.abs(rateDelta) + ' نقطة',
        },
        sub: mt.due > 0
          ? `${money(mt.collected, { bare: true })} من ${money(mt.due)}`
            + (mt.latePaid ? ` · منها متأخر السداد ${money(mt.latePaid, { bare: true })}` : '')
            + (mt.unknownCount ? ` · يحتاج تأكيدًا ${pluralMonths(mt.unknownCount)}` : '')
          : 'لا استحقاقات محسوبة لهذا الشهر',
        spark: Charts.sparkline(rateSeries),
        chip: mt.estimatedPart ? statusChip('unknown', 'جزء تقديري') : null,
      }),
      statTile({
        label: 'المتأخرات',
        value: money(ar.total, { bare: true }),
        ic: 'trendDown', tone: 'critical',
        valueClass: ar.total > 0 ? 'val-critical' : '',
        sub: `${ar.rows.length} شهر×وحدة` + (ar.unknowns.length ? ` · و${pluralMonths(ar.unknowns.length)} بقيمة مجهولة` : ''),
        chip: ar.unknowns.length ? statusChip('critical', 'بند مجهول القيمة') : null,
        onclick: () => { location.hash = '#matrix'; },
      }),
      statTile({
        label: 'سداد يحتاج تأكيد',
        value: money(ar.undocumentedTotal, { bare: true }),
        ic: 'question', tone: 'warning',
        valueClass: ar.undocumentedTotal > 0 ? 'val-warning' : '',
        sub: ar.undocumented.length
          ? `${ar.undocumented.length} شهر×وحدة بلا علامة — سداد أم متأخر؟`
          : 'لا شيء معلَّق',
        onclick: () => { location.hash = '#quality'; },
      }),
      statTile({
        label: 'الإشغال',
        value: `${occ.occupied.length} من ${occ.total}`,
        ic: 'home', tone: 'good',
        sub: `عقد منتهٍ بلا تجديد ${occ.ended.length} · بلا عقد/شاغرة ${occ.noContract.length}`,
        spark: Charts.meter(occ.occupied.length, occ.total),
      }),
      statTile({
        label: 'تجديدات خلال 90 يوم',
        value: String(ren.soon.length + ren.overdue.length),
        ic: 'clock', tone: 'serious',
        valueClass: ren.overdue.length ? 'val-critical' : '',
        sub: ren.overdue.length
          ? `منها ${ren.overdue.length} انتهت فعلًا بلا تجديد`
          : (ren.soon.length ? ren.soon.map(r => unitLabel(r.contract.unitId)).join(' · ') : 'لا شيء'),
        onclick: () => { location.hash = '#contracts'; },
      }),
      statTile({
        label: 'تأمينات محتجزة',
        value: money(deps.reduce((s, x) => s + x.amount, 0), { bare: true }),
        ic: 'shield', tone: 'violet',
        sub: `مسجَّلة لعقد ${deps.length} من ${Store.state.contracts.filter(c => !uset || uset.has(c.unitId)).length}`,
      }),
    ]);

    /* تنبيهات */
    const alerts = [];
    for (const r of ren.overdue) alerts.push({
      kind: 'critical',
      text: `عقد ${tenantLabel(r.contract.tenantId)} على «${unitLabel(r.contract.unitId)}» (${bLabel(Store.unit(r.contract.unitId).buildingId)}) انتهى منذ ${pluralDays(r.daysAgo)} بلا تجديد.`,
      go: '#contracts',
    });
    for (const r of ren.soon) alerts.push({
      kind: 'serious',
      text: `عقد ${tenantLabel(r.contract.tenantId)} على «${unitLabel(r.contract.unitId)}» ينتهي خلال ${pluralDays(r.daysLeft)} (${shortDate(r.contract.end)}).`,
      go: '#contracts',
    });
    if (ar.unknowns.length) alerts.push({
      kind: 'critical',
      text: `«${unitLabel(ar.unknowns[0].unitId)}»: ${ar.unknowns.length} أشهر متأخرة مؤكَّدة بقيمة غير معروفة — لا يوجد عقد مسجّل.`,
      go: '#quality',
    });
    // أعلى وحدتين متأخرات
    const byUnit = {};
    ar.rows.forEach(r => { byUnit[r.unitId] = (byUnit[r.unitId] || 0) + r.amount; });
    Object.entries(byUnit).sort((a, b) => b[1] - a[1]).slice(0, 2).forEach(([uid, v]) => {
      const months = ar.rows.filter(r => r.unitId === uid).length;
      if (v > 0 && months > 1) alerts.push({
        kind: 'serious',
        text: `«${unitLabel(uid)}» عليها ${money(v)} متأخرات (${months} أشهر).`,
        go: '#matrix',
      });
    });
    if (openIssues.length) alerts.push({
      kind: critIssues ? 'critical' : 'warning',
      text: `${openIssues.length} ملاحظة جودة بيانات مفتوحة على الكشف الفعلي، منها ${critIssues} حرجة.`,
      go: '#quality',
    });

    const alertsNode = h('ul.alerts', alerts.slice(0, 7).map(a =>
      keyClickable(h('li.alert', { onclick: () => { location.hash = a.go; } }, [
        statusChip(a.kind, a.kind === 'critical' ? 'حرج' : a.kind === 'serious' ? 'مهم' : 'تنبيه'),
        h('span.alert-text', a.text),
        icon('left', 'alert-go'),
      ]))));

    function collectionTable() {
      return h('div.mini-scroll', h('table.table.table-mini', [
        h('thead', h('tr', [h('th', 'الشهر'), h('th', 'المستحق'), h('th', 'المحصَّل'), h('th', 'النسبة'), h('th', 'يحتاج تأكيدًا')])),
        h('tbody', collSeries.map(x => h('tr', [
          h('td', Store.periodLabel(x.period, true)),
          h('td', money(x.due, { bare: true })),
          h('td', money(x.collected, { bare: true })),
          h('td', x.rate == null ? '—' : pct(x.rate)),
          h('td', x.unknownDue ? money(x.unknownDue, { bare: true }) : '—'),
        ]))),
      ]));
    }
    const collectionToggle = h('button.btn.btn-ghost', {
      onclick: () => { VS.collectionAsTable = !VS.collectionAsTable; App.render(); },
    }, VS.collectionAsTable ? 'عرض كرسم' : 'عرض كجدول');

    const logCard = sectionCard('آخر الحركات',
      Store.state.log.length
        ? h('ul.acts', Store.state.log.slice(0, 8).map(x =>
            h('li.act', [h('span.act-t', x.at), h('span', x.txt)])))
        : emptyState('لا حركات بعد'));

    /* الإجابة المباشرة: من لم يسدِّد الشهر ده؟ */
    function unpaidCard() {
      const rows = [];
      for (const u of filteredUnits(asOf)) {
        const ci = Store.cellInfo(u.id, m, asOf);
        if (!['late', 'partial', 'due', 'unknown'].includes(ci.status)) continue;
        const tid = unitTenantIds(u).slice(-1)[0];
        rows.push({
          u, ci,
          tenant: tid ? tenantLabel(tid) : '—',
          amount: ci.unknownAmount ? null : ci.due ? Math.max(0, ci.due.amount - (ci.status === 'paid_imported' ? ci.due.amount : ci.paid)) : null,
        });
      }
      rows.sort((a, b) => (b.amount || 0) - (a.amount || 0));
      const total = rows.reduce((s, r) => s + (r.amount || 0), 0);
      const chipOf = ci =>
        ci.status === 'late' ? statusChip('critical', ci.unknownAmount ? 'متأخر — قيمة مجهولة' : 'متأخر')
        : ci.status === 'partial' ? statusChip('warning', 'جزئي')
        : ci.status === 'unknown' ? statusChip('unknown', 'يحتاج تأكيد')
        : statusChip('neutral', 'في السماح');
      return sectionCard(`من لم يسدِّد ${Store.periodLabel(m, true)}؟`,
        rows.length
          ? h('div', [
              h('ul.unpaid-list', rows.slice(0, 10).map(r =>
                keyClickable(h('li.unpaid-row', { onclick: () => openCellDrawer(r.u, m, asOf) }, [
                  h('div.unpaid-who', [h('b', r.tenant), h('span.unpaid-unit', ` — ${r.u.name} (${bLabel(r.u.buildingId)})`)]),
                  h('div.unpaid-side', [
                    r.amount != null ? h('span.unpaid-amt', money(r.amount, { bare: true })) : h('span.unpaid-amt.val-critical', '؟'),
                    chipOf(r.ci),
                  ]),
                ])))),
              rows.length > 10 ? h('p.note-line', ` و${rows.length - 10} صفوف أخرى — كاملة في جدول التحصيل.`) : null,
              h('p.unpaid-total', [`الإجمالي غير المحصَّل: `, h('b.val-critical', money(total)),
                rows.some(r => r.amount == null) ? ' + بنود بقيمة مجهولة' : '']),
            ])
          : emptyState('الجميع سدَّد هذا الشهر ✓'));
    }

    return h('div.view', [
      pageHead('لوحة المؤشرات',
        `محفظة من ${Store.state.buildings.length} مبانٍ و${Store.state.units.length} وحدة — كل رقم محسوب لحظيًا من العقود والدفعات.`),
      basisBanner(),
      demoBanner(),
      filters,
      tiles,
      sectionCard('حالة المباني — ' + Store.periodLabel(m, true),
        h('div', [
          elevationCard(m, uset, asOf),
          h('div.legend.legend-block', [
            h('span.legend-item', [h('span.legend-swatch.ev-ok', '✓'), h('span', 'محصَّل')]),
            h('span.legend-item', [h('span.legend-swatch.ev-warn', '½'), h('span', 'جزئي/متأخر السداد')]),
            h('span.legend-item', [h('span.legend-swatch.ev-bad', '✗'), h('span', 'متأخر')]),
            h('span.legend-item', [h('span.legend-swatch.ev-unk', '؟'), h('span', 'يحتاج تأكيدًا')]),
            h('span.legend-item', [h('span.legend-swatch.ev-emp', ' '), h('span', 'بلا استحقاق/شاغرة')]),
          ]),
        ])),
      h('div.grid-2', [
        sectionCard('التحصيل الشهري — المحصَّل من المستحق',
          VS.collectionAsTable ? collectionTable() : Charts.collectionChart(collSeries),
          collectionToggle),
        sectionCard('أعمار المتأخرات', h('div', [
          Charts.agingChart(ar.buckets),
          ar.unknowns.length ? h('p.note-line', [icon('warn'), ` غير مشمول: ${ar.unknowns.length} أشهر بقيمة مجهولة (بلا عقد مسجّل).`]) : null,
        ])),
      ]),
      h('div.grid-2', [
        sectionCard('الإيراد المتعاقد عليه — 12 شهرًا قادمة', h('div', [
          h('p.hero-line', [h('span.hero-num', money(rev.total, { bare: true })), h('span.hero-unit', ' ج.م'),
            rev.anyEstimated ? statusChip('unknown', 'يتضمن قيمًا تقديرية') : null]),
          Charts.revenueChart(rev.series),
        ])),
        unpaidCard(),
      ]),
      h('div.grid-2', [
        sectionCard('يحتاج انتباهك', alerts.length ? alertsNode : emptyState('لا تنبيهات', 'كل شيء تحت السيطرة')),
        logCard,
      ]),
    ]);
  }

  /* ========================================================
     2) مصفوفة التحصيل — شاشة الإدخال الرئيسية
     ======================================================== */
  const CELL_DEFS = {
    paid:          { cls: 'c-paid',      sym: '✓', label: 'مدفوع (موثَّق)' },
    paid_late:     { cls: 'c-plate',     sym: '✓', label: 'مدفوع متأخرًا عن ميعاده' },
    paid_imported: { cls: 'c-paid-imp',  sym: '✓', label: 'مدفوع (من الورقة) — من غير مبلغ/تاريخ' },
    partial:       { cls: 'c-partial',   sym: '½', label: 'سداد جزئي' },
    late:          { cls: 'c-late',      sym: '✗', label: 'متأخر' },
    due:           { cls: 'c-due',       sym: '•', label: 'مستحق الآن (في السماح)' },
    unknown:       { cls: 'c-unknown',   sym: '؟', label: 'يحتاج تأكيد — سداد أم تأخير؟' },
    upcoming:      { cls: 'c-upcoming',  sym: '',  label: 'لم يستحق بعد' },
    history:       { cls: 'c-history',   sym: '·', label: 'قبل تغطية الكشف' },
    orphan_paid:   { cls: 'c-orphan',    sym: '✓', label: 'سداد بلا عقد مسجّل' },
    none:          { cls: 'c-none',      sym: '–', label: 'خارج مدة العقد' },
  };

  function legend() {
    const order = ['paid', 'paid_late', 'paid_imported', 'partial', 'due', 'late', 'unknown', 'orphan_paid', 'history', 'none'];
    return h('div.legend', [
      ...order.map(k =>
        h('span.legend-item', [h('span.legend-swatch.' + CELL_DEFS[k].cls, CELL_DEFS[k].sym || ' '), h('span', CELL_DEFS[k].label)])),
      h('span.legend-item', [h('span.legend-swatch.c-upcoming', '≈'), h('span', 'قيمة تقديرية (+10٪) غير مدوَّنة')]),
    ]);
  }

  function viewMatrix() {
    const asOf = Store.today();
    const year = VS.matrixYear;
    const periods = Array.from({ length: 12 }, (_, i) => year + '-' + String(i + 1).padStart(2, '0'));
    const us = filteredUnits(asOf);
    const uset = new Set(us.map(u => u.id));
    const ar = Store.arrears(asOf, uset);
    const arByUnit = {}, unkByUnit = {};
    ar.rows.forEach(r => { arByUnit[r.unitId] = (arByUnit[r.unitId] || 0) + r.amount; });
    ar.unknowns.forEach(r => { unkByUnit[r.unitId] = (unkByUnit[r.unitId] || 0) + 1; });

    const head = h('tr', [
      h('th.sticky-col', 'الوحدة / العميل'),
      ...periods.map(p => h('th', Store.periodLabel(p))),
      h('th.mx-arr-h', 'متأخرات'),
    ]);

    const bodyRows = [];
    for (const b of Store.state.buildings) {
      const bus = us.filter(u => u.buildingId === b.id);
      if (!bus.length) continue;
      bodyRows.push(h('tr.mx-bhead', h('td', { colspan: 14 }, [
        h('b', b.name), ' ', b.demo ? h('span.chip.chip-neutral', 'تجريبي') : h('span.chip.chip-unknown', 'مشروع فعلي'),
      ])));
      for (const u of bus) {
        const tid = unitTenantIds(u).slice(-1)[0];
        const tr = h('tr');
        tr.appendChild(h('td.sticky-col', [
          h('div.mx-unit', u.name),
          h('div.mx-tenant', tid ? tenantLabel(tid) : '—'),
        ]));
        for (const p of periods) {
          const ci = Store.cellInfo(u.id, p, asOf);
          const def = CELL_DEFS[ci.status] || CELL_DEFS.none;
          const td = h('td.mcell.' + def.cls, { tabindex: 0, role: 'button' });
          td.appendChild(h('span.mcell-sym', def.sym));
          if (ci.due && ci.due.estimated) td.appendChild(h('span.mcell-approx', '≈'));
          bindTip(td, () => {
            let html = `<b>${u.name} — ${Store.periodLabel(p, true)}</b><br>${def.label}`;
            if (ci.due) {
              html += `<br>المستحق: ${money(ci.due.amount)}${ci.due.estimated ? ' <i>(تقديري)</i>' : ''}`;
              if (ci.due.maintenance) html += ` <i>(منها صيانة ${money(ci.due.maintenance, { bare: true })})</i>`;
              if (ci.due.vat) html += ` <i>(+ض.ق.م ${money(ci.due.vat, { bare: true })})</i>`;
            }
            if (ci.status === 'late' && ci.unknownAmount) html += '<br>القيمة غير معروفة — لا عقد مسجّل';
            if (ci.paid && ci.status !== 'paid_imported') html += `<br>المسدَّد: ${money(ci.paid)}${ci.paidDate ? ' في ' + shortDate(ci.paidDate) : ''}`;
            if (ci.status === 'late' && !ci.unknownAmount) html += `<br>أيام التأخير: ${ci.overdueDays}`;
            return html + (VS.tafrigh ? '<br><i>وضع نقل الورقة: الضغط يقلّب ✓/✗/مسح</i>' : '<br><i>اضغط للتفاصيل والتسجيل</i>');
          });
          const open = () => {
            if (!App.canEdit()) { toast('الدخول الحالي للمشاهدة فقط — التسجيل غير متاح', 'warning'); return; }
            if (VS.tafrigh) {
              if (ci.payments.length) { toast('الشهر عليه دفعات مسجَّلة — أطفئ وضع نقل الورقة لتعديلها', 'warning'); return; }
              const cur = ci.mark ? ci.mark.mark : null;
              const next = cur === null ? 'paid' : cur === 'paid' ? 'unpaid' : null;
              Store.setMark(u.id, p, next);
            } else openCellDrawer(u, p, asOf);
          };
          td.addEventListener('click', open);
          td.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
          tr.appendChild(td);
        }
        const av = arByUnit[u.id] || 0, uk = unkByUnit[u.id] || 0;
        tr.appendChild(h('td.mx-arr', [
          av > 0 ? h('div.val-critical', money(av, { bare: true })) : (uk ? null : h('span.mut', '—')),
          uk ? h('div.val-critical', `؟ ×${uk}`) : null,
        ]));
        bodyRows.push(tr);
      }
    }

    /* صف الإجماليات */
    const totRow = h('tr.mx-totals', [h('td.sticky-col', 'الإجمالي (محصَّل / مستحق)')]);
    const cur = currentPeriod();
    for (const p of periods) {
      if (Store.cmpPeriod(p, cur) > 0) {
        let contracted = 0;
        for (const u of us) {
          const c = Store.contractsOverlappingMonth(u.id, p)[0];
          if (c) { const dd = Store.dueForMonth(c, p); if (dd) contracted += dd.amount; }
        }
        totRow.appendChild(h('td.mx-tot.mx-future', contracted ? money(contracted, { bare: true }) : '—'));
      } else {
        const t = Store.monthTotals(p, asOf, uset);
        totRow.appendChild(h('td.mx-tot', t.due ? `${money(t.collected, { bare: true })} / ${money(t.due, { bare: true })}` : '—'));
      }
    }
    totRow.appendChild(h('td.mx-tot', money(ar.total, { bare: true })));

    const modeBar = h('div.mode-bar', [
      h('span.filter-label', 'وضع العمل'),
      h('div.mode-seg', [
        h('button.mode-opt' + (!VS.tafrigh ? '.on' : ''), {
          onclick: () => { VS.tafrigh = false; App.render(); },
        }, [icon('money'), ' تسجيل دفعات — اضغط الخلية تفتح دفعة كاملة']),
        h('button.mode-opt' + (VS.tafrigh ? '.on' : ''), {
          onclick: () => { VS.tafrigh = true; App.render(); },
        }, [icon('check'), ' نقل ورقة قديمة — الضغطة تقلّب ✓ ← ✗ ← فارغ']),
      ]),
      App.canEdit() ? h('button.btn.btn-primary', { onclick: () => openBulkDrawer() }, [icon('bolt'), ' سداد جماعي لشهر كامل']) : null,
    ]);

    /* كشف بلا صفوف: العلامات بتتعلّم على صفوف الورقة — وجّه المستخدم بدل شبكة فارغة */
    const fb = F().b ? Store.building(F().b) : null;
    const emptyMatrix = !us.length
      ? h('div.card.mx-empty', [
          h('h3.empty-title', fb
            ? `مشروع «${fb.name}» لسه مفيهوش صفوف`
            : 'لا وحدات ضمن الترشيح الحالي'),
          h('p.empty-sub', fb
            ? 'علامات ✓/✗ بتتعلّم على صفوف الورقة (وحدة + عميل + عقد). أضف صفوف الورقة الأول، وبعدين ارجع هنا فرّغ العلامات.'
            : 'وسّع الترشيح من السلايسرز فوق، أو امسح البحث.'),
          fb && App.canEdit() ? h('button.btn.btn-primary', {
            onclick: () => { VS.wizardBid = fb.id; location.hash = '#intake'; },
          }, [icon('plus'), ` أضف صفوف مشروع «${fb.name}»`]) : null,
        ])
      : null;

    return h('div.view', [
      pageHead('جدول التحصيل', 'نفس جدول الورقة — وضعان: تسجيل دفعات موثَّقة، أو تفريغ سريع لعلامات ورقة.', [
        h('button.btn.btn-ghost', { onclick: () => exportMatrix(year) }, [icon('download'), ' تصدير CSV']),
      ]),
      demoBanner(),
      modeBar,
      VS.tafrigh && us.length ? h('div.banner.banner-info', [icon('check'),
        h('div', [h('b', 'وضع نقل الورقة شغّال: '), 'كل ضغطة على خلية تقلّبها ✓ ← ✗ ← فارغ. اترك ما سكتت عنه الورقة فارغًا، وعُد لوضع «تسجيل دفعات» للدفعات الموثَّقة.'])]) : null,
      emptyMatrix,
      us.length ? h('div.filter-row', [
        h('span.filter-label', 'السنة'),
        h('div.month-nav', [
          h('button.btn-icon', { onclick: () => { VS.matrixYear--; App.render(); }, 'aria-label': 'سنة أسبق' }, icon('right')),
          h('span.month-name', String(year)),
          h('button.btn-icon', { onclick: () => { VS.matrixYear++; App.render(); }, 'aria-label': 'سنة أحدث' }, icon('left')),
        ]),
        legend(),
      ]) : null,
      us.length ? h('div.matrix-wrap', h('table.matrix', [h('thead', head), h('tbody', [...bodyRows, totRow])])) : null,
    ]);
  }

  /* سداد جماعي: شهر كامل دفعة واحدة — للتشغيل على مئات الوحدات */
  function openBulkDrawer() {
    const asOf = Store.today();
    const cur = currentPeriod();
    const periods = [cur, Store.addMonths(cur, -1), Store.addMonths(cur, -2), Store.addMonths(cur, -3)];
    const pSel = select({}, periods.map(p => ({ value: p, label: Store.periodLabel(p, true) })), cur);
    const dateIn = input({ type: 'date', value: Store.iso(Store.today()) });
    const methodIn = select({}, ['نقدًا', 'إنستاباي', 'تحويل بنكي', 'شيك'].map(x => ({ value: x, label: x })), 'نقدًا');
    const listWrap = h('div');
    let checks = [];

    function buildList() {
      listWrap.innerHTML = '';
      checks = [];
      const p = pSel.value;
      for (const u of filteredUnits(asOf)) {
        const ci = Store.cellInfo(u.id, p, asOf);
        if (!['late', 'partial', 'due', 'unknown'].includes(ci.status) || !ci.due) continue;
        const remaining = Math.max(0, ci.due.amount - ci.paid);
        if (remaining <= 0) continue;
        const cb = h('input', { type: 'checkbox' });
        cb.checked = true;
        checks.push({ cb, unitId: u.id, period: p, amount: remaining });
        const tid = unitTenantIds(u).slice(-1)[0];
        listWrap.appendChild(h('label.bulk-row', [
          cb,
          h('span.bulk-name', `${u.name} — ${tid ? tenantLabel(tid) : '—'}`),
          h('span.bulk-amt', money(remaining, { bare: true })),
        ]));
      }
      if (!checks.length) listWrap.appendChild(emptyState('لا مستحقات غير مسدَّدة لهذا الشهر ضمن الترشيح'));
    }
    pSel.addEventListener('change', buildList);
    buildList();

    openDrawer('سداد جماعي — شهر كامل', [
      h('p.step-hint', 'حدِّد من سدَّدوا بالكامل واحفظ مرة واحدة — بدلًا من فتح كل خلية. الجزئي والاستثناءات تُسجَّل من خلاياها.'),
      h('div.form-grid', [
        field('الشهر', pSel),
        field('تاريخ السداد', dateIn),
        field('طريقة السداد', methodIn),
      ]),
      h('h4.drawer-sec', 'المستحق عليهم (المحدَّد = سيُسجَّل مدفوعًا بالكامل)'),
      listWrap,
    ], [
      h('button.btn.btn-primary', {
        onclick: () => {
          const recs = checks.filter(x => x.cb.checked).map(x => ({
            unitId: x.unitId, period: x.period, amount: x.amount,
            date: dateIn.value, method: methodIn.value,
          }));
          if (!recs.length) { toast('لم تحدد أي وحدة', 'warning'); return; }
          Store.addPaymentsBulk(recs);
          closeDrawer();
          toast(`سُجِّلت ${recs.length} دفعة — المؤشرات تحدَّثت`);
        },
      }, 'حفظ الدفعات المحددة'),
      h('button.btn.btn-ghost', { onclick: closeDrawer }, 'إلغاء'),
    ]);
  }

  /* درج تفاصيل خلية: الشهر × الوحدة */
  function openCellDrawer(u, period, asOf) {
    const ci = Store.cellInfo(u.id, period, asOf);
    const def = CELL_DEFS[ci.status] || CELL_DEFS.none;
    const c = ci.contract;
    const body = [];

    body.push(h('div.kv', [
      h('div.kv-row', [h('span.kv-k', 'الوحدة'), h('span.kv-v', `${u.name} — ${bLabel(u.buildingId)}`)]),
      h('div.kv-row', [h('span.kv-k', 'الشهر'), h('span.kv-v', Store.periodLabel(period, true))]),
      h('div.kv-row', [h('span.kv-k', 'الحالة'), statusChip(
        ci.status === 'paid' || ci.status === 'paid_imported' ? 'good'
          : ci.status === 'paid_late' || ci.status === 'partial' ? 'warning'
          : ci.status === 'late' ? 'critical'
          : ci.status === 'unknown' || ci.status === 'orphan_paid' ? 'unknown' : 'neutral',
        def.label)]),
    ]));

    if (c) {
      const segs = (c.years || []).map(y => {
        const f = Store.d(y.from) > Store.monthFirst(period) ? Store.d(y.from) : Store.monthFirst(period);
        const l = Store.d(y.to) < Store.monthLast(period) ? Store.d(y.to) : Store.monthLast(period);
        if (f > l) return null;
        return { y, days: Store.daysBetween(f, l) + 1 };
      }).filter(Boolean);
      body.push(h('div.kv', [
        h('div.kv-row', [h('span.kv-k', 'العميل'), h('span.kv-v', tenantLabel(c.tenantId))]),
        h('div.kv-row', [h('span.kv-k', 'العقد'), h('span.kv-v', `${shortDate(c.start)} ← ${shortDate(c.end)}`)]),
        h('div.kv-row', [h('span.kv-k', 'يوم الاستحقاق'), h('span.kv-v', String(c.dueDay || 1) + ' من الشهر')]),
        ci.due ? h('div.kv-row', [h('span.kv-k', 'مستحق الشهر'), h('span.kv-v', money(ci.due.amount, { approx: ci.due.estimated }))]) : null,
        ci.due && ci.due.maintenance ? h('div.kv-row', [h('span.kv-k', 'منها صيانة (البند الرابع)'), h('span.kv-v', money(ci.due.maintenance))]) : null,
        ci.due && ci.due.vat ? h('div.kv-row', [h('span.kv-k', 'منها ض.ق.م (البند العاشر)'), h('span.kv-v', money(ci.due.vat))]) : null,
      ]));
      if (segs.length > 1) body.push(h('p.note-line', [icon('warn'),
        ' هذا الشهر يقطع سنتَي عقد — محسوب باليوم: ',
        segs.map(sg => `${sg.days} يوم × ${money(sg.y.rent)}${sg.y.estimated ? ' (تقديري)' : ''}`).join(' + ')]));
      else if (ci.due && ci.due.estimated) body.push(h('p.note-line', [icon('question'),
        ' القيمة تقديرية (+10٪) — لم تُدوَّن في الكشف. راجع جودة البيانات.']));
      if (ci.due && !ci.due.fullMonth) body.push(h('p.note-line', [icon('clock'),
        ` العقد لا يغطي الشهر كاملًا (${ci.due.coveredDays} يومًا) — الاستحقاق محسوب باليوم.`]));
    } else {
      body.push(h('p.note-line.note-critical', [icon('warn'),
        ci.status === 'orphan_paid'
          ? ' سداد مسجّل بلا عقد — سجِّل العقد أولًا ليُحتسب الاستحقاق.'
          : ci.status === 'late'
            ? ' متأخر مؤكَّد (✗ في الكشف) لكن لا عقد مسجّل — القيمة غير معروفة.'
            : ' لا عقد يغطي هذا الشهر.']));
    }

    if (ci.mark) body.push(h('p.note-line', [icon(ci.mark.mark === 'paid' ? 'check' : 'x'),
      ` علامة الكشف الورقي: ${ci.mark.mark === 'paid' ? '✓ سداد' : '✗ عدم سداد'} — بلا مبلغ ولا تاريخ.`]));

    if (ci.payments.length) {
      body.push(h('h4.drawer-sec', 'الدفعات المسجَّلة'));
      body.push(h('table.table.table-mini', [
        h('thead', h('tr', [h('th', 'المبلغ'), h('th', 'التاريخ'), h('th', 'الطريقة'), h('th', 'إيصال'), h('th', '')])),
        h('tbody', ci.payments.map(p => h('tr', [
          h('td', money(p.amount, { bare: true })),
          h('td', shortDate(p.date)),
          h('td', p.method),
          h('td', p.receiptNo || '—'),
          h('td', h('button.btn-icon', {
            onclick: () => { if (confirm('حذف هذه الدفعة؟')) { Store.deletePayment(p.id); closeDrawer(); toast('حُذفت الدفعة'); } },
            'aria-label': 'حذف',
          }, icon('close'))),
        ]))),
      ]));
    }

    const remaining = ci.due ? Math.max(0, ci.due.amount - ci.paid) : null;
    const amountIn = input({ type: 'number', min: 0, step: 'any', value: remaining != null && remaining > 0 ? remaining : '' });
    const dateIn = input({ type: 'date', value: Store.iso(Store.today()) });
    const methodIn = select({}, [
      { value: 'نقدًا', label: 'نقدًا' }, { value: 'إنستاباي', label: 'إنستاباي' },
      { value: 'تحويل بنكي', label: 'تحويل بنكي' }, { value: 'شيك', label: 'شيك' },
    ], 'نقدًا');
    const receiptIn = input({ type: 'text', placeholder: 'اختياري' });
    const notesIn = input({ type: 'text', placeholder: 'اختياري' });

    body.push(h('h4.drawer-sec', ci.status === 'paid_imported' ? 'توثيق دفعة الكشف (مبلغ وتاريخ فعليان)' : 'تسجيل دفع'));
    body.push(h('div.form-grid', [
      field('المبلغ (ج.م)', amountIn, remaining != null ? `المتبقي: ${money(remaining)}` : 'المستحق غير محسوب — لا عقد'),
      field('تاريخ السداد', dateIn),
      field('طريقة السداد', methodIn),
      field('رقم الإيصال', receiptIn),
      field('ملاحظات', notesIn),
    ]));

    openDrawer(`${u.name} — ${Store.periodLabel(period, true)}`, body, [
      h('button.btn.btn-primary', {
        onclick: () => {
          const amt = Number(amountIn.value);
          if (!amt || amt <= 0) { toast('أدخل مبلغًا صحيحًا', 'warning'); return; }
          Store.addPayment({
            unitId: u.id, period, amount: amt, date: dateIn.value,
            method: methodIn.value, receiptNo: receiptIn.value, notes: notesIn.value,
          });
          closeDrawer();
          toast('سُجِّلت الدفعة — الحالة والمؤشرات تحدَّثت فورًا');
        },
      }, 'حفظ الدفعة'),
      h('button.btn.btn-ghost', { onclick: closeDrawer }, 'إلغاء'),
    ]);
  }

  function exportMatrix(year) {
    const periods = Array.from({ length: 12 }, (_, i) => year + '-' + String(i + 1).padStart(2, '0'));
    const rows = [['كود الوحدة', 'المشروع', 'الوحدة', 'كود العميل', 'العميل', ...periods.map(p => Store.periodLabel(p, true))]];
    const asOf = Store.today();
    for (const u of filteredUnits(asOf)) {
      const tid = unitTenantIds(u).slice(-1)[0];
      const t = tid ? Store.tenant(tid) : null;
      rows.push([u.code || '', bLabel(u.buildingId), u.name, (t && t.code) || '', tid ? tenantLabel(tid) : '—',
        ...periods.map(p => (CELL_DEFS[Store.cellInfo(u.id, p, asOf).status] || CELL_DEFS.none).label)]);
    }
    Store.download(`جدول-التحصيل-${year}.csv`, Store.toCSV(rows));
  }

  /* ========================================================
     3) الوحدات
     ======================================================== */
  function unitStatusChipOf(u, asOf) {
    const k = unitStatusKey(u, asOf);
    if (k === 'occupied') return statusChip('good', 'مؤجَّرة');
    if (k === 'ending') {
      const act = Store.activeContractOn(u.id, asOf);
      return statusChip('serious', `ينتهي خلال ${pluralDays(Store.daysBetween(asOf, Store.d(act.end)))}`);
    }
    if (k === 'ended') return statusChip('critical', 'عقد منتهٍ بلا تجديد');
    if (k === 'noContract') return statusChip('unknown', 'بلا عقد مسجّل');
    return statusChip('neutral', 'شاغرة');
  }

  function viewUnits() {
    const asOf = Store.today();
    const us = filteredUnits(asOf);
    const uset = new Set(us.map(u => u.id));
    const ar = Store.arrears(asOf, uset);

    const sections = [];
    for (const b of Store.state.buildings) {
      const bus = us.filter(u => u.buildingId === b.id);
      if (!bus.length) continue;
      sections.push(h('div.bsec-head', [
        h('h3.bsec-title', b.name),
        b.demo ? h('span.chip.chip-neutral', 'تجريبي') : h('span.chip.chip-unknown', 'مشروع فعلي'),
        h('span.bsec-area', b.area),
      ]));
      sections.push(h('div.cards-grid', bus.map(u => {
        const act = Store.activeContractOn(u.id, asOf);
        const last = act || Store.unitContracts(u.id).slice(-1)[0] || null;
        const unitArrears = ar.rows.filter(r => r.unitId === u.id).reduce((s, r) => s + r.amount, 0);
        const unknownArr = ar.unknowns.filter(r => r.unitId === u.id).length;
        const issues = Store.state.issues.filter(q => q.status === 'open' &&
          ((q.refType === 'unit' && q.refId === u.id) ||
           (q.refType === 'contract' && q.refId && (Store.contract(q.refId) || {}).unitId === u.id)));
        let rentNow = null;
        if (act) {
          const y = act.years.find(y => Store.d(y.from) <= asOf && asOf <= Store.d(y.to)) || act.years[act.years.length - 1];
          rentNow = y ? { v: y.rent, est: y.estimated } : null;
        }
        return keyClickable(h('div.card.unit-card', { onclick: () => openUnitDrawer(u) }, [
          h('div.unit-head', [h('h3.unit-name', u.name), unitStatusChipOf(u, asOf)]),
          h('div.unit-meta', [
            u.code ? h('code.code-chip', u.code) : null,
            h('span.chip.chip-neutral', u.type),
            u.floor ? h('span.chip.chip-neutral', u.floor) : null,
            u.area ? h('span.chip.chip-neutral', u.area + ' م²') : null,
          ]),
          last ? h('div.unit-tenant-line', tenantLabel(last.tenantId)) : null,
          h('div.unit-facts', [
            rentNow ? h('div.fact', [h('span.fact-k', 'الإيجار الحالي'), h('span.fact-v', money(rentNow.v, { approx: rentNow.est }))]) : null,
            last ? h('div.fact', [h('span.fact-k', 'العقد'), h('span.fact-v', `${shortDate(last.start)} ← ${shortDate(last.end)}`)]) : null,
            unitArrears > 0 ? h('div.fact', [h('span.fact-k', 'متأخرات'), h('span.fact-v.val-critical', money(unitArrears))]) : null,
            unknownArr ? h('div.fact', [h('span.fact-k', 'متأخرات مجهولة'), h('span.fact-v.val-critical', pluralMonths(unknownArr))]) : null,
            ...(function () {
              // وحدة مش داخلة فلوس: منذ متى شاغرة وحجم خسارتها
              if (Store.unitIsEarning(u, Store.periodOf(asOf), asOf)) return [];
              const vrow = Store.vacancyInfo(asOf, new Set([u.id])).rows[0];
              if (!vrow) return [];
              return [
                vrow.months != null ? h('div.fact', [h('span.fact-k', 'شاغرة منذ'), h('span.fact-v.val-warning', pluralMonths(Math.round(vrow.months)))]) : null,
                vrow.estMonthly != null ? h('div.fact', [h('span.fact-k', 'خسارة شهرية تقديرية'), h('span.fact-v.val-critical', '≈' + money(vrow.estMonthly))]) : null,
                vrow.src ? h('div.fact', [h('span.fact-k', 'أساس الحساب'), h('span.fact-v', vrow.src)]) : null,
                vrow.accumLoss ? h('div.fact', [h('span.fact-k', 'إجمالي الفاقد حتى الآن'), h('span.fact-v.val-critical', '≈' + money(vrow.accumLoss))]) : null,
              ];
            })(),
          ]),
          issues.length ? h('div.unit-flags', [icon('warn'), ` ${issues.length} ملاحظة جودة مفتوحة`]) : null,
        ]));
      })));
    }

    return h('div.view', [
      pageHead('الوحدات', 'الحالة محسوبة من العقود، لا تُكتب يدويًا.', [
        App.canEdit() ? h('button.btn.btn-primary', { onclick: openAddUnit }, [icon('plus'), ' وحدة جديدة']) : null,
      ]),
      demoBanner(),
      sections.length ? h('div', sections) : emptyState('لا وحدات ضمن الترشيح'),
    ]);
  }

  function openUnitDrawer(u) {
    const cs = Store.unitContracts(u.id);
    const body = [];
    body.push(h('div.kv', [
      u.code ? h('div.kv-row', [h('span.kv-k', 'كود الوحدة'), h('span.kv-v', h('code.code-chip', u.code))]) : null,
      h('div.kv-row', [h('span.kv-k', 'المبنى'), h('span.kv-v', bLabel(u.buildingId))]),
      h('div.kv-row', [h('span.kv-k', 'النوع'), h('span.kv-v', u.type + (u.floor ? ' — ' + u.floor : ''))]),
      u.area ? h('div.kv-row', [h('span.kv-k', 'المساحة'), h('span.kv-v', u.area + ' م²')]) : null,
      u.note ? h('div.kv-row', [h('span.kv-k', 'ملاحظة'), h('span.kv-v', u.note)]) : null,
    ]));
    body.push(h('h4.drawer-sec', 'سلسلة العقود'));
    if (!cs.length) body.push(emptyState('لا عقود مسجَّلة', 'سجّل العقد ليبدأ حساب الاستحقاق'));
    else body.push(h('div.contract-chain', cs.map(c => h('div.chain-item', [
      h('div.chain-head', [
        h('b', tenantLabel(c.tenantId)),
        c.prevId ? h('span.chip.chip-neutral', 'تجديد') : null,
        c.source === 'imported' ? h('span.chip.chip-unknown', 'من الكشف') : null,
      ]),
      h('div.chain-span', `${shortDate(c.start)} ← ${shortDate(c.end)} · الاستحقاق يوم ${c.dueDay || 1}`
        + (c.maintenance ? ` · صيانة ${money(c.maintenance, { bare: true })}` : '')
        + (c.vat ? ' · خاضع لض.ق.م' : '')),
      h('table.table.table-mini', [
        h('thead', h('tr', [h('th', 'سنة العقد'), h('th', 'من'), h('th', 'إلى'), h('th', 'القيمة')])),
        h('tbody', c.years.map((y, i) => h('tr', [
          h('td', String(i + 1)), h('td', shortDate(y.from)), h('td', shortDate(y.to)),
          h('td', money(y.rent, { approx: y.estimated })),
        ]))),
      ]),
      c.deposit ? h('p.note-line', [icon('check'), ` تأمين محتجز: ${money(c.deposit.amount)}${c.deposit.note ? ' — ' + c.deposit.note : ''}`]) : null,
      App.canEdit() ? h('button.btn.btn-ghost.btn-sm', { onclick: () => { closeDrawer(); openEditContract(c); } }, 'تعديل هذا العقد') : null,
    ]))));
    const issues = Store.state.issues.filter(q => q.status === 'open' &&
      ((q.refType === 'unit' && q.refId === u.id) ||
       (q.refType === 'contract' && q.refId && (Store.contract(q.refId) || {}).unitId === u.id)));
    if (issues.length) {
      body.push(h('h4.drawer-sec', 'ملاحظات الجودة'));
      body.push(h('ul.issue-mini', issues.map(q => h('li', [severityChip(q.severity), ' ', q.title]))));
    }
    openDrawer(u.name + ' — ' + bLabel(u.buildingId), body, [
      App.canEdit() ? h('button.btn.btn-primary', { onclick: () => { closeDrawer(); openAddContract(u.id); } }, [icon('plus'), ' عقد جديد لهذه الوحدة']) : null,
      App.canEdit() ? h('button.btn.btn-ghost', { onclick: () => { closeDrawer(); openEditUnit(u); } }, 'تعديل بيانات الوحدة') : null,
      h('button.btn.btn-ghost', { onclick: closeDrawer }, 'إغلاق'),
    ]);
  }

  function openEditUnit(u) { openAddUnit(u); }

  function openAddUnit(editU) {
    const types = [...new Set([...Store.state.units.map(x => x.type), 'محل', 'مكتب', 'شقة', 'جراج', 'مخزن', 'غير محدد'])].filter(Boolean);
    const bIn = select({}, Store.state.buildings.map(b => ({ value: b.id, label: (b.code ? b.code + ' · ' : '') + b.name })),
      editU ? editU.buildingId : (F().b || Store.state.buildings[0].id));
    const nameIn = input({ type: 'text', placeholder: 'مثال: محل 3', value: editU ? editU.name : '' });
    const typeIn = select({}, types.map(x => ({ value: x, label: x })), editU ? editU.type : 'محل');
    const floorIn = input({ type: 'text', placeholder: 'أرضي / الأول / …', value: editU ? (editU.floor || '') : '' });
    const areaIn = input({ type: 'number', min: 0, placeholder: 'م² — اختياري', value: editU && editU.area ? editU.area : '' });
    const noteIn = input({ type: 'text', placeholder: 'اختياري', value: editU ? (editU.note || '') : '' });
    if (editU) bIn.disabled = true;
    openDrawer(editU ? 'تعديل بيانات الوحدة' : 'وحدة جديدة', [
      editU ? h('p.field-hint', ['كود الوحدة ', h('code.code-chip', editU.code || '—'),
        ' ثابت لا يتغير — والمشروع لا يُنقَل إليه العقود والدفعات المرتبطة.']) : null,
      h('div.form-grid', [
        field('المشروع', bIn), field('اسم الوحدة', nameIn), field('النوع', typeIn),
        field('الدور', floorIn), field('المساحة', areaIn), field('ملاحظة', noteIn),
      ]),
    ], [
      h('button.btn.btn-primary', {
        onclick: () => {
          if (!nameIn.value.trim()) { toast('أدخل اسم الوحدة', 'warning'); return; }
          const patch = { name: nameIn.value.trim(), type: typeIn.value, floor: floorIn.value.trim(), area: Number(areaIn.value) || null, note: noteIn.value };
          if (editU) { Store.updateUnit(editU.id, patch); closeDrawer(); toast('حُفظ تعديل الوحدة'); }
          else { Store.addUnit({ buildingId: bIn.value, ...patch }); closeDrawer(); toast('أُضيفت الوحدة'); }
        },
      }, editU ? 'حفظ التعديل' : 'حفظ'),
      h('button.btn.btn-ghost', { onclick: closeDrawer }, 'إلغاء'),
    ]);
  }

  function openEditBuilding(b) {
    const nameIn = input({ type: 'text', value: b.name });
    const ownerIn = input({ type: 'text', value: b.owner || '', placeholder: 'اسم المالك كما في الورقة' });
    const areaIn = input({ type: 'text', value: b.area || '', placeholder: 'المنطقة / العنوان' });
    const noteIn = input({ type: 'text', value: b.note || '', placeholder: 'اختياري' });
    openDrawer('تعديل بيانات المشروع', [
      h('p.field-hint', ['كود المشروع ', h('code.code-chip', b.code || '—'), ' ثابت لا يتغير.']),
      h('div.form-grid', [
        field('اسم المشروع', nameIn), field('المالك', ownerIn),
        field('المنطقة', areaIn), field('ملاحظة', noteIn),
      ]),
    ], [
      h('button.btn.btn-primary', {
        onclick: () => {
          if (!nameIn.value.trim()) { toast('أدخل اسم المشروع', 'warning'); return; }
          Store.updateBuilding(b.id, { name: nameIn.value.trim(), owner: ownerIn.value.trim(), area: areaIn.value.trim(), note: noteIn.value.trim() });
          closeDrawer(); toast('حُفظ تعديل المشروع');
        },
      }, 'حفظ التعديل'),
      h('button.btn.btn-ghost', { onclick: closeDrawer }, 'إلغاء'),
    ]);
  }

  /* ========================================================
     4) العقود (+ جانت)
     ======================================================== */
  function contractStatusChip(c, asOf) {
    if (Store.d(c.start) > asOf) return statusChip('neutral', 'مستقبلي');
    if (Store.d(c.end) < asOf) {
      return Store.nextContract(c) ? statusChip('neutral', 'منتهٍ — مُجدَّد') : statusChip('critical', 'منتهٍ بلا تجديد');
    }
    const left = Store.daysBetween(asOf, Store.d(c.end));
    if (left <= 90) return statusChip('serious', `ينتهي خلال ${pluralDays(left)}`);
    return statusChip('good', 'نشط');
  }
  function contractGanttStatus(c, asOf) {
    if (Store.d(c.start) > asOf) return 'future';
    if (Store.d(c.end) < asOf) return Store.nextContract(c) ? 'renewed' : 'ended';
    return Store.daysBetween(asOf, Store.d(c.end)) <= 90 ? 'soon' : 'active';
  }

  function viewContracts() {
    const asOf = Store.today();
    const us = filteredUnits(asOf);
    const withCs = us.map(u => ({ u, cs: Store.unitContracts(u.id) })).filter(x => x.cs.length);
    const STATUS_TXT = { active: 'ساري', soon: 'ينتهي قريبًا', ended: 'منتهٍ بلا تجديد', renewed: 'منتهٍ — مُجدَّد', future: 'مستقبلي' };
    function rentLabelOf(c) {
      const y = c.years.find(yy => Store.d(yy.from) <= asOf && asOf <= Store.d(yy.to)) || c.years[c.years.length - 1];
      if (!y) return '';
      const monthly = Store.state.settings.rentBasis === 'annual' ? y.rent / 12 : y.rent;
      return UI.compact(monthly) + '/ش';
    }
    const ganttRows = withCs.map(x => {
      const bars = x.cs.map(c => {
        const st = contractGanttStatus(c, asOf);
        const months = Math.round(Store.daysBetween(Store.d(c.start), Store.d(c.end)) / 30.4);
        return {
          start: c.start, end: c.end, status: st, unitId: x.u.id,
          rentLabel: rentLabelOf(c),
          tip: `<b>${x.u.name}</b> — ${tenantLabel(c.tenantId)}<br>` +
               `${shortDate(c.start)} ← ${shortDate(c.end)} (${pluralMonths(months)})<br>` +
               `${STATUS_TXT[st]}${rentLabelOf(c) ? ' · ' + rentLabelOf(c) + 'هر' : ''}` +
               '<br><i>اضغط لفتح ملف الوحدة</i>',
        };
      });
      // مفتاح الانتباه: المنتهي بلا تجديد أولًا، ثم الأقرب انتهاءً
      const key = Math.min(...bars.map(b =>
        b.status === 'ended' ? 0
        : b.status === 'soon' ? 1 + Store.daysBetween(asOf, Store.d(b.end)) / 1000
        : b.status === 'active' ? 2 + Store.daysBetween(asOf, Store.d(b.end)) / 10000
        : 9));
      return { label: x.u.name, sub: tenantLabel(x.cs[x.cs.length - 1].tenantId), bars, key };
    }).sort((a, b) => a.key - b.key);
    const gCounts = { active: 0, soon: 0, ended: 0 };
    withCs.forEach(x => x.cs.forEach(c => {
      const st = contractGanttStatus(c, asOf);
      if (gCounts[st] != null) gCounts[st]++;
    }));

    const sorted = withCs.flatMap(x => x.cs).sort((a, b) => a.end < b.end ? -1 : 1);
    const rows = sorted.map(c => {
      const y = c.years.find(y => Store.d(y.from) <= asOf && asOf <= Store.d(y.to));
      return keyClickable(h('tr.row-click', { onclick: () => openUnitDrawer(Store.unit(c.unitId)) }, [
        h('td', bLabel(Store.unit(c.unitId).buildingId)),
        h('td', unitLabel(c.unitId)),
        h('td', tenantLabel(c.tenantId)),
        h('td', shortDate(c.start)),
        h('td', shortDate(c.end)),
        h('td', y ? money(y.rent, { approx: y.estimated }) : '—'),
        h('td', c.maintenance ? money(c.maintenance, { bare: true }) : '—'),
        h('td', c.deposit ? money(c.deposit.amount, { bare: true }) : '—'),
        h('td', contractStatusChip(c, asOf)),
        h('td', c.prevId ? 'تجديد' : '—'),
        h('td', App.canEdit() ? h('button.btn.btn-ghost.btn-sm', {
          onclick: e => { e.stopPropagation(); openEditContract(c); },
        }, 'تعديل') : '—'),
      ]));
    });

    return h('div.view', [
      pageHead('العقود', 'التجديد عقد جديد مربوط بسابقه — لا تعديل على القديم، فيبقى التاريخ كاملًا.', [
        h('button.btn.btn-ghost', { onclick: exportContracts }, [icon('download'), ' تصدير CSV']),
        App.canEdit() ? h('button.btn.btn-primary', { onclick: () => openAddContract() }, [icon('plus'), ' عقد جديد']) : null,
      ]),
      basisBanner(),
      demoBanner(),
      ganttRows.length ? sectionCard('الخط الزمني للعقود', h('div', [
        h('div.gantt-summary', [
          statusChip('good', `ساري ${gCounts.active}`),
          statusChip('serious', `ينتهي خلال 90 يوم ${gCounts.soon}`),
          statusChip('critical', `منتهٍ بلا تجديد ${gCounts.ended}`),
          h('span.gantt-hint', 'مرتَّب بالأولوية: ما يحتاج قرارًا أولًا — القيمة داخل الشريط إيجار شهري'),
          ganttRows.length > 8 ? h('button.btn.btn-ghost', {
            onclick: () => { VS.ganttAll = !VS.ganttAll; App.render(); },
          }, VS.ganttAll ? 'عرض المختصر (الأهم فقط)' : `عرض كل الوحدات (${ganttRows.length})`) : null,
        ]),
        h('div.gantt-scroll', Charts.ganttChart(VS.ganttAll ? ganttRows : ganttRows.slice(0, 8), Store.iso(asOf), {
          onBarClick: b => openUnitDrawer(Store.unit(b.unitId)),
        })),
        !VS.ganttAll && ganttRows.length > 8 ? h('p.note-line', `معروض أهم 8 وحدات من ${ganttRows.length} — الباقي ساري ومستقر، اعرضه بالزر أعلاه.`) : null,
        h('div.legend.legend-block', [
          h('span.legend-item', [h('span.legend-swatch.gl-active'), h('span', 'ساري')]),
          h('span.legend-item', [h('span.legend-swatch.gl-soon'), h('span', 'ينتهي خلال 90 يوم')]),
          h('span.legend-item', [h('span.legend-swatch.gl-ended'), h('span', 'منتهٍ بلا تجديد')]),
          h('span.legend-item', [h('span.legend-swatch.gl-renewed'), h('span', 'منتهٍ — مُجدَّد (باهت)')]),
          h('span.legend-item', [h('span.legend-swatch.gl-future'), h('span', 'مستقبلي')]),
        ]),
      ])) : null,
      h('div.table-wrap', h('table.table', [
        h('thead', h('tr', [h('th', 'المبنى'), h('th', 'الوحدة'), h('th', 'العميل'), h('th', 'من'), h('th', 'إلى'),
          h('th', 'قيمة السنة الجارية'), h('th', 'صيانة'), h('th', 'التأمين'), h('th', 'الحالة'), h('th', 'النوع'), h('th', '')])),
        h('tbody', rows.length ? rows : h('tr', h('td', { colspan: 11 }, emptyState('لا عقود ضمن الترشيح')))),
      ])),
    ]);
  }

  function exportContracts() {
    // أعمدة السنوات تتمدد لأطول عقد فعلي — العقود تصل إلى عشر سنوات
    const maxY = Store.state.contracts.reduce((m, c) => Math.max(m, (c.years || []).length), 1);
    const yCols = Array.from({ length: maxY }, (_, i) => 'سنة ' + (i + 1));
    const rows = [['كود المشروع', 'المشروع', 'كود الوحدة', 'الوحدة', 'كود العميل', 'العميل', 'من', 'إلى',
      ...yCols, 'صيانة شهرية', 'ض.ق.م', 'التأمين', 'تجديد']];
    for (const c of Store.state.contracts) {
      const u = Store.unit(c.unitId);
      const b = Store.building(u.buildingId) || {};
      const t = Store.tenant(c.tenantId) || {};
      rows.push([b.code || '', b.name || '', u.code || '', u.name, t.code || '', tenantLabel(c.tenantId), c.start, c.end,
        ...Array.from({ length: maxY }, (_, i) => (c.years[i] ? c.years[i].rent : '')),
        c.maintenance || '', c.vat ? 'نعم' : 'لا', c.deposit ? c.deposit.amount : '', c.prevId ? 'نعم' : 'لا']);
    }
    Store.download('العقود.csv', Store.toCSV(rows));
  }

  /* معالج العقد — إنشاء أو تعديل. الترتيب الطبيعي للمكتب: العميل ← التواريخ ← المشروع ← وحدة متاحة */
  function openEditContract(c) { openAddContract(c.unitId, c.tenantId, c); }

  function openAddContract(presetUnitId, presetTenantId, editC) {
    const s = Store.state.settings;
    const presetU = presetUnitId ? Store.unit(presetUnitId) : null;
    const presetT = presetTenantId ? Store.tenant(presetTenantId) : null;
    const startIn = input({ type: 'date', value: editC ? editC.start : Store.iso(Store.today()) });

    /* 1) العميل — بحث بالاسم أو الكود، أو تسجيل عميل جديد في نفس الخطوة */
    let tenantVal = presetT ? presetT.id : '';
    const ntName = input({ type: 'text', placeholder: 'الاسم كما في البطاقة أو السجل' });
    const ntCode = input({ type: 'text', inputmode: 'numeric', placeholder: 'الرقم القومي (14 رقمًا) — أو السجل التجاري للشركات' });
    const ntPhone = input({ type: 'tel', placeholder: '01xxxxxxxxx' });
    const newTenantBox = h('div.new-client-box', { style: { display: 'none' } }, [
      field('اسم العميل الجديد', ntName),
      field('كود العميل — الرقم القومي', ntCode, 'هو ما ستبحث به عن العميل لاحقًا في أي شاشة'),
      field('هاتف العميل', ntPhone),
    ]);
    const tenantIn = UI.combo({
      placeholder: 'ابحث بالاسم أو الرقم القومي…',
      items: [
        { value: '__new', label: '+ عميل جديد…' },
        ...[...Store.state.tenants].sort((a, b) => a.name.localeCompare(b.name, 'ar'))
          .map(t => ({ value: t.id, label: t.name + (t.code ? ' · ' + t.code : '') })),
      ],
      value: tenantVal,
      onPick: v => { tenantVal = v; newTenantBox.style.display = v === '__new' ? '' : 'none'; },
    });

    /* 2) المشروع ← 3) الوحدة: القائمة تعرض ما هو متاح فعلًا في مدة العقد المطلوبة */
    const projIn = select({}, Store.state.buildings.map(b => ({
      value: b.id, label: (b.code ? b.code + ' · ' : '') + b.name + (b.demo ? ' · تجريبي' : ''),
    })), presetU ? presetU.buildingId : (F().b || Store.state.buildings[0].id));
    const unitIn = h('select.input');
    const unitHint = h('p.field-hint');
    const showAllChk = h('input', { type: 'checkbox' });

    /* نهاية المدة المطلوبة = البداية + عدد السنوات − يوم (نفس حساب Store.addContract) */
    function termEnd(startIso, nYears) {
      const [y, m, dd] = startIso.split('-').map(Number);
      const e = new Date(Date.UTC(y + (Number(nYears) || 1), m - 1, dd));
      e.setUTCDate(e.getUTCDate() - 1);
      return e.toISOString().slice(0, 10);
    }
    /* التعارض تداخل مدتين لا مجرد «انتهى بعد كذا» — عقد مستقبلي يشغل الوحدة أيضًا.
       وفي وضع التعديل لا يتعارض العقد مع نفسه بالطبع */
    function clashingContract(u, startIso, nYears) {
      const to = termEnd(startIso, nYears);
      return Store.unitContracts(u.id).find(c => (!editC || c.id !== editC.id) && c.start <= to && c.end >= startIso) || null;
    }
    /* عميل ساكن بلا عقد مسجَّل: الوحدة ليست شاغرة حقيقة (سكرية، جراج الهدم) */
    function sittingClient(u) {
      return unitStatusKey(u, Store.today()) === 'noContract' ? (ORPHAN_TENANT[u.id] ? Store.tenant(ORPHAN_TENANT[u.id]) : null) || true : null;
    }
    const isFree = (u, st, ny) => !clashingContract(u, st, ny) && !sittingClient(u);
    if (editC || (presetU && !isFree(presetU, Store.iso(Store.today()), 1))) showAllChk.checked = true;

    let presetApplied = false;
    function refreshUnits() {
      const bid = projIn.value, st = startIn.value || Store.iso(Store.today()), ny = yearsIn.value;
      const all = Store.state.units.filter(u => u.buildingId === bid);
      const free = all.filter(u => isFree(u, st, ny));
      const list = showAllChk.checked ? all : free;
      const keep = unitIn.value;
      unitIn.innerHTML = '';
      for (const u of list) {
        const clash = clashingContract(u, st, ny);
        const sitting = !clash && sittingClient(u);
        unitIn.appendChild(h('option', { value: u.id },
          (u.code ? u.code + ' · ' : '') + u.name
          + (clash ? ' — عليها عقد حتى ' + shortDate(clash.end) : '')
          + (sitting ? ' — عليها عميل بلا عقد مسجَّل' : '')));
      }
      // الوحدة المُمرَّرة تُطبَّق أول مرة فقط — بعدها اختيار المستخدم هو صاحب القرار
      const want = (!presetApplied && presetUnitId) ? presetUnitId : keep;
      let lost = null;
      if (list.some(u => u.id === want)) unitIn.value = want;
      else if (keep) lost = Store.unit(keep);
      presetApplied = true;

      unitHint.textContent = !all.length
        ? 'لا وحدات مسجَّلة في هذا المشروع — أضِفها من شاشة الوحدات أولًا'
        : showAllChk.checked
          ? `كل وحدات المشروع (${all.length}) — غير المتاحة معلَّم سببها بجوار اسمها`
          : (free.length
            ? `${free.length} من ${all.length} وحدة متاحة في المدة المطلوبة`
            : 'لا وحدة متاحة في هذا المشروع بهذه المدة — علِّم «أظهر أيضًا الوحدات المشغولة» إن كان تجديدًا');
      if (lost) toast(`«${lost.name}» لم تعد متاحة بهذه المدة — اختر وحدة أخرى`, 'warning');
      refreshPreview();
    }
    projIn.addEventListener('change', refreshUnits);
    showAllChk.addEventListener('change', refreshUnits);
    startIn.addEventListener('input', refreshUnits);
    const yearsIn = select({}, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => ({
      value: String(n), label: n === 1 ? 'سنة واحدة' : n === 2 ? 'سنتان' : n + (n <= 10 ? ' سنوات' : ' سنة'),
    })), '1');
    const rentIn = input({ type: 'number', min: 0, step: 'any', placeholder: s.rentBasis === 'monthly' ? 'الإيجار الشهري للسنة الأولى' : 'الإيجار السنوي للسنة الأولى' });
    const incIn = input({ type: 'number', min: 0, max: 100, step: 'any', value: s.defaultIncreasePct });
    const dueDayIn = input({ type: 'number', min: 1, max: 28, value: 1 });
    const mntIn = input({ type: 'number', min: 0, step: 'any', placeholder: 'البند الرابع — اختياري' });
    const vatIn = h('input', { type: 'checkbox' });
    const depIn = input({ type: 'number', min: 0, step: 'any', placeholder: 'اختياري' });
    const preview = h('div.years-preview');
    const rentField = field('قيمة السنة الأولى', rentIn, 'أساس الحساب الحالي: ' + (s.rentBasis === 'monthly' ? 'شهري' : 'سنوي'));
    const incField = field('نسبة الزيادة السنوية ٪', incIn, 'النمط الملاحظ في عقودكم: 10٪');

    /* طريقتان لقيم السنوات — يختار المستخدم واحدة صراحةً:
       (أ) زيادة سنوية بنسبة: يكتب قيمة السنة الأولى والنسبة فتُولَّد الباقي.
       (ب) قيمة كل سنة يدويًا: خانة لكل سنة بعدد السنوات المختارة فوق. */
    let yearVals = [];
    const manualBox = h('div.manual-years');
    const modeIncRadio = h('input', { type: 'radio', name: 'rentmode', value: 'inc', checked: true });
    const modeManRadio = h('input', { type: 'radio', name: 'rentmode', value: 'manual' });
    const isManual = () => modeManRadio.checked;

    function manualInputs() { return [...manualBox.querySelectorAll('input')]; }
    function syncManualBox() {
      const n = Number(yearsIn.value) || 1;
      const old = manualInputs().map(x => x.value);
      manualBox.innerHTML = '';
      for (let i = 0; i < n; i++) {
        const el = input({ type: 'number', min: 0, step: 'any', value: old[i] != null ? old[i] : '',
          placeholder: 'قيمة السنة ' + (i + 1), 'aria-label': 'قيمة السنة ' + (i + 1) });
        el.addEventListener('input', refreshPreview);
        manualBox.appendChild(field('قيمة السنة ' + (i + 1), el));
      }
    }
    function applyMode() {
      const man = isManual();
      manualBox.style.display = man ? '' : 'none';
      rentField.style.display = man ? 'none' : '';
      incField.style.display = man ? 'none' : '';
      if (man) syncManualBox();
      refreshPreview();
    }
    modeIncRadio.addEventListener('change', applyMode);
    modeManRadio.addEventListener('change', applyMode);

    function recalcYears() {
      const n = Number(yearsIn.value) || 1;
      if (isManual()) {
        yearVals = manualInputs().slice(0, n).map(x => Number(x.value) || 0);
        while (yearVals.length < n) yearVals.push(0);
      } else {
        const r0 = Number(rentIn.value) || 0, inc = Number(incIn.value) / 100;
        yearVals = [];
        for (let i = 0; i < n; i++) yearVals.push(i === 0 ? r0 : Math.round(yearVals[i - 1] * (1 + inc)));
      }
    }

    function refreshPreview() {
      preview.innerHTML = '';
      recalcYears();
      if (!yearVals[0]) {
        preview.appendChild(h('p.field-hint', isManual()
          ? 'اكتب قيمة كل سنة في الخانات أعلاه ليظهر الجدول.'
          : 'أدخل قيمة السنة الأولى لتوليد الجدول.'));
        return;
      }
      preview.appendChild(h('table.table.table-mini.years-table', [
        h('thead', h('tr', [h('th', 'السنة'), h('th', 'القيمة (' + (s.rentBasis === 'monthly' ? 'شهري' : 'سنوي') + ')'), h('th', 'مصدرها')])),
        h('tbody', yearVals.map((v, i) => h('tr' + (isManual() ? '.yr-manual' : ''), [
          h('td', 'سنة ' + (i + 1)),
          h('td', v ? money(v) : h('span.val-warning', 'غير مكتوبة')),
          h('td', isManual()
            ? h('span.chip.chip-warning', 'قيمة مكتوبة')
            : (i === 0 ? h('span.mut', 'قيمة السنة الأولى') : h('span.mut', 'بزيادة ' + (Number(incIn.value) || 0) + '٪'))),
        ]))),
      ]));
      const uid = unitIn.value, st = startIn.value;
      const uSel = uid ? Store.unit(uid) : null;
      if (st && uSel) {
        const clash = clashingContract(uSel, st, yearsIn.value);
        if (clash)
          preview.appendChild(h('p.note-line.note-critical', [icon('warn'),
            ` تنبيه: على الوحدة عقد من ${shortDate(clash.start)} إلى ${shortDate(clash.end)} يتداخل مع هذه المدة — إن كان تجديدًا فابدأ من اليوم التالي لانتهائه.`]));
        else {
          const sit = sittingClient(uSel);
          if (sit) preview.appendChild(h('p.note-line.note-critical', [icon('warn'),
            ` تنبيه: الوحدة مشغولة بعميل يسدِّد بلا عقد مسجَّل${sit && sit.name ? ' (' + sit.name + ')' : ''} — سجِّل عقده أو تأكد من إخلائها.`]));
        }
      }
    }
    [rentIn, incIn].forEach(el => el.addEventListener('input', refreshPreview));
    yearsIn.addEventListener('change', () => { if (isManual()) syncManualBox(); refreshUnits(); });
    unitIn.addEventListener('change', refreshPreview);

    /* وضع التعديل: نملأ الفورم من العقد القائم قبل أول رسم */
    if (editC) {
      yearsIn.value = String((editC.years || []).length || 1);
      dueDayIn.value = editC.dueDay || 1;
      mntIn.value = editC.maintenance || '';
      vatIn.checked = !!editC.vat;
      depIn.value = editC.deposit ? editC.deposit.amount : '';
      // القيم المسجَّلة تُعرض كما هي: وضع «أكتب قيمة كل سنة» هو الأمين لعقد قائم
      modeManRadio.checked = true;
      syncManualBox();
      manualInputs().forEach((el, i) => { el.value = editC.years[i] ? editC.years[i].rent : ''; });
      rentIn.value = editC.years[0] ? editC.years[0].rent : '';
    }
    applyMode();
    refreshUnits();

    openDrawer(editC ? 'تعديل العقد' : 'عقد جديد', [
      h('div.form-grid', [
        field('العميل', tenantIn, 'اكتب حرفين من الاسم أو أرقامًا من الكود'),
        newTenantBox,
        field('تاريخ البداية', startIn, 'النهاية تُحسب تلقائيًا — والمدة هي التي تحدد الوحدات المتاحة أدناه'),
        field('عدد السنوات', yearsIn),
        field('المشروع', projIn),
        field('الوحدة', unitIn), unitHint,
        h('label.radio-row', [showAllChk, h('span', 'أظهر أيضًا الوحدات المشغولة')]),
        h('p.field-hint', 'القائمة أعلاه تعرض الوحدات المتاحة في المدة المطلوبة فقط. علِّم هذا الخيار إن كنت تريد الاختيار من كل وحدات المشروع — مع سبب انشغال كل وحدة بجوار اسمها.'),
        h('div.mode-box', [
          h('div.mode-title', 'كيف تُحسب قيمة كل سنة؟'),
          h('label.radio-row', [modeIncRadio, h('span', 'زيادة سنوية بنسبة — أكتب قيمة السنة الأولى والنسبة، والباقي يُحسب')]),
          h('label.radio-row', [modeManRadio, h('span', 'أكتب قيمة كل سنة بنفسي — تظهر خانة لكل سنة بعدد سنوات العقد')]),
        ]),
        rentField,
        incField,
        manualBox,
        field('يوم الاستحقاق في الشهر', dueDayIn, 'التأخير يُحسب من هذا اليوم'),
        field('الصيانة الشهرية (ج.م)', mntIn, 'تُضاف للاستحقاق الشهري تلقائيًا'),
        h('label.radio-row', [vatIn, h('span', 'خاضع لضريبة القيمة المضافة (تُضاف للاستحقاق)')]),
        field('التأمين (ج.م)', depIn),
      ]),
      h('h4.drawer-sec', 'جدول السنوات المتولَّد'),
      preview,
    ], [
      h('button.btn.btn-primary', {
        onclick: () => {
          if (!tenantVal) { toast('اختر العميل أولًا — أو سجِّل عميلًا جديدًا من نفس القائمة', 'warning'); return; }
          if (!unitIn.value) { toast('اختر الوحدة — غيِّر المشروع أو علِّم «أظهر أيضًا الوحدات المشغولة»', 'warning'); return; }
          if (!startIn.value) { toast('أدخل تاريخ بداية العقد', 'warning'); return; }
          if (Number(depIn.value) < 0 || Number(mntIn.value) < 0 || Number(incIn.value) < 0) { toast('لا تُقبل قيم سالبة', 'warning'); return; }
          // عقدان متداخلان على وحدة واحدة يجعلان أشهر التداخل تُحسب على الأقدم وحده — نمنعه صراحةً
          const uSel = Store.unit(unitIn.value);
          const clash = uSel ? clashingContract(uSel, startIn.value, yearsIn.value) : null;
          if (clash) {
            const dayAfter = Store.iso(new Date(Store.d(clash.end).getTime() + 86400000));
            toast(`لا يمكن حفظ عقدين متداخلين على الوحدة — العقد القائم حتى ${shortDate(clash.end)}. لو تجديد فاجعل البداية ${shortDate(dayAfter)}`, 'warning');
            startIn.value = dayAfter; refreshUnits();
            return;
          }
          let tenantId = tenantVal;
          if (tenantId === '__new') {
            const nm = ntName.value.trim();
            if (!nm) { toast('أدخل اسم العميل الجديد', 'warning'); return; }
            const code = Store.foldCode(ntCode.value);
            if (code) {
              const dup = Store.tenantByCode(code);
              if (dup) { toast('هذا الكود مسجَّل بالفعل للعميل: ' + dup.name, 'warning'); return; }
            }
            tenantId = Store.addTenant({ name: nm, code, phone: ntPhone.value.trim() }).id;
          }
          recalcYears();
          if (yearVals.some(v => !v || v <= 0)) {
            toast(isManual() ? 'أكمل قيمة كل سنة في الخانات' : 'أدخل قيمة سنة أولى موجبة', 'warning');
            return;
          }
          const years = yearVals.map(v => ({ rent: v }));
          if (editC) {
            Store.updateContract(editC.id, {
              unitId: unitIn.value, tenantId, start: startIn.value, years,
              dueDay: dueDayIn.value, maintenance: mntIn.value, vat: vatIn.checked,
              deposit: depIn.value || null,
            });
            closeDrawer(); toast('حُفظ التعديل — أُعيد حساب الاستحقاق على المدة الجديدة');
            return;
          }
          const prev = Store.unitContracts(unitIn.value).slice(-1)[0];
          Store.addContract({
            unitId: unitIn.value, tenantId, start: startIn.value, years,
            dueDay: dueDayIn.value, maintenance: mntIn.value, vat: vatIn.checked,
            deposit: depIn.value || null,
            prevId: prev && prev.tenantId === tenantId ? prev.id : null,
          });
          closeDrawer(); toast('سُجِّل العقد وبدأ حساب الاستحقاق فورًا');
        },
      }, editC ? 'حفظ التعديل' : 'حفظ العقد'),
      editC ? h('button.btn.btn-danger', {
        onclick: () => {
          const pays = Store.contractPayments(editC.id);
          if (pays.length) {
            toast(`لا يمكن حذف عقد عليه ${pluralPayments(pays.length)} مسجَّلة — احذف الدفعات أولًا من خلايا الأشهر`, 'warning');
            return;
          }
          if (!confirm('حذف هذا العقد نهائيًا؟ ستعود الوحدة «بلا عقد مسجّل» لهذه المدة.')) return;
          const r = Store.deleteContract(editC.id);
          if (r.ok) { closeDrawer(); toast('حُذف العقد'); }
        },
      }, 'حذف العقد') : null,
      h('button.btn.btn-ghost', { onclick: closeDrawer }, 'إلغاء'),
    ]);
  }

  function pluralPayments(n) {
    if (n === 1) return 'دفعة واحدة';
    if (n === 2) return 'دفعتين';
    if (n >= 3 && n <= 10) return n + ' دفعات';
    return n + ' دفعة';
  }

  /* ========================================================
     5) العملاء
     ======================================================== */
  function viewTenants() {
    const asOf = Store.today();
    const us = filteredUnits(asOf);
    const uset = new Set(us.map(u => u.id));
    const ar = Store.arrears(asOf, uset);
    const visibleTenantIds = new Set(us.flatMap(u => unitTenantIds(u)));
    const rows = Store.state.tenants.filter(t => visibleTenantIds.has(t.id)).map(t => {
      const cs = Store.state.contracts.filter(c => c.tenantId === t.id && uset.has(c.unitId));
      const orphanUnits = Object.entries(ORPHAN_TENANT).filter(([, tid]) => tid === t.id).map(([uid]) => uid).filter(uid => uset.has(uid));
      const unitIds = [...new Set([...cs.map(c => c.unitId), ...orphanUnits])];
      const unitsNames = unitIds.map(unitLabel).join(' · ') || '—';
      // المتأخرات تُنسب لصاحب العقد في ذلك الشهر — لا لكل من استأجر الوحدة يومًا
      const mine = r => unitIds.includes(r.unitId) && (r.contract ? r.contract.tenantId === t.id : ORPHAN_TENANT[r.unitId] === t.id);
      const balance = ar.rows.filter(mine).reduce((s, r) => s + r.amount, 0);
      const unknown = ar.unknowns.filter(mine).length;
      const initials = t.name.split(/\s+/).slice(0, 2).map(w => w[0]).join('');
      const avTone = ['av-a', 'av-b', 'av-c', 'av-d', 'av-e'][[...t.name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % 5];
      return keyClickable(h('tr.row-click', { onclick: () => openTenantDrawer(t) }, [
        h('td', h('span.tenant-cell', [h('span.avatar.' + avTone, initials), h('span', t.name)])),
        h('td', t.code ? h('code.code-chip', t.code) : h('span.val-warning', 'غير مسجَّل')),
        h('td', t.kind === 'شركة' ? statusChip('neutral', 'شركة') : t.kind === 'فرد' ? statusChip('neutral', 'فرد') : '—'),
        h('td', unitsNames),
        h('td', t.phone || h('span.val-warning', 'غير مسجّل')),
        h('td', balance > 0 ? h('span.val-critical', money(balance)) : unknown ? h('span.val-critical', pluralMonths(unknown) + ' بقيمة مجهولة') : 'لا شيء'),
        h('td', t.note || '—'),
      ]));
    });

    /* عميل سُجِّل ولم يُوقَّع له عقد بعد لا يرتبط بأي وحدة، فلا يظهر في الجدول أعلاه —
       يُعرَض هنا صراحةً حتى لا يبدو أن تسجيله ضاع، مع زر يفتح له عقدًا مباشرة */
    const q = (F().q || '').trim();
    const pending = Store.state.tenants
      .filter(t => !tenantUnitIds(t).length)
      .filter(t => !q || UI.arMatch([t.name, t.code || '', t.phone || ''].join(' '), q));
    const pendingCard = pending.length ? sectionCard(`عملاء مسجَّلون بلا عقود بعد (${pending.length})`, h('div', [
      h('p.step-hint', 'هؤلاء أدخلتَ بياناتهم ولم تُسجَّل لهم عقود، لذلك لا وحدات ولا متأخرات لهم. يظهرون هنا دائمًا مهما كان الترشيح.'),
      h('div.mini-scroll', h('table.table.table-mini', [
        h('thead', h('tr', [h('th', 'الاسم'), h('th', 'الكود (الرقم القومي)'), h('th', 'النوع'), h('th', 'الهاتف'), h('th', '')])),
        h('tbody', pending.map(t => h('tr', [
          h('td', h('b', t.name)),
          h('td', t.code ? h('code.code-chip', t.code) : h('span.val-warning', 'غير مسجَّل')),
          h('td', t.kind || '—'),
          h('td', t.phone || h('span.val-warning', 'غير مسجّل')),
          h('td', h('span.btn-row', [
            h('button.btn.btn-ghost', { onclick: () => openTenantDrawer(t) }, 'بياناته'),
            App.canEdit() ? h('button.btn.btn-primary', { onclick: () => openAddContract(null, t.id) }, 'سجِّل له عقدًا') : null,
          ])),
        ]))),
      ])),
    ])) : null;

    return h('div.view', [
      pageHead('العملاء', 'أرصدة المتأخرات محسوبة من جدول التحصيل مباشرة.', [
        App.canEdit() ? h('button.btn.btn-primary', { onclick: () => openTenantDrawer(null) }, [icon('plus'), ' عميل جديد']) : null,
      ]),
      demoBanner(),
      h('div.table-wrap', h('table.table', [
        h('thead', h('tr', [h('th', 'الاسم'), h('th', 'الكود (الرقم القومي)'), h('th', 'النوع'), h('th', 'الوحدات'), h('th', 'الهاتف'), h('th', 'متأخرات'), h('th', 'ملاحظات')])),
        h('tbody', rows.length ? rows : h('tr', h('td', { colspan: 7 }, emptyState('لا عملاء لهم عقود ضمن الترشيح')))),
      ])),
      pendingCard,
    ]);
  }

  function tenantUnitIds(t) {
    const cs = Store.state.contracts.filter(c => c.tenantId === t.id);
    const orphans = Object.entries(ORPHAN_TENANT).filter(([, tid]) => tid === t.id).map(([uid]) => uid);
    return [...new Set([...cs.map(c => c.unitId), ...orphans])];
  }

  /* سجل سداد العميل شهرًا بشهر — أشهر عقوده هو فقط، لا أشهر عميل سابق على نفس الوحدة */
  function tenantLedger(t, asOf) {
    const nowP = Store.periodOf(asOf);
    const cov = Store.state.meta.importCoverage;
    const out = [];
    for (const uid of tenantUnitIds(t)) {
      const u = Store.unit(uid);
      const ucs = Store.unitContracts(uid);
      let from = cov.from;
      if (u && u.buildingId !== cov.buildingId && ucs.length) from = Store.periodOf(Store.d(ucs[0].start));
      if (Store.cmpPeriod(from, cov.from) < 0) from = cov.from;
      for (let p = from; Store.cmpPeriod(p, nowP) <= 0; p = Store.addMonths(p, 1)) {
        const ci = Store.cellInfo(uid, p, asOf);
        if (ci.status === 'none' || ci.status === 'history' || ci.status === 'upcoming') continue;
        const mine = ci.contract ? ci.contract.tenantId === t.id : ORPHAN_TENANT[uid] === t.id;
        if (!mine) continue;
        out.push(ci);
      }
    }
    out.sort((a, b) => Store.cmpPeriod(b.period, a.period));
    return out;
  }

  function payStatusChip(ci) {
    switch (ci.status) {
      case 'paid': return statusChip('good', 'سُدِّد');
      case 'paid_late': return statusChip('warning', 'سُدِّد متأخرًا');
      case 'paid_imported': return statusChip('good', '✓ من ورقة المالك');
      case 'orphan_paid': return statusChip('neutral', 'سداد بلا عقد مسجّل');
      case 'partial': return statusChip('warning', 'سداد جزئي');
      case 'unknown': return statusChip('unknown', 'يحتاج تأكيدًا');
      case 'due': return statusChip('neutral', 'مستحق هذا الشهر');
      case 'late': return statusChip('critical', ci.unknownAmount ? 'متأخر — القيمة غير معروفة' : 'متأخر');
      default: return statusChip('neutral', '—');
    }
  }

  function openTenantDrawer(t) {
    const isNew = !t;
    const nameIn = input({ type: 'text', value: t ? t.name : '', placeholder: 'الاسم' });
    const codeIn = input({ type: 'text', inputmode: 'numeric', value: t ? (t.code || '') : '', placeholder: 'الرقم القومي (14 رقمًا) — أو السجل التجاري للشركات' });
    const kindIn = select({}, ['فرد', 'شركة', 'غير محدد'].map(x => ({ value: x, label: x })), t ? (t.kind || 'فرد') : 'فرد');
    const phoneIn = input({ type: 'tel', value: t ? t.phone : '', placeholder: '01xxxxxxxxx' });
    const noteIn = input({ type: 'text', value: t ? t.note : '' });
    const formGrid = h('div.form-grid', [
      field('الاسم', nameIn),
      field('كود العميل — الرقم القومي', codeIn, 'به تبحث عن العميل من أي شاشة'),
      field('النوع', kindIn),
      field('الهاتف', phoneIn, 'لازم للتنبيهات لاحقًا (واتساب)'), field('ملاحظات', noteIn),
    ]);
    const saveBtn = h('button.btn.btn-primary', {
      onclick: () => {
        if (!nameIn.value.trim()) { toast('أدخل الاسم', 'warning'); return; }
        const code = Store.foldCode(codeIn.value);
        if (code) {
          const dup = Store.tenantByCode(code);
          if (dup && (!t || dup.id !== t.id)) { toast('هذا الكود مسجَّل بالفعل للعميل: ' + dup.name, 'warning'); return; }
        }
        const patch = { name: nameIn.value.trim(), code: code || null, kind: kindIn.value, phone: phoneIn.value, note: noteIn.value };
        if (isNew) Store.addTenant(patch); else Store.updateTenant(t.id, patch);
        closeDrawer(); toast('حُفظ');
      },
    }, isNew ? 'حفظ' : 'حفظ البيانات');

    if (isNew) {
      openDrawer('عميل جديد', [formGrid], [saveBtn, h('button.btn.btn-ghost', { onclick: closeDrawer }, 'إلغاء')]);
      return;
    }

    const asOf = Store.today();
    const ledger = tenantLedger(t, asOf);
    const unitIds = tenantUnitIds(t);
    const multiUnit = unitIds.length > 1;
    const grace = Store.state.settings.graceDays;

    /* الوحدات والعقود */
    const unitLines = unitIds.map(uid => {
      const u = Store.unit(uid);
      const cs = Store.unitContracts(uid).filter(c => c.tenantId === t.id);
      const last = cs[cs.length - 1] || null;
      let info;
      if (last) {
        const y = last.years.find(yy => Store.d(yy.from) <= asOf && asOf <= Store.d(yy.to)) || last.years[last.years.length - 1];
        const ended = Store.d(last.end) < asOf;
        info = [
          h('span', 'عقد من'), ' ', h('span', shortDate(last.start)), ' ', h('span', 'إلى'), ' ', h('span', shortDate(last.end)),
          ' · ', h('span', 'الإيجار الحالي'), ' ', h('b', money(y.rent + (last.maintenance || 0))),
          ended ? h('span.val-critical', ' · منتهٍ') : null,
        ];
      } else {
        info = [h('span', 'سداد بلا عقد مسجّل')];
      }
      return h('div.tp-unit', [
        h('b', (u ? u.name : uid) + ' — ' + (u ? bLabel(u.buildingId) : '')),
        h('span.exp-proj', info),
      ]);
    });

    /* آخر سداد + المتأخرات — دفعات عقوده هو فقط */
    const myCids = new Set(Store.state.contracts.filter(c => c.tenantId === t.id).map(c => c.id));
    const allPays = ledger.flatMap(ci => ci.payments
      .filter(p => !p.contractId || myCids.has(p.contractId))
      .map(p => ({ ...p, period: ci.period })));
    const lastPay = allPays.filter(p => p.date).sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null;
    const lastTick = ledger.find(ci => ci.status === 'paid_imported') || null;
    const arrCells = ledger.filter(ci =>
      (ci.status === 'late' && !ci.unknownAmount && ci.due) ||
      (ci.status === 'partial' && ci.overdueDays > grace && ci.due));
    const arrTotal = arrCells.reduce((s, ci) => s + Math.max(0, ci.due.amount - ci.paid), 0);
    const unkCount = ledger.filter(ci => (ci.status === 'late' && ci.unknownAmount) || ci.status === 'unknown').length;

    const lastPayNode = lastPay
      ? h('span', [h('b', money(lastPay.amount)), ' — ', shortDate(lastPay.date), ' · ', h('span', 'عن شهر'), ' ', h('span', Store.periodLabel(lastPay.period, true))])
      : lastTick
        ? h('span', [h('span', 'لا مدفوعات مسجَّلة بمبلغ وتاريخ'), ' — ', h('span', 'آخر شهر مؤشَّر ✓ في ورقة المالك:'), ' ', h('span', Store.periodLabel(lastTick.period, true))])
        : h('span.val-critical', 'لا سداد مسجَّل لهذا العميل إطلاقًا');

    const arrNode = arrCells.length
      ? h('span.val-critical', [h('b', money(arrTotal)), ' — ', h('span', pluralMonths(arrCells.length)), unkCount ? h('span', [' + ', h('span', pluralMonths(unkCount)), ' ', h('span', 'بقيمة مجهولة')]) : null])
      : unkCount
        ? h('span.val-warning', [h('span', pluralMonths(unkCount)), ' ', h('span', 'بقيمة مجهولة')])
        : h('span', 'لا شيء');

    const facts = h('div.tp-facts', [
      h('span.k', 'كود العميل'), t.code ? h('code.code-chip', t.code) : h('span.val-warning', 'غير مسجَّل — أضفه من «تعديل البيانات» بالأسفل'),
      h('span.k', 'الهاتف'), h('span', t.phone || 'غير مسجّل'),
      h('span.k', 'آخر سداد مسجَّل'), lastPayNode,
      h('span.k', 'إجمالي المتأخرات'), arrNode,
    ]);

    /* السجل شهرًا بشهر */
    const rows = ledger.map(ci => {
      const u = Store.unit(ci.unitId);
      const payDate = ci.paidDate || ci.payments.map(p => p.date).filter(Boolean).sort().pop() || null;
      return keyClickable(h('tr.row-click', {
        onclick: () => { closeDrawer(); openCellDrawer(u, ci.period, asOf); },
      }, [
        h('td', Store.periodLabel(ci.period, true)),
        multiUnit ? h('td', u ? u.name : '—') : null,
        h('td', ci.due ? money(ci.due.amount, { bare: true }) : '—'),
        h('td', ci.paid ? money(ci.paid, { bare: true }) : '0'),
        h('td', payDate ? shortDate(payDate) : '—'),
        h('td', payStatusChip(ci)),
      ]));
    });

    openDrawer('ملف العميل', [
      h('h3.tp-name', t.name),
      unitIds.length ? null : h('p.note-line', 'لا عقود مسجَّلة لهذا العميل بعد — بياناته محفوظة، وسيظهر في الجدول الرئيسي بمجرد تسجيل أول عقد له.'),
      ...unitLines,
      facts,
      h('h4.tp-sub', 'سجل السداد شهرًا بشهر'),
      h('p.step-hint', 'أشهر هذا العميل فقط، الأحدث أولًا — كل سطر يفتح خلية الشهر نفسها للتفصيل أو تسجيل دفع.'),
      h('div.mini-scroll', h('table.table.table-mini', [
        h('thead', h('tr', [h('th', 'الشهر'), multiUnit ? h('th', 'الوحدة') : null, h('th', 'المستحق'), h('th', 'المسدَّد'), h('th', 'تاريخ السداد'), h('th', 'الحالة')])),
        h('tbody', rows.length ? rows : h('tr', h('td', { colspan: multiUnit ? 6 : 5 }, 'لا أشهر مسجَّلة بعد'))),
      ])),
      h('h4.tp-sub', 'تعديل البيانات'),
      formGrid,
    ], [
      App.canEdit() ? (unitIds.length
        ? h('button.btn.btn-primary', {
            onclick: () => {
              closeDrawer();
              const u0 = Store.unit(unitIds[0]);
              App.filters = { b: u0 ? u0.buildingId : '', ty: '', tn: t.id, st: '', q: '' };
              location.hash = '#matrix'; App.render();
            },
          }, 'تسجيل دفع في جدول التحصيل')
        : h('button.btn.btn-primary', {
            onclick: () => { closeDrawer(); openAddContract(null, t.id); },
          }, 'سجِّل له عقدًا')) : null,
      App.canEdit() ? saveBtn : null,
      h('button.btn.btn-ghost', { onclick: closeDrawer }, 'إغلاق'),
    ]);
  }

  /* ========================================================
     6) الشكاوى
     ======================================================== */
  function viewComplaints() {
    const asOf = Store.today();
    const uset = fset(asOf);
    const ks = Store.state.complaints.filter(k => !k.unitId || uset.has(k.unitId));
    const open = ks.filter(k => k.status === 'open');
    const closed = ks.filter(k => k.status === 'closed');
    const closable = closed.filter(k => k.openedAt && k.closedAt)
      .map(k => Store.daysBetween(Store.d(k.openedAt), Store.d(k.closedAt)))
      .filter(Number.isFinite);
    const avgClose = closable.length
      ? Math.round(closable.reduce((s, v) => s + v, 0) / closable.length)
      : null;
    const costOwner = closed.reduce((s, k) => s + (k.borneBy === 'المالك' ? k.cost : 0), 0);

    const tiles = h('div.tiles.tiles-3', [
      statTile({ label: 'شكاوى مفتوحة', value: String(open.length) }),
      statTile({ label: 'متوسط زمن الإغلاق', value: avgClose == null ? '—' : avgClose + ' يوم' }),
      statTile({ label: 'تكلفة على المالك (المغلقة)', value: money(costOwner, { bare: true }) }),
      statTile({
        label: 'شكاوى خلال 30 يومًا من التسليم', value: '—',
        sub: 'معطَّل: تواريخ التسليم غير مسجَّلة بعد (جودة البيانات)',
      }),
    ]);

    const CAT_TONE = { 'سباكة': 'chip-neutral', 'كهرباء': 'chip-warning', 'تشطيبات': 'chip-neutral', 'تسريب': 'chip-serious', 'تكييف': 'chip-neutral', 'مصاعد ومرافق': 'chip-serious', 'أخرى': 'chip-neutral' };
    const rows = ks.map(k => h('tr', [
      h('td', shortDate(k.openedAt)),
      h('td', k.unitId ? bLabel(Store.unit(k.unitId).buildingId) : '—'),
      h('td', k.unitId ? unitLabel(k.unitId) : '—'),
      h('td', h('span.chip.' + (CAT_TONE[k.category] || 'chip-neutral'), k.category)),
      h('td', k.desc || '—'),
      h('td', k.cost ? money(k.cost, { bare: true }) : '—'),
      h('td', k.borneBy),
      h('td', k.status === 'open' ? statusChip('serious', 'مفتوحة') : statusChip('good', 'مغلقة')),
      h('td', k.status === 'open'
        ? h('button.btn.btn-ghost', { onclick: () => { Store.closeComplaint(k.id, Store.iso(Store.today())); toast('أُغلقت الشكوى'); } }, 'إغلاق')
        : shortDate(k.closedAt)),
    ]));

    return h('div.view', [
      pageHead('الشكاوى والصيانة', 'سجل الكشف الفعلي يبدأ من اليوم — بالتصنيف والتكلفة ومن يتحمّلها.', [
        App.canEdit() ? h('button.btn.btn-primary', { onclick: openAddComplaint }, [icon('plus'), ' شكوى جديدة']) : null,
      ]),
      demoBanner(),
      tiles,
      ks.length
        ? h('div.table-wrap', h('table.table', [
            h('thead', h('tr', [h('th', 'التاريخ'), h('th', 'المبنى'), h('th', 'الوحدة'), h('th', 'التصنيف'), h('th', 'الوصف'),
              h('th', 'التكلفة'), h('th', 'يتحمّلها'), h('th', 'الحالة'), h('th', '')])),
            h('tbody', rows),
          ]))
        : emptyState('لا شكاوى مسجَّلة', 'أول شكوى تُسجَّل من الزر أعلاه — وتظهر مؤشراتها هنا فورًا'),
    ]);
  }

  function openAddComplaint() {
    const unitIn = h('select.input');
    for (const b of Store.state.buildings) {
      const og = h('optgroup', { label: b.name });
      for (const u of Store.state.units.filter(u => u.buildingId === b.id))
        og.appendChild(h('option', { value: u.id }, u.name));
      unitIn.appendChild(og);
    }
    const catIn = select({}, ['سباكة', 'كهرباء', 'تشطيبات', 'تسريب', 'تكييف', 'مصاعد ومرافق', 'أخرى'].map(x => ({ value: x, label: x })), 'سباكة');
    const dateIn = input({ type: 'date', value: Store.iso(Store.today()) });
    const descIn = input({ type: 'text', placeholder: 'وصف مختصر' });
    const costIn = input({ type: 'number', min: 0, step: 'any', placeholder: '0' });
    const borneIn = select({}, ['المالك', 'العميل', 'المقاول', 'مشترك'].map(x => ({ value: x, label: x })), 'المالك');
    openDrawer('شكوى جديدة', [h('div.form-grid', [
      field('الوحدة', unitIn), field('التصنيف', catIn), field('تاريخ الفتح', dateIn),
      field('الوصف', descIn), field('التكلفة المتوقعة', costIn), field('يتحمّلها', borneIn),
    ])], [
      h('button.btn.btn-primary', {
        onclick: () => {
          if (!dateIn.value) { toast('أدخل تاريخ الفتح', 'warning'); return; }
          if (Store.d(dateIn.value) > Store.today()) { toast('تاريخ الفتح لا يمكن أن يكون مستقبليًا', 'warning'); return; }
          const act = Store.activeContractOn(unitIn.value, Store.today());
          Store.addComplaint({
            unitId: unitIn.value, tenantId: act ? act.tenantId : null,
            openedAt: dateIn.value, category: catIn.value, desc: descIn.value,
            cost: costIn.value, borneBy: borneIn.value,
          });
          closeDrawer(); toast('سُجِّلت الشكوى');
        },
      }, 'حفظ'),
      h('button.btn.btn-ghost', { onclick: closeDrawer }, 'إلغاء'),
    ]);
  }

  /* ========================================================
     7) جودة البيانات
     ======================================================== */
  function viewQuality() {
    const all = Store.state.issues;
    const sevs = [
      { k: 'all', label: 'الكل' }, { k: 'critical', label: 'حرجة' },
      { k: 'high', label: 'عالية' }, { k: 'medium', label: 'متوسطة' }, { k: 'low', label: 'منخفضة' },
    ];
    const list = all.filter(q =>
      (VS.qualitySev === 'all' || q.severity === VS.qualitySev) &&
      (VS.qualityStatus === 'all' || q.status === VS.qualityStatus));

    const cards = list.map(q => {
      const refName = q.refType === 'unit' ? 'الوحدة: ' + unitLabel(q.refId)
        : q.refType === 'contract' ? 'العقد: ' + (Store.contract(q.refId) ? unitLabel(Store.contract(q.refId).unitId) + ' — ' + tenantLabel(Store.contract(q.refId).tenantId) : q.refId)
        : 'عام';
      return h('div.card.issue-card.sev-' + q.severity + (q.status === 'resolved' ? '.issue-done' : ''), [
        h('div.issue-head', [severityChip(q.severity), h('span.issue-ref', refName),
          q.status === 'resolved' ? statusChip('good', 'محسومة') : null]),
        h('h3.issue-title', q.title),
        h('p.issue-detail', q.detail),
        h('p.issue-action', [h('b', 'المطلوب: '), q.action]),
        q.resolution ? h('p.issue-detail.issue-res', [h('b', 'رد المالك: '), q.resolution]) : null,
        h('div.issue-btns', q.status === 'open'
          ? [h('button.btn.btn-primary', {
              onclick: () => {
                const res = prompt('اكتب إجابة المالك / القرار النهائي لهذا السؤال (مثال: «المدة سنتان فعلًا والقيمة 39,000 صحيحة»). سيُحفظ نصيًا مع البند ويقفله:');
                if (res != null && res.trim()) { Store.setIssueStatus(q.id, 'resolved', res.trim()); toast('سُجِّل رد المالك وأُغلق البند'); }
              },
              title: 'الحسم = إجابة المالك على السؤال. بتتسجّل نصيًا مع البند وبيتقفل — وتدخل بياناتها النظام (تعديل عقد/توثيق دفعة…)',
            }, 'سجّل رد المالك')]
          : [h('button.btn.btn-ghost', { onclick: () => { Store.setIssueStatus(q.id, 'open'); } }, 'إعادة فتح')]),
      ]);
    });

    const openCount = all.filter(q => q.status === 'open').length;
    return h('div.view', [
      pageHead('مراجعات مطلوبة — أسئلة للمالك',
        `${all.length} ملاحظة من تفريغ الكشف الورقي — قائمة الأسئلة التي يجيب عنها المالك، وكل إجابة تُدخل النظام وتُقفل بندها.`),
      h('div.filter-row', [
        h('span.filter-label', 'الخطورة'),
        ...sevs.map(s => h('button.btn.seg' + (VS.qualitySev === s.k ? '.seg-on' : ''), {
          onclick: () => { VS.qualitySev = s.k; App.render(); },
        }, s.label)),
        h('span.filter-label', 'الحالة'),
        ...[{ k: 'open', label: `مفتوحة (${openCount})` }, { k: 'resolved', label: 'محسومة' }, { k: 'all', label: 'الكل' }]
          .map(s => h('button.btn.seg' + (VS.qualityStatus === s.k ? '.seg-on' : ''), {
            onclick: () => { VS.qualityStatus = s.k; App.render(); },
          }, s.label)),
      ]),
      list.length ? h('div.issues-grid', cards) : emptyState('لا ملاحظات ضمن هذا الترشيح'),
    ]);
  }

  /* ========================================================
     8) الإعدادات
     ======================================================== */
  function viewSettings() {
    const s = Store.state.settings;
    const basisMonthly = h('input', { type: 'radio', name: 'basis' });
    const basisAnnual = h('input', { type: 'radio', name: 'basis' });
    (s.rentBasis === 'monthly' ? basisMonthly : basisAnnual).checked = true;
    basisMonthly.addEventListener('change', () => { Store.updateSettings({ rentBasis: 'monthly' }); toast('أُعيد حساب كل الأرقام على أساس شهري'); });
    basisAnnual.addEventListener('change', () => { Store.updateSettings({ rentBasis: 'annual' }); toast('أُعيد حساب كل الأرقام على أساس سنوي (القيمة ÷ 12)'); });

    const confirmChk = h('input', { type: 'checkbox' });
    confirmChk.checked = !!s.rentBasisConfirmed;
    confirmChk.addEventListener('change', () => Store.updateSettings({ rentBasisConfirmed: confirmChk.checked }));

    const graceIn = input({ type: 'number', min: 0, max: 28, value: s.graceDays });
    graceIn.addEventListener('change', () => { Store.updateSettings({ graceDays: Number(graceIn.value) || 0 }); });
    const incIn = input({ type: 'number', min: 0, max: 100, value: s.defaultIncreasePct });
    incIn.addEventListener('change', () => { Store.updateSettings({ defaultIncreasePct: Number(incIn.value) || 0 }); });
    const vatIn = input({ type: 'number', min: 0, max: 30, value: s.vatPct });
    vatIn.addEventListener('change', () => { Store.updateSettings({ vatPct: Number(vatIn.value) || 0 }); });

    /* تقرير Excel شامل: أوراق مستقلة بعناوين وشروح — الأرقام أرقام لا نصوص */
    function exportWorkbook() {
      const asOf = Store.today();
      const m = Store.periodOf(asOf);
      const prevM = Store.addMonths(m, -1);
      const ar = Store.arrears(asOf);
      const vac = Store.vacancyInfo(asOf);
      const uCode = id => (Store.unit(id) || {}).code || '';
      const bOf = id => bLabel((Store.unit(id) || {}).buildingId);
      const sheets = [];

      // 1) ملخص المشاريع
      sheets.push({
        name: 'ملخص المشاريع',
        title: `إيجاري — ملخص المشاريع حتى ${shortDate(Store.iso(asOf))}`,
        note: `شهر التقرير: ${Store.periodLabel(prevM, true)} (آخر شهر مكتمل) · الأرقام محسوبة من العقود والدفعات المسجَّلة`,
        head: ['كود المشروع', 'المشروع', 'المالك', 'عدد الوحدات', 'مؤجَّرة', 'شاغرة', 'إيجارات الشهر', 'المحصَّل', 'نسبة التحصيل %', 'المتأخرات', 'خسارة الشواغر شهريًا'],
        rows: Store.state.buildings.map(b => {
          const st = Store.projectStats(b.id, prevM, asOf);
          const uset = new Set(Store.state.units.filter(u => u.buildingId === b.id).map(u => u.id));
          const a = Store.arrears(asOf, uset);
          const v = Store.vacancyInfo(asOf, uset);
          return [b.code || '', b.name, b.owner || '—', st.units, st.rented, st.units - st.rented,
            st.due || 0, st.collected || 0, st.rate == null ? '—' : Math.round(st.rate * 100),
            a.total, v.totalMonthly || 0];
        }),
      });

      // 2) العقود
      const maxY = Store.state.contracts.reduce((mx, c) => Math.max(mx, (c.years || []).length), 1);
      sheets.push({
        name: 'العقود',
        title: 'العقود المسجَّلة — بقيم كل سنة',
        note: 'كل صف عقد مستقل؛ التجديد عقد جديد مربوط بسابقه ولا يُعدَّل القديم',
        head: ['كود المشروع', 'المشروع', 'كود الوحدة', 'الوحدة', 'كود العميل', 'العميل', 'من', 'إلى', 'المدة (سنوات)',
          ...Array.from({ length: maxY }, (_, i) => `قيمة سنة ${i + 1}`), 'الصيانة الشهرية', 'ض.ق.م', 'التأمين', 'الحالة', 'النوع'],
        rows: Store.state.contracts.map(c => {
          const u = Store.unit(c.unitId) || {}, b = Store.building(u.buildingId) || {}, t = Store.tenant(c.tenantId) || {};
          const ended = Store.d(c.end) < asOf;
          const started = Store.d(c.start) > asOf;
          return [b.code || '', b.name || '', u.code || '', u.name || '', t.code || '', t.name || '',
            c.start, c.end, (c.years || []).length,
            ...Array.from({ length: maxY }, (_, i) => (c.years[i] ? c.years[i].rent : '')),
            c.maintenance || 0, c.vat ? 'خاضع' : 'غير خاضع', c.deposit ? c.deposit.amount : 0,
            started ? 'مستقبلي' : ended ? 'منتهٍ' : 'ساري', c.prevId ? 'تجديد' : 'جديد'];
        }),
      });

      // 3) العملاء
      sheets.push({
        name: 'العملاء',
        title: 'العملاء وأرصدتهم',
        note: 'المتأخرات منسوبة لصاحب العقد في كل شهر — لا لكل من استأجر الوحدة سابقًا',
        head: ['الاسم', 'الكود (الرقم القومي)', 'النوع', 'الهاتف', 'عدد الوحدات', 'الوحدات', 'المتأخرات', 'أشهر بقيمة مجهولة', 'ملاحظات'],
        rows: Store.state.tenants.map(t => {
          const ids = tenantUnitIds(t);
          const mine = r => ids.includes(r.unitId) && (r.contract ? r.contract.tenantId === t.id : ORPHAN_TENANT[r.unitId] === t.id);
          return [t.name, t.code || '', t.kind || '', t.phone || '', ids.length,
            ids.map(id => (Store.unit(id) || {}).code || unitLabel(id)).join(' · ') || '—',
            ar.rows.filter(mine).reduce((s2, r) => s2 + r.amount, 0),
            ar.unknowns.filter(mine).length, t.note || ''];
        }),
      });

      // 4) المتأخرات
      sheets.push({
        name: 'المتأخرات',
        title: `المتأخرات المؤكدة حتى ${shortDate(Store.iso(asOf))}`,
        note: `الإجمالي ${money(ar.total)} · بالإضافة إلى ${ar.unknowns.length} شهرًا بقيمة غير معروفة (بلا عقد مسجَّل)`,
        head: ['كود الوحدة', 'المشروع', 'الوحدة', 'العميل', 'الشهر', 'المستحق', 'المسدَّد', 'المتبقي', 'أيام التأخير', 'الشريحة'],
        rows: [
          ...ar.rows.map(r => [uCode(r.unitId), bOf(r.unitId), unitLabel(r.unitId),
            r.contract ? tenantLabel(r.contract.tenantId) : (ORPHAN_TENANT[r.unitId] ? tenantLabel(ORPHAN_TENANT[r.unitId]) : '—'),
            Store.periodLabel(r.period, true), r.due ? r.due.amount : 0, r.paid, r.amount, r.overdueDays,
            r.overdueDays <= 30 ? '1–30 يوم' : r.overdueDays <= 60 ? '31–60 يوم' : r.overdueDays <= 90 ? '61–90 يوم' : 'أكثر من 90 يوم']),
          ...ar.unknowns.map(r => [uCode(r.unitId), bOf(r.unitId), unitLabel(r.unitId),
            ORPHAN_TENANT[r.unitId] ? tenantLabel(ORPHAN_TENANT[r.unitId]) : '—',
            Store.periodLabel(r.period, true), 'غير معروف', 0, 'غير معروف', r.overdueDays, 'بلا عقد مسجَّل']),
        ],
      });

      // 5) جدول التحصيل للسنة
      const year = VS.matrixYear;
      const periods = Array.from({ length: 12 }, (_, i) => year + '-' + String(i + 1).padStart(2, '0'));
      sheets.push({
        name: 'جدول التحصيل ' + year,
        title: `جدول التحصيل — سنة ${year}`,
        note: 'حالة كل وحدة في كل شهر: سُدِّد / سُدِّد متأخرًا / جزئي / متأخر / يحتاج تأكيدًا / خارج العقد',
        head: ['كود الوحدة', 'المشروع', 'الوحدة', 'العميل', ...periods.map(p => Store.periodLabel(p, true))],
        rows: Store.state.units.map(u => {
          const tid = unitTenantIds(u).slice(-1)[0];
          return [u.code || '', bLabel(u.buildingId), u.name, tid ? tenantLabel(tid) : '—',
            ...periods.map(p => (CELL_DEFS[Store.cellInfo(u.id, p, asOf).status] || CELL_DEFS.none).label)];
        }),
      });

      // 6) الدفعات
      sheets.push({
        name: 'الدفعات',
        title: 'الدفعات الموثَّقة (بمبلغ وتاريخ)',
        note: 'لا تشمل علامات ✓ المنقولة من ورقة المالك — تلك بلا مبلغ ولا تاريخ',
        head: ['كود الوحدة', 'المشروع', 'الوحدة', 'العميل', 'الشهر', 'المبلغ', 'تاريخ السداد', 'الطريقة', 'رقم الإيصال', 'ملاحظات'],
        rows: Store.state.payments.map(p => {
          const tid = unitTenantIds(Store.unit(p.unitId) || {}).slice(-1)[0];
          return [uCode(p.unitId), bOf(p.unitId), unitLabel(p.unitId), tid ? tenantLabel(tid) : '—',
            Store.periodLabel(p.period, true), p.amount, p.date || '', p.method || '', p.receiptNo || '', p.notes || ''];
        }),
      });

      // 7) الوحدات الشاغرة
      sheets.push({
        name: 'الوحدات الشاغرة',
        title: 'الوحدات الشاغرة وخسارتها',
        note: 'الخسارة الشهرية تقدير معلن الأساس: آخر إيجار للوحدة نفسها، أو متوسط إيجار وحدات نوعها',
        head: ['كود الوحدة', 'المشروع', 'الوحدة', 'النوع', 'شاغرة منذ', 'عدد الأشهر', 'خسارة شهرية تقديرية', 'أساس التقدير', 'الفاقد حتى الآن'],
        rows: vac.rows.map(r => [r.unit.code || '', bLabel(r.unit.buildingId), r.unit.name, r.unit.type,
          r.since ? shortDate(r.since) : 'لم تؤجَّر من قبل', r.months == null ? '' : r.months,
          r.estMonthly || 0, r.src || '—', r.accumLoss || 0]),
      });

      // 8) مراجعات مطلوبة
      sheets.push({
        name: 'مراجعات مطلوبة',
        title: 'بنود تحتاج ردَّ المالك',
        note: 'كل بند: النص الحرفي من المصدر + التفسير المتَّبع + السؤال المطلوب حسمه',
        head: ['الحالة', 'الخطورة', 'البند', 'التفصيل', 'المطلوب', 'رد المالك'],
        rows: Store.state.issues.map(q => [q.status === 'open' ? 'مفتوح' : 'محسوم',
          ({ critical: 'حرجة', high: 'عالية', medium: 'متوسطة', low: 'منخفضة' })[q.severity] || q.severity,
          q.title, q.detail || '', q.action || '', q.resolution || '']),
      });

      Store.download(`إيجاري — التقرير الشامل ${Store.iso(asOf)}.xls`,
        Store.toExcel(sheets, 'إيجاري — التقرير الشامل'), 'application/vnd.ms-excel');
      toast('نُزِّل التقرير الشامل — افتحه بـ Excel');
    }

    function exportArrears() {
      const ar = Store.arrears(Store.today());
      const uCode = id => (Store.unit(id) || {}).code || '';
      const rows = [['كود الوحدة', 'المشروع', 'الوحدة', 'الشهر', 'المستحق', 'المسدَّد', 'المتبقي', 'أيام التأخير']];
      for (const r of ar.rows) rows.push([uCode(r.unitId), bLabel(Store.unit(r.unitId).buildingId), unitLabel(r.unitId), Store.periodLabel(r.period, true),
        r.due ? r.due.amount : '', r.paid, r.amount, r.overdueDays]);
      for (const r of ar.unknowns) rows.push([uCode(r.unitId), bLabel(Store.unit(r.unitId).buildingId), unitLabel(r.unitId), Store.periodLabel(r.period, true), 'غير معروف', 0, 'غير معروف', r.overdueDays]);
      Store.download('المتأخرات.csv', Store.toCSV(rows));
    }
    function exportPayments() {
      const rows = [['كود الوحدة', 'المشروع', 'الوحدة', 'الشهر', 'المبلغ', 'التاريخ', 'الطريقة', 'رقم الإيصال', 'ملاحظات']];
      for (const p of Store.state.payments) rows.push([(Store.unit(p.unitId) || {}).code || '', bLabel(Store.unit(p.unitId).buildingId), unitLabel(p.unitId), Store.periodLabel(p.period, true),
        p.amount, p.date || '', p.method, p.receiptNo, p.notes]);
      Store.download('الدفعات-المسجلة.csv', Store.toCSV(rows));
    }

    /* إدارة المباني/الكشوف */
    const bNameIn = input({ type: 'text', placeholder: 'اسم المبنى / الكشف' });
    const bAreaIn = input({ type: 'text', placeholder: 'المنطقة — اختياري' });
    const buildingsCard = sectionCard('المشاريع', h('div', [
      h('table.table.table-mini', [
        h('thead', h('tr', [h('th', 'الكود'), h('th', 'المشروع'), h('th', 'المالك'), h('th', 'المنطقة'), h('th', 'الوحدات'), h('th', 'النوع'), h('th', '')])),
        h('tbody', Store.state.buildings.map(b => h('tr', [
          h('td', b.code ? h('code.code-chip', b.code) : '—'),
          h('td', b.name), h('td', b.owner || '—'), h('td', b.area || '—'),
          h('td', String(Store.state.units.filter(u => u.buildingId === b.id).length)),
          h('td', b.demo ? h('span.chip.chip-neutral', 'تجريبي') : h('span.chip.chip-unknown', 'فعلي')),
          h('td', h('button.btn.btn-ghost.btn-sm', { onclick: () => openEditBuilding(b) }, 'تعديل')),
        ]))),
      ]),
      h('div.form-inline', [
        bNameIn, bAreaIn,
        h('button.btn.btn-primary', {
          onclick: () => {
            if (!bNameIn.value.trim()) { toast('أدخل اسم المبنى', 'warning'); return; }
            Store.addBuilding({ name: bNameIn.value.trim(), area: bAreaIn.value.trim() });
            toast('أُضيف المبنى — أضف وحداته من شاشة الوحدات ثم عقوده، أو انقل ورقته من جدول التحصيل بوضع نقل الورقة');
          },
        }, [icon('plus'), ' كشف/مبنى جديد']),
      ]),
      Store.state.buildings.some(b => b.demo) ? h('p.note-line', [icon('warn'),
        ' عند بدء الاستخدام الفعلي: ', h('button.btn.btn-ghost', {
          onclick: () => { if (confirm('حذف المبنيين التوضيحيين وكل بياناتهما نهائيًا؟')) { Store.removeDemoData(); toast('حُذفت البيانات التوضيحية'); } },
        }, 'حذف البيانات التوضيحية')]) : null,
    ]));

    return h('div.view', [
      pageHead('الإعدادات', 'كل افتراض في النظام مُعلَن هنا وقابل للتغيير — ويُعاد الحساب فورًا.'),
      sectionCard('أساس قيم الإيجار', h('div.settings-block', [
        h('p', ['محسوم من عقد العينة — البند الثالث ينص حرفيًا: «القيمة الإيجارية للمكان … جنيه ', h('b', 'شهريًا'), ' (فقط لا غير)». التبديل هنا متاح فقط لو ظهر كشف بعقود من نموذج مختلف.']),
        h('label.radio-row', [basisMonthly, h('span', [h('b', 'شهرية'), ' — بنص البند الثالث (وتؤكدها قرينة تأمين 41 = 35,000 ≈ شهر)'])]),
        h('label.radio-row', [basisAnnual, h('span', [h('b', 'سنوية'), ' — يُقسم المبلغ على 12 شهرًا'])]),
        h('label.radio-row', [confirmChk, h('span', 'تم التأكيد أن جميع العقود على نفس النموذج')]),
      ])),
      buildingsCard,
      sectionCard('قواعد الحساب', h('div.form-grid', [
        field('أيام السماح بعد يوم الاستحقاق', graceIn, 'يوم الاستحقاق يُحدد في كل عقد (افتراضيًا أول الشهر)'),
        field('نسبة الزيادة السنوية الافتراضية ٪', incIn, 'تُستخدم في توليد جدول سنوات العقود الجديدة'),
        field('نسبة ضريبة القيمة المضافة ٪', vatIn, 'تُطبق على العقود المُعلَّمة «خاضع» فقط'),
      ])),
      sectionCard('تصدير التقارير', h('div', [
        h('p.step-hint', 'التقرير الشامل ملف Excel واحد بأوراق منفصلة منسَّقة وجاهزة للعرض على المالك. وبجانبه تصديرات مفردة بصيغة CSV لمن يريد بيانات خامًا.'),
        h('div.btn-row', [
          h('button.btn.btn-primary', { onclick: exportWorkbook }, [icon('download'), ' التقرير الشامل (Excel)']),
        ]),
        h('h4.drawer-sec', 'تصديرات مفردة (CSV)'),
        h('div.btn-row', [
          h('button.btn.btn-ghost', { onclick: exportArrears }, [icon('download'), ' المتأخرات']),
          h('button.btn.btn-ghost', { onclick: () => exportMatrix(VS.matrixYear) }, [icon('download'), ' جدول ' + VS.matrixYear]),
          h('button.btn.btn-ghost', { onclick: exportContracts }, [icon('download'), ' العقود']),
          h('button.btn.btn-ghost', { onclick: exportPayments }, [icon('download'), ' الدفعات المسجَّلة']),
        ]),
      ])),
      sectionCard('البيانات', h('div.settings-block', [
        h('p', ['مصدر الكشف الفعلي: ', h('b', Store.state.meta.sourceName), ` — التغطية ${Store.periodLabel(Store.state.meta.importCoverage.from, true)} حتى ${Store.periodLabel(Store.state.meta.importCoverage.to, true)}. `,
          'التعديلات تُحفظ محليًا على هذا الجهاز (نسخة عرض — النسخة التشغيلية تُحفظ على خادم بصلاحيات وسجل تعديلات).']),
        h('button.btn.btn-danger', {
          onclick: () => { if (confirm('إعادة تعيين كل البيانات إلى بذرة الكشف الأصلية؟ ستفقد الدفعات والعقود المُدخلة.')) { Store.resetData(); toast('أُعيدت البيانات للأصل'); } },
        }, 'إعادة التعيين إلى بيانات الكشف الأصلية'),
      ])),
    ]);
  }

  /* ========================================================
     9) التحليلات — إنسايتس مكتوبة بالأرقام + إحصاءات
     ======================================================== */
  function insightCard(o) {
    // o: {tone, ic, num, title, text, go, filters}
    // الكارد ينقل للشاشة وعليها الترشيح المطابق لمحتواه — لا تنقّل أعمى
    const c = h('div.insight.tone-' + (o.tone || 'accent'), {
      onclick: o.go ? () => {
        App.filters = Object.assign({ b: '', ty: '', tn: '', st: '', q: '' }, o.filters || {});
        if (location.hash === o.go) App.render(); else location.hash = o.go;
      } : null,
    }, [
      h('span.insight-ic.tone-' + (o.tone || 'accent'), icon(o.ic || 'bolt')),
      h('div.insight-body', [
        o.num != null ? h('div.insight-num', o.num) : null,
        h('div.insight-title', o.title),
        o.text ? h('p.insight-text', o.text) : null,
      ]),
    ]);
    if (o.go) keyClickable(c);
    return c;
  }

  function viewInsights() {
    const asOf = Store.today();
    const uset = fset(asOf);
    const m = defaultDashMonth();
    const prev = Store.addMonths(m, -1);
    const mtM = Store.monthTotals(m, asOf, uset);
    const mtP = Store.monthTotals(prev, asOf, uset);
    const ar = Store.arrears(asOf, uset);
    const occ = Store.occupancy(asOf, uset);
    const rev = Store.contractedRevenue(currentPeriod(), 12, uset);
    const rates = Store.collectionSeries(m, 12, asOf, uset)
      .map(x => ({ period: x.period, v: x.rate, sub: x.due ? `${money(x.collected, { bare: true })} من ${money(x.due, { bare: true })}` : null }));

    /* ---------- الإنسايتس المكتوبة ---------- */
    const cards = [];
    if (mtM.rate != null && mtP.rate != null) {
      const diff = Math.round((mtM.rate - mtP.rate) * 100);
      cards.push(insightCard({
        tone: diff < -5 ? 'critical' : diff > 5 ? 'good' : 'accent', ic: diff < 0 ? 'trendDown' : 'trend',
        num: pct(mtM.rate),
        title: `تحصيل ${Store.periodLabel(m, true)} ${diff === 0 ? 'ثابت' : diff > 0 ? 'ارتفع' : 'انخفض'} ${diff === 0 ? '' : Math.abs(diff) + ' نقطة'}`,
        text: `مقابل ${pct(mtP.rate)} في ${Store.periodLabel(prev, true)} — المحصَّل ${money(mtM.collected)} من ${money(mtM.due)} مستحقة.`,
        go: '#matrix',
      }));
    }
    // تركّز المتأخرات
    if (ar.total > 0) {
      const byUnit = {};
      ar.rows.forEach(r => { byUnit[r.unitId] = (byUnit[r.unitId] || 0) + r.amount; });
      const sorted = Object.entries(byUnit).sort((a, b) => b[1] - a[1]);
      const top3 = sorted.slice(0, 3);
      const share = Math.round(top3.reduce((s, x) => s + x[1], 0) / ar.total * 100);
      cards.push(insightCard({
        tone: 'critical', ic: 'warn',
        num: share + '٪',
        title: `من المتأخرات متركّزة في ${top3.length} وحدات فقط`,
        text: top3.map(([uid, v]) => `${unitLabel(uid)} (${money(v, { bare: true })})`).join(' · ') + ' — ابدأ التحصيل من هنا.',
        go: '#matrix', filters: { st: 'arrears' },
      }));
    }
    // مقارنة الكشوف
    const bRates = Store.state.buildings.map(b => {
      const bset = new Set(Store.state.units.filter(u => u.buildingId === b.id && uset.has(u.id)).map(u => u.id));
      if (!bset.size) return null;
      const t = Store.monthTotals(m, asOf, bset);
      return t.due > 0 ? { b, rate: t.rate } : null;
    }).filter(Boolean).sort((a, b) => b.rate - a.rate);
    if (bRates.length > 1) {
      const best = bRates[0], worst = bRates[bRates.length - 1];
      cards.push(insightCard({
        tone: 'accent', ic: 'home',
        num: pct(best.rate),
        title: `أفضل الكشوف تحصيلًا في ${Store.periodLabel(m)}: ${best.b.name}`,
        text: `الأدنى: ${worst.b.name} بنسبة ${pct(worst.rate)} — فرق ${Math.round((best.rate - worst.rate) * 100)} نقطة يستحق سؤال «ليه؟».`,
      }));
    }
    // منحدر الإيراد التعاقدي
    const h1 = rev.series.slice(0, 6).reduce((s, x) => s + x.amount, 0);
    const h2 = rev.series.slice(6).reduce((s, x) => s + x.amount, 0);
    if (h1 > 0 && h2 / h1 < 0.85) {
      cards.push(insightCard({
        tone: 'serious', ic: 'trendDown',
        num: '-' + Math.round((1 - h2 / h1) * 100) + '٪',
        title: 'الإيراد المتعاقد عليه ينخفض في النصف الثاني من السنة القادمة',
        text: `${money(h1)} في أول 6 أشهر مقابل ${money(h2)} في التالية — عقود تنتهي بلا تجديد مسجّل. راجع خط العقود الزمني.`,
        go: '#contracts',
      }));
    }
    // الفجوة المعرفية
    if (ar.unknowns.length || ar.undocumentedTotal > 0) {
      cards.push(insightCard({
        tone: 'warning', ic: 'question',
        num: money(ar.undocumentedTotal, { bare: true }),
        title: `لم يُحسم أمرها: ${pluralMonths(ar.unknowns.length)} متأخرة بقيمة مجهولة`,
        text: 'كل بند منها له سؤال جاهز للمالك في «مراجعات مطلوبة» — إجابته تضع المبلغ في مكانه الصحيح: سداد يُوثَّق أو متأخرات تُسجَّل.',
        go: '#quality',
      }));
    }
    // فاقد الشواغر
    const typeAvg = {};
    for (const u of filteredUnits(asOf)) {
      const act = Store.activeContractOn(u.id, asOf);
      if (!act) continue;
      const y = act.years.find(yy => Store.d(yy.from) <= asOf && asOf <= Store.d(yy.to));
      if (!y) continue;
      const monthly = Store.state.settings.rentBasis === 'annual' ? y.rent / 12 : y.rent;
      (typeAvg[u.type] = typeAvg[u.type] || []).push(monthly);
    }
    const avgOf = t => typeAvg[t] ? typeAvg[t].reduce((s, v) => s + v, 0) / typeAvg[t].length : null;
    let vacLoss = 0, vacN = 0;
    [...occ.ended, ...occ.noContract].forEach(x => {
      const a = avgOf(x.unit.type);
      if (a) { vacLoss += a; vacN++; }
    });
    if (vacLoss > 0) {
      cards.push(insightCard({
        tone: 'serious', ic: 'bolt',
        num: '≈' + money(vacLoss, { bare: true }),
        title: `فاقد إيراد شهري تقديري من ${vacN} وحدات بلا عقد نشط`,
        text: 'محسوب من متوسط إيجار النوع المماثل — كل شهر تأخير في التأجير أو التجديد يكلّف هذا الرقم.',
        go: '#units', filters: { st: 'notEarning' },
      }));
    }

    /* ---------- التزام السداد بالعميل (من الدفعات الموثقة فقط) ---------- */
    const grace = Store.state.settings.graceDays;
    const compliance = [];
    for (const t of Store.state.tenants) {
      const pays = Store.state.payments.filter(p => {
        if (!p.date || !uset.has(p.unitId)) return false;
        return Store.state.contracts.some(c => c.id === p.contractId && c.tenantId === t.id);
      });
      if (pays.length < 3) continue;
      let onTime = 0;
      for (const p of pays) {
        const c = Store.contract(p.contractId);
        const dd = Store.dueDateOf(c, p.period);
        if (Store.daysBetween(dd, Store.d(p.date)) <= grace) onTime++;
      }
      compliance.push({ t, rate: onTime / pays.length, n: pays.length });
    }
    compliance.sort((a, b) => b.rate - a.rate);

    /* ---------- توزيعات ---------- */
    const stateCounts = [
      { label: 'مؤجَّرة', v: occ.occupied.length, color: '#0ca30c' },
      { label: 'منتهية بلا تجديد', v: occ.ended.length, color: '#d03b3b' },
      { label: 'بلا عقد / شاغرة', v: occ.noContract.length, color: '#c3c2b7' },
    ];
    const methods = {};
    Store.state.payments.filter(p => uset.has(p.unitId)).forEach(p => {
      methods[p.method] = (methods[p.method] || 0) + p.amount;
    });
    const methodItems = Object.entries(methods).sort((a, b) => b[1] - a[1])
      .map(([label, v]) => ({ label, v }));
    const avgItems = Object.keys(typeAvg).map(t => ({ label: t, v: Math.round(avgOf(t)) }))
      .sort((a, b) => b.v - a.v);
    const byUnitAll = {};
    ar.rows.forEach(r => { byUnitAll[r.unitId] = (byUnitAll[r.unitId] || 0) + r.amount; });
    const debtors = Object.entries(byUnitAll).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([uid, v]) => {
        const tid = unitTenantIds(Store.unit(uid)).slice(-1)[0];
        return { label: unitLabel(uid), v, sub: tid ? tenantLabel(tid) : null };
      });

    const quick = h('div.tiles', [
      statTile({ label: 'الكشوف', value: String(Store.state.buildings.length), ic: 'doc', tone: 'accent', sub: 'كل كشف ورقي = كيان مستقل بمؤشراته' }),
      statTile({ label: 'الوحدات', value: String(filteredUnits(asOf).length), ic: 'home', tone: 'good' }),
      statTile({ label: 'عقود نشطة', value: String(occ.occupied.length), ic: 'doc', tone: 'violet' }),
      statTile({ label: 'دفعات موثَّقة', value: String(Store.state.payments.filter(p => uset.has(p.unitId)).length), ic: 'money', tone: 'accent', sub: 'بمبلغ وتاريخ وإيصال — كشف سكرية كله علامات تحتاج تأكيدًا حتى الآن' }),
    ]);

    /* ---------- تحليل العقود (من نموذج العقد الفعلي وبياناته) ---------- */
    const activeCs = Store.state.contracts.filter(c => uset.has(c.unitId) && Store.d(c.start) <= asOf && asOf <= Store.d(c.end));
    const allCs = Store.state.contracts.filter(c => uset.has(c.unitId));
    const durations = allCs.map(c => Math.round(Store.daysBetween(Store.d(c.start), Store.d(c.end)) / 30.44));
    const avgDur = durations.length ? Math.round(durations.reduce((s2, v) => s2 + v, 0) / durations.length) : null;
    const incs = [];
    allCs.forEach(c => {
      for (let i = 1; i < c.years.length; i++)
        if (c.years[i - 1].rent > 0 && !c.years[i].estimated)
          incs.push(Math.round((c.years[i].rent / c.years[i - 1].rent - 1) * 100));
    });
    const incMode = incs.length
      ? [...incs.sort((a, b) => a - b)][Math.floor(incs.length / 2)] : null;
    const withDep = activeCs.filter(c => c.deposit && c.deposit.amount > 0).length;
    const withMnt = activeCs.filter(c => c.maintenance > 0).length;
    const withVat = activeCs.filter(c => c.vat).length;
    // تقويم الانتهاءات: كم عقدًا نشطًا ينتهي في كل شهر من الـ12 القادمة (بلا تجديد مسجّل)
    const endCal = [];
    for (let i = 0; i < 12; i++) {
      const p = Store.addMonths(currentPeriod(), i);
      const n = activeCs.filter(c => c.end.slice(0, 7) === p && !Store.nextContract(c)).length;
      endCal.push({ period: p, amount: n });
    }
    const peak = [...endCal].sort((a, b) => b.amount - a.amount)[0];
    const contractTiles = h('div.tiles', [
      statTile({ label: 'متوسط مدة العقد', value: avgDur == null ? '—' : avgDur + ' شهرًا', ic: 'clock', tone: 'accent' }),
      statTile({ label: 'الزيادة السنوية السائدة', value: incMode == null ? '—' : incMode + '٪', ic: 'trend', tone: 'good', sub: 'من قيم السنوات المدوَّنة فعلًا — تُستخدم افتراضًا للعقود الجديدة' }),
      statTile({
        label: 'عقود نشطة بتأمين مسجّل', value: `${withDep} من ${activeCs.length}`, ic: 'shield', tone: withDep < activeCs.length ? 'warning' : 'good',
        sub: 'البند الخامس: التأمين «بواقع شهر» — الناقص فجوة توثيق',
      }),
      statTile({
        label: 'بصيانة / خاضعة للضريبة', value: `${withMnt} · ${withVat}`, ic: 'doc', tone: 'violet',
        sub: 'البند الرابع (صيانة شهرية مع الإيجار) والعاشر (ض.ق.م على العميل)',
      }),
    ]);

    const contractsSection = h('div.grid-2', [
      sectionCard('تقويم انتهاءات العقود — 12 شهرًا (بلا تجديد مسجّل)',
        peak && peak.amount > 0
          ? h('div', [
              Charts.revenueChart(endCal, { count: true, countLabel: 'عقود تنتهي', ariaLabel: 'عدد العقود المنتهية شهريًا' }),
              h('p.note-line', [icon('warn'), ` الذروة: ${Store.periodLabel(peak.period, true)} (${peak.amount} ${peak.amount === 1 ? 'عقد' : 'عقود'}) — ابدأ مفاوضات التجديد قبلها بـ90 يومًا.`]),
            ])
          : emptyState('لا انتهاءات خلال 12 شهرًا')),
      sectionCard('حالة الوحدات', h('div.donut-row', [
        Charts.donut(stateCounts.filter(p => p.v > 0), String(occ.total), 'وحدة'),
        h('ul.donut-legend', stateCounts.map(p => h('li', [
          h('span.legend-swatch', { style: { background: p.color, width: '14px', height: '14px' } }),
          h('span', `${p.label}: ${p.v}`),
        ]))),
      ])),
    ]);

    return h('div.view', [
      pageHead('التحليلات', 'قراءات جاهزة من البيانات — كل بطاقة تنقلك لمكان اتخاذ الإجراء.'),
      basisBanner(),
      demoBanner(),
      h('div.insights-grid', cards),
      quick,
      h('div.grid-2', [
        sectionCard('اتجاه نسبة التحصيل — 12 شهرًا', Charts.lineChart(rates, { label: 'اتجاه نسبة التحصيل' })),
        sectionCard('أعلى المتأخرين', debtors.length
          ? Charts.typeBars(debtors)
          : emptyState('لا متأخرات مؤكَّدة ضمن الترشيح')),
      ]),
      h('h3.sec-title', 'تحليل العقود — من نموذج العقد الفعلي وبياناته'),
      contractTiles,
      contractsSection,
      h('div.grid-2', [
        sectionCard('متوسط الإيجار الشهري حسب النوع', avgItems.length
          ? Charts.typeBars(avgItems)
          : emptyState('لا عقود نشطة')),
        sectionCard('توزيع المحصَّل حسب طريقة السداد', methodItems.length
          ? Charts.typeBars(methodItems)
          : emptyState('لا دفعات موثَّقة بعد')),
      ]),
      sectionCard('التزام السداد بالعميل (من الدفعات الموثَّقة فقط)', compliance.length
        ? h('div.mini-scroll', h('table.table.table-mini', [
            h('thead', h('tr', [h('th', 'العميل'), h('th', 'دفعات موثَّقة'), h('th', 'في الميعاد'), h('th', 'التقييم')])),
            h('tbody', compliance.slice(0, 10).map(x => h('tr', [
              h('td', x.t.name),
              h('td', String(x.n)),
              h('td', pct(x.rate)),
              h('td', x.rate >= 0.9 ? statusChip('good', 'ملتزم')
                : x.rate >= 0.6 ? statusChip('warning', 'متذبذب')
                : statusChip('critical', 'متعثر')),
            ]))),
          ]))
        : emptyState('يُحسب من الدفعات الموثَّقة فقط', 'كشف سكرية كله علامات ✓ بلا تواريخ — أول شهر توثيق حقيقي سيُظهر هذا الجدول')),
      h('div.grid-2', [
        sectionCard('الدخل السنوي المتوقع لكل مشروع (التأمينات مفصولة — ليست دخلًا)',
          (function () {
            const rows = Store.annualByProject(currentPeriod());
            return rows.length
              ? h('div', [
                  Charts.typeBars(rows.map(r => ({ label: r.building.name, v: r.annual, sub: 'تأمينات محتجزة: ' + money(r.deposits) }))),
                  h('p.note-line', [icon('shield'), ' التأمينات التزام يُرَد — اعرف سيولتك الحقيقية بدونها.']),
                ])
              : emptyState('لا بيانات');
          })()),
        sectionCard('تركيز المخاطر والتقييم العام', (function () {
          const risk = Store.topTenantShare(defaultDashMonth(), uset);
          const health = Store.healthScore(asOf, uset);
          return h('div.insights-grid', [
            risk ? insightCard({
              tone: risk.share >= 35 ? 'serious' : 'accent', ic: 'warn',
              num: risk.share + '٪',
              title: `من دخل الشهر معتمد على عميل واحد: ${risk.tenant.name}`,
              text: risk.share >= 35
                ? 'اعتماد مرتفع — خروجه يؤثر بشدة على الدخل. نوِّع العقود القادمة أو أمِّن تجديده مبكرًا.'
                : 'توزيع صحي للدخل على العملاء.',
            }) : emptyState('لا بيانات'),
            insightCard({
              tone: health.score >= 75 ? 'good' : health.score >= 50 ? 'warning' : 'critical', ic: 'shield',
              num: health.score + '/100',
              title: 'التقييم العام — مؤشر مجمَّع',
              text: `تحصيل ${health.parts.collectScore}/40 · إشغال ${health.parts.occScore}/25 · خصم عدم التأكيد ${health.parts.unknownPenalty} · خصم تعمّر المتأخرات ${health.parts.agingPenalty} · خصم الانتهاءات ${health.parts.expiringPenalty}`,
            }),
          ]);
        })()),
      ]),
    ]);
  }

  /* ========================================================
     10) إدخال كشف جديد — معالج تفريغ ورقة كاملة
     ======================================================== */
  function viewIntake() {
    const bid = VS.wizardBid && Store.building(VS.wizardBid) ? VS.wizardBid : null;

    /* الخطوة 1: بيانات الكشف */
    const ownerIn = input({ type: 'text', placeholder: 'مثال: عبدالمنعم سكرية' });
    const areaIn = input({ type: 'text', placeholder: 'مثال: الدقي — الجيزة' });
    const step1 = sectionCard('الخطوة 1 — بيانات المشروع (الورقة)', bid
      ? h('p.step-done', [icon('check'), ' الكشف: ', h('b', Store.building(bid).name),
          ' — أضف صفوفه بالأسفل، أو ', h('a', { href: '#intake', onclick: e => { e.preventDefault(); VS.wizardBid = null; App.render(); } }, 'ابدأ كشفًا آخر'), '.'])
      : h('div', [
          h('p.step-hint', 'كل ورقة تصلك = مشروع مستقل باسم مالكها. اكتب اسم المالك كما هو مدوَّن على الورقة.'),
          h('div.form-inline', [
            ownerIn, areaIn,
            h('button.btn.btn-primary', {
              onclick: () => {
                if (!ownerIn.value.trim()) { toast('اكتب اسم المالك', 'warning'); return; }
                const b = Store.addBuilding({
                  name: 'بيان ' + ownerIn.value.trim(),
                  owner: ownerIn.value.trim(), area: areaIn.value.trim(),
                });
                VS.wizardBid = b.id;
                App.render();
              },
            }, [icon('plus'), ' إنشاء المشروع']),
          ]),
        ]));

    /* الخطوة 2: صفوف الورقة — بنفس أعمدتها: اسم العميل، الوحدة، من، قيم 1/2/3، تأمين، ملاحظات */
    let step2 = null, step3 = null;
    if (bid) {
      const s = Store.state.settings;
      const existingTypes = [...new Set(Store.state.units.map(u => u.type))];
      const tIn = input({ type: 'text', placeholder: 'كما في عمود «اسم العميل»' });
      const uIn = input({ type: 'text', placeholder: 'كما في عمود «الوحدة»' });
      const tyIn = input({ type: 'text', list: 'ij-types', placeholder: 'اكتب أي نوع…', value: '' });
      const dl = h('datalist#ij-types', existingTypes.map(t => h('option', { value: t })));
      const fromIn = input({ type: 'date' });
      /* أعمدة السنوات كما في الورقة — تبدأ بثلاثة وتتمدد لما تكون مدة العقد أطول (حتى عشر) */
      const yearIns = [];
      const yearsBox = h('div.intake-years');
      const endPrev = h('span.field-hint');
      const addYearBtn = h('button.btn.btn-ghost', { onclick: () => { addYearCol(); refreshEnd(); } }, '+ عمود سنة');
      function addYearCol() {
        if (yearIns.length >= 10) { toast('أقصى مدة عشر سنوات', 'warning'); return; }
        const i = yearIns.length;
        const el = input({ type: 'number', min: 0, placeholder: `عمود «${i + 1}»${i ? ' — اختياري' : ''}` });
        el.addEventListener('input', refreshEnd);
        yearIns.push(el);
        yearsBox.appendChild(field('قيمة السنة ' + (i + 1), el));
        addYearBtn.textContent = yearIns.length >= 10 ? 'اكتملت عشر سنوات' : '+ عمود سنة';
        addYearBtn.disabled = yearIns.length >= 10;
      }
      for (let i = 0; i < 3; i++) addYearCol();
      const depIn = input({ type: 'number', min: 0, placeholder: 'إن ذُكر في الملاحظات' });
      const noteIn = input({ type: 'text', placeholder: 'عمود «ملاحظات» بنصّه' });
      function refreshEnd() {
        const nY = yearIns.filter(x => Number(x.value) > 0).length;
        if (fromIn.value && nY) {
          const [y, mo, dd] = fromIn.value.split('-').map(Number);
          const end = new Date(Date.UTC(y + nY, mo - 1, dd)); end.setUTCDate(end.getUTCDate() - 1);
          endPrev.textContent = `النهاية تلقائيًا: ${shortDate(Store.iso(end))} (${nY} ${nY === 1 ? 'سنة' : 'سنوات'})`;
        } else endPrev.textContent = 'أدخل البداية وقيمة سنة واحدة على الأقل';
      }
      fromIn.addEventListener('input', refreshEnd);
      refreshEnd();
      const fill10 = h('button.btn.btn-ghost', {
        onclick: () => {
          const r1 = Number(yearIns[0].value);
          if (!r1) { toast('أدخل قيمة السنة 1 أولًا', 'warning'); return; }
          for (let i = 1; i < yearIns.length; i++) {
            if (!yearIns[i].value) yearIns[i].value = Math.round(Number(yearIns[i - 1].value) * 1.1);
          }
          refreshEnd();
        },
      }, 'املأ باقي السنوات بزيادة 10٪ (النمط السائد)');

      const bUnits = Store.state.units.filter(u => u.buildingId === bid);
      const rowsTable = bUnits.length
        ? h('table.table.table-mini', [
            h('thead', h('tr', [h('th', 'الوحدة'), h('th', 'العميل'), h('th', 'من'), h('th', 'إلى'),
              h('th', 'سنة 1'), h('th', 'سنة 2'), h('th', 'سنة 3'), h('th', 'ملاحظات')])),
            h('tbody', bUnits.map(u => {
              const c = Store.unitContracts(u.id).slice(-1)[0];
              return h('tr', [
                h('td', u.name),
                h('td', c ? tenantLabel(c.tenantId) : h('span.val-warning', 'بلا عقد')),
                h('td', c ? shortDate(c.start) : '—'),
                h('td', c ? shortDate(c.end) : '—'),
                h('td', c && c.years[0] ? money(c.years[0].rent, { bare: true }) : '—'),
                h('td', c && c.years[1] ? money(c.years[1].rent, { bare: true }) : '—'),
                h('td', c && c.years[2] ? money(c.years[2].rent, { bare: true }) : '—'),
                h('td', u.note || '—'),
              ]);
            })),
          ])
        : h('p.step-hint', 'لم تُضف صفوف بعد.');

      step2 = sectionCard(`الخطوة 2 — صفوف الورقة (${bUnits.length})`, h('div', [
        dl,
        h('p.step-hint', 'نفس أعمدة الورقة بالظبط: اسم العميل · الوحدة · من · قيم السنوات (' +
          (s.rentBasis === 'monthly' ? 'شهري' : 'سنوي') + ' — بنص البند الثالث في العقد) · ملاحظات. ثلاثة أعمدة كما في ورقتك، وزِد أعمدة إن كان العقد أطول. ما لم يُدوَّن في الورقة اتركه فارغًا — الفراغ معلومة لا خطأ.'),
        h('div.intake-grid', [
          field('اسم العميل', tIn), field('الوحدة', uIn), field('النوع', tyIn, 'اكتب أي نوع جديد بحرّية'),
          field('من (بداية العقد)', fromIn, ''),
          field('التأمين', depIn), field('ملاحظات', noteIn),
        ]),
        h('div.intake-grid', yearsBox),
        h('div.btn-row', [addYearBtn]),
        h('p.field-hint', endPrev),
        h('div.btn-row', [
          h('button.btn.btn-primary', {
            onclick: () => {
              if (!uIn.value.trim() && !tIn.value.trim()) { toast('اكتب الوحدة أو اسم العميل على الأقل — كما تترك الورقة نفسها أحدهما أحيانًا', 'warning'); return; }
              const unit = Store.addUnit({
                buildingId: bid,
                name: uIn.value.trim() || ('وحدة غير محددة — ' + tIn.value.trim()),
                type: tyIn.value.trim() || 'غير محدد',
                note: noteIn.value.trim(),
              });
              const years = yearIns.map(x => Number(x.value)).filter(v => v > 0).map(v => ({ rent: v }));
              if (tIn.value.trim() && fromIn.value && years.length) {
                const tenant = Store.addTenant({ name: tIn.value.trim() });
                Store.addContract({ unitId: unit.id, tenantId: tenant.id, start: fromIn.value, years, deposit: depIn.value || null });
                toast(`أُضيف الصف: عقد ${years.length === 1 ? 'سنة' : years.length + ' سنوات'} بقيمه المدوَّنة`);
              } else {
                toast('أُضيف الصف ناقصًا — سيظهر «بلا عقد مسجّل» حتى تُستكمل بياناته');
              }
              [tIn, uIn, depIn, noteIn, ...yearIns].forEach(x => x.value = '');
              App.render();
            },
          }, [icon('plus'), ' أضف الصف']),
          fill10,
        ]),
        h('h4.drawer-sec', 'الصفوف المُدخلة (مطابقة لأعمدة الورقة)'),
        rowsTable,
      ]));

      step3 = sectionCard('الخطوة 3 — علامات الشهور ✓/✗', bUnits.length
        ? h('div', [
            h('p.step-hint', 'افتح جدول التحصيل بوضع نقل الورقة: كل ضغطة على خلية تقلّبها ✓ ← ✗ ← فارغ — بسرعة الورقة نفسها. اترك ما سكتت عنه الورقة فارغًا وسيعلّمه النظام «يحتاج تأكيد».'),
            h('button.btn.btn-primary', {
              onclick: () => {
                App.filters.b = bid;
                VS.tafrigh = true;
                VS.matrixYear = Store.today().getUTCFullYear();
                location.hash = '#matrix';
              },
            }, [icon('bolt'), ` ابدأ نقل العلامات (${bUnits.length} ${bUnits.length === 1 ? 'صف' : 'صفوف'})`]),
          ])
        : h('p.step-hint', [icon('warn'), ' العلامات بتتعلّم على صفوف الورقة — أضف الصفوف في الخطوة 2 الأول وبعدها الزر هيظهر هنا.']));
    }

    [step1, step2, step3].forEach((s2, i) => {
      if (s2) { s2.classList.add('step-card'); s2.dataset.step = String(i + 1); }
    });
    return h('div.view', [
      pageHead('إضافة مشروع جديد', 'ثلاث خطوات تحوِّل أي ورقة تصلك إلى مشروع حي بمؤشراته — دون Excel وسيط.'),
      step1, step2, step3,
    ].filter(Boolean));
  }

  /* جدول أنواع الإدخال — مرجع سريع (يُعرض في دليل الشرح) */
  function codesCard() {
    const b0 = Store.state.buildings[0] || {};
    const u0 = Store.state.units[0] || {};
    return sectionCard('الأكواد — كيف تجد أي شيء في ثانية', h('div', [
      h('p.step-hint', 'لكل مشروع ووحدة كود قصير يولِّده النظام تلقائيًا، وللعميل كود تُدخله أنت هو رقمه القومي. اكتب أي كود في خانة البحث أعلى الشاشة وستصل مباشرة.'),
      h('div.mini-scroll', h('table.table.table-mini', [
        h('thead', h('tr', [h('th', 'الكود'), h('th', 'شكله'), h('th', 'من أين يأتي'), h('th', 'مثال من بياناتك')])),
        h('tbody', [
          ['كود المشروع', 'P ثم رقم', 'يُولَّد تلقائيًا عند إضافة مشروع', (b0.code || 'P1') + ' — ' + (b0.name || '')],
          ['كود الوحدة', 'كود المشروع ثم رقم متسلسل', 'يُولَّد تلقائيًا عند إضافة وحدة', (u0.code || 'P1-01') + ' — ' + (u0.name || '')],
          ['كود العميل', 'الرقم القومي (14 رقمًا) أو السجل التجاري', 'تُدخله عند تسجيل العميل — والنظام يمنع تكراره لعميلَين', '28501011234567'],
        ].map(r => h('tr', [h('td', h('b', r[0])), h('td', h('code.code-chip', r[1])), h('td', r[2]), h('td', r[3])]))),
      ])),
    ]));
  }

  function rentModesCard() {
    return sectionCard('قيمة كل سنة في العقد — طريقتان', h('div', [
      h('p.step-hint', 'عند تسجيل عقد تختار كيف تُحسب قيمة كل سنة، والاختيار يظهر في الفورم نفسه:'),
      h('div.mini-scroll', h('table.table.table-mini', [
        h('thead', h('tr', [h('th', 'الطريقة'), h('th', 'متى تستخدمها'), h('th', 'ماذا تُدخل'), h('th', 'مثال')])),
        h('tbody', [
          ['زيادة سنوية بنسبة', 'العقد ينص على زيادة ثابتة سنويًا (النمط السائد عندكم: 10٪)',
            'قيمة السنة الأولى + النسبة — والباقي يُحسب', '10,000 ← 11,000 ← 12,100 (زيادة 10٪)'],
          ['أكتب قيمة كل سنة بنفسي', 'العقد يدوِّن قيمة مختلفة لكل سنة بلا نسبة منتظمة',
            'خانة لكل سنة بعدد سنوات العقد (حتى عشر)', '25,000 · 27,000 · 30,000 · 30,000 · 35,000'],
        ].map(r => h('tr', [h('td', h('b', r[0])), h('td', r[1]), h('td', r[2]), h('td', r[3])]))),
      ])),
      h('p.field-hint', 'مدة العقد تصل إلى عشر سنوات، وعدد الخانات في الطريقة اليدوية يتبع المدة التي تختارها.'),
    ]));
  }

  function entryTypesCard() {
    return sectionCard('أنواع الإدخال في النظام — ماذا تُدخل ومن أين', h('div.mini-scroll', h('table.table.table-mini', [
      h('thead', h('tr', [h('th', 'ماذا تريد أن تُدخل؟'), h('th', 'من أين'), h('th', 'الخطوات باختصار')])),
      h('tbody', [
        ['مشروع جديد (ورقة كاملة)', '«إضافة مشروع جديد»', 'اسم المالك ← صفوف الورقة ← نقل علامات ✓/✗'],
        ['دفعة شهر واحد', 'جدول التحصيل', 'اضغط خلية الشهر ← المبلغ مُعبَّأ بالمتبقي ← احفظ'],
        ['سداد شهر كامل (دفعة واحدة للجميع)', 'جدول التحصيل ← «سداد جماعي»', 'حدِّد من سدَّدوا ← تاريخ وطريقة موحَّدان ← حفظ'],
        ['عقد جديد أو تجديد', 'العقود ← «عقد جديد» أو زر «+ إدخال»', 'العميل (بالاسم أو الرقم القومي) ← البداية والمدة (حتى 10 سنوات) ← المشروع ← وحدة متاحة ← قيمة السنة الأولى — وباقي السنوات تتولَّد بالنسبة أو تكتبها بيدك'],
        ['تقرير شامل للمالك', 'الإعدادات ← «التقرير الشامل (Excel)»', 'ملف Excel واحد بأوراق منسَّقة: المشاريع والعقود والعملاء والمتأخرات والتحصيل والدفعات والشواغر والمراجعات'],
        ['وحدة داخل مشروع قائم', 'الوحدات ← «وحدة جديدة»', 'اختر المشروع ← الاسم والنوع'],
        ['عميل أو تعديل بياناته', 'العملاء', 'اضغط الصف ليفتح ملفه ← «تعديل البيانات» بالأسفل — أو زر «عميل جديد»'],
        ['تعديل عقد قائم', 'العقود ← زر «تعديل» في آخر الصف', 'غيِّر المدة أو القيم أو الصيانة والتأمين — ويُعاد حساب الاستحقاق فورًا'],
        ['حذف عقد سُجِّل بالخطأ', 'العقود ← «تعديل» ← «حذف العقد»', 'مسموح ما لم تكن عليه دفعات مسجَّلة — احذف الدفعات أولًا إن وُجدت'],
        ['تعديل بيانات وحدة', 'الوحدات ← اضغط الوحدة ← «تعديل بيانات الوحدة»', 'الاسم والنوع والدور والمساحة — والكود ثابت لا يتغير'],
        ['تعديل بيانات مشروع', 'الإعدادات ← جدول «المشاريع» ← «تعديل»', 'الاسم والمالك والمنطقة — والكود ثابت لا يتغير'],
        ['شكوى صيانة', 'الشكاوى ← «شكوى جديدة»', 'الوحدة ← التصنيف والتكلفة ومن يتحمَّلها'],
        ['رد المالك على سؤال مراجعة', 'مراجعات مطلوبة', '«سجّل رد المالك» ← اكتب الإجابة — يُغلق البند'],
      ].map(r => h('tr', [h('td', h('b', r[0])), h('td', r[1]), h('td', r[2])]))),
    ])));
  }

  /* ========================================================
     11) دليل الشرح — توثيق كل صفحة وكل بطاقة: المصدر والحساب ومثال حي
     ======================================================== */
  function docItem(it) {
    return h('div.doc-item', [
      h('div.doc-name', it.name),
      h('div.doc-row', [h('span.doc-k', 'يعبّر عن'), h('span', it.what)]),
      h('div.doc-row', [h('span.doc-k', 'مصدره'), h('span', it.source)]),
      h('div.doc-row', [h('span.doc-k', 'حسابه'), h('span', it.calc)]),
      it.example ? h('div.doc-row.doc-ex', [h('span.doc-k', 'مثال حي'), h('span', it.example)]) : null,
    ]);
  }
  function docSection(title, sub, items) {
    return h('section.card.doc-sec', [
      h('h3.doc-title', title),
      sub ? h('p.doc-sub', sub) : null,
      h('div.doc-items', items.map(docItem)),
    ]);
  }

  function viewGuide() {
    const asOf = Store.today();
    const m = defaultDashMonth();
    const mt = Store.monthTotals(m, asOf);
    const ar = Store.arrears(asOf);
    const rev = Store.contractedRevenue(currentPeriod(), 12);
    const u3 = Store.unit('U3');
    const ci3 = u3 ? Store.cellInfo('U3', '2026-05', asOf) : null;

    /* خريطة العملية الكاملة */
    const FLOW = [
      ['1. استلام الورقة', 'بيان ورقي من مالك عقار (زي «بيان عبدالمنعم سكرية») + نموذج عقد. الورقة = كشف مستقل في المنظومة.'],
      ['2. تفريغ الكشف', 'شاشة «إضافة مشروع جديد»: بيانات المالك ← صفوف الورقة بنفس أعمدتها (اسم العميل/الوحدة/من/قيم 1-2-3/ملاحظات) ← علامات ✓/✗ من جدول التحصيل بوضع نقل الورقة. الخانة الفارغة تُسجَّل «يحتاج تأكيد» — الفراغ معلومة.'],
      ['3. مراجعة الجودة', 'كل تناقض أو نقص يتسجّل تلقائيًا في «مراجعات مطلوبة» بنص المصدر الحرفي. تقعد مع المالك جلسة واحدة تقفل الأسئلة (تليفونات، تأمينات، قيم ناقصة، فراغات = سداد ولا تأخير؟).'],
      ['4. التشغيل اليومي', 'التحصيل الجديد يتسجّل دفعة كاملة (مبلغ+تاريخ+طريقة+إيصال) من خلية جدول التحصيل أو بالسداد الجماعي. عقد جديد/تجديد من زر «+ إدخال». شكوى تتسجّل بتصنيفها وتكلفتها.'],
      ['5. المتابعة بالاستثناء', 'مش بتراجع 1000 وحدة — بتفتح «من لم يسدِّد؟» والتنبيهات والتحليلات: بيوروك بس اللي محتاج قرار (متأخر، عقد بينتهي، فجوة توثيق).'],
      ['6. التقارير والقرار', 'التقرير الشامل (Excel) للمالك — ثماني أوراق منسَّقة، وبجانبه تصديرات CSV مفردة + التحليلات للقرارات: مين نطارده، إمتى نجدد، فين الفاقد.'],
    ];
    const flowNode = h('div.flow', FLOW.map(([t, d], i) =>
      h('div.flow-step', [h('span.flow-num', String(i + 1)), h('div', [h('b.flow-t', t.replace(/^\d+\. /, '')), h('p.flow-d', d)])])));

    /* سلسلة الاشتقاق: من الورقة للأرقام */
    const chain = docSection('من الورقة إلى الإنسايتس — سلسلة الاشتقاق كاملة',
      'إزاي «مجرد إكسيل» بيطلّع كل الأرقام دي؟ كل مؤشر في المنظومة نتيجة 3 حقائق من الورقة + قاعدة حساب معلنة:',
      [
        { name: 'الحقيقة 1: العقد (من/إلى + قيم السنوات 1-2-3)',
          what: 'بيولّد «جدول استحقاق»: كل شهر داخل مدة العقد عليه مبلغ مستحق',
          source: 'أعمدة «من/إلى/1/2/3» في الورقة — والبند الثالث في العقد بينص إن القيمة «شهريًا»',
          calc: 'استحقاق الشهر = قيمة سنة العقد الجارية (+ الصيانة إن وُجدت + الضريبة للخاضعين). الشهر المقطوع بين سنتين يتحسب باليوم',
          example: ci3 && ci3.due ? `الميزان 1 — مايو 2026: 19 يومًا بسعر 45,100→49,610 و12 يومًا بالسنة الثالثة = ${money(ci3.due.amount)}` : '' },
        { name: 'الحقيقة 2: علامة الشهر (✓ / ✗ / شاغرة)',
          what: '✓ = حصل سداد (بلا تفاصيل) · ✗ = متأخر مؤكد · الشاغرة = لا نعرف',
          source: 'شبكة الشهور في الورقة، بتتفرّغ كما هي بوضع نقل الورقة',
          calc: '✓ تُحسب سدادًا كاملًا بقيمة الاستحقاق (افتراض مُعلَن لحد ما تتوثّق) · ✗ يدخل المتأخرات · الشاغرة يتعلّم «يحتاج تأكيدًا» ولا يدخل أي إجمالي إلا بقيمته المحتملة منفصلة',
          example: `تقوى عبدالمنعم: يناير–مارس فارغة في الورقة = ${money(198000)} «يحتاج تأكيدًا» — ليست متأخرات وليست تحصيلًا` },
        { name: 'الحقيقة 3: التاريخ الجاري (النهارده)',
          what: 'بيحوّل الجدول لحالات: مدفوع/مستحق/متأخر/لم يستحق',
          source: 'ساعة الجهاز + يوم الاستحقاق في العقد (أول الشهر بنص بنود العقد) + أيام السماح من الإعدادات',
          calc: 'شهر مستحق بلا سداد وتجاوز (يوم الاستحقاق + السماح) ⇒ متأخر، وعمره = عدد الأيام منذ الاستحقاق ⇒ شرائح 30/60/90',
          example: `يوليو 2026 كله بلا أي علامة في الورقة ⇒ ${money(453254)} متأخرات مؤكدة عمرها 31–60 يومًا` },
        { name: 'كل المتبقّي تجميعات',
          what: 'أي كارد أو رسم في المنظومة هو مجموع/نسبة/ترتيب للحالات دي — مفيش رقم بيتكتب يدويًا',
          source: 'محرك الحالات أعلاه',
          calc: 'تحصيل الشهر = Σ محصَّل ÷ Σ مستحق · المتأخرات = Σ (مستحق−مسدَّد) للمتأخر · الإشغال = وحدات بعقد نشط ÷ الكل · إلخ',
          example: `تحصيل ${Store.periodLabel(m, true)} = ${money(mt.collected, { bare: true })} ÷ ${money(mt.due, { bare: true })} = ${mt.rate == null ? '—' : pct(mt.rate)}` },
      ]);

    /* بنود العقد → النظام */
    const contractMap = docSection('نموذج العقد الفعلي → أثره في المنظومة',
      'قرأنا عقد العينة (قانون 4 لسنة 2006) بندًا بندًا — ده اللي اتبني منه:',
      [
        { name: 'البند الثالث: القيمة الإيجارية «جنيه شهريًا»', what: 'حسم سؤال شهري/سنوي', source: 'نص البند', calc: 'أساس الحساب شهري (قابل للتبديل من الإعدادات لو ظهر عقد مختلف)', example: 'بند الجودة Q22 اتحدّث بالنص' },
        { name: 'سداد الإيجار «في اليوم الأول من الشهر الميلادي»', what: 'يوم الاستحقاق وبداية عدّ التأخير', source: 'بند الالتزامات', calc: 'خانة «يوم الاستحقاق» في كل عقد (افتراضي 1) + أيام سماح قابلة للضبط', example: 'دفعة بتاريخ بعد اليوم 1+5 سماح تتعلّم «مدفوع متأخرًا»' },
        { name: 'البند الرابع: صيانة شهرية تُسدَّد مع الإيجار', what: 'بند مستقل في الاستحقاق مش مضموم للإيجار', source: 'نص البند (القيمة فارغة في العينة!)', calc: 'خانة صيانة بكل عقد تدخل استحقاق الشهر وتظهر منفصلة في التلميح والدرج', example: 'محل 1 (برج النيل): 41,800 إيجار + 1,200 صيانة + ض.ق.م' },
        { name: 'البند الخامس: التأمين «بواقع شهر»، يُرد أو يُخصم', what: 'التزام مالي على المالك لازم يبان', source: 'نص البند + ملاحظة «35,000 تأمين» للوحدة 41', calc: 'خانة تأمين بكل عقد + كارد «تأمينات محتجزة» يجمعها + تنبيه للعقود الناقصة', example: '41: تأمين 35,000 ≈ شهر من 36,000 — مطابق للبند' },
        { name: 'البند السادس: لا تأجير من الباطن ولا تغيير استخدام', what: 'خطر تشغيلي يُتابَع ميدانيًا', source: 'نص البند', calc: 'ملاحظة الوحدة + الشكاوى مكانهما الطبيعي لأي مخالفة تُرصد', example: 'صف «الميزان 2» المزدوج (الدقة/العنوان) — Q2 بيسأل: مين العميل الفعلي؟' },
        { name: 'البند العاشر: ض.ق.م على العميل وتُسدَّد مع الإيجار', what: 'إضافة الضريبة لاستحقاق الخاضعين', source: 'نص البند', calc: 'علامة «خاضع» بكل عقد ⇒ الاستحقاق × (1 + النسبة من الإعدادات)', example: 'Q19: لسه محتاجين حصر مين الخاضع في كشف سكرية' },
        { name: 'البندان التاسع والسادس: الإنهاء المبكر = مصادرة التأمين', what: 'قاعدة تسوية عند خروج عميل', source: 'نص البندين', calc: 'مرحلة قادمة: شاشة «تسوية خروج» (رد/خصم من التأمين بمستنداته) — مسجّلة في خارطة الطريق', example: '42 المنتهي بلا تجديد: Q16 بيسأل عن تسوية تأمينه' },
      ]);

    /* توثيق الشاشات */
    const health = Store.healthScore(asOf);
    const vacAll = Store.vacancyInfo(asOf);
    const alarmsAll = Store.consecutiveLateAlarms(asOf);
    const unpaidNow = Store.allCellInfos(m, asOf).filter(ci =>
      ci.due && ['late', 'partial', 'due', 'unknown'].includes(ci.status));
    const unpaidSum = unpaidNow.reduce((s2, ci) => s2 + Math.max(0, ci.due.amount - ci.paid), 0);

    const dashDocs = docSection('لوحة المؤشرات — كارد كارد', null, [
      { name: 'التقييم العام /100 (في سطر مشاريعك)',
        what: 'رقم واحد يلخّص وضع مشاريعك كلها — أول ما تشوفه فوق',
        source: 'التحصيل والإشغال والمبالغ التي تحتاج تأكيدًا وأعمار المتأخرات وتواريخ انتهاء العقود',
        calc: 'نسبة التحصيل (40 نقطة) + نسبة الإشغال (25) + اكتمال التأكيد (15) + حداثة المتأخرات (10) + أمان العقود (10) = 100. اضغط الرقم ليفتح درجًا بجدول فيه نقاطك في كل مكوّن ومن كام ومعناه',
        example: `تقييمك الآن ${health.score} من 100` },
      { name: 'شهر التقرير (الشريط فوق الكروت)',
        what: 'يحدد أي شهر تتكلم عنه أرقام التحصيل و«من لم يسدِّد؟» وإيجارات المشاريع',
        source: 'اختيارك بالسهمين، أو زر «آخر شهر مكتمل»',
        calc: 'مقفول عند الشهر الجاري — لا تقرير عن شهر لم يبدأ بعد (مستحقاته صفر فيبدو زورًا محصَّلًا بالكامل)، والشهر الجاري معلَّم «— جارٍ». بقية المؤشرات (المتأخرات والشواغر والتجديدات والتقييم) محسوبة دائمًا حتى اليوم مهما غيّرت الشهر',
        example: `الشهر المعروض الآن: ${Store.periodLabel(m, true)}` },
      { name: '🚨 متأخرون شهرين متتاليين — يلزم إجراء',
        what: 'كارت أحمر أول اللوحة بكل عميل عليه شهران متتاليان أو أكثر بلا سداد: اسمه، وحدته ومشروعه، عدد الشهور، والمبلغ',
        source: 'حالة كل شهر × وحدة بالترتيب الزمني',
        calc: 'شهور «يحتاج تأكيدًا» لا تقطع السلسلة ولا تزوّدها — معلومة ناقصة لا اتهام. والضغط على الصف يفتح ملف العميل كاملًا بسجل سداده شهرًا بشهر',
        example: alarmsAll.length ? `${alarmsAll.length} حالة الآن — أطولها ${Math.max(...alarmsAll.map(a => a.months))} أشهر متتالية` : 'لا حالات حاليًا' },
      { name: 'تحصيل الشهر + ▲▼', what: 'نسبة المحصَّل من المستحق لشهر التقرير، والسهم فرقها عن الشهر السابق بالنقاط', source: 'الدفعات + العقود', calc: 'Σ المحصَّل ÷ Σ المستحق (السداد المستورد ✓ يُحسب كاملًا — افتراض معلن)', example: `${Store.periodLabel(m, true)}: ${mt.rate == null ? '—' : pct(mt.rate)}` },
      { name: 'خسائر الوحدات الشاغرة',
        what: 'الفلوس التي تضيع كل شهر من وحدات غير مؤجَّرة',
        source: 'الوحدات بلا عقد نشط + آخر إيجار للوحدة نفسها أو متوسط إيجار وحدات نوعها',
        calc: 'خسارة الوحدة الشهرية × مدة شغورها. والضغط يفتح درجًا وحدة بوحدة مكتوب فيه أساس تقدير كل وحدة صراحةً — تقدير مُعلَن الأساس لا رقم مخفي، وفي آخره زر «افتح الوحدات الشاغرة»',
        example: vacAll.count ? `${vacAll.count} وحدة شاغرة · ${money(vacAll.totalMonthly)} شهريًا` : 'لا وحدات شاغرة' },
      { name: 'المتأخرات', what: 'فلوس مستحقة وثابت عدم سدادها', source: '✗ الورقة + الشهور المتجاوزة للسماح بلا سداد', calc: 'Σ (مستحق − مسدَّد) لكل شهر×وحدة متأخر — والمجهول القيمة (سكرية) يُعد منفصلًا ولا يُخلَط', example: `${money(ar.total)} + ${ar.unknowns.length} أشهر مجهولة` },
      { name: 'يحتاج تأكيدًا', what: 'خانات فارغة داخل تغطية الورقة — سداد أم تأخير؟ غير معروف', source: 'الفراغات في شبكة شهور الورقة', calc: 'Σ استحقاق الشهور الفارغة داخل التغطية — يُعرض كنطاق عدم يقين مش كمتأخرات', example: `${money(ar.undocumentedTotal)} (تقوى: يناير–مارس)` },
      { name: 'الإشغال / التجديدات / التأمينات', what: 'وحدات بعقد نشط اليوم · عقود تنتهي ≤90 يوم بلا لاحق · مجموع التأمينات المحتجزة', source: 'تواريخ العقود + خانات التأمين', calc: 'مقارنات تواريخ مباشرة — «منتهٍ بلا تجديد» يعني آخر عقد للوحدة انتهى ومفيش عقد مربوط به', example: '42 انتهى 2026/7/30 بلا تجديد ⇒ تنبيه أحمر' },
      { name: 'بطاقات المشاريع', what: 'لكل مشروع: مالكه، شريط مؤجَّر/شاغر، إيجارات الشهر ونسبة تحصيله، متأخراته، وخسارة شواغره', source: 'وحدات المشروع وعقودها ودفعاتها', calc: 'ضغطة واحدة على البطاقة تركّز كل أرقام المنظومة على هذا المشروع (نفس أثر مرشِّح المشروع فوق)', example: `${Store.state.buildings.length} مشاريع معروضة الآن` },
      { name: 'من لم يسدِّد؟', what: 'الإجابة المباشرة لسؤالك: أسماء ومبالغ الشهر المختار، مرتّبة بالأكبر', source: 'حالات الشهر المختار', calc: 'كل وحدة حالتها متأخر/جزئي/يحتاج تأكيدًا/في السماح + المتبقي عليها — يُعرَض أعلى ثمانية والضغط يفتح خلية التسجيل', example: `${Store.periodLabel(m, true)}: ${unpaidNow.length} وحدة لم تسدِّد بإجمالي ${money(unpaidSum)}` },
      { name: 'التحصيل الشهري (رسم)', what: 'العمود الفاتح = المستحق، الغامق = المحصَّل — الفرق بينهما هو الفجوة', source: 'إجماليات كل شهر', calc: 'آخر 12 شهرًا حتى شهر التقرير، و«؟» تحت الشهور التي فيها سداد يحتاج تأكيدًا', example: `${Store.periodLabel(m, true)}: ${mt.rate == null ? '—' : pct(mt.rate)} من المستحق` },
      { name: 'أعمار المتأخرات', what: 'قد إيه المتأخرات قديمة — الأقدم أصعب تحصيلًا', source: 'عمر كل شهر متأخر باليوم', calc: 'شرائح 1–30 / 31–60 / 61–90 / +90 من يوم الاستحقاق', example: `أقدم شريحة حاليًا: ${money(ar.buckets.b90p, { bare: true })} فوق 90 يومًا` },
    ]);

    const matrixDocs = docSection('جدول التحصيل — لغة الخلايا', 'هي نفسها ورقتك، بس كل رمز وراه بيانات:', [
      { name: '✓ أخضر غامق / ✓ منقّط / ✓ كهرماني', what: 'مدفوع موثَّق (بمبلغ وتاريخ) / مدفوع من الورقة بلا تفاصيل / مدفوع بعد ميعاده', source: 'الدفعات المدخلة أو علامات الورقة', calc: 'المنقّط بيفضل «يحتاج توثيق» لحد ما تسجّل مبلغه وتاريخه الفعليين من خليته', example: '' },
      { name: '½ / ✗ / ؟ / • / – / ·', what: 'جزئي / متأخر / يحتاج تأكيدًا / مستحق في السماح / خارج مدة العقد / قبل تغطية الورقة', source: 'محرك الحالات', calc: '«≈» جنب الرمز = القيمة تقديرية (+10٪ غير مدوَّنة في الورقة)', example: '' },
      { name: '✓ رمادي — سداد بلا عقد مسجّل', what: 'الوحدة تُسدِّد فعلًا لكن لا عقد لها في النظام', source: 'دفعة أو علامة على وحدة بلا عقد', calc: 'لا تدخل نسبة التحصيل لأن المستحق نفسه غير معروف — تُحسم بتسجيل عقد الوحدة', example: 'جراج الهدم في كشف سكرية' },
      { name: 'وضعا العمل', what: '«تسجيل دفعات»: الضغطة تفتح دفعة كاملة · «نقل ورقة قديمة»: الضغطة تقلّب ✓/✗/فارغ', source: '—', calc: 'النقل للتاريخ القديم من الورق، والدفعات للتشغيل اليومي. وضع النقل يرفض قلب شهر عليه دفعات مسجَّلة حتى لا تُمحى بالخطأ', example: '' },
      { name: 'سداد جماعي', what: 'شهر كامل بضغطة — لما تبقى مأجّر مئات', source: 'المستحق غير المسدَّد للشهر المختار', calc: 'قائمة بكل المستحق عليهم + تعليم، والحفظ يسجّل دفعة كاملة لكل معلَّم بتاريخ وطريقة موحّدين — الاستثناءات من خلاياها', example: '' },
      { name: 'عمود «متأخرات» آخر الصف', what: 'رصيد الوحدة المتأخر الكلي عبر كل الشهور', source: 'تجميع صف الوحدة', calc: 'Σ متبقي الشهور المتأخرة + «؟×n» للمجهول', example: '' },
    ]);

    const otherDocs = docSection('متبقّي الشاشات — باختصار', null, [
      { name: 'التحليلات', what: 'الإنسايتس المكتوبة + تحليل العقود + الالتزام + التوزيعات', source: 'كل ما سبق', calc: 'كل بطاقة إنسايت جملة محسوبة بشرطها (مثلًا: منحدر الإيراد يظهر فقط لو النصف الثاني أقل 15٪+) وتنقلك لمكان الإجراء', example: '' },
      { name: 'الوحدات / العقود', what: 'بطاقات الوحدات بحالتها وكودها، وخط زمني (جانت) للعقود بخط «اليوم»', source: 'العقود والدفعات', calc: 'حالة الوحدة محسوبة من عقودها — عمرها ما بتتكتب يدويًا. والجانت يعرض أهم ثماني وحدات (ما يحتاج قرارًا أولًا) وتحته زر يعرض الكل', example: '' },
      { name: 'ملف العميل (شاشة العملاء)', what: 'كل ما يخص عميلًا في مكان واحد', source: 'عقوده ودفعاته وعلامات الورقة', calc: 'وحداته وعقوده · آخر سداد مسجَّل (ويميّز بين دفعة موثَّقة بمبلغ وتاريخ وبين آخر شهر مؤشَّر ✓ في ورقة المالك) · إجمالي متأخراته · سجل سداد شهرًا بشهر كل سطر فيه يفتح خلية ذلك الشهر. ويُفتح أيضًا من ضغطة على سطر في ألارم اللوحة', example: '' },
      { name: 'عملاء مسجَّلون بلا عقود بعد', what: 'قسم أسفل شاشة العملاء لمن أدخلتَ بياناتهم ولم تُسجَّل لهم عقود', source: 'العملاء غير المرتبطين بأي وحدة', calc: 'يظهر دائمًا مهما كان الترشيح حتى لا يبدو أن تسجيلهم ضاع — وبجانب كل واحد زر «سجِّل له عقدًا» يفتح المعالج والعميل محدَّد', example: '' },
      { name: 'الشكاوى', what: 'سجل بالتصنيف والتكلفة ومن يتحمّلها وزمن الإغلاق', source: 'إدخال يدوي — السجل بيبدأ من أول يوم تشغيل', calc: 'متوسط زمن الإغلاق = متوسط (تاريخ الإغلاق − الفتح) · مؤشر «بعد التسليم» محتاج تواريخ تسليم (Q20)', example: '' },
      { name: 'مراجعات مطلوبة', what: 'كل تناقض/نقص في الورقة بنصه الحرفي وقرار تفسيره وسؤاله للمالك', source: 'التفريغ + شيت درجة الثقة + صور الورقة والعقد', calc: 'الحسم بيتسجّل بنصه في السجل — عمره ما بيتمسح', example: `${Store.state.issues.filter(q => q.status === 'open').length} ملاحظة مفتوحة الآن` },
      { name: 'الإعدادات', what: 'كل افتراض معلن هنا: أساس الإيجار، السماح، الزيادة، الضريبة + إدارة المشاريع + التصدير', source: '—', calc: 'أي تغيير يعيد حساب كل الأرقام فورًا. ومنها التقرير الشامل (Excel) بثماني أوراق، وحذف البيانات التوضيحية عند بدء التشغيل الفعلي', example: '' },
      { name: 'تسجيل الدخول والأدوار', what: 'ثلاثة مستخدمين بأدوار: مدير (كل الشاشات) · موظف (بلا الإعدادات) · مشاهدة فقط (بلا أي إدخال)', source: 'قائمة المستخدمين في أول ملف صفحة الدخول', calc: 'اسم الداخل ودوره يظهران أعلى الشاشة مع زر خروج، والشاشات والأزرار غير المتاحة لدوره تختفي. تنظيم استخدام داخل المكتب لا حماية أمنية — القفل الفعلي مع نسخة الخادم', example: '' },
    ]);

    return h('div.view', [
      pageHead('دليل الشرح', 'المرجع الكامل: خريطة العملية، ومنطق كل رقم — من الورقة للإنسايت.'),
      sectionCard('خريطة العملية الكاملة — من الورقة للقرار', flowNode),
      codesCard(),
      entryTypesCard(),
      rentModesCard(),
      chain,
      contractMap,
      dashDocs,
      matrixDocs,
      otherDocs,
    ]);
  }

  window.Views = {
    dashboard: viewDashboard, matrix: viewMatrix, units: viewUnits,
    contracts: viewContracts, tenants: viewTenants, complaints: viewComplaints,
    quality: viewQuality, settings: viewSettings,
    insights: viewInsights, intake: viewIntake, guide: viewGuide,
    slicerBar,
    openAddContract, openEditContract, openAddUnit, openEditUnit, openEditBuilding,
    openTenantDrawer, openAddComplaint, openCellDrawer, openUnitDrawer,
    filteredUnits, fset,
  };

  /* ترجمة ملف العميل واقتراحات البحث */
  I18N.extend({
    'ملف العميل': 'Client profile',
    'حفظ البيانات': 'Save details',
    'تعديل البيانات': 'Edit details',
    'آخر سداد مسجَّل': 'Last recorded payment',
    'عن شهر': 'for',
    'لا مدفوعات مسجَّلة بمبلغ وتاريخ': 'No payments recorded with an amount and date',
    'آخر شهر مؤشَّر ✓ في ورقة المالك:': 'last month ticked ✓ on the owner’s paper:',
    'لا سداد مسجَّل لهذا العميل إطلاقًا': 'No payment recorded for this client at all',
    'إجمالي المتأخرات': 'Total arrears',
    'بقيمة مجهولة': 'of unknown value',
    'لا شيء': 'None',
    'سجل السداد شهرًا بشهر': 'Payment history, month by month',
    'أشهر هذا العميل فقط، الأحدث أولًا — كل سطر يفتح خلية الشهر نفسها للتفصيل أو تسجيل دفع.':
      'This client’s months only, newest first — each row opens that month’s cell to inspect or record a payment.',
    'الشهر': 'Month', 'الوحدة': 'Unit', 'المستحق': 'Due', 'المسدَّد': 'Paid',
    'تاريخ السداد': 'Payment date', 'الحالة': 'Status',
    'لا أشهر مسجَّلة بعد': 'No months recorded yet',
    'سُدِّد': 'Paid', 'سُدِّد متأخرًا': 'Paid late', '✓ من ورقة المالك': '✓ from the owner’s paper',
    'سداد بلا عقد مسجّل': 'Payment without a registered contract',
    'سداد جزئي': 'Partial payment', 'مستحق هذا الشهر': 'Due this month',
    'متأخر — القيمة غير معروفة': 'Late — amount unknown', 'متأخر': 'Late',
    'عقد من': 'Contract from', 'إلى': 'to', 'الإيجار الحالي': 'current rent', 'منتهٍ': 'ended',
    'تسجيل دفع في جدول التحصيل': 'Record a payment in the collection sheet',
    'الهاتف': 'Phone', 'غير مسجّل': 'not recorded',
    'عميل': 'Client', 'وحدة': 'Unit', 'مشروع': 'Project', 'نوع': 'Type', 'دور': 'Floor',
    /* الأكواد وفورم العقد الجديد */
    'ابحث بالاسم أو الرقم القومي…': 'Search by name or national ID…',
    'اكتب حرفين من الاسم أو أرقامًا من الكود': 'Type part of the name or a few digits of the code',
    'كود العميل — الرقم القومي': 'Client code — national ID',
    'هو ما ستبحث به عن العميل لاحقًا في أي شاشة': 'It is what you will search the client by later, from any screen',
    'به تبحث عن العميل من أي شاشة': 'You can search the client by it from any screen',
    'هاتف العميل': 'Client phone',
    'الاسم كما في البطاقة أو السجل': 'The name as on the ID card or registry',
    'الرقم القومي (14 رقمًا) — أو السجل التجاري للشركات': 'National ID (14 digits) — or commercial registry for companies',
    'المشروع': 'Project',
    'عرض كل الوحدات (لتسجيل تجديد على وحدة عليها عقد)': 'Show all units (to record a renewal on an occupied unit)',
    'كود العميل': 'Client code',
    'كود الوحدة': 'Unit code',
    'الكود (الرقم القومي)': 'Code (national ID)',
    'غير مسجَّل': 'Not recorded',
    'غير مسجَّل — أضفه من «تعديل البيانات» بالأسفل': 'Not recorded — add it from “Edit details” below',
    /* بطاقة الأكواد في دليل الشرح */
    'الأكواد — كيف تجد أي شيء في ثانية': 'Codes — how to find anything in a second',
    'لكل مشروع ووحدة كود قصير يولِّده النظام تلقائيًا، وللعميل كود تُدخله أنت هو رقمه القومي. اكتب أي كود في خانة البحث أعلى الشاشة وستصل مباشرة.':
      'Every project and unit gets a short code generated automatically, and every client gets a code you enter — their national ID. Type any code into the search box at the top of the screen to jump straight to it.',
    'الكود': 'Code', 'شكله': 'Format', 'من أين يأتي': 'Where it comes from', 'مثال من بياناتك': 'Example from your data',
    'كود المشروع': 'Project code', 'P ثم رقم': 'P then a number',
    'يُولَّد تلقائيًا عند إضافة مشروع': 'Generated automatically when a project is added',
    'كود المشروع ثم رقم متسلسل': 'The project code then a serial number',
    'يُولَّد تلقائيًا عند إضافة وحدة': 'Generated automatically when a unit is added',
    'الرقم القومي (14 رقمًا) أو السجل التجاري': 'National ID (14 digits) or commercial registry',
    'تُدخله عند تسجيل العميل — والنظام يمنع تكراره لعميلَين': 'You enter it when registering the client — the system prevents two clients sharing one code',
    'العميل (بالاسم أو الرقم القومي) ← البداية والمدة (حتى 10 سنوات) ← المشروع ← وحدة متاحة ← قيمة السنة الأولى — وباقي السنوات تتولَّد بالنسبة أو تكتبها بيدك':
      'Client (by name or national ID) → start date and term (up to 10 years) → project → an available unit → first-year rent — the remaining years are generated from the percentage or typed in by hand',
    /* جدول السنوات المرن + الوحدات المشغولة + العملاء بلا عقود */
    'أظهر أيضًا الوحدات المشغولة': 'Also show occupied units',
    'القائمة أعلاه تعرض الوحدات المتاحة في المدة المطلوبة فقط. علِّم هذا الخيار إن كنت تريد الاختيار من كل وحدات المشروع — مع سبب انشغال كل وحدة بجوار اسمها.':
      'The list above shows only units available for the requested term. Tick this to choose from every unit in the project — each occupied one shows why next to its name.',
    'اختر الوحدة — غيِّر المشروع أو علِّم «أظهر أيضًا الوحدات المشغولة»': 'Choose the unit — switch project or tick “Also show occupied units”',
    'لا وحدة متاحة في هذا المشروع بهذه المدة — علِّم «أظهر أيضًا الوحدات المشغولة» إن كان تجديدًا':
      'No unit is available in this project for this term — tick “Also show occupied units” if this is a renewal',
    'مصدرها': 'Source', 'قيمة مكتوبة': 'Typed in', 'من خانة قيمة السنة الأولى': 'From the first-year field',
    'اكتب قيمة أي سنة كما وردت في العقد ولن يعيد النظام حسابها — والسنوات التي تليها تُبنى عليها.':
      'Type any year’s value exactly as written in the contract and it will not be recomputed — the years after it build on it.',
    'أعِد حساب كل السنوات بالنسبة': 'Recompute every year from the percentage',
    'أكمل قيمة كل سنة في جدول السنوات': 'Complete every year’s value in the schedule',
    'سنة واحدة': 'One year', 'سنتان': 'Two years',
    'هؤلاء أدخلتَ بياناتهم ولم تُسجَّل لهم عقود، لذلك لا وحدات ولا متأخرات لهم. يظهرون هنا دائمًا مهما كان الترشيح.':
      'You entered their details but no contract has been recorded for them, so they have no units and no arrears. They always appear here regardless of the filter.',
    'سجِّل له عقدًا': 'Record a contract', 'بياناته': 'Details',
    'لا عملاء لهم عقود ضمن الترشيح': 'No clients with contracts match the filter',
    'لا عقود مسجَّلة لهذا العميل بعد — بياناته محفوظة، وسيظهر في الجدول الرئيسي بمجرد تسجيل أول عقد له.':
      'No contracts recorded for this client yet — their details are saved, and they will appear in the main table as soon as a first contract is recorded.',
    /* التصدير */
    'تصدير التقارير': 'Report exports',
    'التقرير الشامل ملف Excel واحد بأوراق منفصلة منسَّقة وجاهزة للعرض على المالك. وبجانبه تصديرات مفردة بصيغة CSV لمن يريد بيانات خامًا.':
      'The full report is a single Excel file with separate formatted sheets, ready to show the owner. Alongside it are individual CSV exports for raw data.',
    'التقرير الشامل (Excel)': 'Full report (Excel)',
    'تصديرات مفردة (CSV)': 'Individual exports (CSV)',
    'نُزِّل التقرير الشامل — افتحه بـ Excel': 'Full report downloaded — open it in Excel',
    'المتأخرات': 'Arrears', 'العقود': 'Contracts', 'الدفعات المسجَّلة': 'Recorded payments',
    '+ عمود سنة': '+ Year column', 'اكتملت عشر سنوات': 'Ten years reached',
    'أقصى مدة عشر سنوات': 'Ten years is the maximum term',
    'املأ باقي السنوات بزيادة 10٪ (النمط السائد)': 'Fill the remaining years with a 10% increase (the common pattern)',
    'أدخل قيمة السنة 1 أولًا': 'Enter the year-1 value first',
    /* خيارا قيم السنوات + التعديل */
    'كيف تُحسب قيمة كل سنة؟': 'How is each year’s value determined?',
    'زيادة سنوية بنسبة — أكتب قيمة السنة الأولى والنسبة، والباقي يُحسب':
      'Annual increase by percentage — enter the first-year value and the percentage, the rest is computed',
    'أكتب قيمة كل سنة بنفسي — تظهر خانة لكل سنة بعدد سنوات العقد':
      'I will enter each year myself — a field appears for every year of the term',
    'اكتب قيمة كل سنة في الخانات أعلاه ليظهر الجدول.': 'Enter each year’s value in the fields above to see the schedule.',
    'قيمة السنة الأولى': 'First-year value', 'غير مكتوبة': 'Not entered',
    'أكمل قيمة كل سنة في الخانات': 'Complete every year’s value in the fields',
    'أدخل قيمة سنة أولى موجبة': 'Enter a positive first-year value',
    'أدخل تاريخ بداية العقد': 'Enter the contract start date',
    'تعديل': 'Edit', 'تعديل العقد': 'Edit contract', 'حفظ التعديل': 'Save changes',
    'تعديل هذا العقد': 'Edit this contract', 'حذف العقد': 'Delete contract', 'حُذف العقد': 'Contract deleted',
    'حُفظ التعديل — أُعيد حساب الاستحقاق على المدة الجديدة': 'Changes saved — dues recomputed over the new term',
    'حذف هذا العقد نهائيًا؟ ستعود الوحدة «بلا عقد مسجّل» لهذه المدة.':
      'Delete this contract permanently? The unit will go back to “no registered contract” for this term.',
    'تعديل بيانات الوحدة': 'Edit unit details', 'حُفظ تعديل الوحدة': 'Unit details saved',
    'تعديل بيانات المشروع': 'Edit project details', 'حُفظ تعديل المشروع': 'Project details saved',
    'اسم المشروع': 'Project name', 'المالك': 'Owner', 'المنطقة': 'Area',
    'كود المشروع': 'Project code', 'ثابت لا يتغير.': 'is permanent and never changes.',
    'المشاريع': 'Projects',
    /* بطاقة طريقتَي قيم السنوات في الدليل */
    'قيمة كل سنة في العقد — طريقتان': 'Each year’s value in a contract — two ways',
    'عند تسجيل عقد تختار كيف تُحسب قيمة كل سنة، والاختيار يظهر في الفورم نفسه:':
      'When recording a contract you choose how each year’s value is determined; the choice appears in the form itself:',
    'الطريقة': 'Method', 'متى تستخدمها': 'When to use it', 'ماذا تُدخل': 'What you enter', 'مثال': 'Example',
    'زيادة سنوية بنسبة': 'Annual increase by percentage',
    'العقد ينص على زيادة ثابتة سنويًا (النمط السائد عندكم: 10٪)': 'The contract states a fixed yearly increase (your common pattern: 10%)',
    'قيمة السنة الأولى + النسبة — والباقي يُحسب': 'The first-year value + the percentage — the rest is computed',
    'أكتب قيمة كل سنة بنفسي': 'I enter each year myself',
    'العقد يدوِّن قيمة مختلفة لكل سنة بلا نسبة منتظمة': 'The contract lists a different value per year with no regular percentage',
    'خانة لكل سنة بعدد سنوات العقد (حتى عشر)': 'A field per year, matching the contract term (up to ten)',
    '10,000 ← 11,000 ← 12,100 (زيادة 10٪)': '10,000 → 11,000 → 12,100 (10% increase)',
    'مدة العقد تصل إلى عشر سنوات، وعدد الخانات في الطريقة اليدوية يتبع المدة التي تختارها.':
      'A term can reach ten years, and the number of fields in the manual method follows the term you choose.',
    /* صفوف التعديل في جدول أنواع الإدخال */
    'تعديل عقد قائم': 'Editing an existing contract',
    'العقود ← زر «تعديل» في آخر الصف': 'Contracts → the “Edit” button at the end of the row',
    'غيِّر المدة أو القيم أو الصيانة والتأمين — ويُعاد حساب الاستحقاق فورًا':
      'Change the term, the values, maintenance or deposit — dues are recomputed instantly',
    'حذف عقد سُجِّل بالخطأ': 'Deleting a contract recorded by mistake',
    'العقود ← «تعديل» ← «حذف العقد»': 'Contracts → “Edit” → “Delete contract”',
    'مسموح ما لم تكن عليه دفعات مسجَّلة — احذف الدفعات أولًا إن وُجدت':
      'Allowed unless payments are recorded against it — delete those first if any',
    'تعديل بيانات وحدة': 'Editing a unit',
    'الوحدات ← اضغط الوحدة ← «تعديل بيانات الوحدة»': 'Units → click the unit → “Edit unit details”',
    'الاسم والنوع والدور والمساحة — والكود ثابت لا يتغير': 'Name, type, floor and area — the code never changes',
    'تعديل بيانات مشروع': 'Editing a project',
    'الإعدادات ← جدول «المشاريع» ← «تعديل»': 'Settings → the “Projects” table → “Edit”',
    'الاسم والمالك والمنطقة — والكود ثابت لا يتغير': 'Name, owner and area — the code never changes',
    'اضغط الصف ليفتح ملفه ← «تعديل البيانات» بالأسفل — أو زر «عميل جديد»':
      'Click the row to open their profile → “Edit details” at the bottom — or the “New client” button',
    /* توثيق اللوحة والشاشات في دليل الشرح — النسخة المحدَّثة */
    'التقييم العام /100 (في سطر مشاريعك)': 'The overall score /100 (in your projects strip)',
    'رقم واحد يلخّص وضع مشاريعك كلها — أول ما تشوفه فوق': 'A single number summarising all your projects — the first thing you see at the top',
    'التحصيل والإشغال والمبالغ التي تحتاج تأكيدًا وأعمار المتأخرات وتواريخ انتهاء العقود':
      'Collection, occupancy, amounts needing confirmation, arrears ageing, and contract end dates',
    'نسبة التحصيل (40 نقطة) + نسبة الإشغال (25) + اكتمال التأكيد (15) + حداثة المتأخرات (10) + أمان العقود (10) = 100. اضغط الرقم ليفتح درجًا بجدول فيه نقاطك في كل مكوّن ومن كام ومعناه':
      'Collection rate (40 points) + occupancy (25) + confirmation completeness (15) + arrears freshness (10) + contract safety (10) = 100. Click the number to open a drawer showing your points in each component, out of how many, and what it means',
    'شهر التقرير (الشريط فوق الكروت)': 'The report month (the strip above the cards)',
    'يحدد أي شهر تتكلم عنه أرقام التحصيل و«من لم يسدِّد؟» وإيجارات المشاريع':
      'It decides which month the collection figures, “Who has not paid?” and project rents refer to',
    'اختيارك بالسهمين، أو زر «آخر شهر مكتمل»': 'Your choice with the arrows, or the “Last complete month” button',
    'مقفول عند الشهر الجاري — لا تقرير عن شهر لم يبدأ بعد (مستحقاته صفر فيبدو زورًا محصَّلًا بالكامل)، والشهر الجاري معلَّم «— جارٍ». بقية المؤشرات (المتأخرات والشواغر والتجديدات والتقييم) محسوبة دائمًا حتى اليوم مهما غيّرت الشهر':
      'Capped at the current month — there is no report for a month that has not started (its dues are zero, so it would falsely read as fully collected), and the current month is marked “in progress”. Every other indicator (arrears, vacancies, renewals, the score) is always computed as of today no matter which month you pick',
    'كارت أحمر أول اللوحة بكل عميل عليه شهران متتاليان أو أكثر بلا سداد: اسمه، وحدته ومشروعه، عدد الشهور، والمبلغ':
      'A red card at the top of the dashboard listing every client with two or more consecutive unpaid months: their name, unit and project, the number of months, and the amount',
    'حالة كل شهر × وحدة بالترتيب الزمني': 'Each month × unit state in chronological order',
    'شهور «يحتاج تأكيدًا» لا تقطع السلسلة ولا تزوّدها — معلومة ناقصة لا اتهام. والضغط على الصف يفتح ملف العميل كاملًا بسجل سداده شهرًا بشهر':
      'Months needing confirmation neither break the streak nor extend it — missing information is not an accusation. Clicking the row opens the client’s full profile with their month-by-month payment history',
    'خسائر الوحدات الشاغرة': 'Vacancy losses',
    'الفلوس التي تضيع كل شهر من وحدات غير مؤجَّرة': 'The money lost every month from unrented units',
    'الوحدات بلا عقد نشط + آخر إيجار للوحدة نفسها أو متوسط إيجار وحدات نوعها':
      'Units with no active contract + the unit’s own last rent, or the average rent of its type',
    'خسارة الوحدة الشهرية × مدة شغورها. والضغط يفتح درجًا وحدة بوحدة مكتوب فيه أساس تقدير كل وحدة صراحةً — تقدير مُعلَن الأساس لا رقم مخفي، وفي آخره زر «افتح الوحدات الشاغرة»':
      'The unit’s monthly loss × how long it has been vacant. Clicking opens a unit-by-unit drawer stating each estimate’s basis explicitly — a declared estimate, not a hidden number — with an “Open vacant units” button at the end',
    'بطاقات المشاريع': 'Project cards',
    'لكل مشروع: مالكه، شريط مؤجَّر/شاغر، إيجارات الشهر ونسبة تحصيله، متأخراته، وخسارة شواغره':
      'Per project: its owner, a rented/vacant bar, the month’s rents and collection rate, its arrears, and its vacancy loss',
    'وحدات المشروع وعقودها ودفعاتها': 'The project’s units, contracts and payments',
    'ضغطة واحدة على البطاقة تركّز كل أرقام المنظومة على هذا المشروع (نفس أثر مرشِّح المشروع فوق)':
      'One click on the card focuses every figure in the system on that project (the same effect as the project filter above)',
    'كل وحدة حالتها متأخر/جزئي/يحتاج تأكيدًا/في السماح + المتبقي عليها — يُعرَض أعلى ثمانية والضغط يفتح خلية التسجيل':
      'Every unit that is late, partial, needs confirmation, or is within grace, plus what it still owes — the top eight are shown and clicking opens the recording cell',
    'آخر 12 شهرًا حتى شهر التقرير، و«؟» تحت الشهور التي فيها سداد يحتاج تأكيدًا':
      'The last 12 months up to the report month, with “?” under months holding payments that need confirmation',
    'بطاقات الوحدات بحالتها وكودها، وخط زمني (جانت) للعقود بخط «اليوم»':
      'Unit cards with their status and code, and a contract timeline (Gantt) with a “today” line',
    'حالة الوحدة محسوبة من عقودها — عمرها ما بتتكتب يدويًا. والجانت يعرض أهم ثماني وحدات (ما يحتاج قرارًا أولًا) وتحته زر يعرض الكل':
      'A unit’s status is computed from its contracts — never typed by hand. The Gantt shows the eight units that need a decision first, with a button below to show them all',
    'ملف العميل (شاشة العملاء)': 'The client profile (Clients screen)',
    'كل ما يخص عميلًا في مكان واحد': 'Everything about a client in one place',
    'عقوده ودفعاته وعلامات الورقة': 'Their contracts, payments and paper marks',
    'وحداته وعقوده · آخر سداد مسجَّل (ويميّز بين دفعة موثَّقة بمبلغ وتاريخ وبين آخر شهر مؤشَّر ✓ في ورقة المالك) · إجمالي متأخراته · سجل سداد شهرًا بشهر كل سطر فيه يفتح خلية ذلك الشهر. ويُفتح أيضًا من ضغطة على سطر في ألارم اللوحة':
      'Their units and contracts · the last recorded payment (distinguishing a documented payment with amount and date from the last month merely ticked ✓ on the owner’s paper) · total arrears · a month-by-month payment history where each row opens that month’s cell. It also opens from a click on an alarm row on the dashboard',
    'عملاء مسجَّلون بلا عقود بعد': 'Clients registered with no contract yet',
    'قسم أسفل شاشة العملاء لمن أدخلتَ بياناتهم ولم تُسجَّل لهم عقود': 'A section at the bottom of the Clients screen for people whose details you entered but who have no contract recorded',
    'العملاء غير المرتبطين بأي وحدة': 'Clients not linked to any unit',
    'يظهر دائمًا مهما كان الترشيح حتى لا يبدو أن تسجيلهم ضاع — وبجانب كل واحد زر «سجِّل له عقدًا» يفتح المعالج والعميل محدَّد':
      'It always appears regardless of the filter so their registration never looks lost — and each row has a “Record a contract” button that opens the wizard with the client already selected',
    '✓ رمادي — سداد بلا عقد مسجّل': '✓ grey — payment with no registered contract',
    'الوحدة تُسدِّد فعلًا لكن لا عقد لها في النظام': 'The unit does pay, but has no contract in the system',
    'دفعة أو علامة على وحدة بلا عقد': 'A payment or a mark on a unit with no contract',
    'لا تدخل نسبة التحصيل لأن المستحق نفسه غير معروف — تُحسم بتسجيل عقد الوحدة':
      'It stays out of the collection rate because the amount due itself is unknown — recording the unit’s contract settles it',
    'النقل للتاريخ القديم من الورق، والدفعات للتشغيل اليومي. وضع النقل يرفض قلب شهر عليه دفعات مسجَّلة حتى لا تُمحى بالخطأ':
      'Transcription is for the old paper history, payments are for daily operation. Transcription mode refuses to flip a month that has recorded payments so they cannot be wiped by mistake',
    'الوحدات / العقود': 'Units / Contracts',
    'مراجعات مطلوبة': 'Reviews Needed',
    'كل افتراض معلن هنا: أساس الإيجار، السماح، الزيادة، الضريبة + إدارة المشاريع + التصدير':
      'Every declared assumption lives here: rent basis, grace, increase, tax + project management + exports',
    'أي تغيير يعيد حساب كل الأرقام فورًا. ومنها التقرير الشامل (Excel) بثماني أوراق، وحذف البيانات التوضيحية عند بدء التشغيل الفعلي':
      'Any change recomputes every figure instantly. It also holds the full Excel report with its eight sheets, and the button that removes the demo data when real operation begins',
    'تسجيل الدخول والأدوار': 'Sign-in and roles',
    'ثلاثة مستخدمين بأدوار: مدير (كل الشاشات) · موظف (بلا الإعدادات) · مشاهدة فقط (بلا أي إدخال)':
      'Three users with roles: manager (all screens) · staff (no settings) · view-only (no data entry)',
    'قائمة المستخدمين في أول ملف صفحة الدخول': 'The user list at the top of the sign-in page file',
    'اسم الداخل ودوره يظهران أعلى الشاشة مع زر خروج، والشاشات والأزرار غير المتاحة لدوره تختفي. تنظيم استخدام داخل المكتب لا حماية أمنية — القفل الفعلي مع نسخة الخادم':
      'The signed-in name and role appear at the top with a sign-out button, and screens or buttons their role cannot use disappear. This organises office usage; it is not real security — the actual lock comes with the server version',
    'تقرير شامل للمالك': 'A full report for the owner',
    'الإعدادات ← «التقرير الشامل (Excel)»': 'Settings → “Full report (Excel)”',
    'ملف Excel واحد بأوراق منسَّقة: المشاريع والعقود والعملاء والمتأخرات والتحصيل والدفعات والشواغر والمراجعات':
      'One Excel file with formatted sheets: projects, contracts, clients, arrears, collection, payments, vacancies and reviews',
  });
  I18N.addPatterns([
    [/^(\d+) من (\d+) وحدة متاحة في المدة المطلوبة$/, function (m) { return m[1] + ' of ' + m[2] + ' units are available for the requested term'; }],
    [/^كل وحدات المشروع \((\d+)\) — غير المتاحة معلَّم سببها بجوار اسمها$/, function (m) { return 'All project units (' + m[1] + ') — unavailable ones show the reason next to their name'; }],
    [/^«(.+)» لم تعد متاحة بهذه المدة — اختر وحدة أخرى$/, function (m) { return '“' + I18N.tt(m[1]) + '” is no longer available for this term — choose another unit'; }],
    [/^عملاء مسجَّلون بلا عقود بعد \((\d+)\)$/, function (m) { return 'Clients registered with no contract yet (' + m[1] + ')'; }],
    [/^قيمة السنة (\d+)$/, function (m) { return 'Year ' + m[1] + ' value'; }],
    /* أمثلة دليل الشرح المحسوبة من البيانات */
    [/^تقييمك الآن (\d+) من 100$/, function (m) { return 'Your score right now is ' + m[1] + ' out of 100'; }],
    [/^الشهر المعروض الآن: (.+)$/, function (m) { return 'Currently showing: ' + I18N.tt(m[1]); }],
    [/^(\d+) حالة الآن — أطولها (\d+) أشهر متتالية$/, function (m) { return m[1] + ' cases now — the longest is ' + m[2] + ' consecutive months'; }],
    [/^لا حالات حاليًا$/, function () { return 'No cases at the moment'; }],
    [/^(\d+) وحدة شاغرة · (.+) شهريًا$/, function (m) { return m[1] + ' vacant units · ' + I18N.tt(m[2]) + ' per month'; }],
    [/^لا وحدات شاغرة$/, function () { return 'No vacant units'; }],
    [/^(\d+) مشاريع معروضة الآن$/, function (m) { return m[1] + ' projects currently shown'; }],
    [/^(.+): (\d+) وحدة لم تسدِّد بإجمالي (.+)$/, function (m) { return I18N.tt(m[1]) + ': ' + m[2] + ' units unpaid, totalling ' + I18N.tt(m[3]); }],
    [/^(.+): (\d+٪|\d+%) من المستحق$/, function (m) { return I18N.tt(m[1]) + ': ' + m[2].replace('٪', '%') + ' of what is due'; }],
    [/^(.+) في كشف (.+)$/, function (m) { return I18N.tt(m[1]) + ' in the ' + I18N.tt(m[2]) + ' statement'; }],
    [/^لا يمكن حذف عقد عليه (.+) مسجَّلة — احذف الدفعات أولًا من خلايا الأشهر$/,
      function (m) { return 'A contract with ' + I18N.tt(m[1]) + ' recorded cannot be deleted — remove the payments from the month cells first'; }],
    [/^«(.+)» لم تعد متاحة بهذه المدة — اختر وحدة أخرى$/, function (m) { return '“' + I18N.tt(m[1]) + '” is no longer available for this term — choose another unit'; }],
    [/^بزيادة (\d+(?:\.\d+)?)٪$/, function (m) { return '+' + m[1] + '%'; }],
    [/^سنة (\d+)$/, function (m) { return 'Year ' + m[1]; }],
    [/^قيمة سنة (\d+)$/, function (m) { return 'Year ' + m[1] + ' value'; }],
    [/^(\d+) سنوات$/, function (m) { return m[1] + ' years'; }],
    [/^هذا الكود مسجَّل بالفعل للعميل: (.+)$/, function (m) { return 'This code already belongs to client: ' + I18N.tt(m[1]); }],
    [/^لا يمكن حفظ عقدين متداخلين على الوحدة — العقد القائم حتى (.+)\. لو تجديد فاجعل البداية (.+)$/,
      function (m) { return 'Two overlapping contracts cannot be saved on one unit — the existing one runs to ' + m[1] + '. If this is a renewal, start it on ' + m[2]; }],
  ]);
  I18N.addTokens([
    [/— عليها عقد حتى /g, '— occupied until '],
    [/— عليها عميل بلا عقد مسجَّل/g, '— occupied by a client with no registered contract'],
  ]);
})();
