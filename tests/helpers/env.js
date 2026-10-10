// بيئة Node لتحميل وحدات التطبيق (نافذة وهمية + ExcelJS من الحزمة المضمَّنة)
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..', '..', 'Egary');
function load(opts) {
  const store = {};
  global.window = { Egary: {} };
  global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const sess = {}; global.sessionStorage = { getItem: k => (k in sess ? sess[k] : null), setItem: (k, v) => { sess[k] = String(v); }, removeItem: k => { delete sess[k]; } };
  global.ExcelJS = require(path.join(ROOT, 'assets/vendor/exceljs.min.js'));
  for (const f of ['core/util', 'core/model', 'core/codes', 'core/store', 'core/auth', 'core/engine', 'xlsx/workbook', 'sync/file-link', 'sync/sync', 'sync/backup']) {
    const p = path.join(ROOT, 'assets/js', f + '.js'); delete require.cache[p]; require(p);
  }
  const E = window.Egary;
  if (opts && opts.today) E.U.setToday(opts.today);
  return E;
}
function toArrayBuffer(buf) { return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength); }
function readFile(p) { return toArrayBuffer(fs.readFileSync(p)); }
module.exports = { load, ROOT, toArrayBuffer, readFile, SOURCE: process.env.EGARY_SOURCE || path.join(__dirname, '..', 'fixtures', 'source-anon.xlsx') };
