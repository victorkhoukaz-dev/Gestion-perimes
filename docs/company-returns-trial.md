# Company Returns trial

## Scope

This feature starts from main and is independent of integration's generics work.
It reuses the existing html5-qrcode library and the signed-in pharmacy's loaded
catalogue. It never writes to the catalogue, expiry inventory or Supabase.

Reports and in-progress entries save in localStorage under
pharmaops:company-returns:v1:<pharmacy-id>. They stay in that browser on that
device; they do not sync to a computer or another phone. Use Print / Save PDF
to keep a report outside the browser. No prices, credits or financial totals.

## Test from the full app

Open the Company Returns - Test Branch folder and double-click
Test on computer.bat. Keep its window open. It starts only this branch's App
folder at http://127.0.0.1:8084/index.html and opens the browser.

Sign in normally, open Expires Labo, then select Company Returns. On a phone,
the bottom navigation button is called Returns. Company Returns is no longer a
separate card on the PharmaOps hub.

Start with a company named TEST - Apotex. Add a test product manually, with a lot,
expiry month/year, quantity and unit. Save, edit the line, change tabs, reload,
and inspect Print / Save PDF. No barcode or camera is required for this check.
Close the launcher window when done.

For phone testing, first close the computer test window, then double-click
Test on phone.bat. It starts the same App-only local server and uses SSH through
localhost.run to display a temporary HTTPS address. Open that address on the
phone, with /index.html at the end. Sign in and open Expires Labo > Returns.
Keep the computer awake and the launcher window open. Ctrl+C ends the tunnel.

The temporary address makes this test app reachable over the internet; it does
not deploy to GitHub Pages or change main. Normal app authentication still applies.
The launcher does not expose the repository root or operational export folders.

Computer and phone drafts do not sync. Browser storage is also tied to the exact
test URL, so a different temporary address will not show drafts from an earlier
address. Save the PDF before ending a trial you want to retain.

## Optional synthetic desktop preview

From this checkout:

    python -m http.server 8083 --bind 127.0.0.1

Open http://127.0.0.1:8083/scratch/company-returns-preview.html for a synthetic
preview with no login or cloud connection. Its draft key is separate from real
pharmacy keys. Example 2D input:

    (01)00012345678905(17)260930(10)TEST-A(21)SERIAL1

Use http://127.0.0.1:8083/App/index.html for the signed-in app integration.
Do not test destructive inventory operations against the live pharmacy.

## Real-package acceptance check before release

1. Start Test on phone.bat and use its HTTPS address on the phone; plain LAN HTTP
   cannot access the camera.
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

- Ten offline tests pass, including parsing, decimal totals, pharmacy
  separation, stale writes, corrupt storage and failed saves.
- Chrome synthetic preview: autofill; Enter-to-save and barcode refocus;
  repeated scans add quantities; separate lots; edit and reload; multiple
  reports and switching; drafts persist across reload.
- Phone-width preview at 390px: no horizontal document overflow.
- Full signed-in app: desktop Company Returns tab, mobile Returns button, and
  draft preservation across navigation checked. No cloud inventory edits made.
- Computer launcher: local App-only server startup, page readiness and shutdown
  tested. Phone launcher syntax checked; external tunnel not started.
- A pre-existing main-branch service worker quoting error was corrected.
  Cache names/cleanup are scoped to the app location to protect sibling previews.
- Actual phone-camera scanning and native printed/PDF output are still pending.
