const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync(path.join(__dirname, '../App/index.html'), 'utf8');
const section = html.slice(html.indexOf('    <div class="tab-content active" id="tab-retrait">'), html.indexOf('    <div class="tab-content" id="tab-tournee">'));
const dialog = '';
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
    await page.locator('#withdrawal-search').fill('500');
    await page.evaluate(() => renderChecklist());
    assert.equal(await count(), 2, 'refresh preserves query');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'mobile width');
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('#withdrawal-search').isVisible(), false, 'search controls do not print');
    assert.equal(await page.locator('#checklist-container .product-row:visible').count(), 2, 'printing respects search');
    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => { state.targetMonthDate = new Date(2028, 0, 1); renderChecklist(); });
    assert.equal(await count(), 0, 'empty month');
    assert.equal(await page.locator('#withdrawal-search-count').textContent(), '0 produit(s) affiché(s) sur 0');
    assert.equal(await page.evaluate(() => JSON.stringify(state.products) === originalProducts), true, 'records unchanged');
    assert.deepEqual(errors, []);
    console.log('PASS: medication search, DIN/strength/format, empty states, monthly totals, selection safety, refresh, mobile, print, and unchanged records.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
