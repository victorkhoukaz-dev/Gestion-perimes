(() => {
    const M = window.GenericsMoleculeData;
    const $ = id => document.getElementById(id);
    const money = value => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(value / 100);
    const client = window.supabase && window.GENERICS_CONNECTION
        ? window.supabase.createClient(window.GENERICS_CONNECTION.url, window.GENERICS_CONNECTION.key)
        : null;
    let currentData = null, currentContext = null, saving = false;
    let loadVersion = 0, sessionUserId = null, sessionStopped = false;
    function setSaving(value) {
        saving = value;
        $('show-reviewed').disabled = value;
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
        const manufacturers = item.manufacturers.length === 1 ? item.manufacturers[0] : `${item.manufacturers.length} fabricants`;
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
        $('save-feedback').textContent = '';
        setSaving(true);
        status.textContent = 'Enregistrement…';
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
            if (error) throw new Error("L’enregistrement a échoué. Vérifiez votre connexion et réessayez.");
            if (!saved) throw new Error('Les achats ont changé ou ne sont plus accessibles. Rechargez cette page avant de réessayer.');
            if (currentContext !== context) return;
            currentData = saved.data;
            context.updatedAt = saved.updated_at;
            render(currentData);
            $('save-feedback').textContent = action === 'unresolved'
                ? 'Décision annulée. Cet élément est de nouveau à réviser.'
                : 'Décision enregistrée.';
        } catch (error) {
            if (currentContext === context) status.textContent = `Décision non enregistrée : ${error.message}`;
        } finally {
            setSaving(false);
        }
    }
    function decisionControls(candidate) {
        const controls = element('div', '', 'decision-controls');
        const label = element('label', 'Décision');
        const select = document.createElement('select');
        const decision = currentData?.moleculeNameReview?.decisions?.[candidate.decisionKey];
        select.add(new Option('À réviser — aucune décision enregistrée', 'unresolved'));
        select.add(new Option('Conserver ces noms séparément', 'keep'));
        candidate.items.forEach((item, index) => select.add(new Option(`Regrouper sous « ${item.name} »`, `group:${index}`)));
        if (decision?.status === 'keep') select.value = 'keep';
        if (decision?.status === 'group') {
            const index = candidate.items.findIndex(item => item.name === decision.canonicalName);
            select.value = index >= 0 ? `group:${index}` : 'unresolved';
        }
        label.append(select);
        const button = element('button', 'Enregistrer la décision');
        button.type = 'button';
        const status = element('p', '', `decision-status${decision?.status === 'group' ? ' group' : decision?.status === 'keep' ? ' keep' : ''}`);
        status.textContent = decision?.status === 'group'
            ? `Regroupés sous « ${decision.canonicalName} ». Les noms sources sont conservés.`
            : decision?.status === 'keep'
                ? 'Noms conservés séparément : cette suggestion a été révisée.'
                : 'Aucune modification n’est appliquée avant l’enregistrement de votre décision.';
        button.addEventListener('click', () => saveDecision(candidate, select.value, status, button));
        controls.append(label, button, status);
        return controls;
    }
    function renderCandidates(containerId, candidates, type) {
        const container = $(containerId);
        container.replaceChildren();
        const visible = $('show-reviewed').checked ? candidates : candidates.filter(candidate => !isReviewed(candidate));
        if (!visible.length) {
            container.append(element('p', candidates.length
                ? 'Tous les éléments de cette section ont été révisés. Cochez « Afficher les éléments révisés » pour consulter ou modifier vos décisions.'
                : type === 'formatting'
                ? 'Aucune variation de mise en forme n’a été trouvée dans les noms importés.'
                : 'Aucun nom semblable n’a été trouvé selon les critères prudents de cette révision.', 'review-empty'));
            return;
        }
        visible.forEach(candidate => {
            const card = element('article', '', 'candidate-card');
            const label = type === 'formatting'
                ? 'Variations de mise en forme à réviser'
                : `Noms semblables à vérifier · ${candidate.distance} caractère${candidate.distance > 1 ? 's' : ''} de différence`;
            card.append(element('h3', label));
            const items = element('div', '', 'candidate-items');
            candidate.items.forEach(item => items.append(candidateItem(item)));
            card.append(items, decisionControls(candidate));
            container.append(card);
        });
    }
    function isReviewed(candidate) {
        const decision = currentData?.moleculeNameReview?.decisions?.[candidate.decisionKey];
        return decision?.status === 'keep' || decision?.status === 'group';
    }
    function render(data) {
        const review = M.findNameReviewCandidates(data);
        const candidates = [...review.formatting, ...review.near];
        const reviewed = candidates.filter(isReviewed).length;
        const summary = $('review-summary');
        summary.replaceChildren();
        [[review.sourceNameCount, 'noms sources distincts'], [candidates.length - reviewed, 'éléments à réviser'], [reviewed, 'éléments déjà révisés']].forEach(([count, label]) => {
            const stat = element('div', '', 'review-stat');
            stat.append(element('strong', String(count)), element('span', label));
            summary.append(stat);
        });
        renderCandidates('formatting-candidates', review.formatting, 'formatting');
        renderCandidates('near-candidates', review.near, 'near');
    }
    async function load() {
        if (sessionStopped) return;
        const version = ++loadVersion;
        currentData = null;
        currentContext = null;
        $('save-feedback').textContent = '';
        $('workspace').hidden = true;
        $('load-status').hidden = false;
        $('load-status').textContent = 'Chargement des achats de votre pharmacie…';
        $('retry-load').hidden = true;
        try {
            if (!client) throw new Error('La connexion n’a pas pu être établie. Vérifiez votre connexion et réessayez.');
            const { data: auth, error: authError } = await client.auth.getUser();
            if (version !== loadVersion) return;
            if (sessionUserId && sessionUserId !== auth?.user?.id) { invalidateSession(); return; }
            sessionUserId = auth?.user?.id || null;
            if (authError || !auth.user) {
                $('load-status').textContent = 'Votre session a expiré. Connectez-vous à PharmaOps pour réviser les achats.';
                return;
            }
            const { data: profile, error: profileError } = await client.from('profiles').select('pharmacy_id').eq('id', auth.user.id).maybeSingle();
            if (version !== loadVersion) return;
            if (profileError || !profile?.pharmacy_id) throw new Error('Votre pharmacie n’a pas pu être identifiée. Vérifiez votre compte PharmaOps.');
            const { data: records, error } = await client.from('generics_purchases').select('data,updated_at')
                .eq('pharmacy_id', profile.pharmacy_id).eq('period_type', 'monthly').eq('year', M.YEAR)
                .order('updated_at', { ascending: false }).limit(1);
            if (version !== loadVersion) return;
            if (error) throw new Error('Les achats n’ont pas pu être chargés. Vérifiez votre connexion et réessayez.');
            const data = records?.[0]?.data || { manufacturers: [] };
            if (!Array.isArray(data.manufacturers)) throw new Error('Les achats enregistrés ne sont pas dans le format attendu.');
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
    $('show-reviewed').addEventListener('change', () => {
        if (currentData) render(currentData);
    });
    function invalidateSession() {
        sessionStopped = true; loadVersion++;
        currentData = null;
        currentContext = null;
        $('workspace').hidden = true;
        $('formatting-candidates').replaceChildren();
        $('near-candidates').replaceChildren();
        $('pharmacy-name').textContent = '';
        $('save-feedback').textContent = '';
        $('retry-load').hidden = true;
        $('load-status').hidden = false;
        $('load-status').textContent = 'Votre session a changé. Rechargez cette page pour réviser les achats.';
    }
    client?.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || event === 'USER_UPDATED' ||
            (sessionUserId && session?.user?.id !== sessionUserId)) invalidateSession();
        else if (session?.user) sessionUserId = session.user.id;
    });
    load();
})();
