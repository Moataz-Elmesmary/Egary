// سياسة النسخ الاحتياطي على القرص بمقبض مجلد وهمي في الذاكرة
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/env');
function fakeDir(name) {
  const files = new Map();
  const dir = { name, kind: 'directory', async getDirectoryHandle() { return dir; }, async getFileHandle(n) { return { kind: 'file', async getFile() { const b = files.get(n); return { size: b.bytes.byteLength, lastModified: b.at }; }, async createWritable() { let buf = null; return { write: async (d) => { buf = d; }, close: async () => { files.set(n, { bytes: buf, at: Date.now() + files.size }); } }; } }; }, async removeEntry(n) { files.delete(n); }, async *entries() { for (const [n] of files) yield [n, { kind: 'file', async getFile() { const b = files.get(n); return { size: b.bytes.byteLength, lastModified: b.at }; } }]; }, files };
  return dir;
}
const enc = s => new TextEncoder().encode(s).buffer;
test('backup policy: original kept, periodic throttled to 20 minutes, before-delete forced, pruning keeps 60 periodic + specials', async () => {
  const E = load();
  const dir = fakeDir('Egary');
  await E.Backup.setDir(dir);
  assert.equal(E.Backup.status().enabled, true);
  assert.ok(await E.Backup.write(enc('v0'), 'original', true));
  assert.ok(await E.Backup.write(enc('v1'), '', true));
  assert.equal(await E.Backup.write(enc('v2'), '', false), false, 'throttled within 20 minutes');
  assert.ok(await E.Backup.write(enc('v3'), 'before-delete', true));
  // محاكاة مرور الوقت ثم 70 نسخة دورية
  for (let i = 0; i < 70; i++) { E.Backup._state.lastAt = 0; assert.ok(await E.Backup.write(enc('p' + i), '', false)); }
  const names = [...dir.files.keys()];
  assert.ok(names.some(n => n.includes('original')), 'original kept');
  assert.ok(names.some(n => n.includes('before-delete')), 'before-delete kept');
  const periodic = names.filter(n => !/original|before-delete/.test(n));
  assert.ok(periodic.length <= 60, 'periodic pruned to 60: ' + periodic.length);
  assert.ok((await E.Backup.list()).length >= 62);
});
