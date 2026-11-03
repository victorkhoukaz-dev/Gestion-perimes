(() => {
    const M = window.GenericsMoleculeData;
    const $ = id => document.getElementById(id);
    const money = value => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(value / 100);
    const client = window.supabase && window.GENERICS_CONNECTION
        ? window.supabase.createClient(window.GENERICS_CONNECTION.url, window.GENERICS_CONNECTION.key)
        : null;
    let currentData = null, currentContext = null, saving = false;
    let loadVersion = 0;
    function setSaving(value) {
        saving = value;
        document.querySelectorAll('#workspace button, #workspace select').forEach(control => { control.disabled = value; });
    }
    function element(tag, text, className) {
        const node = document.createElement(tag);
        node.textContent = text;
        if (className) node.className = className;
        return node;
    }
    function candidateItem(item) {
        const node = element('article', '', 'candidate-item');
        node.append(element('strong', item.name));
        const manufacturers = item.manufacturers.length === 1 ? item.manufacturers[0] : `${item.manufacturers.length} manufacturers`;
        node.append(element('span', `${money(item.total)} · ${manufacturers}`));
        return node;
    }
    async function saveDecision(candidate, choice, status, button) {
        if (!currentData || !currentContext || saving) return;
        const context = currentContext;
        const [action, index] = choice.split(':');
        const nextData = JSON.parse(JSON.stringify(currentData));
        const decisions = nextData.moleculeNameReview?.decisions || {};
        if (action === 'unresolved') delete decisions[candidate.decisionKey];
        else {
            decisions[candidate.decisionKey] = {
                status: action,
                names: candidate.items.map(item => item.name),
                canonicalName: action === 'group' ? candidate.items[Number(index)].name : null,
                decidedAt: new Date().toISOString()
            };
        }
        nextData.moleculeNameReview = { version: 1, decisions };
        setSaving(true);
        status.textContent = 'Saving…';
        try {
            const payload = {
                user_id: context.userId,
                data: nextData,
                updated_at: new Date().toISOString()
            };
            // Only update the version loaded by this page. A newer import or decision must not be overwritten.
            const { data: saved, error } = await client.from('generics_purchases').update(payload)
                .eq('pharmacy_id', context.pharmacyId).eq('period_type', 'monthly').eq('year', M.YEAR)
                .eq('updated_at', context.updatedAt).select('data,updated_at').maybeSingle();
            if (error) throw new Error(error.message);
            if (!saved) throw new Error('The purchases changed or are no longer accessible. Reload this page before trying again.');
            if (currentContext !== context) return;
            currentData = saved.data;
            context.updatedAt = saved.updated_at;
            render(currentData);
        } catch (error) {
            if (currentContext === context) status.textContent = `Decision not saved: ${error.message}`;
        } finally {
            setSaving(false);
        }
    }
    function decisionControls(candidate) {
        const controls = element('div', '', 'decision-controls');
        const label = element('label', 'Decision');
        const select = document.createElement('select');
        const decision = currentData?.moleculeNameReview?.decisions?.[candidate.decisionKey];
        select.add(new Option('To review — no saved decision', 'unresolved'));
        select.add(new Option('Keep these names separate', 'keep'));
        candidate.items.forEach((item, index) => select.add(new Option(`Group under “${item.name}”`, `group:${index}`)));
        if (decision?.status === 'keep') select.value = 'keep';
        if (decision?.status === 'group') {
            const index = candidate.items.findIndex(item => item.name === decision.canonicalName);
            select.value = index >= 0 ? `group:${index}` : 'unresolved';
        }
        label.append(select);
        const button = element('button', 'Save decision');
        button.type = 'button';
        const status = element('p', '', `decision-status${decision?.status === 'group' ? ' group' : decision?.status === 'keep' ? ' keep' : ''}`);
        status.textContent = decision?.status === 'group'
            ? `Grouped under “${decision.canonicalName}”. Source names are preserved.`
            : decision?.status === 'keep'
                ? 'Kept separate: this suggestion has been reviewed.'
                : 'No changes are applied until you save a decision.';
        button.addEventListener('click', () => saveDecision(candidate, select.value, status, button));
        controls.append(label, button, status);
        return controls;
    }
    function renderCandidates(containerId, candidates, type) {
        const container = $(containerId);
        container.replaceChildren();
        if (!candidates.length) {
            container.append(element('p', type === 'formatting'
                ? 'No formatting variations were found in the imported names.'
                : 'No similar names were found using this review’s conservative criteria.', 'review-empty'));
            return;
        }
        candidates.forEach(candidate => {
            const card = element('article', '', 'candidate-card');
            const label = type === 'formatting'
                ? 'Formatting variations to review'
                : `Similar names to verify · ${candidate.distance} character${candidate.distance > 1 ? 's' : ''} different`;
            card.append(element('h3', label));
            const items = element('div', '', 'candidate-items');
            candidate.items.forEach(item => items.append(candidateItem(item)));
            card.append(items, decisionControls(candidate));
            container.append(card);
        });
    }
    function render(data) {
        const review = M.findNameReviewCandidates(data);
        const summary = $('review-summary');
        summary.replaceChildren();
        [[review.sourceNameCount, 'distinct source names'], [review.formatting.length, 'formatting variations'], [review.near.length, 'similar names to verify']].forEach(([count, label]) => {
            const stat = element('div', '', 'review-stat');
            stat.append(element('strong', String(count)), element('span', label));
            summary.append(stat);
        });
        renderCandidates('formatting-candidates', review.formatting, 'formatting');
        renderCandidates('near-candidates', review.near, 'near');
    }
    async function load() {
        const version = ++loadVersion;
        currentData = null;
        currentContext = null;
        $('workspace').hidden = true;
        $('load-status').hidden = false;
        $('load-status').textContent = 'Loading your pharmacy’s purchases…';
        $('retry-load').hidden = true;
        try {
            if (!client) throw new Error('Unable to connect. Check your connection and try again.');
            const { data: auth, error: authError } = await client.auth.getUser();
            if (version !== loadVersion) return;
            if (authError || !auth.user) {
                $('load-status').textContent = 'Your session expired. Sign in to PharmaOps to review purchases.';
                return;
            }
            const { data: profile, error: profileError } = await client.from('profiles').select('pharmacy_id').eq('id', auth.user.id).maybeSingle();
            if (version !== loadVersion) return;
            if (profileError || !profile?.pharmacy_id) throw new Error('Unable to identify your pharmacy. Check your PharmaOps account.');
            const { data: records, error } = await client.from('generics_purchases').select('data,updated_at')
                .eq('pharmacy_id', profile.pharmacy_id).eq('period_type', 'monthly').eq('year', M.YEAR)
                .order('updated_at', { ascending: false }).limit(1);
            if (version !== loadVersion) return;
            if (error) throw new Error('Unable to load purchases. Check your connection and try again.');
            const data = records?.[0]?.data || { manufacturers: [] };
            if (!Array.isArray(data.manufacturers)) throw new Error('The saved purchases are not in the expected format.');
            currentData = data;
            currentContext = { pharmacyId: profile.pharmacy_id, userId: auth.user.id, updatedAt: records?.[0]?.updated_at };
            render(data);
            $('workspace').hidden = false;
            $('load-status').hidden = true;
            const { data: pharmacy } = await client.from('pharmacies').select('name').eq('id', profile.pharmacy_id).maybeSingle();
            if (version !== loadVersion) return;
            $('pharmacy-name').textContent = pharmacy?.name || '';
        } catch (error) {
            if (version !== loadVersion) return;
            currentData = null;
            currentContext = null;
            $('workspace').hidden = true;
            $('load-status').hidden = false;
            $('load-status').textContent = error.message;
            $('retry-load').hidden = false;
        }
    }
    $('retry-load').addEventListener('click', load);
    client?.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || event === 'USER_UPDATED' ||
            (currentContext && session?.user?.id !== currentContext.userId)) {
            loadVersion++;
            currentData = null;
            currentContext = null;
            $('workspace').hidden = true;
            $('formatting-candidates').replaceChildren();
            $('near-candidates').replaceChildren();
            $('pharmacy-name').textContent = '';
            $('load-status').hidden = false;
            $('load-status').textContent = 'Your session changed. Reload this page to review purchases.';
        }
    });
    load();
})();
