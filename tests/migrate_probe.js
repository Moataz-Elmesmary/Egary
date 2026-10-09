const { load, readFile, SOURCE } = require('./helpers/env');
const fs = require('fs');
(async () => {
  const E = load({ today: '2026-10-09' });
  const t0 = Date.now();
  const res = await E.Workbook.read(readFile(SOURCE));
  console.log('read ms', Date.now() - t0, 'migrated', res.migrated);
  const st = res.state;
  console.log('projects', st.projects.map(p => p.code + ' ' + p.name).join(' | '));
  console.log('units', st.units.length, 'clients', st.clients.length, 'contracts', st.contracts.length, 'payments', st.payments.length, 'sum', st.payments.reduce((s, p) => s + p.amount, 0));
  console.log('flags', res.flags.length); for (const f of res.flags) console.log('  ', f.sev, f.code, f.text);
  E.Store.load(st);
  const k = E.Engine.kpis({});
  console.log('KPIs: month', k.month.collected, '/', k.month.due, 'ytd', k.ytd.collected, 'arrears', k.arrears.total, 'rows', k.arrears.rows.length, 'occ', k.occupancy.occupiedCount + '/' + k.occupancy.total, 'vacant', k.occupancy.vacant.map(v => v.unit.label + ':' + v.vacantDays).join(','), 'longVacant', k.occupancy.longVacant.length, 'ending', k.renewals.soon.length, 'ended', k.renewals.ended.length, 'next12', k.next12.total, 'gaps', k.gaps.map(g => g.unitLabel + ':' + g.days).join(','));
  console.log('sample contracts:'); for (const c of st.contracts.slice(0, 8).concat(st.contracts.filter(c => ['P03-304', 'P03-204', 'P03-105', 'P02-301'].includes(c.unitCode)))) console.log('  ', c.code, c.unitCode, c.clientCode, c.start, c.end, 'rent', c.rent, 'inc', c.increasePct, 'ov', JSON.stringify(c.rentOverrides), 'sched', E.Engine.schedule(c).map(y => y.k + ':' + y.rent).join(' '));
  console.log(E.Engine.insights(k).map(i => i.sev + ': ' + i.title + ' — ' + i.text).join('\n'));
  const t1 = Date.now();
  const out = await E.Workbook.write(st);
  console.log('write ms', Date.now() - t1, 'bytes', out.byteLength);
  fs.writeFileSync(__dirname + '/out/Egary.xlsx', Buffer.from(out));
  // re-read
  const res2 = await E.Workbook.read(out);
  const s2 = res2.state;
  console.log('reread migrated?', res2.migrated, 'units', s2.units.length, 'clients', s2.clients.length, 'contracts', s2.contracts.length, 'payments', s2.payments.length, 'flags', res2.flags.length);
  for (const f of res2.flags) console.log('  ', f.sev, f.code, f.text);
  const strip = s => JSON.stringify({ p: s.projects, u: s.units, c: s.clients, k: s.contracts.map(c => ({ ...c, createdAt: '' })), pay: s.payments.map(p => ({ ...p, createdAt: '' })), m: s.maintenance });
  console.log('deep equal after round trip:', strip(st) === strip(s2));
  if (strip(st) !== strip(s2)) { const a = JSON.parse(strip(st)), b = JSON.parse(strip(s2)); for (const key of Object.keys(a)) { for (let i = 0; i < a[key].length; i++) if (JSON.stringify(a[key][i]) !== JSON.stringify(b[key][i])) { console.log('DIFF', key, i, JSON.stringify(a[key][i]), '\n   vs', JSON.stringify(b[key][i])); break; } } }
})().catch(e => { console.error(e); process.exit(1); });
