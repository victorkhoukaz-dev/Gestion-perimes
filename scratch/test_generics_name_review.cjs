// Offline regression checks: synthetic purchases and an in-memory database only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const M = require('../App/generics-molecule-data.js');
const clone = value => JSON.parse(JSON.stringify(value));
const fixture = () => ({ manufacturers: [{ name: 'Example manufacturer', molecules: [
    { name: 'Alpha / Beta', monthlySales: { 1: 10.25 }, productDetails: [{ strength: '10 mg', form: 'tablet', monthlySales: { 1: 10.25 } }] },
    { name: 'Alpha-Beta', monthlySales: { 1: -2.50 }, productDetails: [{ strength: '10 mg', form: 'tablet', monthlySales: { 1: -2.50 } }] },
    { name: 'Gamma Delta', monthlySales: { 1: 20 } },
    { name: 'Gamma-Delta', monthlySales: { 1: 5 } }
] }], monthlyImportCoverage: { version: 1, year: 2026, baseline: 'empty', months: { 1: {} } } });

test('suggestions require approval; grouping preserves source names, totals and presentations', () => {
    const data = fixture(), original = clone(data);
    const review = M.findNameReviewCandidates(data);
    assert.equal(review.formatting.length, 2);
    assert.equal(M.buildIndex(data).length, 4);
    assert.deepEqual(data, original);
    const candidate = review.formatting[0];
    data.moleculeNameReview = { decisions: { [candidate.decisionKey]: {
        status: 'group', names: candidate.items.map(item => item.name), canonicalName: 'Alpha / Beta'
    } } };
    const index = M.buildIndex(data), grouped = index.find(item => item.name === 'Alpha / Beta');
    assert.equal(index.length, 3);
    assert.equal([...grouped.companies.values()][0].amounts[1], 775);
    assert.equal([...grouped.presentations.values()][0].companies.values().next().value.amounts[1], 775);
    assert.deepEqual(data.manufacturers, original.manufacturers);
    data.moleculeNameReview.decisions[candidate.decisionKey].status = 'keep';
    assert.equal(M.buildIndex(data).length, 4);
    delete data.moleculeNameReview.decisions[candidate.decisionKey];
    assert.equal(M.buildIndex(data).length, 4);
});

test('near names are suggestions only, short unrelated names are excluded', () => {
    const data = { manufacturers: [{ name: 'Example', molecules: ['Metformin', 'Metformine', 'A', 'B'].map(name => ({ name })) }] };
    assert.equal(M.findNameReviewCandidates(data).near.length, 1);
    assert.equal(M.buildIndex(data).length, 4);
});

class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.events = {}; this.hidden = false; this.disabled = false; this.value = ''; this.textContent = ''; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    add(option) { this.children.push(option); if (!this.value) this.value = option.value; }
    addEventListener(type, callback) { this.events[type] = callback; }
}
function descendants(node) { return node.children.flatMap(child => [child, ...descendants(child)]); }
const settle = () => new Promise(resolve => setImmediate(resolve));
async function openPage(database, options = {}) {
    const ids = Object.fromEntries(['workspace', 'load-status', 'retry-load', 'pharmacy-name', 'review-summary', 'formatting-candidates', 'near-candidates'].map(id => [id, new Element('div')]));
    let authCallback, failNext = false, writes = 0, release;
    const client = {
        auth: { getUser: async () => ({ data: { user: { id: 'user-one' } } }), onAuthStateChange: callback => { authCallback = callback; } },
        from(table) {
            const filters = {}, query = { select() { return query; }, eq(key, value) { filters[key] = value; return query; }, order() { return query; },
                async limit() { assert.equal(filters.pharmacy_id, 'pharmacy-one'); return { data: database.row ? [clone(database.row)] : [] }; },
                update(payload) { query.payload = clone(payload); return query; },
                async maybeSingle() {
                    if (table === 'profiles') return { data: { pharmacy_id: 'pharmacy-one' } };
                    if (table === 'pharmacies') return { data: { name: 'Test pharmacy' } };
                    writes++;
                    assert.equal(filters.pharmacy_id, 'pharmacy-one');
                    assert.equal(filters.period_type, 'monthly');
                    assert.equal(filters.year, M.YEAR);
                    if (options.delay) await new Promise(resolve => { release = resolve; });
                    if (failNext) { failNext = false; return { error: { message: 'Simulated network failure' } }; }
                    if (!database.row || filters.updated_at !== database.row.updated_at) return { data: null };
                    database.row = clone(query.payload);
                    return { data: clone(database.row) };
                }
            };
            return query;
        }
    };
    const document = { getElementById: id => ids[id], createElement: tag => new Element(tag),
        querySelectorAll: () => Object.values(ids).flatMap(descendants).filter(node => ['button', 'select'].includes(node.tag)) };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../App/generics-name-review.js'), 'utf8'), {
        window: { GenericsMoleculeData: M, GENERICS_CONNECTION: {}, supabase: { createClient: () => client } }, document,
        Option: function(text, value) { this.textContent = text; this.value = value; this.children = []; }, Intl, Date, console
    });
    await settle();
    return {
        ids, get writes() { return writes; }, failNext() { failNext = true; }, release() { release(); },
        signOut() { authCallback('SIGNED_OUT', null); },
        controls(index = 0) { const nodes = descendants(ids['formatting-candidates'].children[index]); return {
            select: nodes.find(node => node.tag === 'select'), button: nodes.find(node => node.tag === 'button'), status: nodes.find(node => node.className?.startsWith('decision-status'))
        }; }
    };
}
async function decide(page, index, choice) {
    const controls = page.controls(index);
    controls.select.value = choice;
    await controls.button.events.click();
    return controls;
}
const database = () => ({ row: { data: fixture(), updated_at: '2026-11-03T12:00:00Z' } });

test('save, reload, keep separate and undo all persist without changing purchase amounts', async () => {
    const db = database(), original = clone(db.row.data.manufacturers);
    let page = await openPage(db);
    await decide(page, 0, 'group:0');
    assert.equal(M.buildIndex(db.row.data).length, 3);
    page = await openPage(db);
    assert.equal(page.controls().select.value, 'group:0');
    await decide(page, 0, 'keep');
    page = await openPage(db);
    assert.equal(page.controls().select.value, 'keep');
    assert.equal(M.buildIndex(db.row.data).length, 4);
    await decide(page, 0, 'unresolved');
    page = await openPage(db);
    assert.equal(page.controls().select.value, 'unresolved');
    assert.deepEqual(db.row.data.manufacturers, original);
});

test('failed saves do not leak into a later successful decision', async () => {
    const db = database(), page = await openPage(db);
    page.failNext();
    const controls = await decide(page, 0, 'group:0');
    assert.match(controls.status.textContent, /Decision not saved/);
    assert.equal(controls.button.disabled, false);
    assert.equal(db.row.data.moleculeNameReview, undefined);
    await decide(page, 1, 'keep');
    assert.equal(Object.keys(db.row.data.moleculeNameReview.decisions).length, 1);
    assert.equal(M.buildIndex(db.row.data).length, 4);
});

test('a stale page cannot overwrite a newer import or another page’s decision', async () => {
    const db = database(), first = await openPage(db), stale = await openPage(db);
    await decide(first, 0, 'group:0');
    const saved = clone(db.row);
    const controls = await decide(stale, 1, 'keep');
    assert.match(controls.status.textContent, /Reload this page/);
    assert.deepEqual(db.row, saved);
});

test('double saves are blocked and signing out cannot redisplay an in-flight save', async () => {
    const db = database(), page = await openPage(db, { delay: true });
    const pending = decide(page, 0, 'group:0');
    assert.equal(page.controls(1).button.disabled, true);
    await decide(page, 1, 'keep');
    assert.equal(page.writes, 1);
    page.signOut();
    page.release();
    await pending;
    assert.equal(page.ids.workspace.hidden, true);
    assert.equal(page.ids['formatting-candidates'].children.length, 0);
    assert.match(page.ids['load-status'].textContent, /session changed/);
});

test('empty purchases produce no save controls', async () => {
    const page = await openPage({ row: null });
    assert.equal(descendants(page.ids['formatting-candidates']).some(node => node.tag === 'button'), false);
    assert.equal(page.writes, 0);
});
