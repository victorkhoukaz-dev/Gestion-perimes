/* Cloud collection with optimistic concurrency and a device recovery copy. */
(() => {
    const userError = window.CompanyReturnsData.userError;
    const clone = value => JSON.parse(JSON.stringify(value));
    const empty = () => ({ version: 1, activeId: null, reports: [], importedLocal: [] });
    function validate(value) {
        return window.CompanyReturnsData.loadReports({ getItem: () => JSON.stringify(value) }, '').value;
    }
    function create(client, pharmacyId, userId, storage) {
        const key = 'pharmaops:returns-recovery:v1:' + pharmacyId + ':' + userId;
        let revision = 0, raw = storage.getItem(key), recovery = raw ? JSON.parse(raw) : null, conflict = false, busy = false;
        if (recovery) validate(recovery.data);
        const persist = value => {
            if (storage.getItem(key) !== raw) throw userError('La copie de récupération a été modifiée dans un autre onglet. Rouvrez Retours fabricants avant de continuer.');
            const next = JSON.stringify(value);
            storage.setItem(key, next); raw = next; recovery = clone(value);
        };
        const query = () => client.from('company_return_documents');
        async function load(useOnline = false) {
            const { data, error } = await query().select('data,revision').eq('pharmacy_id', pharmacyId).maybeSingle();
            if (error) throw error;
            const online = validate(data?.data || empty());
            revision = data?.revision || 0;
            conflict = !!recovery?.dirty && recovery.revision !== revision;
            if (useOnline && recovery?.dirty) {
                storage.setItem(key + ':archive:' + crypto.randomUUID(), JSON.stringify(recovery));
            } else if (recovery?.dirty) {
                return { value: clone(recovery.data), dirty: true, conflict };
            }
            conflict = false;
            persist({ revision, dirty: false, data: online });
            return { value: clone(online), dirty: false, conflict: false };
        }
        function stage(value) { validate(value); persist({ revision: conflict ? recovery.revision : revision, dirty: true, data: value }); }
        async function save(value) {
            if (busy) throw userError('Un enregistrement est déjà en cours.');
            if (conflict) throw userError('Une version plus récente a été enregistrée sur un autre appareil. Rouvrez Retours fabricants pour charger les derniers rapports en ligne. Votre copie de récupération est conservée.');
            busy = true;
            try {
                const snapshot = clone(validate(value)), expected = revision;
                const payload = { pharmacy_id: pharmacyId, data: snapshot, revision: expected + 1 };
                const request = expected === 0 ? query().insert(payload) : query().update(payload).eq('pharmacy_id', pharmacyId).eq('revision', expected);
                const { data, error } = await request.select('revision').maybeSingle();
                if (error || !data) {
                    if (!error || error.code === '23505') conflict = true;
                    throw error || userError('Les rapports ont été modifiés sur un autre appareil. Rouvrez Retours fabricants avant d’enregistrer.');
                }
                revision = data.revision;
                const latest = recovery?.data || snapshot;
                const dirty = JSON.stringify(latest) !== JSON.stringify(snapshot);
                persist({ revision, dirty, data: latest });
                return { dirty };
            } finally { busy = false; }
        }
        return { load, stage, save, recoveryKey: key, isDirty: () => !!recovery?.dirty };
    }
    const api = { create, validate };
    if (typeof window !== 'undefined') window.CompanyReturnsCloud = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
