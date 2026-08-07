/* =========================================================
   app.js — الهيكل والتوجيه
   ========================================================= */
(function () {
  'use strict';
  const { h, icon } = UI;

  const BRAND = { name: 'إيجاري', sub: 'نظام إدارة الإيجارات' };

  const NAV = [
    { id: 'dashboard',  label: 'لوحة المؤشرات',   path: 'M2.5 2.5h4.5v6H2.5zM9 2.5h4.5v3.5H9zM9 8h4.5v5.5H9zM2.5 10.5h4.5v3H2.5z' },
    { id: 'insights',   label: 'التحليلات',        path: 'M2.5 11.5l3.4-4 2.4 2.4 4.6-5.2M13 4.5v3M13 4.5h-3M2.5 13.5h11' },
    { id: 'matrix',     label: 'جدول التحصيل',  path: 'M2.5 4h11M2.5 8h11M2.5 12h11M5.5 2.5v11M10.5 2.5v11' },
    { id: 'intake',     label: 'إضافة مشروع جديد',  path: 'M4 2.5h5L11.5 5v3M4 2.5V13.5h4.5M9 2.5V5h2.5M11.5 9.5v4M9.5 11.5h4' },
    { id: 'units',      label: 'الوحدات',          path: 'M3 13.5V6l5-3.5L13 6v7.5M6.5 13.5v-4h3v4' },
    { id: 'contracts',  label: 'العقود',           path: 'M4 2.5h6l2.5 2.5v8.5H4zM10 2.5V5h2.5M6 8h4M6 10.5h4' },
    { id: 'tenants',    label: 'المستأجرون',       path: 'M5.5 7a2.2 2.2 0 100-4.4A2.2 2.2 0 005.5 7zM1.8 13.2c0-2 1.7-3.6 3.7-3.6s3.7 1.6 3.7 3.6M11 6.8a1.9 1.9 0 100-3.8M10.6 9.7c1.9.2 3.4 1.7 3.4 3.5' },
    { id: 'complaints', label: 'الشكاوى',          path: 'M13.5 7.5a5.5 5.5 0 01-8 4.9L2.5 13.5l1.1-3a5.5 5.5 0 119.9-3zM8 5.5v2.5M8 10.4v.1' },
    { id: 'quality',    label: 'مراجعات مطلوبة',    path: 'M8 1.8l5.5 2v4c0 3.2-2.3 5.6-5.5 6.4-3.2-.8-5.5-3.2-5.5-6.4v-4zM8 5.2v3M8 10.6v.1' },
    { id: 'guide',      label: 'دليل الشرح',       path: 'M8 3c-1.4-.9-3.2-1.2-5.5-1v10c2.3-.2 4.1.1 5.5 1 1.4-.9 3.2-1.2 5.5-1V2c-2.3-.2-4.1.1-5.5 1zM8 3v10' },
    { id: 'settings',   label: 'الإعدادات',        path: 'M8 10.2a2.2 2.2 0 100-4.4 2.2 2.2 0 000 4.4zM13 8c0-.4 0-.8-.1-1.2l1.4-1-1.2-2.1-1.6.6c-.6-.5-1.2-.9-2-1.1L9.2 1.5H6.8l-.3 1.7c-.8.2-1.4.6-2 1.1l-1.6-.6-1.2 2.1 1.4 1C3 7.2 3 7.6 3 8s0 .8.1 1.2l-1.4 1 1.2 2.1 1.6-.6c.6.5 1.2.9 2 1.1l.3 1.7h2.4l.3-1.7c.8-.2 1.4-.6 2-1.1l1.6.6 1.2-2.1-1.4-1c.1-.4.1-.8.1-1.2z' },
  ];

  function navIcon(path) {
    return h('span.nav-ic', {
      html: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`,
    });
  }

  function route() {
    const id = (location.hash || '#dashboard').slice(1).split('/')[0];
    return NAV.some(n => n.id === id) ? id : 'dashboard';
  }

  /* المرشِّحات العامة (السلايسرز) — تسري على كل شاشات مشاريعك */
  const SLICER_VIEWS = ['dashboard', 'insights', 'matrix', 'units', 'contracts', 'tenants', 'complaints'];

  /* قائمة الإدخال السريع — مكان إدخال البيانات واضح من أي شاشة */
  function quickAdd() {
    const menu = h('div.qa-menu', [
      ['تسجيل دفعة', () => { location.hash = '#matrix'; UI.toast('دوس على خلية الشهر المطلوب لتسجيل الدفعة'); }],
      ['عقد جديد', () => Views.openAddContract()],
      ['كشف جديد (ورقة كاملة)', () => { location.hash = '#intake'; }],
      ['وحدة جديدة', () => Views.openAddUnit()],
      ['مستأجر جديد', () => Views.openTenantDrawer(null)],
      ['شكوى جديدة', () => Views.openAddComplaint()],
    ].map(([label, fn]) => h('button.qa-item', { onclick: () => { closeQa(); fn(); } }, label)));
    const wrap = h('div.qa-wrap', [
      h('button.btn.btn-primary.qa-btn', {
        onclick: e => { e.stopPropagation(); wrap.classList.toggle('open'); },
      }, [UI.icon('plus'), ' إدخال']),
      menu,
    ]);
    function closeQa() { wrap.classList.remove('open'); }
    document.addEventListener('click', closeQa, { once: true });
    return wrap;
  }

  /* شريط السلايسرز عنصر مُعاد استخدامه: لو الكتابة جارية جواه لا يُعاد بناؤه
     أبدًا (كان ده سبب «السيرش مش بيكتب» — إعادة البناء كانت بتسرق الفوكس) */
  let slicerEl = null;

  function render() {
    UI.closeDrawer();
    UI.tipHide();
    const cur = route();
    const openIssues = Store.state.issues.filter(q => q.status === 'open').length;

    const wantSlicer = SLICER_VIEWS.includes(cur);
    let keepFocus = null, selS = 0, selE = 0;
    if (wantSlicer && slicerEl && slicerEl.contains(document.activeElement)) {
      keepFocus = document.activeElement;
      try { selS = keepFocus.selectionStart; selE = keepFocus.selectionEnd; } catch (e) {}
      if (Views.refreshSlicerCount) Views.refreshSlicerCount(slicerEl);
    } else {
      slicerEl = wantSlicer ? Views.slicerBar() : null;
    }

    /* شريط «الترشيح النشط» — ظاهر بوضوح حتى لا تُفهم الأرقام المُرشَّحة خطأً */
    let chipsEl = null;
    const F = App.filters;
    if (wantSlicer && (F.b || F.ty || F.tn || F.st || (F.q || '').trim())) {
      const ST_LBL = {
        occupied: 'مؤجَّرة', ending: 'تنتهي قريبًا', ended: 'عقد منتهٍ بلا تجديد',
        noContract: 'بلا عقد مسجّل', vacant: 'شاغرة', arrears: 'عليها متأخرات',
        notEarning: 'شاغرة (لا إيراد منها)',
      };
      const chip = (label, key) => h('button.fchip', {
        onclick: () => { App.filters[key] = ''; render(); },
        title: 'إزالة هذا الترشيح',
      }, [h('span', label), h('span.fchip-x', '×')]);
      const items = [];
      if (F.b) items.push(chip('المشروع: ' + ((Store.building(F.b) || {}).name || ''), 'b'));
      if (F.ty) items.push(chip('النوع: ' + F.ty, 'ty'));
      if (F.tn) items.push(chip('المستأجر: ' + ((Store.tenant(F.tn) || {}).name || ''), 'tn'));
      if (F.st) items.push(chip('الحالة: ' + (ST_LBL[F.st] || F.st), 'st'));
      if ((F.q || '').trim()) items.push(chip('بحث: ' + F.q.trim(), 'q'));
      chipsEl = h('div.fchips', [
        h('span.fchips-label', 'الأرقام المعروضة مُرشَّحة على:'),
        ...items,
        h('button.btn.btn-ghost.fchips-clear', {
          onclick: () => { App.filters = { b: '', ty: '', tn: '', st: '', q: '' }; render(); },
        }, 'عرض الكل'),
      ]);
    }

    const sidebar = h('nav.sidebar', [
      h('div.brand', [
        h('span.brand-logo', {
          html: '<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M4.5 20.5v-4.2M9.5 20.5v-7M14.5 20.5v-9.8" stroke="rgba(255,255,255,0.55)" stroke-width="2.6"/>' +
            '<path d="M4 13.5l5 5L20.5 6.5" stroke="#fff" stroke-width="2.6"/>' +
            '<path d="M15.8 6.5h4.7v4.7" stroke="#fff" stroke-width="2.2"/></svg>',
        }),
        h('div', [
          h('div.brand-name', BRAND.name),
          h('div.brand-sub', BRAND.sub),
        ]),
      ]),
      h('ul.nav', NAV.map(n => h('li', h('a.nav-link' + (n.id === cur ? '.on' : ''), { href: '#' + n.id }, [
        navIcon(n.path),
        h('span.nav-label', n.label),
        n.id === 'quality' && openIssues ? h('span.nav-badge', String(openIssues)) : null,
      ])))),
      h('a.nav-docs', { href: '../docs/index.html', target: '_blank', rel: 'noopener' }, [
        h('span.nav-ic', { html: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3.2C6.8 2.2 5 2 3 2.3v10.4c2-.3 3.8-.1 5 .9 1.2-1 3-1.2 5-.9V2.3c-2-.3-3.8-.1-5 .9zM8 3.2v10.4"/></svg>' }),
        h('span', 'دليل الاستخدام الكامل'),
      ]),
      h('div.sidebar-foot', 'نسخة عرض — مشروع سكرية الفعلي ومشروعان تجريبيان'),
    ]);

    const t = Store.today();
    const curB = App.filters.b ? Store.building(App.filters.b) : null;
    const themeBtn = h('button.btn-icon.top-toggle', {
      'aria-label': 'الوضع الليلي',
      onclick: () => {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem('egary-theme', next); } catch (e) {}
        render();
      },
      html: document.documentElement.dataset.theme === 'dark'
        ? '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="3.2"/><path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3"/></svg>'
        : '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 9.5A6 6 0 116.5 2.5a4.8 4.8 0 007 7z"/></svg>',
    });
    const langBtn = h('button.btn.btn-ghost.top-toggle-lang', {
      onclick: () => { I18N.setLang(I18N.lang === 'ar' ? 'en' : 'ar'); render(); },
    }, I18N.lang === 'ar' ? 'EN' : 'ع');
    const header = h('header.topbar', [
      h('div.topbar-title', [
        NAV.find(n => n.id === cur).label,
        curB ? h('span.topbar-ctx', ' — ' + curB.name) : null,
      ]),
      h('div.topbar-side', [
        h('span.topbar-date', `اليوم: ${UI.dateLabel(Store.iso(t))}`),
        langBtn, themeBtn,
        quickAdd(),
      ]),
    ]);

    const main = h('main.main', [
      header,
      slicerEl,
      chipsEl,
      Views[cur](),
    ]);

    const root = document.getElementById('app');
    root.innerHTML = '';
    root.appendChild(sidebar);
    root.appendChild(main);
    I18N.translateNode(root);
    if (keepFocus && document.contains(keepFocus)) {
      keepFocus.focus({ preventScroll: true });
      try { keepFocus.setSelectionRange(selS, selE); } catch (e) {}
    }
    animateCounts(root);
  }

  /* أرقام بتعدّ لفوق — حياة من غير دوشة، وبتحترم تقليل الحركة */
  function animateCounts(root) {
    if (document.documentElement.dataset.shot) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    root.querySelectorAll('.count-up').forEach(el => {
      const raw = el.textContent.trim();
      const m = raw.match(/^(≈?)([\d,]+)(٪|%)?$/);
      if (!m) return;
      const target = parseInt(m[2].replace(/,/g, ''), 10);
      if (!isFinite(target) || target === 0) return;
      const prefix = m[1] || '', suffix = m[3] || '';
      const t0 = performance.now(), dur = 500;
      function tick(t) {
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = prefix + Math.round(target * eased).toLocaleString('en-US') + suffix;
        if (p < 1 && document.contains(el)) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  window.App = {
    render,
    filters: { b: '', ty: '', tn: '', st: '', q: '' },
  };

  document.addEventListener('DOMContentLoaded', () => {
    try {
      const th = localStorage.getItem('egary-theme');
      if (th) document.documentElement.dataset.theme = th;
      else if (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches)
        document.documentElement.dataset.theme = 'dark';
      // ?theme=dark&lang=en — للعروض واللقطات
      const usp = new URLSearchParams(location.search);
      if (usp.get('theme')) document.documentElement.dataset.theme = usp.get('theme');
      if (usp.get('lang')) I18N.setLang(usp.get('lang'));
      if (usp.get('shot')) document.documentElement.dataset.shot = '1';
    } catch (e) {}
    Store.load();
    Store.subscribe(render);
    window.addEventListener('hashchange', render);
    // الرسوم تُبنى بعرض النافذة الفعلي — يعاد الرسم عند تغيير الحجم
    let rT;
    window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(render, 250); });
    render();
  });
})();
