# Company Returns trial

## Scope

This feature starts from main and is independent of integration's generics work.
It reuses the existing html5-qrcode library and the signed-in pharmacy's loaded
catalogue. It never writes to the catalogue, expiry inventory or Supabase.

Reports and in-progress entries save in localStorage under
pharmaops:company-returns:v1:<pharmacy-id>. They stay in that browser on that
device; they do not sync to a computer or another phone. Use Print / Save PDF
to keep a report outside the browser. No prices, credits or financial totals.

## Desktop preview

From this checkout:

    python -m http.server 8083 --bind 127.0.0.1

Open http://127.0.0.1:8083/scratch/company-returns-preview.html for a synthetic
preview with no login or cloud connection. Its draft key is separate from real
pharmacy keys. Example 2D input:

    (01)00012345678905(17)260930(10)TEST-A(21)SERIAL1

Use http://127.0.0.1:8083/App/index.html for the signed-in app integration.
Do not test destructive inventory operations against the live pharmacy.

## Real-package acceptance check before release

1. Use a secure HTTPS test address on the phone; plain LAN HTTP cannot access
   the camera. Set up temporary phone access separately from the production site.
2. Sign in, open Company Returns from the hub, and enter Apotex as the company.
3. Scan 5-10 real packages; compare DIN/name, strength, format, lot and expiry
   month/year with each package. Unknown products must remain manually editable.
4. Enter quantities and units. Rescanning the same product/strength/format/lot/
   expiry/unit should add quantities. Different lots/expiries must stay separate.
5. Read a plain UPC after a 2D code: previous lot/expiry must not be retained.
6. Close/reopen the page and verify reports and unfinished entries persist.
   Edit a line, reload during editing, then save: quantity should be replaced.
7. Print / Save PDF and inspect pharmacy, company, date, every line, and page
   breaks. Entry controls and other app screens must not print.
8. Check the original expiry workflow still scans, focuses Quantity, and saves
   with Enter. The original scanner implementation is unchanged.

## Automated checks

    node --test scratch/test_company_returns.cjs
    node --check App/company-returns-data.js
    node --check App/company-returns.js

Also run AGENTS.md's required inline-JavaScript syntax check for App/index.html.

## Release path

Commit and review only Company Returns changes on codex/company-returns.
After the real-package and PDF checks pass, merge that feature into main and
verify GitHub Pages deployment. Do not merge integration into main. Then merge
the updated main into integration, retaining the generics work there.

## Verification at the first local checkpoint

- Eight offline data tests pass, including parsing, decimal totals, pharmacy
  separation, stale writes, corrupt storage and failed saves.
- Chrome synthetic preview: autofill; Enter-to-save and barcode refocus;
  repeated scans add quantities; separate lots; edit and reload; multiple
  reports and switching; drafts persist across reload.
- Phone-width preview at 390px: no horizontal document overflow.
- Actual phone-camera scanning and native printed/PDF output are still pending.
