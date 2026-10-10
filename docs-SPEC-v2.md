# Egary v2 — Authoritative implementation spec (SPEC.md)

Status: final. Supersedes design-user-first.md, design-integrity-first.md and design-excel-bi-first.md. Every section below is a decision. Where a design was the per-section winner its text is the base; grafts from the other two and the fixes for every fatal flaw the judges listed are folded in. Field names are English (code); labels are Arabic (UI and workbook). Dates: `YYYY-MM-DD` (UTC day math only). Periods: `YYYY-MM`. Money: JS number in EGP, never rounded in the data layer. Today in every example and test: `2026-10-09`.

Verified facts about the owner's workbook (`source.xlsx`, sheet `2026` A1:X76) used throughout — all re-checked by script on 2026-10-09:

| fact | value |
|---|---|
| ledger rows | 73 (rows 3..75); totals row 76 |
| projects | 3: بابل (7 rows), محيي الدين (12), ابو بكر (54) |
| units | 71 = 70 distinct (project, label) + 1, because the two بابل «محل» rows (3, 4) overlap in time → `P01-S1`, `P01-S2`; 204 and 304 in ابو بكر are one unit each with two contracts |
| clients | **65** under the identity rule of §2.4 (merges: الدقة rows 5+7 by tax id; ايجل اي rows 15+16 by national id + name with a DQ-IDVARIANT flag; محمد هلال rows 28+29+30+58; نور فلد 54+55; هيثم 74+75; احمد هاشم 24+41; احمد هاشم row 27 stays a second client (different passport) with a DQ-IDVARIANT flag). Rows 7/8 and 22/23 share a representative's national id and are different companies — never merged |
| contracts | **86** = 73 ledger rows + 13 inferred prior contracts (rows 13, 14, 24, 26, 27, 29, 30, 49, 50, 58, 59, 65, 66 carry money before «العقد من»); row 67 is resolved by the date fix (§3.8 step 5), not by inference |
| payments | **509** numeric month cells → `INV-2026-0001 … INV-2026-0509`; 1 text cell R65 = `63+.0+3+26309` |
| per-month numeric cells | Jan 67, Feb 67, Mar 67, Apr 66, May 65, Jun 61, Jul 60, Aug 56, Sep–Dec 0 |
| entered-through (auto) | `2026-08` (56 numeric August cells for 61 contracts active in August ≥ 25 %); September has 0 |
| occupancy at 2026-10-09 | 46 occupied; 25 units without an active contract = **10 vacant (confirmed)** + **15 holdover** «منتهٍ — في انتظار التجديد/التسجيل» (§5.4: the contract's last month ≥ `enteredThrough`, so the ledger has no completed month after it: rows 8, 19, 20, 32, 36, 39, 40, 53, 57, 61, 62, 69, 72, 74, 75); none reserved |
| vacant ≥ 92 days (vacantSince = end + 1 day) | 7: `P01-O61` 191 d, `P03-607` 161 d, `P01-S2` 161 d, `P01-S1` 130 d, `P01-M3` 130 d, `P03-201` 130 d, `P03-608` 100 d; the other 3 confirmed vacancies: `P03-501` 69 d, `P03-502` 69 d, `P03-706` 69 d (all ended 2026-07-31 with an empty August) |
| contracts ending ≤ 90 days with no successor | 14 |
| re-let gaps | 304: 171 days (2026-02-11 → 2026-07-31); 204: 0 days |
| office styles | header fill `FF1F4E78` + bold white; data rows `FFFFF2CC`; totals row `FFD9D9D9` bold; K..W `#,##0.00`; G/H `dd/mm/yyyy`; J `@`; freeze `P58` (accidental); RTL view; merge `K1:V1`; widths A5 B11 C34 D30 E11 F26 G12 I13 J18 K11 W14 X40 |
| 30-day proration proofs | 606 Jul = 15,000×15/30 + 19,000×15/30 = 17,000 (exact); 605 Jul = 8,775×15/30 + **14,005**×15/30 = 11,390 exactly (the new rent has no full-month evidence — August is text — so it is solved from the split cell per §3.8 step 7: `(11,390 − 8,775×15/30) × 30/15 = 14,005`, `round5` keeps it, flagged `DQ-RENTSOLVED`; the office will probably correct it to 14,000, which also reproduces the cell within tolerance); 401 Jan = 32,745×10/30 + 37,665×20/30 = 36,025; ميزان 1/2 May = 45,100×19/30 + 49,610×11/30 = 46,753.67 vs 46,603 (one split-day off); 508 Jun = 18,000×24/30 = 14,400 vs 13,500 agreed; 304 Feb (end 10th) = 7,565×10/30 = 2,521.67 unpaid |
| trailing empty months inside contracts (≤ `enteredThrough` 2026-08) | 9 cells in 5 contracts, all `late` under §5.3 and flagged `DQ-TRAILINGGAP`: row 39 unit 301 Jun/Jul/Aug × 17,000 = 51,000; row 72 unit 705 Jun/Jul/Aug × 11,000 = 33,000; row 71 unit 704 Aug 11,000; row 56 unit 503 Aug 11,195; row 73 unit 706 Jul 10,890 → **117,085**. Plus 304 Feb (row 42: the final partial month, 2,521.67) which is the same pattern ending at E |
| day-one real arrears (report month 2026-08) | **≈ 135,566.67 EGP** = 18,481.67 of explained differences (304 Feb 2,521.67; 105 Aug 14,000; 302 Aug 1,000; 508 Jun 900 until the office confirms the 13,500 override; 503 Jul 60 = 11,135 vs 11,195, tol 55.98) **+ 117,085** of trailing empty months (above). The K05 tile shows the split in its sub («منها 117,085 في 5 عقود توقف تسجيلها — أكّد أو سجّل إنهاء»); each `DQ-TRAILINGGAP` fix («إنهاء مبكر من …») removes its months from K05. R65 is excluded (unreadable) |
| holdover (ended, no successor, nothing known after the end) | 15 contracts (list above). Not vacant, not occupied: K10/K11/K14 vacancy loss and insight 5 exclude them; K14 lists them as a second group; `DQ-HOLDOVER` per contract with «تجديد» / «الوحدة فعلًا شاغرة» |

Non-negotiable product rules (printed on Help.html):
1. مجلد واحد وزرار واحد — one folder, one launcher, nothing to install.
2. الإكسيل بتاعكم زي ما هو — the `2026` sheet keeps its look, colours, formulas and row order.
3. البرنامج عمره ما يضيّع فلوس — a money cell is never deleted or rewritten unless the user asked; every write is backed up and verified.
4. كل رقم بيشرح نفسه — every KPI opens the rows behind it and the value is computed from those rows.
5. الغلط بيتصلّح مش بيتعاقب — validation is a hint with a fix button; deletes have undo; Excel edits are reconciled, never rejected silently.

---

## 1. Folder layout, launcher, first run, later runs

Base: user-first §1. Grafts: integrity (expected-path hint, folder validation, .xlsm refusal, create-empty-workbook, OneDrive warning, zip guard), excel-bi (Open-Egary-BI.bat, README.txt, schemaVersion upgrade, route restore). Fixes: plan-B profile mismatch, non-ASCII extraction paths.

### 1.1 Shipped folder (all file names ASCII; zip of this folder is what the office receives)

The office sees **four things** at the top level (the owner's «مش عايزه يتوه»); everything technical lives in `app/`:

```
Egary/
├── Open-Egary.bat          ← the ONLY thing to double-click
├── Egary.xlsx              ← THE data file — the office's own workbook, copied here by the office (not shipped, see 1.7)
├── README.txt              ← 14 lines, Arabic, UTF-8 with BOM (Notepad-safe)
├── backups/                ← created by the app on first write; never touched by hand
└── app/                    ← «ملفات البرنامج — ما تلمسهاش»
    ├── index.html          ← the app (plan B: double-click works, see 1.2)
    ├── bi.html             ← BI page (read-only; same engine, same folder link; reached from the app's «لوحة العرض»)
    ├── Open-Egary-BI.bat   ← optional projector launcher for bi.html (same profile, `%~dp0bi.html`)
    ├── Help.html           ← one-page Arabic guide with 4 illustrations (opens in any browser; linked from README and the app)
    ├── powerbi/
    │   ├── Egary.pq            ← Power Query M (parameter WorkbookPath)
    │   ├── Egary-measures.dax  ← DAX measures, Arabic names
    │   ├── Egary-theme.json    ← light theme   ├── Egary-theme-dark.json ← dark twin
    │   └── README-PowerBI.txt
    └── assets/
        ├── css/    tokens.css app.css ledger.css print.css bi.css
        ├── fonts/  IBMPlexSansArabic-{Regular,Medium,SemiBold,Bold}.woff2  OFL.txt
        ├── img/    logo.svg help-1.svg help-2.svg help-3.svg help-4.svg help-5.svg skyline-far.svg
        ├── vendor/ exceljs.min.js (4.4.0, MIT)  exceljs.LICENSE
        └── js/     (file list in §10)
```

Repo-only, never shipped: `tests/`, `tools/`, `docs/`, `CHAT-LOG.md`, `.github/`, `legacy/`. Shipped size < 4 MB. No build step, no ES modules (Chromium blocks `type=module` on `file://`): classic `<script>` tags in dependency order, each an IIFE on `window.Egary`. No Web Workers.

**Scaffold corrections (binding for the implementation branch):**
- The repo never contains a real workbook. `.gitignore` gains `*.xlsx`, `!tests/fixtures/*.xlsx`, `tests/out/` (already), `Egary/backups/`. `Egary/Egary.xlsx` is removed from history (§9 R1). `tests/fixtures/source-anon.xlsx` is deleted and replaced by `tests/fixtures/office-2026.xlsx` generated by `make-fixture.py` (§8.1) and checked by `check-no-pii`; no test path references `source-anon.xlsx`.
- `Egary/README-AR.txt` **and** `Egary/اقرأني-أولا.txt` are both deleted; `README.txt` (§1.6) is the only read-me (ASCII file name so every zip tool and mail client keeps it).
- The brief and tasks #2/#5 say «SheetJS 0.18.5 vendored»; that wording is superseded: the scaffold vendors **ExcelJS 4.4.0 only** and nothing else is added. SheetJS CE is not used (cannot write styles, validations, freeze panes or RTL views). Wherever a task says SheetJS, read ExcelJS.
- The scaffold's `index.html`, `bi.html`, `assets/`, `powerbi/`, `Open-Egary-BI.bat` move under `Egary/app/`; `Open-Egary.bat` stays at the top and points to `app\index.html`.

### 1.2 `Open-Egary.bat` (ASCII only — cmd reads the file in the OEM code page; `%~dp0` expands to the real Unicode path at runtime, so Arabic folder names work)

```bat
@echo off
setlocal
rem never "enabledelayedexpansion": paths containing ! or % must survive untouched
if not exist "%~dp0app\index.html" (
  echo.
  echo  Please extract the zip first: right-click the zip ^> Extract All, then open Open-Egary.bat from the extracted folder.
  echo  (Running from inside the zip or from a Temp folder loses your data.)
  echo.
  pause
  exit /b 1
)
set "DIR=%~dp0"
set "DIR=%DIR:\=/%"
set "APP=file:///%DIR%app/index.html?via=bat"
set "PROFILE=%LOCALAPPDATA%\Egary\profile"
set "BROWSER="
for %%B in ("%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" "%LocalAppData%\Microsoft\Edge\Application\msedge.exe" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LocalAppData%\Google\Chrome\Application\chrome.exe") do if not defined BROWSER if exist %%B set "BROWSER=%%~B"
if not defined BROWSER for %%K in (msedge.exe chrome.exe) do if not defined BROWSER for /f "tokens=2,*" %%A in ('reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\%%K" /ve 2^>nul ^| find "REG_SZ"') do if exist "%%B" set "BROWSER=%%B"
if not defined BROWSER for %%K in (msedge.exe chrome.exe) do if not defined BROWSER for /f "tokens=2,*" %%A in ('reg query "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\%%K" /ve 2^>nul ^| find "REG_SZ"') do if exist "%%B" set "BROWSER=%%B"
if defined BROWSER (
  start "" "%BROWSER%" --app="%APP%" --user-data-dir="%PROFILE%" --profile-directory=Default --no-first-run --no-default-browser-check --disable-sync --window-size=1366,820
  exit /b 0
)
echo  No Edge or Chrome found. Opening with the default browser...
start "" "%~dp0app\index.html"
```

Decisions folded in: per-user Edge (`%LocalAppData%\Microsoft\Edge\Application`) and the `App Paths` registry keys (both hives) are searched before giving up; no delayed expansion so `!`/`%` in the extracted path survive; the zip/Temp case is caught **before** anything runs (the only file Explorer extracts when a `.bat` is launched from inside a zip is the `.bat` itself, so `app\index.html` is missing); the default-browser fallback is last and announced — if `.html` is associated with an editor the person lands in Notepad/VS Code, which README line 9 covers («افتح index.html بالكليك اليمين › Open with › Microsoft Edge»). `--disable-sync` plus `--no-first-run` suppress Edge's welcome/sign-in page in the fresh profile; whether a residual first-run dialog appears is manual check M-03 (§8.7). `app\Open-Egary-BI.bat` is identical with `%~dp0bi.html?via=bat` (it sits inside `app/`, so `%~dp0` already points there). Consequences: `--app` = chromeless window (no address bar/tabs; title «إيجاري»); `--user-data-dir` = a private profile per PC so the folder permission, theme and coach state are remembered independently of the person's browser; `--no-first-run` = no welcome pages. Fallback = default browser (`start app\index.html`); the app then detects `via` missing (see below). Windows "Open File – Security Warning" on a downloaded .bat appears once; Help illustration 1 shows «تشغيل / Run».

Plan B (double-click `app\index.html`) lands in the default browser profile, whose IndexedDB is separate. The app detects `location.search` without `via=bat` and, whenever it has no stored folder link, shows the link screen with the extra line «لو ربطت المجلد قبل كده وهو مش ظاهر: اقفل الصفحة دي وافتح Open-Egary.bat» and a dismissible top banner «الأفضل تفتح البرنامج من Open-Egary.bat علشان يفتكر المجلد». Linking in plan B still works (harmless second link). Help.html states the rule once: «افتح دايمًا من Open-Egary.bat».

### 1.3 First run (no folder handle in IndexedDB `egary.handles/root`)

S0 Splash < 1 s (logo + «إيجاري»).

S0b Zip/Temp guard (before S1): `location.pathname` (decoded) containing `/Temp/`, `/AppData/Local/Temp/`, `/Temporary Internet Files/`, `.zip/` or `.rar/` → full-screen «فك الضغط الأول: كليك يمين على الملف المضغوط › Extract All، وبعدين افتح Open-Egary.bat من المجلد الجديد» with illustration 5; no picker is offered (a workbook there is ephemeral).

S1 `#welcome` «اربط مجلد البرنامج»: illustration of the folder with `Egary.xlsx` highlighted; one primary button «اختيار مجلد Egary» → `showDirectoryPicker({ id: 'egary-root', mode: 'readwrite', startIn: 'desktop' })`; a grey hint with the expected path derived from `location.pathname` minus the trailing `/app/index.html` (e.g. `C:\Users\Mona\Desktop\Egary`); the browser's own «السماح / Allow» prompt is shown as illustration 3. Picker outcomes: `AbortError` after the browser refused a system folder (Chromium blocklist: the user-profile root, `C:\`, `Program Files`, `Windows`, `AppData`) → «المتصفح رفض المجلد ده لأنه مجلد نظام — انقل مجلد Egary على سطح المكتب أو C:\Egary وجرّب تاني»; a plain cancel → nothing. Small link «الملف عندي في مكان تاني» → single-file picker fallback (`showOpenFilePicker`, accept .xlsx); in file mode backups are stored as Blobs in IndexedDB `egary.filebackups` (verified on `file://`; OPFS is **not** relied on), the last 10 kept, each downloadable from الإعدادات, with a yellow note. `showDirectoryPicker` on `file://` and the persistence of a directory handle in IndexedDB are manual checks M-01/M-02 (§8.7); if M-01 fails on a build, the file-mode fallback is the primary path and S1 says so.

Validation of the picked folder, in order: (1) `.xlsm` present and no `.xlsx` → «الملف فيه ماكرو — احفظه بصيغة xlsx الأول»; (2) the folder lacks **both** `Open-Egary.bat` and a subfolder `app/` (`hasFile('Open-Egary.bat') || hasDir('app')`) → «اختار مجلد Egary نفسه — اللي فيه Open-Egary.bat و Egary.xlsx» with the expected tree drawn (picking `app/` itself triggers this with the extra line «ده مجلد البرنامج — ارجع خطوة لورا»); (3) folder lacks `Egary.xlsx` → list of `.xlsx` files found with «استخدم الملف ده» (no rename on disk: the app remembers the chosen name in `localStorage egary.workbookName` and every message that says «Egary.xlsx» prints that name instead) or, if none, two buttons «إنشاء ملف جديد فارغ» (writes the template workbook of §3) / «اختيار المجلد تاني». Then: `navigator.storage.persist()` (best effort), store the directory handle, derive the `backups/` subdirectory handle (created lazily on first write), run `zipguard.scan` (§4.4), read.

S2 «ترقية الملف» — only when the workbook is in the owner's original layout (a 4-digit sheet with the legacy header row and no sheet `العقود`). Migration dry-run (§3.8) shows one card:
«لقيت ورقة 2026: 3 مشاريع · 71 وحدة · 65 عميل · 73 صف تعاقد → 86 عقد (13 صف فيهم فلوس قبل بداية العقد هيتقسموا صفين: عقد سابق + العقد الحالي) · 509 دفعة · خانة واحدة مكتوب فيها نص · N ملاحظة للمراجعة»
plus a scrollable list of the review items (incl. «هتتغيّر تسمية عمود «عدد الوحدات» في ملخص المشاريع إلى «عدد الصفوف (عقود)»») and one button «ابدأ». Nothing is written before the click. Click → `backups/original-YYYYMMDD-HHMMSS.xlsx` (never pruned) → the upgraded workbook → verify-after-write → dashboard. If Excel holds the file: inline yellow box «اقفل ملف الإكسيل الأول وبعدين اضغط ابدأ» with automatic retry every 3 s.

S3 الرئيسية. **First-run click budget** (non-technical user): Run (SmartScreen, once) → «اختيار مجلد Egary» → «السماح» → «ابدأ» = 4 clicks to a working dashboard; nothing else is asked. The device label defaults silently to «جهاز 1» (`localStorage egary.device`; a second device linking the same workbook gets «جهاز 2» from `settings.lastWriteBy`); it is editable in الإعدادات and asked for only when two devices with the same label write the same workbook (`DQ-DEVICECLASH` info). The 4-step coach overlay (search box → «+ إضافة» → sync pill → «لوحة العرض») is shown **after the first successful write of a payment or record**, never over the folder prompt or the migration card; «لا تعرضه تاني» in `localStorage egary.coach`.

### 1.4 Later runs

Handle found → `queryPermission({mode:'readwrite'})`. `granted` → read → last route restored from `localStorage egary.route` (never a print/invoice route) → dashboard. `prompt` → one big button «متابعة» (a user gesture is required) → `requestPermission` → read. **Assume the prompt state is the normal case**: Chromium persists File System Access grants only for installed apps or origins that qualify for the «Allow on every visit» checkbox, and a `file://` page in a `--app` window is not verified to qualify (manual check M-04). Copy therefore promises two clicks per launch, not «أول مرة بس»: the «متابعة» screen says «كل مرة تفتح البرنامج: اضغط متابعة وبعدين السماح — خطوتين وخلاص» and README line 2 matches; if M-04 shows the grant persists in the dedicated profile, the sentence becomes «أول مرة بس» in both places and nothing else changes. `denied` → S1 with «أعد ربط المجلد». Pending journal from a previous session → replayed on the fresh state and written; toast «اتحفظ N تعديل كانوا مستنيين». A workbook whose `الإعدادات.schemaVersion` < app version → in-place upgrade (adds missing sheets/columns only; never removes), logged in `سجل التعديلات`. Single-instance guard (§4.9) runs before anything else.

### 1.5 Error states (one Arabic sentence + one button)

| situation | message | button |
|---|---|---|
| folder moved/renamed (`NotFoundError` on the handle) | «مش لاقي مجلد Egary في مكانه» | «اختاره تاني» → S1 (journal kept) |
| `Egary.xlsx` missing | «مش لاقي ملف Egary.xlsx جوه المجلد» | list of .xlsx found / «حط الملف وبعدين اضغط تحديث» |
| Firefox/Safari (no File System Access) | «المتصفح ده مش بيحفظ تلقائي — افتح من Open-Egary.bat» | import/export mode (§4.10) |
| second window of the app | «البرنامج مفتوح في نافذة تانية» | «استخدم النافذة دي بدلها» (§4.9) |
| workbook contains charts/pivots/macros (zip guard) | «الملف فيه عناصر البرنامج مش بيقدر يحفظها بأمان (رسم بياني) — هتقدر تقرأ وتصدّر نسخة بس» | «حفظ نسخة Egary-export.xlsx» |
| Mark-of-the-Web blocks `file://` storage | «الملف محظور من ويندوز — كليك يمين على index.html › Properties › Unblock» (illustration 4) | «جرّب تاني» |
| OneDrive/Google Drive folder detected (path contains `OneDrive`, `Google Drive`, `Dropbox`) | yellow note «المجلد جوه OneDrive — ينفع، بس الأحسن تنقله على C:\Egary علشان الحفظ ما يتقطعش» | dismiss |
| running from inside the zip / a Temp folder (S0b) | «فك الضغط الأول: كليك يمين على الملف المضغوط › Extract All» (illustration 5) | none (full-screen) |
| browser refused the picked folder (system folder) | «المتصفح رفض المجلد ده لأنه مجلد نظام — انقل مجلد Egary على سطح المكتب أو C:\Egary» | «اختيار المجلد تاني» |
| zero-byte / torn / not-a-zip file (OneDrive Files-On-Demand placeholder, copy in progress; `load()` throws or the zip central directory is missing) | after 3 silent retries over 10 s: «الملف ناقص أو لسه بيتنزّل — لو هو على OneDrive استنى التنزيل، أو رجّع نسخة احتياطية» | «حاول تاني» / «استرجع نسخة احتياطية» (state unchanged, writes paused) |
| password-encrypted workbook or legacy `.xls` (bytes start with the OLE signature `D0 CF 11 E0`) | «الملف محمي بكلمة سر أو بصيغة xls القديمة — افتحه في الإكسيل، شيل كلمة السر واحفظه بصيغة xlsx» | «حاول تاني» (read-only, no state) |
| sheet or workbook protection on an owned sheet (`ws.protect` / `wb.workbookProtection`) | reads normally; pill «قراءة فقط»: «ورقة 2026 محمية — شيل الحماية من Review › Unprotect Sheet علشان البرنامج يقدر يحفظ» | «حاول تاني» |
| `الإعدادات.schemaVersion` > app version (another PC runs a newer build) | «الملف اتحفظ من نسخة أحدث من البرنامج — حدّث البرنامج على الجهاز ده (انسخ مجلد app الجديد)»; everything is readable, writes disabled | «حفظ نسخة Egary-export.xlsx» |
| transient read failure while Excel/OneDrive writes (`load()` throws after two-tick stability) | silent retries at 0.5 / 1 / 2 / 4 s; then banner «مش قادر أقرأ الملف — الإكسيل أو OneDrive بيحفظ؟» (state unchanged, writes paused until a read succeeds) | «حاول تاني» |
| journal lost (IndexedDB evicted or the profile folder deleted: `localStorage egary.meta.journalCount > 0` but the store is empty) | «المتصفح مسح التعديلات المؤقتة (N) اللي كانت مستنية الإكسيل — راجع آخر صفحات سجل التعديلات وأعد اللي ناقص» | «فتح السجل» |
| dedicated profile folder deleted by the office (`%LOCALAPPDATA%\Egary` gone) | S1 again (relink); the first read on this device runs without a snapshot (§4.6.3 last row: ledger wins) — no data is lost because the workbook is the truth | — |
| mass change detected on read (§4.6.6) | modal «الملف اتغيّر كتير مرة واحدة: 120 خانة و 80 فاتورة هتتلغي — شكله نسخة قديمة من الملف» | «استخدم الملف زي ما هو» / «رجّع آخر نسخة احتياطية» / «شوف الفرق» |
| Excel opened the workbook in **Protected View** (extracted from a Mark-of-the-Web zip): Excel takes no `~$` lock and discards the office's edits until «Enable Editing» | no detection possible; README line 11 and Help: «لو الإكسيل فتح الملف بشريط أصفر "عرض محمي" اضغط "تمكين التحرير" (Enable Editing) قبل ما تكتب — أو كليك يمين على ملف الـ zip › Properties › Unblock قبل فك الضغط» (illustration 4 shows both) | — |

### 1.6 README.txt (content)

1. أول حاجة: انسخ ملف الإكسيل بتاعكم جوه المجلد ده باسم Egary.xlsx (أو بأي اسم .xlsx — البرنامج هيسألك تختاره). 2. اضغط مرتين على Open-Egary.bat. لو ويندوز سأل «Run» اضغط Run. 3. أول مرة: «اختيار مجلد Egary» → اختار المجلد ده → «السماح». كل مرة بعدها: «متابعة» ثم «السماح» لو المتصفح طلبها. 4. ملف Egary.xlsx هو قاعدة البيانات؛ عدّل فيه براحتك والموقع بيقرأ التغيير في ثواني. 5. لو الإكسيل مفتوح، الموقع بيستنى لحد ما تقفله وبعدين يحفظ (شريط أصفر فوق). 6. ما تغيّرش أسماء الأوراق ولا تمسح أعمدة «كود …» في آخر الورقة؛ المعادلات اللي بتشاور على صفوف الدفتر بتتزحزح لوحدها لما يتضاف صف. 7. ما تضيفش رسوم بيانية أو Pivot أو أشكال جوه Egary.xlsx — استخدم لوحة العرض أو Power BI. 8. خلّي المجلد على الجهاز (مش OneDrive). النسخ الاحتياطية في مجلد backups. 9. لو مفيش Open-Egary.bat (الإيميل بيمسحه) أو ما فتحش حاجة: افتح مجلد app واضغط مرتين على index.html (أو كليك يمين › Open with › Microsoft Edge). 10. لو الملف جالك مضغوط: فك الضغط الأول (Extract All) قبل ما تفتح أي حاجة. 11. لو الإكسيل فتح الملف بشريط أصفر «عرض محمي» اضغط «تمكين التحرير» قبل ما تكتب. 12. تحديث البرنامج: فك ضغط النسخة الجديدة فوق المجلد ده واختار Replace — ملف Egary.xlsx ومجلد backups ما بيتلمسوش. 13. مجلد app ملفات البرنامج — ما تلمسوش. 14. المساعدة الكاملة بالصور: app\Help.html.

### 1.7 Delivery and updates

- **Who packs**: the owner (or the developer on the owner's machine) runs `node tools/pack.mjs` which zips the `Egary/` folder **without any workbook** and without `backups/` → `Egary-YYYY-MM-DD.zip`. The optional flag `--workbook <path>` adds a workbook for a private hand-off; the public repo and CI never see one. The office copies its own Excel into the folder (README line 1); the first-run flow «folder lacks Egary.xlsx → list .xlsx → استخدم الملف ده» handles any name.
- **Channel**: the zip goes by WhatsApp Desktop, a Google Drive/OneDrive share link or a USB stick — these keep `.bat` files. Gmail and Outlook strip or block `.bat`/`.cmd` even inside a zip, so e-mail carries only the share link; if a zip nevertheless arrives by e-mail without the launcher, README line 9 and Help line «لو مفيش Open-Egary.bat: افتح app\index.html» are the first-open path (plan B of §1.2; the app in plan B with a readwrite folder handle also offers «إنشاء زرار التشغيل» which writes `Open-Egary.bat` into the folder — manual check M-05 verifies Chromium allows `createWritable` on a `.bat`; if it does not, the button is hidden and the README line stands). `docs/manual-checks.md` M-06 is the Gmail/Outlook round-trip.
- **Updates**: an update zip contains `Open-Egary.bat`, `README.txt` and `app/` only. The office extracts it over the old folder and chooses «Replace the files» — `Egary.xlsx` and `backups/` are never in the zip, so they survive; the stored directory handle still points to the same folder (no relink); the workbook's `schemaVersion` upgrade (§1.4) runs on the next read. Help has the three-screenshot sequence.

---

## 2. Data model and codes

Base: integrity-first §2. Grafts: excel-bi (depositStatus `unrecorded`, enteredThrough, override reason, editable year `from`, round-to-5, device label), user-first (asset codes, confirmed flag + auto prevCode, per-sheet row-without-code matching). Fixes: per-contract identity snapshot (rep, repId, taxRef) so ledger D/I/J are never rewritten for merged clients; identity rule stated with the احمد هاشم outcome; high-water marks instead of max+1.

Conventions: every record has `code` (immutable identity, written into every sheet where it appears), `createdAt` (date), `notes`, `extras` (map of unknown workbook columns carried verbatim, §3.6). Enum keys are ASCII in JS and Arabic in the workbook (`model.js` LISTS). Entity keys match `model.js`: `projects, units, assets, clients, contracts, years, payments, overrides, maintenance, flags, settings, audit`.

### 2.1 Project `projects` — sheet `المشاريع`

| field | type | req | default | Arabic header / notes |
|---|---|---|---|---|
| code | `P\d{2,}` | auto | hwm | كود المشروع |
| name | string | yes | — | اسم المشروع; unique after `normalize()`; ledger column B |
| address | string | no | '' | العنوان; ledger column F |
| owner | string | no | '' | المالك (invoice header) |
| area | string | no | '' | المنطقة |
| order | int | no | position | الترتيب (ledger block order) |
| floors | int | no | null | عدد الأدوار (BI height; inferred from units when null) |
| notes, createdAt, extras | | | | ملاحظات, تاريخ الإضافة |

### 2.2 Unit `units` — sheet `الوحدات`

| field | type | req | default | notes |
|---|---|---|---|---|
| code | `P\d{2}-[A-Z0-9-]{1,8}` | auto | `codes.unitCode` | كود الوحدة; project part immutable (a unit never moves project) |
| projectCode | ref | yes | — | كود المشروع |
| label | string | yes | — | رقم / اسم الوحدة — exactly what the office writes (`304`, `ميزان 1/2`, `محل`); unique per project after `normalize()` except when §3.8 step 3 proves two physical units |
| type | enum `commercial|residential|admin|garage` | yes | inferred | النوع: تجارية / سكنية / إدارية / جراج |
| floor | string `B,G,M,1..30` | no | inferred | الدور: بدروم / أرضي / ميزان / 1… |
| kindLabel | string | no | '' | الوصف (محل / مكتب / عيادة / شقة / جراج) |
| areaM2 | number ≥ 0 | no | null | المساحة م² |
| notes, createdAt, extras | | | | createdAt = vacancy start for never-let units |

Derived: `status ∈ arrears|ending|occupied|holdover|reserved|vacant` (single value, precedence in §5.4), `currentContract`, `vacantSince`, `vacancyDays`. Renaming a unit's label never changes its code (the label part of a code is a mnemonic frozen at creation; `P03-304` stays `P03-304` if the office relabels it «شقة 304»).

### 2.3 UnitAsset `assets` — sheet `أصول الوحدات`

| field | type | req | default |
|---|---|---|---|
| code | `A\d{4,}` | auto | hwm |
| unitCode | ref | yes | |
| item | string | yes | catalog or free text |
| present | bool | yes | true |
| qty | int ≥ 0 | no | 1 |
| condition | enum `new|good|needs_repair|damaged` | no | good (جديد / جيد / يحتاج صيانة / تالف) |
| details | string | no | '' |
| recordedAt | date | yes | today |

Catalog (`settings.assetCatalog`, editable): تكييف، أثاث/فرش، مطبخ، سخان، عداد كهرباء، عداد مياه، عداد غاز، إنترنت / تليفون، ستائر، أجهزة كهربائية، إنتركم / باب أمان، موقف سيارة، + «بند آخر». Garage units show a reduced catalog (باب/ريموت، عداد كهرباء، أخرى).

### 2.4 Client `clients` — sheet `العملاء`

| field | type | req | default | notes |
|---|---|---|---|---|
| code | `C\d{3,}` | auto | hwm | كود العميل |
| name | string | yes | — | الاسم (ledger C) |
| kind | enum `person|company` | yes | inferred | النوع: فرد / شركة |
| rep | string | no | '' | الممثل القانوني (default for new contracts) |
| nationalId | string | no | '' | الرقم القومي / الباسبور — text, `foldCode`d; person's own id, or the representative's id for a company |
| nationalId2 | string | no | '' | رقم هوية ثانٍ (مستأجر مشارك) — the second id of a joint tenancy (rows 19, 20); searchable like `nationalId`; printed on the invoice after the first |
| taxId | string | no | '' | تسجيل ضريبي — normalised `\d{3}-\d{3}-\d{3}` when it matches |
| phone, phone2 | string | no | '' | `^[+\d][\d\s-]{6,19}$` after digit folding |
| email, address, notes, createdAt, extras | | | | |

**Identity rule** (migration, hand-added rows, form duplicate warnings), applied in this order:
1. same folded `taxId` (non-empty) → same client;
2. else same folded `nationalId` (non-empty) **and** same `normalize(name)` → same client;
3. else same `normalize(name)` and neither side has any id → same client;
4. otherwise different clients. A shared national id across different names is a representative, never a duplicate (rows 7/8, 22/23).
`kind` inference, in order: (a) `taxId` present or `normalize(name)` matches `/شركه|مؤسسه|مبادرات|وزاره|جمعيه|مركز|معهد|صالون|مطعم|كافيه|برودكشن|قروب|زون|لابز|للتجاره|للاستشارات|للاستيراد|للتصدير|للانتاج|للخدمات|للتنميه|للمقاولات|للتسويق|company|co\b|ltd|llc|inc|group/` → `company`; (b) else `rep` non-empty and `|tokens(normalize(rep)) ∩ tokens(normalize(name))| < 2` (the representative shares fewer than two name tokens with the tenant → not the tenant and not a relative) → `company` + `DQ-KINDGUESS` (one summary flag listing the clients, fix «تعيين النوع» bulk); (c) else `person`. On the owner's file (b) fires only for row 31 «ارابيك في اي بي» (rep ليلى جمال شعبان → company, guessed); rows 3 (حسام حسن سنوسي / rep يوسف حسن سنوسي), 46 and 20 share ≥ 2 tokens and stay `person`. **Joint tenants**: a name containing two names separated by ` - ` or ` و ` where both halves start with an honorific (rows 19, 20 «د/ احمد محمد حسن - د/ دينا محمد سعيد») is **one client** (`kind = person`, name kept verbatim because the office identifies the tenancy by that string, ledger C round-trips unchanged); the id in J is `nationalId`, `nationalId2` is empty, and `DQ-COTENANT` (low) says «الاسم فيه مستأجرين — اكتب رقم هوية التاني في «رقم هوية ثانٍ»» with fix «فتح العميل». No co-tenant entity exists. A value in the national-id column shaped like a tax number (`\d{3}-\d{3}-\d{3}`, row 52) is moved to `taxId` with flag `DQ-IDFORMAT`. Result on the owner's file: 65 clients. Same name with different ids (احمد هاشم P12786398 / P12766398) → two clients + `DQ-IDVARIANT` with a one-click «دمج» (re-points contracts to the lower code, keeps the other id in `notes`, audit). Same company name + same rep id + tax ids differing (ايجل اي 730-874-532 / -533) → one client (rule 2), `taxId` = first seen, `DQ-IDVARIANT` quoting both; the per-row value survives in the contract snapshot (§2.5).

Form warnings (never blocks): another client has the same national id / tax id / normalised name → «فيه عميل بنفس الرقم: C012 — هو نفس الشخص؟ [افتح] [استخدمه بدل الجديد]».

### 2.5 Contract `contracts` — sheet `العقود` (one tenancy of one unit by one client)

| field | type | req | default | notes |
|---|---|---|---|---|
| code | `T\d{4,}` | auto | hwm | كود العقد (= ledger column Y) |
| unitCode | ref | yes | | changed only by `contract.reassign` (§4.5): a confirmation modal, an audit line, the overlap check on the target unit; payments and invoice numbers stay |
| clientCode | ref | yes | | changed only by `contract.reassign` (wrong client after migration — compound names, rep-vs-tenant confusion — is a reassign, never delete + recreate); the snapshot (rep/repId/taxRef) is reset to the new client's values; printed invoices show the client current at print time and the audit line records the change |
| rep | string | no | client.rep | الممثل القانوني — **per contract**; ledger column D |
| repId | string | no | client.nationalId | رقم هوية الممثل / العميل كما في الصف — ledger column J |
| taxRef | string | no | client.taxId | التسجيل الضريبي كما في الصف — ledger column I |
| start, end | date | yes | end = start + termYears − 1 day | العقد من / العقد الى; end ≥ start. For `source=inferred` contracts `start` is internally `settings.trackingFrom` (first day) but is **not a fact**: the ledger G stays blank and the profile shows «بداية غير معروفة (قبل يناير 2026)» until the office types the real date (§3.2) |
| paySchedule | enum `monthly|quarterly|semiannual|annual` | yes | monthly | نظام السداد — the owner's «installment due dates are settled in the program»: the engine books the period's dues on the first month of each window (§5.2); no zero overrides needed |
| terminatedOn | date | no | '' | تاريخ الإنهاء المبكر; effective end `E = min(end, terminatedOn)` |
| rent | number > 0 | yes | | الإيجار الشهري (السنة الأولى) — proposes `years` |
| increasePct | number 0–100 | no | settings.defaultIncreasePct (10) | نسبة الزيادة السنوية % — proposes later years |
| years | ContractYear[] | yes | generated | authoritative schedule (§2.6) |
| dueDay | int 1..28 | yes | settings.dueDay (1) | يوم الاستحقاق |
| deposit | number ≥ 0 | no | null | التأمين — null = unknown |
| depositStatus | enum `unrecorded|held|returned|deducted|none` | yes | `unrecorded` when deposit is null (all migrated rows); `held` when deposit > 0; `none` when the user types 0 | حالة التأمين: غير مسجّل / محتفظ به / مردود / مخصوم / بدون تأمين |
| depositReceivedOn | date | no | '' | تاريخ استلام التأمين — set by «تسجيل استلام التأمين» (prints إيصال تأمين `DEP-YYYY-NNNN` from `hwm.deposit.YYYY`) |
| depositSettledOn | date | no | '' | تاريخ تسوية التأمين |
| depositRefunded | number ≥ 0 | no | 0 | المردود من التأمين — set by the settlement; `deposit = depositRefunded + depositDeducted` when `returned`/`deducted`; a deduction larger than the deposit is refused by the form («الخصم أكبر من التأمين — الباقي يتسجّل كمتأخرات») and the remainder becomes an `openingBalance`-style line via «تسوية نهائية» (§6.7) |
| depositDeducted | number ≥ 0 | no | 0 | المخصوم من التأمين — **stored**, entered in the settlement dialog, prefilled with Σ cost of closed maintenance rows of this contract marked `deductFromDeposit` (editable; the dialog shows the rows). `deductFromDeposit` is allowed only when `borneBy ∈ tenant|shared` (form rule + `DQ-LISTVALUE` on Excel-typed rows) |
| prevCode | ref Contract | no | '' | العقد السابق; auto-set when the previous contract on the unit has the same client. **Linked-adjust rule**: when this contract's `start` moves earlier (website form, Excel G edit, or an OVERPAID/HOLDOVER fix) and the previous contract on the unit has `prevCode = this` **or** is `source=inferred`, the previous contract's `end` is set to `start − 1 day` automatically (one audit line each, no overlap flag) and its active payments in months now outside it are re-attributed to this contract (`payment.contractCode` updated, note «انتقلت من T0074 مع تعديل بداية العقد»; the ledger cell moves to this contract's row on the next write — the sum per month never changes). When the previous contract is a confirmed real contract, the move is refused by the form with the two buttons «إنهاء العقد السابق في {start − 1}» (sets its `terminatedOn`) / «إلغاء»; an Excel-made overlap of that kind is `DQ-OVERLAP` with the same two fixes |
| openingBalance | number | no | 0 | رصيد متأخرات سابق (debt before `trackingFrom`) |
| vacatedConfirmed | bool | no | false | شغور مؤكد — set by the HOLDOVER fix «الوحدة فعلًا شاغرة»; turns `ended_pending` into `ended` (unit `vacant` since E + 1) |
| source | enum `web|excel|inferred` | yes | | المصدر: الموقع / الإكسيل / مستنتج |
| confirmed | bool | yes | true (`false` for inferred) | مؤكد: نعم / لا — inferred contracts show «تأكيد» |
| notes, createdAt, extras | | | | ملاحظات = ledger column X |

Identity-snapshot rule: the ledger row shows `contract.rep / repId / taxRef`, never the client's fields directly. When the user edits a client field on the website, the snapshot of each of its contracts is updated **only if the snapshot equalled the client's previous value** (they were in sync); otherwise it is left alone. When the ledger D/I/J changes in Excel, the snapshot is updated; the client's field is updated only if it equalled the snapshot's previous value. Thus الدقة row 7 keeps «وليد محمود مصطفى / 28407140102651» and row 5 keeps «محمد احمد فراج / 28803262100597» forever.

Invariant: contracts on one unit never overlap in days (form blocks with a fix button; an Excel-made overlap is `DQ-OVERLAP`, the later-starting one counts as active).

### 2.6 ContractYear `years` — sheet `سنوات العقد` (authoritative rent schedule)

| field | type | notes |
|---|---|---|
| contractCode | ref | كود العقد |
| n | int ≥ 1 | السنة |
| from | date | من — editable (403/406: anniversary 16 Jan / 11 Jan, increase applied from 1 Mar) |
| to | date | إلى = next.from − 1 day, or `E` for the last |
| rent | number > 0 | الإيجار الشهري |
| source | enum `entered|proposed|inferred` | المصدر: مدخل / مقترح / مستنتج من الإكسيل |
| notes | string | e.g. «مستنتج من خانة يوليو المقسومة» |

Generation (`engine.proposeYears(c)`): `from_1 = start`, `from_n = addYears(start, n−1)` (Feb 29 → Feb 28), `rent_1 = c.rent`, `rent_n = round5(rent_{n−1} × (1 + increasePct/100))` (`round5` = nearest 5 EGP, matches the office: 14,850 → 16,335; 11,000 → 12,100), stop when `from_n > E`. Rows with `source=proposed` are regenerated when `rent`/`increasePct`/`start`/`end` change; `entered`/`inferred` rows are kept. Invariant: segments are contiguous, non-overlapping and cover exactly `[start, E]`; the reader repairs a gap by extending the previous segment and flags `DQ-YEARGAP`.

### 2.7 Payment = electronic invoice `payments` — sheet `المدفوعات`

| field | type | req | default | notes |
|---|---|---|---|---|
| code | `INV-\d{4}-\d{4,}` | auto | `hwm.invoice.YYYY` | رقم الفاتورة; YYYY = year of `period`; printed on the invoice |
| contractCode | ref | yes | | money belongs to the tenancy, never to the unit |
| period | `YYYY-MM` | yes | | الشهر = the ledger column |
| amount | number ≠ 0 | yes | remaining of the month | negative = تسوية (settlement/refund line) |
| paidOn | date | no | today (Africa/Cairo civil date) on the website; '' for migrated / Excel-typed | تاريخ السداد — **the day the money arrived**, not the entry day. The quick-pay form shows it first with the hint «اتدفعت امتى؟ (لو بتسجّل دفعات قديمة غيّر التاريخ)»; bulk collect has one shared date; `createdAt` is the entry day (so «entered on ≠ paid on» is always recoverable). Punctuality (K19) uses dated lines only and excludes lines where `paidOn = createdAt` **and** `createdAt − dueDate > 20 days` (an obvious batch back-entry) — listed in the K19 evidence as «تاريخ إدخال، مش تاريخ دفع» |
| method | enum `''|cash|transfer|cheque|instapay|other` | no | `cash` on the website; '' («غير محدد») from Excel/migration | طريقة السداد |
| ref | string | no | '' | رقم الإيصال / المرجع |
| status | enum `active|void` | yes | active | الحالة: سارية / ملغاة — reconciliation voids, never deletes |
| source | enum `web|excel|migration` | yes | | المصدر |
| notes, createdAt | | | | |

Rule: for every (contract, period) the ledger cell = Σ `amount` of **active** payments; the app never stores a cell value separately. The cell is written as the number `0` when ≥ 1 active payment exists and the sum is 0 (e.g. 14,000 − 14,000 settlement) and left **empty** only when no active payment exists; on read, a `0` typed by the office where no payment exists creates no payment (amount ≠ 0) and is consistent. Periods before `trackingFrom` (history months) accept payments: they reduce `openingBalance` (§5.3) and get `INV-{year of period}-…` numbers from `hwm.invoice.YYYY`; the ledger sheet of that year (e.g. `2025`) is created on the first such write with rows only for contracts that have money in it (§3.2). A single receipt covering several months or several contracts is entered once and split by the form helper (§6.5) into one payment per (contract, period); `payment.split` (§4.5) does the same for an existing line.

### 2.8 DueOverride `overrides` — sheet `استثناءات الاستحقاق`

`{ code: 'D\d{4,}', contractCode, period, amount ≥ 0, reason (required, printed on the invoice and in the cell tooltip), createdAt }` — replaces the computed proration for one month (508 June = 13,500 agreed; free month = 0; quarterly rent = two zero overrides «مدفوع مقدمًا في …»).

### 2.9 Maintenance `maintenance` — sheet `الصيانة`

| field | type | req | default |
|---|---|---|---|
| code | `M\d{4,}` | auto | hwm |
| unitCode | ref | yes | |
| openedOn | date | yes | today (≤ today) — تاريخ البلاغ |
| kind | enum `plumbing|electric|ac|paint|carpentry|elevator|cleaning|finishing|other` | yes | other — سباكة / كهرباء / تكييف / دهانات / نجارة / مصعد / نظافة / تشطيبات / أخرى |
| description | string | yes | |
| cost | number ≥ 0 | no | 0 |
| borneBy | enum `owner|tenant|shared|contractor` | yes | owner — المالك / المستأجر / مناصفة / المقاول |
| status | enum `open|closed` | yes | open — مفتوحة / مغلقة |
| closedOn | date | no | '' — must be ≥ `openedOn` (form rule; Excel-typed violation → `DQ-DATEORDER` medium with «تصحيح»); `openedOn` > today typed in Excel → `DQ-FUTUREDATE` medium (FUTUREPAY's sibling) |
| contractor | string | no | '' — المقاول / الفني |
| invoiceRef | string | no | '' — مرجع فاتورة الصيانة |
| custodianContractCode, custodianClientCode | ref | stored at creation | the contract active on `openedOn` (frozen fact; '' = «الوحدة كانت شاغرة») |
| deductFromDeposit | bool | no | false — خصم من التأمين |
| notes, createdAt, extras | | | |

### 2.10 ReviewFlag `flags` — sheet `المراجعات`

Computed on every read by `flags.js` (§5.8). Only the resolution is user data: `{ id, status: open|confirmed|ignored, officeNote, updatedOn, lastSeen }`. `id = 'DQ-' + RULE + '-' + ref + ('-' + period | cellRef when applicable)` where `ref` is the entity code, or the literal `summary` for summary flags (`DQ-MISSINGPHONE-summary`, `DQ-NODEPOSIT-summary`, `DQ-KINDGUESS-summary`) and the project code for per-project flags (`DQ-TYPEGUESS-P03`) — deterministic, no hash of the detail text, so the id survives wording changes and the office can resolve flags from Excel by changing `الحالة`. A summary flag's text carries the current member count and codes; its resolution applies to the id, so an ignored summary stays ignored when new members appear (each member still shows its own chip on its profile, e.g. «بدون تليفون»). Severity ∈ `critical|high|medium|low|info` = حرجة / عالية / متوسطة / منخفضة / معلومة. Resolution rows whose flag no longer fires are kept with `lastSeen` and shown as «لم تعد تظهر» for 90 days (so a returning flag re-attaches), then dropped on the next write.

### 2.11 Settings `settings` — sheet `الإعدادات` (columns: المفتاح (English key, grey) · الاسم · القيمة · الشرح)

| key | default | الاسم |
|---|---|---|
| schemaVersion | 3 | إصدار تنسيق الملف (layout v3; the old label «إصدار البنية» is read as a synonym) |
| officeName / officeAddress | إيجاري / '' | اسم المكتب / عنوان المكتب |
| graceDays | 5 | أيام السماح |
| dueDay | 1 | يوم الاستحقاق الافتراضي |
| defaultIncreasePct | 10 | نسبة الزيادة الافتراضية % |
| roundTo | 5 | تقريب الإيجار المقترح (جنيه) |
| trackingFrom | 2026-01 | أول شهر متابع |
| enteredThrough | '' (auto) | آخر شهر مُسجَّل (فارغ = تلقائي) |
| enteredThroughPct | 25 | نسبة بداية تسجيل الشهر % (a month with ≥ this share of entries counts as «being entered», which closes the month before it) |
| enteredThroughFullPct | 90 | نسبة اكتمال تسجيل الشهر % (a month with ≥ this share counts as recorded by itself) |
| autoCloseMonths | 2 | إقفال تلقائي بعد (شهور) — a month is recorded at the latest when `cur ≥ month + 2` |
| massChangeCells / massChangePct / massChangeVoids | 20 / 10 / 10 | عتبة التغيير الجماعي (خانات / % / فواتير) (§4.6.6) |
| vacancyDays | 92 | عتبة الشغور الطويل (يوم) |
| toleranceAbs / tolerancePct | 50 / 0.5 | سماحية الفرق (جنيه) / % |
| renewalWindowDays | 90 | نافذة التجديد (يوم) |
| invoicePrefix | INV | بادئة الفاتورة |
| ledgerYears | 2026 | أوراق السنوات |
| pollSeconds / backupEveryMinutes / backupKeep | 2 / 10 / 20 | فترة المراقبة / فترة النسخ / عدد النسخ |
| ledgerTemplateRow | 3 | صف القالب في الدفتر |
| hwm.project, hwm.client, hwm.contract, hwm.maintenance, hwm.asset, hwm.override, hwm.invoice.YYYY, hwm.deposit.YYYY, hwm.claim.YYYY | | آخر كود … / آخر رقم فاتورة YYYY / آخر إيصال تأمين YYYY / آخر مطالبة YYYY (dynamic keys `hwm.invoice.2025`, `hwm.invoice.2027` are created as years appear and always carried) |
| lastWriteAt / lastWriteBy | | آخر حفظ / آخر جهاز |
| assetCatalog | catalog list, **one item per line** in the cell (`\n`, wrapped text) — never comma separated, so «تكييف، أثاث/فرش» stays one item; on read a cell without line breaks is split on `|` only | قائمة الأصول |

**Validation of Excel-typed values** (`settings.read`): digits are folded (`٥` → 5); each key has a type and range — `graceDays` int 0–60, `dueDay` 1–28, `defaultIncreasePct` 0–100, `roundTo` ∈ {1, 5, 10, 50, 100}, `trackingFrom`/`enteredThrough` `YYYY-MM` (or blank for `enteredThrough`), `enteredThroughPct` 1–100, `enteredThroughFullPct` 50–100, `autoCloseMonths` 1–12, `vacancyDays` 1–3650, `toleranceAbs` ≥ 0, `tolerancePct` 0–10, `renewalWindowDays` 1–365, `pollSeconds` 1–60, `backupEveryMinutes` 1–1440, `backupKeep` 1–200, `ledgerTemplateRow` ≥ 3, `ledgerYears` list of 4-digit years, `hwm.*` int ≥ 0 (a value below the max existing code is raised to it), `massChange*` ≥ 0. An invalid value («abc», 400, 0 for `pollSeconds`) → the default is used **and written back**, `DQ-SETTING` (medium) «قيمة «أيام السماح» = 400 مش مقبولة (0–60) — استخدمت 5» with fix «فتح الإعدادات». Unknown keys typed by the office are carried verbatim as `extras` rows (shown in الإعدادات under «مفاتيح غير معروفة»), never dropped.

### 2.12 AuditEntry `audit` — sheet `سجل التعديلات`

`{ seq: integer (column م, 1..), at: 'YYYY-MM-DD HH:MM:SS' **Africa/Cairo civil time** (header «التوقيت (القاهرة)»), device, op: create|update|delete|void|reconcile|migrate|resolve|restore|conflict|reassign|split|renew|settle|close, entity, code, text (Arabic sentence), before (JSON ≤ 1,000 chars), after (JSON ≤ 1,000 chars) }`. The sheet keeps the newest 2,000 rows; older rows are appended to `backups/audit-archive-YYYY.csv` (UTF-8 BOM) and never deleted. Codes never depend on the audit (high-water marks). **Undo does not depend on the 1,000-char cap**: every command's full `before` state (the complete records it touched, including years/extras/payments of a bulk collect) is kept in IndexedDB `egary.undo` for the session (last 50 commands); the 8-s «تراجع» restores from there, and the sheet's truncated JSON is for humans only (truncated values end with «…»).

### 2.13 Codes

| entity | format | example | generation |
|---|---|---|---|
| project | `P` + ≥2 digits | `P01` بابل, `P02` محيي الدين, `P03` ابو بكر | `max(hwm.project, maxExisting) + 1` |
| unit | `{projectCode}-{unitKey}` | `P03-304`, `P01-S1`, `P01-S2`, `P01-M1-2` (ميزان 1/2), `P01-M3`, `P01-F2` (الدور الثاني), `P01-O42`, `P01-O61`, `P02-M1`, `P03-G5` (جراج 5) | `codes.unitCode(state, projectCode, label)`: numeric label → digits; `ميزان n`→`M`+n (`/`→`-`); `محل`→`S`+n; `مكتب n`→`O`+n; `جراج|موقف n`→`G`+n; `الدور الثاني`→`F2`; `عيادة n`→`K`+n; else `U`+n; missing n → 1; taken → bump trailing number |
| client | `C` + ≥3 digits | `C001` | hwm |
| contract | `T` + ≥4 digits | `T0001` | hwm |
| invoice | `INV-YYYY-` + ≥4 digits | `INV-2026-0137` | `hwm.invoice.YYYY` (per period year) |
| maintenance | `M` + ≥4 digits | `M0001` | hwm |
| asset | `A` + ≥4 digits | `A0001` | hwm |
| due override | `D` + ≥4 digits | `D0001` | hwm |
| review flag | `DQ-RULE-ref[-period]` | `DQ-TEXTCELL-T0063-2026-08`, `DQ-NODEPOSIT-summary` | deterministic (§2.10) |
| deposit receipt | `DEP-YYYY-` + ≥4 digits | `DEP-2026-0001` | `hwm.deposit.YYYY` |
| audit | integer sequence (column م) | `1`, `2`, … | sequence, never reused |

Rules: (0) **assignment order at migration** (`migrate.js`): projects in order of first appearance in column B (`P01` بابل, `P02` محيي الدين, `P03` ابو بكر); clients `C001…C065` in order of the first ledger row of each identity; units in ledger row order; contracts `T0001…T0073` for the 73 ledger rows **in row order**, then `T0074…T0086` for the 13 inferred prior contracts in the row order of their real rows (so the office's row keeps the lower, «main» code and `prevCode` of `T0011` is `T0074`, …; T-C-01's «`T0086` is the last code» holds); invoice numbers are row-major over the **written** sheet (inferred rows at their inserted position above their real row), i.e. `INV-2026-0001` = row 3 January, and the Jan–Apr cells of row 13 (now on the inferred row inserted above it) are numbered before that row's May–Aug cells; (1) a code is assigned once, at creation or migration, and written to every sheet the entity appears in; padding is a minimum, never a cap; (2) `next = max(hwm in الإعدادات, max existing in workbook) + 1`, the hwm is written back on every write, so a deleted code is never reused even after audit archiving; (3) comparison always via `foldCode()` (Arabic-Indic/Persian digits → ASCII, whitespace stripped, upper-case); (4) a code cell edited by hand to an unknown value: natural key matches an entity → original code restored on the next write + `DQ-CODEEDIT`; matches nothing → treated as a new row (new code), never a rename; (4b) **duplicate code in one read** (the copy-paste habit: a ledger row duplicated with its Y..AA and then edited): the row whose natural key matches the contract keeps the code; every other row carrying it is treated as a **code-less new row** (new client/unit/contract codes generated and written over the copied Y..AA on the next write) + `DQ-CODEEDIT` (info) «الصف 77 كان ناسخ كود T0012 — اتعمل له كود جديد T0087 [فتح]»; if two rows both match the natural key (a true duplicate) the lower one is `DQ-UNRESOLVED` «صف مكرر» and kept verbatim; the same rule applies to `INV-` numbers in `المدفوعات` and codes in every master sheet; (5) `codes.kindOf(code)` routes a code typed in search to its profile.

Rows without a code (hand-typed in Excel), matched on every read, then given a code on the next write:

| sheet | natural key | if no match |
|---|---|---|
| `2026` ledger | (project name, unit label, client identity §2.4, start ± 3 days) | create client (identity rule) + unit (project + label, type/floor inferred, `DQ-TYPEGUESS`) + contract (`source=excel`, rent = mode of full-month amounts ≥ start else first amount else `DQ-NORENT`) + payments for numeric cells; `DQ-NEWROW` (info) «أضفت عقد جديد من الإكسيل: … [فتح]» |
| `العقود` | (unitCode, clientCode, start) | new contract |
| `العملاء` | identity rule | new client |
| `الوحدات` | (projectCode, normalised label) — unless the candidate's contracts overlap the row's period and share a paid month (two physical units) | new unit |
| `المشاريع` | normalised name | new project |
| `المدفوعات` | (contractCode, period, amount, paidOn) — used **only** for rows without an `INV-` code; a row with a known code is that payment and its edited fields are updates (§3.7) | new payment (ledger cell recomputed); an unknown contract code → `DQ-UNRESOLVED` «فاتورة بكود عقد مش موجود T0999» kept verbatim, no payment, fix «ربط» (pick the contract) |
| `الصيانة` | (unitCode, openedOn, description) | new ticket |
| `أصول الوحدات` | (unitCode, item) | new asset |
| `استثناءات الاستحقاق` | (contractCode, period) | new override |
| `سنوات العقد` | (contractCode, n) | a new year row: its `من` must lie inside `[start, E]` and after the previous row's `من`, else `DQ-YEARRANGE` (medium) and the row is ignored; a valid new row cuts the segment it falls in at `من − 1` (like the 403 split) and is marked «مدخل»; a deleted row → the gap is re-proposed and `DQ-YEARGAP` |
| `المراجعات` | id (column كود المراجعة) | rows with unknown ids are carried and ignored |
| `الإعدادات` | key (column المفتاح) | unknown keys carried as `extras` |

### 2.14 Relationships and referential rules

Project 1—n Unit 1—n Contract n—1 Client; Contract 1—n ContractYear, 1—n Payment, 1—n DueOverride; Unit 1—n UnitAsset, 1—n Maintenance; Maintenance n—1 Contract/Client (custodian, frozen); Contract 0..1 → prevCode → Contract (same unit). Delete rules (modal explains): a project with units, a unit with contracts, a client with contracts → blocked («احذف/انقل … الأول»); a contract with active payments → cascade allowed only with the checkbox gate (§6.6): payments become `void`, invoice numbers stay reserved; maintenance keeps its frozen custodian codes even if the contract is deleted (shows «عقد محذوف T0012»).

---

## 3. Workbook layout (`Egary.xlsx`)

Base: integrity-first §3 (round-trip table, rows-with-money always emitted, computed dues sheet, warning-style validations, conservative inferred starts). Grafts: excel-bi (patch the loaded workbook in place, clone styles from `ledgerTemplateRow`, office number/date/text formats, hidden `القوائم`, `الحالة` as a value in `العقود`, `طريقة الحساب` note, office-copied year sheets), user-first (existing rows keep their position, append at the end of the project block, never write a money cell not read as numeric or created by the app). Fixes: counts 86/13/509/65; 73 → 86 split announced in the preview and marked in the notes column; carried sheets are patched through ExcelJS's model (what survives is the verified list of §3.6, not «XML unchanged»).

### 3.1 Global

Sheet order: `2026` (then `2027`, …) · `ملخص المشاريع` · `المشاريع` · `الوحدات` · `أصول الوحدات` · `العملاء` · `العقود` · `سنوات العقد` · `المدفوعات` · `استثناءات الاستحقاق` · `الصيانة` · `المراجعات` · `الإعدادات` · `الاستحقاقات` (computed) · `سجل التعديلات` · `القوائم` (hidden). Workbook view RTL; active tab = the current year's ledger; `wb.calcProperties.fullCalcOnLoad = true`; `creator = 'Egary'`, `lastModifiedBy = device label`.
All owned sheets: `views[0] = { rightToLeft: true, state: 'frozen', … }`; header row bold white on `FF1F4E78`, height 28, wrap, centred; code columns fill `FFF2F2F2`, font 9 pt `FF7F7F7F`, header comment «ثابت — يولّده البرنامج، ما تعدّلوش»; computed columns fill `FFEDEDED` with header suffix `(محسوب)` (superseded in layout v3 by the green-formula / grey-«(من البرنامج)» convention — see the note under §3.4); money `#,##0.00`; dates `dd/mm/yyyy`; ids/phones/codes/months `@`; AutoFilter on the header row. Tab colours: ledger years `FF2E7D32`, masters `FF1F4E78`, money `FFB45309`, computed/system `FF6B7280`. Headers are matched on read by `normalize()` (so «ابريل» = «أبريل»); **column order is irrelevant on read**; the office's spellings are written back. Write = patch the last-loaded ExcelJS workbook in place (§4.3): only the app's own cells are written; everything else in a row (extra columns, the office's formulas or fills in them) is left untouched.

### 3.2 Ledger year sheets `2026`, `2027`, … (the sheet the office knows)

| col | header (row 2) | content on write |
|---|---|---|
| A | م | 1..n, renumbered |
| B | المشروع | project.name |
| C | الاسم | client.name |
| D | الممثل القانوني | contract.rep (snapshot) |
| E | الوحدة | unit.label |
| F | العنوان | project.address |
| G | العقد من | contract.start (date, `dd/mm/yyyy`) — **blank** for `source=inferred` contracts whose start is unknown (`confirmed=false`): the app never invents a date into the office's sheet; X carries «عقد سابق — البداية غير معروفة (قبل 2026) — اكتبها هنا لو عندك العقد الورقي». The office typing a real date (e.g. 01/05/2025) into G is accepted: `start` := that date, months before `trackingFrom` become `history`, the flag text updates, `confirmed` still waits for «تأكيد» |
| H | العقد الى | contract.end (date) — for an inferred contract this is `real.start − 1 day`, derived from the office's own G of the real row, so it is written |
| I | تسجيل ضريبي | contract.taxRef (text) |
| J | الرقم القومي / الباسبور | contract.repId (text `@`) |
| K..V | يناير, فبراير, مارس, ابريل, مايو, يونيو, يوليو, اغسطس, سبتمبر, اكتوبر, نوفمبر, ديسمبر | Σ active payments of (contract, month) (`0` when payments exist and sum to 0, §2.7); empty when none; **unparseable text carried verbatim**; a formula typed by the office (`=6000+6705`) is read through its cached result and **replaced by the number** on the next write (audit «استبدلت معادلة K12 بقيمتها 12,705»; README rule 7) |
| W | الاجمالي | `=SUM(K{r}:V{r})` with cached result |
| X | ملاحظات | contract.notes |
| Y | كود العقد | `T0001` (grey) |
| Z | كود الوحدة | `P03-304` (grey) |
| AA | كود العميل | `C041` (grey) |

Row 1: `K1` = the year as text, merged `K1:V1`, bold 14 (preserved). Row 2 headers (preserved; Y..AA appended at the first empty header column). Rows 3..n: one row per contract whose effective period touches the year **plus** any contract with active payments in that year (money never disappears from the sheet). Totals row n+1: `C = الاجمالي العام`, `K..W = =SUM(K3:K{n})`… with cached values, fill `FFD9D9D9` bold; the office editing the totals formulas → overwritten on the next write (owned cells), logged once. **Below the totals row** everything the office writes is carried verbatim (values, styles, formulas) and shifts down when rows are appended above the totals (references re-based, §3.6); the app never writes there.
Row order: existing rows keep their position; a new contract is inserted **after the last row (top to bottom) whose B equals its project** (non-contiguous or sorted blocks: the last occurrence wins; no row for the project → above the totals row); on migration an inferred prior contract is inserted immediately above its real contract's row (like the office's own 204/304 pairs); a row is removed only when its contract was deleted on the website or no longer touches the year **and** has no active payments in it. Every insert/removal goes through `rebase.js` so office formulas, conditional formats, validations, merges and defined names that reference rows at or below the point are shifted (§3.6). Unresolved rows (§3.6) stay where they are, verbatim. **Hidden rows**: ExcelJS keeps `row.hidden` but not AutoFilter criteria, so after a write Excel shows the filter arrow without the criteria while the rows stay hidden; the app keeps hidden flags as loaded, never hides a row it appends, and when ≥ 1 ledger row is hidden shows `DQ-HIDDENROWS` (info) «فيه N صف مخفي في ورقة 2026 (فلتر أو إخفاء) — لو مش لاقي عقد، شيل الفلتر» (a cleared filter is the office's two clicks).
Styles: new rows clone every cell style of `settings.ledgerTemplateRow` (`row.getCell(c).style = {...template.getCell(c).style}`) so they are yellow `FFFFF2CC` like the office's; formats `#,##0.00` on K..W, `dd/mm/yyyy` on G/H, `@` on I/J/Y/Z/AA. Widths: the owner's kept; Y..AA = 11. Freeze `F3` (xSplit 5, ySplit 2; replaces the accidental `P58`, logged once). AutoFilter `A2:AA{n}`.
Data validation (warning style, never blocks a deliberate entry): K..V `decimal ≥ 0`, `allowBlank`, `errorStyle: 'warning'`, title «رقم من فضلك», error «الخانة دي للمبالغ — لو عايز تكتب ملاحظة استخدم عمود ملاحظات»; G/H `date` warning; Y `list` `=العقود!$A$2:$A$2000` warning. No status colouring in Excel (lives on the website).
Future years: `2027` is created on the first write when today ≥ 2026-12-01 or any payment has a 2027 period; same layout, every contract touching 2027. Past years (`2025`) are created the same way when a history-month payment is recorded (§2.7), with rows only for contracts that have money in that year, placed before `2026` in the sheet order. The reader also accepts a sheet the office copied by hand: any 4-digit-named sheet whose header row contains `المشروع`, `الاسم`, `يناير`; on the first write its totals/W formulas are normalised and the change is logged.

### 3.3 `ملخص المشاريع` (kept; live columns added beside it)

A..C as the owner has them with two announced touches: ranges rewritten to the real last row, and **B1 renamed** from «عدد الوحدات» to «عدد الصفوف (عقود)» with a header comment «كان «عدد الوحدات» — بيعد صفوف دفتر 2026 (86 بعد تقسيم 13 صف لعقد سابق + عقد حالي، وكان بيعد 73 صف لـ 71 وحدة قبل كده)؛ عدد الوحدات الحقيقي في العمود E» (one audit line at migration; the preview card mentions it). `A` المشروع, `B` `=COUNTIF('2026'!$B$3:$B${n},A2)`, `C` الاجمالي `=SUMIF('2026'!$B$3:$B${n},A2,'2026'!$W$3:$W${n})`, last row الاجمالي `=SUM(...)`. Column D blank (spacer). Added block, non-volatile and auditable from Excel: `E` وحدات مسجلة `=COUNTIF(الوحدات!$C:$C,A2)`; `F` مؤجرة اليوم (محسوب) value; `G` شاغرة اليوم (محسوب) value; `H` المتأخرات `=SUMIFS(الاستحقاقات!$J:$J,الاستحقاقات!$C:$C,A2,الاستحقاقات!$K:$K,"متأخر")+SUMIFS(الاستحقاقات!$J:$J,الاستحقاقات!$C:$C,A2,الاستحقاقات!$K:$K,"جزئي متأخر")` (J = المتبقي, K = الحالة, C = المشروع in `الاستحقاقات`); `E1..H1` headers with a comment «محسوب عند آخر حفظ: {lastWriteAt}». **Year rollover**: when a new ledger year sheet is created, B/C/H of the live block are re-pointed to the latest year sheet (`'2027'!`), and the previous year's A..C block is preserved by copying it **below** the live block, two blank rows down, as «ملخص 2026» (`A{k}` = «ملخص 2026» bold; then the same rows A..C with the formulas frozen to `'2026'!` ranges — the office's own COUNTIF/SUMIF text with the year substituted — and a totals row); the block is written once and then carried verbatim like office content. Widths A18 B14 C18 E14 F14 G14 H16. Freeze `A2`.

### 3.4 Normalized sheets (headers in order; `*` = code column, grey; `(محسوب)` = overwritten on write, ignored on read)

> **Superseded by layout version 3 (Oct 2026).** The `(محسوب)` suffix is gone from every header. Auto columns are told apart by header colour and a header note: **blue** = typed by the office; **green** = a live Excel formula (Excel recomputes it instantly; the app rewrites it on every save); **grey, header ending in «(من البرنامج)»** = computed by the app on save only (per-contract «المتأخرات» and its roll-ups, «ملخص الأصول»). The English «مفتاح الحالة» columns were removed (the Power BI kit derives the key from the Arabic status text). The authoritative header list is `COLS` in `Egary/assets/js/xlsx/workbook.js` (old headers are read as synonyms, retired ones are ignored), the office-facing description is in `Egary/README-AR.txt`, and the settings sheet carries «إصدار تنسيق الملف» = 3 plus the colour legend «دليل ألوان العناوين». The lists below are the original v2 design, kept for history.

- **المشاريع**: كود المشروع* · اسم المشروع · العنوان · المالك · المنطقة · الترتيب · عدد الأدوار · ملاحظات · تاريخ الإضافة · عدد الوحدات (محسوب) · مؤجَّرة (محسوب) · شاغرة (محسوب) · المتأخرات (محسوب) · محصَّل السنة (محسوب). Freeze `B2`.
- **الوحدات**: كود الوحدة* · كود المشروع* · المشروع (محسوب) · رقم / اسم الوحدة · النوع · الدور · الوصف · المساحة م² · ملاحظات · تاريخ الإضافة · الحالة (محسوب) · المستأجر الحالي (محسوب) · العقد الحالي (محسوب) · الإيجار الحالي (محسوب) · شاغرة منذ (محسوب) · أيام الشغور (محسوب). Validation: النوع list `=القوائم!$A$2:$A$5` (stop style, «اختر النوع من القائمة»), الدور list `=القوائم!$B$2:$B$34` (33 entries: بدروم, أرضي, ميزان, 1 … 30).
- **أصول الوحدات**: كود الأصل* · كود الوحدة* · الوحدة (محسوب) · البند · موجود · العدد · الحالة · التفاصيل · تاريخ التسجيل. Validation: البند list `=القوائم!$L$2:$L$40` (showErrorMessage false — free text allowed), موجود `=القوائم!$H$2:$H$3`, الحالة `=القوائم!$M$2:$M$5`.
- **العملاء**: كود العميل* · الاسم · النوع · الممثل القانوني · الرقم القومي / الباسبور · رقم هوية ثانٍ (مستأجر مشارك) · تسجيل ضريبي · التليفون · تليفون آخر · البريد الإلكتروني · العنوان · ملاحظات · تاريخ الإضافة · عدد العقود (محسوب) · عقود سارية (محسوب) · المتأخرات (محسوب) · إجمالي المسدَّد (محسوب) · الانتظام (محسوب). النوع list `=القوائم!$N$2:$N$3`. Id/tax/phone columns `@`.
- **العقود**: كود العقد* · كود الوحدة* · كود العميل* · المشروع (محسوب) · الوحدة (محسوب) · العميل (محسوب) · الممثل القانوني · رقم هوية الممثل · التسجيل الضريبي · العقد من · العقد الى · الإيجار الشهري (السنة الأولى) · الزيادة السنوية % · نظام السداد · يوم الاستحقاق · التأمين · حالة التأمين · تاريخ استلام التأمين · تاريخ تسوية التأمين · المردود من التأمين · المخصوم من التأمين · العقد السابق* · تاريخ الإنهاء المبكر · رصيد متأخرات سابق · شغور مؤكد · المصدر · مؤكد · ملاحظات · تاريخ الإضافة · الحالة (محسوب) · الإيجار الحالي (محسوب) · المسدَّد (محسوب) · المتأخرات (محسوب) · أيام متبقية (محسوب). Validations: حالة التأمين `=القوائم!$D$2:$D$6`, المصدر `=القوائم!$J$2:$J$4`, مؤكد `=القوائم!$H$2:$H$3`, يوم الاستحقاق whole 1..28, dates date-typed. `الحالة (محسوب)` values (list `=القوائم!$Q$2:$Q$10`, so the column is filterable and the typed set is closed): مستقبلي / ساري / ينتهي خلال 90 يوم / منتهٍ — مُجدَّد / منتهٍ — أُعيد تأجيرها / منتهٍ — في انتظار التجديد / منتهٍ بلا تجديد / مُنهى مبكرًا / تواريخ غير صحيحة. The office typing a status here (e.g. «منتهٍ» to end a contract) is overwritten on the next write and gets `DQ-COMPUTEDEDIT` (info) «غيّرت «الحالة (محسوب)» للعقد T0012 — دي خانة محسوبة؛ لإنهاء العقد اكتب «تاريخ الإنهاء المبكر»» with fix «إنهاء مبكر»; the same rule (overwrite + hint) applies to every `(محسوب)` column, the hint text naming the editable field that drives it. نظام السداد list `=القوائم!$R$2:$R$5`.
- **سنوات العقد**: كود العقد* · السنة · من · إلى · الإيجار الشهري · المصدر · ملاحظات. المصدر list `=القوائم!$O$2:$O$4`. Editing a rent or `من` here marks the row «مدخل».
- **المدفوعات**: رقم الفاتورة* · كود العقد* · المشروع (محسوب) · العميل (محسوب) · الوحدة (محسوب) · الشهر · المبلغ · تاريخ السداد · طريقة السداد · رقم الإيصال / المرجع · الحالة · المصدر · ملاحظات · تاريخ التسجيل. الشهر text `@` (`2026-07`); طريقة السداد `=القوائم!$C$2:$C$7`; الحالة `=القوائم!$I$2:$I$3`; المصدر `=القوائم!$K$2:$K$4`.
- **استثناءات الاستحقاق**: الكود* · كود العقد* · الشهر · المستحق المتفق عليه · السبب · تاريخ الإضافة.
- **الصيانة**: كود الصيانة* · كود الوحدة* · المشروع (محسوب) · الوحدة (محسوب) · تاريخ البلاغ · التصنيف · الوصف · التكلفة · يتحملها · المقاول / الفني · مرجع الفاتورة · الحالة · تاريخ الإغلاق · كود العقد وقتها* · كود العميل وقتها* · المستأجر وقتها (محسوب) · خصم من التأمين · ملاحظات · تاريخ الإضافة. Lists: التصنيف `=القوائم!$E$2:$E$10`, يتحملها `=القوائم!$F$2:$F$5`, الحالة `=القوائم!$G$2:$G$3`, خصم من التأمين `=القوائم!$H$2:$H$3`.
- **المراجعات**: كود المراجعة · القاعدة · الخطورة · الكيان · الكود المرجعي · الورقة/الخلية · النص الأصلي · الوصف · الإجراء المقترح · الحالة · ملاحظة المكتب · تاريخ الاكتشاف · تاريخ التحديث · آخر ظهور. Only الحالة (`=القوائم!$P$2:$P$4`: مفتوحة / تم التأكيد / تم التجاهل) and ملاحظة المكتب are read back. الخطورة values (`=القوائم!$S$2:$S$6`): حرجة / عالية / متوسطة / منخفضة / معلومة (the DAX measure filters on «حرجة»). Severity fills: critical `FFFBE3E3`, high `FFFDEADF`, medium `FFFFF3D1`, low/info none.
- **الإعدادات**: المفتاح* · الاسم · القيمة · الشرح (one row per key of §2.11).
- **الاستحقاقات** (computed, Power BI fact table and the human proof): كود العقد · كود الوحدة · المشروع · الوحدة · كود العميل · العميل · الشهر · المستحق · المسدَّد · المتبقي · الحالة · تاريخ الاستحقاق · أيام التأخير · طريقة الحساب · محسوب في. One row per (contract, tracked month) from `max(trackingFrom, start)` to `min(E, currentMonth + 12)` **plus** one row per (contract, month) that has active payments but no due — `outside`/orphan months, history months and every paid month of an `invalid` contract — with المستحق 0 and الحالة «خارج العقد» / «قبل بداية المتابعة» / «تواريخ غير صحيحة» — so that `SUM(الاستحقاقات[المسدَّد])` equals the website's K01 for every month and nothing in `المدفوعات` is invisible to Power BI. `طريقة الحساب` = «30/30 × 16,335» or «15/30 × 8,775 + 15/30 × 14,000» or «استثناء: 13,500 (اتفاق أول شهر)». الحالة uses the Arabic labels of §5.3 (متأخر / جزئي متأخر / … ). Fixed column letters (used by the §3.3 formulas): A كود العقد · B كود الوحدة · C المشروع · D الوحدة · E كود العميل · F العميل · G الشهر · H المستحق · I المسدَّد · J المتبقي · K الحالة · L تاريخ الاستحقاق · M أيام التأخير · N طريقة الحساب · O محسوب في.
- **سجل التعديلات**: م · التوقيت · الجهاز · العملية · الكيان · الكود · الوصف · قبل · بعد. Newest first.
- **القوائم** (hidden, `ws.state = 'hidden'`): A النوع (تجارية, سكنية, إدارية, جراج) · B الدور (بدروم, أرضي, ميزان, 1 … 30) · C طريقة السداد (نقدي, تحويل بنكي, شيك, إنستاباي, أخرى, غير محدد) · D حالة التأمين (غير مسجّل, محتفظ به, مردود, مخصوم, بدون تأمين) · E تصنيف الصيانة · F يتحملها (المالك, المستأجر, مناصفة, المقاول) · G الحالة (مفتوحة, مغلقة) · H نعم/لا · I حالة الدفعة (سارية, ملغاة) · J مصدر العقد (الموقع, الإكسيل, مستنتج) · K مصدر الدفعة (الموقع, الإكسيل, ترحيل) · L الأصول (catalog) · M حالة الأصل (جديد, جيد, يحتاج صيانة, تالف) · N نوع العميل (فرد, شركة) · O مصدر السنة (مدخل, مقترح, مستنتج من الإكسيل) · P حالة المراجعة · Q حالة العقد (the 9 labels above) · R نظام السداد (شهري, ربع سنوي, نصف سنوي, سنوي) · S الخطورة (حرجة, عالية, متوسطة, منخفضة, معلومة). Regenerated on every write.

Mirror/computed columns are written for humans and Power BI and ignored on read; codes are the truth.

### 3.5 Formulas and cached values

Only these formulas exist in owned sheets, all rewritten with cached results on every write: ledger `W{r}=SUM(K{r}:V{r})`, totals `SUM(K3:K{n})…SUM(W3:W{n})`, summary `COUNTIF/SUMIF/SUM/COUNTIFS/SUMIFS`. ExcelJS writes `{ formula, result }`, so Power BI/openpyxl `data_only` readers and the app's own reader see numbers. Office formulas in cells the app owns are replaced **by their cached value** (never by a blank): a formula in a month cell becomes the number it showed (audit line, README rule 7); formulas in extra columns, below the totals row and in unknown sheets are never written by the app, but their **references are re-based** when the app inserts or removes rows (§3.6).

### 3.6 What the website never destroys (carry-over)

**How writing really works**: ExcelJS does not patch XML in place — `load()` builds a model and `writeBuffer()` regenerates every part (sharedStrings, styles, each sheet). «In-place patching» in this spec therefore means *patching the loaded ExcelJS model*, and the carry-over promise is exactly what the ExcelJS 4.4 model round-trips, verified by T-XL-04:

Survives (promised): cell values and types (incl. rich text, booleans, errors, dates), formulas with cached results (incl. shared and array formulas), number formats, fonts, fills, borders, alignment, theme-indexed colours (kept as `{theme, tint}` references), column widths and hidden columns, row heights and hidden rows, outline levels, merges, freeze/split panes and sheet views (RTL, zoom, gridlines), AutoFilter range (**not** its criteria), data validations (standard types), conditional formatting of the standard types (`cellIs`, `expression`, `containsText`, `top10`, `aboveAverage`, `colorScale`, `dataBar` basic, `iconSet` basic, `duplicateValues`, `timePeriod`), defined names, sheet and workbook protection flags, tab colours, page setup / margins / headers-footers / print areas, legacy (VML) notes/comments, images (`xl/media` with their anchors), document properties, sheet order and hidden sheets.

Lost silently by ExcelJS (hence **blocked by the zip guard, §4.4**, so the file is never written): charts, chart sheets, pivot tables/caches, slicers/timelines, sparklines (`x14:sparklineGroups`), `x14` extended conditional formats (data bars with negative fills / custom icon sets), extended data validations (`x14:dataValidations`), threaded comments, form controls / ActiveX / OLE, shapes and text boxes (`<xdr:sp>`, `<xdr:cxnSp>`), external links, query tables / connections, custom XML parts, macros. The promise is the survivor list, not «XML unchanged»; a zip-level patcher that rewrites only owned parts is explicitly **out of scope** for v2 (noted in §9 R31).

Carry-over in owned sheets: unknown columns (`extras` per row keyed by header, header kept, cell untouched); ledger rows that cannot be resolved (no project or unit label, true duplicate rows) — kept verbatim and flagged `DQ-UNRESOLVED`; unparseable cells (value + style); notes column X; the office's ad-hoc fills in owned rows (the app sets values, not styles, on existing cells; styles are cloned only onto new rows); content below the totals row; widths, merges, freeze panes (except the one-time `P58 → F3` fix), AutoFilter range, named ranges, document properties.

**Row insert/removal re-basing** (`xlsx/rebase.js`): ExcelJS's `spliceRows`/`insertRow` do not shift references held elsewhere. Every insert or removal the app performs in an owned sheet therefore calls `rebase.shift(wb, sheetName, atRow, delta)`, which rewrites A1 references in: formulas of every cell in every sheet that point at `sheetName` (in-sheet refs unqualified, cross-sheet refs `'2026'!`, absolute and relative, ranges, whole-column refs untouched), conditional-format `ref` ranges and their formulas, data-validation `sqref`s and formulas, merges, defined names, the AutoFilter range, print areas. The office's `=K5*2` in AB5 becomes `=K6*2` after an insert above row 5; a CF on `K3:V75` becomes `K3:V76`. Residual limitation (README rule 6): references built with `INDIRECT`/`OFFSET` text are not shifted.

### 3.7 Round-trip guarantees for the office's Excel edits

| the office does… | result on the next read/write |
|---|---|
| types/changes a month amount | reconciliation §4.6; the ledger cell wins; payments adjusted, never deleted |
| clears a month cell | that cell's payments become «ملغاة» (void); invoice numbers stay reserved; audit line; undo in the changes drawer |
| types text in a month cell | `DQ-TEXTCELL` critical; text carried verbatim; no payment; cell shows «نص؟» on the website |
| adds a row at the bottom (project, name, unit, dates, amounts) | new contract (+ client/unit if unknown), codes written into Y..AA on the next write; `DQ-NEWROW` banner «أضفت عقد جديد من الإكسيل: علي فرغلي — 301 (محيي الدين) — راجع بياناته [فتح]» |
| edits G/H on a ledger row | contract start/end taken from the ledger (the office's habit); years regenerated (proposed rows only). **G moved later past paid months** (the office's renewal habit: same row, new dates, amounts continue) → not an orphaning but a renewal: the existing contract keeps its code and becomes `end = newStart − 1 day` (its earlier payments stay with it), a successor contract with the new dates and `prevCode` is created and **the row is split like migration step 6** (the old contract's row is inserted above, the office's row carries the successor; announced in the «تعديلات من الإكسيل» card + `DQ-RENEWEDFROMLEDGER` info); payments in months the new period does not cover and that no predecessor covers → `DQ-ORPHANPAY`. **G moved earlier** → linked-adjust rule of §2.5 (previous inferred/linked contract shortened) |
| edits D/I/J on a ledger row | snapshot rule §2.5: contract.rep/repId/taxRef updated; client updated only if it equalled the previous snapshot |
| edits C (client name) on a ledger row | not a snapshot field and client codes are immutable, so: the new name (with the row's I/J) is run through the identity rule — matches an existing client → the contract is **re-pointed** (`contract.reassign`, audit, `DQ-REASSIGNED` info); matches nothing and the old client has **no other ledger row** (this contract is its only one) → the client is renamed; matches nothing and the old client has other rows → a new client is created and the contract re-pointed, `DQ-REASSIGNED` (info) «صف 301: العميل اتغيّر من علي فرغلي (C012) إلى … (C066 جديد) — لو ده تصحيح اسم بس [دمج]». Never a silent rename across other rows |
| edits E (unit label) on a ledger row | (project, normalised label) matches an existing unit → contract re-pointed to it (overlap check → `DQ-OVERLAP` if it clashes); matches nothing and the unit has only this contract → the unit's label is renamed (code unchanged, §2.2); otherwise a new unit is created (type/floor inferred, `DQ-TYPEGUESS`) and the contract re-pointed, `DQ-REASSIGNED` |
| types a formula in a month cell (`=6000+6705`) | read as its cached result; replaced by the number on the next write; audit line |
| types an amount with Arabic-Indic digits, thousands separators, spaces or «ج.م» («١٢٬٧٠٥ ج.م») | parsed per §4.2 step 4; written back as a number |
| deletes a ledger row | the contract is **not** deleted; `DQ-ROWMISSING` (high) «صف العقد T0012 اختفى من ورقة 2026 — رجّعته بفلوسه؛ لو عايز تحذفه فعلًا احذفه من الموقع أو من ورقة العقود»; the row is re-emitted **with its payments** at the end of the project block |
| deletes a row in `العقود` | the contract is deleted, its payments voided, ledger row removed, audit line, backup taken first (this write contains a delete) |
| deletes a row in `المدفوعات` (an `INV-` row vanishes) | **never a silent removal of money**: if the ledger cell of that (contract, month) still equals the old sum → the row is re-emitted and `DQ-PAYROWMISSING` (high) «صف الفاتورة INV-2026-0137 اختفى من ورقة المدفوعات — رجّعته لأن خانة الدفتر لسه فيها المبلغ؛ لو عايز تلغيه غيّر حالته إلى «ملغاة»»; if the ledger cell was cleared/reduced in the same read → the ledger-wins branch applies (void), the flag names both. A backup is taken before either write |
| edits a row in `المدفوعات` that has an `INV-` code (المبلغ / الشهر / كود العقد / التاريخ / الطريقة) | the row **is** that payment: amount → `payment.update` (then the §4.6.3 matrix decides the ledger cell: unchanged ledger → payments win → cell rewritten; both changed → ledger wins + `DQ-CELLCONFLICT`); الشهر → the payment moves month (orphan check); كود العقد → moves contract (unknown code → `DQ-UNRESOLVED` on the row, the payment keeps its previous contract); الحالة «ملغاة» → void. Invoice numbers are never renumbered: an edited رقم الفاتورة whose natural key matches an existing payment is restored + `DQ-CODEEDIT`; one that matches nothing is a new payment with a fresh number |
| copies a ledger row (with Y..AA) and edits name/unit/amounts | duplicate-code rule §2.13 (4b): the copy becomes a new contract with new codes; `DQ-CODEEDIT` info |
| writes a ledger row with a unit label and **no client name** (placeholder for a vacant unit) | the unit is created if unknown (`DQ-TYPEGUESS`); no client, no contract; the row stays verbatim; `DQ-UNRESOLVED` (high) only if it also carries amounts («صف فيه مبالغ من غير اسم عميل — اكتب الاسم [ربط]»); a row with neither name nor amounts is a quiet placeholder (info `DQ-PLACEHOLDER`) |
| types a project name or unit label that nearly matches an existing one («ابوبكر», «ابو بكر », «شقة 304» vs «304») | exact match after `normalize()` wins; otherwise the nearest existing name by Damerau-Levenshtein ≤ 2 on the normalised string, or a label that contains the existing label as a whole token, is **proposed, not applied**: the row is held as `DQ-NEARMATCH` (high) «قصدك «ابو بكر»؟ [دمج في ابو بكر] [لا، مشروع جديد]» and no project/unit is created until answered (so a stray `P04` never reaches the KPIs or the BI); with no near match the row is created normally with `DQ-NEWROW` |
| restores an old backup over `Egary.xlsx`, or saves from a stale copy | mass-change guard §4.6.6: the read is held and a modal asks |
| hides rows / applies an AutoFilter | hidden flags kept, criteria lost on write (ExcelJS), `DQ-HIDDENROWS` info |
| writes below the totals row | carried verbatim; shifted down when rows are appended |
| types a value in `الإعدادات` outside its range or an unknown key | §2.11 validation: default used and written back + `DQ-SETTING`; unknown keys carried |
| sorts rows or reorders columns | harmless; codes/headers identify everything; ledger order is kept as found, normalized sheets keep the found order |
| renames or deletes an owned sheet | missing sheet rebuilt (`DQ-SHEETREBUILT`; per-sheet sources and the restore button in §3.9); a renamed owned sheet is treated as a user sheet (carried) and the owned one recreated |
| adds a column | carried per row in `extras`; untouched on write |
| edits a code cell | `DQ-CODEEDIT`; restored on the next write when the natural key matches |
| edits a `(محسوب)` column | overwritten on the next write (header says so) |
| changes `الحالة` in `المراجعات` | flag resolution stored; the website shows it |
| adds a chart / pivot / slicer / macro | writes disabled (§4.4); export copy offered |
| copies the sheet and names it `2027` | recognised as a ledger year; normalised on the first write; logged |

### 3.8 Migration of the owner's workbook (first import; pure `migrate(wb) → { state, flags, preview }`; nothing written before «ابدأ»)

Trigger: a 4-digit sheet with a header row (first row containing `المشروع`, `الاسم`, `يناير` after `normalize()`) and no sheet `العقود`.
1. **Rows**: data rows = header+1 .. (row whose C = `الاجمالي العام`) − 1, skipping rows where B and C are both empty; month columns = the 12 headers matching `MONTHS_AR` hamza-insensitively; unknown extra columns preserved.
2. **Projects**: distinct B in order of first appearance → `P01` بابل (address F), `P02` محيي الدين, `P03` ابو بكر; `order` = 1, 2, 3.
3. **Units**: key (project, `normalize(E)`); same key + overlapping periods + ≥ 1 common paid month ⇒ two units (بابل «محل» rows 3, 4 → `P01-S1`, `P01-S2`, flag `DQ-DUPLABEL` «وحدتان باسم «محل» — سمّيهم»; the ledger keeps «محل» in E, Z disambiguates); same key non-overlapping ⇒ one unit (204, 304). Floor/type via `codes.parseLabel/inferFloor/inferType`: 3-digit → floor first digit, type admin; `ميزان` → M, admin; `محل` → G, commercial; `مكتب 42` → floor 4, admin; `الدور الثاني` → F2, admin; one `DQ-TYPEGUESS` per project listing its units. Result 71 units.
4. **Clients**: identity rule §2.4 → 65 clients; `kind` inferred per §2.4 (row 31 → company + `DQ-KINDGUESS-summary`); rows 19/20 → one client each + `DQ-COTENANT`; row 52 `567-734-420` → taxId + `DQ-IDFORMAT`; ايجل اي → one client + `DQ-IDVARIANT`; احمد هاشم row 27 → separate client + `DQ-IDVARIANT` with «دمج»; 65 clients without a phone → one `DQ-MISSINGPHONE-summary`, the one client without an id after IDFORMAT → `DQ-MISSINGID-summary` (never 65 separate low flags).
5. **Contracts** (one per row, `source=excel`, `confirmed=true`): start G, end H, rep D, repId J, taxRef I, notes X, dueDay 1, deposit null / `unrecorded` (one summary flag `DQ-NODEPOSIT` «73 عقد بلا تأمين مسجّل», not 73 flags). **End < start** (row 67, 607: 2026-05-01 → 2026-04-30, money Jan–Apr): if `end ≥ last paid month` then `start := end − 1 year + 1 day` = 2025-05-01 (else `end := start + 1 year − 1 day`); `DQ-ENDBEFORESTART` critical quoting the original dates; original dates appended to `notes`; the ledger G is rewritten on the first write (the row mirrors the contract — no flip-flop); unit 607 vacant since 2026-05-01. Every contract gets `paySchedule = monthly`.
6. **Inferred prior contracts**: rows with numeric amounts in months < `periodOf(start)` (13 rows: 13, 14, 24, 26, 27, 29, 30, 49, 50, 58, 59, 65, 66) → a contract `source=inferred, confirmed=false`, same unit + client + rep snapshot, `start = settings.trackingFrom` first day internally (2026-01-01 — a sentinel, **never written to G**, §3.2), `end = real.start − 1 day`, `rent` = mode of those amounts, one year row `source=inferred`, `prevCode` set on the real contract, `notes` = «عقد سابق مستنتج من مبالغ قبل بداية T00xx — البداية غير معروفة (قبل 2026) — اكتبها في العمود G لو عندك العقد الورقي», flag `DQ-PRIORCONTRACT` (high) with buttons «تأكيد» / «تعديل». Rows 29/30 (107/108): June 8,000 > 6,000 → the inferred contract's June is `overpaid` (credit 2,000 on the prior) + `DQ-OVERPAID` «يونيو 8,000 أعلى من إيجار العقد السابق — العقد الجديد بدأ في يونيو؟» whose fix «العقد الجديد بدأ في يونيو» = `contract.update(real, { start: 2026-06-01 })` with the **linked-adjust rule** (§2.5): the inferred prior's end becomes 2026-05-31, the June payment is re-attributed to the real contract (its cell moves to the real row on the next write; the row's G becomes 01/06/2026 and the original 01/07/2026 is quoted in the notes and audit), June is then `paid` (8,000 = 8,000). The office's other options stay: «تسوية» (credit) / «تأكيد» (keep). 73 → 86 contracts; the preview says so.
6b. **Trailing empty months** (`DQ-TRAILINGGAP`, high, per contract): after step 8, a contract whose tracked months contain ≥ 1 paid month followed by a run of empty months reaching `min(enteredThrough, period(E))` gets one flag quoting the run and its total (rows 39 unit 301 Jun–Aug 51,000; 72 unit 705 Jun–Aug 33,000; 71 unit 704 Aug 11,000; 56 unit 503 Aug 11,195; 73 unit 706 Jul 10,890; 42 unit 304 Feb 2,521.67). The months stay `late` (the ledger says no money arrived; promise 3 forbids hiding it) with the chip «فجوة غير مؤكدة» in every evidence row; fixes: «إنهاء مبكر من {first gap month}» (sets `terminatedOn` = last day of the last paid month → the months become `outside`, the unit `vacant` since the next day, K05 drops), «تسوية نهائية» (§6.7 flow), «متأخرات فعلًا» (resolution confirmed, chip removed), «اتحصّلت — سجّلها» (bulk collect prefilled).
6c. **Holdover** (`DQ-HOLDOVER`, medium, per contract): contracts with `E < today`, no successor and `period(E) ≥ enteredThrough` (the ledger has no completed month after the end — 15 on the owner's file, §0) or whose last month is `overpaid` (مكتب 42) get the status «منتهٍ — في انتظار التجديد/التسجيل» (§5.4) and a flag with fixes «تجديد» (opens the wizard prefilled: start = E + 1, rent = last × (1 + inc); for an overpaid last month the wizard proposes the split of §6.3) / «الوحدة فعلًا شاغرة» (resolution: the unit becomes `vacant` from E + 1 — stored as `contract.vacatedConfirmed = true`, column «شغور مؤكد» in العقود).
7. **Contract-year rents**: for each contract and each anniversary year overlapping the tracked months: rent = mode of amounts in fully covered months (ties → latest); two plateaus inside one anniversary year (403, 406: Jan–Feb old rate, Mar+ new rate) → split the year at the first month of the new plateau (`from := 2026-03-01`, `source=inferred`, `DQ-INCLATE` medium «الزيادة اتطبقت من مارس بدل يناير — صح؟»); only evidence is a split month → solve the unknown side from the cell and **round to `settings.roundTo`**: 401 January (new 37,665 from the 11th, A = 36,025) → `old = round5((A − new×n/30) × 30/o)` = 32,745; 605 July (old 8,775, A = 11,390, August is text) → `new = round5((11,390 − 8,775×15/30) × 30/15)` = **14,005** (not 14,000: the office's cell is the only evidence and reproduces exactly). Both get `source=inferred`, notes «مستنتج من خانة يوليو المقسومة», and `DQ-RENTSOLVED` (medium) «إيجار مستنتج ≈ 14,005 من خانة يوليو — أكّد أو صحّحه» with fix «تعديل الإيجار» (prefilled; 14,000 also reproduces the cell within tolerance so no flag follows the correction). Years with no evidence → `proposed` from the previous × (1 + increasePct) with `≈`. **Observed ratios** come from two sources, both used by K25 and by the increase inference: (i) two consecutive plateaus inside one contract (`years` rows with source ≠ proposed; INCLATE split segments count as one pair old→new, never the Jan→Mar artefact); (ii) **across a `prevCode` link** — `real.rent_1 / prior.rent_last` — labelled «عند التجديد» (rows 13, 14, 24, 26, 27, 29, 30, 49, 50, 58, 59, 65, 66). `increasePct` = the contract's own observed ratio rounded to 0.5 % when (i) exists (10 % rows 7, 10, 22, 23, 38, 47, 48, 51; 15 % row 15; 15 % row 17); else the renewal ratio (ii) when it lies within 0–25 % (row 14: 302 ×1.10 → 10 %; 404 12.5 %; 405 16.5 %; 102 14.5 %; 104 15.5 %; 105 11 %; 505 18 %; 506 12 %) with `source` note «مستنتج من التجديد» and **no** INCDEFAULT; else 10 with `DQ-INCDEFAULT` (low). A ratio outside 0–25 % from either source → `DQ-INCUNUSUAL` (low) «زيادة غير معتادة عند التجديد (61 %) — عقد جديد بسعر جديد؟ [تأكيد]» (rows 13: 61 %, 29/30: 33 %, 65: 59.6 %, 66: 26.7 %) and the default 10 % is used for the proposal; the flag is informational because the two contracts already model the jump.
8. **Payments**: every numeric month cell → `{ source: migration, paidOn: '', method: '', status: active }`, numbered row-major (`INV-2026-0001` = row 3 January … `INV-2026-0509`), attributed to the contract covering that month on that row (inferred or real). R65 → no payment, `DQ-TEXTCELL` critical quoting `63+.0+3+26309` and X65. Variance pass by the normal engine: `DQ-VARIANCE` 302 Aug (37,500 vs 38,500), 503 Jul (11,135 vs 11,195 + the office's note), `DQ-PARTIAL` 105 Aug (1,000 vs 15,000), 508 Jun (13,500 vs 14,400 → «اعتماد المبلغ كمتفق عليه» creates a DueOverride); `DQ-OVERPAID` مكتب 42 Aug (44,090 vs 19,158.33 → «هل جُدِّد العقد؟ [تسجيل تجديد]»); 406 Feb (14,565 vs 14,575) is inside tolerance → no flag.
9. **Notes**: X52/X56 → contract.notes + `DQ-NOTE` (medium) with fix «فتح الصف» (the cell drawer of that row). The paper totals quoted there (115,500 / 78,765) are **not recorded anywhere as money** — no override, no opening balance, no adjustment: an unverifiable number must not create or move money. The note's suggestion for 503 («يوليو ممكن يكون 11,595») becomes actionable through the ordinary paths on that row: edit the July cell to 11,595 (reconciliation adjusts the payment) or «اعتماد المبلغ كمتفق عليه» on the PARTIAL/VARIANCE flag (override 11,135). The flag text repeats the office's sentence verbatim.
10. **Settings** seeded (§2.11), `trackingFrom = 2026-01`, `ledgerYears = 2026`, hwm set (project 3, client 65, contract 86, invoice.2026 509), `enteredThrough` auto = 2026-08.
11. **Audit** line `migrate — 3 مشاريع، 71 وحدة، 65 عميل، 86 عقد (منها 13 مستنتج)، 509 دفعة، N مراجعة` with device label.
12. **Write** (after «ابدأ»): backup `original-*` → add Y..AA, insert the 13 inferred rows (through `rebase.js`, so the office's W formulas and the summary ranges follow), rewrite G67, set freeze/AutoFilter, add the normalized/computed sheets, rename B1 of `ملخص المشاريع` (§3.3) → write → verify.

### 3.9 Re-migration and sheet rebuilds

Trigger: a 4-digit ledger sheet exists and `العقود` is missing (the office deleted the app's sheets, or restored a pre-migration copy of the ledger next to nothing). Two cases:
- **Ledger without Y..AA codes** → ordinary migration (§3.8).
- **Ledger with Y..AA codes** (the office deleted `العقود` and friends) → «إعادة بناء من الدفتر»: a card lists what lived only in the deleted sheets and the newest backups, with the primary button «استرجاع من نسخة احتياطية» (restores the whole workbook from the chosen backup, then re-reads; current file backed up first) and the secondary «إعادة البناء من الدفتر». Rebuild rules: codes in Y..AA are **kept** (hwm = max existing); rows are not re-inferred (a row with a code is one contract; a code-less row goes through the normal new-row path); contracts are rebuilt from G/H/C/D/E/I/J/X and rents from the amounts (step 7); payments from the cells with **new** invoice numbers (the old ones are gone — stated in the card). Per-sheet rebuild source: `المشاريع`, `الوحدات`, `العملاء`, `العقود`, `سنوات العقد`, `المدفوعات` ← derivable from the ledger (lost: unit types/floors/areas, phones/emails, deposits, dueDay, paySchedule, paidOn/method/ref, `terminatedOn`, `openingBalance`, `prevCode` beyond same-client adjacency); `أصول الوحدات`, `الصيانة`, `استثناءات الاستحقاق`, `المراجعات` resolutions, `الإعدادات`, `سجل التعديلات` ← **backup-only** (rebuilt empty, `DQ-SHEETREBUILT` high per sheet naming the newest backup that contains it). `DQ-SHEETREBUILT` for a single missing owned sheet follows the same table: a ledger-derivable sheet is rebuilt from state, a backup-only sheet is rebuilt empty with the restore button.

Everything the office typed survives to the pound; the only cells that change meaning are G67 (quoted in the flag and notes) and the Jan–Jun amounts of the 13 split rows, which move to the inferred row directly above (announced in the preview, visible in notes).

---

## 4. Sync protocol (Excel ⇄ website)

Base: integrity-first §4 (commands with `expect` hashes, single-flight pipeline, verify-after-write, snapshot attribution, 3-way reconciliation, void-not-delete, zip guard). Grafts: excel-bi (`~$` lock-file detection, two-tick stability, polling paused while writing, backup before every write containing a delete, conflicts-drawer wording, SHA-256 echo suppression), user-first (Web Locks/BroadcastChannel single instance, «ماذا تغيّر؟» drawer, yellow line in dirty forms, undo toasts, `beforeunload`, in-place patching, Egyptian copy with one button).

### 4.1 Adapter interface — `assets/js/sync/adapters.js` (the only code that touches a file)

```js
interface FileAdapter {
  kind: 'folder' | 'file' | 'memory' | 'download';
  name: string;                                   // 'Egary.xlsx' (or the chosen .xlsx name)
  canWrite: boolean;
  permission(ask: boolean): Promise<'granted'|'prompt'|'denied'>;
  stat(): Promise<{ lastModified: number, size: number } | null>;   // null = file missing; throws NotFoundError when the folder is gone
  read(): Promise<ArrayBuffer>;
  write(bytes: ArrayBuffer): Promise<void>;       // atomic replace; throws LockedError | PermissionError | IOError
  isLockedByExcel(): Promise<boolean>;            // folder: '~$<name>' exists; others: false
  hasFile(name: string): Promise<boolean>;        // folder validation (index.html, Egary.xlsx, *.xlsm)
  listWorkbooks(): Promise<string[]>;             // *.xlsx in the folder (folder kind only)
  writeBackup(name: string, bytes: ArrayBuffer): Promise<void>;
  listBackups(): Promise<{ name: string, size: number, lastModified: number }[]>;
  readBackup(name: string): Promise<ArrayBuffer>;
  deleteBackup(name: string): Promise<void>;
}
// MemoryAdapter test hooks: setBytes(bytes, { lastModified }), setLocked(bool), setMissing(bool),
//   failNextWrite(error | 'truncate'), getBytes(), writes (count), log[] ({ op, at })
```

`FolderAdapter` (directory handle in IndexedDB `egary.handles/root`; resolves the workbook by name on every call; `write` = `fileHandle.createWritable({ keepExistingData: false })` → `write` → `close` — Chromium writes a swap file and renames, so Excel never sees a half-written file; `NoModificationAllowedError`/`InvalidStateError` → `LockedError`; `NotAllowedError` → `PermissionError`). `FileAdapter` (single file handle; backups as Blobs in IndexedDB `egary.filebackups`, last 10, downloadable — OPFS is not used). `MemoryAdapter` (tests; Firefox in-memory). `DownloadAdapter` (`<input type=file>` to read, `<a download>` to write).

`SyncController` (`sync/sync.js`) states: `unlinked → linking → ready → reading → writing → locked → conflict → verify_failed → read_only → error`. API: `init({ adapter, decode, encode, applyJournal, onStatus, onExternalChange })`, `link(adapter)`, `unlink()`, `submit(command)`, `flush()`, `pollNow()`, `status()`, `pending()`, `backups`. Events: `sync:status`, `sync:external-change`, `sync:conflict`.

### 4.2 Read path (bytes → state)

0. **Pre-checks on the bytes**: length 0 or < 1 KB, or no `PK\x03\x04` signature → `corrupt` (retry policy below); bytes starting with `D0 CF 11 E0` (OLE: password-encrypted workbook or legacy `.xls`) → `encrypted` state (§1.5), no retry. **Transient-failure policy**: a throw in step 3 or a `corrupt` result is retried silently at 0.5 / 1 / 2 / 4 s (4 attempts, polling paused); still failing → banner «مش قادر أقرأ الملف …» (§1.5), state unchanged, writes paused until a later poll reads successfully (the retry restarts on every `stat()` change and on «حاول تاني»).
1. `hash = SHA-256(bytes)` (`crypto.subtle`, available on `file://` in Chromium; FNV-1a 64 fallback); `hash === lastKnownHash` → stop (our own write echoed, or a resave without changes).
2. `zipguard.scan(bytes)` (§4.4) → `readOnlyReason` or null; `.xlsm` → refuse entirely.
3. `wb = new ExcelJS.Workbook(); await wb.xlsx.load(bytes)`. Owned sheet with `ws.protection`/`wb.workbookProtection` → `readOnlyReason = 'protected'`. `الإعدادات.schemaVersion` > `APP_SCHEMA` → `readOnlyReason = 'newer'`.
4. `workbook.decode(wb) → { state, raw }`: sheets by name, headers by `normalize()`, dates via `getUTC*` of the ExcelJS `Date` after adding 12 h and flooring (immune to ±1 h drift); unknown columns → `extras`; unknown sheets/unresolved rows/unparseable cells → `raw`. Legacy layout → `migrate` (§3.8). **Cell parsing rules** (`util.parseAmount`, `parsePeriod`, `parseId`, `parsePhone`, `parseDate`):
   - amount: number → value; `{ formula, result }` → `result` when numeric (the formula is replaced by the number on write, §3.5); rich text → its concatenated text, then as string; string → fold Arabic-Indic `٠–٩` and Persian `۰–۹` digits, strip spaces/NBSP/thin spaces/tatweel, drop thousands separators `,` `٬` `'`, map Arabic decimal `٫` → `.`, strip a trailing currency token (`ج.م`, `جنيه`, `ج`, `EGP`, `LE`) → `^-?\d+(\.\d+)?$` → number; anything else (`63+.0+3+26309`, a Date, a boolean) → `unreadable` (`DQ-TEXTCELL`); empty string → empty;
   - period (`الشهر`): string `YYYY-MM` → itself; a Date-typed cell (Excel auto-converted «2026-07») → `YYYY-MM` of that date (day ignored); strings `M/YYYY`, `MM/YYYY`, `YYYY/M`, `YYYY-M`, «يوليو 2026», «يوليو ٢٠٢٦», `Jul-26`, `Jul 2026` → parsed with `MONTHS_AR` (hamza-insensitive) / English abbreviations; a number like 45839 (Excel serial typed in a text column) → the serial's month; else `DQ-LISTVALUE`-style flag «شهر غير مفهوم» and the row is carried unresolved;
   - ids / tax numbers: number-typed cell → `String(value)` via `toFixed(0)` (14-digit ids are exact below 2^53), then `foldCode`; a 9-digit number in تسجيل ضريبي → `ddd-ddd-ddd`;
   - phones: number-typed → digits; 10 digits starting with `1` → prefixed `0` (Egyptian mobile), 8–9 digits starting with `2`/`3` → prefixed `0` (landline), else kept; written back as text `@` — no flag, the write normalises;
   - dates in date columns: Date → ISO; string `dd/mm/yyyy`, `d/m/yyyy`, `yyyy-mm-dd` (digits folded) → ISO; serial number → ISO; else `DQ-LISTVALUE`-style «تاريخ غير مفهوم».
5. `reconcile(state, raw.ledger, snapshot)` (§4.6.3), preceded by the **mass-change guard** (§4.6.6): when the attributed change set exceeds the thresholds the read is parked in state `conflict` and the modal of §1.5 decides; nothing is applied until then.
6. `flags.compute(state)` + stored resolutions from `المراجعات`.
7. `stateHash = sha256(canonicalJSON(state minus flags/audit))`; snapshot `{ stateHash, cells: Map<'T0001|2026-08', amount|'text'>, rows: Map<'contracts:T0001', rowHash> }` stored in IndexedDB `egary.snapshot`.
8. `store.replace(state)`; `lastWorkbook = wb`; UI patches regions (§6.12); toast «اتحدّث من الإكسيل — 3 تغييرات [إيه اللي اتغيّر؟]» when triggered by polling (silent on boot). **Zero-change resave** (Excel's save-on-close caused by `fullCalcOnLoad`, a touch by OneDrive): different bytes, different hash, but `stateHash` equal and no attributed cell/row change → no toast, no card, no audit line, no reconciliation; only `lastKnownHash`/`lastModified` are updated.

### 4.3 Write path (state → bytes)

`workbook.encode(state, raw, lastWorkbook) → ArrayBuffer`: when `lastWorkbook` exists, patch it in place — ledger years via `ledger.writeLedger(ws, state, year)` (rows updated cell by cell by code, new rows inserted/appended with cloned styles, orphan rows removed — every insert/removal through `rebase.shift` (§3.6), totals and W rewritten with cached results, Y..AA ensured), normalized sheets patched by code (owned columns written at their found positions, missing headers appended, deleted records' rows spliced, new records appended), computed sheets and `القوائم` regenerated, unknown sheets untouched, `ملخص المشاريع` ranges rewritten; when `lastWorkbook` is null (create-empty, Firefox download) build from the template. Then `wb.xlsx.writeBuffer({ useStyles: true, useSharedStrings: true })`. Byte determinism is not promised (zip timestamps); **state equality after decode** is the contract.

### 4.4 Zip-directory guard (`xlsx/zipguard.js`, reads the zip central directory only)

Part prefixes that force `read_only`: `xl/charts/`, `xl/chartsheets/`, `xl/pivotTables/`, `xl/pivotCache/`, `xl/slicers/`, `xl/slicerCaches/`, `xl/timelines/`, `xl/externalLinks/`, `xl/embeddings/`, `xl/activeX/`, `xl/ctrlProps/`, `xl/queryTables/`, `xl/connections.xml`, `xl/threadedComments/`, `xl/persons/`, `customXml/`, `xl/vbaProject.bin` (refuse entirely). **Content scans** (the guard inflates just these parts with `DecompressionStream('deflate-raw')`, available on `file://` in Chromium ≥ 103): any `xl/drawings/*.xml` containing `<xdr:graphicFrame` (chart/pivot frame), `<xdr:sp` or `<xdr:cxnSp` (shapes, text boxes, arrows — ExcelJS drops them); any `xl/worksheets/sheet*.xml` containing `sparklineGroups`, `x14:conditionalFormattings`, `x14:dataValidations`, `<controls>`, `<oleObjects>` (lost by ExcelJS, §3.6). Reasons are Arabic nouns in the message («رسم بياني», «شكل/مربع نص», «Sparklines», «تنسيق شرطي متقدم», …). Allowed: `xl/media/` images (with their `xdr:pic` anchors) and legacy VML comments — both round-trip through the ExcelJS model. In `read_only` the app still reads, computes and shows everything; writes are disabled, the sync pill says «قراءة فقط», and «حفظ نسخة Egary-export.xlsx» downloads a fresh-template encode so work is never trapped.

### 4.5 Commands, journal, replay, write pipeline

Every website mutation is a command `{ id, at, device, type, payload, expect: { 'contracts:T0001': rowHash, 'cell:T0001|2026-08': amount, … } }`. Types: `project.create|update|delete|merge`, `unit.create|update|delete|merge`, `asset.set|delete`, `client.create|update|delete|merge`, `contract.create|update|delete|terminate|settleDeposit|confirm|reassign|renew|settle|receiveDeposit`, `payment.create|update|void|delete|split`, `payments.bulkCreate`, `override.set|delete`, `maintenance.create|update|close|delete`, `flag.resolve`, `settings.set`, `month.close` (sets `settings.enteredThrough = M` — the «قفل الشهر» button, §5.2), `restore.backup`. Semantics of the added ones: `contract.reassign { code, clientCode?, unitCode? }` (§2.5); `payment.split { code, parts: [{ contractCode, period, amount }] }` — Σ parts = original amount, the original becomes `void` with notes «اتقسمت إلى INV-…», parts are new active payments with new numbers, one audit line (used by the receipt-split helper and by the renewal split of §6.3); `contract.renew { code, start, end, rent, increasePct, paySchedule, splitLastMonth? }` = create successor + `prevCode` + optional `payment.split` of the old contract's last-month cell; `contract.settle { code, waive: [{ period, reason }], depositRefunded, depositDeducted, closeMaintenance: [codes] }` = the «تسوية نهائية» flow (§6.7): zero overrides with the reason for the listed months, `depositStatus` → returned/deducted with amounts, listed open tickets closed, one audit line `settle` with the full before/after; `contract.receiveDeposit { code, amount, on, method }` → `depositReceivedOn`, `deposit`, `held`, `DEP-` number. `store.apply(state, command)` is pure → `{ state', audit[] }` or throws `ConflictError({ key, expected, actual })`. The journal (IndexedDB `egary.journal`) holds commands not yet confirmed written; replay = apply in order on a freshly decoded state. `localStorage egary.meta` mirrors `{ journalCount, snapshotAt, device }` so an evicted IndexedDB is detectable (§1.5 «journal lost»); `navigator.storage.persist()` is requested at link time and its result shown in الإعدادات («التخزين المحلي: دائم / قابل للمسح»).

Pipeline (single-flight mutex; coalescing window 400 ms so a bulk collect is one write):
1. `stat()`; if `lastModified/size` differ from the last read → `read()` (§4.2) → attribute external changes (§4.6.1) → replay the journal; a command whose `expect` no longer matches is rejected → toast «الإكسيل غيّر نفس الخانة اللي عدّلتها — شوف الفرق» opening the conflict drawer (§4.6.4);
2. `encode`;
3. backup of the previous bytes if the last backup is older than `backupEveryMinutes`, or this is the first write of the session, or any command in this write is a `delete`/`void`/`merge`/`restore`;
4. `write(bytes)`; `LockedError` → state `locked`, retry 5 → 10 → 20 → 40 → 60 s (cap), immediate retry when `isLockedByExcel()` flips to false; `PermissionError` → «متابعة» button; `IOError` → banner, journal kept;
5. `stat()` again → remember `lastModified/size` and `lastKnownHash` so the poller ignores our own write;
6. **verify**: `read()` → decode → `stateHash` must equal the encoded state's hash; mismatch → state `verify_failed`, red banner «الحفظ ما اتأكدش — بياناتك محفوظة ومش هتضيع (آخر نسخة 14:02)» with one button «حاول تاني»; journal kept, writes paused;
7. clear the written commands from the journal; snapshot updated; `lastWorkbook` = the verified read-back workbook.

### 4.6 Change detection and conflict rules

**Polling**: `stat()` every `pollSeconds` (2 s) while visible, 10 s while hidden, immediately on `visibilitychange`/`focus` and before any write; paused while `writing`. A change must be stable for **two consecutive ticks ≥ 1 s apart** before reading (Excel/OneDrive write in bursts). Each tick also calls `isLockedByExcel()` → pill «مفتوح في الإكسيل» proactively (writes are still attempted). `stat() === null` → banner «ملف Egary.xlsx مش موجود في المجلد — رجّعته؟» with «إعادة الربط». A `stat()` change whose read yields no attributed change (§4.2 step 8) is silent.

**4.6.1 Attribution** (cell by cell against the snapshot): `rowsChangedInExcel` (row hash differs) and `cellsChangedInExcel` ((contract, period) amount differs). The UI shows a dismissible card «تعديلات من الإكسيل» and the «إيه اللي اتغيّر؟» drawer listing sheet / row / field / old → new with links; the audit sheet gets one `reconcile` line per changed record (before/after).

**4.6.2 Rows without codes**: matched by natural key (§2.13); creations flagged `DQ-NEWROW`; a "normalization write" assigning codes happens right after the read (queued like any command if locked).

**4.6.3 Ledger ⇄ payments reconciliation** (per contract × month; `L` = ledger amount or `null` if text, `P` = Σ active payments, `S` = snapshot cell):
| L vs S | payments vs snapshot | action |
|---|---|---|
| `L === null` (text) | any | carry text, `DQ-TEXTCELL`, payments untouched |
| `|L − P| ≤ 0.005` | — | consistent (includes `L = 0` with payments summing to 0, and `L = 0` typed where no payment exists — no payment is created for 0) |
| L changed | unchanged | **ledger wins**: no payments → create one (`source=excel`, `paidOn=''`, `method=''`); exactly one active → set its amount := L (audit before/after); several → append an adjustment payment `L − P` with notes «تسوية من خانة الإكسيل» (originals and their invoice numbers kept); `L` empty (or cleared to 0 while payments exist) → void all |
| unchanged | changed by an **edit** of an `INV-` row in `المدفوعات` (amount/month/contract/status) | **payments win**: ledger cell rewritten |
| unchanged | an `INV-` row **vanished** from `المدفوعات` | **ledger wins**: the payment is re-emitted (not void), `DQ-PAYROWMISSING` (§3.7) |
| changed | changed | ledger wins + `DQ-CELLCONFLICT` (critical) quoting both and the adjusted invoices |
| no snapshot (first read on this device) | — | ledger wins |

**4.6.4 Website vs Excel on the same record** (`expect` mismatch): the Excel version is already in state when the command replays; the conflict drawer shows per field «قيمة الإكسيل (المعتمدة)» / «قيمتك» with «طبّق قيمتي» (re-issues the command with fresh `expect`) or «سيبها زي الإكسيل». Nothing is ever overwritten unseen.

**4.6.5 Two app instances on a shared drive**: each treats the other's writes as "Excel changed"; `lastWriteBy` names the device in the banner. Each PC links the folder separately (the directory handle lives in that PC's profile), gets its own device label («جهاز 2» when `lastWriteBy` is «جهاز 1»), and its first read runs without a snapshot (ledger wins). Backup names carry the device slug (§4.8) so two PCs never collide on the same second. `original-*` is taken once **per workbook**: skipped when any `original-*` already exists in `backups/`.

**4.6.6 Mass-change guard and field precedence**

*Mass change*: after attribution, if `cellsChangedInExcel > max(settings.massChangeCells 20, massChangePct 10 % × money cells)` **or** the pending actions include > `massChangeVoids` (10) voids **or** > 3 contract deletions, the read is parked (`conflict`), nothing is applied, polling continues (a newer file replaces the parked one), and the modal of §1.5 offers: «استخدم الملف زي ما هو» (apply as an ordinary read — ledger wins), «رجّع آخر نسخة احتياطية» (restore the newest `Egary-*` backup over the file, then read), «شوف الفرق» (the changes drawer in preview mode). The guard never fires on boot without a snapshot (nothing to compare) nor for the migration.

*Field precedence* when the same fact changed in two owned sheets since the snapshot (each pair applies only when both sides changed; a one-sided change simply applies):

| fact | sheets | wins | then |
|---|---|---|---|
| contract start/end | ledger G/H vs `العقود` العقد من/الى | **ledger** (the office's habit) | `DQ-FIELDCONFLICT` (high) quoting both |
| client name | ledger C vs `العملاء` الاسم | `العملاء` renames the client; ledger C is interpreted by the C-edit rule of §3.7 (reassign / new client) | `DQ-FIELDCONFLICT` |
| unit label | ledger E vs `الوحدات` رقم / اسم الوحدة | `الوحدات` renames; ledger E by the E-edit rule | `DQ-FIELDCONFLICT` |
| rep / repId / taxRef | ledger D/I/J vs `العقود` الممثل القانوني / رقم هوية الممثل / التسجيل الضريبي | **ledger** | snapshot rule for the client (§2.5) |
| client rep / ids | `العملاء` vs ledger D/I/J | both apply (different records); the client field follows the ledger only if it equalled the old snapshot | — |
| year-1 rent | `العقود` الإيجار الشهري vs `سنوات العقد` row 1 | **`سنوات العقد`** (authoritative schedule); `contract.rent` := that | `DQ-FIELDCONFLICT` |
| increase % | `العقود` الزيادة السنوية vs `سنوات العقد` rows | `سنوات العقد` rows that are `entered` are kept; the % regenerates only `proposed` rows | — |
| month amount | ledger cell vs `المدفوعات` rows | matrix 4.6.3 | — |
| flag status | `المراجعات` الحالة vs website resolution | the later `updatedOn` | — |
| settings value | `الإعدادات` vs website | **sheet** (the website re-reads before writing) | — |

### 4.7 Lock banner and journal persistence

`locked`: sticky top banner «ملف الإكسيل مفتوح في برنامج Excel — تعديلاتك محفوظة مؤقتًا وهتتكتب لوحدها أول ما تقفله (3 تعديلات)» + «حاول دلوقتي»; the pill shows «في انتظار إغلاق الإكسيل (3)». Success → green «اتحفظ في الإكسيل ✓» for 3 s. Pill states: متزامن ✓ · جارٍ الحفظ… · في انتظار إغلاق الإكسيل (N) · قراءة فقط · مش مرتبط · تعارض · الحفظ ما اتأكدش. Closing the window with a non-empty journal → `beforeunload` «فيه تعديلات لسه ما اتحفظتش في الإكسيل»; the journal survives for the next start (storage persistence requested, loss detected and announced, §1.5).

### 4.8 Backups (`sync/backups.js`)

Folder `backups/` beside the workbook. Names: `original-YYYYMMDD-HHMMSS.xlsx` (once per workbook, never pruned), `Egary-YYYYMMDD-HHMMSS-{device}.xlsx` (before writes per §4.5 step 3; `{device}` = the device label slugged to `[A-Za-z0-9]`/transliterated digits, e.g. `-D1`; a name that still exists gets a `-2` suffix), `before-restore-YYYYMMDD-HHMMSS-{device}.xlsx`. Timestamps are Africa/Cairo civil time. Retention: keep the latest `backupKeep` (20) `Egary-*`, plus the last of each day for 60 days, plus the last of each month; pruning touches only these name patterns. Settings page lists backups with «استرجاع» (modal naming the date; current file backed up first; verify runs after the restore).

### 4.9 Single-instance guard (`sync/lock.js`)

On boot: `navigator.locks.request('egary-main', { ifAvailable: true }, lock => …)`; not granted → the window shows «البرنامج مفتوح في نافذة تانية» with «استخدم النافذة دي بدلها» which posts `{ type: 'takeover' }` on `BroadcastChannel('egary')`; the holder flushes its journal, releases the lock and shows «اتقفل هنا — كمّل في النافذة التانية». Fallback when Web Locks is unavailable: BroadcastChannel ping/pong with a 300 ms timeout. **The BI page takes no lock at all** (it never writes, so there is nothing to protect; a shared request would wait behind the website's exclusive lock whenever both are open — `Open-Egary-BI.bat` next to a running website must just work). The website's «لوحة العرض» button navigates the same tab to `bi.html` (the website releases its lock on unload) and the BI's «فتح في الموقع» navigates back.

### 4.10 Firefox/Safari fallback (import/export mode)

`DownloadAdapter`: «استيراد ملف Egary.xlsx» (file input) → everything works in memory + journal; sticky banner «وضع الاستيراد/التصدير — تعديلات لسه ما اتنزلتش: N» with «تنزيل Egary.xlsx المحدَّث»; re-import = Excel→website (reconciliation against the stored snapshot). No polling.

### 4.11 Test hooks

`window.Egary.test` exists only when `location.search` contains `test=1`: `useAdapter(adapter)`, `pollNow()`, `flush()`, `state()`, `snapshot()`, `journal()`, `kpis(filter)`, `evidence(kpiId, filter)`, `setToday('YYYY-MM-DD')`, `lastWriteBytes()`, `setDevice(label)`. Playwright injects a `MemoryAdapter` with fixture bytes via `page.addInitScript` before navigation. Node tests `require` the browser files through `tests/load.js` (a `window` stub) and call `workbook.encode/decode`, `migrate`, `reconcile`, `store.apply`, `engine.*` directly.

---

## 5. Dues engine and KPI catalog

Base: excel-bi-first §5 (enteredThrough / pending_entry, status machine, evidence objects with drill routes, round5). Grafts: integrity (`kpi.js` returns `{ value, evidence }` with `value = reduce(evidence)` by construction; `paid_late`; `openingBalance`; `DQ-ORPHANPAY`; vacancy ≥ 92 days; segment starting on the 31st = 0 days; partial-in-grace footers; 60 s + Egypt-midnight recompute; «اعتماد المبلغ كمتفق عليه»), user-first (`unreadable` state; balance with overpayment offset and «رصيد دائن»; the split-day tolerance term; «ما فيش تحصيل مسجّل لشهر …» sentence; health rescaling). Fixes: `trackingFrom` cutoff (nothing before 2026-01 is ever late), narrow tolerance (not one day of rent), default report month `min(lastFullMonth, enteredThrough)`, visible enteredThrough override, health score labelled an index and kept off the hero strip.

All engine functions are pure over `(state, today)`, memoised per `(state.version, today)`, invalidated on every commit/read. **Clock**: `today()` = the **Africa/Cairo civil date** of `Date.now()` (`Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' })` → `YYYY-MM-DD`; the test hook freezes it); `paidOn` defaults, `createdAt`, `recordedAt`, `audit.at` (date + `HH:MM:SS`, same zone) and backup names all use it, so between 00:00 and 02:00/03:00 Cairo nothing is «yesterday». UTC is used only for Excel-serial ↔ ISO math and day arithmetic on ISO strings. Statuses are recomputed every 60 s and when the Cairo date flips (checked each minute), which is the only midnight that matters; the spec's §0 header sentence «UTC day math only» means exactly this.

### 5.1 Primitives (`core/util.js`, `core/engine.js`)

`period(d)`, `first(p)`, `last(p)`, `dim(p)`, `addMonths(p, n)`, `addYears(d, n)` (Feb 29 → Feb 28), `daysBetween(a, b)` — all on ISO strings via UTC. `cur = period(today)`, `lastFull = addMonths(cur, −1)`. `MONTHS_AR` with hamza-insensitive matching.

**`normalize(s)`** — one implementation (`util.js`) for identity rule 3, natural keys, header matching, near-match detection and search tokens; never for display. Steps, in order: (1) `String(s)`, Unicode NFKC; (2) remove tashkeel `U+064B–U+0652`, `U+0670`, tatweel `U+0640`, ZWJ/ZWNJ/BOM; (3) fold alef/hamza forms `أ إ آ ٱ` → `ا`, `ؤ` → `و`, `ئ` → `ي`, standalone `ء` removed; (4) `ة` → `ه`, `ى` → `ي`, Persian `ک` → `ك`, `ی` → `ي`, `گ` → `ك`; (5) Arabic-Indic `٠–٩` and Persian `۰–۹` digits → `0–9`; (6) Latin letters lower-cased («شركة HMA» = «شركة hma»); (7) punctuation `/ - _ . , ، ؛ : ( ) « » " ' ' ’ –` → space (so «ميزان 1/2» = «ميزان 1 2», «salon a m» stays three tokens); (8) **personal honorifics stripped when they are a leading token or follow a separator**: `د`, `دكتور`, `دكتورة`, `م`, `مهندس`, `مهندسة`, `أ`, `استاذ`, `الاستاذ`, `الأستاذة`, `السيد`, `السيدة`, `الحاج`, `الحاجة`, `الشيخ` — only when followed by `/`, `.` or a space (rows 14, 17, 18, 32, 33, 34, 37, 46, 59: «د/ دعاء احمد حسن صديق» = «دعاء احمد حسن صديق»); `شركة` and other company words are **never** stripped (they carry identity and drive `kind`); (9) `ال` is not stripped (too lossy); (10) whitespace collapsed to single spaces and trimmed («صالون ايه ام  Salon A M» → «صالون ايه ام salon a m»). `tokens(s) = normalize(s).split(' ')`.

**`foldCode(s)`** — for codes, ids, tax numbers, phones, invoice numbers: NFKC, digits folded as in (5), all whitespace and tatweel removed, Latin upper-cased, `O`/`o` **not** mapped to zero (passports like `O9565826` are real), hyphens kept (`567-734-420`) — search additionally matches the hyphen-less form.

### 5.2 Contract years and the 30-day proration

- Effective end `E = terminatedOn ? min(end, terminatedOn) : end`. Segments = the `years` rows (§2.6).
- **D30 convention** (`frac(seg, p)`): clip the segment to the month: `a = max(seg.from, first(p))`, `b = min(seg.to, last(p))`; `a > b → 0`; full month (`a == first(p) && b == last(p)`) → `30/30` even in February; else `startIdx = (day(a) == 31) ? 31 : min(day(a), 30)`, `endIdx = (b == last(p)) ? 30 : min(day(b), 30)`, `days = max(0, endIdx − startIdx + 1)`, `frac = days/30`. Checks: 605 July (16th) = 15/30 + 15/30; 401 January (11th) = 10/30 + 20/30; 508 June (start 7th) = 24/30; 304 February (end 10th) = 10/30; ميزان 1/2 May (20th) = 19/30 + 11/30; مكتب 42 August (end 19th) = 19/30; February split on the 16th = 15/30 + 15/30; a segment starting on the 31st contributes 0. **Edge cases (all in T-E-02)**: a segment ending on the 30th of a 31-day month (206: 2026-08-30) → `endIdx = 30` → 30/30 (a full month: the office never charges 1/30 less for the 31st); ending on the 29th of a 31-day month → 29/30; ending Feb 27 (non-leap) → 27/30 while Feb 28 → 30/30 (`b == last`); a segment starting Feb 29 (leap) → startIdx 29, `b == last` → 2/30; starting Jan 30 → 1/30; starting on the 31st → 0; a segment that starts and ends inside one month (508 started 06-07 and terminated 06-20) → 7..20 = 14/30; one that starts on the 1st and ends on the 15th → 15/30; a one-day segment on the 31st → 0 (and the next segment starting the 31st also 0 — the day is simply free, documented).
- `dueRaw(c, p) = Σ_seg rent_seg × frac(seg, p)` (2 decimals); `dueMonthly(c, p) = override(c, p) ?? dueRaw(c, p)`; `null` when no segment touches p (contract does not cover it). The new rate starts **on** the anniversary day.
- **Payment schedule** (`c.paySchedule`): `monthly` → `due(c, p) = dueMonthly(c, p)`. `quarterly|semiannual|annual` (window `w` = 3/6/12 months): installment windows start at `period(start)` and every `w` months after it; `due(c, p)` = Σ `dueMonthly` over the window that **starts** at `p` (clipped to `E`), and `0` for the other months of the window (`calc` «قسط ربع سنوي: يوليو–سبتمبر = 3 × 14,000»); overrides apply to the window's first month. Statuses, arrears and the grid treat these months like any other (`due = 0` months are `paid` when nothing is owed and nothing paid — shown as «ضمن القسط» with the window's first month linked). `الاستحقاقات` carries one row per month with the windowed due. K16 and K03 sum the same numbers, so «contracted revenue» is unchanged by the schedule choice.
- `split(c, p)` = more than one segment touches p, or the only one covers < 30 days.
- **Tolerance** `tol(c, p) = max(settings.toleranceAbs 50, settings.tolerancePct 0.5 % × due) + (split ? |rent_after − rent_before| / 30 : 0)`, where a missing neighbour segment (the month is the contract's first or last) counts as rent 0, so the term is one day of the only segment's rent (508 June: 18,000/30 = 600 → tol 672; 900 > 672 → still `partial`). The term is the one-day ambiguity of the office's hand split (row 5: diff 150.67 ≤ 233.77 + 150.33 ✓; 605 July with the solved 14,005: 0 ≤ 56.95 + 174.33 ✓; with a corrected 14,000: 2.5 ✓). It is never one full day of rent for a full month.
- `dueDate(c, p) = first(p) + (min(c.dueDay, dim(p)) − 1) days`; `lateAfter = dueDate + settings.graceDays`; `overdueDays = max(0, daysBetween(dueDate, today))`.
- Tracked months of a contract: `[max(settings.trackingFrom, period(start)) … period(E)] ∩ ≤ cur + 12`. Months before `trackingFrom` are `history` (never due, never late; payments listed); older debt enters only through `openingBalance`.
- `enteredThrough` («آخر شهر مُسجَّل») = `settings.enteredThrough` if set (the «قفل الشهر» button on the ledger toolbar and the dashboard's K09 tile issues `month.close` = that setting), else **auto** = the latest `p ≤ lastFull` satisfying any of: (a) `share(p) ≥ enteredThroughFullPct` (90 %: the month is recorded by itself); (b) `share(addMonths(p, 1)) ≥ enteredThroughPct` (25 %: the office has started the *next* month, so this one is closed); (c) `cur ≥ addMonths(p, autoCloseMonths)` (2: two months later it is closed regardless) — where `share(p) = count(contracts with ≥ 1 active payment in p) / activeContracts(p)`. On the owner's file: August = 56/61 = 91.8 % → (a) → `2026-08` (also (c)). **Why three parts**: a single 25 % threshold flips every untyped cell of the month being entered to `late` in the middle of a batch; with (b) the month being typed is never closed by its own progress, only by the next month's start, by its own completion or by time. Shown everywhere a month is chosen: «آخر شهر مُسجَّل في الدفتر: أغسطس 2026 (تلقائي)» with a link to the setting and the button «قفل شهر {enteredThrough + 1}» (= `month.close` for that month) when `addMonths(enteredThrough, 1) ≤ lastFull` and `share(enteredThrough + 1) > 0` — i.e. the office has begun a completed calendar month that the rules have not closed yet (today: September has 0 entries → no button).

### 5.3 Cell status — `engine.cell(c, p, today) → { status, due, paid, remaining, overdueDays, late, tol, calc }`

```
if p < trackingFrom                            → 'history'       قبل بداية المتابعة
due = due(c, p); if due == null                → 'outside'       خارج العقد     (a payment here → DQ-ORPHANPAY)
if ledger cell is text                         → 'unreadable'    نص؟            (no payment, excluded from arrears, DQ-TEXTCELL)
paid = Σ active payments; remaining = due − paid
if p > cur:                                     (future month — prepaid rent is common)
    if paid == 0                               → 'upcoming'      قادم
    if paid ≥ due − tol                        → 'paid'          مسدَّد مقدمًا   (chip «مقدمًا»; surplus → 'overpaid')
    else                                       → 'partial_in_grace' جزئي — مقدمًا (never late)
if |paid − due| ≤ tol                          → any paidOn > lateAfter ? 'paid_late' (مسدَّد متأخرًا) : 'paid' (مسدَّد)
if paid > due + tol                            → 'overpaid'      زائد           (counts as paid; surplus = credit; DQ-OVERPAID)
if 0 < paid < due − tol                        → today > lateAfter ? 'partial' (جزئي متأخر, late=true) : 'partial_in_grace' (جزئي — ضمن المهلة)
else (paid == 0):
    if today ≤ lateAfter                       → 'due'           مستحق — ضمن المهلة
    elif p > enteredThrough                    → 'pending_entry' بانتظار التسجيل
    else                                       → 'late'          متأخر
```
`calc` = the proration note («19/30 × 45,100 + 11/30 × 49,610» or «استثناء: 13,500 — اتفاق أول شهر»). `invalid` contracts (end < start as typed in Excel after migration) have no segments: every month is `outside` (due `null`), their payments are listed under «تواريخ غير صحيحة» and K03/K05/K16 exclude them until the dates are fixed (`DQ-ENDBEFORESTART`). Arrears contribution of a cell = `max(0, remaining)` when status ∈ {late, partial}; `partial_in_grace`, `due`, `pending_entry`, `unreadable` contribute 0 and are listed separately. A `late` cell that belongs to a `DQ-TRAILINGGAP` run carries `gapUnconfirmed = true` (chip «فجوة غير مؤكدة») so K05 can show the split without changing the number. `openingDue(c) = max(0, openingBalance − Σ active payments in history months)` (payments before `trackingFrom` are «سداد متأخرات سابقة», §2.7); `balance(c) = openingDue + Σ_{tracked p ≤ cur, status ∈ late|partial|paid|paid_late|overpaid} (due − paid)`; `arrears(c) = max(0, Σ late/partial remaining + openingDue)`; `credit(c) = max(0, −balance)` shown as «رصيد دائن», never income, never netted against other months' lateness. Residual dues of ended/terminated contracts (304 Feb 2,521.67; 503 Jul 60 after the tenant leaves) stay in K05 until the office runs «تسوية نهائية» (§6.7) or sets an override — arrears never expire silently; such rows carry the chip «عقد منتهٍ» and K05's evidence groups them last.

### 5.4 Report month and derived statuses

Report month `M` defaults to `min(lastFull, enteredThrough)` (today: August 2026); the navigator never exceeds `cur`. Contract status (one value, first match): `invalid` تواريخ غير صحيحة (end < start) · `future` مستقبلي · `terminated` مُنهى مبكرًا (`terminatedOn` set and passed) · `ending` ينتهي خلال N يوم (`0 ≤ daysBetween(today, E) ≤ renewalWindowDays`, no successor) · `active` ساري · `ended_renewed` منتهٍ — مُجدَّد (a later contract on the unit **with the same client** — `prevCode` or identity) · `ended_relet` منتهٍ — أُعيد تأجيرها (a later contract on the unit with a different client: 304 خالد → سارة) · `ended_pending` منتهٍ — في انتظار التجديد/التسجيل (**holdover**: `E < today`, no successor, not `vacatedConfirmed`, and `period(E) ≥ enteredThrough` or the last tracked month is `overpaid`) · `ended` منتهٍ بلا تجديد (everything else that ended). K14/K20 wording follows: «مُجدَّد» counts as a renewal, «أُعيد تأجيرها» as a re-let (K20 gaps are re-lets and renewals alike, labelled).

Unit status (single value, **precedence**): `arrears` عليها متأخرات (the unit's current or latest contract has `arrears > 0`) › `ending` تنتهي قريبًا › `occupied` مؤجَّرة (a contract covers today) › `holdover` في انتظار التجديد (latest contract is `ended_pending`) › `reserved` محجوزة (future contract only) › `vacant` شاغرة. `hasActiveContract(u)` (a contract covers today, any of the first three) is what K12 counts. `vacantSince = lastEnd + 1 day` (or `unit.createdAt` if never let); `vacancyDays = daysBetween(vacantSince, today)`; long vacancy when `vacancyDays ≥ settings.vacancyDays (92)`; holdover units have `vacantSince = null` until confirmed (then E + 1). Successor = explicit `prevCode` back-link or the earliest later contract on the unit.

### 5.5 KPI catalog — `core/kpi.js`

Every KPI is `kpi(id, F, M, today) → { id, label, value, sub, tone, unit: 'egp'|'count'|'pct'|'days', evidence: { columns, rows, total }, go: route }`. Rule (structural): `value` is computed **from** `evidence.rows` (`reduce`), never separately; every row carries `{ unitCode, contractCode, clientCode, period }` so it can open a profile or the cell drawer; `F` = active filters (project, type, floor, client, status, year, text) applied to the unit set.

| id | label (UI) | value | evidence rows | drill |
|---|---|---|---|---|
| K01 | المحصَّل في شهر M | Σ amount of active payments with `period = M` | invoice, client, unit, amount, paidOn, method | `#ledger/{y}?m=M` |
| K02 | المحصَّل من بداية السنة | Σ K01 over Jan(M)..M | month, due, collected, rate → K01 | ledger |
| K03 | المستحق في شهر M | Σ `due(c, M)` | contract, client, unit, due, calc note, override marker | ledger |
| K04 | نسبة التحصيل | **Σ paid of the K03 rows / Σ due of the K03 rows** (same evidence set as K03: contracts with `due(c, M) ≠ null`; payments on contracts outside K03 — orphan/outside/invalid/future — are not in the numerator, so K04 ≤ 100 % + overpayments only); `null` → «—» when K03 = 0; Δ vs M−1 in points; the tile shows `min(value, 100 %)` with the raw value in the sub when above («103 ٪ — فيه مبالغ زائدة») | K03 rows + paid + status chip | ledger |
| K05 | المتأخرات | Σ arrears contributions over tracked months ≤ cur + Σ openingDue; **as of today, never month-bound**; sub «منها X في N عقود توقف تسجيلها» (gapUnconfirmed rows) and «منها Y لعقود منتهية» | client, unit, month, due, paid, remaining, overdueDays, status, bucket, chips «فجوة غير مؤكدة» / «عقد منتهٍ»; opening balances as «رصيد سابق» rows | `#ledger?st=arrears` |
| K06 | أعمار المتأخرات | K05 rows bucketed 1–30 / 31–60 / 61–90 / > 90 (opening → > 90) | bucket subset | same |
| K07 | أكبر المدينين | K05 grouped by client, top 10 | client, units, months, total, oldest month | `#client/{code}` |
| K08 | من لم يسدّد شهر M | rows with status ∈ {late, partial} (total) + second group {due, partial_in_grace, pending_entry} (no total) | client, unit, due, paid, remaining, chip | cell drawer |
| K09 | بانتظار التسجيل | count of (contract, month ≤ lastFull) with `pending_entry` and Σ their due; sub «الدفتر مسجَّل حتى أغسطس» | contract, month, due | `#ledger?st=pending` |
| K10 | الوحدات الشاغرة | units with status `vacant` (confirmed); sub «+ N في انتظار التجديد/التسجيل · R محجوزة» (holdover and reserved are **not** vacant) | unit, project, type, vacant since, days, last tenant, est. monthly loss «≈» + basis | `#units?st=vacant` |
| K11 | شاغرة أكثر من 3 شهور | K10 rows with `vacancyDays ≥ 92` | same, sorted desc | `#units?st=vacant&min=92` |
| K12 | نسبة الإشغال | units with `hasActiveContract` today (occupied + ending + arrears) / all units (holdover, reserved and vacant in the denominator only); today-based | unit rows with chips | `#units?st=occupied` |
| K13 | عقود تنتهي خلال 30 / 60 / 90 يوم | `0 ≤ daysBetween(today, E) ≤ N`, no successor | contract, client, unit, end, days left, rent, deposit; «تجديد» | `#contracts?st=ending&days=N` |
| K14 | منتهية بلا تجديد | group 1 (the value): contracts with status `ended` (confirmed vacancy); group 2 (listed, not in the value): `ended_pending` holdovers with «تجديد» buttons — sub «+ 15 في انتظار التسجيل» | rows with days since end, months lost, last rent | `#contracts?st=ended` |
| K15 | التأمينات المحتجزة | Σ deposit where `depositStatus = held` (liability); sub «N عقد بلا تأمين مسجّل» (unrecorded) | contract, client, unit, deposit, status, since | `#contracts?dep=held` |
| K16 | الإيراد التعاقدي القادم 12 شهر | Σ_{i=0..11} Σ_c due(c, cur + i) over active **and future (reserved)** contracts — contracted is contracted; sub «منها N عقد مستقبلي»; `invalid` excluded; «≈» when any year is proposed | month, amount, # contracts, in/out → contracts | `#contracts` |
| K17 | الإيراد حسب المشروع / النوع | K03 and K01 of M grouped; share % | group rows → contract rows | filter chip |
| K18 | متوسط الإيجار حسب النوع | `value` = **median** current rent of active contracts (all types); per-type rows show median, mean and count (+ median per m² when ≥ 3 areas known); sub «المتوسط X» | contract rows | `#units?ty=` |
| K19 | انتظام العميل | per client with ≥ 3 qualifying dated payments (§2.7 exclusion): onTime = paidOn ≤ lateAfter; ≥ 90 % منتظم, 60–89 يتأخر أحيانًا, < 60 متعثر; else «غير كافٍ» (never 0); card hidden until ≥ 10 qualifying dated payments exist. `value` = **count of clients rated متعثر** (unit count; sub «N منتظم · M يتأخر أحيانًا من K عميل مقيَّم») | dated payments with delay days | `#client` |
| K20 | فجوات إعادة التأجير | per unit, consecutive contracts: `gap = next.start − prev.E − 1` (renewals and re-lets, labelled); `value` = **median** gap in days over the last 24 months (unit: days); sub «المتوسط X · الأقصى Y · الخسارة ≈ Z» with est. lost ≈ gap/30 × prev last rent | unit, old tenant, new tenant, kind, gap, est. lost | `#unit` |
| K21 | متوسط أيام الشغور | `value` = mean vacancyDays of **current confirmed-vacant** units (K10 rows); sub «تاريخيًا X يوم» = mean of closed gaps (K20) | K10 rows (+ K20 rows in a second group) | `#units?st=vacant` |
| K22 | تكلفة الصيانة | window = **the year of M** (Jan(M)..Dec(M)) unless `F.year` says otherwise; `value` = Σ cost of tickets opened in the window; sub «N مفتوحة · متوسط الإغلاق X يوم» (open count as of today over all time; mean close days over tickets closed in the window); groups by project/borneBy/kind | ticket rows with custodian at the time | `#maintenance` |
| K23 | تنبيه التأخر المتتالي | per contract, the **trailing** streak: consecutive months ending at `min(enteredThrough, period(E))` with status ∈ {late, partial}; alarm when ≥ 2; `value` = **number of contracts in alarm** (unit: count); sub «Σ X ج.م»; rows sorted by Σ remaining | client, unit, months, amount | `#client` |
| K24 | تركّز الإيراد | share of K03(M) from the top client; serious ≥ 35 % | client, amount, share | `#client` |
| K25 | الزيادة السنوية السائدة | `value` = **median** («الوسيط») of observed ratios; sub «الشائع X ٪ · من N ملاحظة»; observed ratios = consecutive non-proposed plateaus inside a contract (an INCLATE split counts once: old plateau → new plateau, never the Jan→Mar artefact) **plus** renewal ratios across `prevCode` links, rows labelled «سنة تعاقدية» / «عند التجديد» | contract rows with increases | |
| K26 | فجوة الإيراد | h1 = K16 months 0–5, h2 = months 6–11; `value` = **h2/h1 as a percentage** (unit: pct); sub «h2 X مقابل h1 Y»; shown when h2/h1 < 0.85 | contracts ending in months 6–11 | |
| K27 | مؤشر الصحة (مؤشر مركّب) | `40 × rate(M) (null → component «لا ينطبق», weights rescaled to 60)` + `25 × occupancy` + `15 × (1 − min(1, bucket90p / max(1, K05)))` + `10 × (1 − min(1, (K13₉₀ + 2·K14) / max(1, activeContracts)))` + `10 × (1 − min(1, openCriticalHigh / 5))`, rounded, clamped 0–100 | explain table: component, points, max, meaning | drawer |
| K28 | المراجعات المفتوحة | `value` = count of open **critical + high** flags (the badge number); sub «+ N متوسطة · M منخفضة» | flag rows | `#reviews` |
| K29 | المسدَّد بعد الموعد | Σ payments with `paid_late` in M and share of K01 | payment rows with delay | ledger |
| K30 | الدخول والخروج القادم | per future month `m` (cur+1 .. cur+12): starts (contracts with `period(start) = m`), ends without successor (`period(E) = m`); `delta(m) = Σ rent₁ of starts − Σ last rent of unrenewed ends`; `value` = Σ delta over the 12 months as **% of current monthly contracted income** (`Σ_c due(c, cur)`), unit pct; rows carry the per-month amounts | contract rows | `#contracts` |

Hero strip (always visible): المحصَّل (M) · المتأخرات · الإشغال ٪ · الشاغرة · بانتظار التسجيل. K27 is a secondary tile labelled «مؤشر مركّب — تقديري», never in the hero strip. Both K05 and K08 print the grace rule in their footers («الجزئي ضمن المهلة مش متأخرات») so they never seem to disagree.

**Month-bound vs as-of-today, and filter semantics** (`kpi.js` declares `basis` per KPI; the UI prints «لشهر أغسطس» or «حتى اليوم» on every tile):

| basis | KPIs | `M` navigation | `F.year` | `F.client` / project / type / floor |
|---|---|---|---|---|
| month-bound | K01, K02 (YTD of M's year), K03, K04, K08, K17, K24, K29 | recomputed for M | ignored (M carries the year) | restricts the contract/unit set |
| as-of-today | K05, K06, K07, K09, K10, K11, K12, K13, K14, K15, K16, K18, K20, K21, K23, K26, K28, K30 | **unchanged** (navigating M back to June never changes arrears or vacancies; the tile says «حتى اليوم») | ignored except K20/K22 windows | restricts the set; `F.client` on unit KPIs keeps units whose current or latest contract is that client's |
| windowed | K22 (year of M), K19 (all dated payments), K25 (all observed ratios) | K22 follows M's year | K22 follows `F.year` when set | restricts the set |
| composite | K27 | rate(M) component follows M; the rest as-of-today | — | — |

**Tone bands** (`tone ∈ good|warn|serious|critical|neutral`): K04 ≥ 90 good, 70–89 warn, < 70 critical; K05 = 0 good, ≤ 50 % of K03 warn, ≤ 100 % serious, > 100 % critical; K06 neutral; K07 neutral; K09 = 0 good, else warn (serious when `cur − enteredThrough ≥ 2`); K10/K11: 0 good, ≤ 10 % of units warn, ≤ 25 % serious, > 25 % critical; K12 ≥ 90 good, 75–89 warn, 60–74 serious, < 60 critical; K13₃₀ > 0 serious, K13₆₀/₉₀ > 0 warn; K14 > 0 serious; K15 neutral (warn when > 25 % of active contracts are `unrecorded`); K16/K17/K18/K20/K21/K22/K25/K30 neutral; K19 متعثر > 0 serious; K23 > 0 critical; K24 ≥ 35 serious; K26 < 85 serious; K27 ≥ 80 good, 60–79 warn, 40–59 serious, < 40 critical; K28 critical/high > 0 serious, else good; K29 ≥ 25 % of K01 warn.

### 5.6 Insight cards (`core/insights.js`; rendered only when the condition holds; each has a one-line «ليه؟» and a drill)

1. collection delta |Δ| ≥ 5 points vs M−1; 2. top-3 units hold ≥ 50 % of arrears; 3. best vs worst project collection (≥ 2 projects with due > 0, spread ≥ 15 points); 4. revenue cliff (K26); 5. vacancy loss «≈ Σ est. monthly» with basis label (confirmed-vacant units only; holdovers never produce a loss estimate); 5b. holdover: ≥ 1 `ended_pending` → «15 عقد انتهى ومفيش تجديد مسجّل في الدفتر — جدّدهم أو أكّد إن الوحدة فاضية» (drill → K14 group 2); 6. renewal peak month when ≥ 5 contracts end in one month («ابدأ التجديد قبلها بـ 90 يوم»); 7. long vacancies (K11 ≥ 1); 8. consecutive-late alarm (K23) — rendered as the red card at the top, not an insight; 9. pending entry, one card, one sentence, exact rule: let `G = { p : enteredThrough < p ≤ lastFull and K01(p) = 0 and K03(p) > 0 }` (months the ledger has not started at all — today `{2026-09}`); if `cur − enteredThrough ≥ 2` → «الدفتر مسجَّل حتى أغسطس — اكتب أرقام سبتمبر» (names `addMonths(enteredThrough, 1)`; when `|G| ≥ 2` it says «أرقام سبتمبر وأكتوبر»); else if `G ≠ ∅` → «ما فيش تحصيل مسجّل لشهر سبتمبر — لو اتحصّل اكتب الأرقام»; the two sentences never render together (the first subsumes the second); a month with K01 > 0 but below the 25 % share is neither (it is «being entered», K09 shows the count); 10. prevailing increase with the count above 15 %; 11. deposits unrecorded (active contracts with `unrecorded` ≥ 1 → «سجّل التأمينات»); 12. re-let gaps > 60 days in the last 12 months; 13. overpayments in the last 3 months («تسويات؟»); 14. data quality (critical flags > 0).

### 5.7 Vacancy-loss basis

Estimated monthly loss for a **confirmed-vacant** unit (never a holdover) = last contract's last-segment rent («آخر إيجار للوحدة»), else mean current rent of active contracts of the same type in the same project («متوسط النوع في المشروع»), else of the same type anywhere («متوسط النوع»), else «—». Accumulated = est × vacancyDays/30.44, uncapped, labelled «تقديري منذ بداية الشغور».

### 5.8 Data-quality rules (`core/flags.js`; id = `DQ-RULE-ref[-period]`; each with Arabic text and a fix button)

| rule | sev | fires when | fix |
|---|---|---|---|
| TEXTCELL | critical | ledger month cell is text (R65) | «إدخال الرقم» (writes the number, creates the payment) |
| ENDBEFORESTART | critical | end < start (row 67) | «تصحيح التاريخ» |
| OVERLAP | critical | two contracts on one unit overlap | «فتح العقدين» |
| CELLCONFLICT | critical | ledger cell and payments both changed since the snapshot | «عرض» |
| ORPHANPAY | high | payment in a month the contract does not cover | first fix when the month follows the contract's end with no successor: «تمديد/تجديد العقد من {E + 1}» (`contract.renew` + re-attribution of the payment); else «نقل المبلغ» / «تعديل التواريخ» |
| OVERPAID | high | paid > due + tol (مكتب 42 Aug; 107/108 Jun) | last month of a contract with no successor: «تسجيل تجديد» (= `contract.renew` with the split of §6.3) · an inferred prior: «العقد الجديد بدأ في {month}» (linked adjust, §3.8 step 6) · always: «تسوية» (credit) / «تأكيد» |
| PARTIAL | medium | 0 < paid < due − tol (105 Aug; 508 Jun) | «سجّل الباقي» / «اعتماد المبلغ كمتفق عليه» (creates an override) |
| VARIANCE | low | partial with remaining < 10 % of due (302 Aug; 503 Jul) | «راجع المبلغ» |
| PRIORCONTRACT | high | inferred prior contract unconfirmed (13) | «تأكيد» / «تعديل» |
| INCLATE | medium | increase applied in a month other than the anniversary (403, 406) | «تأكيد» |
| INCDEFAULT | low | increase % defaulted (no second year observed) | «تأكيد» |
| INCUNUSUAL | low | observed increase outside 0–25 % | «تأكيد» |
| YEARGAP | medium | year segments not contiguous (repaired) | «عرض السنوات» |
| IDVARIANT | high | same name two ids / same company two tax ids (احمد هاشم; ايجل اي) | «دمج» / «تجاهل» |
| IDFORMAT | medium | tax-shaped value in the id column (row 52) | «نقل القيمة» |
| MISSINGID / MISSINGPHONE | low | **summary** (`-summary`): clients without id / phone, count + codes in the text | «إكمال» → `#clients?missing=phone` list with inline phone fields |
| KINDGUESS | low | summary: clients whose `kind` was guessed from rep ≠ name (§2.4) | «تعيين النوع» bulk |
| COTENANT | low | client name holds two tenants (rows 19, 20) | «فتح العميل» (second id field) |
| TRAILINGGAP | high | per contract: paid months followed by empty months reaching `min(enteredThrough, period(E))` (§3.8 6b) | «إنهاء مبكر من …» / «تسوية نهائية» / «متأخرات فعلًا» / «اتحصّلت — سجّلها» |
| HOLDOVER | medium | contract ended, no successor, nothing recorded after its end (§5.4) | «تجديد» / «الوحدة فعلًا شاغرة» |
| RENTSOLVED | medium | a rent solved from a split cell (401 old 32,745; 605 new 14,005) | «تعديل الإيجار» |
| RENEWEDFROMLEDGER | info | the office moved G later past paid months → row split into prior + successor | «فتح» |
| REASSIGNED | info | a ledger C/E edit re-pointed a contract or created a client/unit | «دمج» / «فتح» |
| NEARMATCH | high | a typed project/unit name nearly matches an existing one; row held | «دمج في …» / «لا، جديد» |
| PAYROWMISSING | high | an `INV-` row vanished from `المدفوعات` while the ledger still shows the money (re-emitted) | «تأكيد الإلغاء» (void) / «تجاهل» |
| FIELDCONFLICT | high | the same fact changed in two owned sheets since the snapshot (§4.6.6) | «عرض» |
| HIDDENROWS | info | hidden rows in a ledger sheet after a write | info |
| COMPUTEDEDIT | info | a `(محسوب)` column edited by hand (overwritten) | the driving field's action («إنهاء مبكر») |
| SETTING | medium | an invalid value in `الإعدادات` (default used) | «فتح الإعدادات» |
| YEARRANGE | medium | a hand-added year row outside `[start, E]` or out of order (ignored) | «عرض السنوات» |
| DATEORDER / FUTUREDATE | medium | maintenance `closedOn < openedOn` / `openedOn > today` typed in Excel | «تصحيح» |
| PLACEHOLDER | info | ledger row with a unit label, no client, no amounts | «إضافة عقد» |
| DEVICECLASH | info | two devices wrote with the same label | «تغيير اسم الجهاز» |
| MASSCHANGE | critical (transient, not stored) | the mass-change guard parked a read | the §1.5 modal |
| DUPLABEL | high | two units with one label (بابل محل) | «تسمية» |
| TYPEGUESS | medium | unit type inferred (one per project, ref = project code) | «تعيين النوع لكل الوحدات المحددة» |
| NODEPOSIT | low | summary: active contracts with `unrecorded` | «إدخال التأمينات» |
| DEPOSITOPEN | medium | contract ended > 30 days with deposit still `held` | «تسوية التأمين» |
| TERMSHORT | info | term not whole years (206: 2025-09-01 → 2026-08-30) | «تأكيد» |
| FUTUREPAY | medium | paidOn after today | «تصحيح» |
| NOTE | medium | office note on a row (X52, X56) | «فتح الصف» |
| NEWROW | info | row created from a hand-typed Excel row | «فتح» |
| CODEEDIT | high | code cell edited by hand (restored) | info |
| ROWMISSING | high | ledger row vanished while the contract exists (re-emitted with money) | «حذف العقد» / «تجاهل» |
| UNRESOLVED | high | ledger row that cannot be mapped (kept verbatim) | «ربط» |
| SHEETREBUILT | high | an owned sheet was missing and rebuilt | info |
| NORENT | high | contract without a rent | «إدخال الإيجار» |
| LISTVALUE | medium | invalid list value in a master sheet (normalised when unambiguous, else kept) | «تصحيح» |

Every flag row offers «تم التأكيد» (keep as is) / «تجاهل» plus its specific fix; resolution persists in `المراجعات` and survives re-reads by id.

---

## 6. Website IA and UI

Base: excel-bi-first §6 (ghost expected amounts, settlement modal, «آخر شهر مُسجَّل» hint, 600 ms wash, amount in words, filters in URL, keyed reconciliation, `#invoices`) merged with user-first §6 (quick-pay popover with receipt, bulk collect, كشف حساب, iframe printing, coach overlay, undo toasts, Egyptian-register copy, region rule). Grafts from integrity: `#reviews` and settings+sync pages, destructive button never default-focused, phone card list, a11y. Fixes: checkbox gate instead of type-the-code; no deposit auto-fill; إلغاء focused by default; 8-s undo.

### 6.1 Navigation (hash routes; sidebar ≥ 1200 px, icon rail 900–1199, bottom tab bar < 900)

| route | page | nav label |
|---|---|---|
| `#home` | dashboard | الرئيسية |
| `#ledger/2026` (`?m=&st=&p=&ty=`) | the Excel-like grid | جدول التحصيل |
| `#projects`, `#project/P03` | list + profile | المشاريع |
| `#units` (`?p=&ty=&st=&floor=&min=`), `#unit/P03-304` | list + profile | الوحدات |
| `#clients` (`?q=`), `#client/C012` | list + profile | العملاء |
| `#contracts` (`?st=&days=&dep=`), `#contract/T0031` | gantt + table + profile | العقود |
| `#invoices` (`?by=period|paid&m=`), `#invoice/INV-2026-0141` | payments table + printable invoice | الفواتير |
| `#maintenance`, `#maintenance/M0003` | tickets | الصيانة |
| `#reviews` | data-quality flags (badge = open critical + high) | المراجعات |
| `#settings` | settings, sync, backups, link, device | الإعدادات والمزامنة |
| `#search?q=` | full results | — |
| `#welcome` | first run / relink | — |

Topbar: global search (centre), «+ إضافة» (دفعة / عقد / وحدة / عميل / مشروع / بلاغ صيانة), bell (open flags + sync notices), sync pill (click → sync drawer: journal, backups, «اقرأ الملف دلوقتي»), theme toggle, «لوحة العرض» (→ `bi.html`, same tab), today's date. Breadcrumb on profiles (المشاريع › ابو بكر › 304). Unknown hash → `#home`; back works; last route saved to `localStorage egary.route`.

Sticky slicer bar on all data screens: search · المشروع · نوع الوحدة (تجارية / سكنية / إدارية / جراج) · الدور · العميل · الحالة (مؤجَّرة / شاغرة / شاغرة > 3 شهور / في انتظار التجديد / تنتهي خلال 90 يوم / منتهية بلا تجديد / محجوزة / عليها متأخرات) · السنة; active filters as removable chips in a line «الأرقام اللي قدامك مُرشَّحة على: …» with «عرض الكل» and live counts «N وحدة · M عقد». Filters live in the URL query so every drill (website or BI) is a link; KPI drills merge into the active filters, never replace them (toast «طبّقت الترشيح: …»).

### 6.2 الرئيسية

Top → bottom: sync banner (only when not «متزامن»); «تعديلات من الإكسيل» card (dismissible, opens the changes drawer); red alarm card K23 (when non-empty); hero strip (§5.5); month navigator «◀ أغسطس 2026 ▶ · آخر شهر مكتمل · آخر شهر مُسجَّل: أغسطس» with the hint of which tiles are month-bound; 8 tiles: K03, K01, K04 (sparkline of the last 6 rates), K05 (aging mini-bars), K09, K11, K13₉₀, K15; project cards (occupancy bar, due/collected/rate, arrears, flag chips; click = toggle project filter); charts: 12-month due vs collected (bars, newest at the inline-start), contracted revenue next 12 months (in/out), aging buckets, revenue by type (donut ≤ 4 slices); «مين ما دفعش أغسطس؟» list (K08, top 8 + total + the «ضمن المهلة / بانتظار التسجيل» group); insight cards; K27 small tile; last 8 audit lines. Every number is a button → evidence drawer (rows → profiles) or a filtered route.

### 6.3 جدول التحصيل (`#ledger/2026`)

- Year tabs (years with data ± 1; «+ إنشاء دفتر 2027» when allowed). Toolbar: project chips, type chips, status filter (الكل / متأخر / جزئي / بانتظار التسجيل / مسدَّد), «أظهر المنتهية», «أظهر الشاغرة» (adds grey rows for vacant units; default off to match the sheet), «كل الأعمدة» (toggle, remembered in `localStorage egary.ledgerCols`), «تحصيل شهر كامل», «قفل شهر {enteredThrough + 1}» (`month.close`; shown by the §5.2 rule), «تصدير CSV» (UTF-8 BOM, always all columns), «طباعة», «فتح في الإكسيل» hint (shows the folder path).
- Columns, default view: م · الوحدة · العميل · كود العقد (sticky inline-start) · العقد من · العقد إلى · يناير … ديسمبر · الإجمالي · المتأخرات · ملاحظات, with project group header rows (المشروع and العنوان live there). **«كل الأعمدة»** restores the sheet's exact 24 columns in the sheet's order and no group headers — المشروع · الاسم · الممثل القانوني · الوحدة · العنوان · العقد من · العقد الى · تسجيل ضريبي · الرقم القومي / الباسبور · months · الاجمالي · ملاحظات (+ the three code columns) — which is the literal reading of requirement 9; Help states the default view hides identity columns for screen width and that the toggle shows the sheet one-to-one. Header sticky top; totals row sticky bottom (past months «محصَّل / مستحق», future months «متوقع», last cell = total arrears).
- Cell = the collected amount exactly as the Excel cell (Western digits, no decimals unless present) coloured by status; empty due cells show the expected amount faintly «≈ 16,335» (the `≈` is dropped when an override exists); **future months inside the contract are clickable** (quick-pay prefilled with the due, chip «مقدمًا» once paid); months outside the contract are blank on the page background and **not** clickable, except the months right after a contract's end on a row whose contract is `ended_pending`/`ended`/`ending` with no successor: those cells show a faint «تجديد؟» and a click opens the **renewal popover** «العقد انتهى في 31/08 — سجّل التجديد من 01/09؟ [تجديد بنفس الشروط ×1.10] [فتح المعالج]» which runs `contract.renew` and then the quick-pay for that month (so September rent for a tenant who ended Aug 31 is two clicks; in Excel the office just types it → `DQ-ORPHANPAY` whose first fix is the same «تمديد/تجديد العقد من 01/09» button). `history` months grey; `pending_entry` striped; cells of a `DQ-TRAILINGGAP` run get a dotted outline; badge «2» when several payments; «نص؟» striped for text; tooltip: due, paid, status, overdue days, calc note, invoices.
- **Quick-pay popover** (click or Enter or typing a digit on a cell; anchored to the cell, bottom sheet on phones): المبلغ (prefilled remaining), تاريخ السداد (today), الطريقة (نقدي default), رقم الإيصال, ملاحظة; «حفظ» creates `INV-…` (toast «اتسجّلت الفاتورة INV-2026-0510 — واتكتبت في الإكسيل [طباعة]»), «حفظ وطباعة» also prints. Arrow keys move, Tab next, Esc closes. Typing a total **lower** than the current cell opens the settlement modal «المبلغ أقل من المسجّل — هتتسجّل تسوية بقيمة −X. السبب؟» (reason required → negative adjustment payment). A cell with several payments opens the cell drawer instead.
- Cell drawer (shift+click / «⋯» / long-press): status chip, contract, client, due breakdown with proration lines, override («تعديل المستحق لهذا الشهر» → reason), payments table (invoice, amount, date, method, ref, «طباعة», «إلغاء» = void), add-payment form, links to unit/client/contract.
- Bulk collect drawer: month (cur − 3 … cur + 3), shared paid-on date (hint «اتدفعت امتى؟») + method, pre-checked list of rows with remaining > 0 and their amounts; one commit = one write, N invoices, one audit line each.
- **Renewal with a shared month** (مكتب 42: ended 08-19, August cell 44,090): the OVERPAID/HOLDOVER fix «تسجيل تجديد» opens the wizard prefilled (start = E + 1 = 08-20, rent proposed from the surplus: `(44,090 − 19,158.33) × 30/11 = 67,995` → shown as a hint only, never pre-applied; default = last rent × (1 + inc)) with a checked option «قسّم مبلغ أغسطس: 19,158.33 للعقد القديم + 24,931.67 للعقد الجديد» → `contract.renew` + `payment.split`; the ledger then shows 19,158.33 on the old row and 24,931.67 on the new row below it (the office's own two-row habit for 204/304), X of both rows notes «مبلغ أغسطس 44,090 اتقسم بين T0006 و T0087», Σ of the two cells = the office's number. One ledger row ↔ one contract stays an invariant; a month cell is never shared.
- Changed-by-Excel cells flash a 600 ms wash; the grid is patched cell by cell; an open editor is kept unless its own cell changed (then it closes with a toast).

### 6.4 Invoice and statement printing (`ui/print.js`, `print.css`)

Invoice record = the payment. A5 portrait RTL: office name + address (when `officeName`/`officeAddress` are empty the header prints «إيجاري» and no address line, and the invoice page shows a one-time hint «اكتب اسم المكتب في الإعدادات علشان يظهر على الفواتير»), «فاتورة سداد إيجار» + `INV-2026-0141` + date, client (name, code, national id / tax id as on the contract snapshot, second id when any), unit (code, label, project, floor), «إيجار شهر يوليو 2026», due (with the override reason when any), paid before, this payment, remaining, method, receipt no., amount in words (`numberToArabicWords`: integer pounds in words + «و N قرشًا» for piastres, e.g. 46,603.50 → «ستة وأربعون ألفًا وستمائة وثلاثة جنيهات وخمسون قرشًا»; piastres rounded to 2 decimals; 0 → «صفر جنيه»), signatures, footer «صدرت من إيجاري». **«مطالبة»** (claim for an unpaid month; the owner's «electronic invoice» may mean this): the cell drawer and K08 rows offer «طباعة مطالبة» — the same A5 layout titled «مطالبة سداد إيجار», numbered `CLM-YYYY-NNNN` from `hwm.claim.YYYY` — claims are **not** records (no sheet): the number is a print counter in `الإعدادات`, and the printed claim lists due, paid so far, remaining, due date and grace; nothing else is written. A consolidated monthly claim per client («مطالبة شهرية») prints all of the client's unpaid months on one A4. «كشف حساب» (client statement, A4): default range = the last 12 months up to M, editable; includes voided invoices only when «أظهر الملغاة» is ticked (default off; voids are listed struck-through with their reason); months × (unit, due, paid, date, status) across all the client's contracts with totals. Printing = a hidden in-page `<iframe>` whose `contentWindow.print()` is called (no popups, no `window.open`); «حفظ PDF» = the browser's print-to-PDF.

### 6.5 Forms (drawer on desktop min(520px, 94vw), full-screen on phones; first field focused; inline errors under the field; first invalid field focused; never `alert()`; save button shows «جارٍ الحفظ في الإكسيل…» then toast «اتحفظ ✓ — واتكتب في الإكسيل» or «اتحفظ ✓ — في انتظار إغلاق الإكسيل»; code chip read-only «ثابت ما بيتغيّرش»; Arabic-Indic digits folded on input; dates `<input type=date>` + typed `dd/mm/yyyy` mask)

- **مشروع**: الاسم* («اسم المشروع مطلوب», «يوجد مشروع بنفس الاسم»), العنوان, المالك, المنطقة, عدد الأدوار (1–30, optional), ملاحظات.
- **وحدة**: المشروع* (locked on edit), رقم/اسم الوحدة* («مطلوب»; duplicate → «توجد وحدة بنفس الاسم في المشروع — لو دي وحدة تانية فعلًا اكتب اسم مميز زي «محل 2»»), النوع* (segmented تجارية / سكنية / إدارية / جراج), الدور (select; prefilled from the label), الوصف, المساحة م² (≥ 0), ملاحظات, **قائمة الأصول** (catalog checkboxes; ticking reveals العدد / الحالة / تفاصيل; «+ بند آخر»), live code preview «الكود هيبقى: P03-G5».
- **عميل**: الاسم*, النوع* (فرد / شركة), الممثل القانوني (shown for شركة), الرقم القومي / الباسبور (14 digits → hint «رقم قومي»; letters allowed; duplicate warning with «فتح ملفه»), رقم هوية ثانٍ (مستأجر مشارك) (optional, shown via «+ مستأجر مشارك»), تسجيل ضريبي (auto-hyphen `xxx-xxx-xxx`), التليفون («رقم التليفون مش صحيح»), تليفون آخر, البريد, العنوان, تفاصيل إضافية.
- **عقد** (wizard, 4 steps, live year table beside it): 1) العميل* (combo + «+ عميل جديد» inline) → 2) البداية*, المدة (1/2/3/5 سنين أو تاريخ) → النهاية* (auto, editable; «النهاية قبل البداية»; warning when not whole years) → 3) المشروع* → الوحدة* (only units free for the whole term; «أظهر المشغولة» appends «— عليها عقد حتى …»; a clash shows «يتداخل مع عقد سارة سيد احمد حتى 2027-07-31» + button «ابدأ من 2027-08-01») → 4) الإيجار الشهري (السنة الأولى)* (> 0), الزيادة السنوية % (default 10) or «أدخل كل سنة يدويًا», جدول السنوات (editable `من` and الإيجار per row, source column), نظام السداد (شهري default / ربع سنوي / نصف سنوي / سنوي — the installment schedule preview lists the due dates and amounts), يوم الاستحقاق (1–28), التأمين (empty by default = غير مسجّل; hint «العرف: شهر إيجار»; never auto-filled), حالة التأمين, الممثل القانوني (+ رقم هويته), رصيد متأخرات قبل 2026 (optional), ملاحظات. Save order: client, unit, dates, overlap, rent > 0, every year > 0, segments contiguous. `prevCode` auto when the previous contract on the unit has the same client (chip «تجديد»). Edit mode: changing dates regenerates proposed years and refuses if active payments would fall outside («فيه 3 فواتير خارج المدة الجديدة»); moving `start` earlier onto a linked/inferred predecessor applies the linked-adjust rule with a one-line notice («العقد السابق هينتهي في 31/05 والدفعة بتاعة يونيو هتتنقل للعقد ده»). «تجديد» on an ending/ended/holdover contract pre-fills the wizard (start = E + 1, rent = last × (1 + inc), same schedule). **«تغيير العميل / الوحدة»** (profile header menu) = `contract.reassign`: a modal «نقل العقد T0012 من خالد مصطفى إلى سارة سيد — الفواتير (14) هتفضل بأرقامها وهتظهر باسم العميل الجديد عند الطباعة؛ الصف في الإكسيل هيتغيّر اسمه» with the checkbox gate; unit reassign offers only units free for the whole term.
- **دفعة / فاتورة**: العقد* (combo by client/unit/code), الشهر* (any month of the contract span, including future months; history months < `trackingFrom` only when the contract has an `openingBalance` — labelled «سداد متأخرات سابقة»; default = first month with remaining > 0), المبلغ* (≠ 0; default remaining), تاريخ السداد (today; not future), الطريقة*, رقم الإيصال, ملاحظة. **Receipt split helper** («إيصال واحد لأكتر من شهر / وحدة»): one amount + one receipt no. + a target list (rows = (contract, month) with remaining, pre-checked from the oldest unpaid month of the chosen client's contracts — نور فلد 501+502, هيثم 707+708 — until the amount is consumed, the last row partial; editable) → one `payments.bulkCreate` with N invoices sharing `ref`; the printed invoices say «جزء من إيصال 1234».
- **استثناء استحقاق**: العقد*, الشهر*, المبلغ المتفق عليه* (≥ 0), السبب*.
- **بلاغ صيانة**: الوحدة*, تاريخ البلاغ* (≤ today), التصنيف*, الوصف*, التكلفة (≥ 0), يتحملها*, المقاول / الفني, مرجع الفاتورة, خصم من التأمين (only when `يتحملها ∈ المستأجر | مناصفة` and the custodian's contract holds a deposit), ملاحظات; read-only line «في عهدة: {client} (عقد T0012)» computed from the date and stored. «إغلاق» sets closedOn (≥ openedOn).
- **الإعدادات**: every key of §2.11 as a labelled input with a hint (grace 0–30, tolerance ≥ 0, increase 0–100, enteredThrough month picker with the auto value shown), backups list with «استرجاع», «غيّر مجلد الإكسيل», اسم الجهاز, theme.

### 6.6 Delete confirmation modal (`ui/modal.js`; never `window.confirm`)

Centred `role=dialog aria-modal`, focus trapped, Esc = cancel. Title «حذف {الكيان} {الاسم}؟». Body = consequences computed live: «هيتحذف معاه: 14 فاتورة بمجموع 98,000 ج.م (هتفضل في سجل المدفوعات بحالة ملغاة) · الصف هيتشال من ورقة 2026 · الوحدة 304 هترجع «شاغرة» من 2026-02-11». Blocked deletes explain instead of asking («المشروع فيه 52 وحدة — احذف أو انقل الوحدات الأول»). Contracts with payments, units, clients and projects require ticking «فاهم إن ده هيتحذف من الإكسيل كمان» before the red «حذف نهائي» enables; a single payment needs no checkbox. «إلغاء» is focused by default; the destructive button is never default-focused. After any delete: toast «اتحذف — [تراجع]» for 8 s (restores from the audit `before` JSON and rewrites); the workbook is backed up before the write.

### 6.7 Profiles (everything clickable)

- **مشروع**: header (code chip, name, address, owner, edit), KPI strip scoped to the project, **building elevation** (floors × unit chips coloured by status for M; click → unit), units table (code, label, type, floor, tenant, rent, status, arrears), contracts ending, maintenance cost by borneBy, insights scoped, audit lines.
- **وحدة**: header (code chip, label, project link, type, floor, m², edit, «+ عقد»), facts (status, current tenant, rent, vacant since/days, arrears), **assets checklist** (✓/✗, qty, condition, details; inline edit), **rental history** (Gantt with the today line and gaps labelled «شاغرة N يوم»; cards per contract: client, span, years table, deposit, collected, arrears, chips «تجديد»/«مستنتج»), this unit's ledger strip, **maintenance history** with «في عهدة» per row and totals by borneBy.
- **عميل**: header (name, code, kind, rep, ids, phones, email, notes, edit), facts (units now, active contracts, YTD collected, arrears, credit, punctuality chip or «غير كافٍ»), contracts, month-by-month statement (unit, due, paid, date, status → cell drawer), invoices with print, deposits, maintenance as custodian, «كشف حساب», «تسجيل دفعة».
- **عقد**: header (code, client, unit, span, status, edit, «تجديد», «إنهاء مبكر», «تغيير العميل / الوحدة», «تسوية نهائية», delete), years table (n, from, to, rent, source, «≈», edit), installment schedule (every tracked month or installment window: due date, due, paid, status → cell drawer), deposit box (status, «تسجيل استلام التأمين» → `DEP-` receipt, settle action pulling closed maintenance marked deducted), overrides, invoices, audit lines; «تأكيد» for inferred contracts. **«تسوية نهائية»** (one composed flow, `contract.settle`, for ended/terminated/holdover contracts): step 1 lists the open dues (e.g. 304 Feb 2,521.67; 503 Jul 60) each with «إعفاء» + reason or «تحصيل» (quick-pay inline); step 2 deposit: amount held, deductions prefilled from closed maintenance marked `deductFromDeposit`, refund = held − deductions (a deduction above the deposit is capped and the remainder shown as «متبقي على المستأجر» which stays in arrears), «مردود» / «مخصوم»; step 3 open maintenance tickets of the unit under this custodian with «إغلاق»; summary line «بعد التسوية: متأخرات 0 · تأمين مردود 14,000 · الوحدة شاغرة من 11/02/2026»; one audit line `settle` with full before/after; undo 8 s.
- **فاتورة**: the A5 print view.

### 6.8 Global search (`core/search.js`)

Index rebuilt on every state change: `{ kind, code, title, subtitle, tokens }` for projects (name, code, address), units (code, label, project, floor, type), clients (name, code, rep, national id, tax id with/without hyphens, phones digits-only, email), contracts (code, unit, client, dates), invoices (number, ref, amount, client), maintenance (code, description). Query → `normalize()` → tokens; token-AND prefix match; exact code match ranks first (via `codes.kindOf`), then clients, units, contracts, invoices; ≤ 8 per group with category badge + code chip; `role=listbox` keyboard navigation; Enter opens the top hit; «عرض كل النتائج» → `#search?q=`; the box keeps focus and caret across polls. Must hit: `304` → `P03-304`, `P02-304`; `P03-304` / `p03 304` / `P٠٣-٣٠٤`; `2840819` (id prefix); `567-734` and `567734`; `0100…` (phone); «احمد هاشم» = «أحمد هاشم»; «دعاء احمد» finds «د/ دعاء احمد حسن صديق»; «ابوبكر» finds «ابو بكر» (near-match suggestion line «قصدك ابو بكر؟» when no exact token hit); «ابو بكر 304» → unit 304 of P03 only; `INV-2026-0141`; `DEP-2026-0001`; a client without contracts is found.

### 6.9 Design tokens (`assets/css/tokens.css`)

Light (`:root`):
```
--bg #F4F5F9  --surface #FFFFFF  --surface-2 #EEF0F5  --ink #1C1E2B  --ink-2 #474A5F  --muted #767A90
--line #E1E4EC  --line-2 #C7CBD9  --accent #4F46C8  --accent-ink #3B33A3  --accent-wash #ECEBFB
--accent-grad linear-gradient(135deg,#7C73F0 0%,#4F46C8 55%,#2F2A86 100%)
--good #1E9E5A  --good-ink #146B3E  --good-wash #E2F5EA
--warn #D99A00  --warn-ink #7D5600  --warn-wash #FFF3D1
--serious #E0703A  --serious-ink #9A4418  --serious-wash #FDEADF
--critical #D63A3A  --critical-ink #A02626  --critical-wash #FBE3E3
--info #2D7FD3  --info-ink #1B578F  --info-wash #E3F0FC
--viz-1 #4F46C8  --viz-2 #2D9CDB  --viz-3 #1E9E5A  --viz-4 #D99A00  --viz-5 #E0703A  --viz-6 #8E5BD6  --viz-track #E6E4F7
--cell-paid #E2F5EA  --cell-paid-late #D7EEDF  --cell-partial #FFF3D1  --cell-late #FBE3E3  --cell-due #FFFFFF (ring #C9C4F3)
--cell-upcoming #F4F5F9  --cell-outside #EEF0F5  --cell-history #F0F1F5
--cell-pending repeating-linear-gradient(45deg,#F1F3F8 0 6px,#E9ECF3 6px 12px)
--cell-text repeating-linear-gradient(45deg,#F3F2EE 0 6px,#ECEAE4 6px 12px)
--shadow-1 0 1px 2px rgba(20,22,40,.06),0 4px 14px rgba(20,22,40,.06)  --radius 12px  --radius-s 8px  --focus 0 0 0 3px #C9C4F3
```
Dark (`:root[data-theme="dark"]`, and `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`):
```
--bg #0F1118  --surface #171A24  --surface-2 #1F2331  --ink #ECEEF5  --ink-2 #C3C7D6  --muted #8C91A6
--line #2A2F40  --line-2 #3C4257  --accent #9B93F6  --accent-ink #C3BDFF  --accent-wash #272650
--good #43C97A  --good-ink #93E4B4  --good-wash #163424   --warn #E9B84B  --warn-ink #F4D58A  --warn-wash #352C10
--serious #F29066  --serious-ink #F6B596  --serious-wash #38231B   --critical #EF6B6B  --critical-ink #F5A3A3  --critical-wash #3B1B1B
--info #6DAEF0  --info-ink #A9CFF6  --info-wash #182B40
--viz-1 #9B93F6  --viz-2 #5FB8EE  --viz-3 #43C97A  --viz-4 #E9B84B  --viz-5 #F29066  --viz-6 #B48CF0  --viz-track #2A2A52
--cell-paid #163424  --cell-paid-late #14301F  --cell-partial #352C10  --cell-late #3B1B1B  --cell-due #171A24  --cell-upcoming #141620  --cell-outside #1F2331  --cell-history #1A1D28
--cell-pending repeating-linear-gradient(45deg,#1D2335 0 6px,#222A40 6px 12px)
--cell-text repeating-linear-gradient(45deg,#26262B 0 6px,#1E1E22 6px 12px)
--shadow-1 0 1px 2px rgba(0,0,0,.4),0 4px 16px rgba(0,0,0,.35)  --focus 0 0 0 3px #35508F
```
Theme applied by a 4-line inline `<head>` script before the stylesheet (`localStorage egary.theme` → `html[data-theme]`), no flash. Status is always colour + icon + text; status colours are never chart series colours; estimates carry «≈»; `< 70 %` collection turns red; all ink/wash pairs ≥ 4.5:1 (axe-checked). `body` has an explicit background.

### 6.10 Typography, numbers, layout

`font-family: "IBM Plex Sans Arabic", "Segoe UI Variable", "Segoe UI", "Segoe UI Arabic", Tahoma, "Noto Sans Arabic", system-ui, sans-serif` (vendored woff2 400/500/600/700, `font-display: swap`). Base 14 px / 1.6; table 13 px; chips 11.5/600; h1 22/700; h2 17/650; tile value 28/800 `letter-spacing −.01em`; minimum 12 px. Western digits everywhere (matches the Excel), `tabular-nums`, money `12,705 ج.م`, percentages `87٪`, dates `20/05/2026` in tables and «20 مايو 2026» in prose, `≈` for proposed/estimated, `—` for null. Codes in `<code class="code-chip">` (Consolas / Courier New, `direction: ltr`). `<html lang="ar" dir="rtl">`; logical CSS properties only; SVG charts `direction: ltr` with time axes right→left. Breakpoints: ≥ 1200 sidebar 240 px; 900–1199 icon rail 64 px; < 900 bottom tab bar (الرئيسية، الدفتر، الوحدات، العملاء، المزيد), 2-col tiles; < 640 1-col tiles, full-screen drawers, the ledger becomes a per-unit card list with a month picker (full grid in landscape with 3 sticky columns); `pointer: coarse` → 40 px targets; 16 px side gutter; no horizontal page scroll. Print hides the shell.

### 6.11 Copy register

UI strings are Egyptian Arabic in toasts/errors/hints («اتحفظ», «مش لاقي», «فاهم إن…»), MSA in table headers, labels and the workbook. One sentence + one button per error. Every destructive or sync message names what happened and what to do next.

### 6.12 Motion and rendering

Durations 120 ms (hover), 200 ms (chips, toasts), 280 ms (drawer/modal), 400 ms (page enter, rise 8 px); easing `cubic-bezier(.2,.8,.25,1)`; only `transform`/`opacity`; count-up 500 ms on page entry only; data refresh from a poll never animates layout (600 ms wash); `@media (prefers-reduced-motion: reduce)` and `html[data-shot]` (`?shot=1`) disable everything. Rendering: `router.render(route)` builds a page once; pages expose `update(state, diff)` patching regions keyed by code (`ui.list(container, items, key, render)`); the grid patches cells by `(contractCode, period)`; never rebuild a node containing `document.activeElement` or a dirty form — it gets a yellow line «اتعدّل الصف ده في الإكسيل دلوقتي — [عرض القيم الجديدة]» instead; an open drawer re-renders for the same key and closes with a toast only if its record was deleted externally; scroll positions preserved. Toasts `role=status aria-live=polite`; drawers/modals trap focus; rows are `button`s or `tabindex=0 role=button`; charts `role=img aria-label` with the data table in the drawer.

---

## 7. BI mode (`bi.html`) and the Power BI kit

Base: excel-bi-first §7 (six tabs, window vocabulary, day theme, device orientation, idle = 0 rAF, evidence deep links, separate launcher, Arabic DAX). Grafts: integrity (strictly read-only, `?perf=1` instrumentation, floor-by-floor light-up, keyboard-reachable windows, Power BI reads only `الاستحقاقات`), user-first (←/→ month and 1–3 project shortcuts, data-driven building sign, ≤ 4 composited layers). Fixes: no backdrop-filter on coarse pointers / low-end GPUs, entrance 1.4 s, no M re-implementation of proration.

### 7.1 Scene

`bi.html` loads the same core/xlsx/sync scripts, links the same folder (shared IndexedDB on `file://`), takes **no** single-instance lock (§4.9) and **never writes** (`SyncController` created with `canWrite: false`; no command path exists on the page); it can be open beside the website on the same PC without either waiting. Dark tokens forced (`data-theme=dark`); day variant `data-theme=day` for projectors (sky `#DCE8FF → #F5F8FF`, buildings `#C9D4EA / #B5C3E0 / #A3B3D6`, lit windows `#F59E0B`).

Layers (each a positioned element with `will-change: transform`; four composited layers, no more):
- **L0 sky**: CSS radial gradient `--bi-sky-top #060A17 → --bi-horizon #1A2347` + one `<canvas>` of ≤ 80 stars (per-star phase twinkle, redraw every 100 ms, stopped when `document.hidden`; DPR capped at 2). Parallax factor 0.
- **L1 far skyline + fog**: `skyline-far.svg` silhouettes at 8 % opacity and two blurred radial gradients drifting on a 60 s loop, merged in one element. Factor 4 px.
- **L2 data buildings**: one `<figure class="bldg">` per project, side by side, width ∝ max units per floor, height ∝ `project.floors` or inferred from units; each floor a row of `<button class="win" tabindex="0" aria-label="P03-304 · سارة سيد احمد · مسدَّد">` = one unit. Window colours — **the window's subject for a month M is the contract active in M on that unit** (payment status of (contract, M)); today-based unit states (vacant / holdover / reserved / ending) are drawn **only when M = cur**, and for a past M a unit with no contract in M is «كانت شاغرة في M» (dim outline, no loss estimate) — so unit 304 is dim for June and lit for today: paid `#FFC857` (warm, glow `0 0 12px`), paid_late `#FFC24A`, partial `#FFA052`, due-in-grace `#FFE3A1` dim, pending_entry `#8A93B0` striped, late `#FF6B6B` with a 2 s opacity pulse, vacant (M = cur) `#2A3657` with outline `#3C4A78`, holdover (M = cur) `#3C4A78` with a dashed outline and tooltip «منتهٍ — في انتظار التجديد», reserved (M = cur) `#6FB1FF`, ending ≤ 90 d (M = cur) amber with a 2 px red top edge, unreadable `#B48CF0` striped. Building body `#121A35 / #182247 / #1F2B57`; roof sign = project name + occupancy % (click = project filter). Buildings drift ±8 px on a 24 s sine. Factor 16 px. Hover → tooltip (unit, tenant, due/paid); click → evidence panel.
- **L3 UI**: tiles and charts on glass cards `rgba(23,28,43,.72)`, border `rgba(255,255,255,.08)`; `backdrop-filter: blur(10px)` only when `(pointer: fine)` and `navigator.hardwareConcurrency > 4` and not `prefers-reduced-transparency`; otherwise a solid `#171C2B`. Factor −6 px plus `rotateX/rotateY ±4°` on pointer inside a `perspective(1200px)` wrapper. Evidence panel slides from inline-start.

Parallax: `pointermove` → rAF (only while moving; idle = 0 rAF callbacks) → `--mx, --my ∈ [−1, 1]` on the scene, lerp 0.08 → each layer `transform: translate3d(calc(var(--mx) * Fpx), calc(var(--my) * Fpx), 0)`; `pointerleave` on `document.documentElement` eases back in 600 ms; `deviceorientation` on tablets maps to the same variables (off on phones < 640 px).

Entrance (once per load, **1.4 s**, nothing interactive delayed beyond 0.5 s): 0–300 ms sky fade-in → 150–700 ms buildings rise `translateY(60px → 0)` + opacity, stagger 100 ms → 500–1,100 ms windows light up **floor by floor bottom → top** (25 ms per floor, 180 ms per window) → 800–1,400 ms tiles pop `scale(.96 → 1)` stagger 60 ms with count-up 600 ms. A workbook poll updates windows/tiles in place with a 600 ms wash; no re-entrance.

Keyboard: ←/→ report month, 1–3 project toggle (0 = all), Tab reaches every window and bar, Enter opens evidence, Esc closes the panel / returns to the website. Reduced motion (`prefers-reduced-motion`, `?shot=1`, or the persisted in-page toggle «تقليل الحركة»): no stars, drift, parallax, pulse or count-up; 150 ms fade; late windows get a static red outline + ✗ glyph.

### 7.2 Navigation and content (pill tabs; the same filter chips as the website; month navigator with «آخر شهر مُسجَّل»)

| tab | content (all fed by the same `kpi()` objects as the website) |
|---|---|
| نظرة عامة | hero (K01, K05, K12, K11, K13₉₀, K09) over the live buildings; insight cards; K27 small |
| التحصيل | 12-month due vs collected bars; rate line; aging bars (K06); K08 ranked list; K07 top debtors; K19 when available; K29 |
| الإشغال | occupancy by project (stacked rented/vacant/reserved); K10 list; vacancy loss with basis; K20 re-let gaps; K18 rent by type |
| العقود | ending calendar next 12 months; urgency-sorted Gantt; K16 contracted revenue; K15 deposits; K25 prevailing increase; K30 in/out |
| الصيانة | K22 by project / borneBy (stacked), open vs closed, mean close days, tickets |
| المراجعات | K28 by severity and the flag list |

Every tile / bar / slice / window → `bi/evidence.js` panel: title, the same evidence columns, total line, row click → `index.html#<profile or route with filters>` (same tab); «فتح في الموقع» on every panel; the BI remembers its tab and filters in `sessionStorage`. Charts are hand-drawn SVG from `ui/charts.js`, `role=img` with `aria-label` summaries and tooltips on hover/focus.

### 7.3 Performance budget

First contentful paint ≤ 1 s from `file://` on a 2019 i5 laptop; scripting ≤ 4 ms per frame while the pointer moves (measured by `performance.now()` behind `?perf=1`, which also draws an FPS/ms overlay); windows ≤ 400 DOM nodes (71 today) — above that, floors collapse to one bar per floor with counts; ≤ 1,500 DOM nodes total; `content-visibility: auto` on off-screen cards; memory < 150 MB; JS for `bi/*` ≤ 120 KB. Narrow screens: tilt off, buildings stacked, charts show the last 6 months.

### 7.4 Power BI kit (`powerbi/`)

- `Egary.pq` — Power Query M with a text parameter `WorkbookPath` (default `C:\Egary\Egary.xlsx`); `LoadSheet(name) = Table.PromoteHeaders(Excel.Workbook(File.Contents(WorkbookPath), null, true){[Item=name, Kind="Sheet"]}[Data])` with typed columns and Arabic headers kept. Queries: `Projects` (المشاريع), `Units` (الوحدات), `Clients` (العملاء), `Contracts` (العقود), `ContractYears` (سنوات العقد), `Payments` (المدفوعات, filtered الحالة = سارية), `Dues` (الاستحقاقات — the app's computed fact table; **proration is never re-implemented in M**), `Maintenance` (الصيانة), `Flags` (المراجعات), `Dates` (month grain from min(الشهر) to max(الشهر) + 12 with `الشهر = Date.ToText(d, "yyyy-MM")`). Relationships (README-PowerBI): Dues[كود العقد] → Contracts; Payments[كود العقد] → Contracts; ContractYears[كود العقد] → Contracts; Contracts[كود الوحدة] → Units; Units[كود المشروع] → Projects; Contracts[كود العميل] → Clients; Dues[الشهر] → Dates; Payments[الشهر] → Dates; Maintenance[كود الوحدة] → Units.
- `Egary-measures.dax` (Arabic names, one per line): `المحصَّل = SUM(Dues[المسدَّد])` · `المستحق = SUM(Dues[المستحق])` · `نسبة التحصيل = DIVIDE([المحصَّل],[المستحق])` · `المتأخرات = CALCULATE(SUM(Dues[المتبقي]), Dues[الحالة] IN {"متأخر","جزئي متأخر"})` · `متأخرات > 90 يوم = CALCULATE([المتأخرات], Dues[أيام التأخير] > 90)` · `بانتظار التسجيل = CALCULATE(SUM(Dues[المستحق]), Dues[الحالة] = "بانتظار التسجيل")` · `عدد الوحدات = COUNTROWS(Units)` · `وحدات مؤجرة = CALCULATE(DISTINCTCOUNT(Contracts[كود الوحدة]), Contracts[الحالة (محسوب)] IN {"ساري","ينتهي خلال 90 يوم"})` · `وحدات شاغرة = [عدد الوحدات] - [وحدات مؤجرة]` · `نسبة الإشغال = DIVIDE([وحدات مؤجرة],[عدد الوحدات])` · `شاغرة > 3 أشهر = CALCULATE(COUNTROWS(Units), Units[أيام الشغور (محسوب)] >= 92)` · `تنتهي خلال 90 يوم = CALCULATE(COUNTROWS(Contracts), Contracts[الحالة (محسوب)] = "ينتهي خلال 90 يوم")` · `منتهية بلا تجديد = CALCULATE(COUNTROWS(Contracts), Contracts[الحالة (محسوب)] = "منتهٍ بلا تجديد")` · `التأمينات المحتفظ بها = CALCULATE(SUM(Contracts[التأمين]), Contracts[حالة التأمين] = "محتفظ به")` · `الإيراد التعاقدي 12 شهر = CALCULATE([المستحق], DATESBETWEEN(Dates[Date], TODAY(), EDATE(TODAY(), 12)))` · `المحصَّل منذ بداية السنة = TOTALYTD([المحصَّل], Dates[Date])` · `تكلفة الصيانة = SUM(Maintenance[التكلفة])` · `تكلفة على المالك = CALCULATE([تكلفة الصيانة], Maintenance[يتحملها] = "المالك")` · `بلاغات مفتوحة = CALCULATE(COUNTROWS(Maintenance), Maintenance[الحالة] = "مفتوحة")` · `أكبر مدين = TOPN(1, VALUES(Clients[الاسم]), [المتأخرات])` · `مراجعات حرجة = CALCULATE(COUNTROWS(Flags), Flags[الخطورة] = "حرجة", Flags[الحالة] = "مفتوحة")` · `في انتظار التجديد = CALCULATE(COUNTROWS(Contracts), Contracts[الحالة (محسوب)] = "منتهٍ — في انتظار التجديد")`. `المحصَّل` equals the website's K01 for every month because `الاستحقاقات` carries the orphan/outside/history/invalid payment rows with المستحق 0 (§3.4).
- `Egary-theme.json`: `{"name":"Egary","dataColors":["#4F46C8","#2D9CDB","#1E9E5A","#D99A00","#E0703A","#8E5BD6"],"background":"#F4F5F9","foreground":"#1C1E2B","tableAccent":"#4F46C8","good":"#1E9E5A","neutral":"#D99A00","bad":"#D63A3A","textClasses":{"title":{"fontFace":"Segoe UI","fontSize":14,"color":"#1C1E2B"},"label":{"fontFace":"Segoe UI","fontSize":10,"color":"#474A5F"}}}`; `Egary-theme-dark.json` with the dark tokens (`background #0F1118`, `foreground #ECEEF5`, dark viz series).
- `README-PowerBI.txt` (Arabic, 5 steps): Power BI Desktop → Get data → Blank query → paste `Egary.pq` → set `WorkbookPath` → Close & apply → import theme → paste measures; note: refresh when the website is idle (it writes atomically, but refreshing during a save can read the old file); numbers equal the website because both read `الاستحقاقات` written at «آخر حفظ».

---

## 8. Test plan

Base: integrity-first §8 (lint tests, property-based codec cycles, reconciliation matrix, zip-guard fixtures, verify-failure E2E, two-timezone CI, traceability). Grafts: excel-bi (`make-fixture.py` redaction, `kpis.py` raw-sheet oracle, Excel-user simulators, `check_workbook.py`, GitHub Actions + c8 90 %), user-first (`check-no-pii` over the whole repo incl. `CHAT-LOG.md`, screenshots at 1366/1024/390 in both themes, KPI = Σ evidence over 24 report months and all filter combinations). Fixes: ground truth 3 / 71 / 65 / 86 (13 inferred) / 509; per-(contract, period) equality instead of «K3:V75 unchanged»; carry-over asserted as the §3.6 survivor list, not as XML equality.

Runners: `npm test` = `node --test tests/unit tests/xlsx` + `python3 -I tests/oracle/*.py`; `npm run e2e` = Playwright Chromium on `file://…/index.html?test=1` with a `MemoryAdapter` injected; `npm run lint-tests`; CI = GitHub Actions (ubuntu, Node 22, python3 + openpyxl 3.1, Playwright Chromium, LibreOffice headless when available) on a matrix `TZ=Africa/Cairo` × `TZ=Pacific/Kiritimati`; `c8` coverage gate 90 % lines for `core/` and `xlsx/`. Fixed clock `2026-10-09` everywhere.

### 8.1 Fixtures and PII

- `tests/fixtures/make-fixture.py <owner.xlsx> office-2026.xlsx` (openpyxl, deterministic): names → a fake-name table keyed by row (repeats map to the same fake, so identity behaviour is preserved); national ids / passports / tax numbers → digit-scrambled values of identical length and letter pattern (uniqueness and the §2.4 rule yield the same 65 clients, same merges); phones emptied; addresses kept; **all** amounts, dates, formulas, styles, widths, freeze `P58`, merge `K1:V1`, notes X52/X56/X65, the R65 text, row 67, the two «محل» rows and the 204/304 re-lets kept. `office-2026.xlsx` is the only workbook committed (`.gitignore`: `*.xlsx`, `!tests/fixtures/*.xlsx`, `tests/out/`, `Egary/backups/`); the scaffold's `tests/fixtures/source-anon.xlsx` is deleted. The owner's file is never committed and never referenced by a test path.
- Ground truth (must hold on the fixture, today = 2026-10-09): 3 projects; 71 units; 65 clients (1 `company` by the rep heuristic: row 31; 2 co-tenant flags: rows 19, 20); 86 contracts (13 inferred); 509 payments; 1 text cell; occupied 46 / **vacant (confirmed) 10 / holdover 15** / ≥ 92 days 7 with the days of §0 (the three 69-day vacancies: 501, 502, 706); ending ≤ 90 no successor 14; enteredThrough `2026-08` (share 56/61 = 91.8 % ≥ 90 %); K12 = 46/71 = 64.8 %; **day-one arrears = 135,566.67** = 18,481.67 (304 Feb 2,521.67 + 105 Aug 14,000 + 302 Aug 1,000 + 508 Jun 900 + 503 Jul 60) + 117,085 trailing-gap months (301 Jun/Jul/Aug 51,000; 705 Jun/Jul/Aug 33,000; 704 Aug 11,000; 503 Aug 11,195; 706 Jul 10,890), before any override or fix; `gapUnconfirmed` rows total 119,606.67 (117,085 + 304 Feb); 6 `DQ-TRAILINGGAP` flags (301, 705, 704, 503, 706, 304); 15 `DQ-HOLDOVER`; 605 solved rent 14,005 (`DQ-RENTSOLVED`), 401 old 32,745; renewal ratios: 302 10 %, 404 12.5 %, 405 16.5 %, 102 14.5 %, 104 15.5 %, 105 11 %, 505 18 %, 506 12 %, unusual 301 61 %, 107/108 33 %, 605 59.6 %, 606 26.7 %.
- `tests/fixtures/gen.js`: seeded LCG generator (profiles regular / late / partial / stops; 300 rows × 3 years) for punctuality, alarms, scale and property tests; `mini.xlsx` (2 projects, 6 units).
- `tools/check-no-pii.mjs`: fails CI if any id/tax/phone pattern from `tests/fixtures/pii-patterns.json` (generated locally from the owner's file, never committed) or any 14-digit number / `\d{3}-\d{3}-\d{3}` outside fixtures appears in `Egary/`, `tests/`, `docs/`, `CHAT-LOG.md`; `.githooks/pre-commit` runs it and rejects any `*.xlsx` outside `tests/fixtures/`.

### 8.2 Lint and unit tests (`tests/unit/*.test.mjs`)

- T-U-01 lint: no local-time `Date` methods outside `util.js`; no `innerHTML` with non-literal strings; no `window.confirm/alert/prompt`; no `type="module"`; every script file is an IIFE on `window.Egary`.
- T-U-02 `normalize`/`foldCode`, one case per step of §5.1: أحمد = احمد = آحمد, ساره = سارة, على = علي, ٢٩٢٠٢ = 29202 = ۲۹۲۰۲, Persian ک/ی, tatweel and tashkeel, «ميزان 1/2» = «ميزان 1 / 2», «صالون ايه ام  Salon A M» = «صالون ايه ام salon a m», «شركة HMA» = «شركة hma», «د/ دعاء احمد» = «دكتور دعاء احمد» = «دعاء احمد» while «شركة الدقة» ≠ «الدقة», «ابريل» = «أبريل»; `foldCode`: `P٠٣-٣٠٤` = `P03-304`, `O9565826` keeps its O, `567734420` matches `567-734-420` in search only; token-AND.
- T-U-03 dates and clock: `toIso` for ExcelJS Dates and serials incl. 2024-02-29, ±1 h drift, `date1904`; identical in both CI time zones; `today()` at 2026-10-08T22:30:00Z is `2026-10-09` (Cairo, UTC+3 in DST) and `audit.at` prints `2026-10-09 01:30:00`; the Cairo-midnight recompute fires between the minute ticks that straddle 21:00Z (DST) / 22:00Z.
- T-C-01 codes: label → code table for all 71 fixture labels (`304`→`P03-304`, `ميزان 1/2`→`P01-M1-2`, `محل`×2→`S1`,`S2`, `مكتب 42`→`O42`, `الدور الثاني`→`F2`, `جراج 5`→`G5`); hwm never reuses (delete `T0086`, create → `T0087`); per-year invoice numbering; `kindOf`.
- T-E-01 years: 2024-05-20 → three years; Feb 29 start; termination truncation; TERMSHORT (206); `round5` (14,850 → 16,335; 11,000 → 12,100); editable `from` (403 → 2026-03-01).
- T-E-02 proration (verified cases): 605 Jul 11,390 with the solved 14,005 (and 11,387.50 with 14,000 → `paid` either way); 606 Jul 17,000; 401 Jan 36,025 with inferred 32,745; ميزان 1/2 May 46,753.67 and paid 46,603 → `paid`; 508 Jun 14,400 (override → 13,500 → `paid`; tol with the missing-neighbour rule = 672); 304 Feb 2,521.67; مكتب 42 Aug 19,158.33; Feb split 16th = 15/15; 31-day full = 30/30; segment starting on the 31st = 0; **edge cases of §5.2**: end on the 30th of a 31-day month (206 Aug) = 30/30, end on the 29th = 29/30, end Feb 27 = 27/30, start Feb 29 (2028) = 2/30, start Jan 30 = 1/30, start-and-end inside one month 06-07..06-20 = 14/30, 1st..15th = 15/30; `paySchedule = quarterly` from 2026-07-16: July due = Σ Jul(prorated) + Aug + Sep, Aug/Sep due 0, Oct starts the next window; `annual` = 12 months on the first month; an override on a window's first month replaces the window total.
- T-E-03 status machine: every branch of §5.3 incl. tolerance edges (`due − tol` exactly), grace boundary day (overdue 5 → due, 6 → late), undated payment never `paid_late`, `pending_entry` vs `late` around `enteredThrough`, `history` before `trackingFrom`, `unreadable`, `outside` with payment, **prepaid future months** (p > cur with paid ≥ due → `paid` «مقدمًا», 0 < paid → `partial_in_grace`, never late), `invalid` contract → all `outside`, a 0-sum cell with two active lines → `paid`/`late` by due with the cell written as 0, `gapUnconfirmed` chip on TRAILINGGAP months.
- T-E-04 arrears, aging, opening balance, credit; partial-in-grace excluded from K05 but present in K08; `pending_entry` never in K05.
- T-E-05 enteredThrough: auto = 2026-08 on the fixture by rule (a) (91.8 %); each of the three rules in isolation on crafted states (a month at 89 % with no next-month entries and `cur = month + 1` is **not** closed; 25 % of the next month closes it; `cur ≥ month + 2` closes it; a pinned setting wins; `month.close` pins it); a batch-entry simulation (September typed for 10 %, 25 %, 60 % of contracts) never flips September's untyped cells to `late` and flips August's at 25 %; day-one arrears equal the ground truth 135,566.67 and the K05 sub reports 117,085 unconfirmed.
- T-E-06 vacancy: 304 vacant 2026-02-11 → 2026-07-31 (reserved from the 2026-08-01 contract's creation), 607 vacant since 2026-05-01 (161 days), never-let uses `createdAt`; ≥ 92 rule.
- T-E-07 renewals 30/60/90 (14), ended-without-renewal, successor by chronology and `prevCode`; re-let gaps 304 = 171, 204 = 0; punctuality ≥ 3 dated; concentration; median increase; K27 components sum to the score and rescale when rate is null.
- T-E-08 inference: rent from full months; from a split month with `round5` (401 → 32,745; 605 → 14,005 + RENTSOLVED); plateau split (403/406) producing one observed pair old→new; increase rounding; renewal ratios across `prevCode` (302 → 10 % with no INCDEFAULT; 301 → INCUNUSUAL + default 10 %); unusual increase flag.
- T-E-09 trailing gaps and holdover: the 6 TRAILINGGAP flags with their runs and totals; «إنهاء مبكر من يونيو» on 301 → `terminatedOn = 2026-05-31`, months `outside`, K05 −51,000, unit vacant since 2026-06-01 (130 days → joins K11); «متأخرات فعلًا» keeps K05 and drops the chip; the 15 holdovers (`ended_pending`) are in neither K10 nor K14's value, appear in K14 group 2 and insight 5b, produce no vacancy loss, and K12 = 46/71; 206 (ended 08-30) is a holdover, 706 (ended 07-31, empty August) is vacant; مكتب 42 is a holdover by the overpaid rule; «الوحدة فعلًا شاغرة» → `vacant` since E + 1; `contract.renew` on 502 from 2026-09-01 makes the unit occupied and the old contract `ended_renewed`; the same with a different client → `ended_relet`.
- T-E-10 linked adjust and split: moving 107's real start to 2026-06-01 shortens the inferred prior to 05-31, moves the June payment (8,000 = 8,000 → `paid`, credit 0) and leaves the month sum unchanged; moving a start onto a confirmed predecessor is refused with the two buttons; `payment.split` of مكتب 42 August into 19,158.33 + 24,931.67 across the old and new contracts voids the original, keeps Σ, numbers two new invoices; `contract.settle` on 304 waives Feb 2,521.67 with a reason, refunds the deposit and leaves K05 without it.
- T-E-11 KPI definitions: K04 numerator uses only K03 rows (an orphan payment in M does not raise it; an overpayment shows «103 ٪» in the sub and 100 % on the tile); K12 counts `hasActiveContract`; K23 counts contracts and uses the trailing streak only (a streak broken by a paid month before `enteredThrough` does not alarm); K25 median over both ratio kinds; K30 delta formula on a crafted year; K22 window = year of M; the basis table of §5.5 (navigating M never changes an as-of-today tile).
- T-K-ALL: for every KPI id, 24 report months and 20 random filter combinations: `value === reduce(evidence)`; every evidence row's link resolves.
- T-I-01 insights: each trigger fires on a crafted state and nowhere else (incl. «ما فيش تحصيل مسجّل لشهر سبتمبر»).
- T-F-01 flags: each rule of §5.8 fires on the fixture row that motivates it (TEXTCELL R65, ENDBEFORESTART row 67, PRIORCONTRACT ×13, INCLATE 403/406, VARIANCE 302/503, PARTIAL 105/508, OVERPAID مكتب 42 + 107/108, NOTE X52/X56, IDVARIANT احمد هاشم + ايجل, IDFORMAT row 52, DUPLABEL محل, TRAILINGGAP ×6, HOLDOVER ×15, RENTSOLVED 401/605, KINDGUESS summary (row 31), COTENANT rows 19/20, INCUNUSUAL ×4, summaries NODEPOSIT / MISSINGPHONE (65) / MISSINGID (1) — exactly one flag each, ids `DQ-…-summary`); no per-client MISSINGPHONE flags exist; ids stable across two runs and across wording changes; resolution re-attaches; a resolution whose flag stopped firing survives 90 days (`lastSeen`) then drops; an ignored summary stays ignored when a member is added.
- T-S-01 `store.apply`: every command type incl. `contract.reassign` (snapshot reset, invoices kept, overlap refused), `payment.split`, `contract.renew`, `contract.settle`, `contract.receiveDeposit`, `month.close`; `expect` mismatch → `ConflictError`; audit lines carry before/after (truncated at 1,000 chars with «…») while `egary.undo` holds the full before state and undo of a 40-line bulk collect restores every line.
- T-SE-01 search: every query of §6.8; ranking; token-AND; Arabic-Indic input; client without contracts found.
- T-P-01 `numberToArabicWords` (0, 5, 1,000, 46,603, 46,603.50 → «… وخمسون قرشًا», 0.25, 1,311,200).

### 8.3 Workbook codec, migration, reconciliation (`tests/xlsx/*.test.mjs`)

- T-XL-01 migration of the fixture: 3 / 71 / 65 / 86 (13 inferred, row 67 → 2025-05-01) / 509; exact flag list of §3.8 (incl. 6b/6c); notes X52/X56 on their contracts; code order of §2.13 rule (0): `T0001…T0073` = ledger rows in order, `T0074…T0086` = inferred priors, `C001` = row 3's client; inferred rows inserted above their real rows with G **blank** and H = real.start − 1; invoice order row-major over the written sheet (`INV-2026-0001` = row 3 January; row 13's Jan–Apr on the inserted row precede its May–Aug); `ملخص المشاريع!B1` = «عدد الصفوف (عقود)» with the comment and B2:B4 = 7/14/65 after recalculation.
- T-XL-02 ledger regeneration: after migrate + encode, openpyxl reads `2026`: for every original (row, month) numeric cell the written cell for the same `(contractCode, period)` — found via Y — equals the original value; R65 still the text; W and totals formulas with correct cached values; `K1:V1` merged; widths equal the owner's; freeze `F3`; RTL; validations present (K..V decimal warning, Y list); fills `FF1F4E78` / `FFFFF2CC` / `FFD9D9D9`; formats `#,##0.00` / `dd/mm/yyyy` / `@`; Y..AA filled; no row below totals; `القوائم` hidden; `fullCalcOnLoad`.
- T-XL-03 idempotence: `decode(encode(S))` deep-equals `S` (minus audit/flags) for the migrated state and 200 generated states (Arabic hamza variants, Arabic-Indic ids, negative adjustments, Feb/31-day splits, overrides, voids), 3 cycles; in-place patch twice → identical decoded state.
- T-XL-04 carry-over (the §3.6 survivor list, asserted through openpyxl, **not** a zip-entry compare): extra sheet «ملاحظاتي» with values, a formula with cached result, rich text, a merge, a legacy comment, a `cellIs` and a `colorScale` conditional format, a list validation, a defined name, a hidden column, a row height, a tab colour, print area and margins, an image → after a cycle every one of these is present with equal values/attributes (image bytes equal, anchors equal); extra column «تعليق» in الوحدات with a formula, an unresolved ledger row, a hand-added row without codes, an office fill on a ledger cell, a note below the totals row → the column/formula/fill/note survive, the unresolved row is verbatim + flagged, the hand-added row got codes and created a contract. **Negative list** (documented, not promised): a workbook carrying each of the §4.4 content-scan items (sparkline, `x14` data bar, shape/text box, threaded comment) is refused by the zip guard before any write — asserted in T-XL-05.
- T-XL-05 zip guard: workbooks with a chart / pivot / slicer / macro / threaded comment (fixtures generated with openpyxl + LibreOffice) → `readOnlyReason` set, write refused, export copy valid; an image-only workbook stays writable.
- T-XL-06 reconciliation matrix: 14 scenarios of (snapshot, ledger cell, payments) × (web command pending or not): ledger changed / payments changed / both / cleared cell voids and keeps numbers / several payments → delta line / deleted ledger row re-emitted **with payments** / deleted العقود row → delete + void / text cell / first read without snapshot.
- T-XL-07 oracle: `tests/oracle/kpis.py <xlsx> --asof 2026-10-09` recomputes dues (D30), statuses, arrears, occupancy, vacancy and collection from the raw sheets (not from `الاستحقاقات`); `tests/oracle/check_workbook.py <xlsx> <expect.json>` asserts structure/styles/formulas/validations/hidden sheet/calcPr; Node compares `الاستحقاقات` and `kpi()` to the oracle to the cent; `tools/recalc.sh` (LibreOffice headless) asserts recalculated formula values equal the cached ones (skipped if absent).
- T-XL-08 dates: serial ↔ ISO 1900–2100; `date1904`; both CI time zones identical.
- T-XL-09 codes in the workbook: hwm survives deletion and audit archiving; code edited by hand restored + flagged; foreign code treated as new.
- T-XL-10 year sheets: `2027` created by rule; an office-copied `2027` recognised and normalised; summary ranges follow.
- T-XL-11 identity snapshot: after migration and one write, ledger D5/J5 and D7/J7, C8/I8, C23/I23 equal the originals; editing client الدقة's rep on the website leaves D7 untouched.
- T-XL-12 re-basing (`rebase.js`): an office formula `=K5*2` in AB5, a CF on `K3:V75`, a validation on `G3:H75`, a merge `AC10:AD10`, a defined name `=\'2026\'!$K$40` and a summary-sheet `SUMIF` over `'2026'!B3:B75` → after inserting an inferred row above row 5 and appending a contract at the end of the بابل block: `=K6*2`, `K3:V77`, `G3:H77`, `AC11:AD11`, `$K$41`, `B3:B77`; after deleting a contract's row the references shrink back; `INDIRECT("K5")` is unchanged (documented).
- T-XL-13 parsing (§4.2 step 4): month cells «١٢٧٠٥», «12,705 », «12٬705 ج.م», `=6000+6705` (formula cell with cached result), a Date in a month column, a boolean → 12,705 / 12,705 / 12,705 / 12,705 (and the formula replaced by the number on write) / `unreadable` / `unreadable`; `المدفوعات` الشهر typed as a Date, «7/2026», «يوليو 2026», «يوليو ٢٠٢٦», `Jul-26` → `2026-07`; a numeric 14-digit id → the exact digits; a 10-digit numeric phone → `01…`; a 9-digit numeric tax id → `ddd-ddd-ddd`; `الإعدادات` values «٥», «abc», 400, 0 → 5 / default + `DQ-SETTING` / default + flag / default + flag; an unknown settings key survives a cycle.
- T-XL-14 payment-row and code edits (§3.7): deleting an `INV-` row in `المدفوعات` while the ledger cell is unchanged → the row is back after the cycle with the same number + `DQ-PAYROWMISSING`; deleting it and clearing the cell → void; editing its amount → `payment.update` and the cell rewritten; editing its month → moved (orphan check); an unknown contract code → `DQ-UNRESOLVED`, no payment; a renumbered invoice → restored + `DQ-CODEEDIT`; a copied ledger row with Y..AA → new codes + `DQ-CODEEDIT`; two true duplicates → the second `DQ-UNRESOLVED`; a ledger C changed to another existing client → reassign; to a new name on a one-contract client → rename; to a new name on a multi-contract client → new client + `DQ-REASSIGNED`; E changed to an existing unit → reassign with the overlap check; «ابوبكر» typed in B → `DQ-NEARMATCH`, no `P04`.
- T-XL-15 read failures: a zero-byte buffer, a truncated zip, an OLE-signature buffer, a workbook with `ws.protect` on `2026`, a workbook with `schemaVersion = 99` → `corrupt` (retries then banner), `corrupt`, `encrypted`, `readOnlyReason = 'protected'`, `readOnlyReason = 'newer'`; none mutates state; the export copy works in the last two.
- T-XL-16 mass-change guard: a stale copy that changes 120 cells and voids 80 invoices → state `conflict`, nothing applied, the three choices behave (apply / restore newest backup / preview); below the thresholds the read applies; no guard on the first read without a snapshot.
- T-XL-17 re-migration: the migrated workbook with `العقود` and friends deleted → the rebuild card lists the backup-only sheets and the newest backup; «إعادة البناء من الدفتر» keeps every Y..AA code, creates no inferred rows, regenerates invoice numbers, and flags `DQ-SHEETREBUILT` per backup-only sheet; «استرجاع» restores and re-reads.

### 8.4 Sync (Node with `MemoryAdapter`; `tests/unit/sync.test.mjs`)

T-SY-01 echo suppression by hash; T-SY-02 two-tick stability before reading; T-SY-03 journal persistence and replay order; T-SY-04 lock → retry schedule 5/10/20/40/60 (fake timers) → success → journal empty; T-SY-05 `expect` conflict → `ConflictError` surfaced, re-issue applies; T-SY-06 verify-after-write failure (`failNextWrite('truncate')`) → `verify_failed`, journal intact, state unchanged, retry succeeds; T-SY-07 backup policy (first write of session, 10-min window, every delete, retention pruning touches only app patterns); T-SY-08 lock-file detection flips the pill; T-SY-09 `stat() === null` → missing-file state; T-SY-10 single-instance takeover handshake (two controllers in one process via BroadcastChannel stub); T-SY-11 transient read failure (`read()` throws twice then succeeds) → silent retries at 0.5/1/2/4 s, no banner before the 4th failure, state unchanged, writes paused then resumed; T-SY-12 zero-change resave (same state, different bytes) → no `sync:external-change` event, no audit line, `lastKnownHash` updated; T-SY-13 journal lost (`egary.meta.journalCount = 3`, empty store) → the «journal lost» notice once; T-SY-14 backup names carry the device slug and never collide for two controllers writing in the same second; `original-*` written once even from two devices.

### 8.5 End-to-end (Playwright, `tests/e2e/*.spec.mjs`)

- T-E2E-01 first run: `app/index.html` → welcome → folder validation errors (picked `app/` itself; a folder with neither `Open-Egary.bat` nor `app/`; `.xlsm`; no `Egary.xlsx` → list / create; a Temp/zip pathname → the extract-first screen; a rejected system folder → the «مجلد نظام» message) → migration preview text «3 مشاريع · 71 وحدة · 65 عميل · 73 صف تعاقد → 86 عقد (13 …) · 509 دفعة» → «ابدأ» → one write → `original-*` backup → dashboard with no coach and no device prompt (4 clicks total from S1) → the coach appears after the first payment write; second boot skips migration; `via=bat` missing → plan-B banner.
- T-E2E-02 later run with a seeded journal → replay → toast «اتحفظ 2 تعديل كانوا مستنيين».
- T-E2E-03 website → Excel: quick-pay on `P03-304 × 2026-09` 14,000 → `lastWriteBytes()` → openpyxl: cell on the row with Y = that contract and column S = 14000, `المدفوعات` has `INV-2026-0510` with today's date and method نقدي, `سجل التعديلات` line; toast text.
- T-E2E-04 Excel → website: `edit_cell.py` sets O5 = 46,000, clears R43, types text in K12, `add_row.py` appends a code-less row, `delete_row.py` removes a ledger row → `setBytes` → `pollNow` → card «تعديلات من الإكسيل: 5», O5 shows 46,000 with chip, R43's invoice «ملغاة», K12 striped «نص؟» + critical flag, new contract created with `DQ-NEWROW`, deleted row re-emitted with its money + `DQ-ROWMISSING`; an open drawer for another record stays open; search box keeps focus and caret.
- T-E2E-05 lock: `setLocked(true)` → payment → banner «ملف الإكسيل مفتوح في برنامج Excel … (1 تعديل)» → `setLocked(false)` → green toast within 6 s → bytes verified.
- T-E2E-06 conflict: edit-contract drawer open; bytes change that contract's end; poll → yellow line; save → conflict drawer with both values; «طبّق قيمي» succeeds.
- T-E2E-07 verify failure: `failNextWrite('truncate')` → red banner with one button «حاول تاني»; writes paused; journal intact; retry succeeds.
- T-E2E-08 forms: every validation message of §6.5 verbatim; code chips read-only; project locked on unit edit; asset checklist details persisted and visible on the unit profile; contract wizard hides occupied units, offers «ابدأ من …», years table editable; deposit left empty → «غير مسجّل»; garage unit creatable and filterable.
- T-E2E-09 delete: modal for every entity; Esc cancels (bytes unchanged); consequences text; blocked deletes explain; checkbox gate; after confirm the row is gone from `2026` and payments are «ملغاة» in `المدفوعات` (openpyxl); «تراجع» restores and bytes revert; `before` JSON in the audit.
- T-E2E-10 filters: every slicer value (3 projects, 4 types incl. جراج, 7 statuses, floors, years, client) and combinations → count equals an independent JS filter over `state()`; chips; «عرض الكل»; URL round-trips; BI deep link `index.html#units?st=vacant&min=92` lands filtered.
- T-E2E-11 search: §6.8 queries; keyboard; code match opens the profile.
- T-E2E-12 KPI drill-down: every tile/card/chart bar on `#home`, project cards, BI tiles and 20 windows → evidence drawer; row count and total equal the tile; rows navigate correctly.
- T-E2E-13 ledger grid: keyboard navigation; quick-pay; settlement modal on a lower amount; multi-payment badge → drawer; bulk collect = one write (`adapter.writes` +1); totals row equals openpyxl sums; ghost expected amounts; «أظهر الشاغرة»; year tabs; print CSS snapshot; R65 «نص؟» fix dialog writes the number.
- T-E2E-14 profiles: 304 shows two tenancies with the 171-day gap; 204 gap 0; custodian frozen on a ticket opened 2026-01-15 (خالد) vs 2026-09-01 (سارة); client احمد هاشم shows the ID-variant flag and «دمج»; inferred contract shows «تأكيد».
- T-E2E-15 invoice and statement: `#invoice/INV-2026-0137` renders all fields and the Arabic words; `كشف حساب` for a client; `page.pdf()` produced; no popup opened.
- T-E2E-16 BI: entrance ≤ 1.5 s; window count = 71; window colours match statuses; window click → evidence; tile values equal the website's for the same M/filters; reduced motion → `getAnimations().length === 0`; day theme toggle; `--mx` changes on pointer move; `?perf=1` overlay; the BI page never calls `write` (adapter log).
- T-E2E-17 accessibility: axe on every page in both themes — no critical/serious violations; focus traps; Esc; `aria-live` toasts.
- T-E2E-18 import/export mode (`?nofs=1`): file input → edits → download bytes verified by openpyxl.
- T-E2E-19 responsive/theme: 1366×768, 1024×768, 390×844 in both themes (`?shot=1`): no horizontal page scroll, sticky columns, bottom tab bar, first paint background `#0F1118` in dark (no flash); screenshots stored as artefacts.
- T-E2E-20 performance: parse + KPI < 60 ms (`performance.measure`); BI frame scripting < 4 ms average over 3 s; 300-row synthetic fixture dashboard refresh < 500 ms.
- T-E2E-21 single instance: second page on the same origin shows «البرنامج مفتوح في نافذة تانية»; takeover moves the lock; **`bi.html` opened beside the website neither waits nor shows the message** and the website keeps writing.
- T-E2E-22 holdover and trailing gaps on the UI: K10 = 10 with the sub «+ 15 في انتظار التجديد»; K14 shows the two groups; the ledger row of 502 (ended 08-31) shows «تجديد؟» on September, click → renewal popover → «تجديد بنفس الشروط» → quick-pay → openpyxl: a new row below with the September amount, Y = the new code, old row untouched; the K05 tile sub shows 117,085; the TRAILINGGAP flag on 301 → «إنهاء مبكر من يونيو» → K05 drops by 51,000 and the unit appears in K11; the «قفل شهر سبتمبر» button is absent today (September has no entries); the test freezes today = 2026-10-20, types September for 3 contracts → the button appears → click → `settings.enteredThrough = 2026-09` and the 58 untyped Septembers turn `late`.
- T-E2E-23 split and settle: مكتب 42's OVERPAID fix → wizard with the split option → two rows in `2026`, Σ August = 44,090, two invoices; «تسوية نهائية» on 304 → the three steps, Feb waived, deposit returned, audit line, undo restores.
- T-E2E-24 forms added in this revision: receipt split across 501+502 (one ref, two invoices, printed «جزء من إيصال»); quarterly schedule preview; co-tenant second id on the invoice; reassign modal and the ledger C change; future month quick-pay with «مقدمًا»; settings validation messages inline.
- T-E2E-25 «كل الأعمدة» toggle shows the 24 sheet columns in sheet order; CSV export has all columns; «مطالبة» prints with a `CLM-` number and no data-sheet write.

### 8.6 Requirement traceability

Req 1 → T-E2E-01/02/21 + the manual checks of §8.7; 2 → T-E2E-03..07, T-XL-06, T-XL-13..16, T-SY-*; 3 → T-E2E-16/20; 4 → T-K-ALL, T-E2E-12; 5 → T-C-01, T-XL-09, T-E2E-11; 6 → T-E2E-14, T-E-06/07; 7 → T-E-01/02, T-E2E-15; 8 → T-E2E-08/09; 9 → T-XL-02, T-E2E-13; 10 → T-E2E-08/14; 11 → T-E2E-08; 12 → T-E2E-10; 13 → T-I-01, T-F-01; 14 → the whole suite; 15 → T-E2E-17/19; 16 → `check-no-pii` on `CHAT-LOG.md`.

### 8.7 Manual checks (`docs/manual-checks.md`, Windows 10/11, run before every delivery; each has steps, expected result and a checkbox)

| id | check |
|---|---|
| M-01 | `showDirectoryPicker` on `file://` in Edge and Chrome, `--app` + `--user-data-dir`: picker opens, `readwrite` granted, handle stored and found on relaunch |
| M-02 | directory handle survives browser restart and PC restart in the dedicated profile; `queryPermission` state after each |
| M-03 | `Open-Egary.bat` on a fresh PC: no first-run/sign-in page in Edge; Arabic folder name; a path with `!` and `%`; Desktop redirected to OneDrive; SmartScreen «Run» appears once |
| M-04 | permission prompt per launch: whether «السماح» is asked every launch or once (sets the README/«متابعة» wording, §1.4) |
| M-05 | plan B «إنشاء زرار التشغيل»: `createWritable` on `Open-Egary.bat` allowed or blocked by Chromium's dangerous-extension rule |
| M-06 | delivery: zip through WhatsApp Desktop, a Drive link, a USB stick, Gmail and Outlook — which keep the `.bat`; the README path for the e-mail case works |
| M-07 | running from inside the zip (double-click the `.bat` in Explorer's zip view) shows the extract-first message; opening `app/index.html` from inside the zip shows S0b |
| M-08 | Excel lock: `~$Egary.xlsx` detection, the yellow banner, retry after close; **Protected View**: no lock file, edits discarded until «Enable Editing», the README line is accurate; «Unblock» on the zip before extraction removes the bar |
| M-09 | Excel-typed values: Arabic-Indic digits in a month cell, `=6000+6705`, a Date in الشهر, a numeric 14-digit id, a phone losing its 0 — all read as §4.2 says and written back normalised |
| M-10 | AutoFilter with criteria then an app write: rows stay hidden, criteria gone, `DQ-HIDDENROWS` appears |
| M-11 | BI beside the website (`app\Open-Egary-BI.bat` while the site is open): both live, writes continue |
| M-12 | mass-change guard: copy an old backup over `Egary.xlsx` while the app runs → modal, no silent voids |
| M-13 | update path: extract a new zip over the folder with «Replace» → `Egary.xlsx`/`backups/` intact, no relink, schema upgrade logged |
| M-14 | encrypted workbook / `.xls` / protected sheet / newer `schemaVersion` messages as in §1.5 |
| M-15 | OneDrive folder: save while OneDrive syncs — transient-read retries, no banner in the normal case |
| M-16 | Power BI Desktop refresh of `Egary.pq` against the written workbook; measures equal the website for M |

---

## 9. Risks and open questions (owner unavailable → the default applied)

| # | risk / question | default |
|---|---|---|
| R1 | **The owner's workbook with national ids and tax numbers is tracked in the public repo as `Egary/Egary.xlsx`** (and `tests/fixtures/source-anon.xlsx` is unverified), and the scaffold's `codes.js` uses max+1 | Before any push: `git filter-repo --path Egary/Egary.xlsx --path tests/fixtures/source-anon.xlsx --invert-paths` on the branch (force-push), `.gitignore` `*.xlsx` + `!tests/fixtures/*.xlsx` + `tests/out/` + `Egary/backups/`, replace with the redacted `office-2026.xlsx`, pre-commit hook; `codes.js` switches to high-water marks. `CHAT-LOG.md` must not contain names/ids from the workbook (check-no-pii covers it) |
| R2 | Day-one credibility: September/October are empty for everyone | `enteredThrough` auto (2026-08) → those months are «بانتظار التسجيل», never late; default M = August; K09 tile and insight 9 keep real lateness visible; override in settings with a one-line explanation |
| R3 | The 25 % heuristic could hide a genuinely bad month | K09 always shows the pending count/amount; insight 9 fires after 2 months; the office can pin `enteredThrough` in settings |
| R4 | Migration restructures 13 rows into two (73 → 86) | announced in the preview card; inferred rows marked in notes and flagged; «تأكيد» button; Help explains with a picture |
| R5 | Inferred prior contracts' real start dates/rents before 2026 are unknown | start = `trackingFrom`, `confirmed=false`, «≈»; arrears never computed before 2026-01; `openingBalance` for known older debt |
| R6 | Row 67 end < start | treated as a year typo (2025-05-01 → 2026-04-30), unit 607 vacant since 2026-05-01, critical flag, G67 rewritten once and the original quoted |
| R7 | Text cell R65 | carried verbatim, no payment, `unreadable` (excluded from arrears), critical flag with «إدخال الرقم» |
| R8 | Split-day convention inconsistent by one day (row 5) | new rate starts on the anniversary day; the narrow split-day tolerance term absorbs it; overrides for true exceptions |
| R9 | Late-applied increases (403/406) | year `from` inferred as 2026-03-01 and flagged; no phantom arrears |
| R10 | Client identity: same person two passports; same company two tax ids; shared representative ids | rule §2.4; احمد هاشم stays two + «دمج»; ايجل merged + flag; representatives never merge companies; identity snapshot keeps every ledger row's D/I/J |
| R11 | Deposits unknown for all migrated contracts | `unrecorded` (never a fake 0); K15 shows «N عقد بلا تأمين مسجّل»; the form never auto-fills a deposit |
| R12 | Unit types cannot be inferred for 3-digit units | إدارية default, one flag per project, bulk «تعيين النوع» action; garages supported from day one (`P03-G5`) |
| R13 | ExcelJS regenerates every part on write and silently drops charts/pivots/slicers/macros/shapes/sparklines/x14 formats | zip guard (directory + content scans) → read-only + export copy; README asks to keep charts and shapes elsewhere; the promise is the verified survivor list of §3.6 (images and legacy comments included) |
| R14 | OneDrive/Google Drive renames and locks during save | path check warning on link; two-tick stability; missing-file state with relink; backups |
| R15 | Permission prompt per launch: persisted File System Access grants are **not verified** for `file://` `--app` pages | copy promises «متابعة» + «السماح» each launch (§1.4); M-04 decides whether the wording relaxes to «أول مرة بس» |
| R16 | Plan B (double-click `app\index.html`) uses another profile | `via=bat` detection + banner + Help rule «افتح دايمًا من Open-Egary.bat»; plan B is also the e-mail delivery path (§1.7) |
| R17 | `.bat` on paths with Arabic characters or a OneDrive-redirected Desktop; SmartScreen | ASCII-only batch, `%~dp0` runtime expansion, default-browser fallback line, Help line «لو ما فتحش حاجة اضغط مرتين على index.html»; SmartScreen illustration |
| R18 | Mark-of-the-Web may block `file://` storage | detection + «Unblock» illustration |
| R19 | Two people on a shared drive | optimistic concurrency + device label; recommended single operator; §4.6.5 |
| R20 | «Electronic invoice» might mean ETA e-invoicing | out of scope; numbered printable invoices; `ref` reserved for an ETA UUID |
| R21 | «Collected this month» semantics | ledger period semantics (the office's habit); `#invoices` offers «حسب تاريخ السداد» |
| R22 | Quarterly or non-monthly rent | decided: `paySchedule` per contract (§5.2) books each window's dues on its first month; overrides remain for one-off exceptions |
| R23 | Excel serial vs time zone | UTC-only conversion; CI in two zones |
| R24 | Health score weights are arbitrary | labelled «مؤشر مركّب — تقديري», off the hero strip, explain drawer; weights fixed |
| R25 | Punctuality needs dates the ledger lacks | «غير كافٍ» until ≥ 3 dated payments per client; quick-pay defaults the date so it fills naturally |
| R26 | Vacant units are absent from the office's ledger | ledger stays tenancy rows (fidelity); «أظهر الشاغرة» toggle + footer link; BI buildings show them |
| R27 | Office-copied `2027` sheet with a different layout | accepted when the header row matches; normalised on first write; logged |
| R28 | Power BI refresh during a website save | README note; the write is atomic, so a refresh reads either the old or the new file, never a torn one |
| R29 | Legacy v1 code scheme (`P1-01`) | not imported; v2 scheme only |
| R30 | Printing from `file://` with popup blockers | in-page iframe printing; no `window.open` |
| R31 | A zip-level XML patcher would preserve everything ExcelJS loses | out of scope for v2; the zip guard refuses to write such files instead of damaging them; revisit if the office's workbooks grow shapes/sparklines |
| R32 | Trailing empty months are ambiguous (early vacate vs real arrears) | counted as `late` (money is never hidden) with `DQ-TRAILINGGAP` and one-click fixes; the K05 sub shows the unconfirmed share; day-one K05 = 135,566.67 |
| R33 | 15 contracts ended with nothing recorded after them | holdover status (§5.4): not vacant, not occupied, listed with «تجديد»; vacancy loss never estimated for them |
| R34 | The office's renewal habit (same row, new dates) would orphan the earlier months | G-moved-later rule (§3.7) splits the row like migration and links the contracts |
| R35 | E-mail strips the launcher | WhatsApp/Drive/USB delivery, README line 9, plan B, optional self-written `.bat` (M-05) |
| R36 | Excel Protected View silently discards edits | README line 11 + Help illustration; «Unblock» advice; no technical detection possible |
| R37 | `enteredThrough` flipping mid-batch | three-part auto rule + «قفل الشهر» (§5.2) |
| R38 | Cross-sheet edits of the same fact | precedence table §4.6.6 + `DQ-FIELDCONFLICT` |

---

## 10. Implementation file list (one-line responsibilities)

Shipped folder `Egary/` (the scaffold's `index.html`, `bi.html`, `assets/`, `powerbi/`, `Open-Egary-BI.bat` move under `app/`; `README-AR.txt` and `اقرأني-أولا.txt` are deleted; `Egary.xlsx` is untracked):

| path | responsibility |
|---|---|
| `Open-Egary.bat` | §1.2 launcher: zip/Temp guard, Edge/Chrome `--app` + dedicated profile, registry App Paths, `?via=bat`, default-browser fallback |
| `README.txt` | §1.6 (14 lines) |
| `app/Open-Egary-BI.bat` | same launcher for `bi.html` |
| `app/index.html` | shell, inline theme script, script tags in dependency order (`?test=1`, `?shot=1`, `?nofs=1`, `?via=bat` honoured) |
| `app/bi.html` | BI shell; same core scripts + `bi/*`; read-only; no lock |
| `app/Help.html` | Arabic guide: the five promises, 5 illustrations (SmartScreen, folder picker, Allow prompt, Unblock/Protected View, Extract All), error states, «افتح دايمًا من Open-Egary.bat», the 73 → 86 explanation, holdover/trailing-gap explanation, the update procedure, the «كل الأعمدة» note |
| `app/powerbi/Egary.pq`, `Egary-measures.dax`, `Egary-theme.json`, `Egary-theme-dark.json`, `README-PowerBI.txt` | §7.4 |
| `assets/css/tokens.css` | §6.9 tokens, light/dark, cell colours, focus ring |
| `assets/css/app.css` | shell, sidebar/rail/tab bar, tiles, tables, drawers, modals, forms, chips, toasts, responsive rules |
| `assets/css/ledger.css` | the grid: sticky columns/rows, cell states, ghost amounts, popover, bottom sheet |
| `assets/css/print.css` | A5 invoice, A4 statement, ledger print |
| `assets/css/bi.css` | scene layers, windows, glass tiles, day theme, reduced motion |
| `assets/fonts/*` | IBM Plex Sans Arabic woff2 + OFL |
| `assets/img/*` | logo, 4 Help illustrations (SVG), far skyline |
| `assets/vendor/exceljs.min.js` | ExcelJS 4.4.0 |
| `assets/js/core/util.js` | UTC dates, periods, number parse/format, `normalize`, `foldCode`, `cellText`, `numberToArabicWords`, hashing helpers |
| `assets/js/core/model.js` | entity blanks, enum lists (ASCII key ⇄ Arabic), `emptyState`, `validate(entity, record, state)` with Arabic messages, asset catalog |
| `assets/js/core/codes.js` | high-water-mark generators, `unitCode/parseLabel/inferFloor/inferType/kindOf`, natural-key matching helpers |
| `assets/js/core/store.js` | state container + indexes, pure `apply(state, command)` with `expect` checks and audit lines, `dependents/cascade`, identity-snapshot rule, client/project/unit merge, reassign, split, renew, settle, linked adjust |
| `assets/js/core/engine.js` | years/proposeYears, D30 proration, payment schedules, tolerance, `cell()`, enteredThrough (three-part rule), contract/unit statuses incl. holdover, trailing-gap runs, vacancy, successors, balances/arrears/aging |
| `assets/js/core/kpi.js` | K01–K30 as `{ value, evidence, go }` with `value = reduce(evidence)`; scope/filters; month series |
| `assets/js/core/insights.js` | insight cards with triggers and drills |
| `assets/js/core/flags.js` | DQ rules, deterministic ids, resolution merge |
| `assets/js/core/search.js` | search index, token-AND ranking, code routing |
| `assets/js/xlsx/zipguard.js` | zip central-directory scan, read-only reasons, `.xlsm` refusal |
| `assets/js/xlsx/workbook.js` | `decode(wb)`/`encode(state, raw, lastWb)`: sheet map, headers, styles, validations, القوائم, computed sheets, in-place patching, template workbook |
| `assets/js/xlsx/ledger.js` | ledger year sheets: read rows, row ↔ contract binding, write rows in place, totals/W, summary ranges and B1 rename, style cloning, year-sheet creation/recognition (past and future), below-totals carry-over, hidden-row notice |
| `assets/js/xlsx/rebase.js` | §3.6 reference re-basing on row insert/removal: formulas (all sheets), CF/DV ranges, merges, defined names, AutoFilter, print areas |
| `assets/js/xlsx/migrate.js` | §3.8 legacy migration (pure) + preview counts; §3.9 rebuild-from-ledger |
| `assets/js/xlsx/reconcile.js` | §4.6.3 ledger ⇄ payments matrix, attribution against the snapshot, rows-without-code binding |
| `assets/js/sync/adapters.js` | `FolderAdapter`, `FileAdapter`, `MemoryAdapter`, `DownloadAdapter` (§4.1) + IndexedDB handle storage |
| `assets/js/sync/journal.js` | IndexedDB command journal + snapshot store + `egary.undo` full-before store + `egary.meta` mirror + storage persistence request |
| `assets/js/sync/backups.js` | naming, policy, retention, restore |
| `assets/js/sync/sync.js` | `SyncController`: polling, stability, lock-file pill, write pipeline, verify, conflicts, status events |
| `assets/js/sync/lock.js` | single-instance guard (Web Locks + BroadcastChannel takeover) |
| `assets/js/ui/dom.js` | `h()`, SVG helpers, icons, keyed list reconciliation, focus trap, region rules |
| `assets/js/ui/format.js` | money/percent/date/period formatting, status chips, code chips |
| `assets/js/ui/toast.js` | toasts with undo, `aria-live` |
| `assets/js/ui/modal.js` | dialogs, delete confirmation with computed consequences and checkbox gate, settlement modal |
| `assets/js/ui/drawer.js` | drawers (forms, evidence, cell, changes, sync, conflicts) |
| `assets/js/ui/combo.js` | searchable combos (client/unit/contract pickers) |
| `assets/js/ui/grid.js` | the ledger grid component: cells, quick-pay popover, keyboard, bulk collect, patch-by-cell |
| `assets/js/ui/charts.js` | SVG charts (bars, lines, donut, aging, Gantt, building elevation) with tooltips and a11y |
| `assets/js/ui/forms.js` | all forms of §6.5, validation display, contract wizard, asset checklist |
| `assets/js/ui/print.js` | invoice/statement templates, iframe printing, Arabic words |
| `assets/js/ui/coach.js` | one-time coach overlay, device-label prompt, plan-B banner |
| `assets/js/ui/filters.js` | slicer bar, URL query ⇄ filter state, chips, counts |
| `assets/js/pages/welcome.js` | first run, folder validation, migration preview, relink, error states |
| `assets/js/pages/dashboard.js` | §6.2 |
| `assets/js/pages/ledger.js` | §6.3 page around the grid |
| `assets/js/pages/projects.js`, `units.js`, `clients.js`, `contracts.js`, `invoices.js`, `maintenance.js` | lists + profiles of §6.7 |
| `assets/js/pages/reviews.js` | flags page with fix buttons |
| `assets/js/pages/settings.js` | settings, sync drawer contents, backups, device, relink, danger zone |
| `assets/js/pages/search.js` | full results page |
| `assets/js/bi/scene.js` | layers, buildings from data, windows, entrance, day theme, perf overlay |
| `assets/js/bi/parallax.js` | pointer/orientation → CSS variables, idle rAF discipline |
| `assets/js/bi/tiles.js` | tabs, tiles, charts wiring to `kpi()` |
| `assets/js/bi/evidence.js` | evidence panel + deep links to the website |
| `assets/js/bi/bi-app.js` | BI boot: link restore, shared lock, polling (read-only) |
| `assets/js/app.js` | website boot: lock, link restore, migration flow, router, page lifecycle, 60-s/midnight recompute |

Repo-only:

| path | responsibility |
|---|---|
| `tests/load.js` | evaluates the browser IIFEs into a `window` stub for Node |
| `tests/unit/*.test.mjs` | §8.2, §8.4 |
| `tests/xlsx/*.test.mjs` | §8.3 |
| `tests/e2e/*.spec.mjs` | §8.5 |
| `tests/oracle/kpis.py`, `check_workbook.py`, `edit_cell.py`, `add_row.py`, `delete_row.py`, `rename_client.py` | independent openpyxl oracle and Excel-user simulators |
| `tests/fixtures/make-fixture.py`, `office-2026.xlsx`, `mini.xlsx`, `gen.js`, `expect.json`, `README.md` | redacted fixture and ground truth |
| `tools/pack.mjs` | builds `Egary-YYYY-MM-DD.zip` (top-level `Open-Egary.bat`, `README.txt`, `app/`; never `backups/`; a workbook only with `--workbook <path>` for a private hand-off) |
| `tools/check-no-pii.mjs`, `.githooks/pre-commit` | PII guards |
| `tools/recalc.sh` | LibreOffice headless recalculation check |
| `.github/workflows/ci.yml` | node + oracle + e2e, two time zones, c8 gate |
| `docs/manual-checks.md` | the §8.7 list M-01…M-16 with steps and expected results |
| `CHAT-LOG.md` | the conversation record (no names/ids from the workbook) |
