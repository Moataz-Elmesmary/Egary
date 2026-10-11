// أشياء صغيرة من مراجعة جاهزية المكتب: رقم موبايل مكتوب في الإكسيل كرقم يستعيد الصفر الأول
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path'); const fs = require('fs');
const { load, ROOT } = require('./helpers/env');
const E = load({ today: '2026-10-09' });

test('phones typed as numbers in «العملاء» get their leading 0 back (Latin or Arabic digits); landlines and text stay as typed', async () => {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(fs.readFileSync(path.join(ROOT, 'Egary.xlsx')));
  const ws = wb.getWorksheet('العملاء'); let col = 0, col2 = 0;
  ws.getRow(1).eachCell((c, i) => { if (c.value === 'التليفون') col = i; if (c.value === 'تليفون آخر') col2 = i; });
  assert.ok(col && col2, 'phone columns found');
  ws.getCell(2, col).value = 1001112233; ws.getCell(3, col).value = '١٠٠١١١٢٢٣٣'; ws.getCell(4, col).value = '0223456789'; ws.getCell(5, col).value = '+20 100 111 2233';
  ws.getCell(2, col2).value = 1201234567;
  const r = await E.Workbook.read(await wb.xlsx.writeBuffer());
  const by = Object.fromEntries(r.state.clients.slice(0, 4).map((c, i) => [i, c]));
  assert.deepEqual([by[0].phone, by[1].phone, by[2].phone, by[3].phone, by[0].phone2], ['01001112233', '01001112233', '0223456789', '+20 100 111 2233', '01201234567']);
});
