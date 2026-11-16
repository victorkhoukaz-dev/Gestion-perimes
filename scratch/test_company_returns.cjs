const { test } = require('node:test');
const assert = require('node:assert/strict');
const D = require('../App/company-returns-data.js');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const gtin = '00012345678905';
test('GS1 parenthesized data keeps lots separate from serials and uses month/year', () => {
    assert.deepEqual(D.parseBarcode('(01)' + gtin + '(17)261130(10)LOT-A(21)SERIAL'), { code: gtin, lot: 'LOT-A', expiry: '2026-11', gs1: true });
});
test('raw GS1 supports AIM prefixes, variable-order fields and FNC1 separators', () => {
    const result = D.parseBarcode(']d201' + gtin + '10A123\x1d1726120021SERIAL');
    assert.equal(result.lot, 'A123'); assert.equal(result.expiry, '2026-12');
    assert.equal(D.parseBarcode('01' + gtin + '1726093010LOT123').lot, 'LOT123');
});
test('plain UPCs and incomplete codes never fabricate lot or expiry', () => {
    assert.deepEqual(D.parseBarcode('012345678905'), { code: '012345678905', lot: '', expiry: '', gs1: false });
    assert.equal(D.parseBarcode('(01)' + gtin + '(17)261399').expiry, '');
    assert.equal(D.parseBarcode('(01)' + gtin).lot, '');
});
test('catalogue lookup supports leading zeroes, multiple UPCs and DIN; ambiguity stays manual', () => {
    const catalog = [{ din: '01234567', product: 'Example', upc: '012345678905; 999999999999', dosage: '10 mg', format: '100 tablets' }];
    assert.equal(D.findProduct(catalog, gtin, 'barcode').product, 'Example');
    assert.equal(D.findProduct(catalog, '999999999999').din, '01234567');
    assert.equal(D.findProduct(catalog, '01234567', 'din').strength, '10 mg');
    assert.equal(D.findProduct([...catalog, { din: '87654321', upc: '012345678905', product: 'Other' }], gtin, 'barcode'), null);
    assert.equal(D.findProduct(catalog, 'not a code'), null);
    assert.equal(D.findProduct([{ ...catalog[0], din: '1234567' }], '01234567', 'din').din, '01234567');
});
const entry = () => ({ code: gtin, din: '01234567', product: 'Example', strength: '10 mg', format: '100 tablets', lot: 'LOT-A', expiry: '2026-11', quantity: '0.1', unit: 'tablets' });
test('same product/lot/month/unit adds decimal quantities without mutating source lines', () => {
    const initial = D.addLine([], entry(), 'one');
    const next = D.addLine(initial, { ...entry(), quantity: '0.2' }, 'two');
    assert.equal(next.length, 1); assert.equal(next[0].quantity, 0.3); assert.equal(initial[0].quantity, 0.1);
    for (const change of [{ lot: 'LOT-B' }, { expiry: '2026-12' }, { unit: 'bottles' }, { strength: '20 mg' }, { format: '500 tablets' }]) {
        assert.equal(D.addLine(initial, { ...entry(), ...change }, 'two').length, 2);
    }
});
test('invalid or missing quantities, lots and months are rejected', () => {
    for (const change of [{ quantity: 0 }, { quantity: -1 }, { quantity: 'oops' }, { quantity: Infinity }, { lot: '' }, { expiry: '2026-13' }, { din: '12' }, { product: '' }]) {
        assert.throws(() => D.validateEntry({ ...entry(), ...change }));
    }
});
function storage() {
    const values = new Map();
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
test('reports reload, pharmacy keys remain separate and stale writes are rejected', () => {
    const s = storage(), value = { version: 1, activeId: 'one', reports: [{ id: 'one', company: 'Apotex', lines: D.addLine([], entry(), 'line') }] };
    const raw = D.saveReports(s, 'pharmacy-a', null, value);
    assert.deepEqual(D.loadReports(s, 'pharmacy-a').value, value);
    assert.equal(D.loadReports(s, 'pharmacy-b').value.reports.length, 0);
    assert.throws(() => D.saveReports(s, 'pharmacy-a', null, { reports: [] }), /autre onglet/);
    assert.equal(s.getItem('pharmacy-a'), raw);
});
test('storage failures and corrupt saved data never replace existing records', () => {
    const s = storage(); s.setItem('reports', '{invalid');
    assert.throws(() => D.loadReports(s, 'reports'));
    assert.equal(s.getItem('reports'), '{invalid');
    assert.throws(() => D.saveReports({ getItem: () => null, setItem: () => { throw new Error('Quota exceeded'); } }, 'reports', null, {}), /Quota/);
});

test('navigation activates both Returns buttons, opens the embedded tab, and blocks leaving on a failed save', () => {
    const html = fs.readFileSync(path.join(__dirname, '../App/index.html'), 'utf8');
    assert.equal((html.match(/data-tab="tab-company-returns"/g) || []).length, 2);
    assert.ok(!html.includes('onclick="openCompanyReturnsModule()"'));
    const start = html.indexOf('document.querySelectorAll(".tab-btn, .mobile-nav-item").forEach(btn => {');
    const end = html.indexOf('// Basculement de thème', start);
    assert.ok(start > 0 && end > start);
    const classList = () => {
        const values = new Set();
        return { add: value => values.add(value), remove: value => values.delete(value), contains: value => values.has(value) };
    };
    const ids = ['tab-retrait', 'tab-company-returns', 'tab-inventaire'];
    const buttons = [...ids, ...ids].map(id => ({ id, classList: classList(), getAttribute: () => id, addEventListener(event, handler) { this.click = handler; } }));
    const contents = Object.fromEntries(ids.map(id => [id, { classList: classList() }]));
    const header = { textContent: '' };
    let allowed = true, opened = 0, closed = 0;
    const document = {
        querySelectorAll(selector) {
            if (selector === '.tab-btn, .mobile-nav-item') return buttons;
            if (selector === '.tab-content') return Object.values(contents);
            const id = selector.match(/data-tab="([^"]+)"/)?.[1];
            return buttons.filter(button => button.id === id);
        },
        getElementById: id => id === 'mobile-section-header' ? header : contents[id]
    };
    vm.runInNewContext(html.slice(start, end), {
        document, window: { CompanyReturns: { canLeave: () => allowed, close: () => { closed++; } } },
        openCompanyReturnsModule: () => { opened++; }, populateSectionDropdowns() {}
    });
    buttons[1].click();
    assert.equal(opened, 1);
    assert.equal(header.textContent, 'Retours fabricants');
    assert.equal(buttons.filter(button => button.id === 'tab-company-returns' && button.classList.contains('active')).length, 2);
    assert.ok(contents['tab-company-returns'].classList.contains('active'));
    allowed = false;
    buttons[2].click();
    assert.equal(closed, 0);
    assert.ok(contents['tab-company-returns'].classList.contains('active'));
    allowed = true;
    buttons[2].click();
    assert.equal(closed, 1);
    assert.ok(contents['tab-inventaire'].classList.contains('active'));
});

test('service worker parses and cleans only older caches within its own app scope', async () => {
    const source = fs.readFileSync(path.join(__dirname, '../App/sw.js'), 'utf8');
    const scope = 'https://example.test/returns/App/';
    const suffix = '-' + encodeURIComponent(scope);
    const listeners = {}, deleted = [];
    vm.runInNewContext(source, {
        self: { registration: { scope }, addEventListener: (name, handler) => { listeners[name] = handler; }, clients: { claim: async () => {} } },
        caches: { keys: async () => ['expires-lab-v42' + suffix, source.match(/const CACHE_NAME = '([^']+)'/)[1] + encodeURIComponent(scope), 'expires-lab-v69', 'unrelated'], delete: async name => { deleted.push(name); } },
        console
    });
    let pending;
    listeners.activate({ waitUntil: promise => { pending = promise; } });
    await pending;
    assert.deepEqual(deleted, ['expires-lab-v42' + suffix]);
});
