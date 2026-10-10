/* =====================================================================
   store.js — حاوية الحالة + الفهارس + العمليات (ops)
   كل تعديل = عملية { type:'upsert'|'delete', entity, code, record?, at, summary }
   تُطبَّق على الحالة، تُسجَّل في سجل التعديلات، ثم تُسلَّم لمحرّك المزامنة
   (الذي يكتب الإكسيل أو يُبقيها معلّقة لو الملف مقفول). الإعادة آمنة (idempotent).
   ===================================================================== */
window.Egary = window.Egary || {};
(function (E) {
  'use strict';
  const U = () => E.U, M = () => E.M;

  let STATE = M().emptyState();
  let IDX = null;
  let REV = 0; // رقم المراجعة: يزيد مع كل تغيير في الحالة (لإبطال ذاكرة المحرّك المؤقتة)
  const listeners = new Set();
  let recorder = null; // دالة تُستدعى بكل عملية (Sync.record)

  function load(state) { STATE = state; IDX = null; REV++; notify('load'); }
  function rev() { return REV; }
  function state() { return STATE; }
  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function notify(reason) { for (const fn of listeners) { try { fn(reason); } catch (e) { console.error(e); } } }
  function setRecorder(fn) { recorder = fn; }

  /* ---------- فهارس (تُبنى عند الطلب وتُبطَل مع كل تعديل) ---------- */
  function idx() {
    if (IDX) return IDX;
    const by = {};
    for (const ent of M().ENTITIES) { by[ent] = new Map(); for (const r of STATE[ent]) by[ent].set(U().foldCode(r.code), r); }
    const unitsByProject = U().groupBy(STATE.units, u => u.projectCode);
    const contractsByUnit = U().groupBy(STATE.contracts, c => c.unitCode);
    for (const arr of contractsByUnit.values()) arr.sort((a, b) => U().cmp(a.start, b.start));
    const contractsByClient = U().groupBy(STATE.contracts, c => c.clientCode);
    for (const arr of contractsByClient.values()) arr.sort((a, b) => U().cmp(a.start, b.start));
    const paymentsByContract = U().groupBy(STATE.payments, p => p.contractCode);
    const paymentsByCell = U().groupBy(STATE.payments, p => p.contractCode + '|' + p.period);
    const maintenanceByUnit = U().groupBy(STATE.maintenance, m => m.unitCode);
    for (const arr of maintenanceByUnit.values()) arr.sort((a, b) => U().cmp(b.date, a.date));
    const nextByPrev = new Map();
    for (const c of STATE.contracts) if (c.prevCode) nextByPrev.set(U().foldCode(c.prevCode), c);
    IDX = { by, unitsByProject, contractsByUnit, contractsByClient, paymentsByContract, paymentsByCell, maintenanceByUnit, nextByPrev, empty: [] };
    return IDX;
  }
  function get(entity, code) { return idx().by[entity].get(U().foldCode(code)) || null; }
  const project = c => get('projects', c), unit = c => get('units', c), client = c => get('clients', c), contract = c => get('contracts', c);
  function unitsOf(projectCode) { return idx().unitsByProject.get(projectCode) || idx().empty; }
  function contractsOfUnit(unitCode) { return idx().contractsByUnit.get(unitCode) || idx().empty; }
  function contractsOfClient(clientCode) { return idx().contractsByClient.get(clientCode) || idx().empty; }
  function paymentsOf(contractCode) { return idx().paymentsByContract.get(contractCode) || idx().empty; }
  function paymentsOfCell(contractCode, period) { return idx().paymentsByCell.get(contractCode + '|' + period) || idx().empty; }
  function maintenanceOf(unitCode) { return idx().maintenanceByUnit.get(unitCode) || idx().empty; }
  function nextContract(c) { return idx().nextByPrev.get(U().foldCode(c.code)) || null; }

  /* ---------- هوية السجل (مستقلة عن الكود) ----------
     تُستخدم عند إعادة تطبيق دفتر المزامنة: الكود نفسه قد يكون صدر مرتين (الموقع وهو مقفول، والإكسيل لصف كتبه المكتب) */
  function identityOf(entity, r) {
    const f = U().foldCode, n = U().normalize;
    switch (entity) {
      case 'payments': return f(r.contractCode) + '|' + String(r.period || '');
      case 'contracts': return f(r.unitCode) + '|' + String(r.start || '');
      case 'units': return f(r.projectCode) + '|' + n(r.label);
      case 'clients': return n(r.name) + '|' + f(r.nationalId || '');
      case 'projects': return n(r.name);
      case 'maintenance': return f(r.unitCode) + '|' + String(r.date || '') + '|' + n(r.description);
      default: return f(r.code); // المستخدمون: الكود هو الهوية
    }
  }
  /* نفس السجل؟ (للعميل: نفس الاسم، والرقم القومي يُقارَن فقط لو مسجَّل في الطرفين — المكتب قد يكمله في الإكسيل بعد تسجيل العميل من الموقع) */
  function sameIdentity(entity, a, b) {
    if (entity === 'clients') { const f = U().foldCode, n = U().normalize; return n(a.name) === n(b.name) && (!a.nationalId || !b.nationalId || f(a.nationalId) === f(b.nationalId)); }
    return identityOf(entity, a) === identityOf(entity, b);
  }
  /* الحقول التي اختلفت بين السجل الحالي والجديد (undefined = إنشاء) — تُحفظ في العملية حتى تُدمج عند الإعادة بدل الكتابة فوق السجل كله */
  function diffFields(existing, record) {
    if (!existing) return undefined;
    const keys = new Set([...Object.keys(existing), ...Object.keys(record)]);
    const out = [];
    for (const k of keys) { if (k === 'code' || k[0] === '_') continue; if (JSON.stringify(existing[k]) !== JSON.stringify(record[k])) out.push(k); }
    return out;
  }
  /* إعادة ترقيم سجل موجود (مع تحديث المراجع إليه) لأن كوده صدر أيضًا لسجل آخر من دفتر المزامنة */
  function recode(entity, rec) {
    const oldCode = rec.code, k = U().foldCode(oldCode);
    const code = E.Codes.nextCode(STATE, entity, rec); if (!code || U().foldCode(code) === k) return '';
    rec.code = code;
    const same = v => U().foldCode(v) === k;
    if (entity === 'projects') for (const u of STATE.units) if (same(u.projectCode)) u.projectCode = code;
    if (entity === 'units') { for (const c of STATE.contracts) if (same(c.unitCode)) c.unitCode = code; for (const m of STATE.maintenance) if (same(m.unitCode)) m.unitCode = code; }
    if (entity === 'clients') for (const c of STATE.contracts) if (same(c.clientCode)) c.clientCode = code;
    if (entity === 'contracts') { for (const p of STATE.payments) if (same(p.contractCode)) p.contractCode = code; for (const c of STATE.contracts) if (same(c.prevCode)) c.prevCode = code; for (const m of STATE.maintenance) if (same(m.custodianContract)) m.custodianContract = code; }
    try { E.Codes.noteIssued(STATE, entity, code); } catch (e) { }
    return code;
  }
  let LAST_REPLAY = { at: 0, recoded: [], merged: 0 };
  function replayReport() { return LAST_REPLAY; }

  /* ---------- تطبيق العمليات ----------
     opts.replay: إعادة من دفتر المزامنة (بعد قراءة الإكسيل من جديد):
       • upsert إنشاء (op.changed غير موجود وop.isNew ليس false) لسجل موجود بنفس الكود لكن بهوية مختلفة ⇒ تعارض أكواد: السجل الموجود (من الإكسيل) يُعاد ترقيمه ويبقى، وتُضاف عملية الموقع
       • upsert تعديل (op.changed قائمة) لسجل موجود ⇒ تُدمج الحقول المتغيرة فقط فوق السجل الحالي (تعديلات الإكسيل الأخرى تبقى)
       • تعديل من دفتر قديم (isNew=false بلا op.changed) ⇒ السجل كاملًا كما قبل (لا يُعدّ تعارضًا وإن تغيّر الشهر أو التاريخ)
       • سطر سجل تعديلات موجود بعينه ⇒ لا يُكرَّر
       • غير ذلك ⇒ السلوك العادي (العملية تكسب) */
  function applyOp(op, opts) {
    const replay = !!(opts && opts.replay);
    if (op && op.type === 'settings') return applySettingsOp(op);
    if (op && op.type === 'audit') {
      if (!op.record) return false;
      const r = op.record;
      if (replay && STATE.audit.some(a => a.at === r.at && a.action === r.action && a.code === r.code && a.user === r.user && a.summary === r.summary)) return false; // الإعادة لا تكرر سطر الدخول
      STATE.audit.unshift(Object.assign({}, r)); if (STATE.audit.length > 500) STATE.audit.length = 500; REV++; return true;
    }
    const list = STATE[op.entity];
    if (!list) return false;
    const k = U().foldCode(op.code);
    const i = list.findIndex(r => U().foldCode(r.code) === k);
    if (op.type === 'upsert') {
      const isEdit = Array.isArray(op.changed), creation = !isEdit && op.isNew !== false;
      const rec = Object.assign(M().blank[op.entity](), op.record, { code: op.code });
      if (i >= 0 && replay && isEdit) {
        const cur = Object.assign(M().blank[op.entity](), list[i]), blank = M().blank[op.entity]();
        for (const f of op.changed) cur[f] = op.record[f] === undefined ? blank[f] : U().clone(op.record[f]);
        cur.code = op.code; list[i] = cur; if (opts.report) opts.report.merged++;
      } else if (i >= 0 && replay && creation && !sameIdentity(op.entity, list[i], rec)) {
        const existing = list[i], oldCode = existing.code, newCode = recode(op.entity, existing);
        if (newCode) {
          const entry = { at: U().stamp(), action: 'تعديل', entity: M().ENTITY_AR[op.entity] || op.entity, code: newCode, summary: `تعارض أكواد عند المزامنة: الكود ${oldCode} صدر من الإكسيل لسجل (${identityOf(op.entity, existing)}) ومن الموقع لسجل آخر (${identityOf(op.entity, rec)}) — سجل الإكسيل أُعيد ترقيمه إلى ${newCode}`, user: currentUser() };
          STATE.audit.unshift(entry); if (STATE.audit.length > 500) STATE.audit.length = 500;
          try { if (E.Log) E.Log.append(entry); } catch (e) { }
          if (opts.report) opts.report.recoded.push({ entity: op.entity, from: oldCode, to: newCode, kept: op.code });
          list.push(rec);
        } else list[i] = rec; // تعذّر توليد كود (كيان بلا مولّد) ⇒ السلوك القديم
      } else if (i >= 0) list[i] = rec;
      else { list.push(rec); try { if (E.Codes) E.Codes.noteIssued(STATE, op.entity, op.code); } catch (e) { } }
    } else if (op.type === 'delete') {
      if (i >= 0) list.splice(i, 1);
    } else return false;
    IDX = null; REV++;
    return true;
  }
  function applySettingsOp(op) {
    if (!op || op.type !== 'settings' || !op.record) return false;
    const r = Object.assign({}, op.record);
    if (r.officeName) { STATE.meta.officeName = r.officeName; delete r.officeName; }
    Object.assign(STATE.settings, r);
    IDX = null; REV++;
    return true;
  }
  function applyOps(ops) { // إعادة تطبيق (من دفتر المزامنة) بلا تسجيل جديد؛ تقرير الإعادة (أكواد أُعيد ترقيمها) في replayReport()
    let n = 0; const report = { at: Date.now(), recoded: [], merged: 0 };
    for (const op of ops) if (applyOp(op, { replay: true, report })) n++;
    LAST_REPLAY = report;
    if (n) notify('replay');
    return n;
  }
  function audit(op) {
    const entry = { at: U().stamp(), action: op.type === 'delete' ? 'حذف' : (op.isNew ? 'إضافة' : 'تعديل'), entity: M().ENTITY_AR[op.entity] || op.entity, code: op.code, summary: op.summary || '', user: currentUser() };
    STATE.audit.unshift(entry);
    if (STATE.audit.length > 500) STATE.audit.length = 500;
    try { if (E.Log) E.Log.append(entry); } catch (e) { }
  }
  function currentUser() { try { const u = E.Auth && E.Auth.user(); return u ? u.name : ''; } catch (e) { return ''; } }
  /* سطر في سجل التعديلات بلا تغيير بيانات (مثل الدخول) — يمر بالمزامنة ليُكتب في الإكسيل */
  function log(entry) {
    const op = { type: 'audit', at: new Date().toISOString(), record: Object.assign({ at: U().stamp(), action: '', entity: '', code: '', summary: '', user: currentUser() }, entry) };
    applyOp(op); notify('change');
    try { if (E.Log) E.Log.append(op.record); } catch (e) { }
    if (recorder) recorder(op);
    return op;
  }
  /* الواجهة العامة: upsert/remove تُرجع العملية بعد تطبيقها وتسجيلها */
  function upsert(entity, record, summary) {
    const existing = get(entity, record.code);
    const op = { type: 'upsert', entity, code: record.code, record: U().clone(record), at: new Date().toISOString(), summary: summary || '', isNew: !existing, changed: diffFields(existing, record) };
    applyOp(op); audit(op); notify('change');
    if (recorder) recorder(op);
    return op;
  }
  function remove(entity, code, summary) {
    const op = { type: 'delete', entity, code, at: new Date().toISOString(), summary: summary || '' };
    applyOp(op); audit(op); notify('change');
    if (recorder) recorder(op);
    return op;
  }
  /* عدة عمليات دفعة واحدة (حذف متسلسل مثلًا) — إشعار واحد وكتابة واحدة */
  function batch(ops) {
    const applied = [];
    for (const o of ops) {
      const existing = o.type === 'upsert' ? get(o.entity, o.code) : null;
      const op = { ...o, at: new Date().toISOString(), isNew: o.type === 'upsert' && !existing };
      if (op.type === 'upsert') { op.record = U().clone(op.record); op.changed = diffFields(existing, op.record); }
      if (applyOp(op)) { audit(op); applied.push(op); }
    }
    notify('change');
    if (recorder) for (const op of applied) recorder(op);
    return applied;
  }

  /* ما الذي يعتمد على سجل ما؟ (للحذف الآمن وشاشة التأكيد) */
  function dependents(entity, code) {
    const out = { units: [], contracts: [], payments: [], maintenance: [] };
    if (entity === 'projects') {
      out.units = unitsOf(code).slice();
      for (const u of out.units) { out.contracts.push(...contractsOfUnit(u.code)); out.maintenance.push(...maintenanceOf(u.code)); }
    } else if (entity === 'units') {
      out.contracts = contractsOfUnit(code).slice(); out.maintenance = maintenanceOf(code).slice();
    } else if (entity === 'clients') {
      out.contracts = contractsOfClient(code).slice();
    } else if (entity === 'contracts') {
      out.payments = paymentsOf(code).slice();
    }
    if (entity !== 'contracts') for (const c of out.contracts) out.payments.push(...paymentsOf(c.code));
    return out;
  }
  /* حذف متسلسل: يُرجع قائمة العمليات (لا يطبّقها) حتى تُعرض في رسالة التأكيد */
  function cascadeOps(entity, code) {
    const dep = dependents(entity, code), ops = [];
    for (const p of dep.payments) ops.push({ type: 'delete', entity: 'payments', code: p.code });
    for (const c of dep.contracts) ops.push({ type: 'delete', entity: 'contracts', code: c.code });
    for (const m of dep.maintenance) ops.push({ type: 'delete', entity: 'maintenance', code: m.code });
    for (const u of dep.units) ops.push({ type: 'delete', entity: 'units', code: u.code });
    ops.push({ type: 'delete', entity, code });
    return ops;
  }

  E.Store = { load, state, rev, subscribe, notify, setRecorder, idx, get, project, unit, client, contract, unitsOf, contractsOfUnit, contractsOfClient, paymentsOf, paymentsOfCell, maintenanceOf, nextContract, applyOp, applyOps, replayReport, identityOf, upsert, remove, log, batch, dependents, cascadeOps };
})(window.Egary);
