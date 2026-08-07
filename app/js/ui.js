/* =========================================================
   ui.js — أدوات الواجهة المشتركة: بناء DOM، تنسيق، نوافذ، تلميحات
   ========================================================= */
(function () {
  'use strict';

  /* بناء عناصر DOM بإيجاز: h('div.card', {onclick}, [children]) */
  function h(sel, attrs, children) {
    if (Array.isArray(attrs) || typeof attrs === 'string' || attrs instanceof Node) {
      children = attrs; attrs = null;
    }
    const parts = sel.split(/(?=[.#])/);
    const tag = parts[0] && !/[.#]/.test(parts[0][0]) ? parts.shift() : 'div';
    const el = document.createElement(tag);
    for (const p of parts) {
      if (p[0] === '.') el.classList.add(p.slice(1));
      else if (p[0] === '#') el.id = p.slice(1);
    }
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    append(el, children);
    return el;
  }
  function append(el, children) {
    if (children == null) return;
    if (Array.isArray(children)) { children.forEach(c => append(el, c)); return; }
    if (children instanceof Node) { el.appendChild(children); return; }
    el.appendChild(document.createTextNode(String(children)));
  }

  /* ---------- تنسيق ---------- */
  function money(n, opts) {
    opts = opts || {};
    if (n == null || isNaN(n)) return '—';
    const s = Math.round(n).toLocaleString('en-US');
    return (opts.approx ? '≈' : '') + s + (opts.bare ? '' : ' ج.م');
  }
  function compact(n) {
    if (n == null || isNaN(n)) return '—';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + ' مليون';
    if (Math.abs(n) >= 1e3) return Math.round(n / 1e3) + ' ألف';
    return String(Math.round(n));
  }
  function pct(x) {
    if (x == null || isNaN(x)) return '—';
    return Math.round(x * 100) + '٪';
  }
  function dateLabel(isoStr) {
    if (!isoStr) return '—';
    const [y, m, dd] = isoStr.split('-');
    return `${Number(dd)} ${Store.MONTHS_AR[Number(m) - 1]} ${y}`;
  }
  function shortDate(isoStr) {
    if (!isoStr) return '—';
    const [y, m, dd] = isoStr.split('-');
    return `${y}/${Number(m)}/${Number(dd)}`;
  }

  /* ---------- أيقونات (SVG مضمّن) ---------- */
  const ICONS = {
    check: 'M4 8.5l2.6 2.6L12 5.5',
    x: 'M4.5 4.5l7 7M11.5 4.5l-7 7',
    question: 'M6 6a2.1 2.1 0 013.9 1c0 1.2-1.6 1.5-1.9 2.6M8 12.2v.1',
    warn: 'M8 2.5l6 10.5H2L8 2.5zM8 7v3M8 12v.1',
    clock: 'M8 4.5V8l2.5 1.5M8 14A6 6 0 118 2a6 6 0 010 12z',
    dash: 'M4 8h8',
    plus: 'M8 3.5v9M3.5 8h9',
    close: 'M4 4l8 8M12 4l-8 8',
    left: 'M10 3.5L5.5 8l4.5 4.5',
    right: 'M6 3.5L10.5 8 6 12.5',
    download: 'M8 2.5V10M4.8 7.2L8 10.4l3.2-3.2M3 13h10',
    money: 'M2.5 5h11v6.5h-11zM8 9.6a1.4 1.4 0 100-2.8 1.4 1.4 0 000 2.8zM4.5 5v-.5h7V5',
    home: 'M3 13V6.5L8 3l5 3.5V13H9.5V9.5h-3V13H3z',
    doc: 'M4.5 2.5h5L12 5v8.5h-7.5zM9.5 2.5V5H12M6.5 8h3M6.5 10.5h3',
    shield: 'M8 2l5 1.8v3.8c0 3-2.1 5.1-5 5.9-2.9-.8-5-2.9-5-5.9V3.8L8 2z',
    trend: 'M2.5 11.5l3.4-4 2.4 2.4 4.6-5.2M13 4.5v3M13 4.5h-3',
    trendDown: 'M2.5 4.5l3.4 4 2.4-2.4 4.6 5.2M13 11.5v-3M13 11.5h-3',
    bolt: 'M8.7 2L4.5 9h2.8l-1 5L11.5 7H8.7l1-5z',
    up: 'M8 12V4M4.8 7.2L8 4l3.2 3.2',
    down: 'M8 4v8M4.8 8.8L8 12l3.2-3.2',
  };
  function icon(name, cls) {
    return h('span.icon' + (cls ? '.' + cls : ''), {
      html: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[name] || ''}"/></svg>`,
    });
  }

  /* شارة حالة: لون + أيقونة + نص — اللون لا يحمل المعنى وحده أبدًا */
  function statusChip(kind, label) {
    const map = {
      good:    { cls: 'chip-good',    ic: 'check' },
      warning: { cls: 'chip-warning', ic: 'warn' },
      serious: { cls: 'chip-serious', ic: 'clock' },
      critical:{ cls: 'chip-critical',ic: 'x' },
      neutral: { cls: 'chip-neutral', ic: 'dash' },
      unknown: { cls: 'chip-unknown', ic: 'question' },
    };
    const m = map[kind] || map.neutral;
    return h('span.chip.' + m.cls, [icon(m.ic), h('span', label)]);
  }

  /* ---------- تلميح واحد للصفحة (رسوم + مصفوفة) ---------- */
  let tipEl = null;
  function tipShow(html, x, y) {
    if (!tipEl) { tipEl = h('div.viz-tip'); document.body.appendChild(tipEl); }
    tipEl.innerHTML = html;
    if (window.I18N && I18N.lang === 'en') I18N.translateNode(tipEl);
    tipEl.style.display = 'block';
    const r = tipEl.getBoundingClientRect();
    const px = Math.min(Math.max(8, x - r.width / 2), window.innerWidth - r.width - 8);
    const py = y - r.height - 12 < 8 ? y + 16 : y - r.height - 12;
    tipEl.style.left = px + 'px';
    tipEl.style.top = py + 'px';
  }
  function tipHide() { if (tipEl) tipEl.style.display = 'none'; }
  function bindTip(el, htmlFn) {
    el.addEventListener('mousemove', e => tipShow(htmlFn(), e.clientX, e.clientY));
    el.addEventListener('mouseleave', tipHide);
    el.addEventListener('focus', () => {
      const r = el.getBoundingClientRect();
      tipShow(htmlFn(), r.left + r.width / 2, r.top);
    });
    el.addEventListener('blur', tipHide);
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
  }

  /* ---------- درج جانبي (تفاصيل/إدخال) — بإدارة تركيز للكيبورد ---------- */
  let lastFocused = null;
  function openDrawer(title, bodyNodes, footNodes) {
    closeDrawer();
    lastFocused = document.activeElement;
    const overlay = h('div.overlay', { onclick: e => { if (e.target === overlay) closeDrawer(); } });
    const drawer = h('aside.drawer', { role: 'dialog', 'aria-modal': 'true', 'aria-label': typeof title === 'string' ? title : 'تفاصيل' }, [
      h('header.drawer-head', [
        h('h3', title),
        h('button.btn-icon', { onclick: closeDrawer, 'aria-label': 'إغلاق' }, icon('close')),
      ]),
      h('div.drawer-body', bodyNodes),
      footNodes ? h('footer.drawer-foot', footNodes) : null,
    ]);
    overlay.appendChild(drawer);
    document.body.appendChild(overlay);
    document.addEventListener('keydown', escClose);
    drawer.addEventListener('keydown', trapTab);
    requestAnimationFrame(() => {
      overlay.classList.add('open');
      const first = drawer.querySelector('input, select, button');
      if (first) first.focus();
    });
    return drawer;
  }
  function focusables(drawer) {
    return [...drawer.querySelectorAll('input, select, button, [tabindex="0"]')]
      .filter(el => !el.disabled && el.offsetParent !== null);
  }
  function trapTab(e) {
    if (e.key !== 'Tab') return;
    const drawer = e.currentTarget;
    const els = focusables(drawer);
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function escClose(e) { if (e.key === 'Escape') closeDrawer(); }
  function closeDrawer() {
    const ov = document.querySelector('.overlay');
    if (ov) ov.remove();
    document.removeEventListener('keydown', escClose);
    tipHide();
    if (lastFocused && document.contains(lastFocused)) { try { lastFocused.focus(); } catch (e) {} }
    lastFocused = null;
  }

  /* ---------- إشعار خفيف ---------- */
  let toastTimer = null;
  function toast(msg, kind) {
    let t = document.querySelector('.toast');
    if (!t) { t = h('div.toast'); document.body.appendChild(t); }
    t.textContent = (window.I18N && I18N.lang === 'en') ? I18N.tt(msg) : msg;
    t.className = 'toast show' + (kind ? ' toast-' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------- حقول نماذج ---------- */
  function field(label, inputEl, hint) {
    return h('label.field', [
      h('span.field-label', label),
      inputEl,
      hint ? h('span.field-hint', hint) : null,
    ]);
  }
  function input(attrs) { return h('input.input', attrs); }
  function select(attrs, options, selected) {
    const s = h('select.input', attrs);
    for (const o of options) {
      const opt = h('option', { value: o.value }, o.label);
      if (o.value === selected) opt.selected = true;
      s.appendChild(opt);
    }
    return s;
  }

  function emptyState(title, sub) {
    return h('div.empty', [h('div.empty-title', title), sub ? h('div.empty-sub', sub) : null]);
  }

  /* ---------- تطبيع عربي للبحث: همزات/تاء مربوطة/ياء/تشكيل/أرقام هندية ---------- */
  const AR_DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
  function normalizeAr(s) {
    return String(s || '')
      .replace(/[ً-ْـ]/g, '')          // تشكيل وتطويل
      .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/[٠-٩]/g, d => AR_DIGITS[d])
      .toLowerCase().trim();
  }
  function arMatch(hay, q) {
    return normalizeAr(hay).includes(normalizeAr(q));
  }

  /* ---------- كومبو بوكس ببحث (للسلايسرز والقوائم الطويلة) ---------- */
  function combo(opts) {
    // opts: {placeholder, items: [{value, label}], value, onPick(value)}
    const wrap = h('span.combo');
    const cur = opts.items.find(i => i.value === opts.value);
    const inp = h('input.input.combo-input', {
      type: 'text', placeholder: opts.placeholder,
      value: cur && cur.value !== '' ? cur.label : '',
      autocomplete: 'off', 'aria-label': opts.placeholder,
    });
    const menu = h('div.combo-menu');
    let hi = -1, shown = [];
    function paint(q) {
      menu.innerHTML = '';
      shown = opts.items.filter(i => !q || i.value === '' || arMatch(i.label, q));
      shown.slice(0, 40).forEach((i, idx) => {
        const it = h('button.combo-item' + (i.value === opts.value ? '.on' : ''), {
          type: 'button',
          onmousedown: e => { e.preventDefault(); pick(i); },
        }, i.label);
        if (idx === hi) it.classList.add('hl');
        menu.appendChild(it);
      });
      if (!shown.length) menu.appendChild(h('div.combo-empty', 'لا نتائج'));
    }
    function open() { wrap.classList.add('open'); hi = -1; paint(inp.value === (cur ? cur.label : '') ? '' : inp.value); }
    function close() { wrap.classList.remove('open'); }
    function pick(i) {
      inp.value = i.value === '' ? '' : i.label;
      close();
      opts.onPick(i.value);
    }
    inp.addEventListener('focus', () => { inp.select(); open(); });
    inp.addEventListener('input', () => { hi = -1; wrap.classList.add('open'); paint(inp.value); });
    inp.addEventListener('blur', () => setTimeout(close, 120));
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hi + 1, shown.length - 1); paint(inp.value); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(hi - 1, 0); paint(inp.value); }
      else if (e.key === 'Enter') { e.preventDefault(); if (shown[hi]) pick(shown[hi]); else if (shown.length === 1) pick(shown[0]); }
      else if (e.key === 'Escape') close();
    });
    wrap.appendChild(inp);
    wrap.appendChild(h('span.combo-caret', '▾'));
    wrap.appendChild(menu);
    return wrap;
  }

  window.UI = {
    h, append, money, compact, pct, dateLabel, shortDate,
    icon, statusChip, bindTip, tipShow, tipHide,
    openDrawer, closeDrawer, toast, field, input, select, emptyState,
    normalizeAr, arMatch, combo,
  };
})();
