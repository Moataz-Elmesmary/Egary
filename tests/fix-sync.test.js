// اختبارات انحدار لمحرّك المزامنة وسجل العمليات (نتائج الفحص الشامل: sync/races*, workbook-sync*, log-stuck)
//   2  تعديل خارجي يصل أثناء التسلسل لا يُكتب فوقه: يُقرأ ثم يُعاد التسلسل (ومع القفل: جسّ القفل قبل التسلسل)
//   3  Log.setDir بمخزن فارغ لا يعلّق flushP؛ وفشل ملف الشهر الثاني لا يكرّر صفوف الأول؛ والوقت المحلي
//   4  عملية تُسجَّل أثناء كتابة جارية لا تُحذف من الدفتر
//   5  مؤقّت إعادة المحاولة لا يُلغى عند بدء الاستطلاع (بدء التشغيل والملف مفتوح في Excel)
//   6  عمليات ملف A لا تُطبَّق على ملف B بل تُحفظ جانبًا وتُستعاد عند ربط A
//   7  لكل تبويب دفتره؛ دفاتر التبويبات المغلقة تُتبنّى
//   9  تعديل خارجي تعذّرت قراءته لا يُكتب فوقه (إلا بـ forceWrite)
//   (تحقق) 9c نص واحد لحالة «تعذّرت قراءته» من الاستطلاع والكتابة معًا؛ 7d مسح مفاتيح localStorage لدفاتر ضاع تسجيلها؛ 6b صياغة العدد في ملاحظة المحفوظ جانبًا
process.env.TZ = 'Asia/Riyadh'; // لإثبات أن طابع السجل بالتوقيت المحلي لا UTC
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { load, readFile, ROOT } = require('./helpers/env');
const DEMO = path.join(ROOT, 'Egary.xlsx');
const KEY = 'egary-pending-ops-v1';
const enc = s => new TextEncoder().encode(s).buffer;
const dec = b => new TextDecoder().decode(new Uint8Array(b));
const tick = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 3000)) { if (fn()) return true; await tick(10); } return fn(); };
const J = (store, k) => JSON.parse(store[k || KEY] || 'null');

/* ---------- تبويب وهمي: مخزن localStorage مشترك، sessionStorage خاص، نافذة تلتقط المستمعين ---------- */
const TABS = [];
function tab(store, opts, sess) {
  opts = opts || {}; sess = sess || {};
  const listeners = {};
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  global.window = { Egary: {}, addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); } };
  global.localStorage = ls;
  global.sessionStorage = { getItem: k => (k in sess ? sess[k] : null), setItem: (k, v) => { sess[k] = String(v); }, removeItem: k => { delete sess[k]; } };
  for (const f of ['core/util.js', 'sync/file-link.js', 'sync/sync.js', 'sync/log.js']) { const p = path.join(ROOT, 'assets/js', f); delete require.cache[p]; require(p); }
  const E = window.Egary;
  let st = { items: {} };
  const t = {
    E, sess, external: 0, serializes: 0,
    get state() { return st; }, set state(v) { st = v; },
    fire(type, ev) { (listeners[type] || []).forEach(fn => fn(ev || {})); },
    /* إغلاق التبويب: pagehide ثم تجميد المخزن (مؤقّتاته لا تكتب شيئًا بعدها) */
    close() { t.fire('pagehide'); t.kill(); },
    kill() { try { E.Sync.unlink(); } catch (e) { } E.Sync.stopPolling(); ls.getItem = () => null; ls.setItem = () => { }; ls.removeItem = () => { }; },
  };
  E.Sync.init(Object.assign({
    serialize: async () => { t.serializes++; const snap = JSON.stringify(st); if (opts.serializeMs) await tick(opts.serializeMs); return enc(snap); },
    deserialize: async b => { st = JSON.parse(dec(b)); },
    applyOps: ops => ops.forEach(op => { st.items[op.key] = op.value; }),
    onExternalChange: () => { t.external++; },
    pollMs: 30, debounceMs: 0, retryMs: 40, settleMs: 5, heartbeatMs: 20, staleMs: 60,
  }, opts));
  TABS.push(t);
  return t;
}
const cleanup = () => { for (const t of TABS.splice(0)) t.kill(); };

/* ===================== 4: عملية أثناء كتابة جارية ===================== */
test('4: an op recorded while a write is in flight stays pending (journal + status), is written by the follow-up pass, and survives a reload', async (t) => {
  t.after(cleanup);
  const store = {};
  const A = tab(store, { serializeMs: 120, pollMs: 100000 });
  A.state = { items: { a: 1 } };
  const a = A.E.FileLink.memoryAdapter(enc(JSON.stringify(A.state)));
  await A.E.Sync.link(a); A.E.Sync.stopPolling();
  const realWrite = a.write; a.write = async b => { await realWrite(b); a.locked = true; };   // Excel يمسك الملف فور نزول أول كتابة
  A.state.items.b = 2; const p1 = A.E.Sync.record({ type: 'upsert', key: 'b', value: 2 });
  await tick(30); assert.strictEqual(A.E.Sync.status.state, 'saving');
  A.state.items.c = 3; A.E.Sync.record({ type: 'upsert', key: 'c', value: 3 });         // تُسجَّل أثناء التسلسل
  assert.strictEqual(J(store).length, 2);
  await p1; await tick(20);
  assert.deepStrictEqual(JSON.parse(dec(a.bytes())).items, { a: 1, b: 2 }, 'first write holds b only');
  await until(() => A.E.Sync.status.state === 'locked', 2000);
  assert.strictEqual(A.E.Sync.status.pending, 1, 'c is still pending');
  assert.deepStrictEqual(J(store), [{ type: 'upsert', key: 'c', value: 3 }], 'journal keeps c');
  A.E.Sync.stopPolling();
  // إعادة تحميل نفس التبويب (نفس sessionStorage) والملف لم يعد مقفولًا
  A.kill(); a.locked = false; a.write = realWrite;
  const B = tab(store, { pollMs: 100000 }, A.sess);
  assert.strictEqual(B.E.Sync.status.pending, 1);
  await B.E.Sync.link(a); B.E.Sync.stopPolling();
  assert.deepStrictEqual(B.state.items, { a: 1, b: 2, c: 3 });
  assert.deepStrictEqual(JSON.parse(dec(a.bytes())).items, { a: 1, b: 2, c: 3 });
  assert.strictEqual(J(store).length, 0);
});

test('4b: ops keep their extra fields (changed, at, summary) across the journal round-trip', async (t) => {
  t.after(cleanup);
  const store = {};
  const A = tab(store, { pollMs: 100000 });
  const a = A.E.FileLink.memoryAdapter(enc(JSON.stringify({ items: {} })));
  await A.E.Sync.link(a); A.E.Sync.stopPolling(); a.locked = true;
  const op = { type: 'upsert', entity: 'contracts', code: 'T0001', key: 'k', value: 1, at: '2026-10-10T09:00:00.000Z', summary: 'تعديل الإيجار', changed: ['rent'], record: { code: 'T0001', rent: 45000 } };
  await A.E.Sync.record(op);
  A.kill();
  const B = tab(store, { pollMs: 100000 }, A.sess);
  assert.deepStrictEqual(B.E.Sync.pendingOps(), [op]);
});

/* ===================== 2: تعديل خارجي أثناء التسلسل ===================== */
test('2: an external save landing while serialize() runs is read and merged, not overwritten', async (t) => {
  t.after(cleanup);
  const A = tab({}, { serializeMs: 80 });
  A.state = { items: { a: 1 } };
  const a = A.E.FileLink.memoryAdapter(enc(JSON.stringify(A.state)));
  await A.E.Sync.link(a);
  A.state.items.b = 2; const p = A.E.Sync.record({ type: 'upsert', key: 'b', value: 2 });
  await tick(30);                                                                   // داخل التسلسل
  a.externalWrite(enc(JSON.stringify({ items: { a: 1, x: 'from-excel' } })));      // Excel/OneDrive يحفظ الآن
  assert.strictEqual(await p, true);
  await tick(100);
  assert.deepStrictEqual(JSON.parse(dec(a.bytes())).items, { a: 1, x: 'from-excel', b: 2 });
  assert.deepStrictEqual(A.state.items, { a: 1, x: 'from-excel', b: 2 });
  assert.strictEqual(A.external, 1, 'the external change was announced once');
  assert.strictEqual(A.serializes, 2, 'serialized again after the re-read');
  assert.strictEqual(A.E.Sync.status.pending, 0);
});

test('2b: while locked, retries probe the lock instead of serializing the whole workbook; after unlock the Excel edit and all ops land', async (t) => {
  t.after(cleanup);
  const A = tab({});
  const a = A.E.FileLink.memoryAdapter(enc(JSON.stringify(A.state)));
  await A.E.Sync.link(a);
  a.locked = true;
  for (let i = 0; i < 12; i++) { A.state.items['k' + i] = i; A.E.Sync.record({ type: 'upsert', key: 'k' + i, value: i }); await tick(25); }
  await tick(150);
  assert.strictEqual(A.E.Sync.status.pending, 12);
  assert.strictEqual(A.E.Sync.status.state, 'locked');
  assert.strictEqual(A.serializes, 1, 'only the first attempt serialized; the retries probed the lock');
  assert.ok(a.probes >= 5, 'probes: ' + a.probes);
  a.externalWrite(enc(JSON.stringify({ items: { excel: 'edited-while-locked' } }))); a.locked = false;   // Excel يحفظ عند الإغلاق
  await until(() => A.E.Sync.status.state === 'linked' && A.E.Sync.status.pending === 0, 3000);
  const f = JSON.parse(dec(a.bytes())).items;
  assert.strictEqual(f.excel, 'edited-while-locked'); for (let i = 0; i < 12; i++) assert.strictEqual(f['k' + i], i);
  assert.strictEqual(a.writes, 1);
});

/* ===================== 9: تعديل خارجي تعذّرت قراءته ===================== */
test('9: an external change that cannot be parsed is never overwritten by record/flush; once Excel saves a readable file it is read and the pending ops are written on top', async (t) => {
  t.after(cleanup);
  const A = tab({}, { pollMs: 20 });
  A.state = { items: { a: 1 } };
  const a = A.E.FileLink.memoryAdapter(enc(JSON.stringify(A.state)));
  await A.E.Sync.link(a);
  a.externalWrite(enc('PK\u0003\u0004 not-a-complete-zip'));
  await until(() => A.E.Sync.status.state === 'error', 1000);
  A.state.items.b = 2; const ok = await A.E.Sync.record({ type: 'upsert', key: 'b', value: 2 });   // تعديل من الموقع (أو زر «إعادة المحاولة»)
  assert.strictEqual(ok, false);
  assert.strictEqual(await A.E.Sync.flush(), false);
  await tick(60);
  assert.strictEqual(a.writes, 0, 'no write while the external file is unread');
  assert.strictEqual(A.E.Sync.status.state, 'error');
  assert.ok(/تعذّرت قراءته/.test(A.E.Sync.status.error), A.E.Sync.status.error);
  assert.strictEqual(A.E.Sync.status.pending, 1);
  a.externalWrite(enc(JSON.stringify({ items: { a: 1, x: 'fixed-in-excel' } })));        // Excel يحفظ نسخة سليمة
  await until(() => A.E.Sync.status.state === 'linked' && A.E.Sync.status.pending === 0 && a.writes >= 1, 3000);
  assert.deepStrictEqual(JSON.parse(dec(a.bytes())).items, { a: 1, x: 'fixed-in-excel', b: 2 });
});

test('9b: Sync.forceWrite() replaces an unreadable external file with the site copy (explicit action only)', async (t) => {
  t.after(cleanup);
  const A = tab({}, { pollMs: 20 });
  A.state = { items: { a: 1 } };
  const a = A.E.FileLink.memoryAdapter(enc(JSON.stringify(A.state)));
  await A.E.Sync.link(a);
  a.externalWrite(enc('garbage'));
  await until(() => A.E.Sync.status.state === 'error', 1000);
  A.state.items.b = 2; await A.E.Sync.record({ type: 'upsert', key: 'b', value: 2 });
  assert.strictEqual(a.writes, 0);
  assert.strictEqual(await A.E.Sync.forceWrite(), true);
  assert.strictEqual(a.writes, 1);
  assert.deepStrictEqual(JSON.parse(dec(a.bytes())).items, { a: 1, b: 2 });
  assert.strictEqual(A.E.Sync.status.state, 'linked'); assert.strictEqual(A.E.Sync.status.pending, 0);
  await tick(80); assert.strictEqual(a.writes, 1, 'no further writes/polls churn');
});

test('9c: while an external change stays unreadable, the poll tick and the write retry emit one and the same error text (no flicker between two messages)', async (t) => {
  t.after(cleanup);
  const seen = []; let collecting = false;
  const A = tab({}, { pollMs: 20, onStatus: s => { if (collecting && s.state === 'error' && s.error) seen.push(s.error); } });
  A.state = { items: { a: 1 } };
  const a = A.E.FileLink.memoryAdapter(enc(JSON.stringify(A.state)));
  await A.E.Sync.link(a);
  a.externalWrite(enc('garbage'));
  await until(() => A.E.Sync.status.state === 'error', 1000);
  A.state.items.b = 2; await A.E.Sync.record({ type: 'upsert', key: 'b', value: 2 });
  collecting = true;
  await tick(250);                                                                   // عدة دورات استطلاع + عدة محاولات كتابة
  assert.strictEqual(a.writes, 0);
  assert.ok(seen.length >= 4, 'emitted ' + seen.length);
  assert.strictEqual(new Set(seen).size, 1, 'texts: ' + JSON.stringify([...new Set(seen)]));
  assert.ok(/تعذّرت قراءته/.test(seen[0]) && /\(1\)/.test(seen[0]), seen[0]);
});

/* ===================== 5: بدء التشغيل والملف مفتوح في Excel ===================== */
test('5: start-up with journaled ops while Excel holds the file: the retry survives startPolling and writes once Excel closes without saving', async (t) => {
  t.after(cleanup);
  const store = { [KEY]: JSON.stringify([{ type: 'upsert', key: 'z', value: 9 }]) };   // دفتر بالصيغة القديمة (بلا بيانات وصفية)
  const A = tab(store);
  assert.strictEqual(A.E.Sync.status.pending, 1);
  const a = A.E.FileLink.memoryAdapter(enc(JSON.stringify({ items: { q: 1 } })));
  a.locked = true;
  await A.E.Sync.link(a, { writeOnLink: true });
  assert.strictEqual(A.E.Sync.status.state, 'locked'); assert.strictEqual(A.E.Sync.status.pending, 1);
  await tick(200);
  assert.strictEqual(a.writes, 0);
  a.locked = false;                                                                   // Excel أُغلق بلا حفظ (وقت التعديل لم يتغيّر)
  await until(() => A.E.Sync.status.state === 'linked' && A.E.Sync.status.pending === 0, 2000);
  assert.ok(a.writes >= 1);
  assert.deepStrictEqual(JSON.parse(dec(a.bytes())).items, { q: 1, z: 9 });
  assert.strictEqual(J(store).length, 0);
});

/* ===================== 6: الدفتر مربوط بالملف ===================== */
test('6: ops recorded on file A are not written into file B; they are stashed, reported in status.note / Sync.stashed(), and restored when A is linked again', async (t) => {
  t.after(cleanup);
  const store = {};
  const A = tab(store, { pollMs: 100000 });
  const fileA = A.E.FileLink.memoryAdapter(enc(JSON.stringify({ items: { a: 1 } })), 'Egary.xlsx');
  await A.E.Sync.link(fileA); A.E.Sync.stopPolling();
  fileA.locked = true;
  A.state.items.pay = 5000; await A.E.Sync.record({ type: 'upsert', key: 'pay', value: 5000 });
  assert.strictEqual(A.E.Sync.status.state, 'locked');
  assert.strictEqual(J(store, KEY + ':meta').file, 'Egary.xlsx', 'journal remembers its file');
  // «ربط ملف إكسيل آخر»: unlink + reload (نفس التبويب) ثم اختيار ملف آخر
  A.E.Sync.unlink(); A.kill();
  const B = tab(store, { pollMs: 100000 }, A.sess);
  assert.strictEqual(B.E.Sync.status.pending, 1);
  const fileB = B.E.FileLink.memoryAdapter(enc(JSON.stringify({ items: { other: 'office-B' } })), 'Egary-2025.xlsx');
  await B.E.Sync.link(fileB, { writeOnLink: true }); B.E.Sync.stopPolling();
  assert.deepStrictEqual(JSON.parse(dec(fileB.bytes())).items, { other: 'office-B' }, 'B untouched by A\'s ops');
  assert.strictEqual(B.E.Sync.status.pending, 0);
  assert.ok(/Egary\.xlsx/.test(B.E.Sync.status.note) && /معلّق/.test(B.E.Sync.status.note), B.E.Sync.status.note);
  assert.deepStrictEqual(B.E.Sync.stashed().map(s => [s.file, s.count]), [['Egary.xlsx', 1]]);
  assert.deepStrictEqual(B.E.Sync.stashed()[0].ops, [{ type: 'upsert', key: 'pay', value: 5000 }]);
  // تعديل على B يُكتب في B وحده
  B.state.items.b1 = 1; await B.E.Sync.record({ type: 'upsert', key: 'b1', value: 1 });
  assert.deepStrictEqual(JSON.parse(dec(fileB.bytes())).items, { other: 'office-B', b1: 1 });
  // ربط A من جديد: العمليات المحفوظة جانبًا تُطبَّق وتُكتب
  B.E.Sync.unlink(); fileA.locked = false;
  await B.E.Sync.link(fileA); B.E.Sync.stopPolling();
  assert.deepStrictEqual(JSON.parse(dec(fileA.bytes())).items, { a: 1, pay: 5000 });
  assert.deepStrictEqual(B.E.Sync.stashed(), []);
  assert.strictEqual(B.E.Sync.status.note, '');
  assert.strictEqual(B.E.Sync.status.pending, 0);
});

/* ===================== 7: دفتر لكل تبويب ===================== */
test('7: two tabs on one file keep separate journals; the first owns the legacy key; a closed tab\'s ops are adopted and written by the survivor', async (t) => {
  t.after(cleanup);
  const store = {};
  const A = tab(store), B = tab(store);
  assert.strictEqual(A.E.Sync.journalKey, KEY);
  assert.strictEqual(B.E.Sync.journalKey, KEY + ':' + B.E.Sync.tabId);
  assert.notStrictEqual(A.E.Sync.tabId, B.E.Sync.tabId);
  const file = A.E.FileLink.memoryAdapter(enc(JSON.stringify({ items: { a: 1 } })));
  await A.E.Sync.link(file); await B.E.Sync.link(file);
  file.locked = true;
  A.state.items.fromA = 1; A.E.Sync.record({ type: 'upsert', key: 'fromA', value: 1 });
  await tick(20);
  B.state.items.fromB = 1; B.E.Sync.record({ type: 'upsert', key: 'fromB', value: 1 });
  await tick(150);                                                                  // > staleMs: تبويب حيّ لا يُتبنّى
  assert.deepStrictEqual(J(store).map(o => o.key), ['fromA'], 'legacy key = tab A only');
  assert.deepStrictEqual(J(store, B.E.Sync.journalKey).map(o => o.key), ['fromB'], 'tab B has its own key');
  assert.strictEqual(A.E.Sync.status.pending, 1); assert.strictEqual(B.E.Sync.status.pending, 1);
  assert.deepStrictEqual(J(store, KEY + ':tabs'), [B.E.Sync.tabId]);
  // التبويب B يُغلق قبل فكّ القفل
  const bKey = B.E.Sync.journalKey;
  B.close();
  await until(() => A.E.Sync.status.pending === 2, 1000);
  assert.deepStrictEqual(A.E.Sync.pendingOps().map(o => o.key).sort(), ['fromA', 'fromB'].sort());
  assert.strictEqual(A.state.items.fromB, 1, 'adopted op applied to the survivor\'s state');
  assert.strictEqual(store[bKey], undefined, 'orphan key removed'); assert.strictEqual(store[bKey + ':meta'], undefined);
  assert.strictEqual(store[KEY + ':tabs'], undefined);
  file.locked = false;
  await until(() => A.E.Sync.status.state === 'linked' && A.E.Sync.status.pending === 0, 2000);
  assert.deepStrictEqual(JSON.parse(dec(file.bytes())).items, { a: 1, fromA: 1, fromB: 1 });
  // تبويب جديد بعد ذلك: لا شيء يُعاد
  const C = tab(store); await C.E.Sync.link(file); C.E.Sync.stopPolling();
  assert.strictEqual(C.E.Sync.status.pending, 0); assert.deepStrictEqual(C.state.items, { a: 1, fromA: 1, fromB: 1 });
});

test('7b: journals left by crashed tabs (stale heartbeat) are adopted at start-up — both a suffixed key and the legacy key — and written on link; a reload keeps the same key', async (t) => {
  t.after(cleanup);
  const old = Date.now() - 100000;
  const store = {
    [KEY]: JSON.stringify([{ type: 'upsert', key: 'fromDead1', value: 1 }]),
    [KEY + ':meta']: JSON.stringify({ tab: 'dead1', touched: old, file: 'Egary.xlsx', mtime: 1 }),
    [KEY + ':dead2']: JSON.stringify([{ type: 'upsert', key: 'fromDead2', value: 2 }]),
    [KEY + ':dead2:meta']: JSON.stringify({ tab: 'dead2', touched: old, file: 'Egary.xlsx', mtime: 1 }),
    [KEY + ':dead3']: JSON.stringify([{ type: 'upsert', key: 'otherFile', value: 3 }]),
    [KEY + ':dead3:meta']: JSON.stringify({ tab: 'dead3', touched: old, file: 'Other.xlsx', mtime: 1 }),
    [KEY + ':tabs']: JSON.stringify(['dead2', 'dead3']),
  };
  const A = tab(store, { pollMs: 100000 });
  assert.strictEqual(A.E.Sync.journalKey, KEY, 'took over the legacy key from the dead tab');
  assert.deepStrictEqual(A.E.Sync.pendingOps().map(o => o.key).sort(), ['fromDead1', 'fromDead2']);
  assert.deepStrictEqual(A.E.Sync.stashed().map(s => [s.file, s.count]), [['Other.xlsx', 1]], 'ops of another file go to the stash');
  assert.strictEqual(store[KEY + ':dead2'], undefined); assert.strictEqual(store[KEY + ':tabs'], undefined);
  const file = A.E.FileLink.memoryAdapter(enc(JSON.stringify({ items: { a: 1 } })), 'Egary.xlsx');
  await A.E.Sync.link(file); A.E.Sync.stopPolling();
  assert.deepStrictEqual(JSON.parse(dec(file.bytes())).items, { a: 1, fromDead1: 1, fromDead2: 2 });
  assert.strictEqual(A.E.Sync.status.pending, 0);
  // إعادة تحميل نفس التبويب: نفس المعرّف ونفس المفتاح رغم أن النبض حديث
  A.kill();
  const A2 = tab(store, { pollMs: 100000 }, A.sess);
  assert.strictEqual(A2.E.Sync.tabId, A.E.Sync.tabId); assert.strictEqual(A2.E.Sync.journalKey, KEY);
});

test('7c: a tab whose journal was adopted by another tab drops it from memory (storage event), so nothing is replayed twice', async (t) => {
  t.after(cleanup);
  const store = {};
  const A = tab(store), B = tab(store);
  const file = A.E.FileLink.memoryAdapter(enc(JSON.stringify({ items: {} })));
  await B.E.Sync.link(file); B.E.Sync.stopPolling(); file.locked = true;
  B.state.items.x = 1; await B.E.Sync.record({ type: 'upsert', key: 'x', value: 1 });
  assert.strictEqual(B.E.Sync.status.pending, 1);
  delete store[B.E.Sync.journalKey];                                                 // تبويب آخر تبنّى الدفتر
  B.fire('storage', { key: B.E.Sync.journalKey, newValue: null });
  assert.strictEqual(B.E.Sync.status.pending, 0);
  A.kill();
});

test('7d: an orphaned journal missing from the «:tabs» registry (lost registration) is still adopted when localStorage offers key()', async (t) => {
  t.after(cleanup);
  const old = Date.now() - 100000;
  const store = {
    [KEY + ':ghost']: JSON.stringify([{ type: 'upsert', key: 'ghost', value: 1 }]),
    [KEY + ':ghost:meta']: JSON.stringify({ tab: 'ghost', touched: old, file: 'Egary.xlsx', mtime: 1 }),
    [KEY + ':stash']: JSON.stringify({ 'Other.xlsx': { at: 1, mtime: 1, ops: [{ type: 'upsert', key: 'o', value: 1 }] } }),
  };
  const A = tab(store, { pollMs: 100000 });
  assert.deepStrictEqual(A.E.Sync.pendingOps(), [], 'the fake storage has no key(): nothing scanned');
  Object.defineProperty(global.localStorage, 'length', { get: () => Object.keys(store).length });
  global.localStorage.key = i => Object.keys(store)[i] || null;
  A.E.Sync.adoptOrphans();
  assert.deepStrictEqual(A.E.Sync.pendingOps().map(o => o.key), ['ghost']);
  assert.strictEqual(store[KEY + ':ghost'], undefined); assert.strictEqual(store[KEY + ':ghost:meta'], undefined);
  assert.deepStrictEqual(A.E.Sync.stashed().map(x => [x.file, x.count]), [['Other.xlsx', 1]], 'the stash and :meta/:tabs keys are never mistaken for tab journals');
  assert.strictEqual(store[KEY + ':tabs'], undefined);
});

test('6b: the stash note counts in correct Arabic (1, 2, 3–10, 11+)', async (t) => {
  t.after(cleanup);
  const mk = n => Array.from({ length: n }, (_, i) => ({ type: 'upsert', key: 'k' + i, value: i }));
  const store = { [KEY + ':stash']: JSON.stringify({ 'A.xlsx': { at: 1, mtime: 1, ops: mk(1) }, 'B.xlsx': { at: 1, mtime: 1, ops: mk(2) }, 'C.xlsx': { at: 1, mtime: 1, ops: mk(7) }, 'D.xlsx': { at: 1, mtime: 1, ops: mk(12) } }) };
  const A = tab(store, { pollMs: 100000 });
  assert.strictEqual(A.E.Sync.status.note, 'يوجد تعديل واحد معلّق يخص الملف A.xlsx؛ يوجد تعديلان معلّقان يخصان الملف B.xlsx؛ توجد 7 تعديلات معلّقة تخص الملف C.xlsx؛ يوجد 12 تعديلًا معلّقًا يخص الملف D.xlsx');
  assert.strictEqual(A.E.Sync.discardStash('C.xlsx'), true);
  assert.ok(!/C\.xlsx/.test(A.E.Sync.status.note));
});

/* ===================== 2 (المكدّس كامل): حفظ خارجي أثناء تسلسل المصنّف ===================== */
async function editLedgerCell(bytes, code, period, value) {   // ما يفعله شخص في Excel: يكتب رقمًا في خانة الشهر
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(bytes);
  const ws = wb.getWorksheet(period.slice(0, 4));
  let rowN = 0; ws.eachRow((rw, n) => { if (String(rw.getCell(25).value) === code) rowN = n; });
  if (!rowN) throw new Error('row not found ' + code);
  ws.getRow(rowN).getCell(10 + parseInt(period.slice(5), 10)).value = value;
  const out = await wb.xlsx.writeBuffer(); return out instanceof ArrayBuffer ? out : new Uint8Array(out).buffer.slice(out.byteOffset || 0, (out.byteOffset || 0) + out.byteLength);
}
async function readCell(bytes, code, period) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(bytes);
  const ws = wb.getWorksheet(period.slice(0, 4));
  let v = null; ws.eachRow(rw => { if (String(rw.getCell(25).value) === code) v = rw.getCell(10 + parseInt(period.slice(5), 10)).value; });
  return v;
}
test('2c (full stack): locked + pending, Excel saves and closes while the retry is serializing the workbook → the Excel cell is re-read and kept, the web payment lands too', async (t) => {
  const E = load({ today: '2026-10-10' });
  t.after(() => E.Sync.stopPolling());
  const original = readFile(DEMO);
  const edited = await editLedgerCell(original, 'T0005', '2026-11', 76000);
  let a, armed = false, fired = 0, lastBytes = null;
  E.Sync.init({
    serialize: async () => { if (armed && !fired) { fired = Date.now(); setTimeout(() => { a.externalWrite(edited); a.locked = false; }, 30); } const buf = await E.Workbook.write(E.Store.state(), { base: lastBytes }); lastBytes = buf; return buf; },
    deserialize: async (buf) => { const r = await E.Workbook.read(buf, { snapshot: null }); lastBytes = buf; E.Store.load(r.state); },
    applyOps: ops => E.Store.applyOps(ops),
    pollMs: 40, debounceMs: 0, retryMs: 100, settleMs: 10,
  });
  E.Store.setRecorder(op => E.Sync.record(op));
  a = E.FileLink.memoryAdapter(original, 'Egary.xlsx');
  a.probe = undefined;                                                               // محوِّل بلا جسّ قفل (أو كاتب خارجي غير Excel مثل OneDrive)
  await E.Sync.link(a, { writeOnLink: false });
  a.locked = true;
  E.Store.upsert('payments', Object.assign(E.M.blank.payments(), { code: E.Codes.nextInvoice(E.Store.state(), '2026'), contractCode: 'T0003', period: '2026-12', amount: 41000, paidOn: '2026-12-03', method: 'cash' }), 'دفعة ديسمبر');
  await until(() => E.Sync.status.state === 'locked', 5000);
  armed = true;
  await until(() => fired && E.Sync.status.state === 'linked' && E.Sync.status.pending === 0 && a.writes >= 1, 15000);
  await tick(200);
  assert.strictEqual(await readCell(a.bytes(), 'T0005', '2026-11'), 76000, 'Excel edit kept');
  assert.strictEqual(await readCell(a.bytes(), 'T0003', '2026-12'), 41000, 'web payment written');
  assert.strictEqual(E.Store.paymentsOfCell('T0005', '2026-11').length, 1);
  assert.ok(E.Sync.status.lastExternal, 'the external change was read, not silently overwritten');
});

/* ===================== 3: سجل العمليات ===================== */
function fakeDir(name, failOn) {
  const files = new Map();
  const mk = (n) => ({ kind: 'file', async getFile() { const b = files.get(n); return { size: b ? b.text.length : 0, lastModified: b ? b.at : 0 }; }, async createWritable(o) { if (failOn && failOn(n)) { const e = new Error('NotAllowedError: permission revoked'); e.name = 'NotAllowedError'; throw e; } const keep = !!(o && o.keepExistingData); let txt = keep && files.has(n) ? files.get(n).text : ''; return { write: async (d) => { const pos = d.position == null ? txt.length : d.position; txt = txt.slice(0, pos) + d.data; }, close: async () => { files.set(n, { text: txt, at: Date.now() }); } }; } });
  const dir = { name, kind: 'directory', async getDirectoryHandle() { if (failOn && failOn('/dir')) { const e = new Error('revoked'); e.name = 'NotAllowedError'; throw e; } return dir; }, async getFileHandle(n) { return mk(n); }, async removeEntry(n) { files.delete(n); }, async *entries() { for (const [n] of files) yield [n, mk(n)]; }, files };
  return dir;
}
const rowsOf = (dir, name) => (dir.files.get(name) ? dir.files.get(name).text.trim().split('\r\n').length - 1 : 0);

test('3: Log.setDir() with an empty buffer (normal start-up) does not wedge flush(): later entries are written; an empty manual flush does not wedge it either', async () => {
  const dir = fakeDir('Egary');
  let E = load({ today: '2026-10-10' });
  E.Log.append({ at: '2026-10-10 09:00:00', user: 'المدير', action: 'إضافة', entity: 'عميل', code: 'C100', summary: 'a' });
  await E.Log.setDir(dir);
  assert.strictEqual(rowsOf(dir, 'Egary-log-2026-10.csv'), 1);
  // الجلسة الثانية: المتصفح أُعيد تشغيله، المخزن فارغ، المجلد يُستعاد عند الإقلاع
  E = load({ today: '2026-10-10' });
  assert.strictEqual(E.Log.status().buffered, 0);
  await E.Log.setDir(dir);
  for (let i = 0; i < 3; i++) E.Log.append({ at: '2026-10-10 10:0' + i + ':00', user: 'موظف', action: 'إضافة', entity: 'دفعة', code: 'INV-2026-051' + i, summary: 'b' });
  assert.strictEqual(await E.Log.flush(), true);
  assert.strictEqual(rowsOf(dir, 'Egary-log-2026-10.csv'), 4);
  assert.strictEqual(E.Log.status().buffered, 0);
  await E.Log.flush(); await E.Log.flush();                                          // «كتابة الآن» بلا شيء مخزّن
  E.Log.append({ at: '2026-10-10 11:00:00', user: 'موظف', action: 'حذف', entity: 'دفعة', code: 'INV-2026-0513', summary: 'c' });
  await E.Log.flush();
  assert.strictEqual(rowsOf(dir, 'Egary-log-2026-10.csv'), 5);
  assert.strictEqual(E.Log.status().buffered, 0); assert.strictEqual(E.Log.status().error, null);
});

test('3b: two month files where the second append fails: the first month\'s rows are not appended again on recovery; a revoked folder keeps entries buffered until it works', async () => {
  const E = load({ today: '2026-10-10' });
  const L = E.Log;
  L.append({ at: '2026-10-31 23:50:00', user: 'المدير', action: 'إضافة', entity: 'عميل', code: 'C100', summary: 'x' });
  L.append({ at: '2026-11-01 00:10:00', user: 'المدير', action: 'تعديل', entity: 'عميل', code: 'C100', summary: 'y' });
  const fail = { nov: true, dir: false };
  const dir = fakeDir('Egary', n => (n === '/dir' ? fail.dir : fail.nov && n.endsWith('2026-11.csv')));
  await L.setDir(dir);
  assert.ok(L.status().error); assert.strictEqual(L.status().buffered, 1); assert.strictEqual(L.status().written, 1);
  assert.strictEqual(rowsOf(dir, 'Egary-log-2026-10.csv'), 1);
  fail.nov = false; assert.strictEqual(await L.flush(), true);
  assert.strictEqual(rowsOf(dir, 'Egary-log-2026-10.csv'), 1, 'October not duplicated');
  assert.strictEqual(rowsOf(dir, 'Egary-log-2026-11.csv'), 1);
  assert.strictEqual(L.status().written, 2); assert.strictEqual(L.status().buffered, 0); assert.strictEqual(L.status().error, null);
  // المجلد سُحب إذنه: تبقى الصفوف مخزّنة ثم تُكتب حين يعود
  fail.dir = true;
  L.append({ at: '2026-11-02 09:00:00', user: 'موظف', action: 'إضافة', entity: 'عميل', code: 'C101', summary: 'z' });
  assert.strictEqual(await L.flush(), false); assert.strictEqual(L.status().buffered, 1); assert.ok(L.status().error);
  fail.dir = false; assert.strictEqual(await L.flush(), true);
  assert.strictEqual(L.status().buffered, 0); assert.strictEqual(rowsOf(dir, 'Egary-log-2026-11.csv'), 2);
});

test('3c: log entries and the CSV download name use the local wall clock (E.U.stamp), not UTC', async () => {
  const E = load({ today: '2026-10-10' });
  let e, stamp;
  for (let i = 0; i < 5; i++) { stamp = E.U.stamp(); e = E.Log.append({ action: 'دخول', entity: 'مستخدم', code: 'admin', summary: 's' }); if (e.at === stamp) break; }
  assert.strictEqual(e.at, stamp);
  assert.notStrictEqual(e.at, new Date().toISOString().slice(0, 19).replace('T', ' '), 'Riyadh is UTC+3 so the two differ');
  let dl = null; E.FileLink.downloadBytes = (buf, name) => { dl = name; };
  E.Log.downloadCsv([]);
  assert.strictEqual(dl, 'Egary-log-' + E.U.stamp().slice(0, 10) + '.csv');
});
