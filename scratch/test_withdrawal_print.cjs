// Synthetic, offline print regression. Optional PDF output enables visual QA.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync(path.join(__dirname, '../App/index.html'), 'utf8');
const printCss = fs.readFileSync(path.join(__dirname, '../App/withdrawal-print.css'), 'utf8');
const styles = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map(m => m[0]).join('');
const main = html.slice(html.indexOf('  <div id="main-app-wrapper"'), html.indexOf('  </div> <!-- FIN DU main-app-wrapper -->') + '  </div>'.length);
const functions = html.slice(html.indexOf('    function matchesWithdrawalSearch('), html.indexOf('    function handleChecklistAction('));
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent(`<html lang="fr"><head><meta charset="utf-8">${styles}<style>${printCss}</style></head><body>${main}</body></html>`);
    await page.addScriptTag({ content: `
      const state = { targetMonthDate: new Date(2027, 0, 1), currentDate: new Date(2027, 0, 1), products: Array.from({length:72}, (_, i) => ({
        id: String(i), product: 'MÉDICAMENT EXEMPLE ' + String(i + 1).padStart(3, '0'),
        din: String(1234500 + i).padStart(8, '0'), dosage: i === 1 ? '150/37,5/200 mg' : '10 mg',
        quantity: i === 0 ? 0 : (i % 4) + 1, format:'FORMAT INUTILE SUR PAPIER',
        section: i < 60 ? 'A - Laboratoire' : 'B - Réserve', expiryDate:'2027-01',
        status:i === 1 ? 'removed' : i === 2 ? 'sold' : 'active', removedBy:'SB', techInitials:'INITIALS_NOT_FOR_PRINT',
        notes:i % 11 === 0 ? 'Vérifier le tiroir et la réserve avant de terminer.' : ''
      })) };
      state.products[3].product = 'PRODUIT AVEC UN NOM TRÈS LONG POUR VÉRIFIER LE RETOUR À LA LIGNE SANS COUPURE';
      const originalProducts = JSON.stringify(state.products);
      const selectedBatchIds = new Set(), collapsedWithdrawalSections = new Set(['A - Laboratoire']);
      function updateBatchActionBar() {}
      function getStickerInfo() { return { color:'#eee', name:'COULEUR À MASQUER' }; }
      function formatFullDateFrench() { return ''; }
      function formatMonthYearFrench() { return 'Janvier 2027'; }
      function handleChecklistAction() { throw Error('Unexpected write'); }
      function undoChecklistAction() { throw Error('Unexpected write'); }
      ${functions}
      document.getElementById('main-app-wrapper').style.display = 'block';
      document.getElementById('print-month-title').textContent = 'Mois à retirer : Janvier 2027';
      document.getElementById('print-pharmacy-subtitle').textContent = 'Pharmacie de démonstration';
      document.getElementById('print-date-subtitle').textContent = 'Imprimé le : 16 novembre 2026';
      document.getElementById('withdrawal-show-resolved').checked = true; // Explicitly include all statuses for print coverage.
      renderChecklist();
    ` });
    assert.equal(await page.locator('.withdrawal-print-table:visible').count(), 0, 'paper table hidden on screen');
    await page.emulateMedia({ media: 'print' });
    const rows = page.locator('.withdrawal-print-table tbody tr');
    assert.equal(await rows.count(), 72);
    assert.equal(await page.locator('.withdrawal-print-table:visible').count(), 2);
    assert.equal(await page.locator('.product-row:visible').count(), 0, 'screen cards never print');
    assert.equal(await page.locator('.sticker-badge:visible').count(), 0);
    assert.equal(await page.locator('.batch-select-cb:visible').count(), 0);
    assert.equal(await page.locator('.withdrawal-print-table thead').first().evaluate(el => getComputedStyle(el).display), 'table-header-group');
    assert.deepEqual(await rows.first().locator('td').allTextContents(), [
      'MÉDICAMENT EXEMPLE 001 — Note : Vérifier le tiroir et la réserve avant de terminer.', '01234500', '10 mg', '0', '__', '__'
    ]);
    assert.equal(await rows.filter({ hasText: 'MÉDICAMENT EXEMPLE 002' }).locator('td').nth(4).textContent(), '✓ SB');
    assert.equal(await rows.filter({ hasText: 'MÉDICAMENT EXEMPLE 003' }).locator('td').nth(5).textContent(), '✓ SB');
    const ordinaryHeight = await rows.nth(4).evaluate(el => el.getBoundingClientRect().height);
    assert.ok(ordinaryHeight < 26, `compact one-line row: ${ordinaryHeight}px`);
    const overflows = await page.locator('.withdrawal-print-table td').evaluateAll(cells => cells.filter(cell => cell.scrollWidth > cell.clientWidth + 1).map(cell => cell.textContent));
    assert.deepEqual(overflows, [], 'no clipped DIN, dose, notes or long names');
    const pdf = process.env.WITHDRAWAL_PDF_OUTPUT;
    if (pdf) {
      fs.mkdirSync(path.dirname(pdf), { recursive: true });
      await page.pdf({ path: pdf, format: 'Letter', printBackground: true, preferCSSPageSize: true });
      console.log('Letter PDF:', pdf);
      await page.pdf({ path: pdf.replace(/\.pdf$/, '-a4.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
    }
    await page.evaluate(() => document.querySelector('.section-group').classList.add('withdrawal-print-excluded'));
    assert.equal(await page.locator('.withdrawal-print-table tbody tr:visible').count(), 12, 'section selection still applies');
    await page.emulateMedia({ media: 'screen' });
    assert.equal(await page.locator('.withdrawal-section-body').first().isVisible(), false, 'collapse state preserved');
    assert.equal(await page.evaluate(() => JSON.stringify(state.products) === originalProducts), true);
    assert.deepEqual(errors, []);
    console.log('PASS: compact rows, notes, DIN/dose/quantity, writing lines, saved statuses, repeating table headers, section selection, unclipped text and unchanged records.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
