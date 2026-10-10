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
  const listeners = new Set();
  let recorder = null; // دالة تُستدعى بكل عملية (Sync.record)

  function load(state) { STATE = state; IDX = null; notify('load'); }
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

  /* ---------- تطبيق العمليات ---------- */
  function applyOp(op) {
    if (op && op.type === 'settings') return applySettingsOp(op);
    if (op && op.type === 'audit') { if (!op.record) return false; STATE.audit.unshift(Object.assign({}, op.record)); if (STATE.audit.length > 500) STATE.audit.length = 500; return true; }
    const list = STATE[op.entity];
    if (!list) return false;
    const k = U().foldCode(op.code);
    const i = list.findIndex(r => U().foldCode(r.code) === k);
    if (op.type === 'upsert') {
      const rec = Object.assign(M().blank[op.entity](), op.record, { code: op.code });
      if (i >= 0) list[i] = rec; else list.push(rec);
    } else if (op.type === 'delete') {
      if (i >= 0) list.splice(i, 1);
    } else return false;
    IDX = null;
    return true;
  }
  function applySettingsOp(op) {
    if (!op || op.type !== 'settings' || !op.record) return false;
    const r = Object.assign({}, op.record);
    if (r.officeName) { STATE.meta.officeName = r.officeName; delete r.officeName; }
    Object.assign(STATE.settings, r);
    IDX = null;
    return true;
  }
  function applyOps(ops) { // إعادة تطبيق (من دفتر المزامنة) بلا تسجيل جديد
    let n = 0;
    for (const op of ops) if (applyOp(op)) n++;
    if (n) notify('replay');
    return n;
  }
  function audit(op) {
    STATE.audit.unshift({ at: new Date().toISOString().slice(0, 19).replace('T', ' '), action: op.type === 'delete' ? 'حذف' : (op.isNew ? 'إضافة' : 'تعديل'), entity: M().ENTITY_AR[op.entity] || op.entity, code: op.code, summary: op.summary || '', user: currentUser() });
    if (STATE.audit.length > 500) STATE.audit.length = 500;
  }
  function currentUser() { try { const u = E.Auth && E.Auth.user(); return u ? u.name : ''; } catch (e) { return ''; } }
  /* سطر في سجل التعديلات بلا تغيير بيانات (مثل الدخول) — يمر بالمزامنة ليُكتب في الإكسيل */
  function log(entry) {
    const op = { type: 'audit', at: new Date().toISOString(), record: Object.assign({ at: new Date().toISOString().slice(0, 19).replace('T', ' '), action: '', entity: '', code: '', summary: '', user: currentUser() }, entry) };
    applyOp(op); notify('change');
    if (recorder) recorder(op);
    return op;
  }
  /* الواجهة العامة: upsert/remove تُرجع العملية بعد تطبيقها وتسجيلها */
  function upsert(entity, record, summary) {
    const existing = get(entity, record.code);
    const op = { type: 'upsert', entity, code: record.code, record: U().clone(record), at: new Date().toISOString(), summary: summary || '', isNew: !existing };
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
      const op = { ...o, at: new Date().toISOString(), isNew: o.type === 'upsert' && !get(o.entity, o.code) };
      if (op.type === 'upsert') op.record = U().clone(op.record);
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

  E.Store = { load, state, subscribe, notify, setRecorder, idx, get, project, unit, client, contract, unitsOf, contractsOfUnit, contractsOfClient, paymentsOf, paymentsOfCell, maintenanceOf, nextContract, applyOp, applyOps, upsert, remove, log, batch, dependents, cascadeOps };
})(window.Egary);
