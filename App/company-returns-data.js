/* Pure helpers for device-local company return reports. No cloud writes. */
(() => {
    const text = value => String(value ?? '').trim();
    const clean = value => ['N/A', 'NULL'].includes(text(value).toUpperCase()) ? '' : text(value);
    const digits = value => text(value).replace(/^0+/, '');
    const units = ['tablets', 'capsules', 'mL', 'g', 'bottles', 'boxes', 'units'];
    const unitLabels = { tablets: 'comprimés', capsules: 'capsules', mL: 'mL', g: 'g', bottles: 'flacons', boxes: 'boîtes', units: 'unités' };
    const unitLabel = unit => unitLabels[unit] || unit;
    const userError = message => Object.assign(new Error(message), { userFacing: true });
    function errorMessage(error) {
        if (error?.userFacing) return error.message;
        if (error?.name === 'QuotaExceededError') return 'L’espace de stockage de cet appareil est insuffisant. Libérez de l’espace et réessayez.';
        if (error?.name === 'SyntaxError') return 'Les données enregistrées sont illisibles. Elles ont été conservées.';
        if (error?.code === '42501') return 'Vous n’avez pas accès à ces rapports. Vérifiez votre connexion à la pharmacie.';
        if (error?.code === '23505') return 'Une version existe déjà en ligne. Rouvrez Retours fabricants avant d’enregistrer.';
        return 'Impossible de terminer l’opération. Vérifiez votre connexion et réessayez.';
    }
    function parseBarcode(value) {
        // Scanner libraries can include a GS1 symbology prefix and may represent
        // the FNC1/group separator as GS, RS, or ETX depending on the device.
        const raw = text(value).replace(/^\][a-zA-Z][0-9]/, '').replace(/[\x04]/g, '\x1d').replace(/^[\x1d\x1e|]+/, '');
        const result = { code: raw, lot: '', expiry: '', gs1: false };
        const fields = {};
        if (raw.includes('(01)')) {
            const tokens = [...raw.matchAll(/\((\d{2,4})\)([^]*?)(?=\(\d{2,4}\)|$)/g)];
            for (const token of tokens) fields[token[1]] = token[2].replace(/[\x1d\x1e]/g, '').trim();
        } else {
            let cursor = 0;
            const fixed = { '00': 18, '01': 14, '02': 14, '11': 6, '12': 6, '13': 6, '15': 6, '16': 6, '17': 6, '20': 2 };
            const variable = ['10', '21', '22', '30', '37', '240', '241', '250', '251', '400', '401', '420', '421'];
            while (cursor < raw.length) {
                if (/[\x1d\x1e|]/.test(raw[cursor])) { cursor++; continue; }
                const ai = [...Object.keys(fixed), ...variable].sort((a, b) => b.length - a.length)
                    .find(key => raw.startsWith(key, cursor));
                if (!ai) break; // Do not invent fields from an unsupported AI.
                cursor += ai.length;
                if (fixed[ai] !== undefined) {
                    const length = fixed[ai];
                    const fieldValue = raw.slice(cursor, cursor + length);
                    if (!new RegExp('^\\d{' + length + '}$').test(fieldValue)) break;
                    fields[ai] = fieldValue;
                    cursor += length;
                } else {
                    const end = raw.slice(cursor).search(/[\x1d\x1e|]/);
                    fields[ai] = end < 0 ? raw.slice(cursor) : raw.slice(cursor, cursor + end);
                    cursor = end < 0 ? raw.length : cursor + end;
                }
            }
        }
        // Preserve the permissive extraction the expiry tour used before the shared
        // parser was introduced. This also covers scanner output with nonstandard
        // separators or a GS1 identifier embedded after a short prefix.
        if (!fields['01']) {
            const gtin = raw.match(/(?:^|[\x1d\x1e|])(?:\()?01\)?(\d{14})/);
            if (gtin) fields['01'] = gtin[1];
        }
        if (!fields['17']) {
            const expiry = raw.match(/(?:^|[\x1d\x1e|])(?:\()?17\)?(\d{6})/)
                || raw.match(/^01\d{14}17(\d{6})/);
            if (expiry) fields['17'] = expiry[1] || expiry[2];
        }
        if (!fields['10']) {
            const lot = raw.match(/(?:^|[\x1d\x1e|])(?:\()?10\)?([^\x1d\x1e|()]+?)(?=[\x1d\x1e|()]|$)/);
            if (lot) fields['10'] = lot[1].trim();
        }
        if (/^\d{14}$/.test(fields['01'] || '')) {
            result.code = fields['01'];
            result.gs1 = true;
            result.lot = text(fields['10']);
            if (/^\d{6}$/.test(fields['17'] || '')) {
                const month = fields['17'].slice(2, 4);
                const year = +fields['17'].slice(0, 2);
                if (+month >= 1 && +month <= 12) result.expiry = (year > 50 ? '19' : '20') + fields['17'].slice(0, 2) + '-' + month;
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
        if (!result.product) throw userError('Saisissez le nom du produit.');
        if (result.din && !/^\d{8}$/.test(result.din)) throw userError('Le DIN doit contenir 8 chiffres ou rester vide.');
        if (!result.lot) throw userError('Saisissez le numéro de lot indiqué sur l’emballage.');
        if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(result.expiry)) throw userError('Saisissez le mois et l’année de péremption.');
        if (!Number.isFinite(result.quantity) || result.quantity <= 0 || result.quantity > 1e9) throw userError('Saisissez une quantité approximative supérieure à zéro.');
        if (!units.includes(result.unit)) throw userError('Choisissez une unité de quantité.');
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
            if (quantity > 1e9) throw userError('La quantité totale est trop élevée.');
            existing.quantity = quantity;
        } else next.push({ ...entry, id });
        return next;
    }
    function loadReports(storage, key) {
        const raw = storage.getItem(key);
        if (raw === null) return { raw, value: { version: 1, activeId: null, reports: [] } };
        const value = JSON.parse(raw);
        if (value?.version !== 1 || !Array.isArray(value.reports)) throw userError('Impossible de lire les rapports de retour enregistrés. Vos données n’ont pas été modifiées.');
        const ids = new Set();
        for (const report of value.reports) {
            if (!report || typeof report.id !== 'string' || ids.has(report.id) || typeof report.company !== 'string' || !Array.isArray(report.lines)) {
                throw userError('Un rapport enregistré est invalide. Vos données n’ont pas été modifiées.');
            }
            ids.add(report.id);
            for (const line of report.lines) validateEntry(line);
        }
        return { raw, value };
    }
    function saveReports(storage, key, expectedRaw, value) {
        if (storage.getItem(key) !== expectedRaw) throw userError('Ce rapport a été modifié dans un autre onglet. Rechargez la page avant de continuer.');
        const raw = JSON.stringify(value);
        storage.setItem(key, raw); // Callers replace in-memory state only after this succeeds.
        return raw;
    }
    const api = { parseBarcode, findProduct, validateEntry, addLine, lineKey, units, unitLabel, userError, errorMessage, loadReports, saveReports };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.CompanyReturnsData = api;
})();
