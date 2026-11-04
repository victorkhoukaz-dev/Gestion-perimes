const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync(path.join(__dirname, '../App/index.html'), 'utf8');
const section = html.slice(html.indexOf('    <div class="tab-content active" id="tab-retrait">'), html.indexOf('    <div class="tab-content" id="tab-tournee">'));
const dialog = html.match(/  <dialog id="withdrawal-print-dialog"[\s\S]*?<\/dialog>/)[0];
const functions = html.slice(html.indexOf('    function normalizeWithdrawalSearch('), html.indexOf('    function handleChecklistAction('));
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
      setupWithdrawalControls(); renderChecklist();
    ` });
    const count = () => page.locator('#checklist-container .product-row').count();
    assert.equal(await count(), 3);
    await page.locator('#withdrawal-search').fill('acetaminophen 500');
    assert.equal(await count(), 2, 'accent-insensitive multi-term search');
    await page.locator('#withdrawal-show-removed').uncheck();
    assert.equal(await count(), 1, 'search combines with status filter');
    assert.equal(await page.locator('#stat-total-target').textContent(), '3');
    await page.locator('#withdrawal-search').fill('07654321');
    assert.equal(await count(), 1, 'DIN search');
    await page.locator('#withdrawal-show-sold').uncheck();
    assert.equal(await count(), 0);
    assert.match(await page.locator('#checklist-container').textContent(), /Aucun produit ne correspond/);
    await page.locator('#withdrawal-print-open').click();
    assert.equal(await page.locator('#withdrawal-print-confirm').isDisabled(), true);
    await page.locator('#withdrawal-print-cancel').click();
    await page.locator('#withdrawal-search').fill('');
    await page.locator('#withdrawal-show-removed').check();
    await page.locator('#withdrawal-show-sold').check();
    await page.evaluate(() => selectedBatchIds.add('1'));
    await page.locator('#withdrawal-search').fill('500');
    assert.equal(await page.evaluate(() => selectedBatchIds.size), 0, 'filter changes clear bulk selections');
    await page.locator('#withdrawal-search').fill('');
    await page.locator('#withdrawal-collapse').click();
    assert.equal(await page.locator('.withdrawal-section-body:visible').count(), 0);
    await page.locator('#withdrawal-section').selectOption('B');
    assert.equal(await page.locator('.section-group[data-section="B"] .withdrawal-section-toggle').getAttribute('aria-expanded'), 'true');
    await page.evaluate(() => renderChecklist());
    assert.equal(await page.locator('.section-group[data-section="A"] .withdrawal-section-body').isVisible(), false, 'collapse state survives render');
    await page.locator('#withdrawal-expand').click();
    assert.equal(await page.locator('.withdrawal-section-body:visible').count(), 2);
    await page.locator('#withdrawal-collapse').click();
    await page.locator('#withdrawal-print-open').click();
    await page.locator('#withdrawal-print-none').click();
    assert.equal(await page.locator('#withdrawal-print-confirm').isDisabled(), true);
    await page.locator('#withdrawal-print-all').click();
    assert.equal(await page.locator('#withdrawal-print-confirm').isDisabled(), false);
    await page.locator('#withdrawal-print-options input[value="B"]').uncheck();
    await page.evaluate(() => { window.print = () => { window.printed = Array.from(document.querySelectorAll('.section-group:not(.withdrawal-print-excluded)'), group => group.dataset.section); }; });
    await page.locator('#withdrawal-print-confirm').click();
    assert.deepEqual(await page.evaluate(() => window.printed), ['A']);
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('.section-group[data-section="A"] .product-row:visible').count(), 2, 'collapsed rows print');
    assert.equal(await page.locator('.section-group[data-section="B"]').isVisible(), false, 'unselected section excluded from print');
    assert.equal(await page.locator('.withdrawal-controls').isVisible(), false);
    await page.screenshot({ path: path.join(__dirname, 'withdrawal-print-preview.png'), fullPage: true });
    await page.pdf({ path: path.join(__dirname, 'withdrawal-print-preview.pdf'), format: 'A4' });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await page.emulateMedia({ media: 'screen' });
    assert.equal(await page.locator('.withdrawal-print-excluded').count(), 0);
    assert.equal(await page.locator('.withdrawal-section-body:visible').count(), 0, 'print preserves collapsed state');
    await page.locator('#withdrawal-expand').click();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'mobile has no horizontal overflow');
    await page.screenshot({ path: path.join(__dirname, 'withdrawal-mobile-preview.png'), fullPage: true });
    await page.evaluate(() => { state.targetMonthDate = new Date(2028, 0, 1); renderChecklist(); });
    assert.equal(await page.locator('#withdrawal-section option').count(), 1, 'empty month clears navigation');
    assert.equal(await page.locator('#withdrawal-result-count').textContent(), '0 produit affiché sur 0');
    assert.equal(await page.evaluate(() => JSON.stringify(state.products) === originalProducts), true, 'product records unchanged');
    assert.deepEqual(errors, []);
    console.log('PASS: search, combined status filters, totals, empty states, bulk selection safety, navigation, collapse persistence, print selection, print CSS, print cleanup, mobile width, and unchanged records.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

