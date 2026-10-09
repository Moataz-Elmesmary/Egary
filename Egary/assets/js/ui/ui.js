/* =====================================================================
   ui.js — أدوات الواجهة: بناء DOM، أيقونات، نوافذ، أدراج، تأكيد، توست، جداول، رسوم SVG
   ===================================================================== */
window.Egary = window.Egary || {};
(function (E) {
  'use strict';
  const U = () => E.U;

  /* ---------- بناء DOM ---------- */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k in el && typeof v !== 'string' && k !== 'value') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    append(el, children);
    return el;
  }
  function append(el, children) {
    for (const c of children) {
      if (c == null || c === false) continue;
      if (Array.isArray(c)) append(el, c);
      else if (c instanceof Node) el.appendChild(c);
      else el.appendChild(document.createTextNode(String(c)));
    }
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  const svgNS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, ...children) { const el = document.createElementNS(svgNS, tag); if (attrs) for (const [k, v] of Object.entries(attrs)) { if (v == null) continue; if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v); else el.setAttribute(k, v); } for (const c of children) { if (c == null) continue; el.appendChild(c instanceof Node ? c : document.createTextNode(String(c))); } return el; }

  /* ---------- أيقونات (خطوط بسيطة) ---------- */
  const ICONS = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-4h4v4"/>',
    door: '<path d="M4 21h16"/><rect x="6" y="3" width="12" height="18" rx="1.5"/><circle cx="14.5" cy="12" r="1"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 15.5a5 5 0 0 1 5.5 4.5"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    receipt: '<path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L10 21l-3-3 9.5-9.5a4 4 0 0 0-2-2z"/>',
    chart: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>',
    sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', edit: '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="m13 7 4 4"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>', check: '<path d="m5 12 4 4L19 7"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', back: '<path d="M5 12h14M12 5l7 7-7 7"/>', print: '<path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    download: '<path d="M12 3v12M6 10l6 6 6-6"/><path d="M4 21h16"/>', upload: '<path d="M12 21V9M6 14l6-6 6 6"/><path d="M4 3h16"/>',
    warning: '<path d="M12 3 2 21h20z"/><path d="M12 10v5M12 18h.01"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', filter: '<path d="M3 5h18l-7 8v6l-4-2v-4z"/>',
    excel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 8l8 8M16 8l-8 8"/>', calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', key: '<circle cx="8" cy="14" r="4"/><path d="M11 11 20 2M16 6l3 3"/>',
    bi: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 4"/>', arrow: '<path d="M19 12H5M12 19l-7-7 7-7"/>', eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>', tag: '<path d="M3 12V3h9l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  };
  function icon(name, size) { const el = document.createElementNS(svgNS, 'svg'); el.setAttribute('viewBox', '0 0 24 24'); el.setAttribute('fill', 'none'); el.setAttribute('stroke', 'currentColor'); el.setAttribute('stroke-width', '1.9'); el.setAttribute('stroke-linecap', 'round'); el.setAttribute('stroke-linejoin', 'round'); if (size) { el.setAttribute('width', size); el.setAttribute('height', size); } el.innerHTML = ICONS[name] || ICONS.info; el.setAttribute('aria-hidden', 'true'); return el; }

  /* ---------- توست ---------- */
  let toastBox = null;
  function toast(msg, type, ms) {
    if (!toastBox) { toastBox = h('div', { class: 'toasts' }); document.body.appendChild(toastBox); }
    const t = h('div', { class: 'toast ' + (type || ''), role: 'status' }, msg);
    toastBox.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 320); }, ms || 3200);
    return t;
  }

  /* ---------- نافذة ---------- */
  const stack = [];
  function modal(opts) {
    const box = h('div', { class: 'modal ' + (opts.size || ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || '' });
    const closeBtn = h('button', { class: 'btn ghost icon', 'aria-label': 'إغلاق', onclick: () => close() }, icon('x'));
    const head = h('div', { class: 'm-head' }, h('h3', null, opts.title || ''), closeBtn);
    const body = h('div', { class: 'm-body' }); append(body, [opts.body]);
    const foot = opts.footer ? h('div', { class: 'm-foot' }, opts.footer) : null;
    append(box, [head, body, foot]);
    const overlay = h('div', { class: 'overlay', onmousedown: (e) => { if (e.target === overlay && !opts.sticky) close(); } }, box);
    function close(result) { if (!overlay.isConnected) return; overlay.remove(); stack.splice(stack.indexOf(api), 1); if (opts.onClose) opts.onClose(result); }
    const api = { el: overlay, box, body, close };
    stack.push(api);
    document.body.appendChild(overlay);
    const first = body.querySelector('input, select, textarea, button'); if (first) setTimeout(() => first.focus(), 30);
    return api;
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stack.length) stack[stack.length - 1].close(); });
  function confirm(opts) {
    return new Promise(resolve => {
      let done = false;
      const ok = h('button', { class: 'btn ' + (opts.danger ? 'danger' : 'primary'), onclick: () => { done = true; m.close(true); resolve(true); } }, opts.okText || 'تأكيد');
      const cancel = h('button', { class: 'btn', onclick: () => m.close(false) }, opts.cancelText || 'إلغاء');
      const m = modal({ title: opts.title || 'تأكيد', size: 'sm', body: h('div', null, typeof opts.text === 'string' ? h('p', null, opts.text) : opts.text), footer: [cancel, ok], onClose: () => { if (!done) resolve(false); } });
      setTimeout(() => cancel.focus(), 40);
    });
  }
  /* تأكيد الحذف مع عرض كل ما سيُحذف معه */
  function confirmDelete(opts) {
    const dep = opts.deps || {};
    const lines = [];
    if (dep.units && dep.units.length) lines.push(`${dep.units.length} وحدة`);
    if (dep.contracts && dep.contracts.length) lines.push(`${dep.contracts.length} عقد`);
    if (dep.payments && dep.payments.length) lines.push(`${dep.payments.length} دفعة/فاتورة`);
    if (dep.maintenance && dep.maintenance.length) lines.push(`${dep.maintenance.length} سجل صيانة`);
    const body = h('div', null,
      h('p', null, 'هل أنت متأكد من حذف ', h('b', null, `${opts.entityAr} «${opts.name}»`), '؟'),
      lines.length ? h('div', { class: 'banner danger mt-s' }, icon('warning'), h('span', null, 'سيُحذف معه أيضًا: ' + lines.join(' · '))) : null,
      h('p', { class: 'muted small mt-s' }, 'الحذف يُكتب فورًا في ملف الإكسيل ولا يمكن التراجع عنه من البرنامج.'),
    );
    return confirm({ title: 'تأكيد الحذف', text: body, danger: true, okText: 'نعم، احذف' });
  }

  /* ---------- درج (بروفايلات) ---------- */
  let drawerApi = null;
  function drawer(opts) {
    if (drawerApi) drawerApi.close();
    const body = h('div', { class: 'd-body' });
    const title = h('h2', { class: 'grow' }, opts.title || '');
    const head = h('div', { class: 'd-head' }, h('button', { class: 'btn ghost icon', 'aria-label': 'إغلاق', onclick: () => api.close() }, icon('back')), title, ...(opts.actions || []));
    const el = h('aside', { class: 'drawer', role: 'dialog', 'aria-label': opts.title || '' }, head, body);
    const ov = h('div', { class: 'drawer-overlay', onclick: () => api.close() });
    const api = { el, body, head, setTitle: t => { title.textContent = t; }, close() { if (!el.isConnected) return; el.remove(); ov.remove(); drawerApi = null; if (opts.onClose) opts.onClose(); } };
    append(body, [opts.body]);
    document.body.appendChild(ov); document.body.appendChild(el);
    drawerApi = api;
    return api;
  }
  function closeDrawer() { if (drawerApi) drawerApi.close(); }

  /* ---------- جدول ---------- */
  function table(opts) {
    const cols = opts.cols;
    let rows = opts.rows.slice();
    let sortKey = opts.sort || null, sortDir = opts.sortDir || 1;
    const wrap = h('div', { class: 'tbl-wrap' });
    function render() {
      clear(wrap);
      const data = rows.slice();
      if (sortKey) { const c = cols.find(c => c.key === sortKey); data.sort((a, b) => { const va = c.sortVal ? c.sortVal(a) : a[sortKey], vb = c.sortVal ? c.sortVal(b) : b[sortKey]; if (va == null) return 1; if (vb == null) return -1; return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'ar')) * sortDir; }); }
      const thead = h('thead', null, h('tr', null, cols.map(c => h('th', { class: (c.num ? 'num ' : '') + (c.sortable !== false ? 'sortable' : ''), onclick: c.sortable === false ? null : () => { if (sortKey === c.key) sortDir = -sortDir; else { sortKey = c.key; sortDir = 1; } render(); } }, c.label, sortKey === c.key ? h('span', { class: 'arr' }, sortDir > 0 ? '▲' : '▼') : null))));
      const tbody = h('tbody');
      if (!data.length) tbody.appendChild(h('tr', null, h('td', { colspan: cols.length }, h('div', { class: 'empty' }, h('b', null, opts.emptyTitle || 'لا توجد بيانات'), opts.empty || ''))));
      for (const r of data) {
        const tr = h('tr', { class: opts.onRow ? 'click' : '', onclick: opts.onRow ? (e) => { if (e.target.closest('button, a, input, select')) return; opts.onRow(r); } : null });
        for (const c of cols) { const td = h('td', { class: (c.num ? 'num ' : '') + (c.cls || '') }); const v = c.render ? c.render(r) : r[c.key]; append(td, [v == null ? '—' : v]); tr.appendChild(td); }
        tbody.appendChild(tr);
      }
      const tbl = h('table', { class: 'tbl' }, thead, tbody, opts.foot ? h('tfoot', null, opts.foot(data)) : null);
      wrap.appendChild(tbl);
    }
    render();
    wrap.update = (newRows) => { rows = newRows.slice(); render(); };
    return wrap;
  }

  /* ---------- تلميح ---------- */
  let tipEl = null;
  function showTip(e, text) { if (!tipEl) { tipEl = h('div', { class: 'tip' }); document.body.appendChild(tipEl); } tipEl.textContent = text; tipEl.style.display = 'block'; moveTip(e); }
  function moveTip(e) { if (!tipEl) return; const x = e.clientX, y = e.clientY; tipEl.style.left = Math.min(x + 12, window.innerWidth - tipEl.offsetWidth - 8) + 'px'; tipEl.style.top = (y - 34) + 'px'; }
  function hideTip() { if (tipEl) tipEl.style.display = 'none'; }
  function tipped(el, text) { el.addEventListener('mouseenter', e => showTip(e, typeof text === 'function' ? text() : text)); el.addEventListener('mousemove', moveTip); el.addEventListener('mouseleave', hideTip); return el; }

  /* ---------- رسوم SVG ---------- */
  const PALETTE = ['#2457C5', '#0E8F84', '#B7791F', '#C9403C', '#6D5BD0', '#3E6FB1', '#1E8E5A', '#D97706', '#8B5CF6', '#0891B2'];
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'; }
  function bars(opts) { // data: [{label, value, color?, sub?}] ; horizontal
    const data = opts.data, W = opts.width || 520, rowH = opts.rowH || 30, padL = opts.padL || 150, H = data.length * rowH + 10;
    const max = Math.max(1, ...data.map(d => d.value));
    const svg = s('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', style: 'direction:ltr' });
    data.forEach((d, i) => {
      const y = i * rowH + 5, w = Math.max(2, (W - padL - 70) * (d.value / max));
      const g = s('g', { class: 'bar', onclick: opts.onClick ? () => opts.onClick(d) : null });
      g.appendChild(s('text', { x: W - 6, y: y + rowH / 2 + 4, 'text-anchor': 'end', 'font-weight': '600' }, d.label.length > 24 ? d.label.slice(0, 23) + '…' : d.label));
      g.appendChild(s('rect', { x: W - padL - w, y: y + 6, width: w, height: rowH - 12, rx: 5, fill: d.color || PALETTE[i % PALETTE.length] }));
      g.appendChild(s('text', { x: W - padL - w - 6, y: y + rowH / 2 + 4, 'text-anchor': 'end', 'font-weight': '700' }, opts.fmt ? opts.fmt(d.value) : U().fmtNum(d.value)));
      if (opts.onClick) g.style.cursor = 'pointer';
      tipped(g, () => (d.tip || d.label + ': ' + (opts.fmt ? opts.fmt(d.value) : U().fmtNum(d.value))));
      svg.appendChild(g);
    });
    return svg;
  }
  function columns(opts) { // series: [{name, color, values:[]}], labels:[]
    const W = opts.width || 720, H = opts.height || 240, padL = 56, padB = 28, padT = 14, padR = 10;
    const labels = opts.labels, series = opts.series;
    const max = Math.max(1, ...series.flatMap(sr => sr.values));
    const svg = s('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, style: 'direction:ltr' });
    const iw = (W - padL - padR) / labels.length, ih = H - padT - padB;
    for (let t = 0; t <= 4; t++) { const y = padT + ih - ih * t / 4; svg.appendChild(s('line', { class: 'grid-line', x1: padL, x2: W - padR, y1: y, y2: y })); svg.appendChild(s('text', { x: padL - 6, y: y + 4, 'text-anchor': 'end' }, short(max * t / 4))); }
    labels.forEach((lb, i) => {
      const x0 = padL + i * iw;
      svg.appendChild(s('text', { x: x0 + iw / 2, y: H - 8, 'text-anchor': 'middle' }, lb));
      const n = series.length, bw = Math.min(28, (iw - 10) / n);
      series.forEach((sr, k) => {
        const v = sr.values[i] || 0, bh = ih * v / max, x = x0 + iw / 2 - (n * bw) / 2 + k * bw;
        const r = s('rect', { class: 'bar', x, y: padT + ih - bh, width: bw - 3, height: bh, rx: 4, fill: sr.color || PALETTE[k], onclick: opts.onClick ? () => opts.onClick(i, k) : null });
        tipped(r, () => `${lb} — ${sr.name}: ${U().fmtMoney(v)}`);
        svg.appendChild(r);
      });
    });
    if (opts.line) { // خط فوق الأعمدة (مثل المستحق)
      const pts = opts.line.values.map((v, i) => [padL + i * iw + iw / 2, padT + ih - ih * (v || 0) / max]);
      svg.appendChild(s('path', { class: 'line', d: pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' '), stroke: opts.line.color || cssVar('--text-2') }));
      pts.forEach((p, i) => { const c = s('circle', { class: 'dot', cx: p[0], cy: p[1], r: 3.5, fill: opts.line.color || cssVar('--text-2') }); tipped(c, () => `${labels[i]} — ${opts.line.name}: ${U().fmtMoney(opts.line.values[i])}`); svg.appendChild(c); });
    }
    return svg;
  }
  function donut(opts) { // data: [{label, value, color}]
    const R = 54, r = 36, C = 2 * Math.PI * R, total = Math.max(1, U().sum(opts.data, d => d.value));
    const svg = s('svg', { viewBox: '0 0 140 140', width: opts.size || 140, height: opts.size || 140 });
    let off = 0;
    opts.data.forEach((d, i) => {
      const len = C * d.value / total;
      const c = s('circle', { cx: 70, cy: 70, r: R, fill: 'none', stroke: d.color || PALETTE[i % PALETTE.length], 'stroke-width': R - r, 'stroke-dasharray': `${len} ${C - len}`, 'stroke-dashoffset': -off, transform: 'rotate(-90 70 70)', class: 'bar', onclick: opts.onClick ? () => opts.onClick(d) : null });
      tipped(c, () => `${d.label}: ${opts.fmt ? opts.fmt(d.value) : U().fmtNum(d.value)} (${U().fmtPct(d.value / total)})`);
      svg.appendChild(c); off += len;
    });
    svg.appendChild(s('text', { x: 70, y: 66, 'text-anchor': 'middle', 'font-size': '18', 'font-weight': '800', fill: cssVar('--text') }, opts.center || ''));
    svg.appendChild(s('text', { x: 70, y: 84, 'text-anchor': 'middle', 'font-size': '10' }, opts.centerSub || ''));
    const legend = h('div', { class: 'donut-legend' }, opts.data.map((d, i) => h('span', { onclick: opts.onClick ? () => opts.onClick(d) : null, style: opts.onClick ? { cursor: 'pointer' } : null }, h('i', { style: { background: d.color || PALETTE[i % PALETTE.length] } }), `${d.label}: ${opts.fmt ? opts.fmt(d.value) : U().fmtNum(d.value)}`)));
    return h('div', { class: 'flex', style: { gap: '18px', alignItems: 'center' } }, svg, legend);
  }
  function spark(values, color) {
    const W = 120, H = 34, max = Math.max(1, ...values), min = Math.min(0, ...values);
    const pts = values.map((v, i) => [i * (W / Math.max(1, values.length - 1)), H - 3 - (H - 6) * ((v - min) / (max - min || 1))]);
    const svg = s('svg', { class: 'spark', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none' });
    svg.appendChild(s('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ') + ` L${W} ${H} L0 ${H} Z`, fill: color || cssVar('--primary') || '#2457C5', 'fill-opacity': '0.15', class: 'area' }));
    svg.appendChild(s('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' '), class: 'line', stroke: color || cssVar('--primary') || '#2457C5', fill: 'none', 'stroke-width': '2' }));
    return svg;
  }
  function short(n) { if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'; if (n >= 1e3) return Math.round(n / 1e3) + 'K'; return String(Math.round(n)); }

  function badge(cls, text) { return h('span', { class: 'badge ' + cls }, text); }
  function codeLink(code, onClick) { return h('a', { class: 'code link', onclick: (e) => { e.stopPropagation(); onClick(code); } }, code); }
  function kv(pairs) { return h('dl', { class: 'kv' }, pairs.filter(p => p).map(([k, v]) => h('div', null, h('dt', null, k), h('dd', null, v == null || v === '' ? '—' : v)))); }

  E.UI = { h, s, append, clear, icon, toast, modal, confirm, confirmDelete, drawer, closeDrawer, table, tipped, showTip, hideTip, bars, columns, donut, spark, short, badge, codeLink, kv, PALETTE, cssVar };
})(window.Egary);
