/* =====================================================================
   forms.js — نماذج الإدخال/التعديل لكل الكيانات + الفاتورة الإلكترونية
   كل نموذج: يفتح نافذة، يتحقق (M.validate)، يحفظ عبر Store (⇒ الإكسيل)، ويُرجع السجل.
   ===================================================================== */
window.Egary = window.Egary || {};
(function (E) {
  'use strict';
  const U = () => E.U, M = () => E.M, S = () => E.Store, UI = () => E.UI, C = () => E.Codes, En = () => E.Engine;
  const h = (...a) => UI().h(...a);

  /* ---------- عناصر النموذج ---------- */
  /* هل خانات التاريخ في هذا المتصفح بترتيب شهر/يوم/سنة؟ (لغة المتصفح الإنجليزية الأمريكية مثلًا) */
  let _mf = null;
  function monthFirst() {
    if (_mf != null) return _mf;
    try { const parts = new Intl.DateTimeFormat((navigator.languages && navigator.languages[0]) || navigator.language || 'ar-EG').formatToParts(new Date(2026, 2, 1)).map(p => p.type).filter(t => t === 'day' || t === 'month'); _mf = parts[0] === 'month'; } catch (e) { _mf = false; }
    return _mf;
  }
  function field(label, input, opts) {
    opts = opts || {};
    let echo = null;
    if (input.type === 'date') { // حقل التاريخ يعرض بصيغة المتصفح (قد تكون شهر/يوم): نعيد كتابته بصيغة البرنامج يوم/شهر/سنة
      echo = h('div', { class: 'help date-echo' });
      // أثناء كتابة السنة بلوحة المفاتيح تمر القيمة بـ 0002 / 0020 / 0202: لا نعرضها تاريخًا (ولا نرمي خطأ)
      // التاريخ بالحروف (يوم + اسم الشهر) حتى لا يلتبس 01/03 بين «أول مارس» و«3 يناير» لو كان المتصفح يكتب الشهر قبل اليوم
      const upd = () => { const dt = U().d(input.value); echo.textContent = dt && dt.getUTCFullYear() >= 1900 ? '= ' + U().fmtDate(input.value) + ' · ' + ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][dt.getUTCDay()] + ' ' + dt.getUTCDate() + ' ' + U().MONTHS_AR[dt.getUTCMonth()] + ' ' + dt.getUTCFullYear() : (input.value ? 'أكمل كتابة التاريخ' : (monthFirst() ? 'انتبه: هذا المتصفح يكتب الشهر قبل اليوم (شهر/يوم/سنة)' : '')); };
      input.addEventListener('input', upd); input.addEventListener('change', upd); setTimeout(upd, 0);
    }
    return h('div', { class: 'field ' + (opts.full ? 'full' : ''), dataset: { field: input.name || (input.dataset && input.dataset.field) || '' } }, h('label', { for: input.id || null }, label, opts.req ? h('span', { class: 'req' }, ' *') : null), input, echo, opts.help ? h('div', { class: 'help' }, opts.help) : null);
  }
  function input(name, value, attrs) { return h('input', Object.assign({ name, id: 'f_' + name, value: value == null ? '' : value, type: 'text', autocomplete: 'off' }, attrs || {})); }
  function number(name, value, attrs) { return input(name, value, Object.assign({ type: 'number', step: 'any', inputmode: 'decimal' }, attrs || {})); }
  function date(name, value, attrs) { return input(name, value, Object.assign({ type: 'date' }, attrs || {})); }
  function textarea(name, value, attrs) { return h('textarea', Object.assign({ name, id: 'f_' + name }, attrs || {}), value == null ? '' : value); }
  function select(name, options, value, attrs) {
    const el = h('select', Object.assign({ name, id: 'f_' + name }, attrs || {}));
    for (const o of options) {
      if (o.group) { const g = h('optgroup', { label: o.group }); for (const oo of o.items) g.appendChild(h('option', { value: oo.value, selected: String(oo.value) === String(value) ? true : null }, oo.label)); el.appendChild(g); }
      else el.appendChild(h('option', { value: o.value, selected: String(o.value) === String(value) ? true : null }, o.label));
    }
    return el;
  }
  /* قائمة اختيار طويلة (الوحدات، العملاء، العقود): مربع بحث فوقها يفلتر الخيارات ببحث البرنامج نفسه (الاسم بأي ترتيب، الكود، التليفون، الرقم القومي…)
     القائمة تبقى <select> بنفس الاسم ⇒ read(form) لا يتغيّر. نتيجة واحدة ⇒ تُختار تلقائيًا. */
  function searchable(sel, hayOf, placeholder, create) {
    const snap = () => [...sel.children].map(n => n.tagName === 'OPTGROUP' ? { group: n, opts: [...n.children] } : { opt: n });
    let nodes = snap();
    const box = h('input', { type: 'search', class: 'pick-filter', name: '_pick_' + sel.name, id: 'pick_' + sel.name, placeholder: placeholder || 'اكتب للبحث…', autocomplete: 'off', 'aria-label': placeholder || 'بحث في القائمة' });
    const count = h('div', { class: 'pick-count muted', id: 'pick_' + sel.name + '_count', role: 'status' });
    const hay = o => { const v = o.getAttribute('value'); return o.textContent + ' ' + (v && hayOf ? hayOf(v) : ''); };
    const apply = () => {
      const pq = En().prepQ(box.value), cur = sel.value; let n = 0, last = '';
      // خيارات ثابتة (مثل «＋ عميل جديد») تبقى ظاهرة دائمًا ولا تُحسب نتيجة
      const keep = (o) => { const v = o.getAttribute('value'); if (o.dataset && o.dataset.always) return true; const hit = !!(pq && v && En().matchQ(hay(o), pq)); if (hit) { n++; last = v; } return !pq || !v || hit || v === cur; };
      UI().clear(sel);
      for (const nd of nodes) {
        if (nd.opt) { if (keep(nd.opt)) sel.appendChild(nd.opt); continue; }
        UI().clear(nd.group); for (const o of nd.opts) if (keep(o)) nd.group.appendChild(o);
        if (nd.group.children.length) sel.appendChild(nd.group);
      }
      sel.value = cur;
      UI().clear(count);
      if (pq) count.appendChild(document.createTextNode(n === 1 ? 'نتيجة واحدة — اختيرت تلقائيًا' : n ? `${n} نتيجة — اختر من القائمة` : 'لا توجد نتائج — جرّب جزءًا من الاسم أو الكود أو التليفون'));
      // لا نتائج والقائمة تقبل الإضافة (العملاء): زر يسجّل المكتوب مباشرة عميلًا جديدًا
      if (pq && !n && create) { const t = box.value.trim(); count.appendChild(h('button', { class: 'btn sm pick-create', type: 'button', onclick: () => create.run(t) }, UI().icon('plus'), create.label(t))); }
      if (pq && n === 1 && sel.value !== last) { sel.value = last; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    };
    box.addEventListener('input', apply);
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); sel.focus(); } }); // Enter لا يحفظ النموذج من مربع البحث
    sel._pickAdd = (o) => { nodes.push({ opt: o }); box.value = ''; apply(); };
    sel._pickReset = () => { box.value = ''; apply(); };
    sel._pickBox = box;
    return h('div', { class: 'pick', dataset: { field: sel.name } }, box, sel, count);
  }
  function listOpts(list, withEmpty) { const o = list.map(x => ({ value: x.key, label: x.ar })); return withEmpty ? [{ value: '', label: withEmpty }].concat(o) : o; }
  function read(form) {
    const out = {};
    form.querySelectorAll('input, select, textarea').forEach(el => {
      if (!el.name || el.name.startsWith('_')) return;
      if (el.type === 'checkbox') out[el.name] = el.checked;
      else if (el.type === 'number') out[el.name] = el.value === '' ? '' : U().toNum(el.value);
      else out[el.name] = el.type === 'password' ? el.value : el.value.trim(); // كلمات المرور كما كُتبت
    });
    return out;
  }
  function showErrors(form, errs) {
    let box = form.querySelector('.form-errors');
    if (!errs.length) { if (box) box.remove(); return; }
    if (!box) { box = h('div', { class: 'form-errors full', role: 'alert' }); form.prepend(box); }
    UI().clear(box); box.appendChild(h('ul', { style: { margin: 0, paddingInlineStart: '18px' } }, errs.map(e => h('li', null, e))));
    box.scrollIntoView({ block: 'nearest' });
  }

  /* نموذج داخل نموذج (عميل جديد من داخل العقد): المعرّفات المكررة (#f_notes…) تأخذ لاحقة حتى لا يفتح عنوان حقل حقلًا في النموذج الآخر.
     النموذج الأول يحتفظ بالمعرّف كما هو (#f_name، #f_start…). */
  let FORM_SEQ = 0;
  function uniqueIds(form) {
    const seq = ++FORM_SEQ;
    for (const el of form.querySelectorAll('[id]')) {
      if (document.getElementById(el.id) === el) continue;
      const old = el.id; el.id = old + '_' + seq;
      for (const l of form.querySelectorAll('label')) if (l.htmlFor === old) l.htmlFor = el.id;
    }
  }
  /* نافذة نموذج عامة: تُرجع Promise بالسجل المحفوظ أو null
     opts.altSave = { text, icon, id, after(record) }: زر حفظ ثانٍ ينفّذ خطوة بعد الحفظ (مثل طباعة الفاتورة) */
  function openForm(opts) {
    return new Promise(resolve => {
      let saved = null, then = null;
      const form = h('form', { class: 'form', novalidate: true, onsubmit: (e) => { e.preventDefault(); submit(); } });
      UI().append(form, [opts.body(form)]);
      const saveBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => submit() }, UI().icon('check'), opts.saveText || 'حفظ');
      const altBtn = opts.altSave ? h('button', { class: 'btn', type: 'button', id: opts.altSave.id || null, onclick: () => submit(opts.altSave.after) }, UI().icon(opts.altSave.icon || 'print'), opts.altSave.text) : null;
      const cancel = h('button', { class: 'btn', type: 'button', onclick: () => m.close() }, 'إلغاء');
      // إغلاق نموذج فيه كتابة بدون حفظ (Escape / إلغاء / ×): توست «استرجاع ما كتبته» يعيد فتحه بنفس القيم بدل ضياعها
      // «كتب المستخدم شيئًا» = حدث input من الكتابة أو الاختيار (البرنامج نفسه لا يطلق input عند الملء التلقائي)
      let dirty = false; form.addEventListener('input', () => { dirty = true; });
      const offerRestore = () => {
        if (!opts.restore || !dirty) return;
        let vals; try { vals = read(form); } catch (e) { return; }
        const t = UI().toast(h('span', { class: 'toast-msg' }, 'أُغلق النموذج بدون حفظ', h('button', { class: 'btn sm toast-act', type: 'button', id: 'btn-restore-form', onclick: () => { t.remove(); Promise.resolve(opts.restore(vals)).then(r => { if (r && E.App && E.App.render) E.App.render(); }); } }, 'استرجاع ما كتبته')), 'warn', 7000);
      };
      const m = UI().modal({ title: opts.title, size: opts.size || '', body: form, footer: [opts.extraFooter ? h('span', { class: 'start' }, opts.extraFooter) : null, cancel, saveBtn, altBtn], sticky: true, onClose: () => { resolve(saved); if (saved && then) then(saved); if (!saved) offerRestore(); } });
      form._done = (rec) => { saved = rec || null; m.close(); }; // إنهاء النموذج بسجل جاهز (مثل «استخدم العميل الموجود» بدل التكرار)
      uniqueIds(form);
      async function submit(after) {
        const vals = read(form);
        const res = await opts.onSave(vals, form);
        if (res && res.errors && res.errors.length) { showErrors(form, res.errors); return; }
        saved = res && res.record ? res.record : (res || null);
        then = after || null;
        m.close();
      }
      if (opts.afterMount) opts.afterMount(form);
    });
  }
  /* أول حقل فارغ يأخذ المؤشر (بدل حقل ممتلئ أصلًا) */
  function focusFirst(...els) { const el = els.find(x => x && !x.disabled && !String(x.value || '').trim()) || els.find(Boolean); if (el) try { el.focus(); } catch (e) { } }
  function now() { return U().iso(U().today()); }
  /* صلاحيات: مشاهدة فقط لا تعدّل، الإعدادات والمستخدمون للمدير */
  function guard(action, entity) {
    if (!E.Auth || E.Auth.can(action, entity)) return true;
    UI().toast(action === 'settings' ? 'الإعدادات للمدير فقط' : action === 'users' ? 'إدارة المستخدمين للمدير فقط' : 'حسابك للمشاهدة فقط — لا يمكنك التعديل', 'warn');
    return false;
  }

  /* ---------- مشروع ---------- */
  function project(rec) {
    if (!guard('edit')) return Promise.resolve(null);
    const isNew = !rec; rec = rec || M().blank.projects();
    return openForm({
      title: isNew ? 'مشروع جديد' : 'تعديل مشروع ' + rec.code,
      body: () => [
        field('اسم المشروع', input('name', rec.name, { placeholder: 'مثال: برج النيل' }), { req: true }),
        field('المنطقة', input('area', rec.area, { placeholder: 'الدقي / المهندسين…' })),
        field('العنوان', input('address', rec.address), { full: true }),
        field('ملاحظات', textarea('notes', rec.notes), { full: true }),
        isNew ? null : field('الكود', input('_code', rec.code, { disabled: true }), { help: 'الكود ثابت لا يتغيّر' }),
      ],
      onSave: (v) => {
        const r = Object.assign({}, rec, v, { code: isNew ? C().nextProject(S().state()) : rec.code, createdAt: rec.createdAt || now() });
        const errors = M().validate('projects', r, S().state()); if (errors.length) return { errors };
        S().upsert('projects', r, r.name); UI().toast((isNew ? 'أُضيف المشروع ' : 'عُدِّل المشروع ') + r.code, 'ok');
        return { record: r };
      },
    });
  }

  /* ---------- وحدة (مع قائمة الأصول) ---------- */
  function unit(rec, defaults) {
    if (!guard('edit')) return Promise.resolve(null);
    const isNew = !rec; rec = rec || Object.assign(M().blank.units(), defaults || {});
    const st = S().state();
    const projOpts = st.projects.map(p => ({ value: p.code, label: `${p.name} (${p.code})` }));
    const assets = (rec.assets && rec.assets.length ? rec.assets : []).slice();
    const names = new Set(assets.map(a => U().normalize(a.name)));
    for (const n of M().ASSET_CATALOG) if (!names.has(U().normalize(n))) assets.push({ name: n, present: false, details: '' });
    let codePreview;
    return openForm({
      title: isNew ? 'وحدة جديدة' : 'تعديل وحدة ' + rec.code,
      restore: (vals) => unit(isNew ? null : Object.assign({}, rec, vals), isNew ? Object.assign({}, defaults || {}, vals) : null),
      size: 'lg',
      body: (form) => {
        const proj = select('projectCode', [{ value: '', label: '— اختر المشروع —' }].concat(projOpts), rec.projectCode, isNew ? null : { disabled: true, title: 'كود الوحدة مبني على المشروع ولا يتغيّر' });
        const label = input('label', rec.label, { placeholder: '304 / محل 2 / ميزان 1 / جراج 5' });
        codePreview = h('span', { class: 'code' }, isNew ? '—' : rec.code);
        const type = select('type', listOpts(M().UNIT_TYPES), rec.type);
        const floor = input('floor', rec.floor, { placeholder: '3 / M / G' });
        const upd = () => { if (!isNew) return; const p = proj.value, l = label.value.trim(); codePreview.textContent = p && l ? C().unitCode(st, p, l) : '—'; if (l && !floor.dataset.touched) floor.value = C().inferFloor(l); if (l && !type.dataset.touched) type.value = C().inferType(l); };
        proj.addEventListener('change', upd); label.addEventListener('input', upd); floor.addEventListener('input', () => { floor.dataset.touched = '1'; }); type.addEventListener('change', () => { type.dataset.touched = '1'; });
        const assetsBox = h('div', { class: 'assets-grid full' });
        const addAsset = (a) => {
          const chk = h('input', { type: 'checkbox', name: '_a_present', checked: a.present ? true : null });
          const det = h('input', { type: 'text', name: '_a_details', value: a.details || '', placeholder: 'تفاصيل (العدد / الماركة / الحالة)…' });
          const nameEl = a.custom ? h('input', { type: 'text', name: '_a_name', value: a.name, placeholder: 'اسم الأصل' }) : h('span', null, a.name);
          const row = h('div', { class: 'asset-row', dataset: { asset: a.name } }, h('label', { class: 'check' }, chk, nameEl), det);
          row._get = () => ({ name: a.custom ? nameEl.value.trim() : a.name, present: chk.checked, details: det.value.trim() });
          assetsBox.appendChild(row);
        };
        assets.forEach(addAsset);
        form._assets = assetsBox;
        return [
          field('المشروع', proj, { req: true }),
          field('رقم / اسم الوحدة', label, { req: true, help: h('span', null, 'الكود المتوقع: ', codePreview) }),
          field('النوع', type, { req: true }),
          field('الدور', floor, { help: 'يُستنتج من الرقم تلقائيًا ويمكن تعديله' }),
          field('المساحة م²', number('area', rec.area)),
          field('ملاحظات', textarea('notes', rec.notes)),
          h('div', { class: 'full' }, h('h4', { class: 'mb', style: { marginBottom: '8px' } }, 'الأصول والمحتويات (علّم الموجود واكتب تفاصيله)'), assetsBox, h('button', { class: 'btn sm mt-s', type: 'button', onclick: () => addAsset({ name: '', present: true, details: '', custom: true }) }, UI().icon('plus'), 'أصل آخر')),
        ];
      },
      onSave: (v, form) => {
        const assetRows = [...form._assets.querySelectorAll('.asset-row')].map(r => r._get()).filter(a => a.name);
        const r = Object.assign({}, rec, v, { assets: assetRows.filter(a => a.present || a.details), createdAt: rec.createdAt || now() });
        if (!isNew) r.projectCode = rec.projectCode;
        r.code = isNew ? C().unitCode(S().state(), r.projectCode, r.label) : rec.code;
        // تعديل وحدة بلا تغيير اسمها: لا نمنع الحفظ لو الورقة فيها أصلًا وحدتان بنفس الاسم (allowDupLabel يقرؤه model.validate)
        const errors = M().validate('units', r, S().state(), { allowDupLabel: !isNew && U().normalize(r.label) === U().normalize(rec.label) }); if (errors.length) return { errors };
        S().upsert('units', r, `${r.label} (${(S().project(r.projectCode) || {}).name || ''})`); UI().toast((isNew ? 'أُضيفت الوحدة ' : 'عُدِّلت الوحدة ') + r.code, 'ok');
        return { record: r };
      },
    });
  }

  /* ---------- عميل ---------- */
  /* التليفون كما يُحفظ: الموبايل المصري بصيغة 01xxxxxxxxx حتى لو كُتب +20… أو 0020… أو ضاع صفره (1001112233) */
  function localPhone(p) {
    const s = String(p || ''), d = s.replace(/[^\d+]/g, '');
    const m = /^(?:\+|00)?20(1\d{9})$/.exec(d) || /^(1[0125]\d{8})$/.exec(d);
    return m ? '0' + m[1] : s;
  }
  const phoneKey = (p) => { const d = String(U().foldDigits(p || '')).replace(/\D/g, ''); return d.length >= 9 ? d.slice(-10) : ''; };
  /* عملاء مسجَّلون بنفس الاسم أو نفس التليفون (للتنبيه قبل التكرار في التسجيل السريع) */
  function similarClients(r) {
    const nm = U().normalize(r.name).replace(/ /g, ''), ph = phoneKey(r.phone), out = [];
    for (const c of S().state().clients) {
      if (c.code === r.code) continue;
      const byName = !!nm && U().normalize(c.name).replace(/ /g, '') === nm, byPhone = !!ph && (phoneKey(c.phone) === ph || phoneKey(c.phone2) === ph);
      if (byName || byPhone) out.push({ c, byName, byPhone });
    }
    return out;
  }
  /* opts.inline: من داخل نموذج العقد (العميل يبقى محفوظًا حتى لو أُلغي العقد) */
  function client(rec, defaults, opts) {
    if (!guard('edit')) return Promise.resolve(null);
    opts = opts || {};
    const isNew = !rec; rec = rec || Object.assign(M().blank.clients(), defaults || {});
    const before = { name: isNew ? '' : rec.name, phone: isNew ? '' : rec.phone };
    let dupConfirmed = false, dupFor = ''; // تأكيد الرقم القومي المكرر: لمحاولة الحفظ التالية في هذا النموذج فقط (لا يُكتب على سجل المخزن)
    let simFor = ''; // تأكيد «عميل بنفس الاسم/التليفون» لنفس التشابه مرة واحدة
    return openForm({
      title: isNew ? 'عميل جديد' : 'تعديل عميل ' + rec.code,
      restore: (vals) => client(isNew ? null : Object.assign({}, rec, vals), isNew ? Object.assign({}, defaults || {}, vals) : null, opts),
      body: () => [
        isNew ? h('p', { class: 'small muted full form-intro' }, 'الاسم فقط مطلوب — التليفون والرقم القومي وبقية البيانات تُكتب الآن أو لاحقًا من «تعديل».') : null,
        field('الاسم', input('name', rec.name, { placeholder: 'اسم العميل أو الشركة' }), { req: true, full: true }),
        field('التليفون', input('phone', rec.phone, { dir: 'ltr', inputmode: 'tel', placeholder: '01xxxxxxxxx' }), { help: 'موبايل 11 رقمًا يبدأ بـ 01 — اختياري' }),
        field('النوع', select('kind', listOpts(M().CLIENT_KINDS), rec.kind)),
        field('الرقم القومي / الباسبور', input('nationalId', rec.nationalId, { dir: 'ltr', inputmode: 'numeric' })),
        field('الممثل القانوني', input('rep', rec.rep), { help: 'للشركات، أو من يوقّع العقد' }),
        field('تليفون آخر', input('phone2', rec.phone2, { dir: 'ltr', inputmode: 'tel' })),
        field('رقم التسجيل الضريبي', input('taxId', rec.taxId, { dir: 'ltr' })),
        field('البريد الإلكتروني', input('email', rec.email, { dir: 'ltr', type: 'email' })),
        field('العنوان', input('address', rec.address)),
        field('تفاصيل / ملاحظات', textarea('notes', rec.notes), { full: true }),
      ],
      onSave: (v, form) => {
        for (const k of ['nationalId', 'taxId', 'phone', 'phone2']) if (v[k]) v[k] = U().foldCode(v[k]).replace(/[^0-9A-Z+\-]/g, '');
        for (const k of ['phone', 'phone2']) if (v[k]) v[k] = localPhone(v[k]);
        const r = Object.assign({}, rec, v, { code: isNew ? C().nextClient(S().state()) : rec.code, createdAt: rec.createdAt || now() });
        const errors = M().validate('clients', r, S().state());
        // رقم جديد أو متغيّر: موبايل مصري = 11 رقمًا، وأي رقم آخر بين 7 و15 رقمًا (رقم ناقص أو زائد خطأ كتابة غالبًا)
        if (!errors.length && r.phone && r.phone !== before.phone) {
          const d = r.phone.replace(/\D/g, '');
          if (/^01/.test(d) && d.length !== 11) errors.push(`رقم الموبايل 11 رقمًا يبدأ بـ 01 — المكتوب ${d.length} رقمًا`);
          else if (d.length < 7 || d.length > 15) errors.push('رقم التليفون غير صحيح — راجِع عدد الأرقام');
        }
        if (errors.length) return { errors };
        const nid = U().foldCode(r.nationalId);
        const dup = r.nationalId ? S().state().clients.find(c => c.code !== r.code && U().foldCode(c.nationalId) === nid) : null;
        if (dup && !(dupConfirmed && dupFor === nid)) { dupConfirmed = true; dupFor = nid; return { errors: [`هذا الرقم القومي/الباسبور مسجَّل للعميل «${dup.name}» (${dup.code}) — اضغط حفظ مرة أخرى للتأكيد لو كان عميلًا مختلفًا فعلًا`] }; }
        // نفس الاسم أو نفس التليفون: تنبيه مرة واحدة (العميل الجديد أو عند تغيير الاسم/التليفون) مع زر لاستخدام العميل الموجود بدل التكرار
        if (isNew || U().normalize(r.name) !== U().normalize(before.name) || phoneKey(r.phone) !== phoneKey(before.phone)) {
          const sims = similarClients(r).filter(x => (x.byName && (isNew || U().normalize(r.name) !== U().normalize(before.name))) || (x.byPhone && (isNew || phoneKey(r.phone) !== phoneKey(before.phone))));
          const key = sims.map(x => x.c.code).join(',');
          if (sims.length && simFor !== key) {
            simFor = key;
            return { errors: [h('div', { class: 'dup-clients' },
              h('div', null, `يوجد عميل مسجَّل بنفس ${sims.some(x => x.byName) && sims.some(x => x.byPhone) ? 'الاسم/التليفون' : sims.some(x => x.byName) ? 'الاسم' : 'التليفون'}:`),
              sims.slice(0, 3).map(({ c }) => h('div', { class: 'dup-row' }, h('b', null, c.name), ' ', h('span', { class: 'code' }, c.code), c.phone ? h('span', { class: 'ltr muted' }, ' ' + c.phone) : null, isNew ? h('button', { class: 'btn sm', type: 'button', dataset: { useClient: c.code }, onclick: () => form._done(S().client(c.code) || c) }, 'استخدم هذا العميل') : null)),
              h('div', { class: 'small' }, 'لو شخص مختلف فعلًا اضغط «حفظ» مرة أخرى.'))] };
          }
        }
        S().upsert('clients', r, r.name); UI().toast((isNew ? 'أُضيف العميل ' : 'عُدِّل العميل ') + r.code + (isNew && opts.inline ? ' — يبقى محفوظًا حتى لو ألغيت العقد' : ''), 'ok', isNew && opts.inline ? 5000 : null);
        return { record: r };
      },
    });
  }

  /* ---------- عقد ---------- */
  const unitHay = (v) => { const u = S().unit(v); return u ? En().unitText(u) : ''; };
  const clientHay = (v) => En().clientText(S().client(v));
  const contractHay = (v) => En().contractText(S().contract(v));
  /* قائمة الوحدات: في نموذج العقد (vacantFirst) الشاغرة أولًا في مجموعة واحدة «شاغرة الآن» ثم بقية كل مشروع (التي تنتهي قريبًا قبل المؤجَّرة) */
  function unitOptions(st, current, vacantFirst) {
    const asOf = U().today();
    const who = (s) => s.contract && s.contract.code !== current ? ' (' + ((S().client(s.contract.clientCode) || {}).name || '—') + ')' : s.contract ? ' (هذا العقد)' : '';
    if (!vacantFirst) return st.projects.map(p => ({ group: `${p.name} (${p.code})`, items: S().unitsOf(p.code).map(u => { const s = En().unitStatus(u, asOf); return { value: u.code, label: `${u.label} — ${u.code} — ${En().USTATUS_AR[s.status]}${who(s)}` }; }) })).filter(g => g.items.length);
    const vac = [], groups = [], rank = { ending: 0, occupied: 1 };
    for (const p of st.projects) {
      const rest = [];
      for (const u of S().unitsOf(p.code)) {
        const s = En().unitStatus(u, asOf);
        if (s.status === 'vacant') vac.push({ value: u.code, label: `${u.label} — ${p.name} — ${u.code}${s.next ? ' (محجوزة من ' + U().fmtDate(s.next.start) + ')' : ''}` });
        else rest.push({ s, value: u.code, label: `${u.label} — ${u.code} — ${s.status === 'ending' ? 'تنتهي ' + U().fmtDate(s.contract.end) : 'مؤجَّرة'}${who(s)}` });
      }
      rest.sort((a, b) => rank[a.s.status] - rank[b.s.status]);
      if (rest.length) groups.push({ group: `${p.name} (${p.code}) — مؤجَّرة`, items: rest.map(({ value, label }) => ({ value, label })) });
    }
    return (vac.length ? [{ group: `شاغرة الآن — جاهزة للتأجير (${vac.length})`, items: vac }] : []).concat(groups);
  }
  /* نهاية العقد المقترحة = البداية + عدد شهور − يوم (12 شهرًا افتراضيًا، أو مدة العقد السابق في التجديد) */
  function endFor(startIso, months) { const d = U().d(startIso); if (!d || d.getUTCFullYear() < 1900) return ''; return U().iso(U().addDays(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate())), -1)); }
  function monthsOf(startIso, endIso) { const a = U().d(startIso), b0 = U().d(endIso); if (!a || !b0 || b0 < a) return 12; const b = U().addDays(b0, 1); return Math.max(1, Math.round((b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) + (b.getUTCDate() - a.getUTCDate()) / 30)); }
  /* أول يوم تكون فيه الوحدة خالية من اليوم فصاعدًا (بعد نهاية العقد الحالي/المحجوز) */
  function firstFreeDay(unitCode, exceptCode) {
    let free = U().today();
    const cs = S().contractsOfUnit(unitCode).filter(c => c.code !== exceptCode && U().d(c.start) && U().d(c.end)).slice().sort((a, b) => U().cmp(a.start, b.start));
    for (const c of cs) if (U().d(c.start) <= free && U().d(c.end) >= free) free = U().addDays(U().d(c.end), 1);
    return U().iso(free);
  }
  /* opts: لا شيء حاليًا — defaults.prevCode = تجديد (العنوان «تجديد العقد …» والمدة المقترحة = مدة العقد السابق) */
  function contract(rec, defaults) {
    if (!guard('edit')) return Promise.resolve(null);
    const isNew = !rec; const st = S().state();
    defaults = defaults || {};
    // عقد جديد: البداية اليوم، والزيادة ويوم الاستحقاق من الإعدادات
    rec = rec || Object.assign(M().blank.contracts(), { start: now(), increasePct: st.settings.defaultIncreasePct || 0, dueDay: st.settings.dueDay || 1, depositStatus: 'none' }, defaults);
    const renewing = isNew && !!defaults.prevCode;
    let autoMonths = isNew && defaults.start && defaults.end ? monthsOf(defaults.start, defaults.end) : 12;
    let schedBox, overrides = Object.assign({}, rec.rentOverrides || {});
    let refs = {};
    return openForm({
      title: !isNew ? 'تعديل عقد ' + rec.code : renewing ? 'تجديد العقد ' + defaults.prevCode : 'عقد جديد',
      restore: (vals) => { if (vals.clientCode === '__new') vals.clientCode = ''; return isNew ? contract(null, Object.assign({}, defaults, vals)) : contract(Object.assign({}, rec, vals)); },
      size: 'lg',
      body: (form) => {
        const unitSel = select('unitCode', [{ value: '', label: '— اختر الوحدة —' }].concat(unitOptions(st, rec.code, true)), rec.unitCode);
        const clientOpts = st.clients.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar')).map(c => ({ value: c.code, label: `${c.name} (${c.code})${c.phone ? ' — ' + c.phone : ''}` }));
        const clientSel = select('clientCode', [{ value: '', label: '— اختر العميل —' }, { value: '__new', label: '＋ عميل جديد (تسجيل سريع)…' }].concat(clientOpts), rec.clientCode);
        const newOpt = clientSel.querySelector('option[value="__new"]') || [...clientSel.children].find(o => o.getAttribute && o.getAttribute('value') === '__new');
        if (newOpt) newOpt.dataset.always = '1';
        let lastClient = clientSel.value;
        // «＋ عميل جديد»: نموذج العميل فوق العقد، ثم يعود العقد بكل ما كُتب فيه والعميل الجديد مختار
        const addClient = async (seed) => {
          const t = String(seed || '').trim();
          const d = !t ? {} : /^[\d\s+\-٠-٩]+$/.test(t) ? { phone: t } : { name: t };
          const c = await client(null, d, { inline: true });
          if (!c) { clientSel.value = lastClient; return; }
          if (![...clientSel.querySelectorAll('option')].some(o => o.getAttribute('value') === c.code)) { const o = h('option', { value: c.code }, `${c.name} (${c.code})${c.phone ? ' — ' + c.phone : ''}`); clientSel.appendChild(o); if (clientSel._pickAdd) clientSel._pickAdd(o); }
          else if (clientSel._pickReset) clientSel._pickReset();
          clientSel.value = c.code; lastClient = c.code;
          clientSel.dispatchEvent(new Event('change', { bubbles: true }));
          focusFirst(refs.rent, refs.start);
        };
        clientSel.addEventListener('change', () => { if (clientSel.value === '__new') { clientSel.value = lastClient; addClient(clientSel._pickBox ? clientSel._pickBox.value : ''); return; } lastClient = clientSel.value; });
        const newClient = h('button', { class: 'btn sm', type: 'button', id: 'btn-inline-client', onclick: () => addClient(clientSel._pickBox ? clientSel._pickBox.value : '') }, UI().icon('plus'), 'عميل جديد');
        const start = date('start', rec.start, { min: '1950-01-01', max: (U().today().getUTCFullYear() + 2) + '-12-31' }), end = date('end', rec.end, { min: '1950-01-01', max: '2099-12-31' });
        const rent = number('rent', rec.rent || '', { min: 0 }), inc = number('increasePct', rec.increasePct, { min: 0, max: 100, step: '0.5' });
        const dep = number('deposit', rec.deposit || '', { min: 0 }), depSt = select('depositStatus', listOpts(M().DEPOSIT_STATUS), rec.depositStatus);
        const dueDay = number('dueDay', rec.dueDay || 1, { min: 1, max: 28, step: 1 });
        refs = { unitSel, clientSel, start, end, rent, dep, depSt };
        const prevSel = select('prevCode', [{ value: '', label: '— بلا —' }], rec.prevCode);
        const fillPrev = () => { UI().clear(prevSel); prevSel.appendChild(h('option', { value: '' }, '— بلا (عقد جديد) —')); for (const c of S().contractsOfUnit(unitSel.value)) if (c.code !== rec.code) prevSel.appendChild(h('option', { value: c.code, selected: c.code === rec.prevCode ? true : null }, `${c.code} — ${(S().client(c.clientCode) || {}).name} (${U().fmtDate(c.start)} → ${U().fmtDate(c.end)})`)); };
        fillPrev(); unitSel.addEventListener('change', fillPrev);
        // نهاية مقترحة = سنة من البداية (أو مدة العقد السابق في التجديد)، تتبع البداية ما دام المستخدم لم يكتب النهاية بنفسه — ولا تُقترح من سنة لم تكتمل كتابتها (0202…)
        let endAuto = !end.value || renewing;
        let startAuto = isNew && !defaults.start; // البداية الافتراضية (اليوم) تتحرك إلى أول يوم خالٍ في الوحدة المختارة
        end.addEventListener('input', () => { endAuto = !end.value; });
        start.addEventListener('input', () => { startAuto = false; });
        const followStart = () => { const e = endFor(start.value, autoMonths); if (e && endAuto) { end.value = e; endAuto = true; end.dispatchEvent(new Event('change')); } };
        start.addEventListener('change', () => { followStart(); renderSched(); });
        if (isNew && start.value && !end.value) followStart(); // بداية جاهزة (اليوم/التجديد) بلا نهاية ⇒ النهاية تُقترح فورًا
        // الوحدة: حالتها الآن، وآخر إيجار لها (يُقترح في خانة الإيجار ما دام المستخدم لم يكتبه)
        const unitHelp = h('div', { class: 'help unit-state' });
        const rentHelp = h('div', { class: 'help' });
        let rentAuto = isNew && !rec.rent;
        rent.addEventListener('input', () => { rentAuto = !rent.value; });
        const onUnit = () => {
          const u = S().unit(unitSel.value); unitHelp.textContent = ''; rentHelp.textContent = '';
          if (!u) return;
          const s = En().unitStatus(u);
          if (s.status === 'vacant') unitHelp.textContent = (s.vacantSince ? `شاغرة منذ ${U().fmtDate(s.vacantSince)}` : 'شاغرة — لم تُؤجَّر من قبل') + (s.next ? ` · محجوزة بعقد ${s.next.code} من ${U().fmtDate(s.next.start)}` : '');
          else if (s.contract && s.contract.code !== rec.code) unitHelp.textContent = `مؤجَّرة الآن لـ ${(S().client(s.contract.clientCode) || {}).name || '—'} حتى ${U().fmtDate(s.contract.end)} — العقد الجديد يبدأ بعدها`;
          if (startAuto) { const f = firstFreeDay(u.code, rec.code); if (f !== start.value) { start.value = f; start.dispatchEvent(new Event('change')); } }
          const last = s.status === 'vacant' ? s.last : null;
          const lr = last ? En().currentRent(last, U().d(last.end)) : 0;
          if (lr > 0) rentHelp.textContent = `آخر إيجار لهذه الوحدة: ${U().fmtMoney(lr)}`;
          if (rentAuto) { rent.value = lr > 0 ? lr : ''; renderSched(); }
        };
        unitSel.addEventListener('change', onUnit);
        // التأمين: كتابة مبلغ تجعل الحالة «محتفظ به» تلقائيًا (كانت تبقى «بدون تأمين» فلا يظهر في التأمينات المحتفظ بها)
        let depAuto = false;
        dep.addEventListener('input', () => { const n = U().toNum(dep.value) || 0; if (n > 0 && depSt.value === 'none') { depSt.value = 'held'; depAuto = true; } else if (!n && depAuto && depSt.value === 'held') { depSt.value = 'none'; depAuto = false; } });
        depSt.addEventListener('change', () => { depAuto = false; });
        schedBox = h('div', { class: 'full' });
        const renderSched = () => {
          UI().clear(schedBox);
          const tmp = Object.assign({}, rec, { start: start.value, end: end.value, rent: U().toNum(rent.value) || 0, increasePct: U().toNum(inc.value) || 0, rentOverrides: overrides });
          const sch = En().schedule(tmp);
          if (!sch.length || !(U().toNum(rent.value) > 0)) { schedBox.appendChild(h('div', { class: 'muted small' }, 'أدخل التواريخ والإيجار لعرض جدول سنوات العقد')); return; }
          schedBox.appendChild(h('h4', { style: { marginBottom: '6px' } }, 'جدول سنوات العقد (الإيجار الشهري لكل سنة — يمكن تعديل أي سنة يدويًا)'));
          const tbl = h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, 'السنة'), h('th', null, 'من'), h('th', null, 'إلى'), h('th', { class: 'num' }, 'الإيجار الشهري'), h('th', null, ''))),
            h('tbody', null, sch.map(y => { const inp = h('input', { type: 'number', value: y.rent, style: { width: '120px', height: '32px' }, name: '_ov' + y.k, onchange: () => { const v = U().toNum(inp.value); if (v == null) delete overrides[y.k]; else overrides[y.k] = v; renderSched(); } }); return h('tr', null, h('td', null, 'السنة ' + y.k), h('td', null, U().fmtDate(y.from)), h('td', null, U().fmtDate(y.to)), h('td', { class: 'num' }, inp), h('td', null, overrides[y.k] != null ? h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { delete overrides[y.k]; renderSched(); } }, 'تلقائي') : h('span', { class: 'muted small' }, 'تلقائي'))); })));
          schedBox.appendChild(h('div', { class: 'tbl-wrap' }, tbl));
        };
        [end, rent, inc].forEach(el => el.addEventListener('input', renderSched));
        setTimeout(renderSched, 0);
        const unitPick = searchable(unitSel, unitHay, 'ابحث برقم الوحدة أو الكود أو المشروع أو المستأجر…'); unitPick.appendChild(unitHelp);
        const clientPick = searchable(clientSel, clientHay, 'ابحث بالاسم أو الكود أو التليفون أو الرقم القومي…', { label: (t) => `تسجيل «${t}» عميلًا جديدًا`, run: (t) => addClient(t) });
        const rentField = field('الإيجار الشهري (السنة الأولى)', rent, { req: true }); rentField.appendChild(rentHelp);
        setTimeout(() => { if (unitSel.value && form.isConnected !== false) onUnit(); }, 0); // الوحدة الجاهزة (من بروفايلها): حالتها وآخر إيجار
        return [
          field('الوحدة', unitPick, { req: true }),
          field('العميل', h('div', { class: 'flex', style: { alignItems: 'flex-start' } }, h('div', { class: 'grow' }, clientPick), newClient), { req: true }),
          field('بداية العقد', start, { req: true }),
          field('نهاية العقد', end, { req: true, help: renewing ? `تُقترح بنفس مدة العقد السابق (${autoMonths} شهرًا)` : 'تُقترح سنة من البداية تلقائيًا' }),
          rentField,
          field('الزيادة السنوية %', inc, { help: 'تُطبَّق في ذكرى بداية العقد كل سنة' }),
          field('التأمين', dep),
          field('حالة التأمين', depSt, { help: 'تصبح «محتفظ به» تلقائيًا عند كتابة مبلغ التأمين' }),
          field('يوم الاستحقاق في الشهر', dueDay),
          field('العقد السابق على نفس الوحدة', prevSel, { help: 'للتجديدات — يربط التاريخ' }),
          field('ملاحظات', textarea('notes', rec.notes), { full: true }),
          schedBox,
        ];
      },
      // المؤشر على أول خانة ناقصة: العميل لو الوحدة جاهزة، والوحدة لو العميل جاهز، وإلا الإيجار
      afterMount: () => { const { unitSel, clientSel, rent, start } = refs; if (!isNew) return; if (unitSel.value && !clientSel.value) focusFirst(clientSel._pickBox); else if (clientSel.value && !unitSel.value) focusFirst(unitSel._pickBox); else if (unitSel.value && clientSel.value) focusFirst(rent, start); },
      onSave: (v) => {
        if (v.clientCode === '__new') v.clientCode = '';
        const r = Object.assign({}, rec, v, { rentOverrides: overrides, code: isNew ? C().nextContract(S().state()) : rec.code, createdAt: rec.createdAt || now() });
        if (r.increasePct === '') r.increasePct = 0; if (r.deposit === '') r.deposit = 0; if (r.dueDay === '') r.dueDay = 1;
        // مبلغ تأمين مكتوب مع «بدون تأمين» ⇒ «محتفظ به» (عقد جديد أو مبلغ تغيّر)، وعقد جديد بلا مبلغ لا يُسجَّل «محتفظ به»
        const depN = U().toNum(r.deposit) || 0;
        if (depN > 0 && r.depositStatus === 'none' && (isNew || depN !== (U().toNum(rec.deposit) || 0))) r.depositStatus = 'held';
        if (isNew && !depN && r.depositStatus === 'held') r.depositStatus = 'none';
        const errors = M().validate('contracts', r, S().state()); if (errors.length) return { errors };
        const cl = S().client(r.clientCode) || {}, u = S().unit(r.unitCode) || {};
        S().upsert('contracts', r, `${cl.name || ''} / ${u.label || ''}`); UI().toast((isNew ? 'أُضيف العقد ' : 'عُدِّل العقد ') + r.code, 'ok');
        return { record: r };
      },
    });
  }

  /* ---------- دفعة / فاتورة ---------- */
  /* أول شهر مفتوح في العقد (متأخر/جزئي/مستحق/لم يُسجَّل/قادم) من بداية المحاسبة — الشهر الذي يُدفع عادةً عند الشباك */
  const OPEN_ST = ['late', 'partial', 'due', 'pending', 'upcoming', 'advance'];
  function openPeriod(c) {
    if (!c) return '';
    const s = U().d(c.start), e = U().d(c.end); if (!s || !e || e < s) return '';
    const tf = En().trackingFrom(), cur = U().periodOf(U().today()), last = U().periodOf(e);
    let from = U().periodOf(s); if (tf && U().cmp(from, tf) < 0) from = tf;
    let n = 0;
    for (const p of U().periods(from, last)) { if (++n > 600) break; if (OPEN_ST.includes(En().cell(c, p).status)) return p; }
    return U().cmp(cur, last) <= 0 && U().cmp(cur, U().periodOf(s)) >= 0 ? cur : '';
  }
  /* توزيع مبلغ على الشهور من الشهر المختار: كل شهر يأخذ المتبقي عليه، والزيادة بعد نهاية العقد تُضاف لآخر شهر */
  function allocate(c, period, amount) {
    const out = []; let left = amount, p = period;
    for (let i = 0; i < 240 && left > 0.004; i++, p = U().addMonths(p, 1)) {
      const ci = En().cell(c, p); if (!ci.due) break;
      const rem = Math.max(0, U().round2(ci.due.amount - ci.paid)); if (!rem) continue;
      const take = Math.min(left, rem); out.push({ period: p, amount: U().round2(take) }); left = U().round2(left - take);
    }
    if (left > 0.004) { if (out.length) out[out.length - 1].amount = U().round2(out[out.length - 1].amount + left); else out.push({ period, amount: U().round2(left) }); }
    return out;
  }
  const bumpCode = (code, k) => String(code).replace(/(\d+)$/, m => U().pad(+m + k, m.length));
  /* defaults: contractCode / period / amount، أو clientCode (من بروفايل العميل): القائمة تُقصر على عقوده، وعقد واحد يُثبَّت */
  function payment(rec, defaults) {
    if (!guard('edit')) return Promise.resolve(null);
    const isNew = !rec; const st = S().state();
    defaults = Object.assign({}, defaults || {});
    const onlyClient = isNew && defaults.clientCode && !defaults.contractCode ? defaults.clientCode : ''; delete defaults.clientCode;
    if (onlyClient) { const own = S().contractsOfClient(onlyClient), act = own.filter(c => En().contractStatus(c) === 'active'); if (act.length === 1 || own.length === 1) defaults.contractCode = (act.length === 1 ? act[0] : own[0]).code; }
    if (isNew && defaults.contractCode && !defaults.period) defaults.period = openPeriod(S().contract(defaults.contractCode));
    rec = rec || Object.assign(M().blank.payments(), { paidOn: now(), method: 'cash', source: 'web' }, defaults);
    const fixedContract = !!(defaults.contractCode || !isNew);
    let overFor = '', group = null; // تأكيد «المبلغ أكبر من المتبقي» مرة واحدة لنفس المبلغ والشهر؛ group = الفواتير المسجَّلة معًا (التوزيع على شهور)
    const refs = {};
    const remOf = (c, period) => { const ci = En().cell(c, period); if (!ci.due) return null; const own = !isNew && rec.contractCode === c.code && rec.period === period ? (U().toNum(rec.amount) || 0) : 0; return { ci, rem: Math.max(0, ci.due.amount - (ci.paid - own)), paidOthers: ci.paid - own }; };
    return openForm({
      title: isNew ? 'تسجيل دفعة (فاتورة إلكترونية)' : 'تعديل الفاتورة ' + rec.code,
      restore: (vals) => isNew ? payment(null, Object.assign({}, defaults, vals, { contractCode: fixedContract ? rec.contractCode : vals.contractCode })) : payment(Object.assign({}, rec, vals)),
      altSave: isNew ? { text: 'حفظ وطباعة الفاتورة', icon: 'print', id: 'btn-save-print', after: (r) => invoice(r, group) } : null,
      body: () => {
        // العقود: اسم العميل والوحدة أولًا (الكود في الآخر)، والسارية في مجموعة مستقلة أولًا
        const cLabel = c => { const cl = S().client(c.clientCode) || {}, u = S().unit(c.unitCode) || {}, pr = S().project(u.projectCode) || {}; return `${cl.name || '—'} — ${u.label || c.unitCode}${pr.name ? ' (' + pr.name + ')' : ''} — ${c.code} — ${U().fmtDate(c.start)} → ${U().fmtDate(c.end)}`; };
        const sorted = (onlyClient ? S().contractsOfClient(onlyClient).slice() : st.contracts.slice()).sort((a, b) => U().cmp(b.start, a.start));
        const act = sorted.filter(c => En().contractStatus(c) === 'active'), rest = sorted.filter(c => En().contractStatus(c) !== 'active');
        const cOpts = [act.length ? { group: `عقود سارية (${act.length})`, items: act.map(c => ({ value: c.code, label: cLabel(c) })) } : null, rest.length ? { group: `عقود منتهية أو لم تبدأ (${rest.length})`, items: rest.map(c => ({ value: c.code, label: cLabel(c) })) } : null].filter(Boolean);
        const contractSel = select('contractCode', [{ value: '', label: '— اختر العقد —' }].concat(cOpts), rec.contractCode, fixedContract ? { disabled: true } : null);
        const period = input('period', rec.period, { type: 'month', dir: 'ltr' });
        const amount = number('amount', rec.amount || '', { min: 0 });
        const hint = h('div', { class: 'help' });
        // الدفعة عن أكثر من شهر: خانة «وزّع الزيادة على الشهور التالية» مع معاينة الشهور
        const spread = h('input', { type: 'checkbox', name: '_spread', id: 'f_spread' });
        const spreadPrev = h('div', { class: 'help spread-preview' });
        const spreadBox = h('div', { class: 'field full spread-box hidden', dataset: { field: 'spread' } }, h('label', { class: 'check' }, spread, ' وزّع الزيادة على الشهور التالية (فاتورة لكل شهر)'), spreadPrev);
        Object.assign(refs, { contractSel, period, amount, spread });
        let autoAmount = isNew && !rec.amount; // المبلغ المقترح يتبع العقد/الشهر ما دام المستخدم لم يكتبه
        amount.addEventListener('input', () => { autoAmount = false; });
        const upd = () => {
          const c = S().contract(contractSel.value); hint.classList.remove('warn'); spreadBox.classList.add('hidden');
          if (c && isNew && !period.value) { const op = openPeriod(c); if (op) period.value = op; } // عقد اختير بلا شهر ⇒ أول شهر مفتوح
          if (!c || !/^\d{4}-\d{2}$/.test(period.value)) { hint.textContent = ''; return; }
          const r0 = remOf(c, period.value), ci = r0 ? r0.ci : En().cell(c, period.value), rem = r0 ? r0.rem : 0, paidPrev = r0 ? r0.paidOthers : ci.paid;
          if (!ci.due) hint.textContent = 'الشهر خارج مدة العقد';
          else if (!rem && paidPrev > 0) { hint.textContent = `المستحق للشهر ${U().fmtMoney(ci.due.amount)} — المسدَّد سابقًا ${U().fmtMoney(paidPrev)} — هذا الشهر مسدَّد بالكامل، تأكد قبل تسجيل دفعة أخرى`; hint.classList.add('warn'); }
          else hint.textContent = `المستحق للشهر ${U().fmtMoney(ci.due.amount)} — المسدَّد سابقًا ${U().fmtMoney(paidPrev)} — المتبقي ${U().fmtMoney(rem)}`;
          if (autoAmount) amount.value = rem > 0 ? rem : ''; // شهر مسدَّد بالكامل: لا نقترح مبلغًا (حتى لا يُسجَّل مرتين بنقرة «حفظ»)
          const a = U().toNum(amount.value) || 0;
          if (ci.due && a > rem + En().tolerance(ci.due.amount)) {
            hint.textContent = `المبلغ أكبر من المتبقي لهذا الشهر (${U().fmtMoney(rem)}) بـ ${U().fmtMoney(a - rem)} — هل الدفعة عن أكثر من شهر؟`; hint.classList.add('warn');
            if (isNew) { spreadBox.classList.remove('hidden'); const parts = allocate(c, period.value, a); spreadPrev.textContent = parts.map(x => `${U().periodLabel(x.period, true)}: ${U().fmtMoney(x.amount)}`).join(' · '); }
          }
        };
        contractSel.addEventListener('change', upd); period.addEventListener('change', upd); amount.addEventListener('input', upd); setTimeout(upd, 0);
        return [
          field('العقد', fixedContract ? h('div', null, contractSel, h('input', { type: 'hidden', name: 'contractCode', value: rec.contractCode })) : searchable(contractSel, contractHay, 'ابحث باسم العميل أو الوحدة أو كود العقد…'), { req: true, full: true }),
          field('الشهر', period, { req: true, help: hint }),
          field('المبلغ', amount, { req: true }),
          spreadBox,
          field('تاريخ السداد', date('paidOn', rec.paidOn, { min: '2000-01-01', max: U().iso(U().addDays(U().today(), 31)) })),
          field('طريقة السداد', select('method', listOpts(M().PAY_METHODS), rec.method || 'cash')),
          field('مرجع / رقم إيصال', input('ref', rec.ref, { dir: 'ltr' })),
          field('رقم الفاتورة', input('_code', isNew ? 'يُولَّد تلقائيًا' : rec.code, { disabled: true })),
          field('ملاحظات', textarea('notes', rec.notes), { full: true }),
        ];
      },
      onSave: (v) => {
        const r = Object.assign({}, rec, v, { source: 'web', createdAt: rec.createdAt || now() });
        if (fixedContract) r.contractCode = rec.contractCode;
        r.code = isNew ? C().nextInvoice(S().state(), (r.period || String(U().today().getUTCFullYear())).slice(0, 4)) : rec.code;
        const errors = M().validate('payments', r, S().state()); if (errors.length) return { errors };
        const c = S().contract(r.contractCode), cl = c ? S().client(c.clientCode) : null;
        const amt = U().toNum(r.amount) || 0, r0 = c ? remOf(c, r.period) : null;
        const over = r0 && r0.ci.due && (isNew || amt !== (U().toNum(rec.amount) || 0) || r.period !== rec.period) && amt > r0.rem + En().tolerance(r0.ci.due.amount);
        // توزيع على عدة شهور: فاتورة لكل شهر بنفس التاريخ والطريقة والمرجع — كلها في كتابة واحدة
        if (over && isNew && refs.spread && refs.spread.checked) {
          const parts = allocate(c, r.period, amt);
          if (parts.length > 1) {
            const seq = {}, recs = [];
            for (const part of parts) {
              const y = part.period.slice(0, 4);
              const code = seq[y] ? bumpCode(seq[y].first, ++seq[y].k) : (seq[y] = { first: C().nextInvoice(S().state(), y), k: 0 }).first;
              recs.push(Object.assign({}, r, { code, period: part.period, amount: part.amount, notes: (r.notes ? r.notes + ' — ' : '') + `جزء من دفعة واحدة ${U().fmtMoney(amt)} عن ${parts.length} شهور` }));
            }
            for (const x of recs) { const e = M().validate('payments', x, S().state()); if (e.length) return { errors: e }; }
            S().batch(recs.map(x => ({ type: 'upsert', entity: 'payments', code: x.code, record: x, summary: `${cl ? cl.name : ''} — ${U().periodLabel(x.period, true)} — ${U().fmtMoney(x.amount)}` })));
            group = recs;
            UI().toast(`سُجِّلت ${recs.length} دفعات (${recs[0].code} … ${recs[recs.length - 1].code}) — ${U().fmtMoney(amt)} من ${U().periodLabel(recs[0].period, true)} إلى ${U().periodLabel(recs[recs.length - 1].period, true)}`, 'ok', 6000);
            return { record: recs[0] };
          }
        }
        if (over && overFor !== r.contractCode + '|' + r.period + '|' + amt) {
          overFor = r.contractCode + '|' + r.period + '|' + amt;
          return { errors: [`المبلغ أكبر من المتبقي لشهر ${U().periodLabel(r.period, true)} (${U().fmtMoney(r0.rem)}) بـ ${U().fmtMoney(amt - r0.rem)} — ${isNew ? 'لو الدفعة عن أكثر من شهر علّم «وزّع الزيادة على الشهور التالية»، أو ' : ''}اضغط حفظ مرة أخرى لتسجيلها كلها على هذا الشهر`] };
        }
        group = null;
        S().upsert('payments', r, `${cl ? cl.name : ''} — ${U().periodLabel(r.period, true)} — ${U().fmtMoney(r.amount)}`);
        UI().toast(h('span', { class: 'toast-msg' }, (isNew ? 'سُجِّلت الدفعة ' : 'عُدِّلت الدفعة ') + r.code, ' ', h('button', { class: 'btn sm toast-act', type: 'button', onclick: (e) => { const t = e.currentTarget.closest('.toast'); if (t) t.remove(); invoice(S().get('payments', r.code) || r); } }, UI().icon('print'), 'الفاتورة')), 'ok', 6000);
        return { record: r };
      },
    });
  }

  /* ---------- صيانة ---------- */
  function maintenance(rec, defaults) {
    if (!guard('edit')) return Promise.resolve(null);
    const isNew = !rec; const st = S().state();
    rec = rec || Object.assign(M().blank.maintenance(), { date: now(), status: 'open', borneBy: 'owner', kind: 'other' }, defaults || {});
    let descEl = null;
    return openForm({
      title: isNew ? 'طلب صيانة / إصلاح جديد' : 'تعديل صيانة ' + rec.code,
      restore: (vals) => maintenance(isNew ? null : Object.assign({}, rec, vals), isNew ? Object.assign({}, defaults || {}, vals) : null),
      afterMount: () => { if (isNew && rec.unitCode && descEl) focusFirst(descEl); }, // الوحدة جاهزة (من بروفايلها): المؤشر على الوصف مباشرة
      body: () => {
        const unitSel = select('unitCode', [{ value: '', label: '— اختر الوحدة —' }].concat(unitOptions(st)), rec.unitCode);
        const dateEl = date('date', rec.date, { min: '2000-01-01', max: U().iso(U().addDays(U().today(), 365)) });
        const cust = h('div', { class: 'help' });
        const upd = () => { const u = S().unit(unitSel.value); if (!u || !U().d(dateEl.value)) { cust.textContent = ''; return; } const c = En().activeContractOf(u.code, U().d(dateEl.value)); cust.textContent = c ? `في عهدة: ${(S().client(c.clientCode) || {}).name} (${c.code})` : 'الوحدة كانت شاغرة في هذا التاريخ'; };
        unitSel.addEventListener('change', upd); dateEl.addEventListener('change', upd); setTimeout(upd, 0);
        descEl = textarea('description', rec.description, { placeholder: 'مثال: تسريب في حوض المطبخ' });
        return [
          field('الوحدة', searchable(unitSel, unitHay, 'ابحث برقم الوحدة أو الكود أو المستأجر…'), { req: true, help: cust }),
          field('الوصف', descEl, { req: true }),
          field('التاريخ', dateEl, { req: true }),
          field('النوع', select('kind', listOpts(M().MAINT_KINDS), rec.kind)),
          field('التكلفة', number('cost', rec.cost || '', { min: 0 })),
          field('يتحملها', select('borneBy', listOpts(M().BORNE_BY), rec.borneBy)),
          field('الحالة', select('status', listOpts(M().MAINT_STATUS), rec.status)),
          field('تاريخ الإغلاق', date('closedOn', rec.closedOn, { min: '2000-01-01', max: U().iso(U().addDays(U().today(), 31)) })),
          field('ملاحظات', textarea('notes', rec.notes), { full: true }),
        ];
      },
      onSave: (v) => {
        const r = Object.assign({}, rec, v, { code: isNew ? C().nextMaintenance(S().state()) : rec.code, createdAt: rec.createdAt || now() });
        if (r.cost === '') r.cost = 0;
        if (!r.custodianContract) { const uu = S().unit(r.unitCode); const cAt = uu ? En().activeContractOf(uu.code, U().d(r.date) || U().today()) : null; r.custodianContract = cAt ? cAt.code : ''; r.custodianName = cAt ? ((S().client(cAt.clientCode) || {}).name || '') : ''; }
        if (r.status === 'closed' && !r.closedOn) r.closedOn = r.date && U().d(r.date) && r.date > now() ? r.date : now();
        const errors = M().validate('maintenance', r, S().state()); if (errors.length) return { errors };
        const u = S().unit(r.unitCode) || {};
        S().upsert('maintenance', r, `${u.label || ''}: ${r.description.slice(0, 40)}`); UI().toast((isNew ? 'سُجِّلت الصيانة ' : 'عُدِّلت الصيانة ') + r.code, 'ok');
        return { record: r };
      },
    });
  }

  /* ---------- إغلاق طلب صيانة (التكلفة ومن يتحملها وتاريخ الإغلاق فقط) ---------- */
  function closeMaintenance(m0) {
    if (!guard('edit')) return Promise.resolve(null);
    const m = S().get('maintenance', m0.code) || m0, u = S().unit(m.unitCode) || {};
    const today = now(), minD = m.date && U().d(m.date) ? m.date : '2000-01-01';
    return openForm({
      title: 'إغلاق طلب الصيانة ' + m.code, saveText: 'إغلاق الطلب',
      body: () => [
        h('p', { class: 'full muted small' }, `${u.label || m.unitCode} — ${m.description || ''} (${U().fmtDate(m.date)})`),
        field('التكلفة النهائية', number('cost', m.cost || '', { min: 0 })),
        field('يتحملها', select('borneBy', listOpts(M().BORNE_BY), m.borneBy || 'owner')),
        field('تاريخ الإغلاق', date('closedOn', today < minD ? minD : today, { min: minD, max: U().iso(U().addDays(U().today(), 31)) })),
        field('ملاحظات', textarea('notes', m.notes), { full: true }),
      ],
      onSave: (v) => {
        const r = Object.assign(M().blank.maintenance(), m, v, { status: 'closed' });
        if (r.cost === '') r.cost = 0;
        if (!r.closedOn) r.closedOn = today < minD ? minD : today;
        const errors = M().validate('maintenance', r, S().state()); if (errors.length) return { errors };
        S().upsert('maintenance', r, `إغلاق: ${u.label || ''}: ${String(r.description || '').slice(0, 40)}`); UI().toast('أُغلق طلب الصيانة ' + r.code, 'ok');
        return { record: r };
      },
    });
  }

  /* ---------- إنهاء عقد مبكرًا: آخر يوم + حالة التأمين + سبب — تعديل للعقد يُسجَّل في سجل التعديلات (لا حذف للدفعات) ---------- */
  function terminate(c0) {
    if (!guard('edit')) return Promise.resolve(null);
    const c = S().contract(c0.code) || c0, cl = S().client(c.clientCode) || {}, u = S().unit(c.unitCode) || {};
    const today = now(), hasDep = (U().toNum(c.deposit) || 0) > 0;
    const def = U().cmp(today, c.start) < 0 ? c.start : U().cmp(today, c.end) > 0 ? c.end : today;
    let laterFor = '';
    return openForm({
      title: 'إنهاء العقد ' + c.code, saveText: 'إنهاء العقد',
      body: () => {
        const last = date('end', def, { min: c.start, max: c.end });
        const info = h('div', { class: 'help', id: 'terminate-info' });
        const upd = () => { const d = U().d(last.value); if (!d || d.getUTCFullYear() < 1900) { info.textContent = ''; return; } const p = U().periodOf(d); info.textContent = `الوحدة تصبح شاغرة من ${U().fmtDate(U().iso(U().addDays(d, 1)))} — إيجار ${U().periodLabel(p, true)} يُحسب بالأيام حتى آخر يوم، ولا تُستحق شهور بعده.`; };
        last.addEventListener('input', upd); last.addEventListener('change', upd); setTimeout(upd, 0);
        return [
          h('div', { class: 'full banner info terminate-head' }, UI().icon('info'), h('span', null, `${cl.name || '—'} — ${u.label || c.unitCode} — العقد من ${U().fmtDate(c.start)} إلى ${U().fmtDate(c.end)}`)),
          field('آخر يوم في العقد', last, { req: true, help: info }),
          hasDep ? field(`التأمين (${U().fmtMoney(c.deposit)})`, select('depositStatus', listOpts(M().DEPOSIT_STATUS).filter(o => o.value !== 'none'), c.depositStatus === 'held' || c.depositStatus === 'none' || !c.depositStatus ? 'returned' : c.depositStatus), { help: 'مردود للمستأجر، أو مخصوم (كله أو جزء منه)، أو ما زال محتفظًا به' }) : null,
          field('سبب الإنهاء / ملاحظات', textarea('reason', ''), { full: true }),
        ];
      },
      onSave: (v) => {
        const d = U().d(v.end);
        if (!d || d.getUTCFullYear() < 1900) return { errors: ['آخر يوم في العقد مطلوب'] };
        if (U().cmp(v.end, c.start) < 0) return { errors: [`آخر يوم قبل بداية العقد (${U().fmtDate(c.start)})`] };
        if (U().cmp(v.end, c.end) >= 0) return { errors: [`العقد ينتهي أصلًا في ${U().fmtDate(c.end)} — اختر يومًا قبله، أو استخدم «تجديد» للتمديد`] };
        const p = U().periodOf(d), later = S().paymentsOf(c.code).filter(x => U().cmp(x.period, p) > 0);
        if (later.length && laterFor !== v.end) { laterFor = v.end; return { errors: [`توجد دفعات مسجَّلة لشهور بعد آخر يوم: ${[...new Set(later.map(x => U().periodLabel(x.period, true)))].join('، ')} — ستظهر «خارج العقد» (لا تُحذف). اضغط «إنهاء العقد» مرة أخرى للتأكيد.`] }; }
        const note = `أُنهي مبكرًا في ${U().fmtDate(v.end)} (كان ينتهي ${U().fmtDate(c.end)})${v.reason ? ' — ' + v.reason : ''}`;
        const r = Object.assign(M().blank.contracts(), c, { end: v.end, depositStatus: hasDep ? (v.depositStatus || c.depositStatus) : c.depositStatus, notes: c.notes ? c.notes + ' | ' + note : note });
        const errors = M().validate('contracts', r, S().state()); if (errors.length) return { errors };
        S().upsert('contracts', r, `إنهاء مبكر: ${cl.name || ''} / ${u.label || ''} — آخر يوم ${U().fmtDate(v.end)} (كان ${U().fmtDate(c.end)})${hasDep ? ' — التأمين: ' + M().label(M().DEPOSIT_STATUS, r.depositStatus) : ''}`);
        UI().toast(`أُنهي العقد ${c.code} — الوحدة ${u.label || ''} شاغرة من ${U().fmtDate(U().iso(U().addDays(d, 1)))}`, 'ok', 5000);
        return { record: r };
      },
    });
  }

  /* ---------- الإعدادات ---------- */
  const SETTING_AR = { officeName: 'اسم المكتب', graceDays: 'أيام السماح', dueDay: 'يوم الاستحقاق الافتراضي', vacancyMonths: 'تنبيه الشغور الطويل بعد (شهور)', trackingFrom: 'بداية المحاسبة', defaultIncreasePct: 'الزيادة السنوية الافتراضية', invoicePrefix: 'بادئة رقم الفاتورة', currency: 'رمز العملة', enteredThrough: 'آخر شهر مسجَّل في كشف التحصيل', tolerancePct: 'فرق مقبول في السداد %', toleranceMin: 'الحد الأدنى للفرق المقبول' };
  function settings() {
    if (!guard('settings')) return Promise.resolve(null);
    const st = S().state(), sg = st.settings;
    return openForm({
      title: 'الإعدادات',
      body: () => [
        field('اسم المكتب', input('officeName', st.meta.officeName), { full: true }),
        field('أيام السماح بعد الاستحقاق', number('graceDays', sg.graceDays, { min: 0, max: 60, step: 1 })),
        field('يوم الاستحقاق الافتراضي', number('dueDay', sg.dueDay, { min: 1, max: 28, step: 1 })),
        field('تنبيه الشغور الطويل بعد (شهور)', number('vacancyMonths', sg.vacancyMonths, { min: 1, max: 24, step: 1 })),
        field('بداية المحاسبة (سنة-شهر)', input('trackingFrom', sg.trackingFrom, { dir: 'ltr', placeholder: '2026-01' }), { help: 'الشهور قبلها لا تُحاسَب' }),
        field('الزيادة السنوية الافتراضية %', number('defaultIncreasePct', sg.defaultIncreasePct, { min: 0, max: 100 })),
        field('بادئة رقم الفاتورة', input('invoicePrefix', sg.invoicePrefix, { dir: 'ltr' })),
        field('رمز العملة', input('currency', sg.currency)),
        field('آخر شهر مسجَّل في كشف التحصيل', input('enteredThrough', sg.enteredThrough, { dir: 'ltr', placeholder: 'تلقائي (مثال 2026-08)' }), { help: 'الشهور بعده تُعرض «لم يُسجَّل بعد» لا «متأخرة» (حتى لا تظهر متأخرات وهمية قبل إدخال كشف التحصيل). اتركه فارغًا ليُكتشف تلقائيًا من آخر شهر فيه تسجيل.' }),
        field('فرق مقبول في السداد %', number('tolerancePct', sg.tolerancePct, { min: 0, max: 10, step: '0.1' }), { help: 'يُقبل المبلغ كسداد كامل لو الفرق أقل من هذه النسبة من المستحق' }),
        field('الحد الأدنى للفرق المقبول (ج)', number('toleranceMin', sg.toleranceMin, { min: 0, step: 1 })),
      ],
      onSave: (v) => {
        const errors = [];
        // شهر حقيقي (01–12) وسنة منطقية؛ الأرقام العربية تُقبل (٢٠٢٦-٠١). شهر 13 أو سنة 2062 كانت تُصفّر المتأخرات بصمت
        const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/, curP = U().periodOf(U().today()), curY = +curP.slice(0, 4);
        v.trackingFrom = U().foldDigits(v.trackingFrom || '').trim(); v.enteredThrough = U().foldDigits(v.enteredThrough || '').trim();
        const minY = Math.min(curY, ...((sg.ledgerYears || []).map(Number).filter(n => n > 0))) - 1;
        if (!MONTH_RE.test(v.trackingFrom)) errors.push('بداية المحاسبة بصيغة سنة-شهر مثل 2026-01');
        else if (+v.trackingFrom.slice(0, 4) < minY || U().cmp(v.trackingFrom, curP) > 0) errors.push(`بداية المحاسبة بين ${minY}-01 والشهر الحالي ${curP}`);
        if (v.enteredThrough && !MONTH_RE.test(v.enteredThrough)) errors.push('آخر شهر مسجَّل بصيغة سنة-شهر مثل 2026-08 أو اتركه فارغًا');
        else if (v.enteredThrough && (U().cmp(v.enteredThrough, curP) > 0 || +v.enteredThrough.slice(0, 4) < minY)) errors.push(`آخر شهر مسجَّل لا يكون بعد الشهر الحالي (${curP}) ولا قبل ${minY} — أو اتركه فارغًا`);
        if (errors.length) return { errors };
        const before = Object.assign({}, sg, { officeName: st.meta.officeName }); // لمعرفة ما تغيّر فعلًا (سطر في سجل التعديلات)
        st.meta.officeName = v.officeName || st.meta.officeName; delete v.officeName;
        for (const k of ['graceDays', 'dueDay', 'vacancyMonths', 'defaultIncreasePct', 'tolerancePct', 'toleranceMin']) if (v[k] === '') delete v[k];
        if (v.trackingFrom && v.trackingFrom !== sg.trackingFrom) v.trackingMode = 'manual'; // المدير ثبّت البداية: لا تتحرك تلقائيًا مع ورقة سنة أقدم
        Object.assign(sg, v);
        S().notify('change');
        if (E.Sync && E.App && E.App.mode === 'linked') E.Sync.record({ type: 'settings', at: new Date().toISOString(), record: Object.assign({}, sg, { officeName: st.meta.officeName }) });
        // مَن غيّر الإعدادات وماذا غيّر: سطر في «سجل التعديلات» (وسجل العمليات) مثل بقية الكتابات
        try {
          const after = Object.assign({}, sg, { officeName: st.meta.officeName });
          const str = x => x == null ? '' : String(x);
          const changed = Object.keys(SETTING_AR).filter(k => str(before[k]) !== str(after[k]));
          if (changed.length) S().log({ action: 'تعديل', entity: 'الإعدادات', code: 'settings', summary: changed.map(k => `${SETTING_AR[k]}: ${str(before[k]) || '—'} ← ${str(after[k]) || '—'}`).join(' · ') });
        } catch (e) { /* السجل لا يمنع الحفظ */ }
        UI().toast('حُفظت الإعدادات', 'ok');
        return { record: sg };
      },
    });
  }

  /* ---------- الفاتورة الإلكترونية ---------- */
  /* group: فواتير سُجِّلت معًا من دفعة واحدة موزَّعة على عدة شهور — تُطبع في إيصال واحد بجدول الشهور */
  function invoice(p, group) {
    const c = S().contract(p.contractCode) || {}, cl = S().client(c.clientCode) || {}, u = S().unit(c.unitCode) || {}, pr = S().project(u.projectCode) || {};
    const st = S().state();
    const ci = c.code ? En().cell(c, p.period) : null;
    const multi = Array.isArray(group) && group.length > 1 ? group : null;
    const box = h('div', { class: 'invoice', id: 'invoice-print' },
      h('div', { class: 'inv-head' }, h('div', null, h('h2', null, st.meta.officeName || 'إيجاري'), h('div', { class: 'muted small' }, pr.address || '')), h('div', { style: { textAlign: 'left' } }, h('div', { class: 'bold' }, 'فاتورة إلكترونية'), h('div', { class: 'code', style: { fontSize: '14px' } }, p.code), h('div', { class: 'small' }, 'تاريخ: ' + (p.paidOn ? U().fmtDate(p.paidOn) : '—')))),
      h('table', null, h('tbody', null,
        h('tr', null, h('th', null, 'العميل'), h('td', null, `${cl.name || '—'} (${cl.code || ''})`), h('th', null, 'الرقم القومي / الضريبي'), h('td', { class: 'ltr' }, [cl.nationalId, cl.taxId].filter(Boolean).join(' / ') || '—')),
        h('tr', null, h('th', null, 'الوحدة'), h('td', null, `${u.label || '—'} — ${pr.name || ''} `, h('span', { class: 'nowrap' }, `(${u.code || ''})`)), h('th', null, 'العقد'), h('td', null, h('span', { class: 'nowrap' }, c.code || '—'), c.start || c.end ? h('span', { class: 'small' }, ' — من ', h('bdi', { class: 'nowrap' }, U().fmtDate(c.start)), ' إلى ', h('bdi', { class: 'nowrap' }, U().fmtDate(c.end))) : null)),
        h('tr', null, h('th', null, 'عن شهر'), h('td', null, multi ? `من ${U().periodLabel(multi[0].period, true)} إلى ${U().periodLabel(multi[multi.length - 1].period, true)} (${multi.length} شهور)` : U().periodLabel(p.period, true)), h('th', null, 'طريقة السداد'), h('td', null, M().label([{ key: '', ar: 'غير محدد' }].concat(M().PAY_METHODS), p.method || ''))),
        multi ? h('tr', null, h('th', null, 'مرجع'), h('td', { class: 'ltr', colspan: 3 }, p.ref || '—')) : h('tr', null, h('th', null, 'المستحق للشهر'), h('td', null, ci && ci.due ? U().fmtMoney(ci.due.amount) : '—'), h('th', null, 'مرجع'), h('td', { class: 'ltr' }, p.ref || '—')),
      )),
      multi ? h('table', { class: 'mt-s', id: 'invoice-months' }, h('thead', null, h('tr', null, h('th', null, 'الفاتورة'), h('th', null, 'عن شهر'), h('th', { class: 'num' }, 'المبلغ'))), h('tbody', null, multi.map(x => h('tr', null, h('td', null, h('span', { class: 'code' }, x.code)), h('td', null, U().periodLabel(x.period, true)), h('td', { class: 'num' }, U().fmtMoney(x.amount)))))) : null,
      h('div', { class: 'total' }, 'المبلغ المسدَّد: ' + U().fmtMoney(multi ? U().sum(multi, x => U().toNum(x.amount)) : p.amount)),
      p.notes ? h('p', { class: 'small mt-s' }, p.notes) : null,
      h('p', { class: 'small muted', style: { marginTop: '18px' } }, 'أُصدرت من نظام إيجاري — ' + U().fmtDateTime(new Date())),
    );
    const printBtn = h('button', { class: 'btn primary', onclick: () => { document.body.classList.add('printing'); window.print(); setTimeout(() => document.body.classList.remove('printing'), 500); } }, UI().icon('print'), 'طباعة / حفظ PDF');
    const editBtn = h('button', { class: 'btn', onclick: async () => { m.close(); const r = await payment(p); if (r) { if (E.App && E.App.render) E.App.render(); invoice(r); } } }, UI().icon('edit'), 'تعديل'); // الصفحة تحت الفاتورة تُعاد رسمها بالقيم الجديدة
    const m = UI().modal({ title: 'الفاتورة ' + (multi ? `${multi[0].code} … ${multi[multi.length - 1].code}` : p.code), size: 'doc', body: box, footer: [multi ? null : editBtn, printBtn] });
    return m;
  }

  /* ---------- كشف حساب عميل (قابل للطباعة): كل شهر مستحق منذ بداية المحاسبة مع المسدَّد والمتبقي، ثم الدفعات ---------- */
  function statement(c) {
    if (!c) return null;
    const st = S().state(), asOf = U().today(), cur = U().periodOf(asOf), tf = En().trackingFrom(); // بداية المحاسبة الفعلية (الإعداد أو سلايسر «المحاسبة من») لتطابق المتأخرات على الشاشة
    const cs = S().contractsOfClient(c.code).slice().sort((a, b) => U().cmp(a.start, b.start));
    const rows = [], pending = []; // pending: شهور بعد آخر شهر مسجَّل في المكتب — لا تُطبع على المستأجر ولا تدخل في الإجمالي
    for (const x of cs) {
      const u = S().unit(x.unitCode) || {}; const sD = U().d(x.start), eD = U().d(x.end); if (!sD || !eD) continue;
      const from = U().cmp(U().periodOf(sD), tf) > 0 ? U().periodOf(sD) : tf;
      const to = U().cmp(U().periodOf(eD), cur) < 0 ? U().periodOf(eD) : cur;
      if (U().cmp(from, to) > 0) continue;
      for (const pr of U().periods(from, to)) { const ci = En().cell(x, pr, asOf); if (ci.status === 'none' || ci.status === 'history' || ci.status === 'upcoming') continue; if (ci.status === 'pending') { pending.push(pr); continue; } rows.push({ period: pr, unit: u.label || x.unitCode, contract: x.code, due: ci.due ? ci.due.amount : 0, paid: ci.paid || 0, remaining: (ci.status === 'late' || ci.status === 'partial' || ci.status === 'due') ? ci.remaining : 0, status: ci.status }); }
    }
    rows.sort((a, b) => U().cmp(a.period, b.period) || U().cmp(a.contract, b.contract));
    const pays = cs.flatMap(x => S().paymentsOf(x.code)).sort((a, b) => U().cmp(a.paidOn || a.period, b.paidOn || b.period));
    const tDue = U().sum(rows, r => r.due), tPaid = U().sum(rows, r => r.paid), tRem = U().sum(rows, r => r.remaining);
    const td = (v, cls) => h('td', { class: cls || '' }, v);
    const box = h('div', { class: 'invoice statement', id: 'statement-print' },
      h('div', { class: 'inv-head' }, h('div', null, h('h2', null, st.meta.officeName || 'إيجاري'), h('div', { class: 'muted small' }, 'كشف حساب مستأجر')), h('div', { style: { textAlign: 'left' } }, h('div', { class: 'bold' }, c.name), h('div', { class: 'code', style: { fontSize: '14px' } }, c.code), h('div', { class: 'small' }, 'حتى ' + U().fmtDate(U().iso(asOf))), tf ? h('div', { class: 'small', id: 'statement-from' }, 'المحاسبة من: ' + U().periodLabel(tf, true)) : null)),
      h('table', null, h('tbody', null, h('tr', null, h('th', null, 'التليفون'), h('td', { class: 'ltr' }, c.phone || '—'), h('th', null, 'الرقم القومي / الضريبي'), h('td', { class: 'ltr' }, [c.nationalId, c.taxId].filter(Boolean).join(' / ') || '—')), h('tr', null, h('th', null, 'العقود'), h('td', { colspan: 3 }, cs.length ? h('div', { class: 'contracts-list' }, cs.map(x => h('div', null, h('span', { class: 'code' }, x.code), ' — ', (S().unit(x.unitCode) || {}).label || x.unitCode, ' — من ', h('bdi', { class: 'nowrap' }, U().fmtDate(x.start)), ' إلى ', h('bdi', { class: 'nowrap' }, U().fmtDate(x.end))))) : '—')))),
      h('h3', { class: 'mt' }, 'الاستحقاقات الشهرية'),
      h('table', { id: 'statement-months' }, h('thead', null, h('tr', null, h('th', null, 'الشهر'), h('th', null, 'الوحدة'), h('th', null, 'العقد'), h('th', { class: 'num' }, 'المستحق'), h('th', { class: 'num' }, 'المسدَّد'), h('th', { class: 'num' }, 'المتبقي'), h('th', null, 'الحالة'))),
        h('tbody', null, rows.length ? rows.map(r => h('tr', null, td(U().periodLabel(r.period, true)), td(r.unit), td(h('span', { class: 'code' }, r.contract)), td(U().fmtMoney(r.due), 'num'), td(U().fmtMoney(r.paid), 'num'), td(r.remaining ? U().fmtMoney(r.remaining) : '—', 'num'), td(En().STATUS_AR[r.status] || r.status))) : h('tr', null, h('td', { colspan: 7, class: 'muted' }, 'لا توجد استحقاقات مسجَّلة بعد'))),
        h('tfoot', null, h('tr', null, h('td', { colspan: 3 }, `الإجمالي (${rows.length} شهر)`), td(U().fmtMoney(tDue), 'num'), td(U().fmtMoney(tPaid), 'num'), td(U().fmtMoney(tRem), 'num'), h('td')))),
      h('h3', { class: 'mt' }, `الدفعات المسجَّلة (${pays.length})`),
      h('table', { id: 'statement-payments' }, h('thead', null, h('tr', null, h('th', null, 'الفاتورة'), h('th', null, 'تاريخ السداد'), h('th', null, 'عن شهر'), h('th', { class: 'num' }, 'المبلغ'), h('th', null, 'الطريقة'))), h('tbody', null, pays.map(p => h('tr', null, td(h('span', { class: 'code' }, p.code)), td(p.paidOn ? U().fmtDate(p.paidOn) : '—'), td(U().periodLabel(p.period, true)), td(U().fmtMoney(p.amount), 'num'), td(M().label([{ key: '', ar: 'غير محدد' }].concat(M().PAY_METHODS), p.method || '')))))),
      h('div', { class: 'total', id: 'statement-total' }, tRem ? 'إجمالي المتأخرات المستحقة: ' + U().fmtMoney(tRem) : 'لا توجد متأخرات مستحقة'),
      pending.length ? h('p', { class: 'small muted no-print', id: 'statement-pending' }, `للمكتب فقط (لا يُطبع): ${[...new Set(pending)].sort().map(p => U().periodLabel(p, true)).join('، ')} بعد آخر شهر مسجَّل في كشف التحصيل — لم تُراجَع بعد ولا تدخل في الإجمالي.`) : null,
      h('p', { class: 'small muted', style: { marginTop: '18px' } }, 'أُصدر من نظام إيجاري — ' + U().fmtDateTime(new Date())));
    const printBtn = h('button', { class: 'btn primary', onclick: () => { document.body.classList.add('printing'); window.print(); setTimeout(() => document.body.classList.remove('printing'), 500); } }, UI().icon('print'), 'طباعة / حفظ PDF');
    return UI().modal({ title: 'كشف حساب — ' + c.name, size: 'doc', body: box, footer: [printBtn] });
  }

  /* ---------- المستخدمون وكلمات المرور ---------- */
  function user(rec) {
    if (!guard('users')) return Promise.resolve(null);
    const isNew = !rec; rec = rec || M().blank.users();
    return openForm({
      title: isNew ? 'مستخدم جديد' : 'تعديل مستخدم ' + rec.code,
      body: () => [
        field('اسم المستخدم (للدخول)', input('code', rec.code, { placeholder: 'حروف لاتينية وأرقام', disabled: !isNew, dir: 'ltr', autocapitalize: 'off', spellcheck: false }), { req: true, help: isNew ? '3–24 حرفًا لاتينيًا أو أرقامًا بلا مسافات' : 'لا يتغيّر بعد الإنشاء' }),
        field('الاسم (يظهر في سجل التعديلات)', input('name', rec.name), { req: true }),
        field('الدور', select('role', listOpts(E.Auth.ROLES), rec.role), { req: true }),
        field('الحالة', select('enabled', [{ value: 'yes', label: 'مفعَّل' }, { value: 'no', label: 'معطَّل' }], rec.enabled === false ? 'no' : 'yes')),
        isNew ? field('كلمة المرور', input('password', '', { type: 'password', autocomplete: 'new-password' }), { req: true, help: '6 أحرف على الأقل' }) : null,
        isNew ? field('تأكيد كلمة المرور', input('password2', '', { type: 'password', autocomplete: 'new-password' }), { req: true }) : null,
        h('p', { class: 'small muted', style: { gridColumn: '1 / -1' } }, 'مدير: كل الصلاحيات · موظف: إدخال وتعديل، وحذف الدفعات والصيانة فقط (بلا إعدادات ولا مستخدمين) · مشاهدة فقط: بلا أي تعديل.'),
      ],
      onSave: async (v) => {
        if (isNew) { if (v.password !== v.password2) return { errors: ['تأكيد كلمة المرور غير مطابق'] }; const r = await E.Auth.createUser({ code: v.code, name: v.name, role: v.role, enabled: v.enabled !== 'no' }, v.password); if (!r.errors) UI().toast('أُضيف المستخدم ' + v.name, 'ok'); return r; }
        const r = E.Auth.updateUser(rec.code, { name: v.name, role: v.role, enabled: v.enabled !== 'no' }); if (!r.errors) UI().toast('حُفظ المستخدم', 'ok'); return r;
      },
    });
  }
  function changePassword(code, requireOld) {
    const u = E.Auth.find(code); if (!u) { UI().toast('المستخدم غير موجود', 'danger'); return Promise.resolve(null); }
    if (!requireOld && !guard('users')) return Promise.resolve(null);
    return openForm({
      title: requireOld ? 'تغيير كلمة المرور' : 'إعادة تعيين كلمة مرور ' + u.name, size: 'sm',
      body: () => [
        requireOld ? field('كلمة المرور الحالية', input('old', '', { type: 'password', autocomplete: 'current-password' }), { req: true, full: true }) : null,
        field('كلمة المرور الجديدة', input('password', '', { type: 'password', autocomplete: 'new-password' }), { req: true, full: true, help: '6 أحرف على الأقل' }),
        field('تأكيد كلمة المرور الجديدة', input('password2', '', { type: 'password', autocomplete: 'new-password' }), { req: true, full: true }),
      ],
      onSave: async (v) => { if (v.password !== v.password2) return { errors: ['تأكيد كلمة المرور غير مطابق'] }; const r = await E.Auth.setPassword(code, v.password, requireOld ? v.old : undefined); if (!r.errors) UI().toast('تم تغيير كلمة المرور', 'ok'); return r; },
    });
  }

  E.Forms = { project, unit, client, contract, payment, maintenance, closeMaintenance, terminate, settings, invoice, statement, user, changePassword, guard, field, input, select, number, date, textarea, listOpts, openPeriod, localPhone };
})(window.Egary);
