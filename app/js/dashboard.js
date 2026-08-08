/* =========================================================
   dashboard.js — اللوحة v3: من فوق لتحت زي ما المدير بيفكر
   1) كل المشاريع  2) المشاريع  3) الفلوس والمخاطر  4) الأكشن
   كل كارد يودّيك للشاشة المفلترة على اللي ضغطت عليه بالظبط.
   ========================================================= */
(function () {
  'use strict';
  const { h, money, pct, icon, statusChip, bindTip, openDrawer, closeDrawer, emptyState, shortDate } = UI;

  const bName = id => (Store.building(id) || {}).name || '—';
  const tName = id => (Store.tenant(id) || {}).name || '—';

  function keyClickable(el) {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
    });
    return el;
  }
  /* التنقل المفلتر: الكارد يودّي للشاشة وعليها نفس الترشيح */
  function go(hash, patch) {
    App.filters = Object.assign({ b: '', ty: '', tn: '', st: '', q: '' }, patch || {});
    if (location.hash === hash) App.render(); else location.hash = hash;
  }

  function sectionCard(title, node, actions) {
    return h('section.card', [
      h('div.card-head', [h('h3.card-title', title), actions ? h('div.card-actions', actions) : null]),
      node,
    ]);
  }
  function tile(o) {
    const delta = o.delta ? h('span.delta.' + (o.delta.good ? 'delta-good' : 'delta-bad'), [
      icon(o.delta.dir === 'up' ? 'up' : 'down'), h('span', o.delta.text),
    ]) : null;
    const t = h('div.tile' + (o.onclick ? '.tile-click' : ''), { onclick: o.onclick }, [
      o.ic ? h('span.tile-ic.tone-' + (o.tone || 'accent'), icon(o.ic)) : null,
      h('div.tile-top', [h('span.tile-label', o.label), o.chip || null]),
      h('div.tile-value-row', [h('span.tile-value.count-up' + (o.valueClass ? '.' + o.valueClass : ''), o.value), delta]),
      o.sub ? h('div.tile-sub', o.sub) : null,
      o.spark ? h('div.tile-spark', o.spark) : null,
    ]);
    if (o.onclick) keyClickable(t);
    return t;
  }

  let dashMonth = null;

  function viewDashboardV3() {
    const asOf = Store.today();
    const cur = Store.periodOf(asOf);
    if (!dashMonth) dashMonth = Store.addMonths(cur, -1);
    const m = dashMonth;
    const F = App.filters;
    const uset = Views.fset(asOf);
    const us = Views.filteredUnits(asOf);

    const mt = Store.monthTotals(m, asOf, uset);
    const mtPrev = Store.monthTotals(Store.addMonths(m, -1), asOf, uset);
    const ar = Store.arrears(asOf, uset);
    const vac = Store.vacancyInfo(asOf, uset);
    const ren = Store.renewals(90, asOf, uset);
    const alarms = Store.consecutiveLateAlarms(asOf, uset);
    const health = Store.healthScore(asOf, uset);
    const comp = Store.complianceBuckets(uset);
    const deps = Store.depositsHeld(uset).reduce((s, x) => s + x.amount, 0);
    const rented = us.filter(u => Store.unitIsEarning(u, m, asOf)).length;
    const projects = Store.state.buildings.filter(b => !F.b || b.id === F.b);
    const pstats = projects.map(b => Store.projectStats(b.id, m, asOf));

    /* ---------- 0) سطر مشاريعك: الصورة من فوق ---------- */
    const hero = h('div.hero-strip', [
      h('div.hero-item', { onclick: () => go('#dashboard', {}) }, [
        h('span.hero-k', 'المشاريع'), h('span.hero-v.count-up', String(Store.state.buildings.length))]),
      h('div.hero-item', { onclick: () => go('#units', {}) }, [
        h('span.hero-k', 'الوحدات'), h('span.hero-v.count-up', String(us.length))]),
      h('div.hero-item.hero-good', { onclick: () => go('#units', { st: 'occupied', b: F.b }) }, [
        h('span.hero-k', 'مؤجَّر'), h('span.hero-v.count-up', String(rented))]),
      h('div.hero-item.hero-bad', { onclick: () => go('#units', { st: 'notEarning', b: F.b }) }, [
        h('span.hero-k', 'شاغرة'), h('span.hero-v.count-up', String(us.length - rented))]),
      h('div.hero-item', { onclick: () => go('#matrix', { b: F.b }) }, [
        h('span.hero-k', 'المطلوب تحصيله — ' + Store.periodLabel(m)),
        h('span.hero-v.count-up', money(mt.due + mt.unknownDue, { bare: true }))]),
      h('div.hero-item', { onclick: () => go('#matrix', { b: F.b }) }, [
        h('span.hero-k', 'ما تم تحصيله'),
        h('span.hero-v.count-up' + (mt.rate != null && mt.rate < 0.7 ? '.val-critical' : ''), money(mt.collected, { bare: true }))]),
      h('div.hero-item.hero-score', { onclick: () => openHealthDrawer(health) }, [
        h('span.hero-k', 'التقييم العام'),
        h('span.hero-gauge', [
          h('span.hero-v.count-up', String(health.score)),
          h('span.hero-max', '/100'),
        ]),
        h('span.hero-hint', 'اضغط للتفاصيل'),
      ]),
    ]);

    /* شرح التقييم العام بأرقامه الفعلية — الرقم لازم يفسّر نفسه */
    function openHealthDrawer(hh) {
      const rows = [
        ['نسبة التحصيل الشهرية', hh.parts.collectScore, 40, 'كلما اقتربت نسبة تحصيلك من 100٪ ارتفعت النقاط'],
        ['نسبة الإشغال', hh.parts.occScore, 25, 'الوحدات المؤجَّرة من إجمالي الوحدات'],
        ['اكتمال التأكيد', 15 - hh.parts.unknownPenalty, 15, 'تنخفض كلما زادت المبالغ التي لم يُحسم أمرها (سداد أم تأخير؟)'],
        ['حداثة المتأخرات', 10 - hh.parts.agingPenalty, 10, 'تنخفض كلما تقادمت المتأخرات فوق 90 يومًا'],
        ['أمان العقود', 10 - hh.parts.expiringPenalty, 10, 'تنخفض مع كثرة العقود المنتهية أو القريبة من الانتهاء دون تجديد'],
      ];
      openDrawer('التقييم العام — كيف يُحسب؟', [
        h('p.step-hint', 'رقم واحد من 100 يلخِّص وضع مشاريعك، مجموع خمسة مكوّنات محسوبة من بياناتك الفعلية:'),
        h('table.table.table-mini', [
          h('thead', h('tr', [h('th', 'المكوِّن'), h('th', 'نقاطك'), h('th', 'من'), h('th', 'المعنى')])),
          h('tbody', rows.map(r => h('tr', [
            h('td', h('b', r[0])),
            h('td', h('b' + (r[1] < r[2] * 0.6 ? '.val-critical' : '.val-good'), String(Math.max(0, Math.round(r[1]))))),
            h('td', String(r[2])),
            h('td', r[3]),
          ]))),
        ]),
        h('p.unpaid-total', ['الإجمالي: ', h('b', hh.score + ' / 100')]),
        h('p.step-hint', 'كل تحصيل تسجِّله، أو تأكيد تحسمه، أو عقد تجدِّده — يرفع الرقم فورًا.'),
      ], [h('button.btn.btn-ghost', { onclick: closeDrawer }, 'إغلاق')]);
    }
    hero.querySelectorAll('.hero-item[onclick], .hero-item').forEach(el => { if (el.onclick) keyClickable(el); });

    /* ---------- 1) المشاريع: البطاقة الأم لكل مشروع ---------- */
    const projCards = pstats.map(ps => {
      const b = ps.building;
      const rPct = ps.unitsTotal ? ps.rented / ps.unitsTotal : 0;
      const card = h('div.proj-card' + (F.b === b.id ? '.proj-on' : ''), {
        onclick: () => go('#dashboard', { b: F.b === b.id ? '' : b.id }),
      }, [
        h('div.proj-head', [
          h('div', [
            h('h3.proj-name', b.name),
            h('div.proj-owner', (b.owner ? 'المالك: ' + b.owner : '') + (b.demo ? ' · بيانات تجريبية' : '')),
          ]),
          b.demo ? h('span.chip.chip-neutral', 'تجريبي') : h('span.chip.chip-good-soft', 'فعلي'),
        ]),
        h('div.proj-units', [
          h('div.proj-bar', [
            h('span.proj-bar-rented', { style: { width: (rPct * 100) + '%' } }),
          ]),
          h('div.proj-bar-legend', [
            h('span.pb-good', `مؤجَّرة ${ps.rented}`),
            h('span.pb-mid', `${ps.unitsTotal} وحدة`),
            h('span.pb-bad', `شاغرة ${ps.vacant}`),
          ]),
        ]),
        h('div.proj-nums', [
          h('div.pn', [h('span.pn-k', 'إيجارات ' + Store.periodLabel(m)), h('span.pn-v', money(ps.monthDue, { bare: true }))]),
          h('div.pn', [h('span.pn-k', 'المحصَّل'), h('span.pn-v' + (ps.rate != null && ps.rate < 0.7 ? '.val-critical' : '.val-good'), ps.rate == null ? '—' : pct(ps.rate))]),
          h('div.pn', [h('span.pn-k', 'متأخرات'), h('span.pn-v' + (ps.arrears ? '.val-critical' : ''), money(ps.arrears, { bare: true }))]),
          h('div.pn', [h('span.pn-k', 'خسارة الشواغر/شهر'), h('span.pn-v' + (ps.vacancyLossMonthly ? '.val-warning' : ''), ps.vacancyLossMonthly ? '≈' + money(ps.vacancyLossMonthly, { bare: true }) : '—')]),
        ]),
        (ps.expiringSoon || ps.unknownArrears) ? h('div.proj-flags', [
          ps.expiringSoon ? h('span.chip.chip-serious', `${ps.expiringSoon} عقد ينتهي قريبًا`) : null,
          ps.unknownArrears ? h('span.chip.chip-critical', 'متأخرات قيمتها غير معروفة') : null,
        ]) : null,
      ]);
      bindTip(card, () =>
        `<b>${b.name}</b><br>` +
        `مؤجَّر: ${ps.rented} · شاغرة: ${ps.vacant} من ${ps.unitsTotal}<br>` +
        `إيجارات ${Store.periodLabel(m, true)}: ${money(ps.monthDue)}<br>` +
        `المحصَّل: ${money(ps.monthCollected)} (${ps.rate == null ? '—' : pct(ps.rate)})<br>` +
        `تأمينات عند المالك: ${money(ps.deposits)}<br>` +
        '<i>اضغط لتركيز جميع الشاشات على هذا المشروع</i>');
      return keyClickable(card);
    });

    /* ---------- 2) فلوس ومخاطر — كل كارد يودّي للمفلتر الصح ---------- */
    const rateDelta = (mt.rate != null && mtPrev.rate != null)
      ? Math.round((mt.rate - mtPrev.rate) * 100) : null;
    const tiles = h('div.tiles', [
      tile({
        label: 'تحصيل ' + Store.periodLabel(m, true),
        value: mt.rate == null ? '—' : pct(mt.rate),
        ic: 'money', tone: 'accent',
        delta: rateDelta ? { dir: rateDelta > 0 ? 'up' : 'down', good: rateDelta > 0, text: Math.abs(rateDelta) + ' نقطة' } : null,
        sub: `${money(mt.collected, { bare: true })} من ${money(mt.due)}`,
        spark: Charts.sparkline(Store.collectionSeries(m, 6, asOf, uset).map(x => x.rate)),
        onclick: () => go('#matrix', { b: F.b }),
      }),
      tile({
        label: 'المتأخرات',
        value: money(ar.total, { bare: true }),
        ic: 'trendDown', tone: 'critical',
        valueClass: ar.total > 0 ? 'val-critical' : '',
        sub: `${ar.rows.length} شهر متأخر` + (ar.unknowns.length ? ` + ${ar.unknowns.length} أشهر قيمتها غير معروفة` : ''),
        onclick: () => go('#matrix', { st: 'arrears', b: F.b }),
      }),
      tile({
        label: 'خسائر الوحدات الشاغرة',
        value: vac.totalMonthly ? '≈' + money(vac.totalMonthly, { bare: true }) : '0',
        ic: 'bolt', tone: 'serious',
        valueClass: vac.totalMonthly ? 'val-warning' : '',
        sub: vac.count
          ? `${vac.count} وحدة شاغرة · متوسط مدة الشغور ${vac.avgMonths != null ? vac.avgMonths + ' شهر' : '—'} · إجمالي الفاقد ≈${money(vac.totalAccum, { bare: true })}`
          : 'لا توجد وحدات شاغرة',
        onclick: () => {
          if (!vac.count) return;
          openDrawer('خسائر الوحدات الشاغرة — وحدة بوحدة وأساس الحساب', [
            h('p.step-hint', 'الخسارة الشهرية تقدير مُعلَن الأساس: آخر إيجار دفعته الوحدة نفسها، وإن لم تُؤجَّر من قبل فمتوسط إيجار وحدات نوعها. اضغط أي سطر لفتح ملف الوحدة.'),
            h('div.mini-scroll', h('table.table.table-mini', [
              h('thead', h('tr', [h('th', 'الوحدة'), h('th', 'شاغرة منذ'), h('th', 'خسارة/شهر'), h('th', 'أساس الحساب'), h('th', 'الفاقد حتى الآن')])),
              h('tbody', vac.rows.map(r => keyClickable(h('tr.row-click', {
                onclick: () => { closeDrawer(); Views.openUnitDrawer(r.unit); },
              }, [
                h('td', [h('b', r.unit.name), h('span.exp-proj', ' — ' + bName(r.unit.buildingId))]),
                h('td', r.months != null ? r.months + ' شهر' : 'لم تؤجَّر من قبل'),
                h('td', r.estMonthly != null ? h('b.val-warning', '≈' + money(r.estMonthly, { bare: true })) : '—'),
                h('td', r.src || 'لا أساس متاح'),
                h('td', r.accumLoss != null ? h('span.val-critical', '≈' + money(r.accumLoss, { bare: true })) : '—'),
              ])))),
            ])),
            h('p.unpaid-total', ['إجمالي الخسارة الشهرية: ', h('b.val-warning', '≈' + money(vac.totalMonthly))]),
          ], [
            h('button.btn.btn-primary', { onclick: () => { closeDrawer(); go('#units', { st: 'notEarning', b: F.b }); } }, 'افتح الوحدات الشاغرة'),
            h('button.btn.btn-ghost', { onclick: closeDrawer }, 'إغلاق'),
          ]);
        },
      }),
      tile({
        label: 'سداد قديم يحتاج تأكيدًا',
        value: money(ar.undocumentedTotal, { bare: true }),
        ic: 'question', tone: 'warning',
        valueClass: ar.undocumentedTotal > 0 ? 'val-warning' : '',
        sub: ar.undocumented.length
          ? `${ar.undocumented.length} أشهر مذكورة في الورقة بلا علامة — اسأل المالك: سُدِّدت أم متأخرة؟`
          : 'لا شيء بانتظار التأكيد',
        onclick: () => {
          if (!ar.undocumented.length) { go('#quality', {}); return; }
          openDrawer('سداد قديم يحتاج تأكيدًا — من بالضبط؟', [
            h('p.step-hint', 'هذه الأشهر داخل مدة العقد لكن الورقة القديمة لم تضع عليها ✓ ولا ✗ — لا تُعتبر سدادًا ولا متأخرات قبل سؤال المالك. اضغط أي سطر لفتح خلية الشهر وتسجيل الحقيقة.'),
            h('ul.unpaid-list', ar.undocumented.map(r => {
              const u = Store.unit(r.unitId);
              const cs = Store.unitContracts(u.id);
              const tid = cs.length ? cs[cs.length - 1].tenantId : null;
              return keyClickable(h('li.unpaid-row', {
                onclick: () => { closeDrawer(); Views.openCellDrawer(u, r.period, asOf); },
              }, [
                h('div.unpaid-who', [h('b', tid ? tName(tid) : '—'), h('span.unpaid-unit', ` — ${u.name} (${bName(u.buildingId)})`)]),
                h('div.unpaid-side', [
                  h('span.unpaid-amt', money(r.amount, { bare: true })),
                  h('span.chip.chip-unknown', Store.periodLabel(r.period, true)),
                ]),
              ]));
            })),
            h('p.unpaid-total', ['الإجمالي غير المحسوم: ', h('b.val-warning', money(ar.undocumentedTotal))]),
          ], [h('button.btn.btn-ghost', { onclick: closeDrawer }, 'إغلاق')]);
        },
      }),
      tile({
        label: 'تأمينات عند المالك',
        value: money(deps, { bare: true }),
        ic: 'shield', tone: 'violet',
        sub: 'ليست دخلًا — التزام يُرَدُّ عند نهاية العقد (خارج الإيرادات)',
        onclick: () => {
          const rows = Store.depositsHeld(uset);
          openDrawer('التأمينات عند المالك', [
            h('p.step-hint', 'التأمين ≈ شهر إيجار (البند الخامس) — بيترد بالكامل عند التسليم أو بيتخصم منه الإصلاحات. مش بيدخل في حسابات الدخل.'),
            h('table.table.table-mini', [
              h('thead', h('tr', [h('th', 'المشروع'), h('th', 'الوحدة'), h('th', 'المستأجر'), h('th', 'المبلغ')])),
              h('tbody', rows.map(x => h('tr', [
                h('td', bName(Store.unit(x.contract.unitId).buildingId)),
                h('td', (Store.unit(x.contract.unitId) || {}).name),
                h('td', tName(x.contract.tenantId)),
                h('td', money(x.amount, { bare: true })),
              ]))),
            ]),
          ], [h('button.btn.btn-ghost', { onclick: closeDrawer }, 'إغلاق')]);
        },
      }),
      tile({
        label: 'التزام المستأجرين',
        value: comp.perTenant.length ? `${comp.punctual} ملتزم` : '—',
        ic: 'check', tone: 'good',
        sub: comp.perTenant.length
          ? `${comp.sometimesLate} يتأخر أحيانًا · ${comp.delinquent} متعثر — بالنقاط من سجل السداد الفعلي`
          : 'يُحسب من الدفعات المسجَّلة بتاريخ — يظهر بعد أول أشهر التشغيل',
        onclick: () => {
          if (!comp.perTenant.length) { go('#insights', { b: F.b }); return; }
          openDrawer('التزام المستأجرين — بالأسماء والنقاط', [
            h('p.step-hint', 'النقاط = نسبة الدفعات التي وصلت في ميعادها (يوم الاستحقاق + أيام السماح) من سجل السداد الفعلي المُوثَّق.'),
            h('table.table.table-mini', [
              h('thead', h('tr', [h('th', 'المستأجر'), h('th', 'دفعات'), h('th', 'في الميعاد'), h('th', 'النقاط'), h('th', 'التقييم')])),
              h('tbody', comp.perTenant.map(x => h('tr', [
                h('td', x.tenant.name),
                h('td', String(x.n)),
                h('td', String(x.onTime)),
                h('td', h('b', x.points + '/100')),
                h('td', x.points >= 90 ? statusChip('good', 'ملتزم')
                  : x.points >= 60 ? statusChip('warning', 'يتأخر أحيانًا')
                  : statusChip('critical', 'متعثر')),
              ]))),
            ]),
          ], [h('button.btn.btn-ghost', { onclick: closeDrawer }, 'إغلاق')]);
        },
      }),
    ]);

    /* ---------- 3) الدخل الجاي + داخل/خارج ---------- */
    const rev = Store.contractedRevenue(cur, 12, uset);
    const io = Store.inOutForecast(cur, 12, uset);
    const ioNotes = io.filter(x => x.starts.length || x.ends.length);
    const ioStrip = ioNotes.length
      ? h('div.mini-scroll', h('table.table.table-mini.io-table', [
          h('thead', h('tr', [h('th', 'الشهر'), h('th', 'وحدات داخلة'), h('th', 'وحدات خارجة'), h('th', 'دخل الشهر'), h('th', 'الأثر')])),
          h('tbody', ioNotes.slice(0, 6).map(x => keyClickable(h('tr.row-click', { onclick: () => openIoDrawer(io) }, [
            h('td', h('b', Store.periodLabel(x.period, true))),
            h('td', x.starts.length ? h('span.val-good', '+' + x.starts.length) : '—'),
            h('td', x.ends.length ? h('span.val-critical', '−' + x.ends.length) : '—'),
            h('td', money(x.income, { bare: true })),
            h('td', x.deltaPct == null || x.deltaPct === 0 ? '—'
              : h('span' + (x.deltaPct < 0 ? '.val-critical' : '.val-good'), (x.deltaPct > 0 ? '▲ +' : '▼ ') + x.deltaPct + '%')),
          ])))),
        ]))
      : h('p.note-line', 'لا حركة دخول أو خروج متوقعة خلال الاثني عشر شهرًا القادمة.');

    function openIoDrawer(list) {
      openDrawer('حركة الوحدات: داخل / خارج', [
        h('p.step-hint', 'لكل شهر: عقود تبدأ (داخلة) وعقود تنتهي دون تجديد (خارجة) وأثر ذلك على دخل الشهر.'),
        h('table.table.table-mini', [
          h('thead', h('tr', [h('th', 'الشهر'), h('th', 'داخلة'), h('th', 'خارجة'), h('th', 'الدخل المتوقع'), h('th', 'التغير')])),
          h('tbody', list.map(x => h('tr', [
            h('td', Store.periodLabel(x.period, true)),
            h('td', x.starts.length ? x.starts.map(c => (Store.unit(c.unitId) || {}).name).join('، ') : '—'),
            h('td', x.ends.length ? h('span.val-critical', x.ends.map(c => (Store.unit(c.unitId) || {}).name).join('، ')) : '—'),
            h('td', money(x.income, { bare: true })),
            h('td', x.deltaPct == null ? '—' : h('span' + (x.deltaPct < 0 ? '.val-critical' : '.val-good'), (x.deltaPct > 0 ? '+' : '') + x.deltaPct + '%')),
          ]))),
        ]),
      ], [h('button.btn.btn-ghost', { onclick: closeDrawer }, 'إغلاق')]);
    }

    /* ---------- 4) عقود تنتهي خلال 90 يومًا (أعلن / اتصرف) ---------- */
    const expiring = [...ren.overdue.map(r => ({ c: r.contract, days: -r.daysAgo })),
                      ...ren.soon.map(r => ({ c: r.contract, days: r.daysLeft }))];
    const expiringList = expiring.length
      ? h('ul.exp-list', expiring.slice(0, 8).map(x => {
          const u = Store.unit(x.c.unitId);
          const row = h('li.exp-row', { onclick: () => Views.openUnitDrawer(u) }, [
            h('span.exp-unit', [h('b', u.name), h('span.exp-proj', ' — ' + bName(u.buildingId))]),
            h('span.exp-tenant', tName(x.c.tenantId)),
            h('span.exp-date', shortDate(x.c.end)),
            x.days < 0
              ? statusChip('critical', `انتهى منذ ${Math.abs(x.days)} يوم`)
              : statusChip('serious', `متبقّي ${x.days} يوم`),
          ]);
          return keyClickable(row);
        }))
      : emptyState('لا عقود تنتهي خلال 90 يومًا');

    /* ---------- 5) الألارم: شهرين ورا بعض من غير سداد ---------- */
    const alarmCard = alarms.length ? h('section.card.alarm-card', [
      h('div.card-head', [h('h3.card-title', [icon('warn'), ' 🚨 متأخرون شهرين متتاليين — يلزم إجراء']),
        h('span.chip.chip-critical', alarms.length + ' حالة')]),
      h('ul.alarm-list', alarms.map(a => {
        const row = h('li.alarm-row', {
          onclick: () => a.tenant ? Views.openTenantDrawer(a.tenant) : Views.openCellDrawer(a.unit, a.periods[a.periods.length - 1], asOf),
        }, [
          h('span.alarm-who', [h('b', a.tenant ? a.tenant.name : '—'), h('span.exp-proj', ` — ${a.unit.name} (${bName(a.unit.buildingId)})`)]),
          h('span.alarm-months', `${a.months} أشهر متتالية`),
          h('span.alarm-amt.val-critical', a.unknownAmt ? 'القيمة غير معروفة' : money(a.amount)),
        ]);
        return keyClickable(row);
      })),
    ]) : null;

    /* ---------- 6) من لم يسدِّد الشهر ده ---------- */
    function unpaidCard() {
      const rows = [];
      for (const u of us) {
        const ci = Store.cellInfo(u.id, m, asOf);
        if (!['late', 'partial', 'due', 'unknown'].includes(ci.status)) continue;
        const cs = Store.unitContracts(u.id);
        const tid = cs.length ? cs[cs.length - 1].tenantId : null;
        rows.push({
          u, ci, tenant: tid ? tName(tid) : '—',
          amount: ci.unknownAmount ? null : ci.due ? Math.max(0, ci.due.amount - ci.paid) : null,
        });
      }
      rows.sort((a, b) => (b.amount || 0) - (a.amount || 0));
      const total = rows.reduce((s, r) => s + (r.amount || 0), 0);
      const chipOf = ci =>
        ci.status === 'late' ? statusChip('critical', ci.unknownAmount ? 'متأخر — قيمته غير معروفة' : 'متأخر')
        : ci.status === 'partial' ? statusChip('warning', 'سداد جزئي')
        : ci.status === 'unknown' ? statusChip('unknown', 'يحتاج تأكيد')
        : statusChip('neutral', 'ضمن المهلة');
      return sectionCard(`من لم يسدِّد ${Store.periodLabel(m, true)}؟`,
        rows.length
          ? h('div', [
              h('ul.unpaid-list', rows.slice(0, 8).map(r =>
                keyClickable(h('li.unpaid-row', { onclick: () => Views.openCellDrawer(r.u, m, asOf) }, [
                  h('div.unpaid-who', [h('b', r.tenant), h('span.unpaid-unit', ` — ${r.u.name} (${bName(r.u.buildingId)})`)]),
                  h('div.unpaid-side', [
                    r.amount != null ? h('span.unpaid-amt', money(r.amount, { bare: true })) : h('span.unpaid-amt.val-critical', '؟'),
                    chipOf(r.ci),
                  ]),
                ])))),
              h('p.unpaid-total', ['الإجمالي غير المحصَّل: ', h('b.val-critical', money(total)),
                rows.some(r => r.amount == null) ? ' + مبالغ غير معروفة' : '']),
            ])
          : emptyState('الجميع سدَّد هذا الشهر ✓'));
    }

    /* ---------- تجميع الصفحة ---------- */
    const filterRow = h('div.filter-row', [
      h('span.filter-label', 'شهر التقرير'),
      h('div.month-nav', [
        h('button.btn-icon', { onclick: () => { dashMonth = Store.addMonths(dashMonth, -1); App.render(); }, 'aria-label': 'شهر أسبق' }, icon('right')),
        h('span.month-name', Store.periodLabel(m, true)),
        h('button.btn-icon', { onclick: () => { dashMonth = Store.addMonths(dashMonth, 1); App.render(); }, 'aria-label': 'شهر أحدث' }, icon('left')),
      ]),
      h('button.btn.btn-ghost', { onclick: () => { dashMonth = Store.addMonths(cur, -1); App.render(); } }, 'آخر شهر مكتمل'),
    ]);

    return h('div.view.anim-in', [
      hero,
      filterRow,
      alarmCard,
      tiles,
      sectionCard('المشاريع — اختر مشروعًا لتركيز جميع الأرقام عليه',
        h('div.proj-grid', projCards),
        F.b ? h('button.btn.btn-ghost', { onclick: () => go('#dashboard', {}) }, 'عرض كل المشاريع') : null),
      h('div.grid-2', [
        sectionCard('الدخل المتوقع 12 شهر (من العقود — التأمينات غير محسوبة)', h('div', [
          h('p.hero-line', [h('span.hero-num.count-up', money(rev.total, { bare: true })), h('span.hero-unit', ' ج.م'),
            rev.anyEstimated ? statusChip('unknown', 'فيه قيم تقديرية') : null]),
          Charts.revenueChart(rev.series),
          h('div.io-wrap', [h('h4.io-title', 'حركة الوحدات (دخول/خروج) وأثرها'),
            h('p.step-hint', '«داخلة» = وحدة يبدأ عقدها ذلك الشهر فيُضاف إيجارها إلى الدخل، و«خارجة» = وحدة ينتهي عقدها دون تجديد فيسقط إيجارها. «الأثر» = نسبة تغيّر دخل الشهر عن الشهر السابق بسبب ذلك.'),
            ioStrip]),
        ])),
        sectionCard('عقود تنتهي خلال 90 يومًا — للإعلان أو التجديد', expiringList),
      ]),
      h('div.grid-2', [
        sectionCard('التحصيل شهرًا بشهر', Charts.collectionChart(Store.collectionSeries(m, 12, asOf, uset))),
        unpaidCard(),
      ]),
      h('div.grid-2', [
        sectionCard('أعمار المتأخرات', h('div', [
          Charts.agingChart(ar.buckets),
          ar.unknowns.length ? h('p.note-line', [icon('warn'), ` غير مشمول: ${ar.unknowns.length} أشهر قيمتها غير معروفة (لا يوجد عقد مسجّل).`]) : null,
        ])),
        sectionCard('آخر الحركات', Store.state.log.length
          ? h('ul.acts', Store.state.log.slice(0, 8).map(x => h('li.act', [h('span.act-t', x.at), h('span', x.txt)])))
          : emptyState('لا حركات بعد')),
      ]),
    ]);
  }

  /* ترجمات اللوحة الجديدة */
  I18N.extend({
    'المشاريع': 'Projects', 'الوحدات': 'Units', 'مؤجَّر': 'Rented', 'شاغرة': 'Vacant',
    'ما تم تحصيله': 'Actually collected', 'التقييم العام': 'Portfolio health',
    'المشاريع — اختر مشروعًا لتركيز جميع الأرقام عليه': 'Projects — click one to focus every figure on it',
    'عرض كل المشاريع': 'Back to all projects', 'بيانات تجريبية': 'sample data',
    'تجريبي': 'Sample', 'فعلي': 'Real', 'وحدة': 'units',
    'المتأخرات': 'Arrears', 'شهر متأخر': 'late months',
    'خسائر الوحدات الشاغرة': 'Vacancy loss', 'لا توجد وحدات شاغرة': 'No vacant units',
    'سداد يحتاج تأكيد': 'Payments needing confirmation', 'لا شيء بانتظار التأكيد': 'All confirmed',
    'تأمينات عند المالك': 'Deposits held by owner',
    'ليست دخلًا — التزام يُرَدُّ عند نهاية العقد (خارج الإيرادات)': 'Not income — a liability returned at contract end (kept out of revenue)',
    'التزام المستأجرين': 'Tenant punctuality',
    'الدخل المتوقع 12 شهر (من العقود — التأمينات غير محسوبة)': 'Expected income, 12 months (from contracts — deposits excluded)',
    'حركة الوحدات (دخول/خروج) وأثرها': 'Move-ins / move-outs and their impact',
    '«داخلة» = وحدة يبدأ عقدها ذلك الشهر فيُضاف إيجارها إلى الدخل، و«خارجة» = وحدة ينتهي عقدها دون تجديد فيسقط إيجارها. «الأثر» = نسبة تغيّر دخل الشهر عن الشهر السابق بسبب ذلك.':
      '“Moving in” = a unit whose contract starts that month, adding its rent to income. “Moving out” = a unit whose contract ends unrenewed, dropping its rent. “Impact” = the resulting % change in that month’s income vs the month before.',
    'حركة الوحدات: داخل / خارج': 'Unit movement: in / out',
    'عقود تنتهي خلال 90 يومًا — للإعلان أو التجديد': 'Contracts ending within 90 days — advertise or renew',
    'لا عقود تنتهي خلال 90 يومًا': 'No contracts ending within 90 days',
    '🚨 متأخرون شهرين متتاليين — يلزم إجراء': '🚨 Two consecutive unpaid months — act now',
    'حالة': 'cases', 'أشهر متتالية': 'consecutive months', 'القيمة غير معروفة': 'amount unknown',
    'التحصيل شهرًا بشهر': 'Collection month by month',
    'أعمار المتأخرات': 'Arrears aging', 'المطلوب تحصيله — ': 'To collect — ',
    'الجميع سدَّد هذا الشهر ✓': 'Everyone paid this month ✓',
    'الإجمالي غير المحصَّل: ': 'Total outstanding: ', ' + مبالغ غير معروفة': ' + unknown amounts',
    'متأخر — قيمته غير معروفة': 'Late — amount unknown', 'سداد جزئي': 'Partial',
    'يحتاج تأكيد': 'Needs confirmation', 'ضمن المهلة': 'Still in grace',
    'داخلة': 'in', 'خارجة': 'out', 'الدخل المتوقع': 'Expected income', 'التغير': 'Change',
    'لا حركة دخول أو خروج متوقعة خلال الاثني عشر شهرًا القادمة.': 'No move-ins or move-outs expected in the next 12 months.',
    'لكل شهر: عقود تبدأ (داخلة) وعقود تنتهي دون تجديد (خارجة) وأثر ذلك على دخل الشهر.':
      'Each month: contracts starting (in), contracts ending without renewal (out), and the impact on that month’s income.',
    'التأمين ≈ شهر إيجار (البند الخامس) — بيترد بالكامل عند التسليم أو بيتخصم منه الإصلاحات. مش بيدخل في حسابات الدخل.':
      'Deposit ≈ one month’s rent (clause 5) — returned in full on handover or reduced by repairs. Never counted as income.',
  });
  I18N.addPatterns([
    [/^من لم يسدِّد (.+)؟$/, m2 => 'Who has not paid — ' + I18N.tt(m2[1]) + '?'],
    [/^تحصيل (.+)$/, m2 => 'Collection — ' + I18N.tt(m2[1])],
    [/^إيجارات (.+)$/, m2 => I18N.tt(m2[1]) + ' rents'],
    [/^انتهى منذ (\d+) يوم$/, m2 => `Ended ${m2[1]}d ago`],
    [/^متبقّي (\d+) يوم$/, m2 => `${m2[1]}d left`],
    [/^(\d+) عقد ينتهي قريبًا$/, m2 => `${m2[1]} contracts ending soon`],
    [/^متأخرات قيمتها غير معروفة$/, () => 'Arrears of unknown amount'],
    [/^(\d+) وحدة شاغرة · متوسط مدة الشغور (.+) · إجمالي الفاقد ≈([\d,]+)$/,
      m2 => `${m2[1]} vacant units · avg vacancy ${I18N.tt(m2[2])} · lost so far ≈${m2[3]}`],
    [/^(\d+) شهرًا من الورقة يحتاج تأكيدًا: سداد أم تأخير؟$/, m2 => `${m2[1]} paper months unconfirmed — paid or late?`],
    [/^(\d+) يتأخر أحيانًا · (\d+) متعثر — بالنقاط من سجل السداد الفعلي$/,
      m2 => `${m2[1]} sometimes late · ${m2[2]} delinquent — scored from actual payment history`],
    [/^يُحسب من الدفعات المسجَّلة بتاريخ — يظهر بعد أول أشهر التشغيل$/,
      () => 'Scored from dated payments — appears after the first operating months'],
    [/^خسارة الشواغر\/شهر$/, () => 'Vacancy loss/mo'],
    [/^المحصَّل$/, () => 'Collected'],
    [/^(\d+) ملتزم$/, m2 => `${m2[1]} punctual`],
    [/^(\d+) أشهر مذكورة في الورقة بلا علامة — اسأل المالك: سُدِّدت أم متأخرة؟$/,
      m2 => `${m2[1]} paper months carry no mark — ask the owner: paid or late?`],
    [/^معروض أهم (\d+) وحدات من (\d+) — الباقي ساري ومستقر، اعرضه بالزر أعلاه\.$/,
      m2 => `Showing the top ${m2[1]} of ${m2[2]} units — the rest are stable; use the button above to see them.`],
    [/^عرض كل الوحدات \((\d+)\)$/, m2 => `Show all units (${m2[1]})`],
    [/^مؤجَّرة (\d+)$/, m2 => `Rented ${m2[1]}`],
    [/^شاغرة (\d+)$/, m2 => `Vacant ${m2[1]}`],
    [/^(\d+) وحدة$/, m2 => `${m2[1]} units`],
    [/^(\d+) أشهر متتالية$/, m2 => `${m2[1]} months in a row`],
    [/^المالك: (.+)$/, m2 => 'Owner: ' + I18N.tt(m2[1])],
    /* شظايا مركّبة رصدها السكانر */
    [/^المطلوب تحصيله — (.+)$/, m2 => 'To collect — ' + I18N.tt(m2[1])],
    [/^(\d+) شهر متأخر \+ (\d+) أشهر قيمتها غير معروفة$/, m2 => `${m2[1]} late months + ${m2[2]} months of unknown amount`],
    [/^(\d+) شهر متأخر$/, m2 => `${m2[1]} late months`],
    [/^(\d+) حالة$/, m2 => `${m2[1]} cases`],
    [/^\+(\d+) داخلة · −(\d+) خارجة$/, m2 => `+${m2[1]} in · −${m2[2]} out`],
    [/^\+(\d+) داخلة$/, m2 => `+${m2[1]} in`],
    [/^−(\d+) خارجة$/, m2 => `−${m2[1]} out`],
    [/^→ الدخل ([+\-−]?\d+)%$/, m2 => ` → income ${m2[1]}%`],
    [/^تحصيل (.+?) (انخفض|ارتفع) (\d+) نقطة$/,
      m2 => `Collection — ${I18N.tt(m2[1])} ${m2[2] === 'انخفض' ? 'down' : 'up'} ${m2[3]} pts`],
    [/^تحصيل (\d+)\/40 · إشغال (\d+)\/25 · خصم عدم التأكيد (\d+) · خصم تعمّر المتأخرات (\d+) · خصم الانتهاءات (\d+)$/,
      m2 => `Collection ${m2[1]}/40 · occupancy ${m2[2]}/25 · unconfirmed −${m2[3]} · arrears aging −${m2[4]} · expiries −${m2[5]}`],
    [/^من دخل الشهر معتمد على مستأجر واحد: (.+)$/, m2 => "of this month's income depends on a single tenant: " + I18N.tt(m2[1])],
    [/^(\d+) vacant units · avg vacancy ([\d.]+) شهر · lost so far ≈([\d,]+)$/,
      m2 => `${m2[1]} vacant units · avg vacancy ${m2[2]} mo · lost so far ≈${m2[3]}`],
    [/^غير مشمول: (\d+) أشهر قيمتها غير معروفة \(لا يوجد عقد مسجّل\)\.$/,
      m2 => `Excluded: ${m2[1]} months of unknown amount (no contract on file).`],
  ]);
  I18N.addTokens([
    [/،/g, ','],
    [/([\d.]+) شهر/g, '$1 mo'],
  ]);
  /* شريط الترشيح النشط */
  I18N.extend({
    'الأرقام المعروضة مُرشَّحة على:': 'Figures below are filtered by:',
    'عرض الكل': 'Show all', 'إزالة هذا الترشيح': 'Remove this filter',
    'شاغرة (لا إيراد منها)': 'Vacant (no income)', 'تنتهي قريبًا': 'Ending soon',
    'عقد منتهٍ بلا تجديد': 'Ended, no renewal',
  });
  I18N.addPatterns([
    [/^المشروع: (.+)$/, m2 => 'Project: ' + I18N.tt(m2[1])],
    [/^النوع: (.+)$/, m2 => 'Type: ' + I18N.tt(m2[1])],
    [/^المستأجر: (.+)$/, m2 => 'Tenant: ' + I18N.tt(m2[1])],
    [/^الحالة: (.+)$/, m2 => 'State: ' + I18N.tt(m2[1])],
    [/^بحث: (.+)$/, m2 => 'Search: ' + m2[1]],
  ]);
  /* جدول أنواع الإدخال */
  I18N.extend({
    'أنواع الإدخال في النظام — ماذا تُدخل ومن أين': 'Entry types — what you enter and where',
    'ماذا تريد أن تُدخل؟': 'What do you want to enter?', 'من أين': 'Where', 'الخطوات باختصار': 'Steps in short',
    'مشروع جديد (ورقة كاملة)': 'New project (a full paper)', 'هذه الشاشة': 'This screen',
    'اسم المالك ← صفوف الورقة ← نقل علامات ✓/✗': 'Owner name → paper rows → transfer ✓/✗ marks',
    'دفعة شهر واحد': 'A single month payment', 'جدول التحصيل': 'Collection Sheet',
    'اضغط خلية الشهر ← المبلغ مُعبَّأ بالمتبقي ← احفظ': 'Click the month cell → amount pre-filled with the remainder → save',
    'سداد شهر كامل (دفعة واحدة للجميع)': 'Collect a whole month (one action for everyone)',
    'جدول التحصيل ← «سداد جماعي»': 'Collection Sheet → “Bulk collect”',
    'حدِّد من سدَّدوا ← تاريخ وطريقة موحَّدان ← حفظ': 'Tick who paid → one date & method → save',
    'عقد جديد أو تجديد': 'New contract or renewal',
    'العقود ← «عقد جديد» أو زر «+ إدخال»': 'Contracts → “New contract” or the “+ Add” button',
    'وحدة + مستأجر + بداية وقيمة سنة أولى — الجدول يتولَّد': 'Unit + tenant + start & year-1 rent — the schedule generates itself',
    'وحدة داخل مشروع قائم': 'A unit inside an existing project', 'الوحدات ← «وحدة جديدة»': 'Units → “New unit”',
    'اختر المشروع ← الاسم والنوع': 'Pick the project → name & type',
    'مستأجر أو تعديل بياناته': 'A tenant, or editing one', 'المستأجرون': 'Tenants',
    'اضغط الصف للتعديل أو «مستأجر جديد»': 'Click a row to edit, or “New tenant”',
    'شكوى صيانة': 'A maintenance complaint', 'الشكاوى ← «شكوى جديدة»': 'Complaints → “New complaint”',
    'الوحدة ← التصنيف والتكلفة ومن يتحمَّلها': 'Unit → category, cost and who bears it',
    'رد المالك على سؤال مراجعة': 'Owner’s answer to a review question', 'مراجعات مطلوبة': 'Reviews Needed',
    '«سجّل رد المالك» ← اكتب الإجابة — يُغلق البند': '“Record owner’s answer” → type it — the item closes',
    'ثلاث خطوات تحوِّل أي ورقة تصلك إلى مشروع حي بمؤشراته — دون Excel وسيط.':
      'Three steps turn any incoming paper into a live project with its own KPIs — no Excel in between.',
  });
  I18N.extend({
    'كل ورقة تصلك = مشروع مستقل باسم مالكها. اكتب اسم المالك كما هو مدوَّن على الورقة.':
      'Every incoming paper = an independent project named after its owner. Type the owner name exactly as written on it.',
    'الدخل السنوي المتوقع لكل مشروع (التأمينات مفصولة — ليست دخلًا)': 'Expected annual income per project (deposits separated — not income)',
    'التأمينات التزام يُرَد — اعرف سيولتك الحقيقية بدونها.': 'Deposits are a returnable liability — know your real liquidity without them.',
    'توزيع صحي للدخل على المستأجرين.': 'Healthy income spread across tenants.',
    'مراجعات مطلوبة — أسئلة للمالك': 'Reviews needed — questions for the owner',
    'تركيز المخاطر والتقييم العام': 'Risk concentration & portfolio health',
    'التقييم العام — مؤشر مجمَّع': 'Portfolio health — composite index',
    'التأمينات عند المالك': 'Deposits held by owner',
    'الإجمالي غير المحصَّل:': 'Total outstanding:',
    'إجمالي الفاقد حتى الآن': 'Lost so far', 'خسارة شهرية تقديرية': 'Costing you monthly', 'شاغرة منذ': 'Vacant for',
    'فيه قيم تقديرية': 'Includes estimates', 'المشروع': 'Project', 'جودة البيانات': 'Data quality',
    'اعتماد مرتفع — خروجه يؤثر بشدة على الدخل. نوِّع العقود القادمة أو أمِّن تجديده مبكرًا.':
      'High dependency — losing them dents the income. Diversify upcoming leases or secure their renewal early.',
    'رد تجريبي من المالك': 'Sample owner answer',
    'إنشاء الحساب وإضافة المشاريع': 'Workspace created and projects added',
    /* دفعة الشاشات الأخيرة */
    'مرتَّب بالأولوية: ما يحتاج قرارًا أولًا — القيمة داخل الشريط إيجار شهري':
      'Sorted by priority: decisions first — the value inside each bar is monthly rent',
    'عرض المختصر (الأهم فقط)': 'Show summary (top items)',
    'سداد قديم يحتاج تأكيدًا': 'Old payments needing confirmation',
    'سداد قديم يحتاج تأكيدًا — من بالضبط؟': 'Old payments needing confirmation — who exactly?',
    'هذه الأشهر داخل مدة العقد لكن الورقة القديمة لم تضع عليها ✓ ولا ✗ — لا تُعتبر سدادًا ولا متأخرات قبل سؤال المالك. اضغط أي سطر لفتح خلية الشهر وتسجيل الحقيقة.':
      'These months fall inside the contract term but the old paper carries neither ✓ nor ✗ — they count as neither payment nor arrears until the owner answers. Click any row to open that month’s cell and record the truth.',
    'الإجمالي غير المحسوم: ': 'Total unresolved: ',
    'التزام المستأجرين — بالأسماء والنقاط': 'Tenant punctuality — names and points',
    'النقاط = نسبة الدفعات التي وصلت في ميعادها (يوم الاستحقاق + أيام السماح) من سجل السداد الفعلي المُوثَّق.':
      'Points = the share of documented payments that arrived on time (due day + grace days).',
    'دفعات': 'Payments', 'النقاط': 'Points', 'يتأخر أحيانًا': 'Sometimes late',
    'التقييم العام — كيف يُحسب؟': 'Overall score — how is it computed?',
    'رقم واحد من 100 يلخِّص وضع مشاريعك، مجموع خمسة مكوّنات محسوبة من بياناتك الفعلية:':
      'One number out of 100 summarising your projects — the sum of five components computed from your actual data:',
    'المكوِّن': 'Component', 'نقاطك': 'Your points', 'المعنى': 'Meaning',
    'نسبة التحصيل الشهرية': 'Monthly collection rate',
    'كلما اقتربت نسبة تحصيلك من 100٪ ارتفعت النقاط': 'The closer your collection gets to 100%, the higher the points',
    'نسبة الإشغال': 'Occupancy rate', 'الوحدات المؤجَّرة من إجمالي الوحدات': 'Rented units out of all units',
    'اكتمال التأكيد': 'Confirmation completeness',
    'تنخفض كلما زادت المبالغ التي لم يُحسم أمرها (سداد أم تأخير؟)': 'Drops as more amounts remain unresolved (paid or late?)',
    'حداثة المتأخرات': 'Arrears freshness',
    'تنخفض كلما تقادمت المتأخرات فوق 90 يومًا': 'Drops as arrears age past 90 days',
    'أمان العقود': 'Contract safety',
    'تنخفض مع كثرة العقود المنتهية أو القريبة من الانتهاء دون تجديد': 'Drops with more contracts ended or ending soon without renewal',
    'الإجمالي: ': 'Total: ',
    'كل تحصيل تسجِّله، أو تأكيد تحسمه، أو عقد تجدِّده — يرفع الرقم فورًا.':
      'Every payment you record, confirmation you resolve, or contract you renew lifts the number instantly.',
    'اضغط للتفاصيل': 'Click for details',
    '«إضافة مشروع جديد»': '“Add New Project”',
    'وحدات داخلة': 'Moving in', 'وحدات خارجة': 'Moving out', 'دخل الشهر': 'Month income', 'الأثر': 'Impact',
    'خسائر الوحدات الشاغرة — وحدة بوحدة وأساس الحساب': 'Vacancy losses — unit by unit, with the calculation basis',
    'الخسارة الشهرية تقدير مُعلَن الأساس: آخر إيجار دفعته الوحدة نفسها، وإن لم تُؤجَّر من قبل فمتوسط إيجار وحدات نوعها. اضغط أي سطر لفتح ملف الوحدة.':
      'The monthly loss is an estimate with a declared basis: the unit’s own last rent, or the average rent of its type if never rented. Click any row to open the unit.',
    'شاغرة منذ': 'Vacant since', 'خسارة/شهر': 'Loss/mo', 'أساس الحساب': 'Calculation basis',
    'الفاقد حتى الآن': 'Lost so far', 'لم تؤجَّر من قبل': 'Never rented', 'لا أساس متاح': 'No basis available',
    'آخر إيجار للوحدة': 'The unit’s own last rent', 'متوسط النوع المماثل': 'Average of similar type',
    'إجمالي الخسارة الشهرية:': 'Total monthly loss:', 'افتح الوحدات الشاغرة': 'Open vacant units',
    'مبالغ لم يُحسم أمرها': 'Unresolved amounts',
    'كل بند منها له سؤال جاهز للمالك في «مراجعات مطلوبة» — إجابته تضع المبلغ في مكانه الصحيح: سداد يُوثَّق أو متأخرات تُسجَّل.':
      'Each item has a ready question for the owner under Reviews Needed — the answer files the amount where it belongs: a documented payment or recorded arrears.',
    'الكشف يذكر تأمينًا واحدًا (35,000 للوحدة 41). قيم تأمين باقي العقود غير معروفة رغم أنها التزام مالي يجب أن يظهر.':
      'The paper records a single deposit (35,000 for unit 41). Deposits of the remaining contracts are unknown although they are a financial liability that must be visible in the figures.',
  });

  /* اللوحة الجديدة هي الافتراضية */
  Views.dashboard = viewDashboardV3;
})();
