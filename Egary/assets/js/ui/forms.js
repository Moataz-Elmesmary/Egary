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
  function field(label, input, opts) {
    opts = opts || {};
    let echo = null;
    if (input.type === 'date') { // حقل التاريخ يعرض بصيغة المتصفح (قد تكون شهر/يوم): نعيد كتابته بصيغة البرنامج يوم/شهر/سنة
      echo = h('div', { class: 'help date-echo' });
      const upd = () => { echo.textContent = input.value ? '= ' + U().fmtDate(input.value) + ' (' + ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][U().d(input.value).getUTCDay()] + ')' : ''; };
      input.addEventListener('input', upd); input.addEventListener('change', upd); setTimeout(upd, 0);
    }
    return h('div', { class: 'field ' + (opts.full ? 'full' : ''), dataset: { field: input.name || '' } }, h('label', { for: input.id || null }, label, opts.req ? h('span', { class: 'req' }, ' *') : null), input, echo, opts.help ? h('div', { class: 'help' }, opts.help) : null);
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

  /* نافذة نموذج عامة: تُرجع Promise بالسجل المحفوظ أو null */
  function openForm(opts) {
    return new Promise(resolve => {
      let saved = null;
      const form = h('form', { class: 'form', novalidate: true, onsubmit: (e) => { e.preventDefault(); submit(); } });
      UI().append(form, [opts.body(form)]);
      const saveBtn = h('button', { class: 'btn primary', type: 'button', onclick: submit }, UI().icon('check'), opts.saveText || 'حفظ');
      const cancel = h('button', { class: 'btn', type: 'button', onclick: () => m.close() }, 'إلغاء');
      const m = UI().modal({ title: opts.title, size: opts.size || '', body: form, footer: [opts.extraFooter ? h('span', { class: 'start' }, opts.extraFooter) : null, cancel, saveBtn], sticky: true, onClose: () => resolve(saved) });
      async function submit() {
        const vals = read(form);
        const res = await opts.onSave(vals, form);
        if (res && res.errors && res.errors.length) { showErrors(form, res.errors); return; }
        saved = res && res.record ? res.record : (res || null);
        m.close();
      }
      if (opts.afterMount) opts.afterMount(form);
    });
  }
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
  function client(rec, defaults) {
    if (!guard('edit')) return Promise.resolve(null);
    const isNew = !rec; rec = rec || Object.assign(M().blank.clients(), defaults || {});
    let dupConfirmed = false, dupFor = ''; // تأكيد الرقم القومي المكرر: لمحاولة الحفظ التالية في هذا النموذج فقط (لا يُكتب على سجل المخزن)
    return openForm({
      title: isNew ? 'عميل جديد' : 'تعديل عميل ' + rec.code,
      body: () => [
        field('الاسم', input('name', rec.name), { req: true, full: true }),
        field('النوع', select('kind', listOpts(M().CLIENT_KINDS), rec.kind)),
        field('الممثل القانوني', input('rep', rec.rep), { help: 'للشركات، أو من يوقّع العقد' }),
        field('الرقم القومي / الباسبور', input('nationalId', rec.nationalId, { dir: 'ltr', inputmode: 'numeric' })),
        field('رقم التسجيل الضريبي', input('taxId', rec.taxId, { dir: 'ltr' })),
        field('التليفون', input('phone', rec.phone, { dir: 'ltr', inputmode: 'tel', placeholder: '01xxxxxxxxx' })),
        field('تليفون آخر', input('phone2', rec.phone2, { dir: 'ltr', inputmode: 'tel' })),
        field('البريد الإلكتروني', input('email', rec.email, { dir: 'ltr', type: 'email' })),
        field('العنوان', input('address', rec.address)),
        field('تفاصيل / ملاحظات', textarea('notes', rec.notes), { full: true }),
      ],
      onSave: (v) => {
        for (const k of ['nationalId', 'taxId', 'phone', 'phone2']) if (v[k]) v[k] = U().foldCode(v[k]).replace(/[^0-9A-Z+\-]/g, '');
        const r = Object.assign({}, rec, v, { code: isNew ? C().nextClient(S().state()) : rec.code, createdAt: rec.createdAt || now() });
        const errors = M().validate('clients', r, S().state()); if (errors.length) return { errors };
        const nid = U().foldCode(r.nationalId);
        const dup = r.nationalId ? S().state().clients.find(c => c.code !== r.code && U().foldCode(c.nationalId) === nid) : null;
        if (dup && !(dupConfirmed && dupFor === nid)) { dupConfirmed = true; dupFor = nid; return { errors: [`هذا الرقم القومي/الباسبور مسجَّل للعميل «${dup.name}» (${dup.code}) — اضغط حفظ مرة أخرى للتأكيد لو كان عميلًا مختلفًا فعلًا`] }; }
        S().upsert('clients', r, r.name); UI().toast((isNew ? 'أُضيف العميل ' : 'عُدِّل العميل ') + r.code, 'ok');
        return { record: r };
      },
    });
  }

  /* ---------- عقد ---------- */
  function unitOptions(st, current) {
    const asOf = U().today();
    return st.projects.map(p => ({ group: `${p.name} (${p.code})`, items: S().unitsOf(p.code).map(u => { const s = En().unitStatus(u, asOf); return { value: u.code, label: `${u.label} — ${u.code} — ${En().USTATUS_AR[s.status]}${s.contract && s.contract.code !== current ? ' (' + (S().client(s.contract.clientCode) || {}).name + ')' : ''}` }; }) })).filter(g => g.items.length);
  }
  function contract(rec, defaults) {
    if (!guard('edit')) return Promise.resolve(null);
    const isNew = !rec; const st = S().state();
    rec = rec || Object.assign(M().blank.contracts(), { increasePct: st.settings.defaultIncreasePct || 0, dueDay: st.settings.dueDay || 1, depositStatus: 'none' }, defaults || {});
    let schedBox, overrides = Object.assign({}, rec.rentOverrides || {});
    return openForm({
      title: isNew ? 'عقد جديد' : 'تعديل عقد ' + rec.code,
      size: 'lg',
      body: (form) => {
        const unitSel = select('unitCode', [{ value: '', label: '— اختر الوحدة —' }].concat(unitOptions(st, rec.code)), rec.unitCode);
        const clientSel = select('clientCode', [{ value: '', label: '— اختر العميل —' }].concat(st.clients.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar')).map(c => ({ value: c.code, label: `${c.name} (${c.code})` }))), rec.clientCode);
        const newClient = h('button', { class: 'btn sm', type: 'button', onclick: async () => { const c = await client(); if (c) { clientSel.appendChild(h('option', { value: c.code }, `${c.name} (${c.code})`)); clientSel.value = c.code; } } }, UI().icon('plus'), 'عميل جديد');
        const start = date('start', rec.start), end = date('end', rec.end);
        const rent = number('rent', rec.rent || '', { min: 0 }), inc = number('increasePct', rec.increasePct, { min: 0, max: 100, step: '0.5' });
        const dep = number('deposit', rec.deposit || '', { min: 0 }), depSt = select('depositStatus', listOpts(M().DEPOSIT_STATUS), rec.depositStatus);
        const dueDay = number('dueDay', rec.dueDay || 1, { min: 1, max: 28, step: 1 });
        const prevSel = select('prevCode', [{ value: '', label: '— بلا —' }], rec.prevCode);
        const fillPrev = () => { UI().clear(prevSel); prevSel.appendChild(h('option', { value: '' }, '— بلا (عقد جديد) —')); for (const c of S().contractsOfUnit(unitSel.value)) if (c.code !== rec.code) prevSel.appendChild(h('option', { value: c.code, selected: c.code === rec.prevCode ? true : null }, `${c.code} — ${(S().client(c.clientCode) || {}).name} (${U().fmtDate(c.start)} → ${U().fmtDate(c.end)})`)); };
        fillPrev(); unitSel.addEventListener('change', fillPrev);
        start.addEventListener('change', () => { if (start.value && !end.value) { const d = U().d(start.value); end.value = U().iso(U().addDays(new Date(Date.UTC(d.getUTCFullYear() + 1, d.getUTCMonth(), d.getUTCDate())), -1)); } renderSched(); });
        schedBox = h('div', { class: 'full' });
        const renderSched = () => {
          UI().clear(schedBox);
          const tmp = Object.assign({}, rec, { start: start.value, end: end.value, rent: U().toNum(rent.value) || 0, increasePct: U().toNum(inc.value) || 0, rentOverrides: overrides });
          const sch = En().schedule(tmp);
          if (!sch.length) { schedBox.appendChild(h('div', { class: 'muted small' }, 'أدخل التواريخ والإيجار لعرض جدول سنوات العقد')); return; }
          schedBox.appendChild(h('h4', { style: { marginBottom: '6px' } }, 'جدول سنوات العقد (الإيجار الشهري لكل سنة — يمكن تعديل أي سنة يدويًا)'));
          const tbl = h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, 'السنة'), h('th', null, 'من'), h('th', null, 'إلى'), h('th', { class: 'num' }, 'الإيجار الشهري'), h('th', null, ''))),
            h('tbody', null, sch.map(y => { const inp = h('input', { type: 'number', value: y.rent, style: { width: '120px', height: '32px' }, name: '_ov' + y.k, onchange: () => { const v = U().toNum(inp.value); if (v == null) delete overrides[y.k]; else overrides[y.k] = v; renderSched(); } }); return h('tr', null, h('td', null, 'السنة ' + y.k), h('td', null, U().fmtDate(y.from)), h('td', null, U().fmtDate(y.to)), h('td', { class: 'num' }, inp), h('td', null, overrides[y.k] != null ? h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { delete overrides[y.k]; renderSched(); } }, 'تلقائي') : h('span', { class: 'muted small' }, 'تلقائي'))); })));
          schedBox.appendChild(h('div', { class: 'tbl-wrap' }, tbl));
        };
        [end, rent, inc].forEach(el => el.addEventListener('input', renderSched));
        setTimeout(renderSched, 0);
        return [
          field('الوحدة', unitSel, { req: true }),
          field('العميل', h('div', { class: 'flex' }, h('div', { class: 'grow' }, clientSel), newClient), { req: true }),
          field('بداية العقد', start, { req: true }),
          field('نهاية العقد', end, { req: true, help: 'تُقترح سنة من البداية تلقائيًا' }),
          field('الإيجار الشهري (السنة الأولى)', rent, { req: true }),
          field('الزيادة السنوية %', inc, { help: 'تُطبَّق في ذكرى بداية العقد كل سنة' }),
          field('التأمين', dep),
          field('حالة التأمين', depSt),
          field('يوم الاستحقاق في الشهر', dueDay),
          field('العقد السابق على نفس الوحدة', prevSel, { help: 'للتجديدات — يربط التاريخ' }),
          field('ملاحظات', textarea('notes', rec.notes), { full: true }),
          schedBox,
        ];
      },
      onSave: (v) => {
        const r = Object.assign({}, rec, v, { rentOverrides: overrides, code: isNew ? C().nextContract(S().state()) : rec.code, createdAt: rec.createdAt || now() });
        if (r.increasePct === '') r.increasePct = 0; if (r.deposit === '') r.deposit = 0; if (r.dueDay === '') r.dueDay = 1;
        const errors = M().validate('contracts', r, S().state()); if (errors.length) return { errors };
        const cl = S().client(r.clientCode) || {}, u = S().unit(r.unitCode) || {};
        S().upsert('contracts', r, `${cl.name || ''} / ${u.label || ''}`); UI().toast((isNew ? 'أُضيف العقد ' : 'عُدِّل العقد ') + r.code, 'ok');
        return { record: r };
      },
    });
  }

  /* ---------- دفعة / فاتورة ---------- */
  function payment(rec, defaults) {
    if (!guard('edit')) return Promise.resolve(null);
    const isNew = !rec; const st = S().state();
    defaults = defaults || {};
    rec = rec || Object.assign(M().blank.payments(), { paidOn: now(), method: 'cash', source: 'web' }, defaults);
    const fixedContract = !!(defaults.contractCode || !isNew);
    return openForm({
      title: isNew ? 'تسجيل دفعة (فاتورة إلكترونية)' : 'تعديل الفاتورة ' + rec.code,
      body: () => {
        const cOpts = st.contracts.slice().sort((a, b) => U().cmp(b.start, a.start)).map(c => { const cl = S().client(c.clientCode) || {}, u = S().unit(c.unitCode) || {}; return { value: c.code, label: `${c.code} — ${cl.name} — ${u.label} (${U().fmtDate(c.start)} → ${U().fmtDate(c.end)})` }; });
        const contractSel = select('contractCode', [{ value: '', label: '— اختر العقد —' }].concat(cOpts), rec.contractCode, fixedContract ? { disabled: true } : null);
        const period = input('period', rec.period, { type: 'month', dir: 'ltr' });
        const amount = number('amount', rec.amount || '', { min: 0 });
        const hint = h('div', { class: 'help' });
        const upd = () => { const c = S().contract(contractSel.value); if (!c || !/^\d{4}-\d{2}$/.test(period.value)) { hint.textContent = ''; return; } const ci = En().cell(c, period.value); hint.textContent = ci.due ? `المستحق للشهر ${U().fmtMoney(ci.due.amount)} — المسدَّد سابقًا ${U().fmtMoney(ci.paid)} — المتبقي ${U().fmtMoney(Math.max(0, ci.due.amount - ci.paid))}` : 'الشهر خارج مدة العقد'; if (isNew && !amount.value && ci.due) amount.value = Math.max(0, ci.due.amount - ci.paid) || ci.due.amount; };
        contractSel.addEventListener('change', upd); period.addEventListener('change', upd); setTimeout(upd, 0);
        return [
          field('العقد', fixedContract ? h('div', null, contractSel, h('input', { type: 'hidden', name: 'contractCode', value: rec.contractCode })) : contractSel, { req: true, full: true }),
          field('الشهر', period, { req: true, help: hint }),
          field('المبلغ', amount, { req: true }),
          field('تاريخ السداد', date('paidOn', rec.paidOn)),
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
        S().upsert('payments', r, `${cl ? cl.name : ''} — ${U().periodLabel(r.period, true)} — ${U().fmtMoney(r.amount)}`); UI().toast((isNew ? 'سُجِّلت الدفعة ' : 'عُدِّلت الدفعة ') + r.code, 'ok');
        return { record: r };
      },
    });
  }

  /* ---------- صيانة ---------- */
  function maintenance(rec, defaults) {
    if (!guard('edit')) return Promise.resolve(null);
    const isNew = !rec; const st = S().state();
    rec = rec || Object.assign(M().blank.maintenance(), { date: now(), status: 'open', borneBy: 'owner', kind: 'other' }, defaults || {});
    return openForm({
      title: isNew ? 'طلب صيانة / إصلاح جديد' : 'تعديل صيانة ' + rec.code,
      body: () => {
        const unitSel = select('unitCode', [{ value: '', label: '— اختر الوحدة —' }].concat(unitOptions(st)), rec.unitCode);
        const dateEl = date('date', rec.date);
        const cust = h('div', { class: 'help' });
        const upd = () => { const u = S().unit(unitSel.value); if (!u || !U().d(dateEl.value)) { cust.textContent = ''; return; } const c = En().activeContractOf(u.code, U().d(dateEl.value)); cust.textContent = c ? `في عهدة: ${(S().client(c.clientCode) || {}).name} (${c.code})` : 'الوحدة كانت شاغرة في هذا التاريخ'; };
        unitSel.addEventListener('change', upd); dateEl.addEventListener('change', upd); setTimeout(upd, 0);
        return [
          field('الوحدة', unitSel, { req: true, help: cust }),
          field('التاريخ', dateEl, { req: true }),
          field('النوع', select('kind', listOpts(M().MAINT_KINDS), rec.kind)),
          field('التكلفة', number('cost', rec.cost || '', { min: 0 })),
          field('الوصف', textarea('description', rec.description), { req: true, full: true }),
          field('يتحملها', select('borneBy', listOpts(M().BORNE_BY), rec.borneBy)),
          field('الحالة', select('status', listOpts(M().MAINT_STATUS), rec.status)),
          field('تاريخ الإغلاق', date('closedOn', rec.closedOn)),
          field('ملاحظات', textarea('notes', rec.notes), { full: true }),
        ];
      },
      onSave: (v) => {
        const r = Object.assign({}, rec, v, { code: isNew ? C().nextMaintenance(S().state()) : rec.code, createdAt: rec.createdAt || now() });
        if (r.cost === '') r.cost = 0;
        if (!r.custodianContract) { const uu = S().unit(r.unitCode); const cAt = uu ? En().activeContractOf(uu.code, U().d(r.date) || U().today()) : null; r.custodianContract = cAt ? cAt.code : ''; r.custodianName = cAt ? ((S().client(cAt.clientCode) || {}).name || '') : ''; }
        if (r.status === 'closed' && !r.closedOn) r.closedOn = now();
        const errors = M().validate('maintenance', r, S().state()); if (errors.length) return { errors };
        const u = S().unit(r.unitCode) || {};
        S().upsert('maintenance', r, `${u.label || ''}: ${r.description.slice(0, 40)}`); UI().toast((isNew ? 'سُجِّلت الصيانة ' : 'عُدِّلت الصيانة ') + r.code, 'ok');
        return { record: r };
      },
    });
  }

  /* ---------- الإعدادات ---------- */
  const SETTING_AR = { officeName: 'اسم المكتب', graceDays: 'أيام السماح', dueDay: 'يوم الاستحقاق الافتراضي', vacancyMonths: 'عتبة الشغور الطويل', trackingFrom: 'بداية المحاسبة', defaultIncreasePct: 'الزيادة السنوية الافتراضية', invoicePrefix: 'بادئة رقم الفاتورة', currency: 'رمز العملة', enteredThrough: 'آخر شهر مسجَّل في الورقة', tolerancePct: 'فرق مقبول في السداد %', toleranceMin: 'الحد الأدنى للفرق المقبول' };
  function settings() {
    if (!guard('settings')) return Promise.resolve(null);
    const st = S().state(), sg = st.settings;
    return openForm({
      title: 'الإعدادات',
      body: () => [
        field('اسم المكتب', input('officeName', st.meta.officeName), { full: true }),
        field('أيام السماح بعد الاستحقاق', number('graceDays', sg.graceDays, { min: 0, max: 60, step: 1 })),
        field('يوم الاستحقاق الافتراضي', number('dueDay', sg.dueDay, { min: 1, max: 28, step: 1 })),
        field('عتبة الشغور الطويل (شهور)', number('vacancyMonths', sg.vacancyMonths, { min: 1, max: 24, step: 1 })),
        field('بداية المحاسبة (سنة-شهر)', input('trackingFrom', sg.trackingFrom, { dir: 'ltr', placeholder: '2026-01' }), { help: 'الشهور قبلها لا تُحاسَب' }),
        field('الزيادة السنوية الافتراضية %', number('defaultIncreasePct', sg.defaultIncreasePct, { min: 0, max: 100 })),
        field('بادئة رقم الفاتورة', input('invoicePrefix', sg.invoicePrefix, { dir: 'ltr' })),
        field('رمز العملة', input('currency', sg.currency)),
        field('آخر شهر مسجَّل في الورقة', input('enteredThrough', sg.enteredThrough, { dir: 'ltr', placeholder: 'تلقائي (مثال 2026-08)' }), { help: 'الشهور بعده تُعرض «لم يُسجَّل بعد» لا «متأخرة» (حتى لا تظهر متأخرات وهمية قبل إدخال الورقة). اتركه فارغًا ليُكتشف تلقائيًا من آخر شهر فيه تسجيل.' }),
        field('فرق مقبول في السداد %', number('tolerancePct', sg.tolerancePct, { min: 0, max: 10, step: '0.1' }), { help: 'يُقبل المبلغ كسداد كامل لو الفرق أقل من هذه النسبة من المستحق' }),
        field('الحد الأدنى للفرق المقبول (ج)', number('toleranceMin', sg.toleranceMin, { min: 0, step: 1 })),
      ],
      onSave: (v) => {
        const errors = [];
        if (!/^\d{4}-\d{2}$/.test(v.trackingFrom)) errors.push('بداية المحاسبة بصيغة سنة-شهر مثل 2026-01');
        if (v.enteredThrough && !/^\d{4}-\d{2}$/.test(v.enteredThrough)) errors.push('آخر شهر مسجَّل بصيغة سنة-شهر مثل 2026-08 أو اتركه فارغًا');
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
  function invoice(p) {
    const c = S().contract(p.contractCode) || {}, cl = S().client(c.clientCode) || {}, u = S().unit(c.unitCode) || {}, pr = S().project(u.projectCode) || {};
    const st = S().state();
    const ci = c.code ? En().cell(c, p.period) : null;
    const box = h('div', { class: 'invoice', id: 'invoice-print' },
      h('div', { class: 'inv-head' }, h('div', null, h('h2', null, st.meta.officeName || 'إيجاري'), h('div', { class: 'muted small' }, pr.address || '')), h('div', { style: { textAlign: 'left' } }, h('div', { class: 'bold' }, 'فاتورة إلكترونية'), h('div', { class: 'code', style: { fontSize: '14px' } }, p.code), h('div', { class: 'small' }, 'تاريخ: ' + (p.paidOn ? U().fmtDate(p.paidOn) : '—')))),
      h('table', null, h('tbody', null,
        h('tr', null, h('th', null, 'العميل'), h('td', null, `${cl.name || '—'} (${cl.code || ''})`), h('th', null, 'الرقم القومي / الضريبي'), h('td', { class: 'ltr' }, [cl.nationalId, cl.taxId].filter(Boolean).join(' / ') || '—')),
        h('tr', null, h('th', null, 'الوحدة'), h('td', null, `${u.label || '—'} — ${pr.name || ''} (${u.code || ''})`), h('th', null, 'العقد'), h('td', null, `${c.code || '—'} (${U().fmtDate(c.start)} → ${U().fmtDate(c.end)})`)),
        h('tr', null, h('th', null, 'عن شهر'), h('td', null, U().periodLabel(p.period, true)), h('th', null, 'طريقة السداد'), h('td', null, M().label([{ key: '', ar: 'غير محدد' }].concat(M().PAY_METHODS), p.method || ''))),
        h('tr', null, h('th', null, 'المستحق للشهر'), h('td', null, ci && ci.due ? U().fmtMoney(ci.due.amount) : '—'), h('th', null, 'مرجع'), h('td', { class: 'ltr' }, p.ref || '—')),
      )),
      h('div', { class: 'total' }, 'المبلغ المسدَّد: ' + U().fmtMoney(p.amount)),
      p.notes ? h('p', { class: 'small mt-s' }, p.notes) : null,
      h('p', { class: 'small muted', style: { marginTop: '18px' } }, 'أُصدرت من نظام إيجاري — ' + U().fmtDateTime(new Date())),
    );
    const printBtn = h('button', { class: 'btn primary', onclick: () => { document.body.classList.add('printing'); window.print(); setTimeout(() => document.body.classList.remove('printing'), 500); } }, UI().icon('print'), 'طباعة / حفظ PDF');
    const editBtn = h('button', { class: 'btn', onclick: async () => { m.close(); const r = await payment(p); if (r) { if (E.App && E.App.render) E.App.render(); invoice(r); } } }, UI().icon('edit'), 'تعديل'); // الصفحة تحت الفاتورة تُعاد رسمها بالقيم الجديدة
    const m = UI().modal({ title: 'الفاتورة ' + p.code, size: 'lg', body: box, footer: [editBtn, printBtn] });
    return m;
  }

  /* ---------- كشف حساب عميل (قابل للطباعة): كل شهر مستحق منذ بداية المحاسبة مع المسدَّد والمتبقي، ثم الدفعات ---------- */
  function statement(c) {
    if (!c) return null;
    const st = S().state(), asOf = U().today(), cur = U().periodOf(asOf), tf = En().trackingFrom(); // بداية المحاسبة الفعلية (الإعداد أو سلايسر «المحاسبة من») لتطابق المتأخرات على الشاشة
    const cs = S().contractsOfClient(c.code).slice().sort((a, b) => U().cmp(a.start, b.start));
    const rows = [];
    for (const x of cs) {
      const u = S().unit(x.unitCode) || {}; const sD = U().d(x.start), eD = U().d(x.end); if (!sD || !eD) continue;
      const from = U().cmp(U().periodOf(sD), tf) > 0 ? U().periodOf(sD) : tf;
      const to = U().cmp(U().periodOf(eD), cur) < 0 ? U().periodOf(eD) : cur;
      if (U().cmp(from, to) > 0) continue;
      for (const pr of U().periods(from, to)) { const ci = En().cell(x, pr, asOf); if (ci.status === 'none' || ci.status === 'history' || ci.status === 'upcoming') continue; rows.push({ period: pr, unit: u.label || x.unitCode, contract: x.code, due: ci.due ? ci.due.amount : 0, paid: ci.paid || 0, remaining: (ci.status === 'late' || ci.status === 'partial' || ci.status === 'due') ? ci.remaining : 0, status: ci.status }); }
    }
    rows.sort((a, b) => U().cmp(a.period, b.period) || U().cmp(a.contract, b.contract));
    const pays = cs.flatMap(x => S().paymentsOf(x.code)).sort((a, b) => U().cmp(a.paidOn || a.period, b.paidOn || b.period));
    const tDue = U().sum(rows, r => r.due), tPaid = U().sum(rows, r => r.paid), tRem = U().sum(rows, r => r.remaining);
    const td = (v, cls) => h('td', { class: cls || '' }, v);
    const box = h('div', { class: 'invoice statement', id: 'statement-print' },
      h('div', { class: 'inv-head' }, h('div', null, h('h2', null, st.meta.officeName || 'إيجاري'), h('div', { class: 'muted small' }, 'كشف حساب مستأجر')), h('div', { style: { textAlign: 'left' } }, h('div', { class: 'bold' }, c.name), h('div', { class: 'code', style: { fontSize: '14px' } }, c.code), h('div', { class: 'small' }, 'حتى ' + U().fmtDate(U().iso(asOf))))),
      h('table', null, h('tbody', null, h('tr', null, h('th', null, 'التليفون'), h('td', { class: 'ltr' }, c.phone || '—'), h('th', null, 'الرقم القومي / الضريبي'), h('td', { class: 'ltr' }, [c.nationalId, c.taxId].filter(Boolean).join(' / ') || '—')), h('tr', null, h('th', null, 'العقود'), h('td', { colspan: 3 }, cs.map(x => `${x.code}: ${(S().unit(x.unitCode) || {}).label || x.unitCode} (${U().fmtDate(x.start)} → ${U().fmtDate(x.end)})`).join(' · ') || '—')))),
      h('h3', { class: 'mt' }, 'الاستحقاقات الشهرية'),
      h('table', { id: 'statement-months' }, h('thead', null, h('tr', null, h('th', null, 'الشهر'), h('th', null, 'الوحدة'), h('th', null, 'العقد'), h('th', { class: 'num' }, 'المستحق'), h('th', { class: 'num' }, 'المسدَّد'), h('th', { class: 'num' }, 'المتبقي'), h('th', null, 'الحالة'))),
        h('tbody', null, rows.length ? rows.map(r => h('tr', null, td(U().periodLabel(r.period, true)), td(r.unit), td(h('span', { class: 'code' }, r.contract)), td(U().fmtMoney(r.due), 'num'), td(U().fmtMoney(r.paid), 'num'), td(r.remaining ? U().fmtMoney(r.remaining) : '—', 'num'), td(En().STATUS_AR[r.status] || r.status))) : h('tr', null, h('td', { colspan: 7, class: 'muted' }, 'لا توجد استحقاقات مسجَّلة بعد'))),
        h('tfoot', null, h('tr', null, h('td', { colspan: 3 }, `الإجمالي (${rows.length} شهر)`), td(U().fmtMoney(tDue), 'num'), td(U().fmtMoney(tPaid), 'num'), td(U().fmtMoney(tRem), 'num'), h('td')))),
      h('h3', { class: 'mt' }, `الدفعات المسجَّلة (${pays.length})`),
      h('table', { id: 'statement-payments' }, h('thead', null, h('tr', null, h('th', null, 'الفاتورة'), h('th', null, 'تاريخ السداد'), h('th', null, 'عن شهر'), h('th', { class: 'num' }, 'المبلغ'), h('th', null, 'الطريقة'))), h('tbody', null, pays.map(p => h('tr', null, td(h('span', { class: 'code' }, p.code)), td(p.paidOn ? U().fmtDate(p.paidOn) : '—'), td(U().periodLabel(p.period, true)), td(U().fmtMoney(p.amount), 'num'), td(M().label([{ key: '', ar: 'غير محدد' }].concat(M().PAY_METHODS), p.method || '')))))),
      h('div', { class: 'total', id: 'statement-total' }, tRem ? 'إجمالي المتأخرات المستحقة: ' + U().fmtMoney(tRem) : 'لا توجد متأخرات مستحقة'),
      h('p', { class: 'small muted', style: { marginTop: '18px' } }, 'أُصدر من نظام إيجاري — ' + U().fmtDateTime(new Date())));
    const printBtn = h('button', { class: 'btn primary', onclick: () => { document.body.classList.add('printing'); window.print(); setTimeout(() => document.body.classList.remove('printing'), 500); } }, UI().icon('print'), 'طباعة / حفظ PDF');
    return UI().modal({ title: 'كشف حساب — ' + c.name, size: 'lg', body: box, footer: [printBtn] });
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

  E.Forms = { project, unit, client, contract, payment, maintenance, settings, invoice, statement, user, changePassword, guard, field, input, select, number, date, textarea, listOpts };
})(window.Egary);
