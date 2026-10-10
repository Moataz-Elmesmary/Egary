// تدفق النسخ الاحتياطي على القرص في المتصفح: عرض التفعيل بعد الربط → اختيار مجلد وهمي → نسخة أصلية → نسخة قبل الحذف → إعادة تحميل تستعيد المجلد
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path'); const fs = require('fs');
const { chromium } = require('playwright');
const URL_ = 'file://' + path.resolve(__dirname, '../Egary/index.html');
const XLSX_B64 = fs.readFileSync(path.resolve(__dirname, '../Egary/Egary.xlsx')).toString('base64');
const FAKE = require('./helpers/fake-handle');

async function loginAs(page, u, p) { await page.waitForSelector('#login-form', { timeout: 40000 }); await page.fill('#login-user', u); await page.fill('#login-pass', p); await page.click('#login-go'); await page.waitForSelector('#login', { state: 'detached', timeout: 20000 }); }
let browser;
test.before(async () => { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }); });
test.after(async () => { await browser.close(); });

// مجلد وهمي يحاكي FileSystemDirectoryHandle؛ الملفات تعيش في sessionStorage لتبقى عبر إعادة التحميل
const FAKE_DIR = `
(() => {
  const K = '__fake_dir_files';
  const load = () => { try { return JSON.parse(sessionStorage.getItem(K) || '{}'); } catch (e) { return {}; } };
  const save = (o) => sessionStorage.setItem(K, JSON.stringify(o));
  class FakeFile { constructor(n) { this.kind = 'file'; this.name = n; } async getFile() { const f = load()[this.name]; return { size: f ? f.size : 0, lastModified: f ? f.at : 0 }; } async createWritable() { const n = this.name; let size = 0; return { write: async (d) => { size += (d.byteLength || d.length || 0); }, close: async () => { const o = load(); o[n] = { size, at: Date.now() + Object.keys(o).length }; save(o); window.__dirWrites = (window.__dirWrites || 0) + 1; } }; } }
  class FakeDir {
    constructor() { this.kind = 'directory'; this.name = 'Egary'; }
    async queryPermission() { return sessionStorage.getItem('__dperm') || 'prompt'; }
    async requestPermission() { sessionStorage.setItem('__dperm', 'granted'); return 'granted'; }
    async getDirectoryHandle() { return this; }
    async getFileHandle(n) { return new FakeFile(n); }
    async removeEntry(n) { const o = load(); delete o[n]; save(o); }
    async *entries() { for (const n of Object.keys(load())) yield [n, new FakeFile(n)]; }
  }
  window.showDirectoryPicker = async () => { window.__dirPicked = true; return new FakeDir(); };
  document.addEventListener('DOMContentLoaded', () => {
    const FL = window.Egary && window.Egary.FileLink; if (!FL) return;
    const orig = FL.loadDirHandle; FL.loadDirHandle = async () => { const h = await orig(); return h ? Object.setPrototypeOf(h, FakeDir.prototype) : null; };
  }, { once: true });
  window.__dirFiles = () => Object.keys(load());
})();`;

test('backup flow: offer after link → pick folder → original written → delete writes before-delete → reload restores the folder and settings show it enabled', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  await ctx.addInitScript(FAKE(XLSX_B64));
  await ctx.addInitScript(FAKE_DIR);
  await ctx.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { if (window.Egary && window.Egary.U) window.Egary.U.setToday('2026-10-09'); }, { once: true }); });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL_); await page.waitForSelector('#btn-link');
  await page.click('#btn-link');
  await loginAs(page, 'admin', 'admin@2026');
  await page.waitForSelector('.kpi', { timeout: 40000 });
  await page.waitForFunction(() => document.querySelector('#sync-status').classList.contains('linked'));
  // العرض يظهر مرة واحدة بعد الربط
  await page.waitForSelector('#btn-enable-backups', { timeout: 10000 });
  await page.click('#btn-enable-backups');
  await page.waitForFunction(() => window.__dirPicked === true);
  await page.waitForFunction(() => (window.__dirFiles() || []).some(n => /original/.test(n)));
  const files1 = await page.evaluate(() => window.__dirFiles());
  assert.ok(files1.every(n => /^Egary-.*\.xlsx$/.test(n)), 'file names: ' + files1.join(','));
  assert.equal(await page.evaluate(() => Egary.Backup.status().enabled), true);
  // حذف دفعة ⇒ نسخة قبل الحذف فورًا (رغم فاصل 20 دقيقة)
  await page.goto(URL_ + '#/payments'); await page.waitForSelector('table tbody tr');
  await page.locator('table tbody tr').first().locator('button[title="حذف"]').click();
  await page.waitForSelector('.modal:has-text("تأكيد الحذف")'); await page.click('.modal .m-foot button:has-text("نعم، احذف")');
  await page.waitForFunction(() => (window.__dirFiles() || []).some(n => /before-delete/.test(n)));
  // إعادة تحميل ⇒ المجلد محفوظ في IndexedDB ويُستعاد بلا اختيار جديد
  await page.evaluate(() => { window.__dirPicked = false; });
  await page.goto(URL_ + '#/settings'); await page.waitForSelector('#btn-resume', { timeout: 10000 }).catch(() => null);
  if (await page.$('#btn-resume')) await page.click('#btn-resume');
  await page.waitForFunction(() => window.Egary && Egary.Backup && Egary.Backup.status().enabled, null, { timeout: 20000 });
  assert.equal(await page.evaluate(() => window.__dirPicked), false, 'no re-pick needed');
  await page.waitForSelector('text=مفعَّل في Egary');
  const txt = await page.evaluate(() => document.body.innerText);
  assert.ok(/عدد النسخ على القرص/.test(txt));
  assert.ok((await page.evaluate(() => Egary.Backup.status().count)) >= 2);
  assert.deepEqual(errors, []);
  await ctx.close();
});
