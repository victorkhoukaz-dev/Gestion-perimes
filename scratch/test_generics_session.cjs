// Runs the actual dashboard connection scripts against synthetic data only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const clone = value => JSON.parse(JSON.stringify(value));
const source = file => fs.readFileSync(path.join(__dirname, '../App', file), 'utf8');
class Element {
    constructor() { this.children = []; this.attributes = new Set(); this.style = {}; this.events = {}; }
    append(...children) { this.children.push(...children); }
    prepend(...children) { this.children.unshift(...children); }
    get firstChild() { return this.children[0]; }
    setAttribute(name) { this.attributes.add(name); }
    removeAttribute(name) { this.attributes.delete(name); }
    hasAttribute(name) { return this.attributes.has(name); }
    addEventListener(event, callback) { this.events[event] = callback; }
}
function page(period) {
    const events = {}, documentEvents = {}, nodes = {};
    let user = 'A', pharmacy = 'A', authCallback, hold, release, failure;
    const writes = [], gates = [];
    const purchase = { manufacturers: [{ name: 'PRIVATE A' }], totals: {}, years: [] };
    const document = {
        documentElement: new Element(), head: new Element(), body: new Element(), visibilityState: 'visible',
        createElement: () => new Element(),
        getElementById: id => nodes[id] ||= new Element(),
        addEventListener: (event, callback) => { documentEvents[event] = callback; }
    };
    async function gate(stage, value) {
        gates.push(stage);
        if (hold === stage) { hold = null; await new Promise(resolve => { release = resolve; }); }
        if (failure === stage) throw new Error('Synthetic failure');
        return value;
    }
    const client = {
        auth: {
            getUser: () => gate('auth', { data: { user: user ? { id: user, email: user + '@example.test' } : null } }),
            onAuthStateChange: callback => { authCallback = callback; }, signOut: async () => {}
        },
        from(table) {
            const filters = {};
            return {
                select() { return this; }, eq(key, value) { filters[key] = value; return this; }, order() { return this; },
                maybeSingle() {
                    return gate(table, { data: table === 'profiles' ? { pharmacy_id: pharmacy } : { name: 'Pharmacy ' + pharmacy } });
                },
                limit() { assert.equal(filters.pharmacy_id, 'A'); return gate('purchases', { data: [{ data: clone(purchase) }] }); },
                upsert(payload) { writes.push(clone(payload)); return gate('save', { error: null }); }
            };
        }
    };
    const context = { document, console, supabaseClient: client, rawData: {},
        saveAndRefreshDashboard() {}, confirm: () => true,
        location: { reload() {}, replace() {} }, addEventListener(event, callback) { (events[event] ||= []).push(callback); }
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(source('generics-session.js'), context);
    const html = source('generics_' + period + '.html');
    assert.ok(html.indexOf('src="generics-session.js"') < html.indexOf('window.initializeGenericsSession('));
    const inline = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
        .map(match => match[1]).find(script => script.includes('window.initializeGenericsSession('));
    vm.runInContext(inline, context);
    return {
        context, writes, gates,
        load: () => context.loadGenericsDataFromCloud(),
        save: () => context.syncGenericsDataToCloud(context.rawData),
        get locked() { return document.documentElement.hasAttribute('data-generics-locked'); },
        hold(stage) { hold = stage; }, release() { release(); }, fail(stage) { failure = stage; },
        switchUser(next, emit = true) { user = next; pharmacy = next; if (emit) authCallback(next ? 'SIGNED_IN' : 'SIGNED_OUT', next ? { user: { id: next } } : null); },
        movePharmacy(next) { pharmacy = next; },
        auth(event) { authCallback(event, { user: { id: user } }); },
        visibility(value) { document.visibilityState = value; documentEvents.visibilitychange?.(); },
        history() { for (const cb of events.pagehide) cb({}); for (const cb of events.pageshow) cb({ persisted: true }); }
    };
}
const settle = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
for (const period of ['monthly', 'annual']) {
    test(period + ': own pharmacy load and save work; token refresh does not lock', async () => {
        const p = page(period);
        assert.equal(p.locked, true);
        assert.equal(await p.save(), false);
        assert.equal(await p.load(), true);
        assert.equal(p.locked, false);
        p.auth('TOKEN_REFRESHED'); p.auth('SIGNED_IN');
        assert.equal(await p.save(), true);
        assert.equal(p.writes[0].pharmacy_id, 'A');
        assert.equal(p.writes[0].user_id, 'A');
        assert.equal(p.writes[0].period_type, period);
    });
    for (const next of ['B', null]) test(period + ': account change/sign-out clears and locks purchases (' + next + ')', async () => {
        const p = page(period); await p.load(); p.switchUser(next);
        assert.equal(p.locked, true);
        assert.equal(p.context.rawData.manufacturers.length, 0);
        assert.equal(await p.save(), false);
        assert.equal(await p.load(), false);
        assert.equal(p.writes.length, 0);
    });
    for (const stage of ['auth', 'profiles', 'purchases', 'pharmacies']) test(period + ': ignores late ' + stage + ' response after account switch', async () => {
        const p = page(period); p.hold(stage);
        const loading = p.load(); await settle(); p.switchUser('B'); p.release();
        assert.equal(await loading, false);
        assert.equal(p.locked, true);
        assert.equal(p.context.rawData.manufacturers.length, 0);
        assert.equal(await p.save(), false);
        assert.equal(p.writes.length, 0);
    });
    test(period + ': save rechecks identity even without an auth event', async () => {
        const p = page(period); await p.load(); p.switchUser('B', false);
        assert.equal(await p.save(), false);
        assert.equal(p.locked, true); assert.equal(p.writes.length, 0);
    });
    test(period + ': save rejects changed pharmacy membership', async () => {
        const p = page(period); await p.load(); p.movePharmacy('B');
        assert.equal(await p.save(), false); assert.equal(p.writes.length, 0);
    });
    test(period + ': account switch while validating a save prevents dispatch', async () => {
        const p = page(period); await p.load(); p.hold('profiles');
        const saving = p.save(); await settle(); p.switchUser('B'); p.release();
        assert.equal(await saving, false); assert.equal(p.writes.length, 0);
    });
    test(period + ': failed save preserves unsaved purchases and allows a retry', async () => {
        const p = page(period); await p.load(); p.context.rawData.manufacturers.push({ name: 'UNSAVED IMPORT' });
        p.fail('save'); assert.equal(await p.save(), false);
        assert.equal(p.locked, false);
        assert.equal(p.context.rawData.manufacturers[1].name, 'UNSAVED IMPORT');
        p.fail(null); assert.equal(await p.save(), true);
        assert.equal(p.writes[1].data.manufacturers[1].name, 'UNSAVED IMPORT');
    });
    test(period + ': dispatched save keeps original pharmacy; late success cannot unlock page', async () => {
        const p = page(period); await p.load(); p.hold('save');
        const saving = p.save(); await settle(); p.switchUser('B'); p.release();
        assert.equal(await saving, false); assert.equal(p.locked, true);
        assert.equal(p.writes[0].pharmacy_id, 'A'); assert.equal(p.writes[0].user_id, 'A');
    });
    for (const stage of ['auth', 'profiles', 'purchases', 'pharmacies']) test(period + ': failed ' + stage + ' load stays locked', async () => {
        const p = page(period); p.fail(stage);
        assert.equal(await p.load(), false); assert.equal(p.locked, true);
        assert.equal(await p.save(), false); assert.equal(p.writes.length, 0);
    });
    test(period + ': missing pharmacy never falls back to user ID', async () => {
        const p = page(period); p.movePharmacy(null);
        assert.equal(await p.load(), false); assert.equal(p.locked, true);
        assert.equal(p.gates.includes('purchases'), false);
    });
    test(period + ': routine tab/app switching preserves data without checks or loading', async () => {
        const p = page(period); await p.load();
        const data = p.context.rawData, requests = p.gates.length;
        for (let i = 0; i < 3; i++) {
            p.visibility('hidden'); assert.equal(p.locked, false);
            p.visibility('visible'); await settle(); assert.equal(p.locked, false);
        }
        assert.equal(p.context.rawData, data);
        assert.equal(p.gates.length, requests);
    });
    test(period + ': account change while tab is hidden still clears and locks', async () => {
        const p = page(period); await p.load(); p.visibility('hidden'); p.switchUser('B');
        p.visibility('visible'); await settle();
        assert.equal(p.locked, true); assert.equal(p.context.rawData.manufacturers.length, 0);
        assert.equal(await p.save(), false); assert.equal(p.writes.length, 0);
    });
    test(period + ': same user can return to a tab; restored history requires reload', async () => {
        const p = page(period); await p.load(); p.visibility('hidden'); p.visibility('visible'); await settle();
        assert.equal(p.locked, false); p.history();
        assert.equal(p.locked, true); assert.equal(p.context.rawData.manufacturers.length, 0);
    });
}

for (const module of ['generics-molecules.js', 'generics-name-review.js']) {
    for (const stage of ['auth', 'profiles', 'purchases']) {
        for (const event of ['SIGNED_OUT', 'SIGNED_IN']) test(module + ': late ' + stage + ' cannot restore purchases after ' + event, async () => {
            const nodes = {};
            const node = id => nodes[id] ||= Object.assign(new Element(), {
                add() {}, replaceChildren() { this.children = []; },
                tBodies: [{ replaceChildren() {} }], value: '1'
            });
            const document = { getElementById: node, createElement: () => new Element(),
                addEventListener() {}, querySelectorAll: () => [] };
            let authCallback, release;
            const gate = async (key, result) => {
                if (stage === key) await new Promise(resolve => { release = resolve; });
                return result;
            };
            const client = {
                auth: { getUser: () => gate('auth', { data: { user: { id: 'A' } } }),
                    onAuthStateChange: cb => { authCallback = cb; } },
                from() { return {
                    select() { return this; }, eq() { return this; }, order() { return this; },
                    maybeSingle: () => gate('profiles', { data: { pharmacy_id: 'A' } }),
                    limit: () => gate('purchases', { data: [{ data: { manufacturers: [{ name: 'PRIVATE A' }] } }] })
                }; }
            };
            vm.runInNewContext(source(module), { document, console, Intl, Date,
                Option: function () {}, window: {
                    GenericsMoleculeData: require('../App/generics-molecule-data.js'),
                    GENERICS_CONNECTION: {}, supabase: { createClient: () => client }
                } });
            await settle();
            authCallback(event, event === 'SIGNED_IN' ? { user: { id: 'B' } } : null);
            release(); await settle();
            assert.equal(node('workspace').hidden, true);
            assert.match(node('load-status').textContent, /session a changé/);
            node('retry-load').events.click(); await settle();
            assert.equal(node('workspace').hidden, true);
        });
    }
}
