/* Pure data helpers shared by the monthly importer and the molecule view. */
(() => {
    const YEAR = 2026;
    const key = value => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
    const cents = value => {
        if (value === undefined || value === null || value === '') return 0;
        const amount = Number(value);
        if (!Number.isFinite(amount)) throw new Error('Un montant d’achat est invalide.');
        return Math.round(amount * 100);
    };
    function presentationMetadata(detail = {}) {
        const text = value => String(value ?? '').trim().replace(/\s+/g, ' ');
        const din = text(detail.din);
        const productCode = text(detail.productCode);
        const description = text(detail.description);
        const strength = text(detail.strength);
        const form = text(detail.form);
        const format = text(detail.format);
        const packaging = text(detail.packaging);
        const presentationKey = `${key(strength) || 'non-precisee'}|${key(form) || 'non-precisee'}`;
        const presentationLabel = `${strength || 'Force non précisée'} · ${form || 'Forme non précisée'}`;
        const productKey = din
            ? `din:${key(din)}`
            : productCode
                ? `produit:${key(productCode)}`
                : `description:${key([description, strength, form, format, packaging].join('|'))}`;
        return { din, productCode, description, strength, form, format, packaging, presentationKey, presentationLabel, productKey };
    }
    function coverage(data, month) {
        const record = data.monthlyImportCoverage;
        if (record?.version === 1 && record.year === YEAR) {
            if (record.months?.[month]) return 'imported';
            if (record.baseline === 'empty') return 'missing';
        }
        return (data.manufacturers || []).length ? 'unknown' : 'missing';
    }
    function markImported(data, month, sourceName, rowCount, previousData) {
        if (!data.monthlyImportCoverage) {
            data.monthlyImportCoverage = {
                version: 1, year: YEAR,
                baseline: (previousData.manufacturers || []).length ? 'unknown' : 'empty',
                months: {}
            };
        }
        data.monthlyImportCoverage.months[month] = {
            sourceName, rowCount, importedAt: new Date().toISOString()
        };
    }
    // Validate the whole file before the importer replaces a month's values.
    function validateMonthlyRows(rows, columns, year, month) {
        if (year !== YEAR || !Number.isInteger(month) || month < 1 || month > 12) {
            throw new Error('Sélectionnez un rapport mensuel d’achats de 2026 avec un mois identifiable.');
        }
        let count = 0;
        rows.slice(1).forEach((row, index) => {
            if (!row || (!String(row[columns.company] ?? '').trim() && !String(row[columns.molecule] ?? '').trim())) return;
            for (const [column, expected] of [[columns.year, year], [columns.month, month]]) {
                if (column >= 0 && row[column] !== undefined && row[column] !== '' && Number(row[column]) !== expected) {
                    throw new Error(`Ligne ${index + 2} : des années ou des mois différents ne peuvent pas être importés ensemble.`);
                }
            }
            const value = row[columns.amount];
            if (value === undefined || value === null || String(value).trim() === '' || !Number.isFinite(Number(value))) {
                throw new Error(`Ligne ${index + 2} : le montant d’achat est manquant ou invalide.`);
            }
            count++;
        });
        if (!count) throw new Error('Aucune ligne d’achat n’a été trouvée.');
        return count;
    }
    function buildIndex(data) {
        const molecules = new Map();
        const approvedNames = approvedNameMap(data);
        for (const manufacturer of data.manufacturers || []) {
            const companyKey = key(manufacturer.name);
            for (const molecule of manufacturer.molecules || []) {
                const sourceName = String(molecule.name || '').trim();
                const displayName = approvedNames.get(sourceName) || sourceName;
                const moleculeKey = key(displayName);
                if (!molecules.has(moleculeKey)) molecules.set(moleculeKey, {
                    key: moleculeKey,
                    name: displayName || 'Molécule non attribuée',
                    companies: new Map(),
                    presentations: new Map()
                });
                const item = molecules.get(moleculeKey);
                if (!item.companies.has(companyKey)) item.companies.set(companyKey, {
                    name: String(manufacturer.name || '').trim() || 'Fabricant non attribué',
                    amounts: Array(13).fill(0)
                });
                const company = item.companies.get(companyKey);
                for (let month = 1; month <= 12; month++) {
                    company.amounts[month] += cents(molecule.monthlySales?.[month]);
                }
                for (const detail of molecule.productDetails || []) {
                    const metadata = presentationMetadata(detail);
                    if (!item.presentations.has(metadata.presentationKey)) item.presentations.set(metadata.presentationKey, {
                        key: metadata.presentationKey,
                        label: detail.presentationLabel || metadata.presentationLabel,
                        companies: new Map()
                    });
                    const presentation = item.presentations.get(metadata.presentationKey);
                    if (!presentation.companies.has(companyKey)) presentation.companies.set(companyKey, {
                        name: String(manufacturer.name || '').trim() || 'Fabricant non attribué',
                        amounts: Array(13).fill(0)
                    });
                    const presentationCompany = presentation.companies.get(companyKey);
                    for (let month = 1; month <= 12; month++) {
                        presentationCompany.amounts[month] += cents(detail.monthlySales?.[month]);
                    }
                }
            }
        }
        return [...molecules.values()].sort((a, b) => a.name.localeCompare(b.name));
    }
    function latestMonth(data) {
        let latest = 1;
        for (let m = 1; m <= 12; m++) {
            if (coverage(data, m) === 'imported' || (data.manufacturers || []).some(c =>
                cents(c.monthlySales?.[m]) !== 0 || (c.molecules || []).some(mol => cents(mol.monthlySales?.[m]) !== 0))) latest = m;
        }
        return latest;
    }
    function nameReviewKey(value) {
        return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toUpperCase().replace(/[^A-Z0-9]/g, '');
    }
    function reviewDecisionKey(type, names) {
        return `${type}:${[...names].map(name => String(name).trim()).sort((a, b) => a.localeCompare(b, 'fr-CA')).join('|')}`;
    }
    function approvedNameMap(data) {
        const decisions = data.moleculeNameReview?.decisions || {};
        const parent = new Map();
        const find = name => {
            if (!parent.has(name)) parent.set(name, name);
            if (parent.get(name) !== name) parent.set(name, find(parent.get(name)));
            return parent.get(name);
        };
        const join = (left, right) => {
            const leftRoot = find(left), rightRoot = find(right);
            if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
        };
        Object.values(decisions).forEach(decision => {
            if (decision?.status !== 'group' || !Array.isArray(decision.names) || decision.names.length < 2) return;
            decision.names.slice(1).forEach(name => join(decision.names[0], name));
        });
        const canonical = new Map();
        Object.values(decisions).forEach(decision => {
            if (decision?.status !== 'group' || !decision.canonicalName || !Array.isArray(decision.names)) return;
            const root = find(decision.names[0]);
            if (!canonical.has(root)) canonical.set(root, decision.canonicalName);
        });
        const result = new Map();
        parent.forEach((_, name) => result.set(name, canonical.get(find(name)) || name));
        return result;
    }
    function editDistance(left, right) {
        let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
        for (let i = 1; i <= left.length; i++) {
            const current = [i];
            for (let j = 1; j <= right.length; j++) {
                current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
            }
            previous = current;
        }
        return previous[right.length];
    }
    function findNameReviewCandidates(data) {
        const names = new Map();
        for (const manufacturer of data.manufacturers || []) {
            for (const molecule of manufacturer.molecules || []) {
                const name = String(molecule.name || '').trim();
                if (!name) continue;
                if (!names.has(name)) names.set(name, { name, total: 0, manufacturers: new Set() });
                const item = names.get(name);
                item.manufacturers.add(String(manufacturer.name || '').trim() || 'Fabricant non attribué');
                for (let month = 1; month <= 12; month++) item.total += cents(molecule.monthlySales?.[month]);
            }
        }
        const items = [...names.values()].map(item => ({ ...item, manufacturers: [...item.manufacturers].sort((a, b) => a.localeCompare(b, 'fr-CA')) }));
        const formattingGroups = new Map();
        items.forEach(item => {
            const reviewKey = nameReviewKey(item.name);
            if (reviewKey) {
                if (!formattingGroups.has(reviewKey)) formattingGroups.set(reviewKey, []);
                formattingGroups.get(reviewKey).push(item);
            }
        });
        const formatting = [...formattingGroups.values()]
            .filter(group => group.length > 1)
            .map(group => {
                const items = group.sort((a, b) => a.name.localeCompare(b.name, 'fr-CA'));
                return { type: 'formatting', items, decisionKey: reviewDecisionKey('formatting', items.map(item => item.name)) };
            })
            .sort((a, b) => a.items[0].name.localeCompare(b.items[0].name, 'fr-CA'));
        const near = [];
        for (let leftIndex = 0; leftIndex < items.length; leftIndex++) {
            const left = items[leftIndex], leftKey = nameReviewKey(left.name);
            for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex++) {
                const right = items[rightIndex], rightKey = nameReviewKey(right.name);
                if (leftKey === rightKey || leftKey.length < 7 || Math.abs(leftKey.length - rightKey.length) > 2 || leftKey.slice(0, 3) !== rightKey.slice(0, 3)) continue;
                const distance = editDistance(leftKey, rightKey);
                if (distance <= 2) {
                    const pair = [left, right];
                    near.push({ type: 'near', distance, items: pair, decisionKey: reviewDecisionKey('near', pair.map(item => item.name)) });
                }
            }
        }
        near.sort((a, b) => a.items[0].name.localeCompare(b.items[0].name, 'fr-CA'));
        return { formatting, near, sourceNameCount: items.length };
    }
    const api = { YEAR, key, cents, coverage, markImported, validateMonthlyRows, presentationMetadata, buildIndex, latestMonth, nameReviewKey, reviewDecisionKey, approvedNameMap, findNameReviewCandidates };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.GenericsMoleculeData = api;
})();
