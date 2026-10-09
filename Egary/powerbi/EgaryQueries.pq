// ======================================================================
//  Egary — Power Query (M)
//  الصق هذا كله في Advanced Editor لاستعلام فارغ، ثم عدّل FilePath.
//  ينتج الاستعلامات: Projects, Units, Clients, Contracts, Payments, Maintenance,
//  UnitAssets, Calendar, DueMonths (كل عقد × كل شهر مع الإيجار المحسوب)
// ======================================================================
let
    FilePath = "C:\Egary\Egary.xlsx",
    Source = Excel.Workbook(File.Contents(FilePath), null, true),
    Sheet = (name as text) => Table.PromoteHeaders(Source{[Item = name, Kind = "Sheet"]}[Data], [PromoteAllScalars = true]),

    // ---------- المشاريع ----------
    Projects0 = Sheet("المشاريع"),
    Projects = Table.TransformColumnTypes(Table.RenameColumns(Table.SelectColumns(Projects0, {"كود المشروع", "اسم المشروع", "العنوان", "المنطقة"}), {{"كود المشروع", "ProjectCode"}, {"اسم المشروع", "ProjectName"}, {"العنوان", "Address"}, {"المنطقة", "Area"}}), {{"ProjectCode", type text}, {"ProjectName", type text}}),

    // ---------- الوحدات ----------
    Units0 = Sheet("الوحدات"),
    Units1 = Table.RenameColumns(Table.SelectColumns(Units0, {"كود الوحدة", "كود المشروع", "رقم / اسم الوحدة", "النوع", "الدور", "المساحة م²", "الحالة (محسوب)", "المستأجر الحالي (محسوب)", "الإيجار الحالي (محسوب)", "أيام الشغور (محسوب)"}), {{"كود الوحدة", "UnitCode"}, {"كود المشروع", "ProjectCode"}, {"رقم / اسم الوحدة", "UnitLabel"}, {"النوع", "UnitType"}, {"الدور", "Floor"}, {"المساحة م²", "AreaM2"}, {"الحالة (محسوب)", "Status"}, {"المستأجر الحالي (محسوب)", "CurrentTenant"}, {"الإيجار الحالي (محسوب)", "CurrentRent"}, {"أيام الشغور (محسوب)", "VacantDays"}}),
    Units = Table.TransformColumnTypes(Units1, {{"UnitCode", type text}, {"ProjectCode", type text}, {"UnitType", type text}, {"CurrentRent", type number}, {"VacantDays", Int64.Type}}),

    // ---------- العملاء ----------
    Clients0 = Sheet("العملاء"),
    Clients = Table.TransformColumnTypes(Table.RenameColumns(Table.SelectColumns(Clients0, {"كود العميل", "الاسم", "النوع", "الممثل القانوني", "الرقم القومي / الباسبور", "تسجيل ضريبي", "التليفون"}), {{"كود العميل", "ClientCode"}, {"الاسم", "ClientName"}, {"النوع", "ClientKind"}, {"الممثل القانوني", "LegalRep"}, {"الرقم القومي / الباسبور", "NationalId"}, {"تسجيل ضريبي", "TaxId"}, {"التليفون", "Phone"}}), {{"ClientCode", type text}, {"NationalId", type text}, {"TaxId", type text}, {"Phone", type text}}),

    // ---------- العقود ----------
    Contracts0 = Sheet("العقود"),
    Contracts1 = Table.RenameColumns(Table.SelectColumns(Contracts0, {"كود العقد", "كود الوحدة", "كود العميل", "بداية العقد", "نهاية العقد", "الإيجار الشهري (السنة الأولى)", "الزيادة السنوية %", "إيجار كل سنة (يدوي)", "التأمين", "حالة التأمين", "يوم الاستحقاق", "العقد السابق", "الحالة (محسوب)", "الإيجار الحالي (محسوب)"}), {{"كود العقد", "ContractCode"}, {"كود الوحدة", "UnitCode"}, {"كود العميل", "ClientCode"}, {"بداية العقد", "StartDate"}, {"نهاية العقد", "EndDate"}, {"الإيجار الشهري (السنة الأولى)", "Rent"}, {"الزيادة السنوية %", "IncreasePct"}, {"إيجار كل سنة (يدوي)", "RentOverrides"}, {"التأمين", "Deposit"}, {"حالة التأمين", "DepositStatus"}, {"يوم الاستحقاق", "DueDay"}, {"العقد السابق", "PrevContract"}, {"الحالة (محسوب)", "Status"}, {"الإيجار الحالي (محسوب)", "CurrentRent"}}),
    Contracts2 = Table.TransformColumnTypes(Contracts1, {{"ContractCode", type text}, {"StartDate", type date}, {"EndDate", type date}, {"Rent", type number}, {"IncreasePct", type number}, {"Deposit", type number}, {"DueDay", Int64.Type}}),
    Contracts = Table.AddColumn(Contracts2, "DaysLeft", each Duration.Days([EndDate] - Date.From(DateTime.LocalNow())), Int64.Type),

    // ---------- المدفوعات ----------
    Payments0 = Sheet("المدفوعات"),
    Payments1 = Table.RenameColumns(Table.SelectColumns(Payments0, {"رقم الفاتورة", "كود العقد", "الشهر", "المبلغ", "تاريخ السداد", "طريقة السداد", "المصدر"}), {{"رقم الفاتورة", "InvoiceNo"}, {"كود العقد", "ContractCode"}, {"الشهر", "MonthKey"}, {"المبلغ", "Amount"}, {"تاريخ السداد", "PaidOn"}, {"طريقة السداد", "Method"}, {"المصدر", "Source"}}),
    Payments = Table.TransformColumnTypes(Payments1, {{"InvoiceNo", type text}, {"ContractCode", type text}, {"MonthKey", type text}, {"Amount", type number}, {"PaidOn", type date}}),

    // ---------- الصيانة ----------
    Maintenance0 = Sheet("الصيانة"),
    Maintenance = Table.TransformColumnTypes(Table.RenameColumns(Table.SelectColumns(Maintenance0, {"كود الصيانة", "كود الوحدة", "التاريخ", "النوع", "الوصف", "التكلفة", "يتحملها", "الحالة", "المستأجر وقتها (محسوب)"}), {{"كود الصيانة", "MaintCode"}, {"كود الوحدة", "UnitCode"}, {"التاريخ", "Date"}, {"النوع", "Kind"}, {"الوصف", "Description"}, {"التكلفة", "Cost"}, {"يتحملها", "BorneBy"}, {"الحالة", "Status"}, {"المستأجر وقتها (محسوب)", "Custodian"}}), {{"Date", type date}, {"Cost", type number}}),

    // ---------- أصول الوحدات ----------
    UnitAssets0 = Sheet("أصول الوحدات"),
    UnitAssets = Table.RenameColumns(UnitAssets0, {{"كود الوحدة", "UnitCode"}, {"الأصل", "Asset"}, {"موجود", "Present"}, {"التفاصيل", "Details"}}),

    // ---------- التقويم ----------
    MinDate = List.Min(Contracts[StartDate]), MaxDate = Date.AddYears(List.Max(Contracts[EndDate]), 1),
    Calendar0 = Table.FromList(List.Dates(Date.StartOfMonth(MinDate), Duration.Days(MaxDate - Date.StartOfMonth(MinDate)) + 1, #duration(1, 0, 0, 0)), Splitter.SplitByNothing(), {"Date"}),
    Calendar1 = Table.TransformColumnTypes(Calendar0, {{"Date", type date}}),
    Calendar2 = Table.AddColumn(Calendar1, "Year", each Date.Year([Date]), Int64.Type),
    Calendar3 = Table.AddColumn(Calendar2, "Month", each Date.Month([Date]), Int64.Type),
    Calendar4 = Table.AddColumn(Calendar3, "MonthKey", each Text.From(Date.Year([Date])) & "-" & Text.PadStart(Text.From(Date.Month([Date])), 2, "0"), type text),
    Calendar = Table.AddColumn(Calendar4, "MonthName", each Date.ToText([Date], "MMMM yyyy", "ar-EG"), type text),

    // ---------- الاستحقاق الشهري: كل عقد × كل شهر ----------
    // إيجار الشهر = إيجار سنة العقد (الزيادة السنوية في ذكرى البداية)، والشهر المقطوع بالأيام
    MonthsOf = (c as record) as table =>
        let
            s = c[StartDate], e = c[EndDate],
            n = if e < s then 0 else (Date.Year(e) - Date.Year(s)) * 12 + Date.Month(e) - Date.Month(s) + 1,
            months = List.Generate(() => 0, each _ < n, each _ + 1, each Date.AddMonths(Date.StartOfMonth(s), _)),
            inc = (if c[IncreasePct] = null then 0 else c[IncreasePct]) / 100,
            rentForDate = (d as date) as number =>
                let k = Number.IntegerDivide(Duration.Days(d - s), 365.25) + 0,
                    kk = Date.Year(d) - Date.Year(s) - (if Date.Month(d) < Date.Month(s) or (Date.Month(d) = Date.Month(s) and Date.Day(d) < Date.Day(s)) then 1 else 0)
                in Number.Round(c[Rent] * Number.Power(1 + inc, kk), 0),
            rows = List.Transform(months, (m) =>
                let mf = m, ml = Date.EndOfMonth(m), a = if s > mf then s else mf, b = if e < ml then e else ml,
                    days = Duration.Days(b - a) + 1, dim = Date.Day(ml),
                    due = Number.Round(rentForDate(a) * days / dim, 0),
                    dueDate = if a > #date(Date.Year(m), Date.Month(m), Number.Min(c[DueDay], dim)) then a else #date(Date.Year(m), Date.Month(m), Number.Min(c[DueDay], dim))
                in [ContractCode = c[ContractCode], UnitCode = c[UnitCode], ClientCode = c[ClientCode], MonthKey = Text.From(Date.Year(m)) & "-" & Text.PadStart(Text.From(Date.Month(m)), 2, "0"), MonthStart = m, DueDate = dueDate, Due = due, CoveredDays = days])
        in Table.FromRecords(rows, type table [ContractCode = text, UnitCode = text, ClientCode = text, MonthKey = text, MonthStart = date, DueDate = date, Due = number, CoveredDays = Int64.Type]),
    DueMonths0 = Table.Combine(List.Transform(Table.ToRecords(Contracts), each MonthsOf(_))),
    PaidByCell = Table.Group(Payments, {"ContractCode", "MonthKey"}, {{"Paid", each List.Sum([Amount]), type number}}),
    DueMonths1 = Table.NestedJoin(DueMonths0, {"ContractCode", "MonthKey"}, PaidByCell, {"ContractCode", "MonthKey"}, "P", JoinKind.LeftOuter),
    DueMonths2 = Table.ExpandTableColumn(DueMonths1, "P", {"Paid"}),
    DueMonths3 = Table.ReplaceValue(DueMonths2, null, 0, Replacer.ReplaceValue, {"Paid"}),
    Today = Date.From(DateTime.LocalNow()),
    GraceDays = 5,
    DueMonths4 = Table.AddColumn(DueMonths3, "Remaining", each Number.Max(0, [Due] - [Paid]), type number),
    DueMonths5 = Table.AddColumn(DueMonths4, "OverdueDays", each Duration.Days(Today - [DueDate]), Int64.Type),
    DueMonths6 = Table.AddColumn(DueMonths5, "IsLate", each [Remaining] > 0 and [OverdueDays] > GraceDays, type logical),
    DueMonths = Table.AddColumn(DueMonths6, "Status", each if [Paid] >= [Due] - 0.5 then "مسدَّد" else if [MonthStart] > Today then "قادم" else if [Paid] > 0 then (if [IsLate] then "جزئي متأخر" else "جزئي") else if [IsLate] then "متأخر" else "مستحق", type text)
in
    [Projects = Projects, Units = Units, Clients = Clients, Contracts = Contracts, Payments = Payments, Maintenance = Maintenance, UnitAssets = UnitAssets, Calendar = Calendar, DueMonths = DueMonths]
