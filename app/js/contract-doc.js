/* =========================================================
   contract-doc.js — توليد عقد الإيجار للطباعة من بيانات النظام
   المصدر الوحيد للبيانات هو ما سُجِّل في النظام: لا إعادة كتابة ولا خطأ نسخ.

   ⏸ معطَّل مؤقتًا: هذا الملف غير محمَّل في app/index.html بانتظار نموذج
   العقد الكامل من المكتب (٤ صفحات ببنودها الرسمية). البنود الاثنا عشر
   هنا مصوغة من عقد العينة المتاح (قانون 4 لسنة 2006) وتُستبدل بالنموذج
   الكامل حين يصل. للتفعيل: أعِد سطر <script> في app/index.html، وأعِد
   زرّي «اطبع العقد» في جدول العقود وفي درج الوحدة.
   ========================================================= */
(function () {
  'use strict';

  const AR_NUM = ['صفر', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة'];
  const ORD = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة'];

  function money(n) { return Number(n || 0).toLocaleString('en-US'); }
  function longDate(iso) {
    if (!iso) return '……';
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${Store.MONTHS_AR[m - 1]} ${y}`;
  }
  function yearsWord(n) {
    if (n === 1) return 'سنة واحدة';
    if (n === 2) return 'سنتان';
    return `${AR_NUM[n] || n} سنوات`;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  const blank = v => (v && String(v).trim()) ? esc(v) : '<span class="fill">……………………</span>';

  /* بيانات العقد كما هي في النظام */
  function contractFacts(c) {
    const u = Store.unit(c.unitId) || {};
    const b = Store.building(u.buildingId) || {};
    const t = Store.tenant(c.tenantId) || {};
    const s = Store.state.settings;
    const monthly = y => (s.rentBasis === 'annual' ? Math.round(y.rent / 12) : y.rent);
    return { u, b, t, s, monthly, y0: (c.years && c.years[0]) || { rent: 0 } };
  }

  function docHtml(c) {
    const { u, b, t, s, monthly, y0 } = contractFacts(c);
    const n = (c.years || []).length || 1;
    const vatPct = s.vatPct;
    const dueDay = c.dueDay || 1;
    const dep = c.deposit && c.deposit.amount ? c.deposit.amount : null;
    const yearsRows = (c.years || []).map((y, i) => `
      <tr>
        <td>السنة ${ORD[i] || (i + 1)}</td>
        <td>${longDate(y.from)} — ${longDate(y.to)}</td>
        <td class="num">${money(monthly(y))}</td>
        <td class="num">${money(monthly(y) * 12)}</td>
        <td>${y.estimated ? 'قيمة تقديرية تحتاج تأكيد المالك' : 'مدوَّنة'}</td>
      </tr>`).join('');

    const clauses = [
      ['البند الأول — المؤجَّر',
        `أجَّر الطرف الأول للطرف الثاني ${blank(u.name)}${u.type && u.type !== 'غير محدد' ? ` (${esc(u.type)})` : ''}` +
        `${u.floor ? ` بالدور ${esc(u.floor)}` : ''}${u.area ? ` بمساحة ${esc(String(u.area))} م²` : ''}` +
        ` بالعقار الكائن ${blank(b.area)}، والمشار إليه في سجلات المكتب بالكود ${esc(u.code || '—')}، ` +
        `وقد عاين الطرف الثاني العين المؤجَّرة معاينة تامة نافية للجهالة وقبِلها بحالتها.`],
      ['البند الثاني — المدة',
        `مدة هذا العقد ${yearsWord(n)} تبدأ من ${longDate(c.start)} وتنتهي في ${longDate(c.end)}، ` +
        `ولا تُجدَّد إلا باتفاق كتابي جديد بين الطرفين.`],
      ['البند الثالث — القيمة الإيجارية',
        `القيمة الإيجارية للعين المؤجَّرة مبلغ <b>${money(monthly(y0))} جنيهًا شهريًا</b> (فقط لا غير) عن السنة الأولى، ` +
        `وتتدرَّج قيمة كل سنة على النحو المبيَّن في الجدول المرفق بهذا العقد والمعتبَر جزءًا لا يتجزأ منه.`],
      ['البند الرابع — الصيانة',
        c.maintenance
          ? `يلتزم الطرف الثاني بأداء مقابل صيانة شهري قدره <b>${money(c.maintenance)} جنيهًا</b> يُسدَّد مع القيمة الإيجارية في ذات الموعد.`
          : `لم يُتفق على مقابل صيانة شهري في هذا العقد.`],
      ['البند الخامس — التأمين',
        dep
          ? `سدَّد الطرف الثاني مبلغ <b>${money(dep)} جنيهًا</b> تأمينًا، يُرَدُّ إليه عند انتهاء العقد وإخلاء العين بحالتها ` +
            `بعد خصم ما قد يكون مستحقًا عليه من إيجار أو تلفيات أو مستحقات مرافق.`
          : `لم يُسدَّد تأمين عن هذه العين حتى تاريخه.`],
      ['البند السادس — الاستعمال',
        `يلتزم الطرف الثاني باستعمال العين في الغرض المخصَّص لها، ولا يجوز له تأجيرها من الباطن أو التنازل عنها للغير ` +
        `أو تغيير وجه استعمالها إلا بموافقة كتابية من الطرف الأول، وإلا كان العقد مفسوخًا من تلقاء نفسه.`],
      ['البند السابع — موعد السداد',
        `تُسدَّد القيمة الإيجارية مقدمًا في اليوم ${AR_NUM[dueDay] ? (dueDay === 1 ? 'الأول' : AR_NUM[dueDay]) : dueDay} من كل شهر ميلادي` +
        `${Store.state.settings.graceDays ? `، ويُعَدُّ الطرف الثاني متأخرًا بعد مضي ${Store.state.settings.graceDays} يومًا من هذا الموعد` : ''}.`],
      ['البند الثامن — المرافق',
        `يتحمل الطرف الثاني قيمة استهلاك المرافق (الكهرباء والمياه والغاز) ومصاريف النظافة، ويقدِّم ما يثبت السداد عند الطلب.`],
      ['البند التاسع — الإخلاء والإنهاء المبكر',
        `يلتزم الطرف الثاني بإخلاء العين وتسليمها للطرف الأول عند انتهاء المدة بحالتها التي تسلَّمها عليها. ` +
        `وفي حالة الإنهاء المبكر من جانبه يحق للطرف الأول مصادرة مبلغ التأمين المنصوص عليه بالبند الخامس.`],
      ['البند العاشر — ضريبة القيمة المضافة',
        c.vat
          ? `تُضاف ضريبة القيمة المضافة بواقع ${vatPct}% على القيمة الإيجارية، ويلتزم الطرف الثاني بسدادها مع الإيجار.`
          : `هذا العقد غير خاضع لضريبة القيمة المضافة.`],
      ['البند الحادي عشر — الاختصاص',
        `تختص المحكمة الكائن بدائرتها العقار بنظر أي نزاع ينشأ عن تنفيذ هذا العقد أو تفسيره.`],
      ['البند الثاني عشر — النسخ',
        `حُرِّر هذا العقد من نسختين بيد كل طرف نسخة للعمل بموجبها عند اللزوم.`],
    ];

    return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<title>عقد إيجار — ${esc(u.name || '')} — ${esc(t.name || '')}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI","Segoe UI Arabic",Tahoma,sans-serif; color:#111; line-height:1.95; font-size:13.5px; margin:0; }
  .sheet { max-width: 780px; margin: 0 auto; padding: 18px; }
  .head { text-align:center; border-bottom:2px solid #7c3aed; padding-bottom:10px; margin-bottom:14px; }
  .head h1 { margin:0; font-size:22px; letter-spacing:.5px; }
  .head .law { color:#555; font-size:12.5px; margin-top:4px; }
  .meta { display:flex; justify-content:space-between; font-size:12.5px; color:#444; margin-bottom:14px; }
  .parties { border:1px solid #ddd; border-radius:8px; padding:10px 14px; margin-bottom:14px; background:#faf9ff; }
  .parties div { margin:4px 0; }
  h2 { font-size:14.5px; margin:14px 0 3px; color:#4c1d95; }
  p { margin:0 0 4px; text-align:justify; }
  table { width:100%; border-collapse:collapse; margin:10px 0 4px; font-size:12.5px; }
  th, td { border:1px solid #ccc; padding:6px 9px; text-align:right; }
  th { background:#ede9fe; }
  td.num { text-align:left; font-variant-numeric: tabular-nums; }
  .fill { display:inline-block; min-width:130px; border-bottom:1px dotted #888; }
  .sign { display:flex; justify-content:space-between; margin-top:34px; gap:30px; }
  .sign div { flex:1; text-align:center; }
  .sign .line { margin-top:44px; border-top:1px solid #333; padding-top:5px; font-size:12.5px; }
  .foot { margin-top:22px; font-size:10.5px; color:#777; text-align:center; border-top:1px solid #eee; padding-top:8px; }
  .toolbar { position:sticky; top:0; background:#fff; padding:10px 0 14px; text-align:center; }
  .toolbar button { font:inherit; padding:9px 22px; border-radius:8px; border:0; background:#7c3aed; color:#fff; cursor:pointer; font-weight:600; }
  .toolbar span { color:#666; font-size:12px; margin-inline-start:12px; }
  @media print { .toolbar { display:none; } .sheet { padding:0; } }
</style></head><body>
<div class="sheet">
  <div class="toolbar">
    <button onclick="window.print()">طباعة العقد / حفظه PDF</button>
    <span>من نافذة الطباعة اختر «حفظ بصيغة PDF» إن أردت نسخة إلكترونية</span>
  </div>

  <div class="head">
    <h1>عقد إيجار</h1>
    <div class="law">خاضع لأحكام القانون المدني والقانون رقم 4 لسنة 2006</div>
  </div>

  <div class="meta">
    <span>تحريرًا في: ${longDate(Store.iso(Store.today()))}</span>
    <span>مرجع العقد: ${esc(c.id)} · الوحدة ${esc(u.code || u.name || '')}</span>
  </div>

  <div class="parties">
    <div><b>الطرف الأول (المؤجِّر):</b> ${blank(b.owner)} — مالك العقار الكائن ${blank(b.area)}.</div>
    <div><b>الطرف الثاني (المستأجر):</b> ${blank(t.name)}${t.kind === 'شركة' ? ' (شخص اعتباري)' : ''} — ` +
      `${t.code ? `رقم قومي/سجل تجاري: ${esc(t.code)}` : '<span class="fill">رقم قومي: ……………………</span>'}` +
      `${t.phone ? ` — هاتف: ${esc(t.phone)}` : ''}.</div>
    <div>اتفق الطرفان وهما بكامل الأهلية المعتبرة شرعًا وقانونًا على ما يلي:</div>
  </div>

  ${clauses.map(([title, text]) => `<h2>${title}</h2><p>${text}</p>`).join('\n  ')}

  <h2>جدول القيمة الإيجارية على مدة العقد</h2>
  <table>
    <thead><tr><th>السنة</th><th>من — إلى</th><th>الإيجار الشهري (ج.م)</th><th>إجمالي السنة (ج.م)</th><th>المصدر</th></tr></thead>
    <tbody>${yearsRows}</tbody>
  </table>

  <div class="sign">
    <div><b>الطرف الأول (المؤجِّر)</b><div class="line">${esc(b.owner || 'الاسم والتوقيع')}</div></div>
    <div><b>الطرف الثاني (المستأجر)</b><div class="line">${esc(t.name || 'الاسم والتوقيع')}</div></div>
  </div>

  <div class="foot">
    حُرِّر هذا العقد آليًا من بيانات نظام «إيجاري» المسجَّلة لهذه الوحدة — أي تعديل في البيانات ينعكس في نسخة جديدة.
    راجِع البيانات قبل التوقيع؛ الخانات المنقوطة تُستكمَل بخط اليد.
  </div>
</div>
</body></html>`;
  }

  /* يفتح العقد في تبويب مستقل جاهزًا للطباعة أو الحفظ PDF */
  function printContract(c) {
    const html = docHtml(c);
    const w = window.open('', '_blank');
    if (!w) { UI.toast('المتصفح منع فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة لهذا الموقع', 'warning'); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  window.ContractDoc = { printContract, docHtml };
})();
