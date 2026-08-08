/* =========================================================
   i18n-content.js — المحتوى الموسّع للنسخة الإنجليزية
   يُدمج آليًا في i18n.js: I18N_EXTRA (قاموس) + I18N_PATTERNS (أنماط)
   + I18N_TOKENS (أسماء ورموز). لا يعدّل أي ملف آخر.
   ========================================================= */
(function () {
  'use strict';

  var MONTH = {
    'يناير': 'Jan', 'فبراير': 'Feb', 'مارس': 'Mar', 'أبريل': 'Apr',
    'مايو': 'May', 'يونيو': 'Jun', 'يوليو': 'Jul', 'أغسطس': 'Aug',
    'سبتمبر': 'Sep', 'أكتوبر': 'Oct', 'نوفمبر': 'Nov', 'ديسمبر': 'Dec',
  };
  var MONTH_RE = 'يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر';

  /* خريطة الأسماء: مباني/ملاك/مناطق/عملاء/وحدات/أدوار — تُرتَّب الأطول أولًا */
  var NAMES = [
    // كشوف وملاك ومناطق
    ['بيان عبدالمنعم سكرية', 'Abdelmoneim Sokareya Statement'],
    ['عبدالمنعم سكرية', 'Abdelmoneim Sokareya'],
    ['تقوى عبدالمنعم', 'Taqwa Abdelmoneim'],
    ['سكرية', 'Sokareya'],
    ['برج النيل الإداري', 'Nile Administrative Tower'],
    ['ورثة محمود النقيب', 'Heirs of Mahmoud El-Nakib'],
    ['مركز الحرية التجاري', 'Al-Horreya Commercial Center'],
    ['شركة الحرية للاستثمار', 'Al-Horreya Investment Co.'],
    ['الدقي — الجيزة', 'Dokki — Giza'],
    ['المهندسين — الجيزة', 'Mohandessin — Giza'],
    ['الهرم — الجيزة', 'Haram — Giza'],
    // عملاء الكشف الفعلي
    ['علاء الدين محمد حافظ', 'Alaa El-Din Mohamed Hafez'],
    ['صالون علاء', 'Alaa Salon'],
    ['حسام سنوسي', 'Hossam Senoussi'],
    ['معمل تحاليل الدقة الطبية', 'El-Dekka Medical Labs'],
    ['الدقة', 'El-Dekka'],
    ['العنوان', 'El-Enwan'],
    ['عز الدين', 'Ezz El-Din'],
    ['مصطفى عثمان', 'Mostafa Osman'],
    ['غير مسجّل', 'Not recorded'],
    // عملاء المبنيين التوضيحيين
    ['مطعم بيت الكشري', 'Beit El-Koshary Restaurant'],
    ['صيدلية الرحمة', 'El-Rahma Pharmacy'],
    ['مكتب النخبة للمحاماة', 'Elite Law Office'],
    ['شركة أوج للبرمجيات', 'Awg Software Co.'],
    ['مركز نبض للأشعة', 'Nabd Radiology Center'],
    ['أكاديمية نون التعليمية', 'Noon Educational Academy'],
    ['ياسر عبد اللطيف', 'Yasser Abdel Latif'],
    ['هشام الجندي', 'Hesham El-Gendy'],
    ['شريف قنديل', 'Sherif Qandil'],
    ['متجر لمسة للأثاث', 'Lamsa Furniture Store'],
    ['شركة برق للشحن', 'Barq Shipping Co.'],
    ['ستوديو ريم للتصوير', 'Reem Photography Studio'],
    ['مكتب هندسي — م. سعيد حجازي', 'Engineering Office — Eng. Saeed Hegazy'],
    ['عيادات صفا التخصصية', 'Safa Specialized Clinics'],
    ['شركة الوفاق للتوريدات', 'El-Wefaq Supplies Co.'],
    // وحدات
    ['وحدة غير محددة', 'Unspecified Unit'],
    ['جراج الهدم', 'Demolition Garage'],
    ['الميزان 1', 'Mezzanine 1'],
    ['الميزان 2', 'Mezzanine 2'],
    ['ميزانين 1', 'Mezzanine 1'],
    ['ميزانين 2', 'Mezzanine 2'],
    ['مخزن ب1', 'Warehouse B1'],
    ['مخزن م1', 'Warehouse M1'],
    ['مكتب 1أ', 'Office 1A'],
    ['عيادة 3أ', 'Clinic 3A'],
    ['محل أ', 'Shop A'], ['محل ب', 'Shop B'], ['محل ج', 'Shop C'],
    // أنواع وأدوار (بعد كل الأسماء الأطول)
    ['ميزانين', 'Mezzanine'],
    ['غير محدد', 'Unspecified'],
    ['عيادة', 'Clinic'], ['محل', 'Shop'], ['مكتب', 'Office'],
    ['شقة', 'Apartment'], ['مخزن', 'Warehouse'], ['جراج', 'Garage'],
    ['شركة', 'Company'], ['فرد', 'Individual'],
    ['حالة المباني', 'Buildings status'],
    ['أرضي', 'Ground'], ['بدروم', 'Basement'],
    ['السادس', 'Sixth'], ['الخامس', 'Fifth'], ['الرابع', 'Fourth'],
    ['الثالث', 'Third'], ['الثاني', 'Second'], ['الأول', 'First'],
  ];
  NAMES.sort(function (a, b) { return b[0].length - a[0].length; });

  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /* استبدال الأسماء + الشهور + الرموز داخل أي نص — تُستخدم داخل أنماطنا */
  function en(s) {
    if (s == null) return '';
    var out = String(s);
    for (var i = 0; i < NAMES.length; i++) out = out.split(NAMES[i][0]).join(NAMES[i][1]);
    out = out
      .replace(new RegExp('(' + MONTH_RE + ')\\s+(\\d{4})', 'g'), function (_, mo, y) { return MONTH[mo] + ' ' + y; })
      .replace(new RegExp(MONTH_RE, 'g'), function (mo) { return MONTH[mo]; })
      .replace(/ج\.م/g, 'EGP').replace(/٪/g, '%').replace(/م²/g, 'm²').replace(/؟/g, '?');
    return out;
  }
  function days(s) {
    s = String(s).trim();
    if (s === 'يوم واحد') return '1 day';
    if (s === 'يومين') return '2 days';
    var m = s.match(/^(\d+) (?:أيام|يومًا|يوم)$/);
    return m ? m[1] + ' days' : en(s);
  }
  function months(s) {
    s = String(s).trim();
    if (s === 'شهر واحد') return '1 month';
    if (s === 'شهرين') return '2 months';
    var m = s.match(/^(\d+) (?:أشهر|شهرًا|شهور)$/);
    return m ? m[1] + ' months' : en(s);
  }

  /* رموز global — تعمل بعد القاموس والأنماط على أي نص متبقٍ */
  window.I18N_TOKENS = NAMES.map(function (p) {
    return [new RegExp(esc(p[0]), 'g'), p[1]];
  }).concat([
    [/٪/g, '%'],
    [/م²/g, 'm²'],
    [/؟/g, '?'],
    [/ألف\/شهر/g, 'K/mo'],
    [/ألف\/ش/g, 'K/mo'],
    [/مليون\/شهر/g, 'M/mo'],
    [/مليون\/ش/g, 'M/mo'],
    [/ألف/g, 'K'],
    [/مليون/g, 'M'],
  ]);

  window.I18N_EXTRA = {
    /* ---------- جودة البيانات: البنود الـ25 (title/detail/action) ---------- */
    'سكرية: ستة أشهر غير مسدَّدة ولا يوجد عقد مسجّل': 'Sokareya: six unpaid months and no contract on file',
    'صف «علاء الدين محمد حافظ» كل شهوره ✗ من يناير إلى يونيو بلا أي بيانات عقد أو قيمة إيجار. المتأخرات مؤكدة الوجود لكن قيمتها غير قابلة للحساب من الكشف.':
      'The “Alaa El-Din Mohamed Hafez” row is ✗ every month from January to June, with no contract data or rent amount. The arrears certainly exist, but their value cannot be computed from the statement.',
    'إحضار عقد الوحدة أو تحديد القيمة المتفق عليها لتسجيل المتأخرات بقيمتها.':
      'Obtain the unit contract, or establish the agreed amount, so the arrears can be recorded at their actual amount.',
    'الميزان 2 واردة في صفّين لعميلَين مختلفَين': 'Mezzanine 2 appears in two rows under two different clients',
    'صفّ باسم «الدقة» وصفّ باسم «العنوان» وكلاهما على نفس الوحدة وعليهما ✓ من يناير إلى يونيو — لا يمكن أن يسدِّد اثنان لوحدة واحدة. اعتُمدت بيانات صف «العنوان» لوجود عقود به.':
      'One row named “El-Dekka” and one named “El-Enwan”, both for the same unit and both marked ✓ from January to June — two clients cannot both be paying for one unit. The “El-Enwan” row was used because it has contract data on file.',
    'تحديد العميل الفعلي للوحدة، وتوضيح علاقة «الدقة» بها.':
      'Identify the unit’s actual client, and clarify how “El-Dekka” relates to it.',
    '61: تواريخ العقد الأصلية متناقضة (النهاية قبل البداية)': '61: original contract dates contradict each other (end before start)',
    'المدوَّن حرفيًا: من «2026/4/1 و2028/4/1» إلى «2026/3/31 و2027/3/31». فُسِّر الأرجح: عقد 2026/4/1 حتى 2027/3/31 بقيمة 25,325 وتجديد 2027/4/1 حتى 2028/3/31 بقيمة 40,000.':
      'Written verbatim: from “2026/4/1 and 2028/4/1” to “2026/3/31 and 2027/3/31”. The most likely reading was adopted: a contract 2026/4/1–2027/3/31 at 25,325, renewed 2027/4/1–2028/3/31 at 40,000.',
    'مراجعة أصل عقد مصطفى عثمان لتأكيد المدد والقيمتين (القفزة 58٪ خارج نمط الزيادة 10٪).':
      'Review the original Mostafa Osman contract to confirm the terms and both amounts (the 58% jump is outside the usual 10% increase pattern).',
    '61: سداد يناير–مارس سابق لبداية العقد المفسَّرة': '61: January–March payments precede the interpreted contract start',
    'العلامات ✓ من يناير مع أن العقد المفسَّر يبدأ 2026/4/1 — يُرجَّح وجود عقد أقدم غير مدوَّن في الكشف.':
      'Marks are ✓ from January although the interpreted contract starts 2026/4/1 — most likely there is an earlier contract not recorded in the statement.',
    'التأكد من وجود عقد سابق للوحدة 61 وإدخاله.': 'Confirm whether unit 61 had a prior contract and enter it.',
    'محل 1 (صالون علاء): مدة سنة واحدة مدوَّنة مقابل قيمتَي سنتين': 'Shop 1 (Alaa Salon): a one-year term written against two years of values',
    'المدوَّن: من 2025/5/1 إلى 2026/4/30 مع قيمتين 30,500 و39,000. فُسِّر عقد سنتين حتى 2027/4/30. الزيادة 27.9٪ خارج نمط الـ10٪ المعتاد.':
      'Written: from 2025/5/1 to 2026/4/30 with two values, 30,500 and 39,000. Interpreted as a two-year contract to 2027/4/30. The 27.9% increase is outside the usual 10% pattern.',
    'مراجعة أصل العقد: هل المدة سنتان فعلًا؟ وهل القيمة الثانية 39,000 صحيحة؟':
      'Review the original contract: is the term really two years? And is 39,000 correct for year 2?',
    'جراج الهدم: سداد منتظم بلا عقد ولا عميل مسجّل': 'Demolition Garage: regular payments with no contract and no client on file',
    'المدوَّن حرفيًا: «جراج الهدم» في عمود اسم العميل وعمود الوحدة فارغ — كصف تقوى عبدالمنعم تمامًا — مع ✓ ستة أشهر وقيمة 9,000 بلا أي تواريخ عقد. فُسِّر الاسم اسمَ وحدة (جراج) لا اسمَ شخص، فسُجِّلت وحدة «جراج الهدم» وعميل «غير مسجّل». التفريغ يصنّف هذا الصف «خارج ترتيب الجدول — ثقة منخفضة جدًا». لا يُحتسب ضمن الإشغال الموثَّق ولا المستحقات إلى أن يُسجَّل عقد.':
      'Written verbatim: “Demolition Garage” in the client-name column with the unit column empty — exactly like the Taqwa Abdelmoneim row — with ✓ for six months and a value of 9,000, and no contract dates. The name was interpreted as a unit name (a garage), not a person, so a “Demolition Garage” unit and a “Not recorded” client were created. The transcription flags this row “out of table order — very low confidence”. It is excluded from documented occupancy and dues until a contract is recorded.',
    'تسجيل اسم العميل وبيانات الاتفاق (القيمة 9,000 شهري؟ سنوي؟ ومنذ متى؟).':
      'Record the client name and the terms of the agreement (is 9,000 monthly? annual? and since when?).',
    'تقوى عبدالمنعم: يناير–مارس داخل مدة العقد بلا أي علامة': 'Taqwa Abdelmoneim: January–March fall within the contract term with no mark at all',
    'العقد من 2025/10/1 والعلامات تبدأ من أبريل. الورق لا يفرِّق بين «متأخر» و«لم يُسجَّل» — الأشهر الثلاثة معلَّمة في النظام «يحتاج تأكيدًا» لحين الحسم.':
      'The contract runs from 2025/10/1 while the marks start in April. Paper cannot distinguish “late” from “not recorded” — the three months are flagged “Needs confirmation” in the system until resolved.',
    'الحسم: هل يناير–مارس مسدَّدة (تُوثَّق) أم متأخرات (تُسجَّل بقيمتها 3 × 66,000)؟':
      'Resolve: were January–March paid (to be documented) or arrears (to be recorded at 3 × 66,000)?',
    'وحدة تقوى عبدالمنعم غير مذكورة في الكشف': 'Taqwa Abdelmoneim’s unit is not named in the statement',
    'الصف الأخير فيه عقد وقيمة 66,000 بلا اسم وحدة. أُنشئت وحدة مؤقتة باسم «وحدة غير محددة».':
      'The last row has a contract and a 66,000 value but no unit name. A temporary “Unspecified Unit” was created.',
    'تحديد الوحدة الفعلية وربط العقد بها.': 'Identify the actual unit and link the contract to it.',
    'الميزان 2: قيمة «6,000» غير مفسَّرة': 'Mezzanine 2: the “6,000” value is unexplained',
    'المدوَّن في عمود السنة الأولى سطران: «41,800» و«6,000». الـ41,800 قيمة العقد الأول والـ69,000 قيمة التجديد — أما 6,000 فقد تكون صيانة شهرية (البند الرابع) أو خطأ قراءة من الصورة. كما افتُرض ثبات قيمة السنة الثانية للعقد الأول (41,800) لعدم تدوين غيرها — كافتراض «محل 2».':
      'The year-1 column holds two lines: “41,800” and “6,000”. 41,800 is the first contract’s value and 69,000 the renewal’s — 6,000 could be monthly maintenance (Clause 4) or a misread from the photo. Year 2 of the first contract was also assumed flat (41,800) since nothing else was written — as with the “Shop 2” assumption.',
    'مراجعة الأصل: ما دلالة 6,000؟ وتأكيد قيمة السنة الثانية.': 'Review the original: what does 6,000 mean? And confirm the year-2 value.',
    'الميزان 2: قيمة السنة الثانية للتجديد غير مدوَّنة — قُدِّرت 75,900 (+10٪)': 'Mezzanine 2: renewal year-2 value not written — estimated at 75,900 (+10%)',
    'الكشف يدوِّن 69,000 فقط لتجديد سنتين 2026/6/1 حتى 2028/5/31. قُدِّرت السنة الثانية بزيادة 10٪ وفق النمط العام — علمًا بأن الحالة المماثلة في «محل 2» فُسِّرت بثبات القيمة (Q12).':
      'The statement writes only 69,000 for a two-year renewal 2026/6/1–2028/5/31. Year 2 was estimated with a 10% increase per the general pattern — noting that the similar “Shop 2” case was read as a flat value (Q12).',
    'تأكيد قيمة السنة الثانية من أصل عقد التجديد.': 'Confirm the year-2 value from the original renewal contract.',
    'الخانة البرتقالية الغامضة في التفريغ: تبيَّن من صورة الورقة أنها عنوان الكشف': 'The puzzling orange cell in the transcription: the paper photo shows it is the statement’s own title',
    'شيت «درجة الثقة» ظنّها عمود بيانات («بيان/عهدة»). صورة الورقة الفعلية توضح أنها خانة عنوان الكشف نفسه: «بيان / عبدالمنعم سكرية» — ليست عمود بيانات مفقودًا. كما تُظهر الصورة تظليلات ملوّنة على بعض الشهور (يُرجَّح أنها «آخر شهر بسعر السنة» أو مواضع انتباه) — اللون في الورق يحمل معنى يضيع بالنسخ.':
      'The “confidence score” sheet mistook it for a data column (“statement/custody”). The actual paper photo shows it is the statement’s own title cell: “Statement / Abdelmoneim Sokareya” — not a missing data column. The photo also shows colored highlights on some months (likely “last month at the year’s rate” or attention marks) — color on paper carries meaning that is lost in copying.',
    'تأكيد دلالة التظليلات الملوّنة على الشهور مع كاتب الورقة، وقيد أي معنى منها في النظام كبيانات صريحة.':
      'Confirm what the colored month highlights mean with the paper’s author, and record any meaning in the system as explicit data.',
    'علامات الشهور المستوردة عدُّها تقريبي والصفان الأخيران منخفضا الثقة': 'Imported month marks are approximate in count, and the last two rows are low-confidence',
    'شيت «درجة الثقة»: «عدد العلامات في كل صف تقريبي — يُفضّل عدّها على الأصل»، والصفان 11 و12 (جراج الهدم وتقوى) «مكتوبان خارج ترتيب الجدول وبخط مختلف — ثقة منخفضة جدًا». كل علامات ✓/✗ المستوردة خاضعة لهذا التحفظ حتى تُراجَع على الورقة الأصلية.':
      'The “confidence score” sheet says: “the number of marks per row is approximate — best recounted on the original”, and rows 11–12 (Demolition Garage and Taqwa) are “written out of table order and in a different hand — very low confidence”. Every imported ✓/✗ mark carries this caveat until reviewed against the original paper.',
    'مراجعة العلامات على أصل الورقة مرة واحدة عند التوثيق.': 'Review the marks against the original paper once, at documentation time.',
    'محل 2: نهاية التجديد المدوَّنة 2027/5/21 — الأرجح 2027/5/31': 'Shop 2: renewal end written 2027/5/21 — most likely 2027/5/31',
    'شيت «درجة الثقة» في التفريغ يصنّف قراءة التواريخ منخفضة الثقة. اعتُمد 2027/5/31 (سنة كاملة) مع تسجيل الأصل هنا.':
      'The transcription’s “confidence score” sheet rates the date readings low-confidence. 2027/5/31 (a full year) was adopted, with the original recorded here.',
    'تأكيد التاريخ من أصل العقد.': 'Confirm the date from the original contract.',
    'الثاني: نهاية العقد المدوَّنة 2027/2/25 — الأرجح 2027/2/28': 'Second: contract end written 2027/2/25 — most likely 2027/2/28',
    'ثلاث سنوات كاملة من 2024/3/1 تنتهي 2027/2/28. اعتُمد 2027/2/28 مع تسجيل الأصل هنا.':
      'Three full years from 2024/3/1 end on 2027/2/28. 2027/2/28 was adopted, with the original recorded here.',
    'محل 2: عقد سنتين بقيمة واحدة مدوَّنة': 'Shop 2: a two-year contract with only one value written',
    'المدوَّن 12,705 فقط لعقد 2024/6/1 حتى 2026/5/31. افتُرض ثبات القيمة في السنة الثانية.':
      'Only 12,705 is written for the 2024/6/1–2026/5/31 contract. Year 2 was assumed flat.',
    'تأكيد قيمة السنة الثانية.': 'Confirm the year-2 value.',
    'الميزان 1: قيمة السنة الثالثة غير مدوَّنة — قُدِّرت 54,571 (+10٪)': 'Mezzanine 1: year-3 value not written — estimated at 54,571 (+10%)',
    'السنتان الأوليان 45,100 ثم 49,610 (+10٪). السنة الثالثة (من 2026/5/20) غير مدوَّنة، والاستحقاق الجاري محسوب على قيمة تقديرية.':
      'The first two years are 45,100 then 49,610 (+10%). Year 3 (from 2026/5/20) is not written, and current dues are computed on an estimated value.',
    'إدخال القيمة الفعلية للسنة الثالثة من العقد.': 'Enter the actual year-3 value from the contract.',
    'الثاني: قيمة السنة الثالثة غير مدوَّنة — قُدِّرت 101,156 (+10٪)': 'Second: year-3 value not written — estimated at 101,156 (+10%)',
    'الاستحقاق الجاري منذ مارس 2026 محسوب على قيمة تقديرية.': 'Dues since Mar 2026 are computed on an estimated value.',
    '42: قيمة السنة الثالثة غير مدوَّنة — قُدِّرت 33,275 (+10٪)': '42: year-3 value not written — estimated at 33,275 (+10%)',
    'كامل سنة 2025/8 حتى 2026/7 محسوبة على قيمة تقديرية، وهي فترة انتهت بالفعل.':
      'The whole year 2025/8–2026/7 is computed on an estimated value — a period that has already ended.',
    '42: العقد انتهى 2026/7/30 ولا يوجد تجديد مسجّل': '42: the contract ended 2026/7/30 and no renewal is on file',
    'انتهت مدة عقد «الدقة» للوحدة 42 ولم يُدوَّن تجديد — الوحدة الآن بلا عقد نشط.':
      '“El-Dekka”’s contract on unit 42 has expired with no renewal written — the unit now has no active contract.',
    'الحسم: هل جُدِّد العقد؟ إن لم يُجدَّد فالوحدة شاغرة ويجب استرداد أو تسوية التأمين إن وُجد.':
      'Resolve: was the contract renewed? If not, the unit is vacant and the deposit (if any) must be refunded or settled.',
    'التأمينات مسجَّلة لعقد واحد فقط من 12 (الكشف الحقيقي)': 'Deposits are recorded for only 1 of 12 contracts (the real statement)',
    'الكشف يذكر تأمينًا واحدًا (35,000 للوحدة 41). قيم تأمين متبقّي العقود غير معروفة رغم أنها التزام مالي يجب أن يظهر.':
      'The statement mentions one deposit (35,000 for unit 41). The other contracts’ deposit values are unknown even though they are a financial liability that must be visible in the figures.',
    'حصر تأمينات كل العقود القائمة وإدخالها.': 'Inventory the deposits of all active contracts and enter them.',
    'الصيانة الشهرية غير مسجَّلة رغم نصّ البند الرابع': 'Monthly maintenance is unrecorded despite Clause 4',
    'البند الرابع في العقد ينصّ على مقابل صيانة شهري يُسدَّد مع الإيجار، ولا أثر له في الكشف. (النظام جاهز: خانة صيانة في كل عقد تدخل الاستحقاق تلقائيًا.)':
      'Clause 4 of the contract stipulates a monthly maintenance charge paid with the rent, yet it leaves no trace in the statement. (The system is ready: a maintenance field on every contract feeds dues automatically.)',
    'تحديد قيمة الصيانة لكل وحدة.': 'Establish the maintenance amount for each unit.',
    'ضريبة القيمة المضافة: غير محدَّد مَن الخاضع لها': 'VAT: it is unclear who is subject to it',
    'البند العاشر يُحمِّل العميل الضريبة. يلزم تحديد العقود الخاضعة لتظهر في الاستحقاق والإيصالات. (النظام جاهز: علامة خضوع في كل عقد.)':
      'Clause 10 puts the tax on the client. The VAT-applicable contracts must be identified so it shows in dues and receipts. (The system is ready: a VAT flag on every contract.)',
    'حصر العملاء الخاضعين للضريبة.': 'Inventory the VAT-applicable clients.',
    'تواريخ تسليم الوحدات غير مسجَّلة': 'Unit handover dates are unrecorded',
    'بدونها لا يمكن حساب مؤشر «الشكاوى خلال 30 يومًا من التسليم».': 'Without them, the “complaints within 30 days of handover” KPI cannot be computed.',
    'إدخال تاريخ التسليم لكل وحدة.': 'Enter the handover date for each unit.',
    'بيانات التواصل وأكواد العملاء غائبة (الكشف الحقيقي)': 'Contact details and client codes are missing (the real statement)',
    'لا هاتف ولا رقم قومي لأي عميل في كشف سكرية — الرقم القومي هو كود العميل الذي يُبحث به، ولازم للتنبيهات وللتوثيق القانوني.':
      'No phone or national ID for any client in the Sokareya statement — the national ID is the client code you search by, and it is needed for reminders and legal documentation.',
    'استكمال أسماء العملاء بأرقامهم القومية وهواتفهم من صور العقود.': 'Complete the client names with their national IDs and phones from the contract photos.',
    'أرقام الإيجار شهرية أم سنوية؟ — عقد العينة يحسمها «شهريًا»': 'Are the rent figures monthly or annual? — the sample contract settles it: “monthly”',
    'البند الثالث في عقد العينة ينص حرفيًا: «القيمة الإيجارية للمكان … جنيه شهريًا (فقط لا غير) شهريًا»، والبند الخامس: التأمين «بواقع شهر» (يطابق 41: تأمين 35,000 ≈ شهر من 36,000). النظام محسوب على «شهري». يتبقى التأكيد أن كل العقود على نفس النموذج.':
      'Clause 3 of the sample contract reads verbatim: “the rental value of the premises … pounds monthly (and no more) monthly”, and Clause 5 sets the deposit “at one month” (matching 41: a 35,000 deposit ≈ one month of 36,000). The system is computed on “monthly”. It remains to confirm all contracts follow the same form.',
    'تأكيد أن جميع العقود بنفس نموذج العينة، ثم تعليم «تم التأكيد» في الإعدادات.':
      'Confirm all contracts follow the sample form, then tick “Confirmed” in Settings.',
    /* ---------- بذرة: ملاحظات وسجل وشكاوى ---------- */
    'عميل لأكثر من وحدة': 'Client of more than one unit',
    'عميل جراج الهدم — الاسم غير وارد في الكشف': 'Demolition Garage client — name not given in the statement',
    'ورد في الكشف باسم «محل» — رُقِّم مؤقتًا': 'Listed in the statement as “Shop” — numbered provisionally',
    'وردت في صفّين بعميلَين مختلفَين': 'Appears in two rows with two different clients',
    'بلا عقد ولا عميل مسجّل': 'No contract and no client on file',
    'وحدة تقوى عبدالمنعم — غير مذكورة في الكشف': 'Taqwa Abdelmoneim’s unit — not named in the statement',
    '— الوحيد المسجّل في الكشف': '— the only one recorded in the statement',
    'الوحيد المسجّل في الكشف': 'The only one recorded in the statement',
    'بيان عبدالمنعم سكرية — الكشف الورقي المفرّغ': 'Abdelmoneim Sokareya Statement — the transcribed paper statement',
    'استيراد كشف «بيان عبدالمنعم سكرية» (يناير–يونيو 2026) — 12 صفًا، 25 ملاحظة جودة':
      'Imported “Abdelmoneim Sokareya Statement” (Jan–Jun 2026) — 12 rows, 25 quality notes',
    'إنشاء مشاريعك وإضافة المباني': 'Portfolio created and buildings added',
    'تسريب في حمام الوحدة': 'Leak in the unit’s bathroom',
    'انقطاع في لوحة الكهرباء': 'Outage in the electrical panel',
    'باب لا يغلق بإحكام': 'Door does not close tightly',
    'الأسانسير متوقف': 'Elevator out of service',
    'ضعف ضغط المياه': 'Weak water pressure',
    'وحدة التكييف لا تبرّد': 'AC unit not cooling',
    /* ---------- دليل الشرح: خريطة العملية ---------- */
    'خريطة العملية الكاملة — من الورقة للقرار': 'The full process map — from paper to decision',
    'استلام الورقة': 'Receive the paper',
    'تفريغ الكشف': 'Transcribe the statement',
    'مراجعة الجودة': 'Quality review',
    'التشغيل اليومي': 'Daily operations',
    'المتابعة بالاستثناء': 'Manage by exception',
    'التقارير والقرار': 'Reports & decisions',
    'بيان ورقي من مالك عقار (زي «بيان عبدالمنعم سكرية») + نموذج عقد. الورقة = كشف مستقل في المنظومة.':
      'A paper statement from a property owner (like the “Abdelmoneim Sokareya Statement”) + a contract form. Each paper = an independent statement in the suite.',
    'شاشة «إدخال كشف جديد»: بيانات المالك ← صفوف الورقة بنفس أعمدتها (اسم العميل/الوحدة/من/قيم 1-2-3/ملاحظات) ← علامات ✓/✗ من جدول التحصيل بوضع نقل الورقة. الخانة الفارغة تُسجَّل «يحتاج تأكيد» — الفراغ معلومة.':
      'The “New Statement Intake” screen: owner details → the paper’s rows with its exact columns (client name / unit / from / values 1-2-3 / notes) → ✓/✗ marks from the collection sheet in Transcribe mode. Empty cells register as “Needs confirmation” — a blank is information.',
    'كل تناقض أو نقص يتسجّل تلقائيًا في «جودة البيانات» بنص المصدر الحرفي. تقعد مع المالك جلسة واحدة تقفل الأسئلة (تليفونات، تأمينات، قيم ناقصة، فراغات = سداد ولا تأخير؟).':
      'Every contradiction or gap is logged automatically in “Data Quality” with the source’s verbatim text. One sitting with the owner closes the questions (phones, deposits, missing values, blanks = paid or late?).',
    'التحصيل الجديد يتسجّل دفعة كاملة (مبلغ+تاريخ+طريقة+إيصال) من خلية جدول التحصيل أو بالسداد الجماعي. عقد جديد/تجديد من زر «+ إدخال». شكوى تتسجّل بتصنيفها وتكلفتها.':
      'New collections are logged as full payments (amount + date + method + receipt) from a collection sheet cell or via bulk collection. A new contract/renewal via the “+ Add” button. Complaints are logged with category and cost.',
    'مش بتراجع 1000 وحدة — بتفتح «من لم يسدِّد؟» والتنبيهات والتحليلات: بيوروك بس اللي محتاج قرار (متأخر، عقد بينتهي، فجوة توثيق).':
      'You don’t review 1,000 units — you open “Who has not paid?”, the alerts, and Insights: they show only what needs a decision (a late payer, an expiring contract, a documentation gap).',
    'تصدير CSV للمالك (متأخرات/جدول التحصيل/عقود/دفعات) + التحليلات للقرارات: مين نطارده، إمتى نجدد، فين الفاقد.':
      'CSV exports for the owner (arrears / collection sheet / contracts / payments) + Insights for decisions: whom to chase, when to renew, where the loss is.',
    /* ---------- دليل الشرح: سلسلة الاشتقاق ---------- */
    'من الورقة إلى الإنسايتس — سلسلة الاشتقاق كاملة': 'From paper to insights — the full derivation chain',
    'إزاي «مجرد إكسيل» بيطلّع كل الأرقام دي؟ كل مؤشر في المنظومة نتيجة 3 حقائق من الورقة + قاعدة حساب معلنة:':
      'How does “just an Excel sheet” yield all these figures? Every KPI in the suite follows from 3 facts on the paper + a declared calculation rule:',
    'الحقيقة 1: العقد (من/إلى + قيم السنوات 1-2-3)': 'Fact 1: the contract (from/to + year values 1-2-3)',
    'بيولّد «جدول استحقاق»: كل شهر داخل مدة العقد عليه مبلغ مستحق':
      'Generates a “dues schedule”: every month within the contract term has an amount due',
    'أعمدة «من/إلى/1/2/3» في الورقة — والبند الثالث في العقد بينص إن القيمة «شهريًا»':
      'The “from/to/1/2/3” columns on the paper — and Clause 3 of the contract states the value is “monthly”',
    'استحقاق الشهر = قيمة سنة العقد الجارية (+ الصيانة إن وُجدت + الضريبة للخاضعين). الشهر المقطوع بين سنتين يتحسب باليوم':
      'Month due = the current contract-year value (+ maintenance if any + VAT where applicable). A month split across two years is prorated per day',
    'الحقيقة 2: علامة الشهر (✓ / ✗ / شاغرة)': 'Fact 2: the month mark (✓ / ✗ / blank)',
    '✓ = حصل سداد (بلا تفاصيل) · ✗ = متأخر مؤكد · الشاغرة = لا نعرف':
      '✓ = a payment happened (no details) · ✗ = confirmed late · blank = we don’t know',
    'شبكة الشهور في الورقة، بتتفرّغ كما هي بوضع نقل الورقة': 'The paper’s month grid, transcribed as-is in Transcribe mode',
    '✓ تُحسب سدادًا كاملًا بقيمة الاستحقاق (افتراض مُعلَن لحد ما تتوثّق) · ✗ يدخل المتأخرات · الشاغرة يتعلّم «يحتاج تأكيدًا» ولا يدخل أي إجمالي إلا بقيمته المحتملة منفصلة':
      '✓ counts as full payment at the due amount (a declared assumption until documented) · ✗ enters the arrears · blank is flagged “Needs confirmation” and enters no total except as a separate potential value',
    'الحقيقة 3: التاريخ الجاري (النهارده)': 'Fact 3: the current date (today)',
    'بيحوّل الجدول لحالات: مدفوع/مستحق/متأخر/لم يستحق': 'Turns the schedule into states: paid / due / late / not yet due',
    'ساعة الجهاز + يوم الاستحقاق في العقد (أول الشهر بنص بنود العقد) + أيام السماح من الإعدادات':
      'The device clock + the contract’s due day (the 1st, per the contract clauses) + grace days from Settings',
    'شهر مستحق بلا سداد وتجاوز (يوم الاستحقاق + السماح) ⇒ متأخر، وعمره = عدد الأيام منذ الاستحقاق ⇒ شرائح 30/60/90':
      'A due month with no payment past (due day + grace) ⇒ late; its age = days since due ⇒ 30/60/90 buckets',
    'كل المتبقّي تجميعات': 'Everything else is aggregation',
    'أي كارد أو رسم في المنظومة هو مجموع/نسبة/ترتيب للحالات دي — مفيش رقم بيتكتب يدويًا':
      'Every card or chart in the suite is a sum / ratio / ranking of these states — no figure is ever typed by hand',
    'محرك الحالات أعلاه': 'The state engine above',
    'تحصيل الشهر = Σ محصَّل ÷ Σ مستحق · المتأخرات = Σ (مستحق−مسدَّد) للمتأخر · الإشغال = وحدات بعقد نشط ÷ الكل · إلخ':
      'Month collection = Σ collected ÷ Σ due · Arrears = Σ (due − paid) for the late · Occupancy = units with an active contract ÷ all · etc.',
    /* ---------- دليل الشرح: بنود العقد ---------- */
    'نموذج العقد الفعلي → أثره في المنظومة': 'The actual contract form → its footprint in the suite',
    'قرأنا عقد العينة (قانون 4 لسنة 2006) بندًا بندًا — ده اللي اتبني منه:':
      'We read the sample contract (Law 4 of 2006) clause by clause — this is what was built from it:',
    'البند الثالث: القيمة الإيجارية «جنيه شهريًا»': 'Clause 3: the rental value in “pounds monthly”',
    'حسم سؤال شهري/سنوي': 'Settles the monthly/annual question',
    'نص البند': 'The clause text',
    'نص البندين': 'The two clauses’ text',
    'أساس الحساب شهري (قابل للتبديل من الإعدادات لو ظهر عقد مختلف)':
      'Calculation basis is monthly (switchable in Settings if a different contract appears)',
    'بند الجودة Q22 اتحدّث بالنص': 'Quality item Q22 was updated with the text',
    'سداد الإيجار «في اليوم الأول من الشهر الميلادي»': 'Rent paid “on the first day of the calendar month”',
    'يوم الاستحقاق وبداية عدّ التأخير': 'The due day and when lateness starts counting',
    'بند الالتزامات': 'The obligations clause',
    'خانة «يوم الاستحقاق» في كل عقد (افتراضي 1) + أيام سماح قابلة للضبط':
      'A “due day” field on every contract (default 1) + adjustable grace days',
    'دفعة بتاريخ بعد اليوم 1+5 سماح تتعلّم «مدفوع متأخرًا»': 'A payment dated after day 1 + 5 grace is flagged “paid late”',
    'البند الرابع: صيانة شهرية تُسدَّد مع الإيجار': 'Clause 4: monthly maintenance paid with the rent',
    'بند مستقل في الاستحقاق مش مضموم للإيجار': 'A separate dues line, not folded into the rent',
    'نص البند (القيمة فارغة في العينة!)': 'The clause text (the amount is blank in the sample!)',
    'خانة صيانة بكل عقد تدخل استحقاق الشهر وتظهر منفصلة في التلميح والدرج':
      'A maintenance field on every contract feeds the month’s dues and shows separately in the tooltip and drawer',
    'محل 1 (برج النيل): 41,800 إيجار + 1,200 صيانة + ض.ق.م': 'Shop 1 (Nile Tower): 41,800 rent + 1,200 maintenance + VAT',
    'البند الخامس: التأمين «بواقع شهر»، يُرد أو يُخصم': 'Clause 5: the deposit “at one month”, refunded or deducted',
    'التزام مالي على المالك لازم يبان': 'A financial liability on the owner that must be visible in the figures',
    'نص البند + ملاحظة «35,000 تأمين» للوحدة 41': 'The clause text + the “35,000 deposit” note for unit 41',
    'خانة تأمين بكل عقد + كارد «تأمينات محتجزة» يجمعها + تنبيه للعقود الناقصة':
      'A deposit field on every contract + a “Deposits held” card summing them + an alert for missing ones',
    '41: تأمين 35,000 ≈ شهر من 36,000 — مطابق للبند': '41: a 35,000 deposit ≈ one month of 36,000 — matches the clause',
    'البند السادس: لا تأجير من الباطن ولا تغيير استخدام': 'Clause 6: no subletting and no change of use',
    'خطر تشغيلي يُتابَع ميدانيًا': 'An operational risk followed up in the field',
    'ملاحظة الوحدة + الشكاوى مكانهما الطبيعي لأي مخالفة تُرصد': 'The unit note + Complaints are the natural home for any observed violation',
    'صف «الميزان 2» المزدوج (الدقة/العنوان) — Q2 بيسأل: مين العميل الفعلي؟':
      'The duplicated “Mezzanine 2” row (El-Dekka/El-Enwan) — Q2 asks: who is the actual client?',
    'البند العاشر: ض.ق.م على العميل وتُسدَّد مع الإيجار': 'Clause 10: VAT on the client, paid with the rent',
    'إضافة الضريبة لاستحقاق الخاضعين': 'Adds the tax to dues on VAT-applicable contracts',
    'علامة «خاضع» بكل عقد ⇒ الاستحقاق × (1 + النسبة من الإعدادات)': 'A “VAT applicable” flag per contract ⇒ dues × (1 + the rate from Settings)',
    'Q19: لسه محتاجين حصر مين الخاضع في كشف سكرية': 'Q19: we still need to identify who is VAT-applicable in the Sokareya statement',
    'البندان التاسع والسادس: الإنهاء المبكر = مصادرة التأمين': 'Clauses 9 & 6: early termination = deposit forfeiture',
    'قاعدة تسوية عند خروج عميل': 'A settlement rule on client exit',
    'مرحلة قادمة: شاشة «تسوية خروج» (رد/خصم من التأمين بمستنداته) — مسجّلة في خارطة الطريق':
      'A coming phase: an “exit settlement” screen (refund / documented deduction from the deposit) — on the roadmap',
    '42 المنتهي بلا تجديد: Q16 بيسأل عن تسوية تأمينه': '42, ended with no renewal: Q16 asks about settling its deposit',
    /* ---------- دليل الشرح: توثيق الشاشات ---------- */
    'المرجع الكامل: خريطة العملية، ومنطق كل رقم — من الورقة للإنسايت.':
      'The complete reference: the process map and the logic of every figure — from paper to insight.',
    'يعبّر عن': 'Means', 'مصدره': 'Source', 'حسابه': 'Calculation', 'مثال حي': 'Live example',
    'لوحة المؤشرات — كارد كارد': 'Dashboard — card by card',
    'تحصيل الشهر + ▲▼': 'Month collection + ▲▼',
    'نسبة المحصَّل من المستحق لشهر التقرير، والسهم فرقها عن الشهر السابق بالنقاط':
      'Collected-to-due ratio for the report month; the arrow is the point change vs the prior month',
    'الدفعات + العقود': 'Payments + contracts',
    'Σ المحصَّل ÷ Σ المستحق (السداد المستورد ✓ يُحسب كاملًا — افتراض معلن)':
      'Σ collected ÷ Σ due (imported ✓ payments count in full — a declared assumption)',
    'متأخرات مؤكَّدة': 'Confirmed arrears',
    'فلوس مستحقة وثابت عدم سدادها': 'Money that is due and provably unpaid',
    '✗ الورقة + الشهور المتجاوزة للسماح بلا سداد': 'Paper ✗ marks + months past grace with no payment',
    'Σ (مستحق − مسدَّد) لكل شهر×وحدة متأخر — والمجهول القيمة (سكرية) يُعد منفصلًا ولا يُخلَط':
      'Σ (due − paid) for every late unit-month — unknown-value items (Sokareya) are counted separately, never mixed in',
    'خانات فارغة داخل تغطية الورقة — سداد أم تأخير؟ غير معروف':
      'Blank cells inside the paper’s range — paid or late? Nobody knows',
    'الفراغات في شبكة شهور الورقة': 'The blanks in the paper’s month grid',
    'Σ استحقاق الشهور الفارغة داخل التغطية — يُعرض كنطاق عدم يقين مش كمتأخرات':
      'Σ dues of the blank months inside the range — shown as an uncertainty band, not as arrears',
    'الإشغال / التجديدات / التأمينات': 'Occupancy / renewals / deposits',
    'وحدات بعقد نشط اليوم · عقود تنتهي ≤90 يوم بلا لاحق · مجموع التأمينات المحتجزة':
      'Units with an active contract today · contracts ending ≤90 days with no successor · total deposits held',
    'تواريخ العقود + خانات التأمين': 'Contract dates + deposit fields',
    'مقارنات تواريخ مباشرة — «منتهٍ بلا تجديد» يعني آخر عقد للوحدة انتهى ومفيش عقد مربوط به':
      'Direct date comparisons — “ended, no renewal” means the unit’s last contract expired with no contract linked to it',
    '42 انتهى 2026/7/30 بلا تجديد ⇒ تنبيه أحمر': '42 ended 2026/7/30 with no renewal ⇒ a red alert',
    'حالة المباني (الواجهات)': 'Buildings status (elevations)',
    'كل وحدة مربع بلون حالتها في شهر التقرير — نظرة واحدة تعرف منها مين واقف فين':
      'Each unit is a square colored by its report-month state — one glance shows where every unit stands',
    'محرك الحالات لكل وحدة×الشهر': 'The state engine per unit × month',
    'نفس ألوان جدول التحصيل: أخضر محصَّل، كهرماني جزئي/متأخر السداد، أحمر متأخر، مقلّم يحتاج تأكيدًا':
      'Same collection sheet colors: green collected, amber partial/paid-late, red late, striped undocumented',
    'صف سكرية أحمر كامل — 6 أشهر ✗': 'The Sokareya row is solid red — 6 months of ✗',
    'من لم يسدِّد؟': 'Who has not paid?',
    'الإجابة المباشرة لسؤالك: أسماء ومبالغ الشهر المختار، مرتّبة بالأكبر':
      'The direct answer to your question: names and amounts for the chosen month, largest first',
    'حالات الشهر المختار': 'The chosen month’s states',
    'كل وحدة حالتها متأخر/جزئي/يحتاج تأكيدًا/في السماح + المتبقي عليها — الضغط يفتح خلية التسجيل':
      'Every unit that is late / partial / undocumented / in grace + its remaining balance — clicking opens the recording cell',
    'يوليو: 9 وحدات لم تسدِّد بإجمالي 453,254': 'July: 9 units unpaid, totaling 453,254',
    'التحصيل الشهري (رسم)': 'Monthly collection (chart)',
    'العمود الفاتح = المستحق، الغامق = المحصَّل — الفرق بينهما هو الفجوة':
      'The light bar = due, the dark = collected — the difference is the gap',
    'إجماليات كل شهر': 'Each month’s totals',
    'آخر 12 شهرًا حتى شهر التقرير + «؟» تحت الشهور التي فيها سداد يحتاج تأكيدًا + زر «عرض كجدول»':
      'The last 12 months up to the report month + “?” under months holding payments needing confirmation + a “View as table” button',
    'يوليو: عمود فاتح كامل بلا تعبئة = 0٪': 'July: a full light bar with no fill = 0%',
    'أعمار المتأخرات': 'Arrears aging',
    'قد إيه المتأخرات قديمة — الأقدم أصعب تحصيلًا': 'How old the arrears are — the older, the harder to collect',
    'عمر كل شهر متأخر باليوم': 'Each late month’s age in days',
    'شرائح 1–30 / 31–60 / 61–90 / +90 من يوم الاستحقاق': 'Buckets 1–30 / 31–60 / 61–90 / 90+ from the due day',
    'جدول التحصيل — لغة الخلايا': 'The collection sheet — the language of the cells',
    'هي نفسها ورقتك، بس كل رمز وراه بيانات:': 'It is the same paper you already know — but every symbol is backed by data:',
    '✓ أخضر غامق / ✓ منقّط / ✓ كهرماني': '✓ solid green / ✓ dotted / ✓ amber',
    'مدفوع موثَّق (بمبلغ وتاريخ) / مدفوع من الورقة بلا تفاصيل / مدفوع بعد ميعاده':
      'Paid documented (amount & date) / paid per paper without details / paid past its deadline',
    'الدفعات المدخلة أو علامات الورقة': 'Entered payments or paper marks',
    'المنقّط بيفضل «يحتاج توثيق» لحد ما تسجّل مبلغه وتاريخه الفعليين من خليته':
      'A dotted mark stays “needs documentation” until you record the actual amount and date from its cell',
    '½ / ✗ / ؟ / • / – / ·': '½ / ✗ / ? / • / – / ·',
    'جزئي / متأخر / يحتاج تأكيدًا / مستحق في السماح / خارج مدة العقد / قبل تغطية الورقة':
      'Partial / late / undocumented / due in grace / outside the contract term / before the paper’s range',
    'محرك الحالات': 'The state engine',
    '«≈» جنب الرمز = القيمة تقديرية (+10٪ غير مدوَّنة في الورقة)':
      '“≈” next to the symbol = an estimated value (+10%, not written on the paper)',
    'وضعا العمل': 'The two modes',
    '«تسجيل دفعات»: الضغطة تفتح دفعة كاملة · «تفريغ ورقة»: الضغطة تقلّب ✓/✗/فارغ':
      '“Record payments”: a click opens a full payment · “Transcribe paper”: a click cycles ✓/✗/blank',
    'التفريغ للتاريخ القديم من الورق، والدفعات للتشغيل اليومي':
      'Transcription is for paper history; payments are for daily operations',
    'سداد جماعي': 'Bulk collection',
    'شهر كامل بضغطة — لما تبقى مأجّر مئات': 'A whole month in one click — for when you rent out hundreds',
    'المستحق غير المسدَّد للشهر المختار': 'The unpaid dues of the chosen month',
    'قائمة بكل المستحق عليهم + تعليم، والحفظ يسجّل دفعة كاملة لكل معلَّم بتاريخ وطريقة موحّدين — الاستثناءات من خلاياها':
      'A list of every unit with dues + checkboxes; saving records a full payment for each checked one with a shared date and method — exceptions via their own cells',
    'عمود «متأخرات» آخر الصف': 'The “Arrears” column at row end',
    'رصيد الوحدة المتأخر الكلي عبر كل الشهور': 'The unit’s total late balance across all months',
    'تجميع صف الوحدة': 'The unit row’s aggregate',
    'Σ متبقي الشهور المتأخرة + «؟×n» للمجهول': 'Σ remaining of the late months + “?×n” for the unknown',
    'متبقّي الشاشات — باختصار': 'The other screens — in brief',
    'الإنسايتس المكتوبة + تحليل العقود + الالتزام + التوزيعات': 'Written insights + contract analysis + punctuality + distributions',
    'كل ما سبق': 'All of the above',
    'كل بطاقة إنسايت جملة محسوبة بشرطها (مثلًا: منحدر الإيراد يظهر فقط لو النصف الثاني أقل 15٪+) وتنقلك لمكان الإجراء':
      'Every insight card is a computed sentence with its own condition (e.g. the revenue slope shows only if H2 is 15%+ lower) and links you to where you act',
    'الوحدات / العقود / العملاء': 'Units / Contracts / Clients',
    'ملفات الكيانات: بطاقات بالكشف، جانت زمني بخط «اليوم»، أرصدة لحظية':
      'Entity files: cards per statement, a Gantt timeline with a “today” line, live balances',
    'العقود والدفعات': 'Contracts and payments',
    'حالة الوحدة محسوبة من عقودها — عمرها ما بتتكتب يدويًا': 'A unit’s state is computed from its contracts — never typed by hand',
    'سجل بالتصنيف والتكلفة ومن يتحمّلها وزمن الإغلاق': 'A log with category, cost, who bears it, and time to close',
    'إدخال يدوي — السجل بيبدأ من أول يوم تشغيل': 'Manual entry — the log starts from day one of operations',
    'متوسط زمن الإغلاق = متوسط (تاريخ الإغلاق − الفتح) · مؤشر «بعد التسليم» محتاج تواريخ تسليم (Q20)':
      'Avg. time to close = mean of (close date − open date) · the “post-handover” KPI needs handover dates (Q20)',
    'كل تناقض/نقص في الورقة بنصه الحرفي وقرار تفسيره وسؤاله للمالك':
      'Every contradiction/gap on the paper, verbatim, with its interpretation decision and its question for the owner',
    'التفريغ + شيت درجة الثقة + صور الورقة والعقد': 'The transcription + the confidence-score sheet + photos of the paper and contract',
    'الحسم بيتسجّل بنصه في السجل — عمره ما بيتمسح': 'The resolution is recorded verbatim in the log — it is never erased',
    'كل افتراض معلن هنا: أساس الإيجار، السماح، الزيادة، الضريبة + إدارة الكشوف + التصدير':
      'Every assumption is declared here: rent basis, grace, increase, VAT + statement management + exports',
    'أي تغيير يعيد حساب كل الأرقام فورًا': 'Any change recomputes every figure instantly',
    'يوم الاستحقاق وبداية عدّ التأخير': 'The due day and when lateness starts counting',
    '1,519,345 ج.م + 6 أشهر مجهولة': '1,519,345 EGP + 6 unknown months',
    '198,000 ج.م (تقوى: يناير–مارس)': '198,000 EGP (Taqwa: Jan–Mar)',
    'أقدم شريحة حاليًا: 80,200 ج.م فوق 90 يومًا': 'Oldest bucket currently: 80,200 EGP past 90 days',
    'تقوى عبدالمنعم: يناير–مارس فارغة في الورقة = 198,000 ج.م «يحتاج تأكيدًا» — ليست متأخرات وليست تحصيلًا':
      'Taqwa Abdelmoneim: January–March blank on the paper = 198,000 EGP “Needs confirmation” — neither arrears nor collection',
    'يوليو 2026 كله بلا أي علامة في الورقة ⇒ 453,254 ج.م متأخرات مؤكدة عمرها 31–60 يومًا':
      'July 2026 has no marks at all on the paper ⇒ 453,254 EGP confirmed arrears aged 31–60 days',
    /* ---------- عام / لوحة / مصفوفة / تلميحات ---------- */
    'ع': 'AR',
    '؟': '?',
    'الشكاوى والصيانة': 'Complaints & Maintenance',
    'المطلوب:': 'Action needed:',
    'قرار الحسم:': 'Resolution:',
    'الوضع الليلي': 'Dark mode',
    'دليل الاستخدام الكامل': 'Full user guide',
    'شهر أسبق': 'Earlier month', 'شهر أحدث': 'Later month',
    'سنة أسبق': 'Earlier year', 'سنة أحدث': 'Later year',
    'جزئي': 'Partial',
    'منتهٍ بلا تجديد': 'Ended, no renewal',
    'لا وحدات ضمن الترشيح الحالي': 'No units match the current filter',
    'لا وحدات ضمن الترشيح': 'No units match the filter',
    'لا عقود ضمن الترشيح': 'No contracts match the filter',
    'لا عملاء ضمن الترشيح': 'No clients match the filter',
    'لا ملاحظات ضمن هذا الترشيح': 'No notes match this filter',
    'لا انتهاءات خلال 12 شهرًا': 'No expiries within 12 months',
    'لا مستحقات غير مسدَّدة لهذا الشهر ضمن الترشيح': 'No unpaid dues this month within the filter',
    'لا شكاوى مسجَّلة': 'No complaints on file',
    'أول شكوى تُسجَّل من الزر أعلاه — وتظهر مؤشراتها هنا فورًا':
      'Log the first complaint from the button above — its KPIs appear here instantly',
    'الإجمالي غير المحصَّل:': 'Total uncollected:',
    '+ بنود بقيمة مجهولة': '+ items of unknown value',
    'بيانات توضيحية مولَّدة لتجربة تعدد الكشوف — ليست بيانات فعلية. تُحذف بزر واحد من الإعدادات.':
      'Generated sample data to try multi-statement mode — not real data. One button in Settings deletes it.',
    'اضغط للتفاصيل والتسجيل': 'Click for details & recording',
    'اضغط لفتح ملف الوحدة': 'Click to open the unit file',
    'وضع التفريغ: الضغط يقلّب ✓/✗/مسح': 'Transcribe mode: clicking cycles ✓/✗/clear',
    'القيمة غير معروفة — لا عقد مسجّل': 'Value unknown — no contract on file',
    '(تقديري)': '(estimated)',
    '(جزء تقديري)': '(partly estimated)',
    'لا استحقاق': 'No dues',
    'الشهر عليه دفعات مسجَّلة — أطفئ وضع التفريغ لتعديلها':
      'This month has recorded payments — turn off Transcribe mode to edit them',
    'علامات ✓/✗ بتتعلّم على صفوف الورقة (وحدة + عميل + عقد). أضف صفوف الورقة الأول، وبعدين ارجع هنا فرّغ العلامات.':
      '✓/✗ marks attach to paper rows (unit + client + contract). Add the paper’s rows first, then come back here to transcribe the marks.',
    'وسّع الترشيح من السلايسرز فوق، أو امسح البحث.': 'Widen the filter from the slicers above, or clear the search.',
    /* ---------- الأدراج ---------- */
    'سداد جماعي — شهر كامل': 'Bulk collection — a whole month',
    'حدِّد من سدَّدوا بالكامل واحفظ مرة واحدة — بدلًا من فتح كل خلية. الجزئي والاستثناءات تُسجَّل من خلاياها.':
      'Check everyone who paid in full and save once — instead of opening 1,000 cells. Record partials and exceptions from their own cells.',
    'المستحق عليهم (المحدَّد = سيُسجَّل مدفوعًا بالكامل)': 'Units with outstanding dues (checked = will be recorded as paid in full)',
    'حفظ الدفعات المحددة': 'Save checked payments',
    'لم تحدد أي وحدة': 'No unit checked',
    'هذا الشهر يقطع سنتَي عقد — محسوب باليوم:': 'This month spans two contract years — prorated per day:',
    'القيمة تقديرية (+10٪) — لم تُدوَّن في الكشف. راجع جودة البيانات.':
      'The value is estimated (+10%) — not written in the statement. See Data Quality.',
    'سداد مسجّل بلا عقد — سجِّل العقد أولًا ليُحتسب الاستحقاق.':
      'A payment on file with no contract — record the contract first so dues can be computed.',
    'متأخر مؤكَّد (✗ في الكشف) لكن لا عقد مسجّل — القيمة غير معروفة.':
      'Confirmed late (✗ in the statement) but no contract on file — the value is unknown.',
    'لا عقد يغطي هذا الشهر.': 'No contract covers this month.',
    'منها صيانة (البند الرابع)': 'Incl. maintenance (Clause 4)',
    'منها ض.ق.م (البند العاشر)': 'Incl. VAT (Clause 10)',
    'المستحق غير محسوب — لا عقد': 'Dues not computed — no contract',
    'أدخل مبلغًا صحيحًا': 'Enter a valid amount',
    'سُجِّلت الدفعة — الحالة والمؤشرات تحدَّثت فورًا': 'Payment recorded — state and KPIs updated instantly',
    'حذف هذه الدفعة؟': 'Delete this payment?',
    'حُذفت الدفعة': 'Payment deleted',
    'حذف': 'Delete',
    'خاضع لض.ق.م': 'VAT applicable',
    'بيانات العميل': 'Client details',
    'الاسم': 'Name', 'الوحدات': 'Units',
    'لازم للتنبيهات لاحقًا (واتساب)': 'Needed for reminders later (WhatsApp)',
    'أدخل الاسم': 'Enter the name',
    'حُفظ': 'Saved',
    'أدخل اسم الوحدة': 'Enter the unit name',
    'أُضيفت الوحدة': 'Unit added',
    'مثال: محل 3': 'e.g. Shop 3',
    'أرضي / الأول / …': 'Ground / First / …',
    'م² — اختياري': 'm² — optional',
    'المبنى / الكشف': 'Building / Statement',
    'اسم الوحدة': 'Unit name',
    '+ عميل جديد…': '+ New client…',
    'اسم العميل الجديد': 'New client name',
    'النهاية تُحسب تلقائيًا — يستحيل عقد نهايته قبل بدايته': 'The end is computed automatically — an end-before-start contract is impossible',
    'أساس الحساب الحالي: شهري': 'Current basis: monthly',
    'أساس الحساب الحالي: سنوي': 'Current basis: annual',
    'الإيجار الشهري للسنة الأولى': 'Year-1 monthly rent',
    'الإيجار السنوي للسنة الأولى': 'Year-1 annual rent',
    'النمط الملاحظ في عقودكم: 10٪': 'The pattern seen in your contracts: 10%',
    'التأخير يُحسب من هذا اليوم': 'Lateness counts from this day',
    'تُضاف للاستحقاق الشهري تلقائيًا': 'Added to the monthly dues automatically',
    'البند الرابع — اختياري': 'Clause 4 — optional',
    'أدخل قيمة السنة الأولى لتوليد الجدول.': 'Enter the year-1 value to generate the schedule.',
    'أكمل تاريخ البداية وقيمة سنة أولى موجبة': 'Complete the start date and a positive year-1 value',
    'اختر العميل أولًا — أو سجِّل عميلًا جديدًا من نفس القائمة': 'Choose the client first — or register a new one from the same list',
    'اختر الوحدة — غيِّر المشروع أو علِّم «عرض كل الوحدات»': 'Choose the unit — switch project or tick “Show all units”',
    'النهاية تُحسب تلقائيًا — والمدة هي التي تحدد الوحدات المتاحة أدناه':
      'The end date is computed automatically — and the term is what decides which units are available below',
    'لا وحدات مسجَّلة في هذا المشروع — أضِفها من شاشة الوحدات أولًا': 'No units registered in this project — add them from the Units screen first',
    'لا وحدة متاحة في هذا المشروع بهذه المدة — علِّم «عرض كل الوحدات» إن كان تجديدًا':
      'No unit is available in this project for this term — tick “Show all units” if this is a renewal',
    'لا تُقبل قيم سالبة': 'Negative values are not accepted',
    'أدخل اسم العميل الجديد': 'Enter the new client’s name',
    'سُجِّل العقد وبدأ حساب الاستحقاق فورًا': 'Contract recorded — dues computation started instantly',
    'أُغلقت الشكوى': 'Complaint closed',
    'سُجِّلت الشكوى': 'Complaint logged',
    'أدخل تاريخ الفتح': 'Enter the open date',
    'تاريخ الفتح لا يمكن أن يكون مستقبليًا': 'The open date cannot be in the future',
    'وصف مختصر': 'Short description',
    'معطَّل: تواريخ التسليم غير مسجَّلة بعد (جودة البيانات)': 'Disabled: handover dates not recorded yet (Data Quality)',
    /* ---------- جودة البيانات (الشاشة) ---------- */
    'جودة البيانات — كشف «بيان عبدالمنعم سكرية»': 'Data Quality — “Abdelmoneim Sokareya Statement”',
    'اكتب إجابة المالك / القرار النهائي لهذا السؤال (مثال: «المدة سنتان فعلًا والقيمة 39,000 صحيحة»). سيُحفظ نصيًا مع البند ويقفله:':
      'Type the owner’s answer / final decision for this question (e.g. “the term really is two years and 39,000 is correct”). It will be saved verbatim with the item and close it:',
    'اتسجّل القرار واتقفل البند': 'Resolution recorded — item closed',
    'الحسم = إجابة المالك على السؤال. بتتسجّل نصيًا مع البند وبيتقفل — وتدخل بياناتها النظام (تعديل عقد/توثيق دفعة…)':
      'A resolution = the owner’s answer to the question. It is saved verbatim with the item, which closes — and its data enters the system (contract edits / payment documentation…)',
    /* ---------- الإعدادات ---------- */
    'محسوم من عقد العينة — البند الثالث ينص حرفيًا: «القيمة الإيجارية للمكان … جنيه':
      'Settled by the sample contract — Clause 3 reads verbatim: “the rental value of the premises … pounds',
    'شهريًا': 'monthly',
    '(فقط لا غير)». التبديل هنا متاح فقط لو ظهر كشف بعقود من نموذج مختلف.':
      '(and no more)”. Switching here exists only in case a statement with a different contract form appears.',
    '— بنص البند الثالث (وتؤكدها قرينة تأمين 41 = 35,000 ≈ شهر)':
      '— per Clause 3 (corroborated by unit 41’s deposit: 35,000 ≈ one month)',
    '— يُقسم المبلغ على 12 شهرًا': '— the amount is divided by 12 months',
    'تم التأكيد أن جميع العقود على نفس النموذج': 'Confirmed: all contracts follow the same form',
    'فعلي': 'Real',
    'اسم المبنى / الكشف': 'Building / statement name',
    'المنطقة — اختياري': 'District — optional',
    'أدخل اسم المبنى': 'Enter the building name',
    'أُضيف المبنى — أضف وحداته من شاشة الوحدات ثم عقوده، أو فرّغ كشفه من جدول التحصيل بوضع نقل الورقة':
      'Building added — add its units from the Units screen then its contracts, or transcribe its statement from the collection sheet in Transcribe mode',
    'عند بدء الاستخدام الفعلي:': 'When real operations begin:',
    'حذف المبنيين التوضيحيين وكل بياناتهما نهائيًا؟': 'Permanently delete the two sample buildings and all their data?',
    'حُذفت البيانات التوضيحية': 'Sample data deleted',
    'أُعيد حساب كل الأرقام على أساس شهري': 'All figures recomputed on a monthly basis',
    'أُعيد حساب كل الأرقام على أساس سنوي (القيمة ÷ 12)': 'All figures recomputed on an annual basis (value ÷ 12)',
    'أيام السماح بعد يوم الاستحقاق': 'Grace days after the due day',
    'يوم الاستحقاق يُحدد في كل عقد (افتراضيًا أول الشهر)': 'The due day is set per contract (default: the 1st)',
    'نسبة الزيادة السنوية الافتراضية ٪': 'Default annual increase %',
    'تُستخدم في توليد جدول سنوات العقود الجديدة': 'Used to generate new contracts’ year schedules',
    'نسبة ضريبة القيمة المضافة ٪': 'VAT rate %',
    'تُطبق على العقود المُعلَّمة «خاضع» فقط': 'Applied only to contracts flagged “VAT applicable”',
    'مصدر الكشف الفعلي:': 'Real statement source:',
    'التعديلات تُحفظ محليًا على هذا الجهاز (نسخة عرض — النسخة التشغيلية تُحفظ على خادم بصلاحيات وسجل تعديلات).':
      'Edits are saved locally on this device (demo build — the production build saves to a server with permissions and an audit trail).',
    'إعادة تعيين كل البيانات إلى بذرة الكشف الأصلية؟ ستفقد الدفعات والعقود المُدخلة.':
      'Reset all data to the original statement seed? Entered payments and contracts will be lost.',
    'أُعيدت البيانات للأصل': 'Data reset to the original',
    'دوس على خلية الشهر المطلوب لتسجيل الدفعة': 'Click the desired month cell to record the payment',
    /* ---------- إدخال كشف جديد ---------- */
    'اكتب اسم المالك': 'Type the owner’s name',
    'الكشف:': 'Statement:',
    '— أضف صفوفه بالأسفل، أو': '— add its rows below, or',
    'ابدأ كشفًا آخر': 'start another statement',
    'كما في عمود «اسم العميل»': 'As in the “client name” column',
    'كما في عمود «الوحدة»': 'As in the “unit” column',
    'اكتب أي نوع…': 'Type any type…',
    'اكتب أي نوع جديد بحرّية': 'Type any new type freely',
    'اسم العميل': 'Client name',
    'من (بداية العقد)': 'From (contract start)',
    'قيمة السنة 1': 'Year-1 value', 'قيمة السنة 2': 'Year-2 value', 'قيمة السنة 3': 'Year-3 value',
    'عمود «1»': 'Column “1”', 'عمود «2» — اختياري': 'Column “2” — optional', 'عمود «3» — اختياري': 'Column “3” — optional',
    'إن ذُكر في الملاحظات': 'If mentioned in the notes',
    'عمود «ملاحظات» بنصّه': 'The “notes” column, verbatim',
    'أدخل البداية وقيمة سنة واحدة على الأقل': 'Enter the start and at least one year value',
    'املأ 2 و3 بزيادة 10٪ (النمط السائد)': 'Fill 2 & 3 with a 10% increase (the prevailing pattern)',
    'أدخل قيمة السنة 1 أولًا': 'Enter the year-1 value first',
    'الصفوف المُدخلة (مطابقة لأعمدة الورقة)': 'Entered rows (matching the paper’s columns)',
    'لم تُضف صفوف بعد.': 'No rows added yet.',
    'نفس أعمدة الورقة بالظبط: اسم العميل · الوحدة · من · قيم السنوات 1/2/3 (شهري — بنص البند الثالث في العقد) · ملاحظات. ما لم يُدوَّن في الورقة اتركه فارغًا — الفراغ معلومة لا خطأ.':
      'The paper’s exact columns: client name · unit · from · year values 1/2/3 (monthly — per Clause 3 of the contract) · notes. Leave blank whatever the paper does not write — a blank is information, not a mistake.',
    'نفس أعمدة الورقة بالظبط: اسم العميل · الوحدة · من · قيم السنوات 1/2/3 (سنوي — بنص البند الثالث في العقد) · ملاحظات. ما لم يُدوَّن في الورقة اتركه فارغًا — الفراغ معلومة لا خطأ.':
      'The paper’s exact columns: client name · unit · from · year values 1/2/3 (annual — per Clause 3 of the contract) · notes. Leave blank whatever the paper does not write — a blank is information, not a mistake.',
    'اكتب الوحدة أو اسم العميل على الأقل — كما تترك الورقة نفسها أحدهما أحيانًا':
      'Type at least the unit or the client name — just as the paper itself sometimes leaves one out',
    'أُضيف الصف ناقصًا — سيظهر «بلا عقد مسجّل» حتى تُستكمل بياناته':
      'Row added incomplete — it will show “No contract on file” like the Demolition Garage row, to be completed once its data is known',
    'بلا عقد': 'No contract',
    'افتح جدول التحصيل بوضع نقل الورقة: كل ضغطة على خلية تقلّبها ✓ ← ✗ ← فارغ — بسرعة الورقة نفسها. الخانة اللي الورقة ساكتة عنها سيبها فارغة وسيعلّمها النظام «يحتاج تأكيدًا».':
      'Open the collection sheet in Transcribe mode: each click cycles a cell ✓ → ✗ → blank — as fast as the paper itself. Leave blank whatever the paper is silent about; the system flags it “Needs confirmation”.',
    'العلامات بتتعلّم على صفوف الورقة — أضف الصفوف في الخطوة 2 الأول وبعدها الزر هيظهر هنا.':
      'Marks attach to the paper’s rows — add the rows in Step 2 first, and the button will appear here.',
    /* ---------- التحليلات ---------- */
    'الإيراد المتعاقد عليه ينخفض في النصف الثاني من السنة القادمة':
      'Contracted revenue drops in the second half of the coming year',
    'كل بند منها له سؤال جاهز للمالك في «مراجعات مطلوبة» — إجابته تضع المبلغ في مكانه الصحيح: سداد يُوثَّق أو متأخرات تُسجَّل.':
      'The portfolio’s biggest knowledge gap — every item has a specific question on the Data Quality screen; each answer enters the system and closes its item.',
    'محسوب من متوسط إيجار النوع المماثل — كل شهر تأخير في التأجير أو التجديد يكلّف هذا الرقم.':
      'Computed from the average rent of the same type — every month of leasing or renewal delay costs this figure.',
    'كل كشف ورقي = كيان مستقل بمؤشراته': 'Every paper statement = an independent entity with its own KPIs',
    'بمبلغ وتاريخ وإيصال — كشف سكرية كله علامات تحتاج تأكيدًا حتى الآن':
      'With amount, date & receipt — the Sokareya statement is still all marks needing confirmation',
    'تحليل العقود — من نموذج العقد الفعلي وبياناته': 'Contract analysis — from the actual contract form and its data',
    'متوسط مدة العقد': 'Average contract term',
    'الزيادة السنوية السائدة': 'Prevailing annual increase',
    'من قيم السنوات المدوَّنة فعلًا — تُستخدم افتراضًا للعقود الجديدة':
      'From the year values actually written — used as the default for new contracts',
    'عقود نشطة بتأمين مسجّل': 'Active contracts with a recorded deposit',
    'البند الخامس: التأمين «بواقع شهر» — الناقص فجوة توثيق': 'Clause 5: the deposit “at one month” — what’s missing is a documentation gap',
    'بصيانة / خاضعة للضريبة': 'With maintenance / VAT-applicable',
    'البند الرابع (صيانة شهرية مع الإيجار) والعاشر (ض.ق.م على العميل)':
      'Clause 4 (monthly maintenance with the rent) and 10 (VAT on the client)',
    'تقويم انتهاءات العقود — 12 شهرًا (بلا تجديد مسجّل)': 'Contract expiry calendar — 12 months (no renewal on file)',
    'عدد العقود المنتهية شهريًا': 'Contracts expiring per month',
    'التزام السداد بالعميل (من الدفعات الموثَّقة فقط)': 'Payment punctuality by client (documented payments only)',
    'يُحسب من الدفعات الموثَّقة فقط': 'Computed from documented payments only',
    'كشف سكرية كله علامات ✓ بلا تواريخ — أول شهر توثيق حقيقي سيُظهر هذا الجدول':
      'The Sokareya statement is all undated ✓ marks — the first real month of documentation will populate this table',
    /* ---------- الرسوم (aria/تلميحات) ---------- */
    'التحصيل الشهري: المحصَّل من المستحق لكل شهر': 'Monthly collection: collected vs due per month',
    'أعمار المتأخرات المؤكدة بالشرائح الزمنية': 'Confirmed arrears aging by time bucket',
    'الإيراد المتعاقد عليه للأشهر القادمة': 'Contracted revenue for the coming months',
    'توزيع الاستحقاق حسب نوع الوحدة': 'Dues distribution by unit type',
    'الخط الزمني للعقود لكل وحدة': 'Contracts timeline per unit',
    'اتجاه النسبة الشهرية': 'Monthly rate trend',
    'اتجاه نسبة التحصيل': 'Collection rate trend',
    'الحقيقة 1: العقد (من/إلى + قيم السنوات 1-2-3)': 'Fact 1: the contract (from/to + year values 1-2-3)',
  };

  /* حروف أوائل الأسماء (أفاتار العملاء) → حروف لاتينية */
  var INITIAL = {
    'ا': 'A', 'أ': 'A', 'إ': 'E', 'آ': 'A', 'ء': 'A', 'ى': 'A', 'ئ': 'Y', 'ؤ': 'W', 'ة': 'H',
    'ب': 'B', 'ت': 'T', 'ث': 'T', 'ج': 'G', 'ح': 'H', 'خ': 'K', 'د': 'D', 'ذ': 'Z',
    'ر': 'R', 'ز': 'Z', 'س': 'S', 'ش': 'S', 'ص': 'S', 'ض': 'D', 'ط': 'T', 'ظ': 'Z',
    'ع': 'A', 'غ': 'G', 'ف': 'F', 'ق': 'Q', 'ك': 'K', 'ل': 'L', 'م': 'M', 'ن': 'N',
    'ه': 'H', 'و': 'W', 'ي': 'Y',
  };

  /* ---------- أنماط الجمل المركّبة (تُنفَّذ قبل أنماط i18n.js) ---------- */
  window.I18N_PATTERNS = [
    [/^([اأإآءىئؤةبتثجحخدذرزسشصضطظعغفقكلمنهوي]{1,2})$/, function (m) {
      var out = '';
      for (var i = 0; i < m[1].length; i++) out += INITIAL[m[1][i]] || '';
      return out || m[1];
    }],
    /* عناوين بشهر وسنة: «محل 1 — مايو 2026» */
    [new RegExp('^(.+) — (' + MONTH_RE + ') (\\d{4})$'), function (m) { return en(m[1]) + ' — ' + MONTH[m[2]] + ' ' + m[3]; }],
    [new RegExp('^(' + MONTH_RE + ') (\\d{4}): (.+)$'), function (m) { return MONTH[m[1]] + ' ' + m[2] + ': ' + en(m[3]); }],
    /* أرقام ورموز */
    [/^(-?[\d.,]+)٪$/, function (m) { return m[1] + '%'; }],
    [/^([\d.,]+) م²$/, function (m) { return m[1] + ' m²'; }],
    [/^(\d+) يوم$/, function (m) { return m[1] + ' days'; }],
    [/^؟ ×(\d+)$/, function (m) { return '? ×' + m[1]; }],
    [/^([\d,]+) \((\d+)٪\)$/, function (m) { return m[1] + ' (' + m[2] + '%)'; }],
    [/^([\d,]+) من ([\d,]+)$/, function (m) { return m[1] + ' of ' + m[2]; }],
    [/^([\d.,]+) (ألف|مليون)\/شهر$/, function (m) { return m[1] + (m[2] === 'ألف' ? 'K' : 'M') + '/mo'; }],
    [/^([\d.,]+) (ألف|مليون)\/ش$/, function (m) { return m[1] + (m[2] === 'ألف' ? 'K' : 'M') + '/mo'; }],
    [/^(\d+) من الشهر$/, function (m) { return 'Day ' + m[1] + ' of the month'; }],
    /* تنبيهات اللوحة */
    [/^عقد (.+) على «(.+)» \((.+)\) انتهى منذ (.+) بلا تجديد\.$/, function (m) {
      return en(m[1]) + '’s contract on “' + en(m[2]) + '” (' + en(m[3]) + ') ended ' + days(m[4]) + ' ago with no renewal.';
    }],
    [/^عقد (.+) على «(.+)» ينتهي خلال (.+) \((.+)\)\.$/, function (m) {
      return en(m[1]) + '’s contract on “' + en(m[2]) + '” ends in ' + days(m[3]) + ' (' + m[4] + ').';
    }],
    [/^«(.+)»: (\d+) أشهر متأخرة مؤكَّدة بقيمة غير معروفة — لا يوجد عقد مسجّل\.$/, function (m) {
      return '“' + en(m[1]) + '”: ' + m[2] + ' months of confirmed arrears of unknown value — no contract on file.';
    }],
    [/^«(.+)» عليها ([\d,]+) ج\.م متأخرات \((.+)\)\.$/, function (m) {
      return '“' + en(m[1]) + '” carries ' + m[2] + ' EGP in arrears (' + months(m[3]) + ').';
    }],
    [/^(\d+) ملاحظة جودة بيانات مفتوحة على الكشف الفعلي، منها (\d+) حرجة\.$/, function (m) {
      return m[1] + ' open data-quality notes on the real statement, ' + m[2] + ' of them critical.';
    }],
    /* أسطر tile-sub المركّبة */
    [/^(\d+) شهر×وحدة · و(.+) بقيمة مجهولة$/, function (m) {
      return m[1] + ' unit-months · plus ' + months(m[2]) + ' of unknown value';
    }],
    [/^((?:\d+ أشهر|\d+ شهرًا|شهر واحد|شهرين)) بقيمة مجهولة$/, function (m) { return months(m[1]) + ' of unknown value'; }],
    [/^و(\d+) صفوف أخرى — كاملة في جدول التحصيل\.$/, function (m) { return 'plus ' + m[1] + ' more rows — the full list is in the collection sheet.'; }],
    [/^غير مشمول: (\d+) أشهر بقيمة مجهولة \(بلا عقد مسجّل\)\.$/, function (m) {
      return 'Not included: ' + m[1] + ' months of unknown value (no contract on file).';
    }],
    [/^المالك: (.+)$/, function (m) { return 'Owner: ' + en(m[1]); }],
    /* تلميحات المصفوفة والواجهات والرسوم */
    [/^مستحق (.+?): ([\d,]+) ج\.م$/, function (m) { return en(m[1]) + ' due: ' + m[2] + ' EGP'; }],
    [/^المستحق: ([\d,]+) ج\.م$/, function (m) { return 'Due: ' + m[1] + ' EGP'; }],
    [/^المحصَّل: ([\d,]+) ج\.م$/, function (m) { return 'Collected: ' + m[1] + ' EGP'; }],
    [/^النسبة: (.+)$/, function (m) { return 'Rate: ' + en(m[1]); }],
    [/^يحتاج تأكيدًا: ([\d,]+) ج\.م \((\d+) شهر×وحدة\)$/, function (m) { return 'Needs confirmation: ' + m[1] + ' EGP (' + m[2] + ' unit-months)'; }],
    [/^المسدَّد: ([\d,]+) ج\.م(?: في ([\d/]+))?$/, function (m) { return 'Paid: ' + m[1] + ' EGP' + (m[2] ? ' on ' + m[2] : ''); }],
    [/^أيام التأخير: (\d+)$/, function (m) { return 'Days late: ' + m[1]; }],
    [/^\(منها صيانة ([\d,]+)\)$/, function (m) { return '(incl. maintenance ' + m[1] + ')'; }],
    [/^\(\+ض\.ق\.م ([\d,]+)\)$/, function (m) { return '(+VAT ' + m[1] + ')'; }],
    [/^(\d+) يوم × (.+)$/, function (m) {
      return (m[0]).replace(/(\d+) يوم/g, '$1 days').replace(/ج\.م/g, 'EGP').replace(/\(تقديري\)/g, '(estimated)');
    }],
    [/^العقد لا يغطي الشهر كاملًا \((\d+) يومًا\) — الاستحقاق محسوب باليوم\.$/, function (m) {
      return 'The contract does not cover the full month (' + m[1] + ' days) — dues are prorated per day.';
    }],
    [/^الاستحقاق يوم (\d+)$/, function (m) { return 'Due day ' + m[1]; }],
    [/^صيانة ([\d,]+)$/, function (m) { return 'Maintenance ' + m[1]; }],
    [/^([\d/]+) ← ([\d/]+) \((.+)\)$/, function (m) { return m[1] + ' → ' + m[2] + ' (' + months(m[3]) + ')'; }],
    [/^(\d+) عقود تنتهي$/, function (m) { return m[1] + ' contracts ending'; }],
    [/^(\d+) — مؤجَّرة (\d+)، منتهية بلا تجديد (\d+)، بلا عقد \/ شاغرة (\d+)$/, function (m) {
      return m[1] + ' — occupied ' + m[2] + ', ended no-renewal ' + m[3] + ', no contract / vacant ' + m[4];
    }],
    [/^(مؤجَّرة|منتهية بلا تجديد|بلا عقد \/ شاغرة): (\d+)$/, function (m) {
      var k = { 'مؤجَّرة': 'Occupied', 'منتهية بلا تجديد': 'Ended, no renewal', 'بلا عقد / شاغرة': 'No contract / vacant' };
      return k[m[1]] + ': ' + m[2];
    }],
    /* المصفوفة الفارغة والمعالج */
    [/^كشف «(.+)» لسه مفيهوش صفوف$/, function (m) { return 'Statement “' + en(m[1]) + '” has no rows yet'; }],
    [/^أضف صفوف كشف «(.+)»$/, function (m) { return 'Add rows for statement “' + en(m[1]) + '”'; }],
    [/^الخطوة 2 — صفوف الورقة \((\d+)\)$/, function (m) { return 'Step 2 — Paper rows (' + m[1] + ')'; }],
    [/^ابدأ تفريغ العلامات \((\d+) (?:صف|صفوف)\)$/, function (m) { return 'Start transcribing marks (' + m[1] + ' row' + (m[1] === '1' ? '' : 's') + ')'; }],
    [/^النهاية تلقائيًا: ([\d/]+) \((\d+) (?:سنة|سنوات)\)$/, function (m) {
      return 'End auto-computed: ' + m[1] + ' (' + m[2] + ' year' + (m[2] === '1' ? '' : 's') + ')';
    }],
    [/^أُضيف الصف: عقد (.+) بقيمه المدوَّنة$/, function (m) {
      var n = m[1] === 'سنة' ? '1-year' : m[1].replace(/^(\d+) سنوات$/, '$1-year');
      return 'Row added: a ' + n + ' contract with its written values';
    }],
    [/^تنبيه: يوجد عقد قائم على الوحدة حتى ([\d/]+) — تأكد أن هذا تجديد أو صحّح التواريخ\.$/, function (m) {
      return 'Warning: a contract stands on this unit until ' + m[1] + ' — make sure this is a renewal, or fix the dates.';
    }],
    [/^القيمة \((شهري|سنوي)\)$/, function (m) { return 'Amount (' + (m[1] === 'شهري' ? 'monthly' : 'annual') + ')'; }],
    /* التحليلات */
    [/^تحصيل (.+?) (ثابت|ارتفع|انخفض)(?: (\d+) نقطة)?$/, function (m) {
      var w = m[2] === 'ثابت' ? 'flat' : m[2] === 'ارتفع' ? 'up' : 'down';
      return 'Collection — ' + en(m[1]) + ' ' + w + (m[3] ? ' ' + m[3] + ' pts' : '');
    }],
    [/^مقابل (\d+)٪ في (.+) — المحصَّل ([\d,]+) ج\.م من ([\d,]+) ج\.م مستحقة\.$/, function (m) {
      return 'Versus ' + m[1] + '% in ' + en(m[2]) + ' — collected ' + m[3] + ' EGP of ' + m[4] + ' EGP due.';
    }],
    [/^من المتأخرات متركّزة في (\d+) وحدات فقط$/, function (m) { return 'of arrears concentrated in just ' + m[1] + ' units'; }],
    [/^(.+) — ابدأ التحصيل من هنا\.$/, function (m) { return en(m[1]) + ' — start collecting here.'; }],
    [/^أفضل الكشوف تحصيلًا في (.+): (.+)$/, function (m) { return 'Best-collecting statement in ' + en(m[1]) + ': ' + en(m[2]); }],
    [/^الأدنى: (.+) بنسبة (\d+)٪ — فرق (\d+) نقطة يستحق سؤال «ليه؟»\.$/, function (m) {
      return 'Lowest: ' + en(m[1]) + ' at ' + m[2] + '% — a ' + m[3] + '-point gap worth asking “why?”.';
    }],
    [/^([\d,]+) ج\.م في أول 6 أشهر مقابل ([\d,]+) ج\.م في التالية — عقود تنتهي بلا تجديد مسجّل\. راجع خط العقود الزمني\.$/, function (m) {
      return m[1] + ' EGP in the first 6 months versus ' + m[2] + ' EGP in the next — contracts ending with no renewal on file. See the contracts timeline.';
    }],
    [/^لم يُحسم أمرها: (.+) متأخرة بقيمة مجهولة$/, function (m) { return 'Unresolved: ' + months(m[1]) + ' late of unknown value'; }],
    [/^فاقد إيراد شهري تقديري من (\d+) وحدات بلا عقد نشط$/, function (m) {
      return 'Estimated monthly revenue loss from ' + m[1] + ' units with no active contract';
    }],
    [/^الذروة: (.+) \((\d+) (?:عقد|عقود)\) — ابدأ مفاوضات التجديد قبلها بـ90 يومًا\.$/, function (m) {
      return 'Peak: ' + en(m[1]) + ' (' + m[2] + ' contract' + (m[2] === '1' ? '' : 's') + ') — start renewal talks 90 days ahead.';
    }],
    /* جودة البيانات والإعدادات */
    [/^(\d+) ملاحظة من تفريغ الكشف الورقي — قائمة الأسئلة التي يجيب عنها المالك، وكل إجابة تُدخل النظام وتُقفل بندها\.$/, function (m) {
      return m[1] + ' notes from transcribing the paper statement — the question list the owner answers; every answer enters the system and closes its item.';
    }],
    [/^الوحدة: (.+)$/, function (m) { return 'Unit: ' + en(m[1]); }],
    [/^العقد: (.+) — (.+)$/, function (m) { return 'Contract: ' + en(m[1]) + ' — ' + en(m[2]); }],
    [/^العقد: (.+)$/, function (m) { return 'Contract: ' + en(m[1]); }],
    [/^مفتوحة \((\d+)\)$/, function (m) { return 'Open (' + m[1] + ')'; }],
    [/^— التغطية (.+) حتى (.+)\.$/, function (m) { return '— Coverage ' + en(m[1]) + ' to ' + en(m[2]) + '.'; }],
    [/^جدول (\d{4})$/, function (m) { return m[1] + ' sheet'; }],
    /* دليل الشرح — الأمثلة الحية */
    [/^الميزان 1 — مايو 2026: 19 يومًا بسعر 45,100→49,610 و12 يومًا بالسنة الثالثة = ([\d,]+) ج\.م$/, function (m) {
      return 'Mezzanine 1 — May 2026: 19 days at 45,100→49,610 and 12 days on year 3 = ' + m[1] + ' EGP';
    }],
    [/^تحصيل (.+) = ([\d,]+) ÷ ([\d,]+) = (.+)$/, function (m) {
      return 'Collection — ' + en(m[1]) + ' = ' + m[2] + ' ÷ ' + m[3] + ' = ' + en(m[4]);
    }],
    [/^([\d,]+) ج\.م \+ (\d+) أشهر مجهولة$/, function (m) { return m[1] + ' EGP + ' + m[2] + ' unknown months'; }],
    [/^([\d,]+) ج\.م \(تقوى: يناير–مارس\)$/, function (m) { return m[1] + ' EGP (Taqwa: Jan–Mar)'; }],
    [/^أقدم شريحة حاليًا: ([\d,]+) فوق 90 يومًا$/, function (m) { return 'Oldest bucket currently: ' + m[1] + ' past 90 days'; }],
    [/^(\d+) ملاحظة مفتوحة الآن$/, function (m) { return m[1] + ' notes open now'; }],
    /* توستات وسجل الحركات */
    [/^سُجِّلت (\d+) دفعة — المؤشرات تحدَّثت$/, function (m) { return m[1] + ' payments recorded — KPIs updated'; }],
    [/^دفعة ([\d,]+) ج\.م — (.+) \((.+)\)$/, function (m) { return 'Payment ' + m[1] + ' EGP — ' + en(m[2]) + ' (' + en(m[3]) + ')'; }],
    [/^سداد جماعي: (\d+) دفعة \((.+)\)$/, function (m) { return 'Bulk collection: ' + m[1] + ' payments (' + en(m[2]) + ')'; }],
    [/^حذف دفعة — (.+) \((.+)\)$/, function (m) { return 'Payment deleted — ' + en(m[1]) + ' (' + en(m[2]) + ')'; }],
    [/^عقد جديد — (.+) \/ (.+)$/, function (m) { return 'New contract — ' + en(m[1]) + ' / ' + en(m[2]); }],
    [/^وحدة جديدة — (.+)$/, function (m) { return 'New unit — ' + en(m[1]); }],
    [/^كشف\/مبنى جديد — (.+)$/, function (m) { return 'New statement/building — ' + en(m[1]); }],
    [/^شكوى — (.+) \((.+)\)$/, function (m) { return 'Complaint — ' + en(m[1]) + ' (' + en(m[2]) + ')'; }],
    [/^حسم ملاحظة: (.+)$/, function (m) { return 'Note resolved: ' + en(m[1]); }],
    [/^إعادة فتح ملاحظة: (.+)$/, function (m) { return 'Note reopened: ' + en(m[1]); }],
    [/^إغلاق شكوى$/, function () { return 'Complaint closed'; }],
  ];

  /* ترجمة الأدراج (تُبنى خارج #app ولا يترجمها render):
     نلفّ UI.openDrawer لحظة تعريف window.UI — بلا تعديل ui.js */
  (function () {
    var real;
    Object.defineProperty(window, 'UI', {
      configurable: true,
      get: function () { return real; },
      set: function (v) {
        real = v;
        try {
          if (v && typeof v.openDrawer === 'function' && !v.__i18nDrawerWrap) {
            var orig = v.openDrawer;
            v.openDrawer = function () {
              var d = orig.apply(this, arguments);
              try {
                if (window.I18N && window.I18N.lang === 'en') {
                  var ov = document.querySelector('.overlay');
                  if (ov) {
                    window.I18N.translateNode(ov);
                    var mo = new MutationObserver(function () {
                      if (document.contains(ov) && window.I18N.lang === 'en') window.I18N.translateNode(ov);
                      else mo.disconnect();
                    });
                    mo.observe(ov, { childList: true, subtree: true });
                  }
                }
              } catch (e) {}
              return d;
            };
            v.__i18nDrawerWrap = true;
          }
        } catch (e) {}
      },
    });
  })();
})();
