const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../App/index.html'), 'utf8');
const code = html.slice(html.indexOf('    const geminiSessionKeys ='), html.indexOf('    function onScanFailure()'));
const photo = 'data:image/png;base64,AAAA';
const success = fields => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(fields || { din: '01234567', product: 'Example', dosage: '10 mg', format: '100 tablets', expiry: '2027-02' }) }] } }] }) });
const failure = (status, reason, message = '') => ({ ok: false, status, json: async () => ({ error: { status: 'INVALID_ARGUMENT', message, details: [{ reason }] } }) });
function setup({ saved = {}, responses = [], answers = [], cloudKey = 'CLOUD_OLD', storageFails = false } = {}) {
  const values = new Map(Object.entries(saved)), calls = [], prompts = [], toasts = [];
  const fields = Object.fromEntries(['form-din', 'form-product', 'form-dosage', 'form-format', 'form-expiry'].map(id => [id, { value: 'unchanged', events: [], dispatchEvent(event) { this.events.push(event.type); } }]));
  const buttons = [{ disabled: false }, { disabled: false }];
  const context = vm.createContext({
    sessionPharmacy: { id: 'pharmacy-a', gemini_api_key: cloudKey },
    localStorage: { getItem: key => { if (storageFails) throw Error('Unavailable'); return values.get(key) ?? null; }, setItem: (key, value) => { if (storageFails) throw Error('Unavailable'); values.set(key, value); }, removeItem: () => { throw Error('Must not delete existing settings'); } },
    supabaseClient: { from: () => { throw Error('Must not write cloud keys'); } },
    fetch: async (url, options) => { calls.push({ url, ...options }); const next = responses.shift(); if (typeof next === 'function') return next(); if (!next) throw Error('Unexpected request'); return next; },
    document: { getElementById: id => fields[id], querySelectorAll: () => buttons },
    prompt: message => { prompts.push(message); return answers.shift() ?? null; },
    showToast: (message, type) => toasts.push({ message, type }),
    AbortController, Event, setTimeout, clearTimeout,
  });
  vm.runInContext(code, context);
  return { context, values, calls, prompts, toasts, fields, buttons, run: value => context.analyzeLabelWithGemini(value ?? photo) };
}
test('new browser key takes priority over old cloud key; PNG uses matching MIME and key header', async () => {
  const s = setup({ saved: { 'gemini_api_key:pharmacy-a': 'LOCAL_NEW' }, responses: [success()] });
  await s.run();
  assert.equal(s.calls[0].headers['x-goog-api-key'], 'LOCAL_NEW');
  assert.equal(s.calls[0].url.includes('LOCAL_NEW'), false);
  const image = JSON.parse(s.calls[0].body).contents[0].parts[1].inline_data;
  assert.equal(image.mime_type, 'image/png'); assert.equal(image.data, 'AAAA');
  assert.equal(s.fields['form-product'].value, 'Example');
  assert.deepEqual(s.fields['form-expiry'].events, ['input']);
  assert.equal(s.buttons.every(button => !button.disabled), true);
});
test('invalid key correction is saved per pharmacy, used immediately and reused on next photo', async () => {
  const s = setup({ responses: [failure(400, 'API_KEY_INVALID'), success(), success()], answers: ['  NEW_KEY  '] });
  await s.run(); await s.run();
  assert.deepEqual(s.calls.map(call => call.headers['x-goog-api-key']), ['CLOUD_OLD', 'NEW_KEY', 'NEW_KEY']);
  assert.equal(s.prompts.length, 1);
  assert.equal(s.values.get('gemini_api_key:pharmacy-a'), 'NEW_KEY');
  assert.equal(s.context.sessionPharmacy.gemini_api_key, 'CLOUD_OLD');
  assert.equal(s.toasts.some(toast => toast.type === 'success'), true);
});
test('a second invalid key stops, rather than prompting or retrying indefinitely', async () => {
  const s = setup({ responses: [failure(400, 'API_KEY_INVALID'), failure(400, 'API_KEY_INVALID')], answers: ['NEW_KEY', 'NEVER_USED'] });
  await s.run(); assert.equal(s.calls.length, 2); assert.equal(s.prompts.length, 1);
  assert.equal(s.fields['form-product'].value, 'unchanged');
});
test('re-entering the same rejected key does not make another request', async () => {
  const s = setup({ responses: [failure(400, 'API_KEY_INVALID')], answers: ['CLOUD_OLD'] });
  await s.run(); assert.equal(s.calls.length, 1);
});
test('quota, permission, malformed requests and missing models retain keys without replacement prompts', async () => {
  for (const [status, reason] of [[429, 'RESOURCE_EXHAUSTED'], [403, 'API_KEY_HTTP_REFERRER_BLOCKED'], [400, 'INVALID_ARGUMENT'], [404, 'NOT_FOUND'], [402, 'RESOURCE_EXHAUSTED']]) {
    const s = setup({ saved: { 'gemini_api_key:pharmacy-a': 'KEEP_ME' }, responses: [failure(status, reason)] });
    await s.run(); assert.equal(s.calls.length, 1); assert.equal(s.prompts.length, 0);
    assert.equal(s.values.get('gemini_api_key:pharmacy-a'), 'KEEP_ME');
    assert.equal(s.fields['form-product'].value, 'unchanged');
    assert.ok(s.toasts.at(-1).message.includes('HTTP ' + status));
  }
});
test('storage unavailable still allows current-session key correction', async () => {
  const s = setup({ storageFails: true, responses: [failure(401, 'UNAUTHENTICATED'), success(), success()], answers: ['SESSION_KEY'] });
  await s.run(); await s.run();
  assert.deepEqual(s.calls.map(call => call.headers['x-goog-api-key']), ['CLOUD_OLD', 'SESSION_KEY', 'SESSION_KEY']);
});
test('no built-in fallback key; cancelling initial prompt makes no request', async () => {
  const s = setup({ cloudKey: '' });
  await s.run(); assert.equal(s.prompts.length, 1); assert.equal(s.calls.length, 0);
  assert.equal(html.includes('DEFAULT_GEMINI_API_KEY'), false);
});
test('JPEG, WEBP and HEIC keep their real MIME; unsupported input sends nothing', async () => {
  for (const mime of ['image/jpeg', 'image/webp', 'image/heic', 'image/heif']) {
    const s = setup({ responses: [success()] }); await s.run('data:' + mime + ';base64,AAAA');
    assert.equal(JSON.parse(s.calls[0].body).contents[0].parts[1].inline_data.mime_type, mime);
  }
  const s = setup(); await s.run('data:text/plain;base64,AAAA'); assert.equal(s.calls.length, 0);
});
test('empty, malformed and blocked responses preserve form data and unlock controls', async () => {
  for (const result of [{ candidates: [] }, { candidates: [{ content: { parts: [{ text: 'not JSON' }] } }] }, { candidates: [{ content: { parts: [{ text: '{"product":"N/A"}' }] } }] }]) {
    const s = setup({ responses: [{ ok: true, json: async () => result }] }); await s.run();
    assert.equal(s.fields['form-product'].value, 'unchanged');
    assert.equal(s.buttons.every(button => !button.disabled), true);
    assert.equal(s.toasts.some(toast => toast.type === 'success'), false);
  }
});
test('concurrent photo attempts send only one request, and late replies cannot fill another pharmacy', async () => {
  let complete;
  const pending = new Promise(resolve => { complete = resolve; });
  const s = setup({ responses: [() => pending] });
  const running = s.run(); await new Promise(resolve => setImmediate(resolve));
  await s.run(); assert.equal(s.calls.length, 1);
  s.context.sessionPharmacy = { id: 'pharmacy-b' };
  complete(success()); await running;
  assert.equal(s.fields['form-product'].value, 'unchanged');
  assert.equal(s.buttons.every(button => !button.disabled), true);
});
test('transport failure is reported without exposing key or changing the form', async () => {
  const s = setup({ responses: [() => { throw Error('secret key must not leak'); }] });
  await s.run(); assert.equal(s.fields['form-product'].value, 'unchanged');
  assert.equal(s.toasts.some(toast => toast.message.includes('secret key')), false);
});
