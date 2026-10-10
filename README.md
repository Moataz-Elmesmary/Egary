# Egary (إيجاري) v2 — Rental management with Excel as the single source of truth

> One folder. Open it, link the Excel file next to it, and work. Every change on the website is written to `Egary.xlsx` immediately; every change made in Excel shows up on the website within seconds.

<p align="center"><b>Folder to ship to the office:</b> <code>Egary/</code> — contains <code>Open-Egary.bat</code>, <code>index.html</code>, <code>Egary.xlsx</code>, <code>assets/</code>, <code>powerbi/</code>, <code>اقرأني-أولا.txt</code></p>

## What it does
- **Excel ⇄ website two-way sync** (Chrome/Edge, File System Access API, works from `file://` with no server). The familiar yearly sheet (`2026`: rows × months with amounts) is kept exactly as the office uses it, plus structured sheets: المشاريع · الوحدات · أصول الوحدات · العملاء · العقود · المدفوعات · الصيانة · الإعدادات · سجل التعديلات · ملخص المشاريع. If the file is open in Excel (locked), edits are queued and written when it closes.
- **Codes for everything**: projects `P01`, units `P03-304` / `P01-M1` / `P01-S1`, clients `C001`, contracts `T0001`, invoices `INV-2026-0001`, maintenance `M0001` — searchable everywhere; a project profile lists its unit codes; a unit profile lists every tenant over time (a unit can be let twice).
- **Dashboard of totals, every number clickable** → the rows behind it: collected / due / arrears with aging, occupancy, vacant units, units vacant > 3 months, contracts ending in 30/60/90 days, ended without renewal, deposits held, contracted revenue next 12 months, maintenance, and more.
- **Excel-like ledger grid** (كشف التحصيل): click a month cell to record a payment → an **electronic invoice** (printable), or to edit/delete.
- **Contracts**: start – end – deposit – annual increase, with the per-year rent schedule (prorated split months), renewals chain, status computed (never typed).
- **Unit profile**: project, type (تجارية / سكنية / إدارية / جراج), assets checklist with free-text details (AC, furniture, …), full rental history, maintenance history with *who was the custodian at the time* (for deposit questions).
- **Client profile**: national ID / passport, tax registration, phones, contracts, payments, arrears, punctuality.
- **Login with roles**: accounts live in a hidden sheet «المستخدمون» inside the workbook (PBKDF2-SHA256 salted hashes, never plaintext). First run on a workbook without accounts asks to create an owner (مدير) and a staff (موظف) account; roles are admin / staff / view-only, and every row of سجل التعديلات records who did it. The hosted preview ships demo accounts: `admin / admin@2026`, `office / office@2026`, `zaer / view@2026`. It gates the app, not the file: whoever has the folder can open the Excel.
- **Other years**: «＋ إضافة سنة…» in the ledger creates the year sheet with every contract active in it; a sheet the office copies by hand (with or without the code columns) is matched to the same contracts by codes or by name + unit + start date. Accounting starts at the earliest year sheet.
- **Always-on backups**: a `backups/` folder next to the workbook (after every write at most every 20 min, before every delete, the original forever; last 60 periodic copies kept) plus the last 12 good copies in the browser.
- **Delete always asks for confirmation** and shows what else will be deleted.
- **Filters**: project, unit type (incl. garage), status, floor, year; global search by any code, name, phone, national ID, tax number (Arabic-normalized).
- **Insights** computed live from the data; **Data quality** flags (text in a number cell, end before start, duplicate labels, mismatched IDs…).
- **Honest arrears**: the sheet usually lags reality, so months after the last fully-entered month (auto-detected, or set in Settings) are shown as **بانتظار التسجيل** (pending entry) instead of "late"; money entered before a contract's start date becomes a linked **prior term** of the same tenant; split months follow the office's 30-day convention; small rounding differences are tolerated (0.5 %, min 50 EGP).
- **Safety**: every save keeps a browser-side backup of the last good file and of the original file before its first conversion (Settings → downloads); sheets the office adds by hand are preserved; a save never overwrites an Excel edit that landed in between (the file is re-read first).
- **BI mode** (`#/bi`): animated night-city entrance (buildings whose windows light up and drift, mouse-tilt parallax, count-up counters), sectioned dashboard, every tile drills down. Plus a **Power BI Desktop kit** (`Egary/powerbi/`: Power Query M, DAX measures, theme).
- Light/dark themes, RTL, keyboard/ESC, mobile layout, no internet, no install.

## Quick start (office)
1. Copy the `Egary` folder anywhere (Desktop, OneDrive…).
2. Double-click `Open-Egary.bat` (opens Edge/Chrome). Or open `index.html` with Edge/Chrome.
3. Click **ربط ملف الإكسيل** and pick `Egary.xlsx` from the same folder. Allow read/write once.

## Development
No build step. Tests (Node 22 + Playwright + Python openpyxl as an independent oracle):
```
node --test tests/sync.test.js tests/workbook.test.js tests/workbook2.test.js tests/auth.test.js tests/years.test.js tests/backup.test.js   # sync engine, Excel round trips (both directions), login, other years, backups
NODE_PATH=/opt/node22/lib/node_modules node --test tests/e2e.test.js tests/bi.test.js tests/link-flow.test.js tests/backup-flow.test.js   # browser end-to-end
node tests/build_workbook.js                                   # regenerate Egary/Egary.xlsx from a source workbook
```
Architecture (`Egary/assets/js`): `core/` (util, model, codes, store, engine) · `xlsx/workbook.js` (ExcelJS read/write + migration of the original sheet format + conflict rules) · `sync/` (file link + sync engine with a pending-ops journal) · `ui/` (toolkit, forms, views) · `bi/` · `app.js`.

## Data in this repository
`Egary/Egary.xlsx` in the repo (and in the hosted preview) is an **anonymized** workbook: same projects, units, dates and amounts as the office sheet, but every tenant name, national ID and tax number is synthetic. The real workbook is produced privately with `node tests/build_workbook.js <today> <path-to-original.xlsx>` and dropped into the folder you send to the office — it must not be committed to this public repository. Tests run against the anonymized fixture `tests/fixtures/source-anon.xlsx`.

The previous version lives in `legacy/` for reference. The full conversation and decisions are in `CHAT-LOG.md`.
