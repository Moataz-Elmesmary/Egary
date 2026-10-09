// اختبارات محرّك المزامنة (بدون متصفح): محوِّل ذاكرة + نافذة وهمية
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

function freshEnv() {
  const store = {};
  global.window = { Egary: {} };
  global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  delete require.cache[require.resolve('../Egary/assets/js/sync/file-link.js')];
  delete require.cache[require.resolve('../Egary/assets/js/sync/sync.js')];
  require('../Egary/assets/js/sync/file-link.js');
  require('../Egary/assets/js/sync/sync.js');
  return window.Egary;
}
const enc = s => new TextEncoder().encode(s).buffer;
const dec = b => new TextDecoder().decode(new Uint8Array(b));
const tick = (ms) => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 3000)) { if (fn()) return true; await tick(10); } return fn(); };

test('record → flush writes the serialized state to the file and clears the journal', async () => {
  const E = freshEnv();
  let state = { rows: ['a'] };
  const statuses = [];
  E.Sync.init({ serialize: async () => enc(JSON.stringify(state)), deserialize: async (b) => { state = JSON.parse(dec(b)); }, applyOps: () => {}, onStatus: s => statuses.push(s.state), pollMs: 20, debounceMs: 0, settleMs: 5 });
  const a = E.FileLink.memoryAdapter(enc(JSON.stringify({ rows: ['from-file'] })));
  await E.Sync.link(a);
  assert.deepEqual(state, { rows: ['from-file'] });            // الإكسيل مصدر الحقيقة عند الربط
  state.rows.push('b');
  const ok = await E.Sync.record({ type: 'upsert', entity: 'rows', record: 'b' });
  assert.equal(ok, true);
  assert.equal(a.writes, 1);
  assert.deepEqual(JSON.parse(dec(a.bytes())), { rows: ['from-file', 'b'] });
  assert.equal(E.Sync.status.pending, 0);
  assert.equal(E.Sync.status.state, 'linked');
  assert.ok(statuses.includes('saving'));
  E.Sync.stopPolling();
});

test('locked file (open in Excel) keeps ops pending, shows locked, then retries and succeeds', async () => {
  const E = freshEnv();
  let state = { n: 1 };
  E.Sync.init({ serialize: async () => enc(JSON.stringify(state)), deserialize: async (b) => { state = JSON.parse(dec(b)); }, applyOps: () => {}, pollMs: 20, debounceMs: 0, retryMs: 30, settleMs: 5 });
  const a = E.FileLink.memoryAdapter(enc(JSON.stringify({ n: 1 })));
  await E.Sync.link(a);
  a.locked = true;
  state.n = 2;
  const ok = await E.Sync.record({ type: 'set', n: 2 });
  assert.equal(ok, false);
  assert.equal(E.Sync.status.state, 'locked');
  assert.equal(E.Sync.status.pending, 1);
  assert.equal(JSON.parse(localStorage.getItem('egary-pending-ops-v1')).length, 1); // الدفتر محفوظ
  a.locked = false;
  await until(() => E.Sync.status.state === 'linked' && E.Sync.status.pending === 0);   // إعادة المحاولة التلقائية
  assert.equal(E.Sync.status.state, 'linked');
  assert.equal(E.Sync.status.pending, 0);
  assert.deepEqual(JSON.parse(dec(a.bytes())), { n: 2 });
  E.Sync.stopPolling();
});

test('external edit is detected by polling, deserialized, and pending ops are replayed on top then written', async (t) => {
  t.after(() => { try { window.Egary.Sync.stopPolling(); } catch (e) {} });
  const E = freshEnv();
  let state = { items: { a: 1 } };
  const applied = [];
  E.Sync.init({
    serialize: async () => enc(JSON.stringify(state)),
    deserialize: async (b) => { state = JSON.parse(dec(b)); },
    applyOps: (ops) => { ops.forEach(op => { applied.push(op); state.items[op.key] = op.value; }); },
    pollMs: 15, debounceMs: 0, retryMs: 20, settleMs: 5,
  });
  const a = E.FileLink.memoryAdapter(enc(JSON.stringify(state)));
  await E.Sync.link(a);
  // الموقع يعدّل بينما الملف مقفول
  a.locked = true;
  state.items.b = 2;
  await E.Sync.record({ type: 'upsert', key: 'b', value: 2 });
  assert.equal(E.Sync.status.state, 'locked');
  // Excel يحفظ تعديلًا خارجيًا (a: 10) ثم يُغلق
  a.externalWrite(enc(JSON.stringify({ items: { a: 10 } })));
  a.locked = false;
  await until(() => state.items.a === 10 && state.items.b === 2 && E.Sync.status.pending === 0 && E.Sync.status.state === 'linked');
  assert.deepEqual(state.items, { a: 10, b: 2 });                 // التعديل الخارجي + العملية المعلّقة
  assert.equal(applied.length >= 1, true);
  assert.deepEqual(JSON.parse(dec(a.bytes())).items, { a: 10, b: 2 });
  assert.equal(E.Sync.status.pending, 0);
  assert.ok(E.Sync.status.lastExternal);
  E.Sync.stopPolling();
});

test('journal survives a reload: pending ops from a previous session are applied on link and written', async () => {
  const E = freshEnv();
  localStorage.setItem('egary-pending-ops-v1', JSON.stringify([{ type: 'upsert', key: 'z', value: 9 }]));
  let state = { items: {} };
  E.Sync.init({ serialize: async () => enc(JSON.stringify(state)), deserialize: async (b) => { state = JSON.parse(dec(b)); }, applyOps: (ops) => ops.forEach(op => { state.items[op.key] = op.value; }), pollMs: 20, debounceMs: 0, settleMs: 5 });
  assert.equal(E.Sync.status.pending, 1);
  const a = E.FileLink.memoryAdapter(enc(JSON.stringify({ items: { q: 1 } })));
  await E.Sync.link(a);
  await until(() => E.Sync.status.pending === 0 && E.Sync.status.state === 'linked');
  assert.deepEqual(state.items, { q: 1, z: 9 });
  assert.deepEqual(JSON.parse(dec(a.bytes())).items, { q: 1, z: 9 });
  assert.equal(E.Sync.status.pending, 0);
  E.Sync.stopPolling();
});

test('write/poll race: an external save that lands just before a website write is read first and not overwritten', async (t) => {
  const E = freshEnv();
  t.after(() => { try { E.Sync.stopPolling(); } catch (e) {} });
  let state = { items: { a: 1 } };
  E.Sync.init({ serialize: async () => enc(JSON.stringify(state)), deserialize: async (b) => { state = JSON.parse(dec(b)); }, applyOps: (ops) => ops.forEach(op => { state.items[op.key] = op.value; }), pollMs: 100000, debounceMs: 0, settleMs: 5 });
  const a = E.FileLink.memoryAdapter(enc(JSON.stringify(state)));
  await E.Sync.link(a);
  E.Sync.stopPolling();                                           // لا استطلاع: المحاكاة تعتمد على فحص الكتابة نفسها
  a.externalWrite(enc(JSON.stringify({ items: { a: 1, x: 'from-excel' } })));   // Excel حفظ الآن
  state.items.b = 2;                                              // والموقع يعدّل في نفس اللحظة
  await E.Sync.record({ type: 'upsert', key: 'b', value: 2 });
  await tick(60);
  const file = JSON.parse(dec(a.bytes())).items;
  assert.deepEqual(file, { a: 1, x: 'from-excel', b: 2 });        // تعديل الإكسيل محفوظ + تعديل الموقع مطبَّق فوقه
  assert.deepEqual(state.items, { a: 1, x: 'from-excel', b: 2 });
});
