/* Pure helpers for device-local company return reports. No cloud writes. */
(() => {
    const text = value => String(value ?? '').trim();
    const clean = value => ['N/A', 'NULL'].includes(text(value).toUpperCase()) ? '' : text(value);
    const digits = value => text(value).replace(/^0+/, '');
    const units = ['tablets', 'capsules', 'mL', 'g', 'bottles', 'boxes', 'units'];
    function parseBarcode(value) {
        const raw = text(value).replace(/^\][a-zA-Z][0-9]/, '');
        const result = { code: raw, lot: '', expiry: '', gs1: false };
        const fields = {};
        if (raw.startsWith('(')) {
            const tokens = [...raw.matchAll(/\((\d{2,4})\)([^]*?)(?=\(\d{2,4}\)|$)/g)];
            for (const token of tokens) fields[token[1]] = token[2].replace(/[\x1d\x1e]/g, '').trim();
        } else if (raw.startsWith('01') && /^01\d{14}/.test(raw)) {
            let cursor = 0;
            const fixed = { '01': 14, '17': 6, '11': 6, '15': 6, '20': 2 };
            const variable = ['10', '21', '30', '37', '240', '241'];
            while (cursor < raw.length) {
                if (/[\x1d\x1e|]/.test(raw[cursor])) { cursor++; continue; }
                const ai = [...Object.keys(fixed), ...variable].sort((a, b) => b.length - a.length)
                    .find(key => raw.startsWith(key, cursor));
                if (!ai) break; // Do not invent fields from an unsupported AI.
                cursor += ai.length;
                if (fixed[ai]) {
                    const value = raw.slice(cursor, cursor + fixed[ai]);
                    if (!new RegExp('^\\d{' + fixed[ai] + '}$').test(value)) break;
                    fields[ai] = value;
                    cursor += fixed[ai];
                } else {
                    const end = raw.slice(cursor).search(/[\x1d\x1e|]/);
                    fields[ai] = end < 0 ? raw.slice(cursor) : raw.slice(cursor, cursor + end);
                    cursor = end < 0 ? raw.length : cursor + end;
                }
            }
        }
        if (/^\d{14}$/.test(fields['01'] || '')) {
            result.code = fields['01'];
            result.gs1 = true;
            result.lot = text(fields['10']);
            if (/^\d{6}$/.test(fields['17'] || '')) {
                const month = fields['17'].slice(2, 4);
                if (+month >= 1 && +month <= 12) result.expiry = '20' + fields['17'].slice(0, 2) + '-' + month;
            }
        }
        return result;
    }
    function findProduct(catalog, code, kind = 'auto') {
        const query = digits(code);
        if (!/^\d+$/.test(query)) return null;
        const matches = catalog.filter(item => {
            const dinMatch = kind !== 'barcode' && text(code).length <= 8 && digits(clean(item.din)) === query;
            const upcs = clean(item.upc).split(/[\s,;|]+/).filter(Boolean);
            return dinMatch || (kind !== 'din' && upcs.some(upc => digits(upc) === query));
        });
        const identities = new Set(matches.map(item => clean(item.din) ? 'din:' + digits(item.din) : clean(item.product).toLowerCase() + '|' + clean(item.dosage)));
        if (!matches.length || identities.size !== 1) return null;
        const din = clean(matches[0].din);
        return { din: /^\d{1,8}$/.test(din) ? din.padStart(8, '0') : din, product: clean(matches[0].product), strength: clean(matches[0].dosage), format: clean(matches[0].format) };
    }
    function validateEntry(entry) {
        const result = Object.fromEntries(['code', 'din', 'product', 'strength', 'format', 'lot', 'expiry', 'unit'].map(key => [key, clean(entry[key])]));
        result.quantity = Number(entry.quantity);
        if (!result.product) throw new Error('Enter a product name.');
        if (result.din && !/^\d{8}$/.test(result.din)) throw new Error('The DIN must contain 8 digits, or be left blank.');
        if (!result.lot) throw new Error('Enter the lot number from the package.');
        if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(result.expiry)) throw new Error('Enter the expiry month and year.');
        if (!Number.isFinite(result.quantity) || result.quantity <= 0 || result.quantity > 1e9) throw new Error('Enter an approximate quantity greater than zero.');
        if (!units.includes(result.unit)) throw new Error('Choose a quantity unit.');
        return result;
    }
    function lineKey(entry) {
        return JSON.stringify([entry.din || entry.code || entry.product.toLowerCase(), entry.strength.toLowerCase(),
            entry.format.toLowerCase(), entry.lot, entry.expiry, entry.unit]);
    }
    function addLine(lines, input, id) {
        const entry = validateEntry(input), next = lines.map(line => ({ ...line }));
        const existing = next.find(line => lineKey(line) === lineKey(entry));
        if (existing) {
            const quantity = Math.round((existing.quantity + entry.quantity) * 1e6) / 1e6;
            if (quantity > 1e9) throw new Error('The combined quantity is too large.');
            existing.quantity = quantity;
        } else next.push({ ...entry, id });
        return next;
    }
    function loadReports(storage, key) {
        const raw = storage.getItem(key);
        if (raw === null) return { raw, value: { version: 1, activeId: null, reports: [] } };
        const value = JSON.parse(raw);
        if (value?.version !== 1 || !Array.isArray(value.reports)) throw new Error('The saved return reports cannot be read. Your stored data has not been changed.');
        const ids = new Set();
        for (const report of value.reports) {
            if (!report || typeof report.id !== 'string' || ids.has(report.id) || typeof report.company !== 'string' || !Array.isArray(report.lines)) {
                throw new Error('A saved report is invalid. Your stored data has not been changed.');
            }
            ids.add(report.id);
            for (const line of report.lines) validateEntry(line);
        }
        return { raw, value };
    }
    function saveReports(storage, key, expectedRaw, value) {
        if (storage.getItem(key) !== expectedRaw) throw new Error('This report changed in another tab. Reload the page before continuing.');
        const raw = JSON.stringify(value);
        storage.setItem(key, raw); // Callers replace in-memory state only after this succeeds.
        return raw;
    }
    const api = { parseBarcode, findProduct, validateEntry, addLine, lineKey, units, loadReports, saveReports };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.CompanyReturnsData = api;
})();
