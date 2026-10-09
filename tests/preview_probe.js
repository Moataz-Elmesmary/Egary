// وضع العرض على استضافة http: يقرأ Egary.xlsx المجاور تلقائيًا ويعرض شريط «عرض فقط»
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '../Egary');
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html; charset=utf-8' : p.endsWith('.js') ? 'text/javascript' : p.endsWith('.css') ? 'text/css' : 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await b.newPage({ viewport: { width: 1366, height: 820 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForSelector('.kpi', { timeout: 15000 });
  const banner = await page.textContent('#banner');
  const counts = await page.$$eval('.nav .cnt', els => els.map(e => e.textContent));
  console.log('preview banner:', banner.slice(0, 60), '| counts:', counts.join(','), '| errors:', errors.length);
  await page.screenshot({ path: '/tmp/claude-0/-home-user-Egary/e8cec96e-9e54-59ec-a68b-cc761d4144c6/scratchpad/shots/20-preview-real.png', fullPage: true });
  await b.close(); server.close();
});
