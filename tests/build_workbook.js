// يبني Egary/Egary.xlsx (الملف الذي يُرسَل مع المجلد) من ملف المالك الأصلي
const fs = require('fs'); const path = require('path');
const { load, readFile, SOURCE, ROOT } = require('./helpers/env');
(async () => {
  const E = load({ today: process.argv[2] || null });
  const src = process.argv[3] || SOURCE;
  const { state, flags } = await E.Workbook.read(readFile(src));
  state.meta.officeName = 'إيجاري';
  E.Store.load(state);
  const buf = await E.Workbook.write(state);
  const out = path.join(ROOT, 'Egary.xlsx');
  fs.writeFileSync(out, Buffer.from(buf));
  console.log('written', out, buf.byteLength, 'bytes;', state.projects.length, 'projects', state.units.length, 'units', state.clients.length, 'clients', state.contracts.length, 'contracts', state.payments.length, 'payments;', flags.length, 'flags');
})().catch(e => { console.error(e); process.exit(1); });
