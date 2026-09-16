(() => {
    const M = window.GenericsMoleculeData;
    const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const money = value => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(value / 100);
    const $ = id => document.getElementById(id);
    let data = null, index = [], selected = null, selectedPresentationKey = 'all', activeSuggestionIndex = -1;
    const client = window.supabase && window.GENERICS_CONNECTION
        ? window.supabase.createClient(window.GENERICS_CONNECTION.url, window.GENERICS_CONNECTION.key)
        : null;
    const labels = { imported: 'Importé', missing: 'Non importé', unknown: 'Statut inconnu' };
    function element(tag, text, className) {
        const node = document.createElement(tag);
        node.textContent = text;
        if (className) node.className = className;
        return node;
    }
    for (let m = 1; m <= 12; m++) {
        for (const id of ['start-month', 'end-month']) $(id).add(new Option(months[m - 1], String(m)));
    }
    $('start-month').addEventListener('change', () => {
        if (+$('start-month').value > +$('end-month').value) $('end-month').value = $('start-month').value;
        render();
    });
    $('end-month').addEventListener('change', () => {
        if (+$('end-month').value < +$('start-month').value) $('start-month').value = $('end-month').value;
        render();
    });
    function chooseMolecule(item) {
        selected = item;
        selectedPresentationKey = 'all';
        $('molecule-search').value = item.name;
        $('molecule-results').hidden = true;
        $('molecule-search').setAttribute('aria-expanded', 'false');
        $('search-count').textContent = 'Molécule sélectionnée.';
        render();
    }
    function populatePresentationControl() {
        const control = $('presentation-control');
        const select = $('presentation-select');
        const compareButton = $('compare-presentations');
        select.replaceChildren();
        if (!selected) {
            control.hidden = true;
            compareButton.hidden = true;
            return;
        }
        const presentations = [...selected.presentations.values()].sort((a, b) => a.label.localeCompare(b.label));
        control.hidden = false;
        select.add(new Option('Toutes les forces et formulations', 'all'));
        presentations.forEach(presentation => select.add(new Option(presentation.label, presentation.key)));
        compareButton.hidden = presentations.length < 2;
        compareButton.setAttribute('aria-pressed', String(selectedPresentationKey === 'compare'));
        if (!presentations.length) {
            select.disabled = true;
            $('presentation-note').textContent = 'Les détails par force et formulation ne sont pas disponibles dans les données déjà enregistrées. Réimportez les fichiers mensuels pour les ajouter.';
        } else {
            select.disabled = false;
            if (selectedPresentationKey === 'compare' && presentations.length < 2) selectedPresentationKey = 'all';
            if (selectedPresentationKey !== 'compare' && !presentations.some(presentation => presentation.key === selectedPresentationKey)) selectedPresentationKey = 'all';
            $('presentation-note').textContent = selectedPresentationKey === 'compare'
                ? 'Chaque barre montre les fabricants utilisés pour une force et une formulation.'
                : 'Choisissez une présentation pour comparer les fabricants à force et formulation égales.';
        }
        select.value = selectedPresentationKey === 'compare' ? 'all' : selectedPresentationKey;
    }
    $('presentation-select').addEventListener('change', () => {
        selectedPresentationKey = $('presentation-select').value;
        render();
    });
    $('compare-presentations').addEventListener('click', () => {
        selectedPresentationKey = selectedPresentationKey === 'compare' ? 'all' : 'compare';
        render();
    });
    function filterMolecules() {
        const query = M.key($('molecule-search').value);
        const matches = query ? index.filter(item => M.key(item.name).includes(query)).slice(0, 12) : [];
        const results = $('molecule-results');
        results.replaceChildren();
        activeSuggestionIndex = -1;
        matches.forEach((item, position) => {
            const option = element('li', '');
            const button = element('button', item.name);
            button.type = 'button';
            button.id = `molecule-option-${position}`;
            button.setAttribute('role', 'option');
            button.addEventListener('click', () => chooseMolecule(item));
            option.append(button);
            results.append(option);
        });
        const hasMatches = matches.length > 0;
        results.hidden = !hasMatches;
        $('molecule-search').setAttribute('aria-expanded', String(hasMatches));
        $('search-count').textContent = query
            ? (hasMatches ? `${matches.length}${index.filter(item => M.key(item.name).includes(query)).length > matches.length ? ' premiers résultats affichés' : ' résultat(s)'}.` : 'Aucune molécule trouvée.')
            : `${index.length} molécules disponibles. Commencez à taper un nom.`;
        if (selected && !matches.some(item => item.key === selected.key) && M.key(selected.name) !== query) {
            selected = null;
            selectedPresentationKey = 'all';
        }
        render();
    }
    $('molecule-search').addEventListener('input', filterMolecules);
    $('molecule-search').addEventListener('focus', () => {
        if ($('molecule-search').value.trim()) filterMolecules();
    });
    $('molecule-search').addEventListener('keydown', event => {
        const choices = [...$('molecule-results').querySelectorAll('button')];
        if (!choices.length) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            activeSuggestionIndex = event.key === 'ArrowDown'
                ? (activeSuggestionIndex + 1) % choices.length
                : (activeSuggestionIndex - 1 + choices.length) % choices.length;
            choices[activeSuggestionIndex].focus();
        } else if (event.key === 'Escape') {
            $('molecule-results').hidden = true;
            $('molecule-search').setAttribute('aria-expanded', 'false');
        }
    });
    function cell(amount, state) {
        if (state === 'missing') return element('td', 'Non importé', 'unavailable');
        if (state === 'unknown' && amount === 0) return element('td', 'Inconnu', 'unavailable');
        return element('td', money(amount) + (state === 'unknown' ? ' †' : ''), amount < 0 ? 'negative' : '');
    }
    const chartColors = ['#0f766e', '#6366f1', '#f59e0b', '#0284c7', '#db2777', '#64748b'];
    function renderVisualComparison(range, companies) {
        const visual = $('visual-comparison');
        if (!selected || selectedPresentationKey === 'compare') {
            visual.hidden = true;
            return;
        }
        visual.hidden = false;
        const positiveTotal = company => range.reduce((sum, month) => sum + Math.max(0, company.amounts[month]), 0);
        const ranked = companies.map(company => ({ ...company, positiveTotal: positiveTotal(company) }))
            .filter(company => company.positiveTotal > 0)
            .sort((a, b) => b.positiveTotal - a.positiveTotal || a.name.localeCompare(b.name));
        const direct = ranked.slice(0, 5);
        const remaining = ranked.slice(5);
        const series = [...direct];
        if (remaining.length) {
            series.push({
                name: 'Autres fabricants',
                amounts: Array.from({ length: 13 }, (_, month) => remaining.reduce((sum, company) => sum + Math.max(0, company.amounts[month]), 0))
            });
        }
        const selectedPresentation = selectedPresentationKey === 'all' ? null : selected.presentations.get(selectedPresentationKey);
        $('visual-title').textContent = selectedPresentation
            ? `Répartition mensuelle — ${selectedPresentation.label}`
            : 'Répartition mensuelle des achats';
        $('visual-subtitle').textContent = remaining.length
            ? 'Les cinq principaux fabricants sont affichés séparément; les autres sont regroupés.'
            : 'Chaque fabricant est affiché séparément.';
        $('chart-legend').replaceChildren();
        series.forEach((company, index) => {
            const item = element('span', '', 'legend-item');
            const swatch = element('span', '', 'legend-swatch');
            swatch.style.backgroundColor = chartColors[index];
            item.append(swatch, document.createTextNode(company.name));
            $('chart-legend').append(item);
        });
        const positiveByMonth = Object.fromEntries(range.map(month => [month,
            series.reduce((sum, company) => sum + Math.max(0, company.amounts[month]), 0)
        ]));
        const maximum = Math.max(1, ...Object.values(positiveByMonth));
        const chart = $('comparison-chart');
        chart.replaceChildren();
        chart.setAttribute('aria-label', `Répartition mensuelle des achats de ${selected.name}${selectedPresentation ? `, ${selectedPresentation.label}` : ''} par fabricant`);
        for (const month of range) {
            const state = M.coverage(data, month);
            const column = element('div', '', 'chart-column');
            const positive = positiveByMonth[month];
            const total = companies.reduce((sum, company) => sum + company.amounts[month], 0);
            const value = element('span', state === 'missing' ? 'Non importé' : `${money(total)}${state === 'unknown' ? ' †' : ''}`, 'chart-value');
            column.append(value);
            if (state === 'missing' || !positive) {
                column.append(element('div', state === 'missing' ? 'Non importé' : '0,00 $', 'chart-empty'));
            } else {
                const stack = element('div', '', 'chart-stack');
                series.forEach((company, index) => {
                    const amount = Math.max(0, company.amounts[month]);
                    if (!amount) return;
                    const segment = element('div', '', 'chart-segment');
                    segment.style.height = `${(amount / maximum) * 100}%`;
                    segment.style.backgroundColor = chartColors[index];
                    segment.title = `${company.name} : ${money(amount)}`;
                    stack.append(segment);
                });
                column.append(stack);
            }
            const label = element('span', months[month - 1].slice(0, 3), 'chart-month');
            if (state === 'unknown') label.append(document.createElement('br'), element('small', '† inconnu'));
            column.append(label);
            chart.append(column);
        }
        const summaries = $('monthly-summary');
        summaries.replaceChildren();
        for (const month of range) {
            const state = M.coverage(data, month);
            const card = element('article', '', `summary-card ${state === 'missing' ? 'missing' : ''}`);
            card.append(element('h4', months[month - 1]));
            if (state === 'missing') {
                card.append(element('span', 'Non importé', 'summary-amount'));
                card.append(element('p', 'Aucun montant ne peut être confirmé pour ce mois.'));
            } else {
                const total = companies.reduce((sum, company) => sum + company.amounts[month], 0);
                const mainCompany = [...companies].sort((a, b) => b.amounts[month] - a.amounts[month] || a.name.localeCompare(b.name))[0];
                card.append(element('span', `${money(total)}${state === 'unknown' ? ' †' : ''}`, `summary-amount${total < 0 ? ' negative' : ''}`));
                card.append(element('p', mainCompany?.amounts[month] > 0
                    ? `Montant net le plus élevé : ${mainCompany.name} (${money(mainCompany.amounts[month])}).`
                    : 'Aucun achat net positif enregistré.'));
                if (state === 'unknown') card.append(element('p', 'Statut d’importation inconnu.'));
            }
            summaries.append(card);
        }
    }
    function renderPresentationComparison(range) {
        const section = $('presentation-comparison');
        if (!selected || selectedPresentationKey !== 'compare') {
            section.hidden = true;
            return;
        }
        const presentations = [...selected.presentations.values()]
            .map(presentation => ({
                ...presentation,
                companies: [...presentation.companies.values()],
                total: [...presentation.companies.values()].reduce((sum, company) => sum + range.reduce((monthSum, month) => monthSum + company.amounts[month], 0), 0),
                positiveTotal: [...presentation.companies.values()].reduce((sum, company) => sum + range.reduce((monthSum, month) => monthSum + Math.max(0, company.amounts[month]), 0), 0)
            }))
            .sort((a, b) => a.label.localeCompare(b.label, 'fr-CA', { numeric: true }));
        section.hidden = false;
        $('presentation-comparison-subtitle').textContent = `Montants nets cumulés de ${months[range[0] - 1]} à ${months[range.at(-1) - 1]} ${M.YEAR}. Cliquez une barre pour consulter le détail mensuel.`;
        const rankedCompanies = new Map();
        presentations.forEach(presentation => presentation.companies.forEach(company => {
            rankedCompanies.set(company.name, (rankedCompanies.get(company.name) || 0) + range.reduce((sum, month) => sum + Math.max(0, company.amounts[month]), 0));
        }));
        const primaryNames = [...rankedCompanies.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([name]) => name);
        const legend = $('presentation-legend');
        legend.replaceChildren();
        primaryNames.forEach((name, index) => {
            const item = element('span', '', 'legend-item');
            const swatch = element('span', '', 'legend-swatch');
            swatch.style.backgroundColor = chartColors[index];
            item.append(swatch, document.createTextNode(name));
            legend.append(item);
        });
        if (rankedCompanies.size > primaryNames.length) {
            const item = element('span', '', 'legend-item');
            const swatch = element('span', '', 'legend-swatch');
            swatch.style.backgroundColor = chartColors[5];
            item.append(swatch, document.createTextNode('Autres fabricants'));
            legend.append(item);
        }
        const maxPositiveTotal = Math.max(1, ...presentations.map(presentation => presentation.positiveTotal));
        const bars = $('presentation-bars');
        bars.replaceChildren();
        bars.setAttribute('aria-label', `Comparaison des achats de ${selected.name} par force, formulation et fabricant`);
        presentations.forEach(presentation => {
            const row = element('article', '', 'presentation-row');
            const label = element('button', presentation.label, 'presentation-label');
            label.type = 'button';
            label.title = `Voir le détail mensuel de ${presentation.label}`;
            label.addEventListener('click', () => {
                selectedPresentationKey = presentation.key;
                render();
            });
            const track = element('div', '', 'presentation-track');
            const grouped = new Map();
            presentation.companies.forEach(company => {
                const amount = range.reduce((sum, month) => sum + Math.max(0, company.amounts[month]), 0);
                if (!amount) return;
                const group = primaryNames.includes(company.name) ? company.name : 'Autres fabricants';
                grouped.set(group, (grouped.get(group) || 0) + amount);
            });
            grouped.forEach((amount, name) => {
                const segment = element('div', '', 'presentation-segment');
                const colorIndex = name === 'Autres fabricants' ? 5 : primaryNames.indexOf(name);
                segment.style.width = `${(amount / maxPositiveTotal) * 100}%`;
                segment.style.backgroundColor = chartColors[colorIndex];
                segment.title = `${name} : ${money(amount)}`;
                track.append(segment);
            });
            const total = element('span', money(presentation.total), `presentation-total${presentation.total < 0 ? ' negative' : ''}`);
            const contributors = [...grouped.entries()].sort((a, b) => b[1] - a[1]).map(([name, amount]) => `${name} (${money(amount)})`).join(' · ');
            const detail = element('p', contributors || 'Aucun achat net positif enregistré.', 'presentation-detail');
            row.append(label, track, total, detail);
            bars.append(row);
        });
    }
    function render() {
        if (!data) return;
        const start = +$('start-month').value, end = +$('end-month').value;
        const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
        const complete = range.every(m => M.coverage(data, m) === 'imported');
        $('coverage').replaceChildren();
        for (let m = 1; m <= 12; m++) {
            const state = M.coverage(data, m);
            const chip = element('div', '', `month ${state}${m < start || m > end ? ' outside' : ''}`);
            chip.append(element('strong', months[m - 1].slice(0, 3)), element('span', labels[state]));
            $('coverage').append(chip);
        }
        const legacy = Array.from({ length: 12 }, (_, i) => M.coverage(data, i + 1)).includes('unknown');
        $('coverage-note').textContent = legacy
            ? 'Les données enregistrées avant cette fonction n’ont pas d’historique d’importation. Réimportez les fichiers mensuels pour confirmer les mois. Les montants existants restent visibles.'
            : 'Un mois importé peut afficher 0,00 $. Les mois sans importation sont identifiés comme « Non importé ». ';
        populatePresentationControl();
        const isPresentationComparison = selectedPresentationKey === 'compare';
        const selectedPresentation = selected && selectedPresentationKey !== 'all' && !isPresentationComparison
            ? selected.presentations.get(selectedPresentationKey)
            : null;
        $('molecule-title').textContent = isPresentationComparison ? `${selected.name} — Comparaison des doses` : (selectedPresentation ? `${selected.name} — ${selectedPresentation.label}` : (selected?.name || 'Choisissez une molécule'));
        $('detail-description').textContent = isPresentationComparison
            ? 'Comparez les fabricants utilisés pour chaque force et formulation pendant la période sélectionnée.'
            : selectedPresentation
            ? 'Comparaison limitée à cette force et cette formulation. Les différents DIN et formats de cette présentation sont regroupés.'
            : 'Toutes les forces, formulations et tailles de formats sont combinées.';
        $('unnamed-note').hidden = !selected || selected.key !== '';
        $('unknown-note').hidden = !range.some(m => M.coverage(data, m) === 'unknown');
        $('total-label').textContent = complete ? 'Achats nets' : 'Sous-total enregistré';
        $('period-label').textContent = `${months[start - 1]}–${months[end - 1]} ${M.YEAR}`;
        const table = $('purchase-table');
        table.tHead.replaceChildren(); table.tBodies[0].replaceChildren(); table.tFoot.replaceChildren();
        table.hidden = !selected || isPresentationComparison;
        $('table-region').hidden = !selected || isPresentationComparison;
        $('table-note').hidden = !selected || isPresentationComparison;
        if (!selected) {
            $('period-total').textContent = '—';
            $('selection-status').textContent = index.length ? 'Tapez le nom d’une molécule pour voir les fabricants.' : 'Aucune molécule n’est disponible. Importez un fichier mensuel dans le suivi par fabricant.';
            renderVisualComparison([], []);
            renderPresentationComparison([]);
            return;
        }
        const heading = element('tr', '');
        const columnNames = ['Fabricant', ...range.map(m => months[m - 1]), complete ? 'Total' : 'Sous-total enregistré'];
        columnNames.forEach(name => { const th = element('th', name); th.scope = 'col'; heading.append(th); });
        table.tHead.append(heading);
        const analysis = selectedPresentation || selected;
        const companies = [...analysis.companies.values()].sort((a, b) =>
            range.reduce((sum, m) => sum + b.amounts[m] - a.amounts[m], 0) || a.name.localeCompare(b.name));
        const totals = Array(13).fill(0);
        const hasAmount = company => range.some(m => M.coverage(data, m) === 'imported' || (M.coverage(data, m) === 'unknown' && company.amounts[m] !== 0));
        for (const company of companies) {
            const row = element('tr', '');
            const name = element('th', company.name); name.scope = 'row'; row.append(name);
            let subtotal = 0;
            for (const m of range) {
                const state = M.coverage(data, m);
                row.append(cell(company.amounts[m], state));
                if (state !== 'missing') { subtotal += company.amounts[m]; totals[m] += company.amounts[m]; }
            }
            row.append(element('td', hasAmount(company) ? money(subtotal) : '—', subtotal < 0 ? 'negative' : ''));
            table.tBodies[0].append(row);
        }
        const footer = element('tr', '');
        const totalHeading = element('th', complete ? 'Total des achats nets' : 'Sous-total enregistré'); totalHeading.scope = 'row'; footer.append(totalHeading);
        range.forEach(m => footer.append(cell(totals[m], M.coverage(data, m))));
        const total = range.reduce((sum, m) => sum + totals[m], 0);
        const available = companies.some(hasAmount);
        footer.append(element('td', available ? money(total) : '—', total < 0 ? 'negative' : ''));
        table.tFoot.append(footer);
        $('period-total').textContent = available ? money(total) : '—';
        const scope = isPresentationComparison ? ' pour toutes les présentations de cette molécule' : (selectedPresentation ? ` pour ${selectedPresentation.label}` : ' pour cette molécule');
        $('selection-status').textContent = `${companies.length} ${companies.length === 1 ? 'fabricant avec des données' : 'fabricants avec des données'}${scope}. ${complete ? 'Tous les mois sélectionnés sont importés.' : 'Certains mois sont non confirmés ou non importés; le sous-total ne représente pas toute la période.'}`;
        renderVisualComparison(range, companies);
        renderPresentationComparison(range);
    }
    async function load() {
        $('workspace').hidden = true;
        $('load-status').hidden = false;
        $('load-status').textContent = "Chargement des achats de votre pharmacie…";
        $('retry-load').hidden = true;
        data = null; index = []; selected = null; selectedPresentationKey = 'all';
        try {
            if (!client) throw new Error('La connexion n’a pas pu être établie. Vérifiez votre connexion et réessayez.');
            const { data: auth, error: authError } = await client.auth.getUser();
            if (authError || !auth.user) {
                $('load-status').textContent = 'Votre session a expiré. Connectez-vous dans PharmaOps pour consulter les achats.';
                return;
            }
            const { data: profile, error: profileError } = await client.from('profiles').select('pharmacy_id').eq('id', auth.user.id).maybeSingle();
            if (profileError || !profile?.pharmacy_id) throw new Error('Votre pharmacie n’a pas pu être identifiée. Vérifiez votre compte dans PharmaOps.');
            const pharmacyId = profile.pharmacy_id;
            const { data: records, error } = await client.from('generics_purchases').select('data,updated_at')
                .eq('pharmacy_id', pharmacyId).eq('period_type', 'monthly').eq('year', M.YEAR)
                .order('updated_at', { ascending: false }).limit(1);
            if (error) throw new Error('Les achats n’ont pas pu être chargés. Vérifiez votre connexion et réessayez.');
            data = records?.[0]?.data || { manufacturers: [] };
            if (!Array.isArray(data.manufacturers)) throw new Error('Les achats enregistrés ne sont pas dans le format attendu.');
            index = M.buildIndex(data);
            $('start-month').value = '1'; $('end-month').value = String(M.latestMonth(data));
            $('molecule-search').value = '';
            filterMolecules();
            $('workspace').hidden = false; $('load-status').hidden = true;
            const { data: pharmacy } = await client.from('pharmacies').select('name').eq('id', pharmacyId).maybeSingle();
            $('pharmacy-name').textContent = pharmacy?.name || '';
        } catch (error) {
            $('workspace').hidden = true;
            $('load-status').hidden = false;
            $('load-status').textContent = error.message;
            $('retry-load').hidden = false;
        }
    }
    $('retry-load').addEventListener('click', load);
    client?.auth.onAuthStateChange(event => {
        if (event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
            data = null; index = []; selected = null; selectedPresentationKey = 'all';
            $('workspace').hidden = true;
            $('purchase-table').tBodies[0].replaceChildren();
            $('load-status').hidden = false;
            $('load-status').textContent = 'Votre session a changé. Rechargez la page pour consulter les achats.';
        }
    });
    load();
})();
