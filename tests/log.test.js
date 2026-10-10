// سجل العمليات: يُجمع في المتصفح، ويُكتب ملفات CSV شهرية (إلحاق فقط، مع BOM) عند توفر مجلد البرنامج؛ ويسجل الدخول المرفوض والخروج
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, readFile, SOURCE } = require('./helpers/env');
function fakeDir(name) {
  const files = new Map();
  const mk = (n) => ({ kind: 'file', async getFile() { const b = files.get(n); return { size: b ? b.text.length : 0, lastModified: b ? b.at : 0, text: async () => (b ? b.text : '') }; }, async createWritable(o) { const keep = !!(o && o.keepExistingData); let txt = keep && files.has(n) ? files.get(n).text : ''; return { write: async (d) => { if (d && typeof d === 'object' && d.type === 'write') { const pos = d.position == null ? txt.length : d.position; txt = txt.slice(0, pos) + d.data; } else txt += typeof d === 'string' ? d : new TextDecoder().decode(d); }, close: async () => { files.set(n, { text: txt, at: Date.now() }); } }; } });
  const dir = { name, kind: 'directory', async getDirectoryHandle() { return dir; }, async getFileHandle(n) { return mk(n); }, async removeEntry(n) { files.delete(n); }, async *entries() { for (const [n] of files) yield [n, mk(n)]; }, files };
  return dir;
}
test('operations log: buffered in the browser, flushed to monthly CSV files with a BOM header, appended (never rewritten), escaped; failed logins and logouts are logged with the user', async () => {
  const E = load({ today: '2026-10-09' });
  const { state } = await E.Workbook.read(readFile(SOURCE)); E.Store.load(state);
  const L = E.Log; assert.equal(L.status().enabled, false);
  L.append({ at: '2026-10-01 09:00:00', user: 'المدير', action: 'إضافة', entity: 'عميل', code: 'C100', summary: 'اسم, به فاصلة و"علامات"' });
  L.append({ at: '2026-10-02 10:00:00', user: 'موظف', action: 'حذف', entity: 'دفعة', code: 'INV-2026-0001', summary: 'x' });
  L.append({ at: '2026-09-30 10:00:00', user: 'موظف', action: 'تعديل', entity: 'عقد', code: 'T0001', summary: 'y' });
  assert.equal(L.status().buffered, 3);
  assert.equal(JSON.parse(localStorage.getItem('egary-log-buffer-v1')).length, 3, 'survives in localStorage until a folder exists');
  const dir = fakeDir('Egary');
  await L.setDir(dir);
  assert.equal(L.status().buffered, 0); assert.equal(L.status().written, 3);
  const oct = dir.files.get('Egary-log-2026-10.csv').text, sep = dir.files.get('Egary-log-2026-09.csv').text;
  assert.ok(oct.startsWith('﻿الوقت,المستخدم,العملية'), 'BOM + header');
  assert.equal(oct.trim().split('\r\n').length, 3, 'header + 2 rows in October');
  assert.ok(oct.includes('"اسم, به فاصلة و""علامات"""'), 'CSV escaping');
  assert.equal(sep.trim().split('\r\n').length, 2);
  // إلحاق لا إعادة كتابة
  L.append({ at: '2026-10-03 11:00:00', user: 'المدير', action: 'إضافة', entity: 'وحدة', code: 'P01-909', summary: 'z' });
  await L.flush();
  const oct2 = dir.files.get('Egary-log-2026-10.csv').text;
  assert.ok(oct2.startsWith(oct), 'existing content kept'); assert.equal(oct2.trim().split('\r\n').length, 4);
  assert.equal((oct2.match(/﻿/g) || []).length, 1, 'header written once');
  // عمليات المتجر والدخول تمر عبر السجل
  await E.Auth.createUser({ code: 'admin', name: 'المدير', role: 'admin' }, 'admin@2026');
  assert.equal((await E.Auth.login('admin', 'bad')).ok, false);
  await E.Auth.login('admin', 'admin@2026');
  E.Store.upsert('projects', { ...E.M.blank.projects(), code: 'P77', name: 'مشروع سجل' }, 'مشروع سجل');
  E.Auth.logout();
  await L.flush();
  const txt = dir.files.get('Egary-log-2026-10.csv').text + (dir.files.get('Egary-log-' + new Date().toISOString().slice(0, 7) + '.csv') || { text: '' }).text;
  assert.ok(/دخول مرفوض,مستخدم,admin,كلمة مرور غير صحيحة/.test(txt), 'failed login logged');
  assert.ok(/المدير,دخول,مستخدم,admin/.test(txt), 'login logged with the user');
  assert.ok(/المدير,إضافة,مشروع,P77,مشروع سجل/.test(txt), 'store op logged with the user');
  assert.ok(/المدير,خروج,مستخدم,admin/.test(txt), 'logout logged');
  // تنزيل CSV يدمج الإكسيل وغير المكتوب بلا تكرار
  let dl = null; E.FileLink.downloadBytes = (buf, name) => { dl = { text: new TextDecoder('utf-8', { ignoreBOM: true }).decode(buf), name }; };
  const n = L.downloadCsv(E.Store.state().audit);
  assert.ok(n >= 3 && dl && dl.name.startsWith('Egary-log-') && dl.text.startsWith('﻿'));
});
