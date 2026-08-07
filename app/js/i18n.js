/* =========================================================
   i18n.js — النسخة الإنجليزية الكاملة
   العربية هي المصدر؛ عند lang=en تُترجم الشجرة بعد كل رندر:
   1) مطابقة تامة من القاموس  2) أنماط جُمل بمتغيرات  3) رموز آمنة
   أي نص جديد غير مُدرج يظهر بالعربية (لا كسر أبدًا).
   ========================================================= */
(function () {
  'use strict';
  const LS = 'egary-lang';

  const MONTHS = {
    'يناير': 'Jan', 'فبراير': 'Feb', 'مارس': 'Mar', 'أبريل': 'Apr',
    'مايو': 'May', 'يونيو': 'Jun', 'يوليو': 'Jul', 'أغسطس': 'Aug',
    'سبتمبر': 'Sep', 'أكتوبر': 'Oct', 'نوفمبر': 'Nov', 'ديسمبر': 'Dec',
  };

  /* ---------- القاموس: مطابقة تامة ---------- */
  const D = {
    // الهوية والتنقل
    'تحصيل': 'Tahseel', 'ذكاء محفظة الإيجارات': 'Rental Portfolio Intelligence',
    'إيجاري': 'Egary', 'منظومة إدارة بيانات الإيجارات': 'Rental Data Management Suite',
    'لوحة المؤشرات': 'Dashboard', 'التحليلات': 'Insights', 'جدول التحصيل': 'Collection Sheet',
    'إضافة مشروع جديد': 'Add New Project', 'الوحدات': 'Units', 'العقود': 'Contracts',
    'المستأجرون': 'Tenants', 'الشكاوى': 'Complaints', 'مراجعات مطلوبة': 'Reviews Needed',
    'الإعدادات': 'Settings', 'إدخال': 'Add', 'دليل الشرح': 'User Guide',
    'دليل الاستخدام الكامل': 'Full documentation',
    'نسخة عرض · كشف سكرية الفعلي + كشفان توضيحيان':
      'Demo build · Sokareya (real) + 2 sample statements',
    // السلايسرز
    'ابحث عن وحدة أو مستأجر…': 'Search unit, tenant, phone, receipt…',
    'كل المشاريع': 'All projects', 'كل الأنواع': 'All types', 'كل المستأجرين': 'All tenants',
    'كل الحالات': 'All states', 'مسح': 'Clear', 'مؤجَّرة': 'Occupied',
    'تنتهي خلال 90 يوم': 'Ending within 90 days', 'عقد منتهٍ بلا تجديد': 'Ended, no renewal',
    'بلا عقد مسجّل': 'No contract on file', 'شاغرة': 'Vacant', 'عليها متأخرات': 'Has arrears',
    '· توضيحي': '· sample',
    // عام
    'مشروع فعلي': 'Real project', 'تجريبي': 'Sample', 'المبنى': 'Building',
    'الوحدة': 'Unit', 'المستأجر': 'Tenant', 'الشهر': 'Month', 'الحالة': 'State',
    'النوع': 'Type', 'ملاحظات': 'Notes', 'ملاحظة': 'Note', 'المنطقة': 'District',
    'محل': 'Shop', 'مكتب': 'Office', 'شقة': 'Apartment', 'جراج': 'Garage',
    'مخزن': 'Warehouse', 'غير محدد': 'Unspecified', 'فرد': 'Individual', 'شركة': 'Company',
    'حفظ': 'Save', 'إلغاء': 'Cancel', 'إغلاق': 'Close', 'اليوم': 'Today',
    'تصدير CSV': 'Export CSV', 'عرض كجدول': 'View as table', 'عرض كرسم': 'View as chart',
    'لا شيء': 'None', 'الإجمالي': 'Total', 'شهر التقرير': 'Report month',
    'آخر شهر مكتمل': 'Last full month', 'السنة': 'Year', 'المالك': 'Owner',
    'سنة العقد': 'Contract year', 'من': 'From', 'إلى': 'To', 'القيمة': 'Amount',
    'تجديد': 'Renewal', 'نشط': 'Active', 'مستقبلي': 'Future', 'منتهٍ — مُجدَّد': 'Ended — renewed',
    'منتهٍ — مُجدَّد (باهت)': 'Ended — renewed (faded)',
    'ساري': 'Active', 'ينتهي خلال 90 يوم': 'Ending in 90 days', 'ينتهي قريبًا': 'Ending soon',
    'حرج': 'Critical', 'مهم': 'Important', 'تنبيه': 'Notice',
    // لوحة المؤشرات
    'المتأخرات': 'Arrears', 'سداد يحتاج تأكيد': 'Payments needing confirmation',
    'الإشغال': 'Occupancy', 'تجديدات خلال 90 يوم': 'Renewals within 90 days',
    'تأمينات محتجزة': 'Deposits held', 'جزء تقديري': 'Includes estimates',
    'بند مجهول القيمة': 'Unknown-value item', 'لا استحقاقات محسوبة لهذا الشهر': 'No dues computed for this month',
    'لا شيء معلَّق': 'Nothing pending',
    'التحصيل الشهري — المحصَّل من المستحق': 'Monthly collection — collected vs due',
    'أعمار المتأخرات': 'Arrears aging',
    'الإيراد المتعاقد عليه — 12 شهرًا قادمة': 'Contracted revenue — next 12 months',
    'يتضمن قيمًا تقديرية': 'Includes estimated values',
    'يحتاج انتباهك': 'Needs your attention', 'آخر الحركات': 'Recent activity',
    'لا تنبيهات': 'No alerts', 'كل شيء تحت السيطرة': 'All under control', 'لا حركات بعد': 'No activity yet',
    'ج.م': 'EGP', 'المستحق': 'Due', 'المحصَّل': 'Collected', 'النسبة': 'Rate', 'غير موثَّق': 'Undocumented',
    'محصَّل': 'Collected', 'متعثر': 'Delinquent', 'بلا عقد نشط': 'No active contract',
    'مستحق الشهر': 'Month due', 'جزئي/متأخر السداد': 'Partial / paid late',
    'متأخر': 'Late', 'بلا استحقاق/شاغرة': 'No dues / vacant',
    'الكل سدَّد هذا الشهر ✓': 'Everyone paid this month ✓',
    'في السماح': 'In grace', 'متأخر — قيمة مجهولة': 'Late — unknown amount',
    // المصفوفة
    'نفس جدول الورقة — وضعان: تسجيل دفعات موثَّقة، أو تفريغ سريع لعلامات ورقة.':
      'Same grid as the paper — two modes: record documented payments, or fast-transcribe paper marks.',
    'وضع العمل': 'Mode', 'تسجيل دفعات — اضغط الخلية تفتح دفعة كاملة': 'Record payments — click a cell to log a full payment',
    'نقل ورقة قديمة — الضغطة تقلّب ✓ ← ✗ ← فاضي': 'Transfer old paper — click cycles ✓ → ✗ → blank',
    'سداد جماعي لشهر كامل': 'Bulk collect a whole month',
    'الوحدة / المستأجر': 'Unit / Tenant', 'متأخرات': 'Arrears',
    'الإجمالي (محصَّل / مستحق)': 'Total (collected / due)',
    'مدفوع (موثَّق)': 'Paid (documented)', 'مدفوع متأخرًا عن ميعاده': 'Paid late',
    'مدفوع (من الورقة) — من غير مبلغ/تاريخ': 'Paid (per old paper) — no amount/date',
    'سداد جزئي': 'Partial payment', 'مستحق الآن (في السماح)': 'Due now (in grace)',
    'يحتاج تأكيد — اتدفع ولا اتأخر؟': 'Needs confirmation — paid or late?',
    'لم يستحق بعد': 'Not yet due', 'قبل تغطية الكشف': 'Before statement range',
    'سداد بلا عقد مسجّل': 'Paid, no contract on file', 'خارج مدة العقد': 'Outside contract term',
    'قيمة تقديرية (+10٪) غير مدوَّنة': 'Estimated value (+10%), not on paper',
    'وضع نقل الورقة شغّال: ': 'Paper-transfer mode is ON: ',
    'كل ضغطة على خلية تقلّبها ✓ ← ✗ ← فاضي. الخانة اللي الورقة ساكتة عنها سيبها فاضية. ارجع لوضع «تسجيل دفعات» للدفعات الموثَّقة.':
      'Each click cycles the cell ✓ → ✗ → blank. Leave blank whatever the paper is silent about. Switch back to “Record payments” for documented entries.',
    'تسجيل دفعة': 'Record payment', 'توثيق دفعة الكشف (مبلغ وتاريخ فعليان)': 'Document the paper payment (real amount & date)',
    'المبلغ (ج.م)': 'Amount (EGP)', 'تاريخ السداد': 'Payment date', 'طريقة السداد': 'Payment method',
    'رقم الإيصال': 'Receipt no.', 'نقدًا': 'Cash', 'إنستاباي': 'InstaPay', 'تحويل بنكي': 'Bank transfer', 'شيك': 'Cheque',
    'حفظ الدفعة': 'Save payment', 'اختياري': 'Optional',
    'الدفعات المسجَّلة': 'Recorded payments', 'المبلغ': 'Amount', 'التاريخ': 'Date', 'الطريقة': 'Method', 'إيصال': 'Receipt',
    'يوم الاستحقاق': 'Due day', 'العقد': 'Contract',
    'علامة الكشف الورقي: ✓ سداد — بلا مبلغ ولا تاريخ.': 'Paper mark: ✓ paid — no amount, no date.',
    'علامة الكشف الورقي: ✗ عدم سداد — بلا مبلغ ولا تاريخ.': 'Paper mark: ✗ unpaid — no amount, no date.',
    // البطاقات والكشوف
    'حذف البيانات التوضيحية': 'Delete sample data', 'وحدة جديدة': 'New unit', 'عقد جديد': 'New contract',
    'مستأجر جديد': 'New tenant', 'شكوى جديدة': 'New complaint', 'كشف جديد (ورقة كاملة)': 'New statement (full paper)',
    'كشف/مبنى جديد': 'New statement/building', 'الهاتف': 'Phone', 'غير مسجّل': 'Not recorded',
    'الإيجار الحالي': 'Current rent', 'متأخرات مجهولة': 'Unknown arrears',
    'سلسلة العقود': 'Contract chain', 'من الكشف': 'From paper', 'لا عقود مسجَّلة': 'No contracts on file',
    'سجّل العقد ليبدأ حساب الاستحقاق': 'Add the contract to start computing dues',
    'ملاحظات الجودة': 'Quality notes', 'عقد جديد لهذه الوحدة': 'New contract for this unit',
    'الدور': 'Floor', 'المساحة': 'Area (m²)',
    // العقود
    'التجديد عقد جديد مربوط بسابقه — لا تعديل على القديم، فيبقى التاريخ كاملًا.':
      'A renewal is a new contract linked to its predecessor — history is never edited away.',
    'الخط الزمني للعقود': 'Contracts timeline',
    'قيمة السنة الجارية': 'Current-year rent', 'صيانة': 'Maintenance', 'التأمين': 'Deposit',
    'تاريخ البداية': 'Start date', 'عدد السنوات': 'Years', 'قيمة السنة الأولى': 'Year-1 rent',
    'نسبة الزيادة السنوية ٪': 'Annual increase %', 'يوم الاستحقاق في الشهر': 'Due day of month',
    'الصيانة الشهرية (ج.م)': 'Monthly maintenance (EGP)', 'خاضع لضريبة القيمة المضافة (تُضاف للاستحقاق)': 'VAT applicable (added to dues)',
    'التأمين (ج.م)': 'Deposit (EGP)', 'جدول السنوات المتولَّد': 'Generated year schedule',
    'حفظ العقد': 'Save contract', 'مرتَّب بالأولوية: المنتهي بلا تجديد أولًا ثم الأقرب انتهاءً — القيمة داخل الشريط إيجار شهري':
      'Sorted by priority: ended-without-renewal first, then soonest ending — value inside bar is monthly rent',
    'انتهى بلا تجديد': 'Ended, no renewal',
    // التحليلات
    'قراءات جاهزة من البيانات — كل بطاقة تنقلك لمكان اتخاذ الإجراء.': 'Ready-made readings — every card links to where you act.',
    'اتجاه نسبة التحصيل — 12 شهرًا': 'Collection rate trend — 12 months',
    'أعلى المتأخرين': 'Top debtors', 'حالة الوحدات': 'Unit states',
    'متوسط الإيجار الشهري حسب النوع': 'Average monthly rent by type',
    'التزام السداد بالمستأجر': 'Payment punctuality by tenant',
    'توزيع المحصَّل حسب طريقة السداد': 'Collected amount by payment method',
    'دفعات موثَّقة': 'Documented payments', 'في الميعاد': 'On time', 'التقييم': 'Rating',
    'ملتزم': 'Punctual', 'متذبذب': 'Inconsistent', 'الكشوف': 'Statements', 'عقود نشطة': 'Active contracts',
    'وحدة': 'units', 'لا متأخرات مؤكَّدة ضمن الترشيح': 'No confirmed arrears in this filter',
    'لا عقود نشطة': 'No active contracts', 'لا دفعات موثَّقة بعد': 'No documented payments yet',
    'لا بيانات': 'No data',
    // جودة البيانات
    'الخطورة': 'Severity', 'حرجة': 'Critical', 'عالية': 'High', 'متوسطة': 'Medium', 'منخفضة': 'Low',
    'الكل': 'All', 'محسومة': 'Resolved', 'مفتوحة': 'Open', 'عام': 'General',
    'سجّل رد المالك': 'Record owner’s answer', 'إعادة فتح': 'Reopen', 'المطلوب: ': 'Action needed: ',
    'رد المالك: ': 'Owner’s answer: ',
    // الإعدادات
    'كل افتراض في النظام مُعلَن هنا وقابل للتغيير — ويُعاد الحساب فورًا.':
      'Every assumption is declared here and switchable — figures recompute instantly.',
    'أساس قيم الإيجار': 'Rent value basis', 'قواعد الحساب': 'Calculation rules',
    'تصدير التقارير (CSV يفتح في Excel)': 'Export reports (CSV opens in Excel)',
    'البيانات': 'Data', 'المتأخرات': 'Arrears', 'الدفعات المسجَّلة': 'Recorded payments',
    'إعادة التعيين إلى بيانات الكشف الأصلية': 'Reset to original statement data',
    'المباني / الكشوف': 'Buildings / Statements',
    // الإدخال
    'ثلاث خطوات تحوّل أي ورقة تصلك إلى كشف حي بمؤشراته — من غير Excel في النص.':
      'Three steps turn any incoming paper into a live statement with its own KPIs — no Excel in between.',
    'الخطوة 1 — بيانات المشروع (الورقة)': 'Step 1 — Project (paper) details',
    'إنشاء المشروع': 'Create project', 'أضف الصف': 'Add row', 'الصفوف المُدخلة': 'Entered rows',
    'مين لم يسدِّد': 'Who has not paid',
    'كل ورقة تصلك = كشف مستقل باسم مالكها. اكتب اسم المالك كما هو على الورقة.':
      'Every incoming paper = an independent statement named after its owner. Type the owner name exactly as written.',
    'الخطوة 3 — علامات الشهور ✓/✗': 'Step 3 — Month marks ✓/✗',
    'مثال: عبدالمنعم سكرية': 'e.g. Abdelmoneim Sokareya', 'مثال: الدقي — الجيزة': 'e.g. Dokki — Giza',
    'اسم المستأجر': 'Tenant name', 'الوحدة (كما في الورقة)': 'Unit (as on paper)',
    'بداية العقد': 'Contract start', 'الزيادة ٪': 'Increase %',
    'التأمين — اختياري': 'Deposit — optional',
    // شروحات الصفحات
    'كل رقم هنا محسوب لحظيًا من العقود والدفعات — لا شيء يُكتب يدويًا.':
      'Every figure is computed live from contracts & payments — nothing typed by hand.',
    'نفس جدول الورقة — كل خلية تفتح دفعة كاملة: مبلغ وتاريخ وطريقة وإيصال.':
      'The paper grid, alive — each cell opens a full payment: amount, date, method, receipt.',
    'الحالة محسوبة من العقود، لا تُكتب يدويًا.': 'State is computed from contracts, never typed.',
    'أرصدة المتأخرات محسوبة من المصفوفة مباشرة.': 'Arrears balances come straight from the matrix.',
    'سجل الكشف الفعلي يبدأ من اليوم — بالتصنيف والتكلفة ومن يتحمّلها.':
      'The real log starts today — category, cost, and who bears it.',
    'شكاوى مفتوحة': 'Open complaints', 'متوسط زمن الإغلاق': 'Avg. time to close',
    'تكلفة على المالك (المغلقة)': 'Owner cost (closed)',
    'شكاوى خلال 30 يومًا من التسليم': 'Complaints within 30 days of handover',
    'التصنيف': 'Category', 'الوصف': 'Description', 'التكلفة': 'Cost', 'يتحمّلها': 'Borne by',
    'مغلقة': 'Closed', 'سباكة': 'Plumbing', 'كهرباء': 'Electrical', 'تشطيبات': 'Finishing',
    'تسريب': 'Leakage', 'تكييف': 'HVAC', 'مصاعد ومرافق': 'Elevators & utilities', 'أخرى': 'Other',
    'المقاول': 'Contractor', 'مشترك': 'Shared', 'تاريخ الفتح': 'Opened on', 'التكلفة المتوقعة': 'Expected cost',
    'شهرية': 'Monthly', 'سنوية': 'Annual',
  };

  /* ---------- أنماط جُمل بمتغيرات (مُرتَّبة: الأخص أولًا) ---------- */
  const P = [
    [/^تحصيل (.+)$/, m => 'Collection — ' + tt(m[1])],
    [/^مين لم يسدِّد (.+)؟$/, m => 'Who has not paid — ' + tt(m[1]) + '?'],
    [/^محفظة من (\d+) مبانٍ و(\d+) وحدة — كل رقم محسوب لحظيًا من العقود والدفعات\.$/,
      m => `A portfolio of ${m[1]} buildings and ${m[2]} units — every figure computed live from contracts & payments.`],
    [/^حالة المباني — (.+)$/, m => 'Buildings status — ' + tt(m[1])],
    [/^توزيع استحقاق (.+) حسب النوع$/, m => tt(m[1]) + ' dues by unit type'],
    [/^(\d+) وحدة$/, m => m[1] + ' units'],
    [/^(\d+) من (\d+)$/, m => `${m[1]} of ${m[2]}`],
    [/^عقد منتهٍ بلا تجديد (\d+) · بلا عقد\/شاغرة (\d+)$/, m => `Ended without renewal: ${m[1]} · No contract / vacant: ${m[2]}`],
    [/^منها (\d+) انتهت فعلًا بلا تجديد$/, m => `${m[1]} already ended without renewal`],
    [/^مسجَّلة لعقد (\d+) من (\d+)$/, m => `Recorded on ${m[1]} of ${m[2]} contracts`],
    [/^(\d[\d,]*) شهر×وحدة/, m => m[0].replace(/^(\d[\d,]*) شهر×وحدة/, '$1 unit-months')],
    [/^ساري (\d+)$/, m => 'Active ' + m[1]],
    [/^ينتهي خلال 90 يوم (\d+)$/, m => 'Ending in 90 days: ' + m[1]],
    [/^منتهٍ بلا تجديد (\d+)$/, m => 'Ended, no renewal: ' + m[1]],
    [/^ينتهي خلال (.+)$/, m => 'Ends in ' + tt(m[1])],
    [/^انتهى منذ (.+)$/, m => 'Ended ' + tt(m[1]) + ' ago'],
    [/^باقي (\d+) يوم$/, m => m[1] + 'd left'],
    [/^سنة (\d+)$/, m => 'Year ' + m[1]],
    [/^(\d+) سنة$/, m => m[1] === '1' ? '1 year' : m[1] + ' years'],
    [/^(\d+) سنوات$/, m => m[1] + ' years'],
    [/^يوم واحد$/, () => '1 day'], [/^يومين$/, () => '2 days'],
    [/^(\d+) أيام$/, m => m[1] + ' days'], [/^(\d+) يومًا$/, m => m[1] + ' days'],
    [/^شهر واحد$/, () => '1 month'], [/^شهرين$/, () => '2 months'],
    [/^(\d+) أشهر$/, m => m[1] + ' months'], [/^(\d+) شهرًا$/, m => m[1] + ' months'],
    [/^1–30 يوم$/, () => '1–30 days'], [/^31–60 يوم$/, () => '31–60 days'],
    [/^61–90 يوم$/, () => '61–90 days'], [/^أكثر من 90$/, () => '90+ days'],
    [/^اليوم: (.+)$/, m => 'Today: ' + tt(m[1])],
    [/^(\d+) (يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر) (\d{4})$/,
      m => `${MONTHS[m[2]]} ${m[1]}, ${m[3]}`],
    [/^(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر) (\d{4})$/,
      m => MONTHS[m[1]] + ' ' + m[2]],
    [/^(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)$/, m => MONTHS[m[1]]],
    [/^([\d.,]+) ألف$/, m => m[1] + 'K'],
    [/^([\d.,]+) م$/, m => m[1] + 'M'],
    [/^([\d,]+) ج\.م$/, m => m[1] + ' EGP'],
    [/^≈([\d,]+) ج\.م$/, m => '≈' + m[1] + ' EGP'],
    [/^([\d,]+) من ([\d,]+) ج\.م$/, m => `${m[1]} of ${m[2]} EGP`],
    [/^المتبقي: ([\d,]+) ج\.م$/, m => 'Remaining: ' + m[1] + ' EGP'],
    [/^منها متأخر السداد ([\d,]+)$/, m => 'incl. paid-late ' + m[1]],
    [/^غير موثَّق (.+)$/, m => 'undocumented: ' + tt(m[1])],
    [/^تأمين محتجز: ([\d,]+) ج\.م(.*)$/, m => 'Deposit held: ' + m[1] + ' EGP' + tt(m[2])],
    [/^(\d+) نقطة$/, m => m[1] + ' pts'],
    [/^(\d+) ملاحظة جودة مفتوحة$/, m => m[1] + ' open quality notes'],
    [/^و(\d+.*) بقيمة مجهولة$/, m => '+ ' + tt(m[1]) + ' of unknown amount'],
    [/^(\d+) شهر×وحدة بلا علامة — سداد أم متأخر؟$/, m => `${m[1]} unit-months unmarked — paid or late?`],
    [/ — (.+)$/, null], // حارس: لا يُستخدم، انظر tt المركّبة أدناه
  ].filter(x => x[1]);

  /* رموز آمنة تُستبدل داخل أي نص متبقٍ */
  const TOKENS = [
    [/ج\.م/g, 'EGP'],
    [/(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر) (\d{4})/g,
      (mm, mo, yr) => MONTHS[mo] + ' ' + yr],
  ];

  /* دمج محتوى الترجمة الموسّع (i18n-content.js): قاموس + أنماط + رموز أسماء */
  if (window.I18N_EXTRA) Object.assign(D, window.I18N_EXTRA);
  if (Array.isArray(window.I18N_PATTERNS))
    for (const [re, fn] of window.I18N_PATTERNS) P.unshift([re, fn]);
  if (Array.isArray(window.I18N_TOKENS))
    for (const t of window.I18N_TOKENS) TOKENS.push(t);

  function tt(str) {
    if (lang === 'ar') return str;
    const t0 = str.trim();
    if (!t0 || /^[\d\s.,:%+()\/·—–-]+$/.test(t0)) return str; // أرقام وعلامات فقط
    if (D[t0] != null) return str.replace(t0, D[t0]);
    for (const [re, fn] of P) {
      const m = t0.match(re);
      if (m) return str.replace(t0, fn(m));
    }
    // جملة مركّبة بفواصل «·» — ترجم كل جزء
    if (t0.includes(' · ')) return str.replace(t0, t0.split(' · ').map(p => tt(p)).join(' · '));
    let out = str;
    for (const [re, rep] of TOKENS) out = out.replace(re, rep);
    return out;
  }

  function translateNode(root) {
    if (lang === 'ar' || !root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const v = n.nodeValue;
      if (v && v.trim()) n.nodeValue = tt(v);
    }
    for (const el of root.querySelectorAll('[placeholder], [aria-label], [title]')) {
      for (const a of ['placeholder', 'aria-label', 'title']) {
        const v = el.getAttribute(a);
        if (v) el.setAttribute(a, tt(v));
      }
    }
  }

  let lang = localStorage.getItem(LS) === 'en' ? 'en' : 'ar';

  function apply() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = lang === 'ar' ? 'تحصيل — ذكاء محفظة الإيجارات' : 'Tahseel — Rental Portfolio Intelligence';
  }
  function setLang(l) {
    lang = l === 'en' ? 'en' : 'ar';
    try { localStorage.setItem(LS, lang); } catch (e) {}
    apply();
  }

  window.I18N = {
    get lang() { return lang; },
    setLang, apply, tt, translateNode,
    /* لإضافة ترجمات من ملفات لاحقة التحميل (dashboard.js وغيره) */
    extend(dict) { Object.assign(D, dict); },
    addPatterns(list) { for (const p of list) P.unshift(p); },
    addTokens(list) { for (const t of list) TOKENS.push(t); },
  };
  apply();

  /* نوافذ التأكيد النظامية تتترجم هي كمان */
  const _confirm = window.confirm.bind(window);
  const _prompt = window.prompt.bind(window);
  window.confirm = msg => _confirm(tt(String(msg)));
  window.prompt = (msg, def) => _prompt(tt(String(msg)), def);
})();
