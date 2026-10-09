# عدة Power BI لإيجاري

هذه العدة تربط **Power BI Desktop** مباشرة بملف `Egary.xlsx` (نفس الملف الذي يقرأه البرنامج ويكتب فيه)، فتحصل على تقرير Power BI حقيقي يتحدث مع كل حفظ.

> ملاحظة: اللوحة التفاعلية داخل البرنامج (زر «لوحة BI التفاعلية») تعمل بلا Power BI. هذه العدة لمن يريد نسخة Power BI Desktop أيضًا.

## الملفات
| الملف | الوظيفة |
|---|---|
| `EgaryQueries.pq` | استعلامات Power Query (M): تحميل كل أوراق الإكسيل بأنواع الأعمدة الصحيحة + جدول التقويم + جدول **الاستحقاق الشهري** (كل عقد × كل شهر مع الإيجار المحسوب بالزيادة السنوية) |
| `EgaryMeasures.dax` | مقاييس DAX جاهزة (المحصَّل، المستحق، المتأخرات، نسبة التحصيل، الإشغال، الشواغر الطويلة، العقود المنتهية قريبًا، التأمينات…) |
| `EgaryTheme.json` | ثيم ألوان مطابق للبرنامج (مريح للعين) |

## الخطوات (10 دقائق)
1. افتح Power BI Desktop → **Get Data → Blank Query** → **Advanced Editor** والصق محتوى `EgaryQueries.pq` كاملًا. عدّل سطر `FilePath` في أوله إلى مسار ملف `Egary.xlsx` عندك.
2. من **Queries** اضغط بزر الماوس الأيمن على كل استعلام (`Projects`, `Units`, `Clients`, `Contracts`, `Payments`, `Maintenance`, `UnitAssets`, `DueMonths`, `Calendar`) وتأكد أن **Enable load** مفعّل، ثم **Close & Apply**.
3. **Model view**: أنشئ العلاقات (اتجاه واحد، واحد-إلى-متعدد):
   - `Projects[ProjectCode]` → `Units[ProjectCode]`
   - `Units[UnitCode]` → `Contracts[UnitCode]`، `Units[UnitCode]` → `Maintenance[UnitCode]`، `Units[UnitCode]` → `UnitAssets[UnitCode]`
   - `Clients[ClientCode]` → `Contracts[ClientCode]`
   - `Contracts[ContractCode]` → `Payments[ContractCode]`، `Contracts[ContractCode]` → `DueMonths[ContractCode]`
   - `Calendar[Date]` → `Payments[PaidOn]` (غير نشطة اختياريًا) و`Calendar[MonthKey]` → `DueMonths[MonthKey]` و`Calendar[MonthKey]` → `Payments[MonthKey]`
4. **Modeling → New measure**: الصق المقاييس من `EgaryMeasures.dax` واحدًا واحدًا (كل مقياس يبدأ باسمه ثم `=`).
5. **View → Themes → Browse for themes** واختر `EgaryTheme.json`.
6. ابنِ الصفحات (مقترح): نظرة عامة (بطاقات KPI + عمود/خط التحصيل مقابل المستحق) · المتأخرات (جدول DueMonths مُرشَّح على `IsLate = TRUE` — هذا هو «الدليل») · الإشغال (مصفوفة الوحدات بالحالة) · العقود (جدول العقود مع `DaysLeft`) · المشاريع · العملاء · الصيانة. ضع **Slicers** على: `Projects[ProjectName]`, `Units[UnitType]`, `Calendar[Year]`, `Units[Status]`.
7. **التفاعل**: اضغط على أي بطاقة/شريحة فتُرشِّح الجداول تلقائيًا (Cross-filtering) — وهذا يعطي «الدليل» خلف كل رقم كما في البرنامج.

## قاعدة الذهب
لا تعدّل البيانات في Power BI؛ عدّلها في البرنامج أو في `Egary.xlsx`، ثم **Refresh**.
