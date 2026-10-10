// تسجيل الدخول والصلاحيات: التشفير، الدخول/الخروج/الجلسة، مصفوفة الأدوار، قواعد إدارة المستخدمين، وورقة «المستخدمون» في الإكسيل
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { load, readFile, SOURCE } = require('./helpers/env');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
function py(script, ...args) { return JSON.parse(execFileSync('python3', ['-I', '-c', script, ...args], { encoding: 'utf-8' })); }

test('auth: salted PBKDF2 hashes, login/logout/restore, roles matrix, user-management rules, audit records the user', async () => {
  const E = load({ today: '2026-10-09' });
  assert.equal(E.Auth.supported, true);
  const h1 = await E.Auth.hashPassword('secret1'), h2 = await E.Auth.hashPassword('secret1');
  assert.notEqual(h1, h2, 'different salts');
  assert.match(h1, /^pbkdf2\$120000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
  assert.equal(await E.Auth.verifyPassword('secret1', h1), true);
  assert.equal(await E.Auth.verifyPassword('Secret1', h1), false);
  assert.equal(await E.Auth.verifyPassword('secret1', 'secret1'), false, 'plain text is never accepted');
  const { state } = await E.Workbook.read(readFile(SOURCE)); E.Store.load(state);
  assert.equal(E.Auth.hasUsers(), false);
  assert.equal(E.Auth.can('view'), false, 'nobody logged in');
  const r1 = await E.Auth.createUser({ code: ' Admin ', name: 'المدير', role: 'admin' }, 'admin@2026');
  assert.ok(r1.record && r1.record.code === 'admin' && r1.record.passwordHash.startsWith('pbkdf2$'));
  assert.ok((await E.Auth.createUser({ code: 'ab', name: '', role: 'staff' }, '123')).errors.length >= 3, 'username, name and password validated');
  assert.ok((await E.Auth.createUser({ code: 'ADMIN', name: 'x', role: 'staff' }, '123456')).errors.some(e => /موجود/.test(e)), 'case-insensitive uniqueness');
  await E.Auth.createUser({ code: 'office', name: 'موظف المكتب', role: 'staff' }, 'office@2026');
  await E.Auth.createUser({ code: 'zaer', name: 'زائر', role: 'viewer' }, 'view@2026');
  assert.equal(E.Auth.users().length, 3);
  assert.equal((await E.Auth.login('admin', 'wrong')).ok, false);
  assert.equal((await E.Auth.login('nobody', 'admin@2026')).ok, false);
  const ok = await E.Auth.login(' ADMIN ', 'admin@2026', true);
  assert.equal(ok.ok, true); assert.equal(E.Auth.user().role, 'admin'); assert.equal(E.Auth.user().name, 'المدير');
  assert.equal(state.audit[0].action, 'دخول'); assert.equal(state.audit[0].code, 'admin');
  E.Store.upsert('projects', { ...E.M.blank.projects(), code: 'P99', name: 'اختبار' }, 'x');
  assert.equal(state.audit[0].user, 'المدير', 'audit rows carry the user');
  // الأدوار
  assert.deepEqual([E.Auth.can('edit'), E.Auth.can('delete', 'projects'), E.Auth.can('settings'), E.Auth.can('users'), E.Auth.can('unlink')], [true, true, true, true, true]);
  await E.Auth.login('office', 'office@2026');
  assert.deepEqual([E.Auth.can('view'), E.Auth.can('edit'), E.Auth.can('delete', 'payments'), E.Auth.can('delete', 'maintenance'), E.Auth.can('delete', 'projects'), E.Auth.can('delete', 'contracts'), E.Auth.can('settings'), E.Auth.can('users')], [true, true, true, true, false, false, false, false]);
  await E.Auth.login('zaer', 'view@2026');
  assert.deepEqual([E.Auth.can('view'), E.Auth.can('edit'), E.Auth.can('delete', 'payments')], [true, false, false]);
  // الجلسة: استعادة من sessionStorage، وانتهاء «تذكرني» بعد 14 يومًا، ومستخدم معطَّل لا يُستعاد
  E.Auth.logout(); assert.equal(E.Auth.user(), null);
  await E.Auth.login('admin', 'admin@2026'); const sessTok = sessionStorage.getItem('egary-session'); E.Auth.logout();
  sessionStorage.setItem('egary-session', sessTok);
  assert.equal(E.Auth.restore().username, 'admin', 'session token restores');
  assert.equal(E.Auth.restore().username, 'admin', 'restore is idempotent');
  E.Auth.logout();
  sessionStorage.setItem('egary-session', JSON.stringify({ u: 'admin', at: Date.now() }));
  assert.equal(E.Auth.restore(), null, 'a token without the password fingerprint is rejected');
  const fp = (c) => E.Auth.find(c).passwordHash.slice(-16);
  localStorage.setItem('egary-remember', JSON.stringify({ u: 'admin', at: Date.now() - 15 * 864e5, h: fp('admin') }));
  assert.equal(E.Auth.restore(), null, 'expired remember token');
  localStorage.setItem('egary-remember', JSON.stringify({ u: 'office', at: Date.now(), h: fp('office') }));
  assert.equal(E.Auth.restore().username, 'office');
  // قواعد الإدارة
  await E.Auth.login('admin', 'admin@2026');
  assert.ok(E.Auth.updateUser('admin', { role: 'staff' }).errors.length, 'cannot demote yourself');
  assert.ok(E.Auth.removeUser('admin').errors.length, 'cannot delete yourself');
  assert.ok(E.Auth.updateUser('office', { enabled: false }).record);
  assert.equal((await E.Auth.login('office', 'office@2026')).ok, false, 'disabled user cannot log in');
  assert.ok(E.Auth.updateUser('office', { enabled: true, role: 'admin', name: 'مدير ثانٍ' }).record);
  assert.ok((await E.Auth.setPassword('office', 'newpass1', 'bad')).errors.length, 'wrong old password');
  assert.ok((await E.Auth.setPassword('office', 'newpass1', 'office@2026')).record);
  assert.equal((await E.Auth.login('office', 'newpass1')).ok, true);
  assert.equal(E.Auth.user().username, 'office');
  assert.ok(E.Auth.updateUser('admin', { role: 'staff' }).record, 'another admin may demote admin (not self, another admin remains)');
  assert.ok(E.Auth.updateUser('office', { role: 'staff' }).errors.length, 'the last admin cannot demote themselves');
  assert.ok(E.Auth.updateUser('admin', { role: 'admin' }).record);
  assert.ok(E.Auth.removeUser('zaer').ok);
  assert.equal(E.Auth.users().length, 2);
  // الإكسيل: ورقة مخفية، كلمات المرور مشفّرة، تعود كما هي، والدخول يعمل بعد إعادة القراءة؛ وعمود المستخدم في سجل التعديلات
  const buf = await E.Workbook.write(state);
  const file = path.join(OUT, 'auth.xlsx'); fs.writeFileSync(file, Buffer.from(buf));
  const info = py(`
import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1]); ws = wb['المستخدمون']; wa = wb['سجل التعديلات']
rows = [[c.value for c in r] for r in ws.iter_rows(min_row=1, max_row=ws.max_row)]
print(json.dumps({'state': ws.sheet_state, 'rows': rows, 'audit_head': [c.value for c in wa[1]], 'audit_rows': [[c.value for c in r] for r in wa.iter_rows(min_row=2, max_row=6)]}, default=str))`, file);
  assert.equal(info.state, 'hidden');
  assert.deepEqual(info.rows[0].slice(0, 5), ['اسم المستخدم', 'الاسم', 'الدور', 'كلمة المرور (مشفّرة)', 'مفعّل']);
  const adminRow = info.rows.find(r => r[0] === 'admin');
  assert.ok(adminRow && /^pbkdf2\$/.test(adminRow[3]) && adminRow[2] === 'مدير' && adminRow[4] === 'نعم');
  assert.ok(!JSON.stringify(info.rows).includes('admin@2026'), 'no plaintext password anywhere');
  assert.equal(info.audit_head[5], 'المستخدم');
  assert.ok(info.audit_rows.some(r => r[1] === 'دخول' && r[5]), 'login rows carry the user name');
  const E2 = load({ today: '2026-10-09' });
  const r2 = await E2.Workbook.read(buf); E2.Store.load(r2.state);
  assert.equal(r2.state.users.length, 2);
  assert.deepEqual(r2.state.users.map(u => [u.code, u.role, u.enabled]).sort(), [['admin', 'admin', true], ['office', 'admin', true]]);
  assert.equal((await E2.Auth.login('admin', 'admin@2026')).ok, true);
  assert.equal((await E2.Auth.login('office', 'newpass1')).ok, true);
  assert.ok(r2.state.audit.some(a => a.action === 'دخول' && a.user === 'المدير'), 'login rows keep the user name through the workbook');
});

test('auth hardening: remember-me survives a same-tab reload, tokens die with a password change or a disabled user, corrupted hashes never throw, tolerant users-sheet parsing, revalidate() after an external reload, hasAdmin()', async () => {
  const E = load({ today: '2026-10-09' });
  const { state } = await E.Workbook.read(readFile(SOURCE)); E.Store.load(state);
  await E.Auth.createUser({ code: 'admin', name: 'المدير', role: 'admin' }, 'admin@2026');
  await E.Auth.createUser({ code: 'office', name: 'موظف', role: 'staff' }, 'office@2026');
  // «تذكرني» ثم إعادة تحميل في نفس النافذة (جلسة موجودة) ⇒ رمز «تذكرني» يبقى، وبعد إغلاق النافذة يستعيد الدخول
  assert.equal((await E.Auth.login('office', 'office@2026', true)).ok, true);
  assert.equal(E.Auth.restore().username, 'office', 'same-tab reload');
  assert.ok(localStorage.getItem('egary-remember'), 'remember token kept after a same-tab restore');
  sessionStorage.removeItem('egary-session');
  assert.equal(E.Auth.restore().username, 'office', 'browser closed and reopened');
  // تغيير كلمة المرور من المدير يُبطل الرمز المحفوظ للموظف
  await E.Auth.login('admin', 'admin@2026');
  assert.ok((await E.Auth.setPassword('office', 'changed1')).record);
  const remembered = JSON.parse(localStorage.getItem('egary-remember') || 'null');
  E.Auth.logout(); // يمسح رموز المدير
  localStorage.setItem('egary-remember', JSON.stringify(Object.assign({}, remembered, { u: 'office' })));
  // (الرمز القديم لـoffice كان بتجزئة كلمة المرور القديمة؛ نعيد بناءه يدويًا كما لو بقي على الجهاز)
  localStorage.setItem('egary-remember', JSON.stringify({ u: 'office', at: Date.now(), h: 'stalehashstalehas', f: '' }));
  assert.equal(E.Auth.restore(), null, 'stale token rejected');
  assert.equal(localStorage.getItem('egary-remember'), null, 'stale token removed');
  // تغيير كلمة مرورك أنت لا يُخرجك
  await E.Auth.login('office', 'changed1', true);
  assert.ok((await E.Auth.setPassword('office', 'changed2', 'changed1')).record);
  sessionStorage.removeItem('egary-session');
  assert.equal(E.Auth.restore().username, 'office', 'own password change refreshes the token');
  // تجزئة تالفة (عُدِّلت في الإكسيل) ⇒ رفض هادئ
  const u = E.Auth.find('office'); u.passwordHash = 'pbkdf2$0$00$00';
  assert.equal((await E.Auth.login('office', 'changed2')).ok, false);
  u.passwordHash = 'nonsense'; assert.equal((await E.Auth.login('office', 'changed2')).ok, false);
  // revalidate بعد إعادة قراءة الملف: تعطيل ⇒ خروج؛ تغيير دور ⇒ تحديث
  await E.Auth.login('admin', 'admin@2026');
  const copy = JSON.parse(JSON.stringify(state));
  copy.users.find(x => x.code === 'admin').role = 'staff'; E.Store.load(copy);
  assert.equal(E.Auth.revalidate(), true); assert.equal(E.Auth.role(), 'staff');
  copy.users.find(x => x.code === 'admin').enabled = false; E.Store.load(JSON.parse(JSON.stringify(copy)));
  assert.equal(E.Auth.revalidate(), false); assert.equal(E.Auth.user(), null);
  assert.equal(E.Auth.hasAdmin(), false, 'no enabled admin left');
  // قراءة متسامحة لورقة المستخدمين المعدَّلة يدويًا
  E.Store.load(state);
  const buf = await E.Workbook.write(state);
  const file = path.join(OUT, 'auth_tolerant.xlsx'); fs.writeFileSync(file, Buffer.from(buf));
  const edited = path.join(OUT, 'auth_tolerant_edit.xlsx');
  py(`
import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1]); ws = wb['المستخدمون']
for r in range(2, ws.max_row + 1):
    if ws.cell(r, 1).value == 'admin': ws.cell(r, 3).value = 'Admin'; ws.cell(r, 5).value = 'مفعل'
    if ws.cell(r, 1).value == 'office': ws.cell(r, 3).value = 'موظف (المكتب)'; ws.cell(r, 5).value = 'Y'
ws.append(['zaer', 'زائر', 'مشاهدة', 'pbkdf2$120000$00$00', 'لا', None, None])
wb.save(sys.argv[2]); print('{}')`, file, edited);
  const E2 = load({ today: '2026-10-09' });
  const r2 = await E2.Workbook.read(toAB(fs.readFileSync(edited)));
  const by = Object.fromEntries(r2.state.users.map(x => [x.code, x]));
  assert.equal(by.admin.role, 'admin'); assert.equal(by.admin.enabled, true);
  assert.equal(by.office.role, 'staff'); assert.equal(by.office.enabled, true);
  assert.equal(by.zaer.role, 'viewer'); assert.equal(by.zaer.enabled, false);
});
function toAB(b) { return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }
