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
        for (const manufacturer of data.manufacturers || []) {
            const companyKey = key(manufacturer.name);
            for (const molecule of manufacturer.molecules || []) {
                const moleculeKey = key(molecule.name);
                if (!molecules.has(moleculeKey)) molecules.set(moleculeKey, {
                    key: moleculeKey,
                    name: String(molecule.name || '').trim() || 'Molécule non attribuée',
                    companies: new Map()
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
    const api = { YEAR, key, cents, coverage, markImported, validateMonthlyRows, buildIndex, latestMonth };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.GenericsMoleculeData = api;
})();
