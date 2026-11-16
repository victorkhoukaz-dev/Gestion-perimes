// Shared by the monthly and annual dashboards. Never re-label loaded data
// with the identity of a subsequently signed-in user.
window.initializeGenericsSession = function ({ client, period, empty, read, replace, refresh }) {
    let context = null, userId = null, stopped = false, version = 0;
    let notice, saveNotice, reloadButton, backLink, skeleton, heading;
    const root = document.documentElement;
    const style = document.createElement('style');
    style.textContent = `
        [data-generics-locked] body > :not(#generics-session-notice) { display: none !important; }
        #generics-session-notice { min-height:100vh; box-sizing:border-box; padding:clamp(24px,5vw,64px);
            background:var(--bg-color,#f5f7fa); color:var(--text-color,#0f172a); font-family:Inter,system-ui,sans-serif; }
        #generics-session-notice[hidden], #generics-session-notice [hidden] { display:none !important; }
        #generics-session-notice > * { max-width:1100px; margin-left:auto; margin-right:auto; }
        #generics-session-notice .session-brand { color:var(--primary-color,#0f766e); font-size:13px;
            font-weight:700; letter-spacing:.14em; text-transform:uppercase; }
        #generics-session-notice h1 { font-size:clamp(26px,4vw,36px); letter-spacing:-.035em; margin-top:12px; margin-bottom:12px; }
        #generics-session-notice .session-message { color:var(--text-muted,#64748b); font-size:15px; line-height:1.6; margin-top:0; }
        #generics-session-notice .session-placeholder { background:var(--card-bg,#fff); border:1px solid var(--border-color,#e2e8f0);
            border-radius:18px; padding:24px; box-sizing:border-box; }
        #generics-session-notice .session-metrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:20px; margin:32px 0 20px; }
        #generics-session-notice .session-bar { height:12px; width:42%; background:var(--surface-muted,#e8eef2); border-radius:8px;
            animation:generics-loading 1.7s ease-in-out infinite; }
        #generics-session-notice .session-value { height:30px; width:64%; margin-top:24px; }
        #generics-session-notice .session-chart { height:240px; display:flex; align-items:flex-end; gap:5%; padding-top:48px; }
        #generics-session-notice .session-chart .session-bar { flex:1; height:50%; background:var(--primary-light,#e2f1ee); }
        #generics-session-notice .session-chart .session-bar:nth-child(2n) { height:78%; }
        #generics-session-notice .session-chart .session-bar:nth-child(3n) { height:62%; }
        #generics-session-notice button { padding:12px 18px; border:0; border-radius:10px; background:#0f766e; color:#fff; font:inherit; cursor:pointer; }
        #generics-session-notice a { color:var(--primary-color,#0f766e); margin-left:20px; }
        @keyframes generics-loading { 50% { opacity:.4; } }
        @media(prefers-reduced-motion:reduce) { #generics-session-notice .session-bar { animation:none; } }
        @media(max-width:600px) { #generics-session-notice .session-metrics { gap:10px; } #generics-session-notice .session-placeholder { padding:16px; } }
    `;
    document.head.append(style);
    function mask(message = 'Vérification de votre session…') {
        root.setAttribute('data-generics-locked', '');
        if (!document.body) return;
        if (!notice) {
            notice = document.createElement('section');
            notice.id = 'generics-session-notice';
            notice.setAttribute('role', 'status');
            notice.setAttribute('aria-live', 'polite');
            const text = document.createElement('p');
            text.className = 'session-message';
            const brand = document.createElement('div');
            brand.className = 'session-brand';
            brand.textContent = 'PharmaOps';
            heading = document.createElement('h1');
            reloadButton = document.createElement('button');
            reloadButton.textContent = 'Recharger la page';
            reloadButton.addEventListener('click', () => window.location.reload());
            backLink = document.createElement('a');
            backLink.href = 'index.html';
            backLink.textContent = 'Retour à PharmaOps';
            skeleton = document.createElement('div');
            skeleton.setAttribute('aria-hidden', 'true');
            const metrics = document.createElement('div');
            metrics.className = 'session-metrics';
            for (let i = 0; i < 3; i++) {
                const card = document.createElement('div');
                card.className = 'session-placeholder';
                for (const className of ['session-bar', 'session-bar session-value']) {
                    const bar = document.createElement('div'); bar.className = className; card.append(bar);
                }
                metrics.append(card);
            }
            const chart = document.createElement('div');
            chart.className = 'session-placeholder session-chart';
            for (let i = 0; i < 9; i++) {
                const bar = document.createElement('div'); bar.className = 'session-bar'; chart.append(bar);
            }
            skeleton.append(metrics, chart);
            // Keep the live message first in the DOM, with the title above it visually.
            notice.append(text, brand, heading, skeleton, reloadButton, backLink);
            notice.style.display = 'flex';
            notice.style.flexDirection = 'column';
            brand.style.order = '-2'; heading.style.order = '-1';
            for (const child of [text, brand, heading, skeleton]) child.style.width = '100%';
            document.body.append(notice);
        }
        notice.firstChild.textContent = message;
        heading.textContent = stopped ? 'Vérification de la session requise' : 'Analyse des génériques';
        skeleton.hidden = stopped;
        reloadButton.hidden = !stopped;
        backLink.hidden = !stopped;
        notice.hidden = false;
    }
    function stop(message = 'Votre session a changé. Rechargez cette page avant de consulter ou d’enregistrer les achats.') {
        stopped = true;
        version++;
        context = null;
        mask(message);
        // This can run before the dashboard's lexical rawData is initialized.
        try { replace(empty()); } catch (_) { /* No purchases have loaded yet. */ }
        for (const id of ['generics-user-email', 'generics-pharmacy-name']) {
            const node = document.getElementById(id);
            if (node) node.textContent = '';
        }
        return false;
    }
    function current(ticket) { return !stopped && ticket === version; }
    async function identity(ticket) {
        const { data: auth, error } = await client.auth.getUser();
        if (!current(ticket)) return null;
        if (error || !auth?.user) { stop('Votre session n’a pas pu être vérifiée. Connectez-vous à PharmaOps et rechargez cette page.'); return null; }
        if (userId && userId !== auth.user.id) { stop(); return null; }
        userId = auth.user.id;
        const { data: profile, error: profileError } = await client.from('profiles')
            .select('pharmacy_id').eq('id', userId).maybeSingle();
        if (!current(ticket)) return null;
        if (profileError || !profile?.pharmacy_id) { stop('Votre pharmacie n’a pas pu être vérifiée. Rechargez cette page avant de continuer.'); return null; }
        if (context && (context.userId !== userId || context.pharmacyId !== profile.pharmacy_id)) { stop(); return null; }
        return { userId, pharmacyId: profile.pharmacy_id, email: auth.user.email || '' };
    }
    // Keep the callback synchronous: no Supabase calls inside its auth lock.
    client?.auth.onAuthStateChange((event, session) => {
        if (stopped) return;
        if (event === 'SIGNED_OUT' || event === 'USER_UPDATED' ||
            (userId && session?.user?.id !== userId)) stop();
        else if (session?.user) userId = session.user.id;
    });
    mask();
    window.addEventListener('DOMContentLoaded', () => {
        mask();
        load();
    });
    async function load() {
        if (stopped) return false;
        const ticket = ++version;
        context = null;
        mask('Chargement des achats de votre pharmacie…');
        replace(empty());
        try {
            if (!client) return stop('La connexion n’a pas pu être établie. Rechargez cette page pour réessayer.');
            const owner = await identity(ticket);
            if (!owner) return false;
            context = owner;
            // Purchases and the display name are independent once membership is verified.
            const [{ data, error }, { data: pharmacy, error: pharmacyError }] = await Promise.all([
                client.from('generics_purchases').select('data')
                .eq('pharmacy_id', owner.pharmacyId).eq('period_type', period).eq('year', 2026)
                .order('updated_at', { ascending: false }).limit(1),
                client.from('pharmacies').select('name').eq('id', owner.pharmacyId).maybeSingle()
            ]);
            if (!current(ticket)) return false;
            if (error) throw error;
            if (pharmacyError) throw pharmacyError;
            if (!await identity(ticket) || !current(ticket)) return false;
            replace(data?.[0]?.data && Object.keys(data[0].data).length ? data[0].data : empty());
            refresh();
            document.getElementById('generics-user-email').textContent = owner.email;
            document.getElementById('generics-pharmacy-name').textContent = pharmacy?.name || '';
            context = Object.freeze(owner);
            if (notice) notice.hidden = true;
            root.removeAttribute('data-generics-locked');
            return true;
        } catch (error) {
            if (current(ticket)) stop('Les achats n’ont pas pu être chargés de façon sécuritaire. Rechargez cette page pour réessayer.');
            return false;
        }
    }
    async function save(data) {
        if (stopped || !context || root.hasAttribute('data-generics-locked')) return false;
        const owner = context, ticket = version;
        // Capture before awaiting: an import may still be mutating rawData.
        const snapshot = JSON.parse(JSON.stringify(data));
        let verified = false;
        try {
            if (!await identity(ticket) || !current(ticket) || context !== owner) return false;
            verified = true;
            const { error } = await client.from('generics_purchases').upsert({
                pharmacy_id: owner.pharmacyId, user_id: owner.userId,
                period_type: period, year: 2026, month: null,
                data: snapshot, updated_at: new Date().toISOString()
            }, { onConflict: 'pharmacy_id,period_type,year' });
            if (!current(ticket)) return false;
            if (error) throw error;
            if (saveNotice) saveNotice.hidden = true;
            return true;
        } catch (error) {
            if (current(ticket)) {
                if (!verified) stop('Votre session n’a pas pu être vérifiée. Rechargez cette page avant de continuer.');
                else {
                    // A network failure must not discard an unsaved import.
                    if (!saveNotice) {
                        saveNotice = document.createElement('section');
                        saveNotice.id = 'generics-save-warning';
                        saveNotice.setAttribute('role', 'alert');
                        saveNotice.style.cssText = 'padding:16px;background:#fff3cd;color:#533f03';
                        const message = document.createElement('p');
                        message.textContent = 'Les achats n’ont pas pu être enregistrés. Vos modifications restent dans cet onglet. Réessayez de les enregistrer avant de le fermer ou de le recharger.';
                        const retry = document.createElement('button');
                        retry.textContent = 'Réessayer l’enregistrement';
                        retry.addEventListener('click', () => save(read()));
                        saveNotice.append(message, retry);
                        document.body.prepend(saveNotice);
                    }
                    saveNotice.hidden = false;
                }
            }
            return false;
        }
    }
    // Hide the page before it enters browser history's back/forward cache.
    window.addEventListener('pagehide', () => mask());
    window.addEventListener('pageshow', event => { if (event.persisted) stop(); });
    // Routine tab/app switching keeps the dashboard intact. Actual auth events
    // invalidate it above; saves independently verify the loaded owner.
    return { load, save, stop };
};
