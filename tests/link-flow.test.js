// تدفق الربط الحقيقي (file-link.js + IndexedDB) بمحاكاة showOpenFilePicker بمقبض ملف وهمي في الذاكرة
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path'); const fs = require('fs');
const { chromium } = require('playwright');
const URL_ = 'file://' + path.resolve(__dirname, '../Egary/index.html');
const XLSX_B64 = fs.readFileSync(path.resolve(__dirname, '../Egary/Egary.xlsx')).toString('base64');
let browser;
test.before(async () => { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }); });
test.after(async () => { await browser.close(); });

// مقبض وهمي يحاكي FileSystemFileHandle: الملف يعيش في window.__fakeFile (يبقى عبر إعادة التحميل داخل نفس السياق عبر sessionStorage)
const FAKE = require('./helpers/fake-handle');

test('link flow: pick file → permission → app shows real data → an edit writes the file → reload restores the handle and resumes without re-picking', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  await ctx.addInitScript(FAKE(XLSX_B64));
  await ctx.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { if (window.Egary && window.Egary.U) window.Egary.U.setToday('2026-10-09'); }, { once: true }); });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL_); await page.waitForSelector('#btn-link');
  await page.click('#btn-link');
  try { await page.waitForSelector('.kpi', { timeout: 40000 }); } catch (e) {
    console.log('DIAG errors:', errors, 'toasts:', await page.$$eval('.toast', els => els.map(x => x.textContent)), 'picked:', await page.evaluate(() => window.__picked), 'sync:', await page.evaluate(() => JSON.stringify(Egary.Sync.status)), 'root:', (await page.evaluate(() => document.getElementById('root').innerText)).slice(0, 300));
    throw e;
  }
  assert.equal(await page.evaluate(() => window.__picked), true);
  assert.ok((await page.$$eval('.nav .cnt', els => els.map(e => e.textContent))).join(',').startsWith('3,71,64,73,509'));
  await page.waitForFunction(() => document.querySelector('#sync-status').classList.contains('linked'));
  const w0 = await page.evaluate(() => window.__writes || 0);
  assert.ok(w0 >= 1, 'linking writes the upgraded workbook back once: ' + w0);
  // تعديل: مشروع جديد → يُكتب في الملف الوهمي
  await page.goto(URL_ + '#/projects'); await page.waitForSelector('text=مشروع جديد');
  await page.click('text=مشروع جديد'); await page.waitForSelector('.modal #f_name');
  await page.fill('.modal #f_name', 'مشروع الاختبار الرابط'); await page.click('.modal .m-foot .btn.primary');
  await page.waitForFunction((w) => (window.__writes || 0) > w, w0);
  await page.waitForFunction(() => document.querySelector('#sync-status').classList.contains('linked'));
  const has = await page.evaluate(async () => { const b64 = window.__fileBytes(); const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer; const r = await Egary.Workbook.read(buf); return r.state.projects.some(p => p.name === 'مشروع الاختبار الرابط'); });
  assert.equal(has, true, 'the new project is in the file bytes');
  // إعادة تحميل: المقبض محفوظ في IndexedDB ⇒ شاشة «متابعة» ثم استئناف بلا اختيار ملف
  await page.evaluate(() => { window.__picked = false; sessionStorage.setItem('__perm', 'prompt'); });
  await page.reload(); await page.waitForSelector('#btn-resume', { timeout: 40000 });
  assert.ok((await page.textContent('#btn-resume')).includes('Egary.xlsx'));
  await page.click('#btn-resume'); await page.waitForSelector('#content .page-head', { timeout: 40000 }); await page.waitForFunction(() => document.querySelector('#sync-status').classList.contains('linked'));
  assert.notEqual(await page.evaluate(() => window.__picked), true, 'no re-pick needed');
  assert.equal(await page.evaluate(() => Egary.Store.state().projects.length), 4);
  // ومع إذن محفوظ (Chrome يحفظه) يبدأ مباشرة بلا شاشة
  await page.evaluate(() => sessionStorage.setItem('__perm', 'granted'));
  await page.reload(); await page.waitForSelector('#content .page-head', { timeout: 40000 });
  assert.equal(await page.$('#btn-resume'), null);
  // تعديل خارجي على الملف الوهمي (كأن Excel حفظه) → يظهر خلال المهلة
  const edited = await page.evaluate(async () => { const b64 = window.__fileBytes(); const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer; const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf); const ws = wb.getWorksheet('2026'); let row = 0; for (let r = 3; r <= ws.rowCount; r++) if (ws.getCell(r, 25).value === 'T0001') { row = r; break; } ws.getCell(row, 19).value = 12705; const out = await wb.xlsx.writeBuffer(); const u8 = new Uint8Array(out); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); window.__externalEdit(btoa(s)); return row; });
  assert.ok(edited > 0);
  await page.waitForFunction(() => { const p = Egary.Store.paymentsOfCell('T0001', '2026-09'); return p.length === 1 && p[0].amount === 12705; }, null, { timeout: 20000 });
  assert.deepEqual(errors, []);
  await ctx.close();
});
