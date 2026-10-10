// يبني Egary/Egary.xlsx (الملف الذي يُرسَل مع المجلد) من ملف المالك الأصلي
const fs = require('fs'); const path = require('path');
const { load, readFile, SOURCE, ROOT } = require('./helpers/env');
(async () => {
  const E = load({ today: process.argv[2] || null });
  const src = process.argv[3] || SOURCE;
  const { state, flags } = await E.Workbook.read(readFile(src));
  state.meta.officeName = 'إيجاري';
  E.Store.load(state);
  // حسابات دخول للنسخة التجريبية/الاختبارات (الملف الحقيقي للمالك يبدأ بلا حسابات ⇒ شاشة الإنشاء الأولى)
  for (const [code, name, role, pass] of [['admin', 'المدير', 'admin', 'admin@2026'], ['office', 'موظف المكتب', 'staff', 'office@2026'], ['zaer', 'زائر', 'viewer', 'view@2026']]) { const r = await E.Auth.createUser({ code, name, role }, pass); if (r.errors) throw new Error(r.errors.join(' / ')); }
  state.audit = [];
  const buf = await E.Workbook.write(state);
  const out = path.join(ROOT, 'Egary.xlsx');
  fs.writeFileSync(out, Buffer.from(buf));
  console.log('written', out, buf.byteLength, 'bytes;', state.projects.length, 'projects', state.units.length, 'units', state.clients.length, 'clients', state.contracts.length, 'contracts', state.payments.length, 'payments;', flags.length, 'flags');
})().catch(e => { console.error(e); process.exit(1); });
