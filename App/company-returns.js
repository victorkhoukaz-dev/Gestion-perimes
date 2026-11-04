(() => {
    const D = window.CompanyReturnsData;
    const $ = id => document.getElementById('cr-' + id);
    let context = null, store = null, key = '', raw = null, editing = null;
    const root = document.createElement('section');
    root.id = 'company-returns';
    root.hidden = true;
    root.innerHTML = `
        <div class="cr-shell">
            <div class="cr-toolbar"><button type="button" id="cr-back">← PharmaOps</button><span id="cr-pharmacy"></span><span class="cr-badge">Saved on this device</span></div>
            <div class="cr-heading"><p class="cr-eyebrow">EXPIRED PRODUCTS</p><h1>Retours fabricants</h1><p>One company. Scan each package, add an approximate quantity, and prepare a report for your representative.</p></div>
            <p class="cr-local-note">Drafts stay in this browser on this device. Print or save a PDF before clearing browser data. Reports are separate from the expiry inventory.</p>
            <p id="cr-status" role="status" aria-live="polite"></p>
            <div class="cr-workspace" id="cr-workspace">
                <aside class="cr-panel cr-report-picker"><div class="cr-section-heading"><h2>Your reports</h2><button id="cr-new" type="button">+ New report</button></div><label for="cr-reports">Open a saved report</label><select id="cr-reports"></select><div class="cr-report-actions"><button id="cr-save" type="button" class="cr-primary">Save draft</button><button id="cr-delete" type="button" class="cr-danger">Delete report</button></div><p id="cr-saved" class="cr-muted"></p></aside>
                <div class="cr-main">
                    <section class="cr-panel">
                        <div class="cr-section-heading"><h2>1. Choose the company</h2><span class="cr-step">REPORT DETAILS</span></div>
                        <label for="cr-company">Company name</label><input id="cr-company" maxlength="120" placeholder="e.g. Apotex" autocomplete="organization">
                    </section>
                    <section class="cr-panel">
                        <div class="cr-section-heading"><h2 id="cr-entry-title">2. Scan and add a product</h2><button type="button" id="cr-camera">Scan with camera</button></div>
                        <div class="cr-code-row"><div><label for="cr-code">Barcode / 2D scanner input</label><input id="cr-code" autocomplete="off" placeholder="Scan or paste a barcode"></div><button type="button" id="cr-read">Read code</button></div>
                        <p id="cr-lookup" class="cr-muted">Check the package details before adding each line.</p>
                        <form id="cr-entry">
                            <div class="cr-grid"><div class="autocomplete-wrapper cr-autocomplete"><label for="cr-din">DIN (optional)</label><input id="cr-din" inputmode="numeric" pattern="[0-9]{8}" maxlength="8" placeholder="8-digit DIN" autocomplete="off"><div class="autocomplete-suggestions" id="cr-din-suggestions" style="display:none"></div></div><div class="autocomplete-wrapper cr-autocomplete"><label for="cr-product">Product name</label><input id="cr-product" required maxlength="200" autocomplete="off"><div class="autocomplete-suggestions" id="cr-product-suggestions" style="display:none"></div></div><div><label for="cr-strength">Strength</label><input id="cr-strength" maxlength="100" placeholder="e.g. 10 mg"></div><div><label for="cr-format">Package size / format</label><input id="cr-format" maxlength="100" placeholder="e.g. 100 tablets"></div><div><label for="cr-lot">Lot number</label><input id="cr-lot" required maxlength="100" autocomplete="off"></div><div><label for="cr-expiry">Expiry month / year</label><input id="cr-expiry" type="month" required min="2000-01" max="2099-12"></div><div><label for="cr-quantity">Approximate quantity</label><input id="cr-quantity" type="number" required min="0.000001" max="1000000000" step="any" inputmode="decimal" placeholder="e.g. 75"></div><div><label for="cr-unit">Quantity unit</label><select id="cr-unit"></select></div></div>
                            <div class="cr-actions"><button type="submit" id="cr-add" class="cr-primary">Add to report</button><button type="button" id="cr-clear">Clear entry</button><span class="cr-muted" id="cr-entry-note">Same product, lot, expiry and unit: quantities are added together.</span></div>
                        </form>
                    </section>
                    <section class="cr-panel cr-report">
                        <div class="cr-section-heading cr-no-print"><h2>3. Review the report</h2><button id="cr-print" type="button">Print / Save PDF</button></div>
                        <div class="cr-print-heading"><p id="cr-print-pharmacy"></p><h2 id="cr-print-company">Company return report</h2><p id="cr-report-meta"></p><p>Expired products · Approximate quantities</p></div>
                        <div class="cr-table-wrap"><table><thead><tr><th>Product / strength</th><th>DIN</th><th>Lot</th><th>Expiry</th><th>Approx. quantity</th><th class="cr-no-print">Actions</th></tr></thead><tbody id="cr-lines"></tbody></table></div>
                        <p id="cr-empty" class="cr-muted">No products yet. Scan a package or enter its details above.</p>
                        <p class="cr-report-footer">Prepared for company representative review. Quantities are estimates; this report does not confirm a return or credit.</p>
                    </section>
                </div>
            </div>
        </div>

    `;
    (document.getElementById('tab-company-returns') || document.body).append(root);
    D.units.forEach(unit => $('unit').add(new Option(unit, unit)));
    const fields = ['code', 'din', 'product', 'strength', 'format', 'lot', 'expiry', 'quantity', 'unit'];
    const uid = () => crypto.randomUUID();
    const copy = value => JSON.parse(JSON.stringify(value));
    const active = () => store?.reports.find(report => report.id === store.activeId);
    const stamp = value => new Date(value).toLocaleString('en-CA');
    function status(message, error = false) {
        $('status').textContent = message;
        $('status').className = error ? 'cr-error' : 'cr-success';
    }
    function commit(next) {
        try {
            const saved = D.saveReports(localStorage, key, raw, next);
            store = next; raw = saved;
            $('saved').textContent = 'Saved on this device · ' + stamp(active()?.updatedAt || new Date());
            return true;
        } catch (error) {
            status('Not saved: ' + error.message + ' Your current entry is still on screen.', true);
            return false;
        }
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
        const next = copy(store), report = next.reports.find(item => item.id === next.activeId);
        report.company = $('company').value.trim();
        report.entry = readEntry();
        report.editingId = editing;
        report.updatedAt = new Date().toISOString();
        const ok = commit(next);
        if (ok) {
            const option = [...$('reports').options].find(option => option.value === report.id);
            if (option) option.textContent = report.company || 'Untitled report';
            updateHeading();
        }
        return ok;
    }
    function updateHeading() {
        const report = active();
        $('print-pharmacy').textContent = report?.pharmacy || context?.pharmacyName || '';
        $('print-company').textContent = (report?.company || 'Company') + ' — Return report';
        $('report-meta').textContent = report ? 'Prepared: ' + stamp(report.createdAt) + ' · Updated: ' + stamp(report.updatedAt) + ' · ' + report.lines.length + ' line(s)' : '';
        $('print').disabled = !report?.company || !report?.lines.length;
    }
    function resetEdit() {
        editing = null;
        $('entry-title').textContent = '2. Scan and add a product';
        $('add').textContent = 'Add to report';
        $('entry-note').textContent = 'Same product, lot, expiry and unit: quantities are added together.';
    }
    function render() {
        const report = active();
        $('reports').replaceChildren(...store.reports.map(item => new Option(item.company || 'Untitled report', item.id)));
        $('reports').value = store.activeId;
        $('reports').disabled = !store.reports.length;
        $('save').disabled = !report;
        $('delete').disabled = !report;
        for (const id of ['company', 'code', 'camera', 'read', 'din', 'product', 'strength', 'format', 'lot', 'expiry', 'quantity', 'unit', 'add', 'clear']) $(id).disabled = !report;
        $('company').value = report?.company || '';
        fillEntry(report?.entry);
        resetEdit();
        if (report?.editingId && report.lines.some(line => line.id === report.editingId)) {
            editing = report.editingId;
            $('entry-title').textContent = 'Edit product line';
            $('add').textContent = 'Save line changes';
            $('entry-note').textContent = 'This replaces the selected line’s quantity.';
        }
        $('lines').replaceChildren();
        for (const line of report?.lines || []) {
            const row = document.createElement('tr');
            const values = [line.product + (line.strength ? ' · ' + line.strength : '') + (line.format ? ' (' + line.format + ')' : ''), line.din || '—', line.lot, line.expiry, Number(line.quantity).toLocaleString('en-CA', { maximumFractionDigits: 6 }) + ' ' + line.unit];
            for (const value of values) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
            const actions = document.createElement('td'); actions.className = 'cr-no-print cr-row-actions';
            for (const [label, handler] of [['Edit', () => editLine(line)], ['Remove', () => removeLine(line)]]) {
                const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.addEventListener('click', handler); actions.append(button);
            }
            row.append(actions); $('lines').append(row);
        }
        $('empty').hidden = !!report?.lines.length;
        $('saved').textContent = report ? 'Saved on this device · ' + stamp(report.updatedAt) : 'No reports yet. Click “New report” to begin.';
        updateHeading();
    }
    function editLine(line) {
        if (!saveDraft()) return;
        fillEntry(line); editing = line.id;
        $('entry-title').textContent = 'Edit product line';
        $('add').textContent = 'Save line changes';
        $('entry-note').textContent = 'This replaces the selected line’s quantity.';
        $('quantity').focus(); $('entry').scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    function removeLine(line) {
        if (!confirm('Remove ' + line.product + ' (lot ' + line.lot + ') from this report?')) return;
        if (!saveDraft()) return;
        const next = copy(store), report = next.reports.find(item => item.id === next.activeId);
        report.lines = report.lines.filter(item => item.id !== line.id); report.updatedAt = new Date().toISOString();
        if (commit(next)) { render(); status('Line removed.'); }
    }
    function resolveCode(value) {
        if (!value.trim()) { status('Scan or enter a barcode first.', true); return; }
        const scanned = D.parseBarcode(value);
        const product = D.findProduct(context.catalog(), scanned.code, scanned.gs1 ? 'barcode' : 'auto');
        // Start each scan with empty lot/expiry; never carry these from a previous package.
        fillEntry({ code: scanned.code, ...product, lot: scanned.lot, expiry: scanned.expiry });
        resetEdit();
        $('lookup').textContent = product
            ? 'Product found in your catalogue. Verify the lot, expiry and quantity against the package.'
            : 'Product not found, or the code has multiple matches. Enter the DIN or product name, then verify the lot and expiry.';
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
        $('lookup').textContent = 'Product found in your catalogue. Verify all details against the package.';
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
        if (!$('company').value.trim()) { status('Enter the company name first.', true); $('company').focus(); return; }
        try {
            const entry = D.validateEntry(readEntry()), next = copy(store), report = next.reports.find(item => item.id === next.activeId);
            report.company = $('company').value.trim();
            if (editing) {
                if (report.lines.some(line => line.id !== editing && D.lineKey(line) === D.lineKey(entry))) throw new Error('This product and lot already have a line. Edit that line or add a quantity using a new scan.');
                report.lines = report.lines.map(line => line.id === editing ? { ...entry, id: editing } : line);
            } else report.lines = D.addLine(report.lines, entry, uid());
            const wasEditing = !!editing;
            report.entry = {}; report.editingId = null; report.updatedAt = new Date().toISOString();
            if (commit(next)) { render(); status(wasEditing ? 'Line updated.' : 'Product saved to report.'); $('code').focus(); }
        } catch (error) { status(error.message, true); }
    });
    $('clear').addEventListener('click', () => {
        if (!editing && fields.some(field => !['unit'].includes(field) && $(field).value) && !confirm('Clear the current entry? Saved report lines will be kept.')) return;
        fillEntry(); resetEdit(); saveDraft(); $('code').focus();
    });
    $('new').addEventListener('click', () => {
        if (active() && !saveDraft()) return;
        const next = copy(store); newReport(next);
        if (commit(next)) { render(); status('New report created. Your earlier reports are kept.'); $('company').focus(); }
    });
    $('save').addEventListener('click', () => {
        if (!active()) { status('Create a report first.'); return; }
        if (saveDraft()) status('Draft saved on this device. You can add products later.');
    });
    $('delete').addEventListener('click', () => {
        const report = active();
        if (!report) return;
        const name = report.company || 'Untitled report';
        if (!confirm('Delete "' + name + '" and all of its saved product lines? This cannot be undone.')) return;
        const next = copy(store);
        next.reports = next.reports.filter(item => item.id !== report.id);
        next.activeId = next.reports[0]?.id || null;
        if (commit(next)) { render(); status('Report deleted.'); }
    });
    $('reports').addEventListener('change', () => {
        const selected = $('reports').value;
        if (!saveDraft()) { $('reports').value = store.activeId; return; }
        const next = copy(store); next.activeId = selected;
        if (commit(next)) { render(); status('Report opened.'); }
    });
    $('print').addEventListener('click', () => {
        if (!saveDraft()) return;
        if (!active()?.company || !active()?.lines.length) return;
        if (fields.some(field => field !== 'unit' && $(field).value) && !confirm('The current entry has not been added to the report. Print the saved lines only?')) return;
        window.print();
    });
    function stopCamera() { context?.stopScan?.(); }
    function startCamera() {
        if (!context?.scan) {
            status('Open Company Returns inside Expires Labo to use the shared camera scanner.', true);
            return;
        }
        const owner = context;
        context.scan(decoded => { if (context === owner) resolveCode(decoded); });
    }
    $('camera').addEventListener('click', startCamera);
    $('back').addEventListener('click', () => { if (!active() || saveDraft()) { const back = context.back; close(); back(); } });
    window.addEventListener('storage', event => {
        if (context && (event.key === key || event.key === null)) status('Reports changed in another tab. Reload this page before continuing.', true);
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopCamera(); });
    window.addEventListener('pagehide', stopCamera);
    function close() {
        stopCamera();
        context?.closeSuggestions?.();
        context = null; store = null; key = ''; raw = null; editing = null;
        root.hidden = true; document.body.classList.remove('cr-active');
        $('lines').replaceChildren(); $('reports').replaceChildren(); $('pharmacy').textContent = ''; fillEntry(); $('company').value = '';
    }
    function open(options) {
        close();
        context = options;
        key = 'pharmaops:company-returns:v1:' + options.pharmacyId;
        root.hidden = false; document.body.classList.add('cr-active');
        $('back').textContent = options.backLabel || '← PharmaOps';
        $('pharmacy').textContent = options.pharmacyName; $('workspace').hidden = true; status('');
        try {
            const saved = D.loadReports(localStorage, key); raw = saved.raw; store = saved.value;
            if (!active()) {
                const next = copy(store);
                if (next.reports.length) next.activeId = next.reports[0].id;
                else newReport(next);
                if (!commit(next)) return;
            }
            render(); $('workspace').hidden = false; $('company').focus();
        } catch (error) { status('Unable to open drafts: ' + error.message, true); }
    }
    window.CompanyReturns = { open, close, canLeave: () => !context || !active() || saveDraft() };
})();
