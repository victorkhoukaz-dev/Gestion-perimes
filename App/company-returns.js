(() => {
    const D = window.CompanyReturnsData;
    const $ = id => document.getElementById('cr-' + id);
    let context = null, store = null, key = '', raw = null, editing = null, cloud = null, remoteBusy = false;
    const root = document.createElement('section');
    root.id = 'company-returns';
    root.hidden = true;
    root.innerHTML = `
        <div class="cr-shell">
            <div class="cr-toolbar"><button type="button" id="cr-back">← PharmaOps</button><span id="cr-pharmacy"></span><span class="cr-badge" id="cr-sync">Copie de récupération locale</span></div>
            <div class="cr-heading"><p class="cr-eyebrow">PRODUITS PÉRIMÉS</p><h1>Retours fabricants</h1><p>Choisissez un fabricant, scannez chaque emballage et indiquez une quantité approximative pour préparer le rapport à remettre à votre représentant.</p></div>
            <p class="cr-local-note">Enregistrez le brouillon pour retrouver vos rapports sur les autres appareils de votre pharmacie. Une copie de récupération est conservée sur cet appareil pendant la saisie. Une connexion Internet est nécessaire pour enregistrer en ligne.</p>
            <p id="cr-status" role="status" aria-live="polite"></p>
            <div class="cr-workspace" id="cr-workspace">
                <aside class="cr-panel cr-report-picker"><div class="cr-section-heading"><h2>Vos rapports</h2><button id="cr-new" type="button">+ Nouveau rapport</button></div><label for="cr-reports">Ouvrir un rapport enregistré</label><select id="cr-reports"></select><div class="cr-report-actions"><button id="cr-save" type="button" class="cr-primary">Enregistrer le brouillon</button><button id="cr-delete" type="button" class="cr-danger">Supprimer le rapport</button></div><p id="cr-saved" class="cr-muted"></p></aside>
                <div class="cr-main">
                    <section class="cr-panel">
                        <div class="cr-section-heading"><h2>1. Choisir le fabricant</h2><span class="cr-step">DÉTAILS DU RAPPORT</span></div>
                        <label for="cr-company">Nom du fabricant</label><input id="cr-company" maxlength="120" placeholder="Ex. : Apotex" autocomplete="organization">
                    </section>
                    <section class="cr-panel">
                        <div class="cr-section-heading"><h2 id="cr-entry-title">2. Scanner et ajouter un produit</h2><button type="button" id="cr-camera">Scanner avec la caméra</button></div>
                        <div class="cr-code-row"><div><label for="cr-code">Code-barres / code 2D</label><input id="cr-code" autocomplete="off" placeholder="Scannez ou collez un code-barres"></div><button type="button" id="cr-read">Lire le code</button></div>
                        <p id="cr-lookup" class="cr-muted">Vérifiez les renseignements sur l’emballage avant d’ajouter chaque ligne.</p>
                        <form id="cr-entry">
                            <div class="cr-grid"><div class="autocomplete-wrapper cr-autocomplete"><label for="cr-din">DIN (facultatif)</label><input id="cr-din" inputmode="numeric" pattern="[0-9]{8}" maxlength="8" placeholder="DIN à 8 chiffres" autocomplete="off"><div class="autocomplete-suggestions" id="cr-din-suggestions" style="display:none"></div></div><div class="autocomplete-wrapper cr-autocomplete"><label for="cr-product">Nom du produit</label><input id="cr-product" required maxlength="200" autocomplete="off"><div class="autocomplete-suggestions" id="cr-product-suggestions" style="display:none"></div></div><div><label for="cr-strength">Dosage</label><input id="cr-strength" maxlength="100" placeholder="Ex. : 10 mg"></div><div><label for="cr-format">Format de l’emballage</label><input id="cr-format" maxlength="100" placeholder="Ex. : 100 comprimés"></div><div><label for="cr-lot">Numéro de lot</label><input id="cr-lot" required maxlength="100" autocomplete="off"></div><div><label for="cr-expiry">Mois et année de péremption</label><input id="cr-expiry" type="month" required min="2000-01" max="2099-12"></div><div><label for="cr-quantity">Quantité approximative</label><input id="cr-quantity" type="number" required min="0.000001" max="1000000000" step="any" inputmode="decimal" placeholder="Ex. : 75"></div><div><label for="cr-unit">Unité de quantité</label><select id="cr-unit"></select></div></div>
                            <div class="cr-actions"><button type="submit" id="cr-add" class="cr-primary">Ajouter au rapport</button><button type="button" id="cr-clear">Effacer la saisie</button><span class="cr-muted" id="cr-entry-note">Pour un même produit, lot, mois de péremption et unité, les quantités sont additionnées.</span></div>
                        </form>
                    </section>
                    <section class="cr-panel cr-report">
                        <div class="cr-section-heading cr-no-print"><h2>3. Vérifier le rapport</h2><button id="cr-print" type="button">Imprimer / Enregistrer en PDF</button></div>
                        <div class="cr-print-heading"><p id="cr-print-pharmacy"></p><h2 id="cr-print-company">Rapport de retour au fabricant</h2><p id="cr-report-meta"></p><p>Produits périmés · Quantités approximatives</p></div>
                        <div class="cr-table-wrap"><table><thead><tr><th>Produit / dosage</th><th>DIN</th><th>Lot</th><th>Péremption</th><th>Qté approx.</th><th class="cr-no-print">Actions</th></tr></thead><tbody id="cr-lines"></tbody></table></div>
                        <p id="cr-empty" class="cr-muted">Aucun produit pour le moment. Scannez un emballage ou saisissez ses renseignements ci-dessus.</p>
                        <p class="cr-report-footer">Rapport préparé pour vérification par le représentant du fabricant. Les quantités sont approximatives. Ce rapport ne confirme ni le retour ni le crédit.</p>
                    </section>
                </div>
            </div>
        </div>

    `;
    (document.getElementById('tab-company-returns') || document.body).append(root);
    D.units.forEach(unit => $('unit').add(new Option(D.unitLabel(unit), unit)));
    const fields = ['code', 'din', 'product', 'strength', 'format', 'lot', 'expiry', 'quantity', 'unit'];
    const uid = () => crypto.randomUUID();
    const copy = value => JSON.parse(JSON.stringify(value));
    const active = () => store?.reports.find(report => report.id === store.activeId);
    const stamp = value => new Date(value).toLocaleString('fr-CA');
    function status(message, error = false) {
        $('status').textContent = message;
        $('status').className = error ? 'cr-error' : 'cr-success';
    }
    function commit(next) {
        try {
            if (cloud) cloud.stage(next);
            else raw = D.saveReports(localStorage, key, raw, next);
            store = next;
            updateSync();
            return true;
        } catch (error) {
            status('Échec de l’enregistrement : ' + D.errorMessage(error) + ' Votre saisie actuelle reste affichée.', true);
            return false;
        }
    }
    function updateSync() {
        const message = cloud ? (cloud.isDirty() ? 'Non enregistré en ligne · copie de récupération sur cet appareil' : 'Enregistré pour votre pharmacie') : 'Enregistré sur cet appareil';
        $('sync').textContent = message;
        $('saved').textContent = message;
    }
    function newReport(next) {
        const report = { id: uid(), company: '', pharmacy: context.pharmacyName, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lines: [], entry: {} };
        next.reports.unshift(report); next.activeId = report.id;
    }
    function readEntry() { return Object.fromEntries(fields.map(field => [field, $(field).value])); }
    function fillEntry(entry = {}) {
        context?.closeSuggestions?.();
        fields.forEach(field => { $(field).value = entry[field] ?? (field === 'unit' ? 'tablets' : ''); });
    }
    function saveDraft() {
        if (!active()) return false;
        const current = active();
        if (current.company === $('company').value.trim() && JSON.stringify(current.entry || {}) === JSON.stringify(readEntry()) && (current.editingId || null) === editing) return true;
        const next = copy(store), report = next.reports.find(item => item.id === next.activeId);
        report.company = $('company').value.trim();
        report.entry = readEntry();
        report.editingId = editing;
        report.updatedAt = new Date().toISOString();
        const ok = commit(next);
        if (ok) {
            const option = [...$('reports').options].find(option => option.value === report.id);
            if (option) option.textContent = report.company || 'Rapport sans titre';
            updateHeading();
        }
        return ok;
    }
    function updateHeading() {
        const report = active();
        $('print-pharmacy').textContent = report?.pharmacy || context?.pharmacyName || '';
        $('print-company').textContent = (report?.company || 'Fabricant') + ' — Rapport de retour';
        $('report-meta').textContent = report ? 'Préparé le : ' + stamp(report.createdAt) + ' · Modifié le : ' + stamp(report.updatedAt) + ' · ' + report.lines.length + ' ligne(s)' : '';
        $('print').disabled = !report?.company || !report?.lines.length;
    }
    function resetEdit() {
        editing = null;
        $('entry-title').textContent = '2. Scanner et ajouter un produit';
        $('add').textContent = 'Ajouter au rapport';
        $('entry-note').textContent = 'Pour un même produit, lot, mois de péremption et unité, les quantités sont additionnées.';
    }
    function render() {
        const report = active();
        $('reports').replaceChildren(...store.reports.map(item => new Option(item.company || 'Rapport sans titre', item.id)));
        $('reports').value = store.activeId;
        $('reports').disabled = !store.reports.length;
        $('save').disabled = !store || remoteBusy;
        $('delete').disabled = !report;
        for (const id of ['company', 'code', 'camera', 'read', 'din', 'product', 'strength', 'format', 'lot', 'expiry', 'quantity', 'unit', 'add', 'clear']) $(id).disabled = !report;
        $('company').value = report?.company || '';
        fillEntry(report?.entry);
        resetEdit();
        if (report?.editingId && report.lines.some(line => line.id === report.editingId)) {
            editing = report.editingId;
            $('entry-title').textContent = 'Modifier une ligne du rapport';
            $('add').textContent = 'Enregistrer la ligne';
            $('entry-note').textContent = 'La quantité de la ligne sélectionnée sera remplacée.';
        }
        $('lines').replaceChildren();
        for (const line of report?.lines || []) {
            const row = document.createElement('tr');
            const values = [line.product + (line.strength ? ' · ' + line.strength : '') + (line.format ? ' (' + line.format + ')' : ''), line.din || '—', line.lot, line.expiry, Number(line.quantity).toLocaleString('fr-CA', { maximumFractionDigits: 6 }) + ' ' + D.unitLabel(line.unit)];
            for (const value of values) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
            const actions = document.createElement('td'); actions.className = 'cr-no-print cr-row-actions';
            for (const [label, handler] of [['Modifier', () => editLine(line)], ['Retirer', () => removeLine(line)]]) {
                const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.addEventListener('click', handler); actions.append(button);
            }
            row.append(actions); $('lines').append(row);
        }
        $('empty').hidden = !!report?.lines.length;
        updateSync();
        updateHeading();
    }
    function editLine(line) {
        if (!saveDraft()) return;
        fillEntry(line); editing = line.id;
        $('entry-title').textContent = 'Modifier une ligne du rapport';
        $('add').textContent = 'Enregistrer la ligne';
        $('entry-note').textContent = 'La quantité de la ligne sélectionnée sera remplacée.';
        $('quantity').focus(); $('entry').scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    function removeLine(line) {
        if (!confirm('Retirer ' + line.product + ' (lot ' + line.lot + ') de ce rapport ?')) return;
        if (!saveDraft()) return;
        const next = copy(store), report = next.reports.find(item => item.id === next.activeId);
        report.lines = report.lines.filter(item => item.id !== line.id); report.updatedAt = new Date().toISOString();
        if (commit(next)) { render(); status('Ligne retirée.'); }
    }
    function resolveCode(value) {
        if (!value.trim()) { status('Scannez ou saisissez d’abord un code-barres.', true); return; }
        const scanned = D.parseBarcode(value);
        const product = D.findProduct(context.catalog(), scanned.code, scanned.gs1 ? 'barcode' : 'auto');
        // Start each scan with empty lot/expiry; never carry these from a previous package.
        fillEntry({ code: scanned.code, ...product, lot: scanned.lot, expiry: scanned.expiry });
        resetEdit();
        $('lookup').textContent = product
            ? 'Produit trouvé dans le catalogue. Vérifiez le lot, la péremption et la quantité sur l’emballage.'
            : 'Produit introuvable ou code associé à plusieurs produits. Saisissez le DIN ou le nom du produit, puis vérifiez le lot et la péremption.';
        saveDraft();
        (product ? $('quantity') : $('din')).focus();
    }
    $('read').addEventListener('click', () => resolveCode($('code').value));
    $('code').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); resolveCode($('code').value); } });
    function selectMedication(item) {
        const clean = value => !value || value === 'N/A' ? '' : String(value);
        const din = clean(item.din);
        $('din').value = /^\d{1,8}$/.test(din) ? din.padStart(8, '0') : din;
        $('product').value = clean(item.product);
        $('strength').value = clean(item.dosage);
        $('format').value = clean(item.format);
        context?.closeSuggestions?.();
        $('lookup').textContent = 'Produit trouvé dans le catalogue. Vérifiez tous les renseignements sur l’emballage.';
        saveDraft();
        $('quantity').focus();
    }
    for (const field of ['din', 'product']) {
        $(field).addEventListener('input', () => {
            if (!context) return;
            const value = $(field).value.trim();
            const match = field === 'din' && D.findProduct(context.catalog(), value, 'din');
            if (match) selectMedication({ ...match, dosage: match.strength });
            else context.suggest?.(value, field, selectMedication);
        });
        $(field).addEventListener('keydown', event => {
            const box = $(field + '-suggestions');
            const rows = box.querySelectorAll('.autocomplete-suggestion');
            if (event.key === 'Enter' && box.style.display !== 'none' && rows.length) {
                event.preventDefault();
                (box.querySelector('.highlighted') || rows[0]).click();
                return;
            }
            context?.suggestionKeys?.(event, field);
        });
    }
    $('din').addEventListener('change', () => {
        if (!context) return;
        const match = D.findProduct(context.catalog(), $('din').value.trim(), 'din');
        if (match) selectMedication({ ...match, dosage: match.strength });
    });
    $('code').addEventListener('input', () => {
        if (context && D.findProduct(context.catalog(), $('code').value, 'barcode')) resolveCode($('code').value);
    });
    $('code').addEventListener('change', () => {
        if (context && $('code').value.trim()) resolveCode($('code').value);
    });
    $('entry').addEventListener('input', saveDraft);
    $('entry').addEventListener('change', saveDraft);
    $('code').addEventListener('input', saveDraft);
    $('company').addEventListener('input', saveDraft);
    $('entry').addEventListener('submit', event => {
        event.preventDefault();
        if (!$('company').value.trim()) { status('Saisissez d’abord le nom du fabricant.', true); $('company').focus(); return; }
        try {
            const entry = D.validateEntry(readEntry()), next = copy(store), report = next.reports.find(item => item.id === next.activeId);
            report.company = $('company').value.trim();
            if (editing) {
                if (report.lines.some(line => line.id !== editing && D.lineKey(line) === D.lineKey(entry))) throw D.userError('Ce produit et ce lot figurent déjà dans le rapport. Modifiez la ligne existante ou scannez à nouveau le produit pour ajouter une quantité.');
                report.lines = report.lines.map(line => line.id === editing ? { ...entry, id: editing } : line);
            } else report.lines = D.addLine(report.lines, entry, uid());
            const wasEditing = !!editing;
            report.entry = {}; report.editingId = null; report.updatedAt = new Date().toISOString();
            if (commit(next)) { render(); status(wasEditing ? 'Ligne mise à jour.' : 'Produit ajouté au brouillon du rapport.'); $('code').focus(); }
        } catch (error) { status(D.errorMessage(error), true); }
    });
    $('clear').addEventListener('click', () => {
        if (!editing && fields.some(field => !['unit'].includes(field) && $(field).value) && !confirm('Effacer la saisie actuelle ? Les lignes du rapport seront conservées.')) return;
        fillEntry(); resetEdit(); saveDraft(); $('code').focus();
    });
    $('new').addEventListener('click', () => {
        if (active() && !saveDraft()) return;
        const next = copy(store); newReport(next);
        if (commit(next)) { render(); status('Nouveau rapport créé. Vos rapports précédents sont conservés.'); $('company').focus(); }
    });
    $('save').addEventListener('click', async () => {
        if (remoteBusy || !store || (active() && !saveDraft())) return;
        if (!cloud) { status('Brouillon enregistré sur cet appareil.'); return; }
        const owner = context, session = cloud, snapshot = copy(store);
        remoteBusy = true; $('save').disabled = true;
        try {
            const result = await session.save(snapshot);
            if (context === owner) { updateSync(); status(result.dirty ? 'Les modifications précédentes ont été enregistrées en ligne. Les modifications plus récentes restent à enregistrer.' : 'Brouillon enregistré pour votre pharmacie. Vous pouvez l’ouvrir sur un autre appareil.'); }
        } catch (error) { if (context === owner) status('Non enregistré en ligne : ' + D.errorMessage(error) + ' Votre copie de récupération est conservée.', true); }
        finally { if (context === owner) { remoteBusy = false; $('save').disabled = false; } }
    });
    $('delete').addEventListener('click', () => {
        const report = active();
        if (!report) return;
        const name = report.company || 'Rapport sans titre';
        if (!confirm('Supprimer « ' + name + ' » et toutes ses lignes de produits ? Cette action est irréversible.')) return;
        const next = copy(store);
        next.reports = next.reports.filter(item => item.id !== report.id);
        next.activeId = next.reports[0]?.id || null;
        if (commit(next)) { render(); status('Rapport retiré du brouillon. Cliquez sur Enregistrer le brouillon pour confirmer la suppression en ligne.'); }
    });
    $('reports').addEventListener('change', () => {
        const selected = $('reports').value;
        if (!saveDraft()) { $('reports').value = store.activeId; return; }
        const next = copy(store); next.activeId = selected;
        if (commit(next)) { render(); status('Rapport ouvert.'); }
    });
    $('print').addEventListener('click', () => {
        if (!saveDraft()) return;
        if (!active()?.company || !active()?.lines.length) return;
        if (fields.some(field => field !== 'unit' && $(field).value) && !confirm('La saisie actuelle n’a pas été ajoutée au rapport. Imprimer uniquement les lignes déjà ajoutées ?')) return;
        window.print();
    });
    function stopCamera() { context?.stopScan?.(); }
    function startCamera() {
        if (!context?.scan) {
            status('Ouvrez Retours fabricants dans le module Expirés Labo pour utiliser le lecteur de codes avec la caméra.', true);
            return;
        }
        const owner = context;
        context.scan(decoded => { if (context === owner) resolveCode(decoded); });
    }
    $('camera').addEventListener('click', startCamera);
    $('back').addEventListener('click', () => { if (!active() || saveDraft()) { const back = context.back; close(); back(); } });
    window.addEventListener('storage', event => {
        if (context && (event.key === key || event.key === null)) status('Les rapports ont été modifiés dans un autre onglet. Rechargez cette page avant de continuer.', true);
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopCamera(); });
    window.addEventListener('pagehide', stopCamera);
    function close() {
        stopCamera();
        context?.closeSuggestions?.();
        context = null; store = null; key = ''; raw = null; editing = null; cloud = null; remoteBusy = false;
        root.hidden = true; document.body.classList.remove('cr-active');
        $('lines').replaceChildren(); $('reports').replaceChildren(); $('pharmacy').textContent = ''; fillEntry(); $('company').value = '';
    }
    async function open(options) {
        close();
        context = options;
        key = 'pharmaops:company-returns:v1:' + options.pharmacyId;
        root.hidden = false; document.body.classList.add('cr-active');
        $('back').textContent = options.backLabel || '← PharmaOps';
        $('pharmacy').textContent = options.pharmacyName; $('workspace').hidden = true; status('');
        const owner = context;
        $('workspace').inert = false;
        try {
            let warning = '';
            if (options.client) {
                cloud = window.CompanyReturnsCloud.create(options.client, options.pharmacyId, options.userId, localStorage);
                let loaded = await cloud.load();
                if (context !== owner) return;
                if (loaded.conflict && confirm('Des rapports plus récents ont été enregistrés sur un autre appareil. Ouvrir la dernière version en ligne ? Votre copie de récupération non enregistrée sera archivée sur cet appareil.')) {
                    loaded = await cloud.load(true);
                    if (context !== owner) return;
                }
                store = loaded.value;
                if (loaded.dirty) warning = loaded.conflict ? 'Une version en ligne plus récente existe. Votre copie de récupération est affichée. Rouvrez Retours fabricants et choisissez la dernière version en ligne avant d’enregistrer.' : 'Des modifications non enregistrées en ligne ont été récupérées. Cliquez sur Enregistrer le brouillon lorsque vous êtes prêt.';
            } else {
                const saved = D.loadReports(localStorage, key); raw = saved.raw; store = saved.value;
            }
            if (!active()) {
                const next = copy(store);
                if (next.reports.length) next.activeId = next.reports[0].id;
                else newReport(next);
                if (!commit(next)) return;
            }
            render(); $('workspace').hidden = false; $('company').focus();
            if (warning) status(warning, true);
        } catch (error) { if (context === owner) status('Impossible de charger les rapports en ligne : ' + D.errorMessage(error) + ' La copie de récupération et les anciens rapports du navigateur sont conservés. Rouvrez Retours fabricants pour réessayer.', true); }
    }
    window.CompanyReturns = { open, close, canLeave: () => !context || !active() || saveDraft() };
})();
