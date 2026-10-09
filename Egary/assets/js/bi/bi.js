/* =====================================================================
   bi.js — لوحة BI التفاعلية: مدخل متحرك بخلفية مدينة ليلية (مبانٍ تضيء نوافذها وتتحرك)،
   parallax بحركة الماوس، عدّادات حية، ثم لوحة أقسام (نظرة عامة / التحصيل / المتأخرات /
   الإشغال / العقود / المشاريع / العملاء / الصيانة) — كل رقم ورسم يفتح دليله.
   ===================================================================== */
window.Egary = window.Egary || {};
(function (E) {
  'use strict';
  const U = () => E.U, M = () => E.M, S = () => E.Store, UI = () => E.UI, En = () => E.Engine, V = () => E.Views;
  const h = (...a) => E.UI.h(...a);
  const fm = (n, o) => U().fmtMoney(n, o), fp = (p) => U().fmtPct(p), fn = (n) => U().fmtNum(n);
  let root = null, city = null, prevTheme = null, section = 'overview', unsub = null;
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- أفق المدينة (SVG هادئ) ----------
     ثلاث طبقات من صور ظلية لمبانٍ بنِسَب رشيقة (أبراج مدرَّجة ومستدقّة وبرج بقمة)، تعبئة متدرّجة
     وضباب عمق، وعدد قليل من النوافذ تضيء وتنطفئ ببطء (CSS)، وparallax ناعم مع الماوس.
     لا canvas ولا مربعات متحركة؛ المشهد مُولَّد مرة واحدة بمولّد عشوائي ثابت حتى يبدو كما هو كل مرة. */
  function makeSkyline(host) {
    let seed = 20261009; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const R = (a, b) => a + rnd() * (b - a);
    const NS = 'http://www.w3.org/2000/svg';
    const el = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
    const W = 1600, H = 520;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMax slice', class: 'skyline', 'aria-hidden': 'true' });
    const defs = el('defs', {});
    const LAYERS = [
      { id: 'far', depth: .18, top: '#1B2B52', bottom: '#111D3B', hmin: 90, hmax: 210, wmin: 44, wmax: 96, gap: [6, 20], wins: 26, win: '#BFD3FF', winA: .38 },
      { id: 'mid', depth: .45, top: '#121F40', bottom: '#0D1730', hmin: 140, hmax: 320, wmin: 56, wmax: 128, gap: [10, 30], wins: 42, win: '#FFD9A3', winA: .55 },
      { id: 'near', depth: 1, top: '#0C1428', bottom: '#070B14', hmin: 160, hmax: 420, wmin: 70, wmax: 170, gap: [16, 44], wins: 54, win: '#FFD9A3', winA: .85 },
    ];
    for (const L of LAYERS) {
      const g = el('linearGradient', { id: 'sk-' + L.id, x1: 0, y1: 0, x2: 0, y2: 1 });
      g.appendChild(el('stop', { offset: '0', 'stop-color': L.top })); g.appendChild(el('stop', { offset: '1', 'stop-color': L.bottom }));
      defs.appendChild(g);
    }
    const fog = el('linearGradient', { id: 'sk-fog', x1: 0, y1: 0, x2: 0, y2: 1 });
    fog.appendChild(el('stop', { offset: '0', 'stop-color': '#1C2E5A', 'stop-opacity': 0 })); fog.appendChild(el('stop', { offset: '1', 'stop-color': '#1C2E5A', 'stop-opacity': .55 }));
    defs.appendChild(fog);
    svg.appendChild(defs);
    for (const L of LAYERS) {
      const layer = el('g', { class: 'sk-layer sk-' + L.id, 'data-depth': L.depth });
      // المباني: الارتفاع أقل في منتصف الشاشة حتى لا تزاحم البطاقة
      let x = -80; const shapes = []; let d = '';
      while (x < W + 80) {
        const w = R(L.wmin, L.wmax);
        const mid = 1 - .45 * Math.exp(-Math.pow((x + w / 2 - W / 2) / (W * .22), 2));
        const h = R(L.hmin, L.hmax) * mid;
        const top = H - h, kind = rnd();
        if (kind < .3) { // مدرَّج
          const s1 = w * R(.55, .75), h1 = h * R(.15, .3);
          d += `M${x} ${H} V${top + h1} H${x + (w - s1) / 2} V${top} H${x + (w + s1) / 2} V${top + h1} H${x + w} V${H} Z `;
        } else if (kind < .45) { // مستدقّ بقمة
          d += `M${x} ${H} V${top + 30} L${x + w / 2} ${top - R(18, 42)} L${x + w} ${top + 30} V${H} Z `;
        } else if (kind < .6) { // برج بشرفة علوية
          d += `M${x} ${H} V${top + 16} H${x - 4} V${top + 8} H${x + w + 4} V${top + 16} H${x + w} V${H} Z `;
          d += `M${x + w * .3} ${top + 8} V${top} H${x + w * .7} V${top + 8} Z `;
        } else d += `M${x} ${H} V${top} H${x + w} V${H} Z `;
        shapes.push({ x, w, top, h });
        x += w + R(L.gap[0], L.gap[1]);
      }
      layer.appendChild(el('path', { d, fill: `url(#sk-${L.id})` }));
      // هوائيات وأضواء تحذير على بعض الأبراج القريبة
      if (L.depth === 1) for (const b of shapes) if (b.h > 300 && rnd() < .5) { layer.appendChild(el('rect', { x: b.x + b.w / 2 - 1, y: b.top - 34, width: 2, height: 34, fill: '#182748' })); layer.appendChild(el('circle', { cx: b.x + b.w / 2, cy: b.top - 36, r: 2.4, class: 'sk-beacon', style: `animation-delay:${R(0, 3).toFixed(2)}s` })); }
      // النوافذ: قليلة ومنتظمة، كل واحدة تضيء وتنطفئ ببطء بتأخير مختلف
      const wins = el('g', { class: 'sk-wins' });
      let placed = 0, guard = 0;
      while (placed < L.wins && guard++ < 2000) {
        const b = shapes[Math.floor(rnd() * shapes.length)];
        const cols = Math.max(2, Math.floor(b.w / 18)), rows = Math.max(3, Math.floor(b.h / 24));
        const c = Math.floor(rnd() * cols), r = 1 + Math.floor(rnd() * (rows - 1));
        const wx = b.x + 8 + c * ((b.w - 16) / cols) + 2, wy = b.top + 14 + r * ((b.h - 24) / rows);
        if (wy > H - 30) continue;
        wins.appendChild(el('rect', { x: wx.toFixed(1), y: wy.toFixed(1), width: L.depth === 1 ? 6 : 4, height: L.depth === 1 ? 9 : 6, rx: 1, fill: L.win, class: 'sk-win', style: `--a:${L.winA};animation-duration:${R(7, 16).toFixed(1)}s;animation-delay:${(-R(0, 16)).toFixed(1)}s` }));
        placed++;
      }
      layer.appendChild(wins);
      if (L.depth < 1) layer.appendChild(el('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#sk-fog)', opacity: L.depth === .18 ? 1 : .5 }));
      svg.appendChild(layer);
    }
    host.appendChild(svg);
    return { setTilt(x, y) { host.style.setProperty('--px', x.toFixed(3)); host.style.setProperty('--py', y.toFixed(3)); }, destroy() { svg.remove(); } };
  }

  /* ---------- عدّاد متحرك ---------- */
  function countUp(el, to, fmtFn, ms) {
    if (reduced()) { el.textContent = fmtFn(to); return; }
    const t0 = performance.now(); const dur = ms || 1400;
    (function step(now) { const p = Math.min(1, (now - t0) / dur); const e = 1 - Math.pow(1 - p, 3); el.textContent = fmtFn(to * e); if (p < 1) requestAnimationFrame(step); })(t0);
  }

  /* ---------- فتح/إغلاق ---------- */
  function open() {
    if (root) return;
    prevTheme = document.documentElement.dataset.theme; document.documentElement.dataset.theme = 'dark';
    const sky = h('div', { class: 'skyline-host' });
    const hero = buildHero();
    const board = h('div', { class: 'board', id: 'bi-board' });
    const dock = buildDock();
    root = h('div', { id: 'bi' }, h('div', { class: 'sky' }), h('div', { class: 'aurora' }), h('div', { class: 'layer stars' }), h('div', { class: 'moon' }), sky, h('div', { class: 'vignette' }), h('button', { class: 'exit', id: 'bi-exit', onclick: () => close() }, UI().icon('back'), 'العودة إلى البرنامج'), hero, board, dock);
    document.body.appendChild(root);
    city = makeSkyline(sky);
    root.addEventListener('mousemove', (e) => { const x = (e.clientX / window.innerWidth - .5) * 2, y = (e.clientY / window.innerHeight - .5) * 2; city.setTilt(x, y); const card = root.querySelector('.hero-card'); if (card && !reduced()) card.style.transform = `rotateY(${x * 4}deg) rotateX(${-y * 3}deg)`; root.style.setProperty('--px', x.toFixed(3)); root.style.setProperty('--py', y.toFixed(3)); });
    unsub = S().subscribe(() => { if (root && board.classList.contains('in')) renderBoard(); });
    document.addEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape' && root && !document.querySelector('.overlay, .drawer')) close(); }
  function close(keepHash) {
    if (!root) return;
    city && city.destroy(); city = null; root.remove(); root = null;
    document.removeEventListener('keydown', onKey);
    if (unsub) unsub(); unsub = null;
    document.documentElement.dataset.theme = prevTheme || 'light';
    if (!keepHash && location.hash === '#/bi') location.hash = '#/dashboard';
  }
  function buildHero() {
    const k = En().kpis({});
    const st = S().state();
    const counters = [['المحصَّل هذه السنة', k.ytd.collected, v => fm(v, { plain: true }) + ' ج'], ['نسبة الإشغال', (k.occupancy.rate || 0) * 100, v => Math.round(v) + '%'], ['المتأخرات القائمة', k.arrears.total, v => fm(v, { plain: true }) + ' ج'], ['الوحدات', k.counts.units, v => Math.round(v)]];
    const cs = counters.map(([l, v, f]) => { const b = h('b', null, '0'); setTimeout(() => countUp(b, v, f), 500); return h('div', { class: 'counter' }, b, h('span', null, l)); });
    const enter = h('button', { class: 'enter', id: 'bi-enter', onclick: enterBoard }, UI().icon('bi'), 'ادخل إلى اللوحة');
    return h('div', { class: 'hero', id: 'bi-hero' }, h('div', { class: 'hero-card' }, h('div', { class: 'glow' }), h('h1', null, (st.meta.officeName || 'إيجاري') + ' — لوحة BI'), h('div', { class: 'tag' }, `${st.projects.length} مشروع · ${st.units.length} وحدة · ${st.clients.length} عميل · حتى ${U().fmtDate(k.asOf)}`), h('div', { class: 'counters' }, cs), enter, h('div', { class: 'hint' }, 'حرّك الماوس لترى المدينة تتحرك — كل رقم في اللوحة يفتح الصفوف التي خلفه')));
  }
  function enterBoard() {
    const hero = root.querySelector('#bi-hero'), board = root.querySelector('#bi-board');
    hero.classList.add('out'); root.classList.add('boarded'); renderBoard(); board.classList.add('in');
    setTimeout(() => { if (hero.isConnected) hero.style.display = 'none'; }, 700);
  }
  const SECTIONS = [['overview', 'نظرة عامة', 'home'], ['collection', 'التحصيل', 'receipt'], ['arrears', 'المتأخرات', 'warning'], ['occupancy', 'الإشغال', 'door'], ['contracts', 'العقود', 'file'], ['projects', 'المشاريع', 'building'], ['clients', 'العملاء', 'users'], ['maintenance', 'الصيانة', 'wrench']];
  function buildDock() {
    return h('nav', { class: 'dock', id: 'bi-dock' }, SECTIONS.map(([k, l, ic]) => h('button', { class: section === k ? 'on' : '', dataset: { section: k }, onclick: () => { section = k; const board = root.querySelector('#bi-board'); if (!board.classList.contains('in')) enterBoard(); else renderBoard(); board.scrollTop = 0; } }, UI().icon(ic), l)));
  }

  /* ---------- اللوحة ---------- */
  function ctx() { return E.App.ctx(); }
  function renderBoard() {
    const board = root.querySelector('#bi-board'); UI().clear(board);
    root.querySelectorAll('.dock button').forEach(b => b.classList.toggle('on', b.dataset.section === section));
    const c = ctx(), f = E.App.filter, st = S().state();
    const k = En().kpis(f);
    const curP = k.currentPeriod, fromP = st.settings.trackingFrom && U().cmp(st.settings.trackingFrom, curP) <= 0 ? st.settings.trackingFrom : curP.slice(0, 4) + '-01';
    const pnav = h('span', { class: 'pnav', id: 'bi-period-nav' },
      h('button', { title: 'الشهر السابق', id: 'bi-period-prev', disabled: U().cmp(k.period, fromP) <= 0 ? true : null, onclick: () => { E.App.filter.period = U().addMonths(k.period, -1); renderBoard(); } }, UI().icon('chevR')),
      h('button', { class: 'on', id: 'bi-period-label', title: k.selectedPeriod ? 'العودة إلى الشهر الحالي' : 'شهر التقرير', onclick: () => { if (k.selectedPeriod) { E.App.filter.period = ''; renderBoard(); } } }, U().periodLabel(k.period, true)),
      h('button', { title: 'الشهر التالي', id: 'bi-period-next', disabled: U().cmp(k.period, curP) >= 0 ? true : null, onclick: () => { const n = U().addMonths(k.period, 1); E.App.filter.period = U().cmp(n, curP) > 0 ? k.period : n; renderBoard(); } }, UI().icon('chevL')));
    const chips = h('div', { class: 'chips' }, pnav, st.projects.map(p => h('button', { class: f.projectCode === p.code ? 'on' : '', onclick: () => { E.App.filter.projectCode = f.projectCode === p.code ? '' : p.code; renderBoard(); } }, p.name)), M().UNIT_TYPES.map(t => h('button', { class: f.unitType === t.key ? 'on' : '', onclick: () => { E.App.filter.unitType = f.unitType === t.key ? '' : t.key; renderBoard(); } }, t.ar)), (f.projectCode || f.unitType || f.period) ? h('button', { onclick: () => { E.App.filter.projectCode = ''; E.App.filter.unitType = ''; E.App.filter.period = ''; renderBoard(); } }, '✕ مسح') : null);
    const title = SECTIONS.find(s => s[0] === section)[1];
    board.appendChild(h('div', { class: 'board-head' }, h('div', null, h('h2', null, title), h('div', { class: 'sub' }, `حتى ${U().fmtDate(k.asOf)} · ${k.counts.units} وحدة · ${k.counts.contracts} عقد${f.projectCode || f.unitType ? ' · (مُرشَّح)' : ''}${k.selectedPeriod ? ' · شهر التقرير: ' + U().periodLabel(k.period, true) : ''}`)), chips));
    const body = h('div', { class: 'fade-up' });
    ({ overview, collection, arrears, occupancy, contracts, projects, clients, maintenance })[section](body, k, c);
    board.appendChild(body);
  }
  const tile = (cls, label, value, detail, onClick) => h('button', { class: 'tile ' + cls, onclick: onClick, dataset: { kpi: label } }, h('span', { class: 'ring' }), h('div', { class: 'l' }, label), h('div', { class: 'v' }, value), h('div', { class: 'd' }, detail || ''));
  const panel = (title, body, small) => h('div', { class: 'panel' }, h('h3', null, title, small ? h('small', null, small) : null), body);

  function overview(body, k, c) {
    const mo = k.month;
    body.appendChild(h('div', { class: 'tiles' },
      tile(mo.rate >= .9 ? 'ok' : mo.rate >= .6 ? 'warn' : 'danger', `تحصيل ${U().periodLabel(k.period)}`, fm(mo.collected), `${fp(mo.rate)} من ${fm(mo.due)}`, () => V().monthEvidence(c, k.period)),
      k.pending.periods.length ? tile('warn', 'بانتظار التسجيل', fn(k.pending.contracts), `${k.pending.periods.map(p => U().periodLabel(p)).join('، ')} — ${fm(k.pending.due)}`, () => V().pendingEvidence(c, k.pending)) : null,
      tile('accent', 'محصَّل السنة', fm(k.ytd.collected), `${k.counts.payments} دفعة`, () => V().paymentsEvidence(c, k.ytd.rows, 'مدفوعات السنة')),
      tile(k.arrears.total ? 'danger' : 'ok', 'المتأخرات', fm(k.arrears.total), `${k.arrears.byClient.length} عميل · ${k.arrears.rows.length} شهر`, () => V().arrearsEvidence(c, k.arrears)),
      tile(k.occupancy.rate >= .9 ? 'ok' : 'warn', 'الإشغال', fp(k.occupancy.rate), `${k.occupancy.occupiedCount} من ${k.occupancy.total}`, () => V().unitsEvidence(c, [...k.occupancy.occupied, ...k.occupancy.ending], 'المؤجَّرة')),
      tile(k.occupancy.longVacant.length ? 'danger' : 'ok', `شاغرة > ${S().state().settings.vacancyMonths} شهور`, fn(k.occupancy.longVacant.length), `${k.occupancy.vacant.length} شاغرة إجمالًا`, () => V().unitsEvidence(c, k.occupancy.longVacant, `شاغرة أكثر من ${S().state().settings.vacancyMonths} شهور`)),
      tile(k.renewals.soon.length ? 'warn' : 'ok', 'تنتهي خلال 90 يومًا', fn(k.renewals.soon.length), `إيجار ${fm(U().sum(k.renewals.soon, r => r.rent))}`, () => V().renewalsEvidence(c, k.renewals.soon, 'تنتهي خلال 90 يومًا')),
      tile('info', 'تأمينات محتفظ بها', fm(k.deposits.total), `${k.deposits.endedStillHeld.length} لعقود منتهية`, () => V().depositsEvidence(c, k.deposits)),
      tile('accent', 'إيراد 12 شهرًا', fm(k.next12.total), `إيجار شهري ${fm(k.monthlyRentRoll)}`, () => V().forecastEvidence(c, k)),
    ));
    const labels = k.trend.map(m => U().periodLabel(m.period).slice(0, 6));
    body.appendChild(h('div', { class: 'grid2' },
      panel('التحصيل مقابل المستحق — 12 شهرًا', UI().columns({ labels, series: [{ name: 'المحصَّل', values: k.trend.map(m => m.collected), color: '#5B8DEF' }], line: { name: 'المستحق', values: k.trend.map(m => m.due), color: '#E0A33A' }, highlight: k.trend.findIndex(m => m.period === k.period), onClick: (i) => V().monthEvidence(c, k.trend[i].period) }), 'اضغط على الشهر'),
      panel('أهم الملاحظات', h('div', { style: { display: 'grid', gap: '8px' } }, En().insights(k).slice(0, 6).map(i => V().insightEl(c, i, k)))),
      panel('محصَّل السنة حسب المشروع', UI().donut({ data: k.byProject.map((o, i) => ({ label: o.name, value: o.amount, color: UI().PALETTE[i % 10], code: o.key })), fmt: fm, center: UI().short(k.ytd.collected), onClick: d => c.open('project', d.code) })),
      panel('أعلى المتأخرين', k.arrears.byClient.length ? UI().bars({ data: k.arrears.byClient.slice(0, 7).map(x => ({ label: x.clientName, value: x.amount, color: '#EF6B67', code: x.clientCode })), fmt: fm, onClick: d => c.open('client', d.code) }) : h('p', { class: 'muted' }, 'لا متأخرات')),
    ));
  }
  function collection(body, k, c) {
    const labels = k.trend.map(m => U().periodLabel(m.period).slice(0, 6));
    body.appendChild(h('div', { class: 'tiles' },
      tile('ok', `محصَّل ${U().periodLabel(k.period)}`, fm(k.month.collected), `${k.month.paidCount} عقد سدَّد كاملًا`, () => V().monthEvidence(c, k.period)),
      tile('info', `مستحق ${U().periodLabel(k.period)}`, fm(k.month.due), `${k.month.dueCount} عقد`, () => V().monthEvidence(c, k.period)),
      tile('warn', 'لم يُسدَّد هذا الشهر', fn(k.month.lateCount), 'عقد', () => V().monthEvidence(c, k.period)),
      tile('accent', 'محصَّل السنة', fm(k.ytd.collected), `${fp(k.ytd.rate)} من مستحق ${fm(k.ytd.due)}`, () => V().paymentsEvidence(c, k.ytd.rows, 'مدفوعات السنة')),
      tile('info', 'دفعات بلا تاريخ', fn(k.unknownDates), 'مستوردة من الإكسيل', () => c.go('payments')),
    ));
    body.appendChild(h('div', { class: 'grid2' },
      panel('التحصيل الشهري', UI().columns({ labels, series: [{ name: 'المحصَّل', values: k.trend.map(m => m.collected), color: '#5B8DEF' }], line: { name: 'المستحق', values: k.trend.map(m => m.due), color: '#E0A33A' }, highlight: k.trend.findIndex(m => m.period === k.period), onClick: (i) => V().monthEvidence(c, k.trend[i].period) })),
      panel('معدل التحصيل %', UI().columns({ labels, series: [{ name: 'النسبة %', values: k.trend.map(m => m.rate == null ? 0 : Math.round(m.rate * 100)), color: '#39B8AB' }], fmt: v => v + '%', unit: '%', highlight: k.trend.findIndex(m => m.period === k.period), onClick: (i) => V().monthEvidence(c, k.trend[i].period) })),
      panel('حسب نوع الوحدة', UI().donut({ data: k.byType.map((o, i) => ({ label: o.name, value: o.amount, color: UI().PALETTE[(i + 4) % 10] })), fmt: fm, center: UI().short(k.ytd.collected) })),
      panel('حسب المشروع', UI().bars({ data: k.byProject.map((o, i) => ({ label: o.name, value: o.amount, color: UI().PALETTE[i % 10], code: o.key })), fmt: fm, onClick: d => c.open('project', d.code) })),
    ));
  }
  function arrears(body, k, c) {
    const a = k.arrears;
    body.appendChild(h('div', { class: 'tiles' },
      tile('danger', 'إجمالي المتأخرات', fm(a.total), `${a.rows.length} شهر`, () => V().arrearsEvidence(c, a)),
      tile('danger', 'أكثر من 90 يومًا', fm(a.buckets.b90p), fp(a.total ? a.buckets.b90p / a.total : 0), () => V().arrearsEvidence(c, a, 'b90p')),
      tile('warn', '31–90 يومًا', fm(a.buckets.b60 + a.buckets.b90), '', () => V().arrearsEvidence(c, a, 'b31_90')),
      tile('info', 'حتى 30 يومًا', fm(a.buckets.b30), '', () => V().arrearsEvidence(c, a, 'b30')),
      tile('danger', 'عملاء متأخرون', fn(a.byClient.length), a.byClient[0] ? `أكبرهم ${a.byClient[0].clientName}` : '', () => V().arrearsEvidence(c, a, null, 'clients')),
    ));
    body.appendChild(h('div', { class: 'grid2' },
      panel('أعمار المتأخرات', UI().bars({ data: [['b30', 'حتى 30'], ['b60', '31–60'], ['b90', '61–90'], ['b90p', '> 90']].map(([key, l], i) => ({ label: l + ' يومًا', value: a.buckets[key], color: ['#6D9BE0', '#E0A33A', '#EF6B67', '#B13C39'][i] })), fmt: fm, padL: 140 })),
      panel('حسب المشروع', a.byProject.length ? UI().bars({ data: a.byProject.map((o, i) => ({ label: o.projectName, value: o.amount, color: UI().PALETTE[i % 10], code: o.projectCode })), fmt: fm, onClick: d => c.open('project', d.code) }) : h('p', null, 'لا متأخرات')),
    ));
    body.appendChild(panel('أعلى 15 مدينًا', UI().table({ cols: [{ key: 'clientName', label: 'العميل', render: r => h('a', { onclick: () => c.open('client', r.clientCode) }, r.clientName) }, { key: 'months', label: 'شهور', num: true }, { key: 'maxDays', label: 'أقصى تأخير', num: true }, { key: 'amount', label: 'المتأخرات', num: true, render: r => fm(r.amount) }], rows: a.byClient.slice(0, 15), onRow: r => c.open('client', r.clientCode) })));
  }
  function occupancy(body, k, c) {
    const o = k.occupancy, st = S().state();
    body.appendChild(h('div', { class: 'tiles' },
      tile('ok', 'الإشغال', fp(o.rate), `${o.occupiedCount} / ${o.total}`, () => V().unitsEvidence(c, [...o.occupied, ...o.ending], 'المؤجَّرة')),
      tile('warn', 'شاغرة', fn(o.vacant.length), 'وحدة', () => V().unitsEvidence(c, o.vacant, 'الشاغرة')),
      tile('danger', `شاغرة > ${st.settings.vacancyMonths} شهور`, fn(o.longVacant.length), o.longVacant[0] ? `أطولها ${o.longVacant[0].unit.label}: ${o.longVacant[0].vacantDays} يوم` : '', () => V().unitsEvidence(c, o.longVacant, 'شاغرة طويلًا')),
      tile('warn', 'تنتهي خلال 90 يومًا', fn(o.ending.length), 'وحدة', () => V().unitsEvidence(c, o.ending, 'تنتهي قريبًا')),
      tile('info', 'فجوات إعادة التأجير', fn(k.gaps.length), k.gaps[0] ? `أطولها ${k.gaps[0].days} يوم` : '', () => c.go('insights')),
    ));
    const grids = st.projects.filter(p => !E.App.filter.projectCode || p.code === E.App.filter.projectCode).map(p => {
      const us = S().unitsOf(p.code).filter(u => k.scope.unitSet.has(u.code));
      return panel(`${p.name} — خريطة الوحدات`, h('div', { class: 'building-grid' }, us.map(u => { const s = En().unitStatus(u); return UI().tipped(h('div', { class: 'u ' + s.status, onclick: () => c.open('unit', u.code) }, u.label), () => `${u.label} — ${En().USTATUS_AR[s.status]}${s.contract ? ' — ' + (S().client(s.contract.clientCode) || {}).name : (s.vacantDays != null ? ' — ' + s.vacantDays + ' يوم' : '')}`); })), `${us.length} وحدة`);
    });
    body.appendChild(h('div', { class: 'grid2' }, grids, panel('الوحدات حسب النوع', UI().donut({ data: M().UNIT_TYPES.map((t, i) => ({ label: t.ar, value: k.scope.units.filter(u => u.type === t.key).length, color: UI().PALETTE[(i + 4) % 10] })).filter(d => d.value), center: String(k.scope.units.length), centerSub: 'وحدة' }))));
  }
  function contracts(body, k, c) {
    const r = k.renewals;
    body.appendChild(h('div', { class: 'tiles' },
      tile('ok', 'عقود سارية', fn(k.activeContracts.length), `إيجار شهري ${fm(k.monthlyRentRoll)}`, () => V().contractsEvidence(c, k.activeContracts, 'العقود السارية')),
      tile('warn', 'تنتهي خلال 30 يومًا', fn(r.soon30.length), '', () => V().renewalsEvidence(c, r.soon30, 'تنتهي خلال 30 يومًا')),
      tile('warn', 'خلال 60 يومًا', fn(r.soon60.length), '', () => V().renewalsEvidence(c, r.soon60, 'تنتهي خلال 31–60 يومًا')),
      tile('info', 'خلال 90 يومًا', fn(r.soon90.length), '', () => V().renewalsEvidence(c, r.soon90, 'تنتهي خلال 61–90 يومًا')),
      tile('danger', 'منتهية بلا تجديد', fn(r.ended.length), '', () => V().renewalsEvidence(c, r.ended, 'منتهية بلا تجديد', true)),
      tile('info', 'بلا زيادة سنوية', fn(k.noIncrease.length), 'عقد ساري', () => V().contractsEvidence(c, k.noIncrease, 'بلا زيادة سنوية')),
      tile('accent', 'إيراد 12 شهرًا', fm(k.next12.total), '', () => V().forecastEvidence(c, k)),
    ));
    body.appendChild(h('div', { class: 'grid2' },
      panel('الإيراد المتعاقد عليه — 12 شهرًا', UI().columns({ labels: k.next12.months.map(m => U().periodLabel(m.period).slice(0, 6)), series: [{ name: 'المستحق', values: k.next12.months.map(m => m.amount), color: '#39B8AB' }], onClick: () => V().forecastEvidence(c, k) })),
      panel('متوسط الإيجار حسب النوع', UI().bars({ data: k.avgRentByType.map((t, i) => ({ label: `${t.name} (${t.count})`, value: Math.round(t.avg), color: UI().PALETTE[(i + 4) % 10] })), fmt: fm })),
    ));
    body.appendChild(panel('العقود التي تنتهي قريبًا', UI().table({ cols: [{ key: 'contractCode', label: 'العقد', render: r => h('span', { class: 'code' }, r.contractCode) }, { key: 'clientName', label: 'العميل' }, { key: 'unitLabel', label: 'الوحدة' }, { key: 'projectName', label: 'المشروع' }, { key: 'daysLeft', label: 'متبقٍ (يوم)', num: true }, { key: 'rent', label: 'الإيجار', num: true, render: x => fm(x.rent) }], rows: r.soon, onRow: x => c.open('contract', x.contractCode), sort: 'daysLeft' })));
  }
  function projects(body, k, c) {
    const st = S().state();
    const rows = st.projects.map((p, i) => { const kp = En().kpis(Object.assign({}, E.App.filter, { projectCode: p.code })); return { p, kp, i }; });
    body.appendChild(h('div', { class: 'tiles' }, rows.map(({ p, kp, i }) => tile(['accent', 'info', 'ok', 'warn'][i % 4], p.name, fm(kp.ytd.collected), `إشغال ${fp(kp.occupancy.rate)} · متأخرات ${fm(kp.arrears.total)}`, () => c.open('project', p.code)))));
    body.appendChild(h('div', { class: 'grid2' },
      panel('مقارنة المشاريع — محصَّل السنة', UI().bars({ data: rows.map(({ p, kp, i }) => ({ label: p.name, value: kp.ytd.collected, color: UI().PALETTE[i % 10], code: p.code })), fmt: fm, onClick: d => c.open('project', d.code) })),
      panel('مقارنة المشاريع — المتأخرات', UI().bars({ data: rows.map(({ p, kp, i }) => ({ label: p.name, value: kp.arrears.total, color: '#EF6B67', code: p.code })), fmt: fm, onClick: d => c.open('project', d.code) })),
      panel('الإشغال', h('div', { class: 'proj' }, rows.map(({ p, kp }) => h('div', { class: 'row', onclick: () => c.open('project', p.code) }, h('div', null, h('b', null, p.name), h('div', { class: 'muted small' }, `${kp.occupancy.occupiedCount} مؤجَّر · ${kp.occupancy.vacant.length} شاغر · ${kp.occupancy.ending.length} تنتهي قريبًا`), h('div', { class: 'bar' }, h('i', { style: { width: fp(kp.occupancy.rate || 0) } }))), h('b', null, fp(kp.occupancy.rate)))))),
      panel('الإيجار الشهري الحالي', UI().bars({ data: rows.map(({ p, kp, i }) => ({ label: p.name, value: kp.monthlyRentRoll, color: UI().PALETTE[(i + 2) % 10], code: p.code })), fmt: fm, onClick: d => c.open('project', d.code) })),
    ));
  }
  function clients(body, k, c) {
    const punct = k.punctuality;
    const withArrears = punct.filter(x => x.arrears > 0);
    body.appendChild(h('div', { class: 'tiles' },
      tile('info', 'العملاء', fn(k.counts.clients), '', () => c.go('clients')),
      tile('danger', 'عليهم متأخرات', fn(withArrears.length), fm(U().sum(withArrears, x => x.arrears)), () => V().arrearsEvidence(c, k.arrears, null, 'clients')),
      tile('ok', 'ملتزمون بالكامل', fn(punct.filter(x => x.arrears === 0 && x.contracts).length), 'بلا أي شهر متأخر', () => c.go('clients')),
      tile('warn', 'أقصى تأخير', fn(Math.max(0, ...punct.map(x => x.maxDays))), 'يوم', () => V().arrearsEvidence(c, k.arrears)),
    ));
    body.appendChild(h('div', { class: 'grid2' },
      panel('أعلى 10 مدينين', UI().bars({ data: withArrears.slice(0, 10).map(x => ({ label: x.clientName, value: x.arrears, color: '#EF6B67', code: x.clientCode })), fmt: fm, onClick: d => c.open('client', d.code) })),
      panel('الأكثر سدادًا هذه السنة', UI().bars({ data: (() => { const m = new Map(); for (const p of k.ytd.rows) { const ct = S().contract(p.contractCode); if (!ct) continue; m.set(ct.clientCode, (m.get(ct.clientCode) || 0) + (U().toNum(p.amount) || 0)); } return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([code, v]) => ({ label: (S().client(code) || {}).name || code, value: v, color: '#3FBF7F', code })); })(), fmt: fm, onClick: d => c.open('client', d.code) })),
    ));
    body.appendChild(panel('التزام العملاء', UI().table({ cols: [{ key: 'clientName', label: 'العميل', render: r => h('a', { onclick: () => c.open('client', r.clientCode) }, r.clientName) }, { key: 'contracts', label: 'العقود', num: true }, { key: 'score', label: 'في الموعد', num: true, render: r => r.score == null ? '—' : fp(r.score) }, { key: 'lateMonths', label: 'شهور متأخرة', num: true }, { key: 'maxDays', label: 'أقصى تأخير', num: true }, { key: 'arrears', label: 'المتأخرات', num: true, render: r => fm(r.arrears) }], rows: punct.slice(0, 30), onRow: r => c.open('client', r.clientCode) })));
  }
  function maintenance(body, k, c) {
    const m = k.maintenance;
    body.appendChild(h('div', { class: 'tiles' },
      tile('warn', 'مفتوحة', fn(m.open.length), '', () => V().maintenanceEvidence(c, m.open, 'الصيانة المفتوحة')),
      tile('info', 'تكلفة السنة', fm(m.costYtd), `${m.ytd.length} سجل`, () => V().maintenanceEvidence(c, m.ytd, 'صيانة السنة')),
      tile('ok', 'يتحملها المالك', fm(m.byBorne.owner), '', () => V().maintenanceEvidence(c, m.ytd.filter(x => x.borneBy === 'owner'), 'على المالك')),
      tile('accent', 'يتحملها المستأجر', fm(m.byBorne.tenant), '', () => V().maintenanceEvidence(c, m.ytd.filter(x => x.borneBy === 'tenant'), 'على المستأجر')),
    ));
    body.appendChild(h('div', { class: 'grid2' },
      panel('الأعلى تكلفة حسب الوحدة', m.byUnit.length ? UI().bars({ data: m.byUnit.slice(0, 10).map(x => ({ label: `${x.unitLabel} (${x.projectName})`, value: x.cost, color: '#E0A33A', code: x.unitCode })), fmt: fm, onClick: d => c.open('unit', d.code) }) : h('p', null, 'لا سجلات')),
      panel('حسب النوع', UI().donut({ data: M().MAINT_KINDS.map((t, i) => ({ label: t.ar, value: U().sum(m.items.filter(x => x.kind === t.key), x => U().toNum(x.cost)), color: UI().PALETTE[i % 10] })).filter(d => d.value), fmt: fm, center: UI().short(U().sum(m.items, x => U().toNum(x.cost))) })),
    ));
    body.appendChild(panel('آخر السجلات', UI().table({ cols: [{ key: 'date', label: 'التاريخ', render: r => U().fmtDate(r.date) }, { key: 'unitLabel', label: 'الوحدة' }, { key: 'description', label: 'الوصف' }, { key: 'cost', label: 'التكلفة', num: true, render: r => fm(r.cost) }, { key: 'custodianName', label: 'في عهدة' }, { key: 'status', label: 'الحالة', render: r => UI().badge(r.status, M().label(M().MAINT_STATUS, r.status)) }], rows: m.items.slice(0, 20), onRow: r => c.open('unit', r.unitCode), sort: 'date', sortDir: -1 })));
  }

  E.BI = { open, close, enterBoard, get isOpen() { return !!root; } };
})(window.Egary);
