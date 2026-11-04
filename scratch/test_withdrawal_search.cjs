const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync(path.join(__dirname, '../App/index.html'), 'utf8');
const section = html.slice(html.indexOf('    <div class="tab-content active" id="tab-retrait">'), html.indexOf('    <div class="tab-content" id="tab-tournee">'));
const dialog = html.match(/  <dialog id="withdrawal-print-dialog"[\s\S]*?<\/dialog>/)[0];
const functions = html.slice(html.indexOf('    function matchesWithdrawalSearch('), html.indexOf('    function handleChecklistAction('));
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<html><head>' + [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map(m => m[0]).join('') + '</head><body><div class="container">' + section + '</div>' + dialog + '</body></html>');
    await page.addScriptTag({ content: `
      const state = { targetMonthDate: new Date(2027, 0, 1), currentDate: new Date(2027, 0, 1), products: [
        { id: '1', product: 'Acétaminophen', din: '01234567', dosage: '500 mg', format: '100 tablets', section: 'A', expiryDate: '2027-01', status: 'active', quantity: 10 },
        { id: '2', product: 'Acétaminophen', din: '01234567', dosage: '500 mg', section: 'A', expiryDate: '2027-01', status: 'removed', quantity: 20 },
        { id: '3', product: 'Ibuprofen', din: '07654321', dosage: '200 mg', section: 'B', expiryDate: '2027-01', status: 'sold', quantity: 30 },
        { id: '4', product: 'Other month', section: 'C', expiryDate: '2027-02', status: 'active' }
      ] };
      const originalProducts = JSON.stringify(state.products);
      const selectedBatchIds = new Set();
      const collapsedWithdrawalSections = new Set();
      function updateBatchActionBar() {}
      function getStickerInfo() { return { color: '#eee', name: 'January' }; }
      function formatFullDateFrench() { return ''; }
      function formatMonthYearFrench() { return 'January 2027'; }
      function handleChecklistAction() { throw Error('Unexpected write'); }
      function undoChecklistAction() { throw Error('Unexpected write'); }
      ${functions}
      ${html.slice(html.indexOf('      // Medication search'), html.indexOf('      // Navigation des mois de retrait'))}
      renderChecklist();
    ` });
    const count = () => page.locator('#checklist-container .product-row').count();
    assert.equal(await count(), 3);
    await page.evaluate(() => selectedBatchIds.add('1'));
    await page.locator('#withdrawal-search').fill('acetaminophen 500');
    assert.equal(await count(), 2, 'accent-insensitive partial and multi-term search');
    assert.equal(await page.evaluate(() => selectedBatchIds.size), 0, 'search clears bulk selections');
    assert.equal(await page.locator('#stat-total-target').textContent(), '3');
    assert.equal(await page.locator('#stat-removed-count').textContent(), '2');
    assert.equal(await page.locator('#stat-remaining-count').textContent(), '1');
    await page.locator('#withdrawal-search').fill('07654321');
    assert.equal(await count(), 1, 'DIN search includes resolved products');
    await page.locator('#withdrawal-search').fill('100 tablets');
    assert.equal(await count(), 1, 'format search');
    await page.locator('#withdrawal-search').fill('missing medicine');
    assert.equal(await count(), 0);
    assert.match(await page.locator('#checklist-container').textContent(), /Aucun produit ne correspond/);
    await page.locator('#withdrawal-search').fill('');
    assert.equal(await count(), 3, 'clearing restores all monthly products');
    await page.evaluate(() => selectedBatchIds.add('1'));
    await page.locator('#withdrawal-show-resolved').uncheck();
    assert.equal(await count(), 1, 'combined filter hides both withdrawn and sold products');
    assert.equal(await page.evaluate(() => selectedBatchIds.size), 0, 'status filter clears bulk selections');
    assert.equal(await page.locator('#withdrawal-section option').count(), 2, 'navigation contains only visible sections');
    await page.locator('#withdrawal-search').fill('ibuprofen');
    assert.equal(await count(), 0, 'search combines with status filters');
    await page.locator('#withdrawal-show-resolved').check();
    assert.equal(await count(), 1);
    await page.locator('#withdrawal-search').fill('');
    assert.equal(await count(), 3);
    assert.equal(await page.locator('#stat-total-target').textContent(), '3', 'monthly total unchanged');
    await page.locator('#withdrawal-collapse').click();
    assert.equal(await page.locator('.withdrawal-section-body:visible').count(), 0);
    await page.locator('#withdrawal-section').selectOption('B');
    assert.equal(await page.locator('.section-group[data-section="B"] .withdrawal-section-toggle').getAttribute('aria-expanded'), 'true');
    await page.evaluate(() => renderChecklist());
    assert.equal(await page.locator('.section-group[data-section="A"] .withdrawal-section-body').isVisible(), false, 'collapse survives refresh');
    await page.locator('.section-group[data-section="A"] .withdrawal-section-toggle').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.section-group[data-section="A"] .withdrawal-section-body').isVisible(), true, 'keyboard expands section');
    await page.locator('#withdrawal-expand').click();
    assert.equal(await page.locator('.withdrawal-section-body:visible').count(), 2);
    await page.locator('#withdrawal-collapse').click();
    await page.locator('#withdrawal-print-open').click();
    assert.equal(await page.locator('#withdrawal-print-options input').count(), 2, 'print lists visible sections');
    await page.locator('#withdrawal-print-none').click();
    assert.equal(await page.locator('#withdrawal-print-confirm').isDisabled(), true, 'empty selection cannot print');
    await page.locator('#withdrawal-print-all').click();
    assert.equal(await page.locator('#withdrawal-print-confirm').isDisabled(), false);
    await page.locator('#withdrawal-print-options input[value="B"]').uncheck();
    await page.evaluate(() => { window.print = () => { window.printed = Array.from(document.querySelectorAll('.section-group:not(.withdrawal-print-excluded)'), group => group.dataset.section); }; });
    await page.locator('#withdrawal-print-confirm').click();
    assert.deepEqual(await page.evaluate(() => window.printed), ['A'], 'print selects only requested sections');
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('.section-group[data-section="A"] .product-row:visible').count(), 2, 'collapsed selected rows print');
    assert.equal(await page.locator('.section-group[data-section="B"]').isVisible(), false, 'other section excluded');
    assert.equal(await page.locator('#withdrawal-print-dialog').isVisible(), false);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await page.emulateMedia({ media: 'screen' });
    assert.equal(await page.locator('.withdrawal-print-excluded').count(), 0, 'print cleanup restores normal printing');
    assert.equal(await page.locator('.withdrawal-section-body:visible').count(), 0, 'print preserves collapse state');
    await page.locator('#withdrawal-print-open').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#withdrawal-print-dialog').isVisible(), false, 'Escape cancels dialog');
    assert.equal(await count(), 3, 'cancel preserves rows');
    await page.locator('#withdrawal-expand').click();
    await page.locator('#withdrawal-search').fill('500');
    await page.evaluate(() => renderChecklist());
    assert.equal(await count(), 2, 'refresh preserves query');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'mobile width');
    await page.screenshot({ path: path.join(__dirname, 'withdrawal-controls-preview.png'), fullPage: true });
    await page.locator('#withdrawal-print-open').click();
    assert.equal(await page.locator('#withdrawal-print-options input').count(), 1, 'print respects search');
    assert.match(await page.locator('#withdrawal-print-scope').textContent(), /500/);
    await page.screenshot({ path: path.join(__dirname, 'withdrawal-print-dialog-preview.png'), fullPage: true });
    await page.locator('#withdrawal-print-cancel').click();
    await page.locator('#withdrawal-show-resolved').uncheck();
    await page.locator('#withdrawal-print-open').click();
    assert.match(await page.locator('#withdrawal-print-options').textContent(), /A \(1\)/, 'print respects combined status filter');
    await page.locator('#withdrawal-print-cancel').click();
    await page.locator('#withdrawal-show-resolved').check();
    await page.locator('#withdrawal-collapse').click();
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('#withdrawal-search').isVisible(), false, 'search controls do not print');
    assert.equal(await page.locator('#checklist-container .product-row:visible').count(), 2, 'printing respects search');
    await page.emulateMedia({ media: 'screen' });
    assert.equal(await page.locator('.withdrawal-section-body:visible').count(), 0, 'printing preserves screen collapse state');
    await page.evaluate(() => { state.targetMonthDate = new Date(2028, 0, 1); renderChecklist(); });
    assert.equal(await count(), 0, 'empty month');
    assert.equal(await page.locator('#withdrawal-section option').count(), 1, 'empty month clears section navigation');
    assert.equal(await page.locator('#withdrawal-search-count').textContent(), '0 produit(s) affiché(s) sur 0');
    await page.locator('#withdrawal-print-open').click();
    assert.equal(await page.locator('#withdrawal-print-confirm').isDisabled(), true, 'empty month cannot print');
    await page.locator('#withdrawal-print-cancel').click();
    assert.equal(await page.evaluate(() => JSON.stringify(state.products) === originalProducts), true, 'records unchanged');
    assert.deepEqual(errors, []);
    console.log('PASS: search, combined status filter, section navigation, print selection, filter scope, collapsed printing, cancellation, cleanup, empty states, mobile, and unchanged records.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
