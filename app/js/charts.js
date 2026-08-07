/* =========================================================
   charts.js — رسوم SVG يدوية وفق منهجية dataviz:
   خامة رفيعة، محور واحد، شبكة شعرية، تلميح لكل علامة،
   تدرّج لون واحد للمقدار (أزرق) — الحالة لها ألوانها المحجوزة.
   الزمن في كل الرسوم يجري يمين ← يسار (كالمصفوفة والقراءة العربية).
   الرسم يُبنى بعرض الحاوية الفعلي فتبقى النصوص بحجمها الحقيقي.
   ========================================================= */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  /* ألوان الرسوم تُقرأ من متغيرات الثيم لحظة الرسم — فتتقلب مع الدارك مود.
     القيم الاحتياطية = الوضع الفاتح من اللوحة المرجعية المتحقَّق منها. */
  const C = {};
  const FALLBACK = {
    series: '#2a78d6', track: '#cde2fb',
    ink: '#0b0b0b', inkSec: '#52514e', muted: '#75736e',
    grid: '#e1e0d9', baseline: '#c3c2b7', surface: '#fcfcfb',
    good: '#0ca30c', serious: '#ec835a', critical: '#d03b3b',
  };
  function refreshC() {
    const cs = getComputedStyle(document.documentElement);
    const v = (name, fb) => (cs.getPropertyValue(name) || '').trim() || fb;
    C.series = v('--viz-series', FALLBACK.series);
    C.track = v('--viz-track', FALLBACK.track);
    C.ink = v('--ink', FALLBACK.ink);
    C.inkSec = v('--ink-sec', FALLBACK.inkSec);
    C.muted = v('--muted', FALLBACK.muted);
    C.grid = v('--grid', FALLBACK.grid);
    C.baseline = v('--baseline', FALLBACK.baseline);
    C.surface = v('--surface', FALLBACK.surface);
    C.good = v('--good', FALLBACK.good);
    C.serious = v('--serious', FALLBACK.serious);
    C.critical = v('--critical', FALLBACK.critical);
  }
  Object.assign(C, FALLBACK);

  /* عرض الرسم داخل بطاقة اللوحة — تقدير من عرض النافذة (يُعاد الرسم عند تغيير الحجم) */
  function chartWidth(half) {
    const vw = window.innerWidth || 1200;
    const sidebar = vw > 920 ? 232 : 0;
    const content = vw - sidebar - (vw > 920 ? 52 : 28);
    const card = (half && vw > 920) ? (content - 14) / 2 : content;
    return Math.max(320, Math.min(780, card - 36));
  }

  function s(tag, attrs, children) {
    const el = document.createElementNS(NS, tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v != null) el.setAttribute(k, v);
    }
    if (children) (Array.isArray(children) ? children : [children]).forEach(c => c && el.appendChild(c));
    return el;
  }
  function txt(x, y, str, attrs) {
    const t = s('text', Object.assign({
      x, y, fill: C.muted, 'font-size': 11,
      'font-family': 'inherit', 'text-anchor': 'middle',
    }, attrs || {}));
    t.textContent = str;
    return t;
  }

  /* أرقام محاور نظيفة — بلا مضاعف 2.5 حتى تظل أرباع المحور أعدادًا صحيحة */
  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 2, 5, 10]) if (v <= m * p) return m * p;
    return 10 * p;
  }
  function kLabel(v) {
    if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + ' م';
    if (v >= 1e3) return Math.round(v / 1e3) + ' ألف';
    return String(Math.round(v));
  }

  /* مسار عمود بنهاية علوية مستديرة 4px وقاعدة مربّعة */
  function roundTopRect(x, y, w, hgt, r) {
    if (hgt <= 0) return null;
    r = Math.min(r, w / 2, hgt);
    return s('path', {
      d: `M${x},${y + hgt} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + hgt} Z`,
    });
  }

  /* =====================================================
     1) التحصيل الشهري: مستحق (مسار فاتح) × محصَّل (تعبئة)
     عدّاد لكل شهر بنفس التدرّج — الأحدث في أقصى اليسار
     ===================================================== */
  function collectionChart(series, opts) {
    refreshC();
    opts = opts || {};
    const W = opts.width || chartWidth(true);
    if (W < 520 && series.length > 6) series = series.slice(-6);
    const H = 250, padT = 18, padB = 34, padL = 14, padR = 56;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const max = niceMax(Math.max(1, ...series.map(m => m.due)));
    const yFor = v => padT + plotH - (v / max) * plotH;
    const n = series.length;
    const band = plotW / n;
    const barW = Math.min(24, band * 0.55);
    // RTL زمني: الفهرس i (الأقدم أولًا) يُرسم من اليمين
    const xBand = i => padL + band * (n - 1 - i);

    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img',
      'aria-label': 'التحصيل الشهري: المحصَّل من المستحق لكل شهر' });
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const v = (max / ticks) * i, y = yFor(v);
      svg.appendChild(s('line', { x1: padL, x2: W - padR, y1: y, y2: y, stroke: i === 0 ? C.baseline : C.grid, 'stroke-width': 1 }));
      if (i > 0) svg.appendChild(txt(W - padR + 8, y + 4, kLabel(v), { 'text-anchor': 'start' }));
    }
    series.forEach((m, i) => {
      const bx = xBand(i);
      const x = bx + (band - barW) / 2;
      const g = s('g', { class: 'hit', tabindex: 0 });
      g.appendChild(s('rect', { x: bx, y: padT, width: band, height: plotH + padB - 6, fill: 'transparent' }));
      const track = roundTopRect(x, yFor(m.due), barW, plotH - (yFor(m.due) - padT), 4);
      if (track) { track.setAttribute('fill', C.track); g.appendChild(track); }
      const fill = roundTopRect(x, yFor(m.collected), barW, plotH - (yFor(m.collected) - padT), 4);
      if (fill) { fill.setAttribute('fill', C.series); g.appendChild(fill); }
      if (m.due === 0 && m.collected === 0)
        g.appendChild(s('line', { x1: x, x2: x + barW, y1: yFor(0), y2: yFor(0), stroke: C.baseline, 'stroke-width': 2 }));
      g.appendChild(txt(bx + band / 2, H - padB + 16, Store.periodLabel(m.period), { fill: C.inkSec }));
      if (m.unknownCount) g.appendChild(txt(bx + band / 2, H - padB + 29, '؟', { fill: C.muted, 'font-size': 10 }));
      // تسمية مباشرة انتقائية: الشهر الأحدث فقط
      if (i === n - 1 && m.due > 0)
        g.appendChild(txt(x + barW / 2, yFor(m.due) - 6, UI.pct(m.rate), { fill: C.ink, 'font-weight': 600 }));
      UI.bindTip(g, () => {
        let html = `<b>${Store.periodLabel(m.period, true)}</b><br>` +
          `المستحق: ${UI.money(m.due)}${m.estimatedPart ? ' <i>(جزء تقديري)</i>' : ''}<br>` +
          `المحصَّل: ${UI.money(m.collected)}<br>` +
          `النسبة: ${m.rate == null ? '—' : UI.pct(m.rate)}`;
        if (m.unknownDue) html += `<br>غير موثَّق: ${UI.money(m.unknownDue)} (${m.unknownCount} شهر×وحدة)`;
        return html;
      });
      svg.appendChild(g);
    });
    return svg;
  }

  /* =====================================================
     2) أعمار المتأخرات: أشرطة أفقية — سلسلة واحدة، قيمة عند الطرف
     ===================================================== */
  function agingChart(buckets, opts) {
    refreshC();
    opts = opts || {};
    const rows = [
      { label: '1–30 يوم', v: buckets.b30 },
      { label: '31–60 يوم', v: buckets.b60 },
      { label: '61–90 يوم', v: buckets.b90 },
      { label: 'أكثر من 90', v: buckets.b90p },
    ];
    const W = opts.width || chartWidth(true);
    const rowH = 40, padT = 8, padR = 100, padL = 90, H = padT + rows.length * rowH + 14;
    const plotW = W - padL - padR;
    const max = niceMax(Math.max(1, ...rows.map(r => r.v)));
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img',
      'aria-label': 'أعمار المتأخرات المؤكدة بالشرائح الزمنية' });
    const x0 = W - padR;
    svg.appendChild(s('line', { x1: x0, x2: x0, y1: padT, y2: H - 14, stroke: C.baseline, 'stroke-width': 1 }));
    rows.forEach((r, i) => {
      const y = padT + i * rowH + (rowH - 18) / 2;
      const w = r.v > 0 ? Math.max((r.v / max) * plotW, 4) : 0;
      const g = s('g', { class: 'hit', tabindex: 0 });
      g.appendChild(s('rect', { x: 0, y: padT + i * rowH, width: W, height: rowH, fill: 'transparent' }));
      g.appendChild(txt(x0 + 8, y + 13, r.label, { 'text-anchor': 'start', fill: C.inkSec }));
      if (r.v > 0) {
        g.appendChild(s('path', {
          d: `M${x0},${y} L${x0 - w + 4},${y} Q${x0 - w},${y} ${x0 - w},${y + 4} L${x0 - w},${y + 14} Q${x0 - w},${y + 18} ${x0 - w + 4},${y + 18} L${x0},${y + 18} Z`,
          fill: C.series,
        }));
        g.appendChild(txt(x0 - w - 6, y + 13, UI.money(r.v, { bare: true }), { 'text-anchor': 'end', fill: C.ink }));
      } else {
        g.appendChild(txt(x0 - 8, y + 13, '0', { 'text-anchor': 'end' }));
      }
      UI.bindTip(g, () => `<b>${r.label}</b><br>${UI.money(r.v)}`);
      svg.appendChild(g);
    });
    return svg;
  }

  /* =====================================================
     3) الإيراد التعاقدي القادم: أعمدة — الأقرب زمنًا في أقصى اليمين
     ===================================================== */
  function revenueChart(series, opts) {
    refreshC();
    opts = opts || {};
    const W = opts.width || chartWidth(true);
    if (W < 520 && series.length > 6) series = series.slice(0, 6);
    const H = 230, padT = 18, padB = 34, padL = 14, padR = 56;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const max = niceMax(Math.max(1, ...series.map(m => m.amount)));
    const yFor = v => padT + plotH - (v / max) * plotH;
    const n = series.length, band = plotW / n, barW = Math.min(24, band * 0.55);
    const xBand = i => padL + band * (n - 1 - i);
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img',
      'aria-label': opts.ariaLabel || 'الإيراد المتعاقد عليه للأشهر القادمة' });
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const v = (max / ticks) * i, y = yFor(v);
      svg.appendChild(s('line', { x1: padL, x2: W - padR, y1: y, y2: y, stroke: i === 0 ? C.baseline : C.grid, 'stroke-width': 1 }));
      if (i > 0 && !opts.count) svg.appendChild(txt(W - padR + 8, y + 4, kLabel(v), { 'text-anchor': 'start' }));
    }
    series.forEach((m, i) => {
      const bx = xBand(i);
      const x = bx + (band - barW) / 2;
      const g = s('g', { class: 'hit', tabindex: 0 });
      g.appendChild(s('rect', { x: bx, y: padT, width: band, height: plotH + padB - 6, fill: 'transparent' }));
      const bar = roundTopRect(x, yFor(m.amount), barW, plotH - (yFor(m.amount) - padT), 4);
      if (bar) { bar.setAttribute('fill', C.series); g.appendChild(bar); }
      g.appendChild(txt(bx + band / 2, H - padB + 16, Store.periodLabel(m.period), { fill: C.inkSec }));
      if (opts.count && m.amount > 0)
        g.appendChild(txt(x + barW / 2, yFor(m.amount) - 6, String(m.amount), { fill: C.ink, 'font-weight': 600 }));
      UI.bindTip(g, () => `<b>${Store.periodLabel(m.period, true)}</b><br>${opts.count ? m.amount + ' ' + (opts.countLabel || '') : UI.money(m.amount)}`);
      svg.appendChild(g);
    });
    return svg;
  }

  /* =====================================================
     3ب) توزيع مقدار على فئات: أشرطة أفقية — سلسلة واحدة
     ===================================================== */
  function typeBars(items, opts) {
    refreshC();
    opts = opts || {};
    const W = opts.width || chartWidth(true);
    const rowH = 38, padT = 6, padR = 110, padL = 90;
    const H = padT + Math.max(items.length, 1) * rowH + 10;
    const plotW = W - padL - padR;
    const max = niceMax(Math.max(1, ...items.map(r => r.v)));
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img',
      'aria-label': 'توزيع الاستحقاق حسب نوع الوحدة' });
    const x0 = W - padR;
    svg.appendChild(s('line', { x1: x0, x2: x0, y1: padT, y2: H - 10, stroke: C.baseline, 'stroke-width': 1 }));
    items.forEach((r, i) => {
      const y = padT + i * rowH + (rowH - 18) / 2;
      const w = r.v > 0 ? Math.max((r.v / max) * plotW, 4) : 0;
      const g = s('g', { class: 'hit', tabindex: 0 });
      g.appendChild(s('rect', { x: 0, y: padT + i * rowH, width: W, height: rowH, fill: 'transparent' }));
      g.appendChild(txt(x0 + 8, y + 13, r.label, { 'text-anchor': 'start', fill: C.inkSec }));
      if (r.v > 0) {
        g.appendChild(s('path', {
          d: `M${x0},${y} L${x0 - w + 4},${y} Q${x0 - w},${y} ${x0 - w},${y + 4} L${x0 - w},${y + 14} Q${x0 - w},${y + 18} ${x0 - w + 4},${y + 18} L${x0},${y + 18} Z`,
          fill: C.series,
        }));
        g.appendChild(txt(x0 - w - 6, y + 13, UI.money(r.v, { bare: true }), { 'text-anchor': 'end', fill: C.ink }));
      } else {
        g.appendChild(txt(x0 - 8, y + 13, '0', { 'text-anchor': 'end' }));
      }
      UI.bindTip(g, () => `<b>${r.label}</b><br>${UI.money(r.v)}${r.sub ? '<br>' + r.sub : ''}`);
      svg.appendChild(g);
    });
    return svg;
  }

  /* =====================================================
     3ج) جانت العقود: الزمن يجري من اليمين لليسار (قراءة عربية)
     ألوان حالة محجوزة + مفتاح رسم — والتفاصيل في التلميح
     ===================================================== */
  function ganttChart(rows, todayIso, opts) {
    refreshC();
    opts = opts || {};
    const COLS = { active: C.series, soon: C.serious, ended: C.critical, renewed: C.baseline, future: C.track };
    const W = 920, rowH = 40, padT = 34, labelW = 200, padL = 16;
    const H = padT + rows.length * rowH + 28;
    let min = '2029-12-31', max = '2023-01-01';
    rows.forEach(r => r.bars.forEach(b => {
      if (b.start < min) min = b.start;
      if (b.end > max) max = b.end;
    }));
    if (todayIso < min) min = todayIso;
    if (todayIso > max) max = todayIso;
    const A = Store.d(min.slice(0, 4) + '-01-01');
    const B = Store.d((Number(max.slice(0, 4)) + 1) + '-01-01');
    const span = B - A;
    const x0 = W - labelW;
    const xFor = iso => x0 - ((Store.d(iso) - A) / span) * (x0 - padL);
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img',
      'aria-label': 'الخط الزمني للعقود لكل وحدة' });

    // تظليل متبادل للأسطر — يسهّل تتبّع الصف عبر السنوات
    rows.forEach((r, i) => {
      if (i % 2 === 0) svg.appendChild(s('rect', {
        x: padL - 6, y: padT + i * rowH, width: x0 - padL + 12, height: rowH,
        fill: C.baseline, opacity: 0.10, rx: 6,
      }));
    });
    // سنوات (خط كامل) + أرباع السنة (شرطات خفيفة)
    for (let y = A.getUTCFullYear(); y <= B.getUTCFullYear(); y++) {
      const x = xFor(y + '-01-01');
      svg.appendChild(s('line', { x1: x, x2: x, y1: padT - 14, y2: H - 20, stroke: C.grid, 'stroke-width': 1.2 }));
      svg.appendChild(txt(x - 5, padT - 18, String(y), { 'text-anchor': 'end', 'font-weight': 600 }));
      for (const m of ['04', '07', '10']) {
        const xq = xFor(y + '-' + m + '-01');
        if (xq > padL && xq < x0) svg.appendChild(s('line', { x1: xq, x2: xq, y1: padT - 4, y2: H - 22, stroke: C.grid, 'stroke-width': 0.5, opacity: 0.6 }));
      }
    }
    // خط اليوم + راية
    const tx = xFor(todayIso);
    svg.appendChild(s('line', { x1: tx, x2: tx, y1: padT - 14, y2: H - 20, stroke: C.critical, 'stroke-width': 1.5 }));
    svg.appendChild(s('rect', { x: tx - 34, y: padT - 30, width: 34, height: 15, rx: 7.5, fill: C.critical }));
    svg.appendChild(txt(tx - 17, padT - 19, 'اليوم', { fill: '#fff', 'font-size': 9.5, 'font-weight': 700 }));

    const today = Store.d(todayIso);
    rows.forEach((r, i) => {
      const y = padT + i * rowH;
      // اسم الوحدة + المستأجر
      svg.appendChild(txt(W - 8, y + 16, r.label, { 'text-anchor': 'end', fill: C.ink, 'font-size': 12.5, 'font-weight': 700 }));
      if (r.sub) svg.appendChild(txt(W - 8, y + 30, r.sub, { 'text-anchor': 'end', fill: C.muted, 'font-size': 10 }));

      const sorted = [...r.bars].sort((a, b) => a.start < b.start ? -1 : 1);
      sorted.forEach((b, k) => {
        const xe = xFor(b.end), xs = xFor(b.start);
        const w = Math.max(xs - xe, 5);
        const by = y + (rowH - 20) / 2;
        // وصلة التجديد بين عقدين متتاليين
        if (k > 0) {
          const prevXe = xFor(sorted[k - 1].end);
          if (prevXe - xs > 1) svg.appendChild(s('line', {
            x1: xs, x2: prevXe, y1: by + 10, y2: by + 10,
            stroke: C.baseline, 'stroke-width': 1.5, 'stroke-dasharray': '2 3',
          }));
        }
        const g = s('g', { class: 'hit gbar', tabindex: 0 });
        g.appendChild(s('rect', { x: xe, y: by, width: w, height: 20, rx: 5, fill: COLS[b.status] || C.baseline, opacity: b.status === 'renewed' ? 0.55 : 0.95 }));
        // قيمة الإيجار داخل الشريط إن اتسع
        if (b.rentLabel && w > 70) {
          const dark = b.status === 'future';
          svg.appendChild(g); // أضف الشريط أولًا ليعلوه النص
          g.appendChild(s('rect', { x: xe, y: by, width: w, height: 20, fill: 'transparent' }));
          const t = txt(xe + w / 2, by + 14, b.rentLabel, {
            fill: dark ? C.ink : '#fff', 'font-size': 10.5, 'font-weight': 700,
          });
          g.appendChild(t);
        } else svg.appendChild(g);
        // شارة الأيام المتبقية للعقود القريبة من الانتهاء
        if (b.status === 'soon') {
          const left = Math.max(0, Math.round((Store.d(b.end) - today) / 86400000));
          svg.appendChild(txt(xe - 5, by + 14, 'باقي ' + left + ' يوم', {
            'text-anchor': 'end', fill: C.serious, 'font-size': 10, 'font-weight': 700,
          }));
        }
        if (b.status === 'ended') {
          svg.appendChild(txt(xe - 5, by + 14, 'انتهى بلا تجديد', {
            'text-anchor': 'end', fill: C.critical, 'font-size': 10, 'font-weight': 700,
          }));
        }
        UI.bindTip(g, () => b.tip);
        if (opts.onBarClick) {
          g.addEventListener('click', () => opts.onBarClick(b));
          g.setAttribute('role', 'button');
        }
      });
    });
    return svg;
  }

  /* =====================================================
     3د) خط اتجاه نسبة (0..1): خط 2px + غسل 10% + نقطة نهاية
     الأحدث في أقصى اليسار — محور واحد بالنسبة المئوية
     ===================================================== */
  function lineChart(series, opts) {
    refreshC();
    opts = opts || {};
    const W = opts.width || chartWidth(true);
    if (W < 520 && series.length > 6) series = series.slice(-6);
    const H = 220, padT = 16, padB = 34, padL = 14, padR = 52;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const n = series.length, band = plotW / n;
    const xMid = i => padL + band * (n - 1 - i) + band / 2;
    const yFor = v => padT + plotH - v * plotH;
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img',
      'aria-label': opts.label || 'اتجاه النسبة الشهرية' });
    [0, 0.25, 0.5, 0.75, 1].forEach(t => {
      const y = yFor(t);
      svg.appendChild(s('line', { x1: padL, x2: W - padR, y1: y, y2: y, stroke: t === 0 ? C.baseline : C.grid, 'stroke-width': 1 }));
      if (t > 0) svg.appendChild(txt(W - padR + 8, y + 4, Math.round(t * 100) + '٪', { 'text-anchor': 'start' }));
    });
    // الغسل ثم الخط
    let dLine = '', started = false;
    const pts = [];
    series.forEach((p, i) => {
      if (p.v == null) { started = false; pts.push(null); return; }
      const x = xMid(i), y = yFor(Math.max(0, Math.min(1, p.v)));
      pts.push([x, y]);
      dLine += (started ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
      started = true;
    });
    const valid = pts.filter(Boolean);
    if (valid.length > 1) {
      const first = valid[0], last = valid[valid.length - 1];
      svg.appendChild(s('path', {
        d: dLine + `L${last[0]},${yFor(0)} L${first[0]},${yFor(0)} Z`,
        fill: C.series, opacity: 0.1,
      }));
    }
    svg.appendChild(s('path', { d: dLine, fill: 'none', stroke: C.series, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    series.forEach((p, i) => {
      const g = s('g', { class: 'hit', tabindex: 0 });
      g.appendChild(s('rect', { x: padL + band * (n - 1 - i), y: padT, width: band, height: plotH + padB - 6, fill: 'transparent' }));
      if (pts[i]) {
        const isLast = i === n - 1;
        if (isLast) {
          g.appendChild(s('circle', { cx: pts[i][0], cy: pts[i][1], r: 6, fill: C.surface }));
          g.appendChild(s('circle', { cx: pts[i][0], cy: pts[i][1], r: 4, fill: C.series }));
          g.appendChild(txt(pts[i][0], pts[i][1] - 12, UI.pct(p.v), { fill: C.ink, 'font-weight': 600 }));
        }
      }
      g.appendChild(txt(xMid(i), H - padB + 16, Store.periodLabel(p.period), { fill: C.inkSec, 'font-size': 10 }));
      UI.bindTip(g, () => `<b>${Store.periodLabel(p.period, true)}</b><br>${p.v == null ? 'لا استحقاق' : UI.pct(p.v)}${p.sub ? '<br>' + p.sub : ''}`);
      svg.appendChild(g);
    });
    return svg;
  }

  /* =====================================================
     3هـ) دونات جزء-من-كل (≤6 شرائح، ألوان حالة دلالية + مفتاح نصي)
     فجوة 2px بلون السطح بين الشرائح
     ===================================================== */
  function donut(parts, centerLabel, centerSub) {
    refreshC();
    const size = 148, cx = size / 2, cy = size / 2, R = 62, r = 42;
    const total = parts.reduce((s2, p) => s2 + p.v, 0) || 1;
    const svg = s('svg', { viewBox: `0 0 ${size} ${size}`, class: 'donut', role: 'img',
      'aria-label': centerLabel + ' — ' + parts.map(p => p.label + ' ' + p.v).join('، ') });
    let a = -Math.PI / 2;
    const gap = 0.035; // فجوة زاوية ≈ 2px
    for (const p of parts) {
      if (p.v <= 0) continue;
      const frac = p.v / total;
      const ang = frac * Math.PI * 2;
      const a1 = a + (ang > gap * 2 ? gap : 0), a2 = a + ang - (ang > gap * 2 ? gap : 0);
      const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
      const x2 = cx + R * Math.cos(a2), y2 = cy + R * Math.sin(a2);
      const xi = cx + r * Math.cos(a2), yi = cy + r * Math.sin(a2);
      const xj = cx + r * Math.cos(a1), yj = cy + r * Math.sin(a1);
      const big = (a2 - a1) > Math.PI ? 1 : 0;
      const arc = s('path', {
        d: `M${x1},${y1} A${R},${R} 0 ${big} 1 ${x2},${y2} L${xi},${yi} A${r},${r} 0 ${big} 0 ${xj},${yj} Z`,
        fill: p.color, class: 'hit', tabindex: 0,
      });
      UI.bindTip(arc, () => `<b>${p.label}</b><br>${p.v} (${Math.round(frac * 100)}٪)`);
      svg.appendChild(arc);
      a += ang;
    }
    const t1 = txt(cx, cy - 1, centerLabel, { fill: C.ink, 'font-size': 20, 'font-weight': 650 });
    const t2 = txt(cx, cy + 15, centerSub || '', { fill: C.muted, 'font-size': 10 });
    svg.appendChild(t1); svg.appendChild(t2);
    return svg;
  }

  /* =====================================================
     4) عدّاد نسبة (الإشغال): تعبئة + مسار من نفس التدرّج
     ===================================================== */
  function meter(value, max) {
    const wrap = UI.h('div.meter', { role: 'img', 'aria-label': `${value} من ${max}` });
    const fillPct = max > 0 ? (value / max) * 100 : 0;
    wrap.appendChild(UI.h('div.meter-track'));
    const fill = UI.h('div.meter-fill');
    fill.style.width = fillPct + '%';
    wrap.appendChild(fill);
    return wrap;
  }

  /* =====================================================
     5) شرارة لبطاقة مؤشر: الأحدث يسارًا — كاتجاه الزمن العام
     ===================================================== */
  function sparkline(values) {
    refreshC();
    const W = 120, H = 34, pad = 4;
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'spark', 'aria-hidden': 'true' });
    const vals = values.filter(v => v != null);
    if (!vals.length) return svg;
    const min = Math.min(...vals), max = Math.max(...vals);
    const span = max - min || 1;
    const pts = values.map((v, i) => v == null ? null : [
      W - pad - (i / Math.max(1, values.length - 1)) * (W - pad * 2),
      H - pad - ((v - min) / span) * (H - pad * 2),
    ]);
    let dPath = '', started = false;
    for (const p of pts) {
      if (!p) { started = false; continue; }
      dPath += (started ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1);
      started = true;
    }
    svg.appendChild(s('path', { d: dPath, fill: 'none', stroke: C.baseline, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    const last = [...pts].reverse().find(Boolean);
    if (last) {
      svg.appendChild(s('circle', { cx: last[0], cy: last[1], r: 6, fill: C.surface }));
      svg.appendChild(s('circle', { cx: last[0], cy: last[1], r: 4, fill: C.series }));
    }
    return svg;
  }

  window.Charts = { collectionChart, agingChart, revenueChart, typeBars, ganttChart, lineChart, donut, meter, sparkline };
})();
