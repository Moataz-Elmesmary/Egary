/* =====================================================================
   auth.js — تسجيل الدخول والصلاحيات
   • المستخدمون يُحفظون في ورقة «المستخدمون» داخل Egary.xlsx (الاسم، الدور، كلمة المرور مشفّرة).
   • كلمة المرور لا تُحفظ أبدًا نصًّا: PBKDF2-SHA256 بملح عشوائي و120,000 تكرار (Web Crypto).
   • الأدوار: مدير (كل شيء) · موظف (إدخال وتعديل؛ لا إعدادات ولا مستخدمين ولا حذف للسجلات الأساسية) · مشاهدة فقط.
   • الجلسة في sessionStorage (تنتهي بإغلاق النافذة) أو localStorage لـ14 يومًا مع «تذكرني».
   ملاحظة صريحة: هذه بوابة دخول للبرنامج داخل مجلد محلي، وليست حماية للملف نفسه — من يملك المجلد يملك الإكسيل.
   ===================================================================== */
window.Egary = window.Egary || {};
(function (E) {
  'use strict';
  const S = () => E.Store;
  const ROLES = [{ key: 'admin', ar: 'مدير' }, { key: 'staff', ar: 'موظف' }, { key: 'viewer', ar: 'مشاهدة فقط' }];
  const SESSION_KEY = 'egary-session', REMEMBER_KEY = 'egary-remember', REMEMBER_DAYS = 14, ITER = 120000;
  const subtle = () => (globalThis.crypto && globalThis.crypto.subtle) || null;
  const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  const unhex = (s) => new Uint8Array((s.match(/../g) || []).map(x => parseInt(x, 16)));
  const normUser = (u) => String(u || '').trim().toLowerCase();
  async function pbkdf2(password, salt, iter) {
    const key = await subtle().importKey('raw', new TextEncoder().encode(String(password).normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
    return hex(await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256));
  }
  async function hashPassword(password) { const salt = globalThis.crypto.getRandomValues(new Uint8Array(16)); return `pbkdf2$${ITER}$${hex(salt)}$${await pbkdf2(password, salt, ITER)}`; }
  async function verifyPassword(password, stored) {
    const m = /^pbkdf2\$(\d+)\$([0-9a-f]+)\$([0-9a-f]+)$/.exec(String(stored || '').trim()); if (!m) return false;
    const h = await pbkdf2(password || '', unhex(m[2]), parseInt(m[1], 10));
    if (h.length !== m[3].length) return false; let d = 0; for (let i = 0; i < h.length; i++) d |= h.charCodeAt(i) ^ m[3].charCodeAt(i); return d === 0; // مقارنة بزمن ثابت
  }
  function validatePassword(p) { p = String(p || ''); if (p.length < 6) return 'كلمة المرور 6 أحرف على الأقل'; return ''; }
  function validateUsername(u, existingCode) {
    u = normUser(u);
    if (!/^[a-z0-9_.-]{3,24}$/.test(u)) return 'اسم المستخدم: 3–24 حرفًا لاتينيًا أو أرقامًا (بلا مسافات)';
    if (users().some(x => normUser(x.code) === u && normUser(x.code) !== normUser(existingCode || ''))) return 'اسم المستخدم موجود بالفعل';
    return '';
  }

  let current = null; const listeners = new Set();
  function emit() { for (const fn of listeners) { try { fn(current); } catch (e) { } } }
  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function users() { return (S().state().users || []); }
  function find(username) { const k = normUser(username); return users().find(u => normUser(u.code) === k) || null; }
  function hasUsers() { return users().some(u => u.enabled !== false && u.passwordHash); }
  function roleOf(u) { return ROLES.some(r => r.key === u.role) ? u.role : 'staff'; }
  function setCurrent(u, remember, source) {
    current = { username: u.code, name: u.name || u.code, role: roleOf(u), source: source || 'login' };
    const tok = JSON.stringify({ u: u.code, at: Date.now() });
    try { sessionStorage.setItem(SESSION_KEY, tok); } catch (e) { }
    try { if (remember) localStorage.setItem(REMEMBER_KEY, tok); else localStorage.removeItem(REMEMBER_KEY); } catch (e) { }
    emit();
  }
  async function login(username, password, remember) {
    const u = find(username);
    // نتحقق دائمًا من كلمة مرور (ولو وهمية) حتى لا يكشف زمن الرد وجود المستخدم
    const ok = await verifyPassword(password, u && u.enabled !== false ? u.passwordHash : 'pbkdf2$1000$00$00');
    if (!u || u.enabled === false || !ok) return { ok: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
    setCurrent(u, remember);
    try { if (S().log) S().log({ action: 'دخول', entity: 'مستخدم', code: u.code, summary: current.name + (remember ? ' (تذكرني)' : '') }); } catch (e) { }
    return { ok: true, user: current };
  }
  function restore() { // بعد قراءة الملف: جلسة محفوظة لمستخدم ما زال موجودًا ومفعَّلًا
    let tok = null, remembered = false;
    try { tok = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { }
    if (!tok) { try { tok = JSON.parse(localStorage.getItem(REMEMBER_KEY) || 'null'); remembered = true; if (tok && Date.now() - tok.at > REMEMBER_DAYS * 864e5) tok = null; } catch (e) { tok = null; } }
    if (!tok) return null;
    const u = find(tok.u); if (!u || u.enabled === false) { logout(); return null; }
    setCurrent(u, remembered, 'restored'); return current;
  }
  function demo(name) { current = { username: 'demo', name: name || 'تجربة', role: 'admin', source: 'demo' }; emit(); return current; }
  function logout() { current = null; try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { } try { localStorage.removeItem(REMEMBER_KEY); } catch (e) { } emit(); }
  function user() { return current; }
  function role() { return current ? current.role : ''; }
  const CORE = new Set(['projects', 'units', 'clients', 'contracts']);
  /* can('view') · can('edit') · can('delete', entity) · can('settings') · can('users') · can('unlink') */
  function can(action, entity) {
    const r = role(); if (!r) return false;
    if (r === 'admin') return true;
    if (r === 'viewer') return action === 'view';
    if (action === 'view' || action === 'edit') return true;
    if (action === 'delete') return !CORE.has(entity);
    return false;
  }
  const ROLE_AR = (r) => (ROLES.find(x => x.key === r) || {}).ar || r;

  /* ---------- إدارة المستخدمين (تمر عبر Store ⇒ تُكتب في الإكسيل) ---------- */
  async function createUser(rec, password) {
    const errs = []; const e1 = validateUsername(rec.code); if (e1) errs.push(e1);
    if (!rec.name || !String(rec.name).trim()) errs.push('الاسم مطلوب');
    const e2 = validatePassword(password); if (e2) errs.push(e2);
    if (!ROLES.some(r => r.key === rec.role)) errs.push('الدور غير صحيح');
    if (errs.length) return { errors: errs };
    const u = Object.assign(E.M.blank.users(), rec, { code: normUser(rec.code), passwordHash: await hashPassword(password), enabled: rec.enabled !== false, createdAt: E.U.iso(E.U.today()) });
    S().upsert('users', u, `مستخدم جديد: ${u.name} (${ROLE_AR(u.role)})`);
    return { record: u };
  }
  function updateUser(code, patch) {
    const u = find(code); if (!u) return { errors: ['المستخدم غير موجود'] };
    const errs = []; if (patch.name != null && !String(patch.name).trim()) errs.push('الاسم مطلوب');
    if (patch.role != null && !ROLES.some(r => r.key === patch.role)) errs.push('الدور غير صحيح');
    if (current && normUser(current.username) === normUser(code) && patch.role != null && patch.role !== 'admin' && u.role === 'admin') errs.push('لا يمكنك إزالة صلاحية المدير عن نفسك');
    if (current && normUser(current.username) === normUser(code) && patch.enabled === false) errs.push('لا يمكنك تعطيل حسابك الحالي');
    if (patch.role != null && patch.role !== 'admin' && u.role === 'admin' && users().filter(x => x.role === 'admin' && x.enabled !== false && normUser(x.code) !== normUser(code)).length === 0) errs.push('يجب أن يبقى مدير واحد مفعَّل على الأقل');
    if (patch.enabled === false && u.role === 'admin' && users().filter(x => x.role === 'admin' && x.enabled !== false && normUser(x.code) !== normUser(code)).length === 0) errs.push('يجب أن يبقى مدير واحد مفعَّل على الأقل');
    if (errs.length) return { errors: errs };
    const rec = Object.assign({}, u, patch, { code: u.code });
    S().upsert('users', rec, `تعديل مستخدم: ${rec.name} (${ROLE_AR(rec.role)}${rec.enabled === false ? ' — معطَّل' : ''})`);
    if (current && normUser(current.username) === normUser(code)) { current.name = rec.name; current.role = roleOf(rec); emit(); }
    return { record: rec };
  }
  async function setPassword(code, password, oldPassword) {
    const u = find(code); if (!u) return { errors: ['المستخدم غير موجود'] };
    if (oldPassword !== undefined && !(await verifyPassword(oldPassword, u.passwordHash))) return { errors: ['كلمة المرور الحالية غير صحيحة'] };
    const e = validatePassword(password); if (e) return { errors: [e] };
    const rec = Object.assign({}, u, { passwordHash: await hashPassword(password) });
    S().upsert('users', rec, `تغيير كلمة مرور: ${rec.name}`);
    return { record: rec };
  }
  function removeUser(code) {
    const u = find(code); if (!u) return { errors: ['المستخدم غير موجود'] };
    if (current && normUser(current.username) === normUser(code)) return { errors: ['لا يمكنك حذف حسابك الحالي'] };
    if (u.role === 'admin' && users().filter(x => x.role === 'admin' && x.enabled !== false && normUser(x.code) !== normUser(code)).length === 0) return { errors: ['يجب أن يبقى مدير واحد على الأقل'] };
    S().remove('users', u.code, `حذف مستخدم: ${u.name}`);
    return { ok: true };
  }

  E.Auth = { ROLES, ROLE_AR, login, logout, restore, demo, user, role, can, hasUsers, users, find, normUser, hashPassword, verifyPassword, validatePassword, validateUsername, createUser, updateUser, setPassword, removeUser, subscribe, get supported() { return !!subtle(); } };
})(window.Egary);
