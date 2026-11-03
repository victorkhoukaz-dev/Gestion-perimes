const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const D = require('../App/company-returns-data.js');
const html = fs.readFileSync(path.join(__dirname, '../App/index.html'), 'utf8');
function section(name, next) {
    const start = html.indexOf('    function ' + name + '(');
    const end = html.indexOf('    ' + next, start + 1);
    assert.ok(start > 0 && end > start, name);
    return html.slice(start, end);
}
class Element {
    constructor() {
        this.children = []; this.style = { display: 'none' }; this.value = '';
        const classes = new Set();
        this.classList = { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) };
    }
    set innerHTML(value) { this.markup = value; this.children = []; }
    get innerHTML() { return this.markup; }
    appendChild(child) { this.children.push(child); }
    setAttribute() {}
    addEventListener(name, callback) { this[name] = callback; }
    querySelectorAll() { return this.children; }
    scrollIntoView() {}
    dispatchEvent() {}
}
function setup() {
    const ids = Object.fromEntries(['form-din-suggestions', 'form-product-suggestions', 'cr-din-suggestions', 'cr-product-suggestions',
        'form-expiry', 'form-notes', 'camera-modal'].map(id => [id, new Element()]));
    const selected = [], lookups = [];
    const context = vm.createContext({
        document: { getElementById: id => ids[id], querySelectorAll: () => Object.values(ids).filter(item => item !== ids['camera-modal']), createElement: () => new Element() },
        window: { CompanyReturnsData: D }, console, Event: class {},
        localCatalog: [
            { din: '01234567', product: 'ALPHA MEDICATION', dosage: '10 mg', format: '100 tablets', upc: '012345678905' },
            { din: '01234568', product: 'ALPHA MEDICATION', dosage: '20 mg', format: '30 tablets', upc: '999999999999' },
            { din: '08765432', product: 'BETA MEDICATION', dosage: '5 mg', format: '60 tablets', upc: '' }
        ], autocompleteHighlightIndex: -1,
        selectSuggestion: item => selected.push(item), scannerResultAccepted: false, scannerConsumer: null,
        html5QrcodeScanner: null, scannerSession: 0, playScanBeep() {}, triggerVisualFlash() {}, showToast() {},
        checkForExactCodeMatch: code => { lookups.push(code); return true; }
    });
    const source = [
        section('closeAllSuggestions', 'function normalizeUPC'),
        section('normalizeUPC', 'function normalizeDIN'),
        section('normalizeDIN', 'function formatDIN'),
        section('showSuggestions', 'function checkForExactCodeMatch'),
        section('handleAutocompleteKeys', 'function highlightSuggestionRow'),
        section('highlightSuggestionRow', '// ----------------------------------------------------'),
        section('stopScanner', 'function switchCamera'),
        section('parseGS1DataMatrix', 'function onScanSuccess'),
        section('onScanSuccess', 'async function lookupHealthCanadaDIN')
    ].join('\n');
    vm.runInContext(source, context);
    return { context, ids, selected, lookups };
}
test('partial DIN suggestions share catalogue filtering but target only the chosen form', () => {
    const { context, ids, selected } = setup(), returns = [];
    context.showSuggestions('12345', 'din', { prefix: 'cr', select: item => returns.push(item) });
    assert.equal(ids['cr-din-suggestions'].children.length, 2);
    assert.equal(ids['form-din-suggestions'].style.display, 'none');
    ids['cr-din-suggestions'].children[0].click();
    assert.equal(returns[0].din, '01234567');
    assert.equal(selected.length, 0);
    context.showSuggestions('12345', 'din');
    ids['form-din-suggestions'].children[1].click();
    assert.equal(selected[0].din, '01234568');
});
test('name suggestions retain strength and format; arrows/Enter select from the returns list', () => {
    const { context, ids } = setup(), selected = [];
    context.showSuggestions('alpha', 'product', { prefix: 'cr', select: item => selected.push(item) });
    assert.match(ids['cr-product-suggestions'].children[1].innerHTML, /20 mg/);
    assert.match(ids['cr-product-suggestions'].children[1].innerHTML, /30 tablets/);
    const key = value => ({ key: value, preventDefault() {} });
    context.handleAutocompleteKeys(key('ArrowDown'), 'product', 'cr');
    context.handleAutocompleteKeys(key('ArrowDown'), 'product', 'cr');
    context.handleAutocompleteKeys(key('Enter'), 'product', 'cr');
    assert.equal(selected[0].din, '01234568');
    context.handleAutocompleteKeys(key('Escape'), 'product', 'cr');
    assert.equal(ids['cr-product-suggestions'].style.display, 'none');
    context.showSuggestions('no such medicine', 'product', { prefix: 'cr', select() {} });
    assert.equal(ids['cr-product-suggestions'].style.display, 'none');
});
test('the expiry reader and returns reader use the same GS1 lot/month parser', () => {
    const { context } = setup();
    for (const raw of ['(01)00012345678905(17)261130(10)LOT-A(21)SERIAL', ']d2010001234567890510LOT-B\x1d1726093021SERIAL']) {
        const shared = D.parseBarcode(raw), expiry = context.parseGS1DataMatrix(raw);
        assert.equal(expiry.gtin, shared.code);
        assert.equal(expiry.lot, shared.lot);
        assert.equal(expiry.expiry, shared.expiry);
    }
    assert.equal(context.parseGS1DataMatrix('012345678905'), null);
});
test('return scans are delivered once and never modify the expiry form', () => {
    const { context, ids, lookups } = setup(), received = [];
    ids['form-expiry'].value = '2025-01'; ids['form-notes'].value = 'Existing expiry note';
    context.scannerConsumer = raw => received.push(raw);
    const raw = '(01)00012345678905(17)261130(10)LOT-A';
    context.onScanSuccess(raw);
    context.onScanSuccess(raw);
    assert.deepEqual(received, [raw]);
    assert.deepEqual(lookups, []);
    assert.equal(ids['form-expiry'].value, '2025-01');
    assert.equal(ids['form-notes'].value, 'Existing expiry note');
    assert.equal(context.scannerConsumer, null);
});
test('normal expiry scans still autofill month/year and lot and look up the medication', () => {
    const { context, ids, lookups } = setup();
    context.onScanSuccess('(01)00012345678905(17)261130(10)LOT-A(21)SERIAL');
    assert.deepEqual(lookups, ['00012345678905']);
    assert.equal(ids['form-expiry'].value, '2026-11');
    assert.equal(ids['form-notes'].value, 'Lot: LOT-A');
});
test('cancelling the shared reader discards its consumer and blocks late frames', () => {
    const { context, lookups } = setup();
    context.scannerConsumer = () => { throw new Error('Cancelled consumer called'); };
    context.stopScanner();
    context.onScanSuccess('012345678905');
    assert.equal(context.scannerConsumer, null);
    assert.deepEqual(lookups, []);
});
