# إيجاري · Egary

**منظومة إدارة بيانات الإيجارات** — تحوّل كشوف الإيجار الورقية إلى محفظة رقمية حيّة: تحصيل، متأخرات بأعمارها، عقود وتجديدات، شكاوى، وجودة بيانات — بلا أي تبعيات خارجية.

**Rental Data Management Suite** — turns paper rent statements into a live digital portfolio: collections, aged arrears, contracts & renewals, complaints, and a data-quality workflow. Zero dependencies, runs from a static host or by opening the file directly.

## التشغيل / Run

افتح [`app/index.html`](app/index.html) مباشرة في المتصفح — لا خادم ولا إنترنت.
Open [`app/index.html`](app/index.html) directly in a browser — no server needed.

- عربي RTL افتراضيًا + نسخة إنجليزية كاملة (زر `EN`) · وضع ليلي (زر 🌙)
- Arabic RTL by default + full English version (`EN` button) · dark mode (🌙)
- للعروض: `?lang=en` · `?theme=dark`

## الدليل الكامل / Full guide

**[docs/index.html](docs/index.html)** — دليل استخدام مصوَّر يشرح كل شاشة وكل كارد: ما هو، مصدره، طريقة حسابه، واستخدامه. مكتوب كوثيقة تسليم.

Screenshot-based handover documentation covering every screen and card: what it is, where it comes from, how it's computed, and how to use it.

## البنية / Structure

```
app/
├── index.html
├── css/app.css        نظام التصميم (فاتح/داكن، RTL/LTR)
└── js/
    ├── seed.js        بذرة الكشف الفعلي + كشفان توضيحيان + سجل الجودة
    ├── store.js       محرك الاستحقاق وحسابات BI + الحفظ المحلي
    ├── i18n.js        النسخة الإنجليزية الكاملة
    ├── ui.js          مكوّنات الواجهة + البحث العربي المطبَّع
    ├── charts.js      رسوم SVG يدوية (ثيم-أوير)
    ├── views.js       الشاشات
    └── app.js         التوجيه والهيكل
docs/                  دليل الاستخدام المصوَّر
```

## المبادئ الحاكمة / Principles

1. **الحالة محسوبة لا مكتوبة** — "متأخر" نتيجة مقارنة، ليست خانة تُملأ.
2. **متأخر مؤكَّد ≠ غير موثَّق** — الورق لا يفرّق بينهما؛ المنظومة تفرّق.
3. **قيمة الإيجار مربوطة بسنة العقد** — الشهر المقطوع يُحسب باليوم.
4. **التجديد عقد جديد** مربوط بسابقه — التاريخ لا يُمحى.
5. **كل افتراض مُعلَن** وكل غموض في المصدر بند جودة بسؤال محدد وقرار حسم مسجَّل.
