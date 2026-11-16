const fs = require('fs');

const updatedSyncCode = `
    <!-- Connecteur Supabase & Multi-Appareils Partitionné par Pharmacie (Loi 25 Canada) -->
    <script src="supabase.js"></script>
    <script>
      function getPharmacyStorageKey() {
        const pId = localStorage.getItem('generics_pharmacy_id') || 'guest';
        return 'rawData_monthly_' + pId;
      }

      function getEmptyRawData() {
        return {
          totals: { "2022": 0, "2023": 0, "2024": 0, "2025": 0, "2026": 0 },
          years: [2022, 2023, 2024, 2025, 2026],
          manufacturers: [],
          monthly_2026: {}
        };
      }

      (function() {
        async function getPharmacyId(user) {
          if (!user) return null;
          try {
            const { data: profile } = await window.supabaseClient
              .from('profiles')
              .select('pharmacy_id')
              .eq('id', user.id)
              .maybeSingle();
            return profile?.pharmacy_id || user.id;
          } catch(e) {
            return user.id;
          }
        }

        window.syncGenericsDataToCloud = async function(dataObj) {
          try {
            if (!window.supabaseClient) return;
            const userRes = await window.supabaseClient.auth.getUser();
            const user = userRes?.data?.user;
            if (!user) return;

            const pharmacyId = await getPharmacyId(user);
            if (!pharmacyId) return;

            localStorage.setItem('generics_pharmacy_id', pharmacyId);
            const storageKey = getPharmacyStorageKey();
            localStorage.setItem(storageKey, JSON.stringify(dataObj));

            const payload = {
              pharmacy_id: pharmacyId,
              user_id: user.id,
              period_type: 'monthly',
              year: 2026,
              month: null,
              data: dataObj,
              updated_at: new Date().toISOString()
            };

            const { error } = await window.supabaseClient
              .from('generics_purchases')
              .upsert(payload, { onConflict: 'pharmacy_id,period_type,year' });

            if (error) {
              console.warn('[Generics Supabase Sync] Note Sauvegarde:', error.message);
            } else {
              console.log('[Generics Supabase Sync] Sauvegarde réussie sur le cloud Canada pour la pharmacie:', pharmacyId);
            }
          } catch(err) {
            console.error('[Generics Supabase Sync] Erreur de synchro:', err);
          }
        };

        window.loadGenericsDataFromCloud = async function() {
          try {
            if (!window.supabaseClient) return;
            const userRes = await window.supabaseClient.auth.getUser();
            const user = userRes?.data?.user;
            if (!user) return;

            const pharmacyId = await getPharmacyId(user);
            if (!pharmacyId) return;

            // Définir immédiatement la clé de la pharmacie active
            localStorage.setItem('generics_pharmacy_id', pharmacyId);
            const storageKey = getPharmacyStorageKey();

            // 1. Tenter le chargement depuis Supabase
            const { data, error } = await window.supabaseClient
              .from('generics_purchases')
              .select('data')
              .eq('pharmacy_id', pharmacyId)
              .eq('period_type', 'monthly')
              .order('updated_at', { ascending: false })
              .limit(1);

            if (!error && data && data.length > 0 && data[0].data && Object.keys(data[0].data).length > 0) {
              const cloudData = data[0].data;
              rawData = cloudData;
              localStorage.setItem(storageKey, JSON.stringify(cloudData));
              console.log('[Generics Sync] Données chargées depuis Supabase pour la pharmacie:', pharmacyId);
            } else {
              // 2. Tenter le chargement depuis le cache local spécifique à cette pharmacie
              const cached = localStorage.getItem(storageKey);
              if (cached) {
                try {
                  rawData = JSON.parse(cached);
                  console.log('[Generics Sync] Données chargées depuis le cache local pour la pharmacie:', pharmacyId);
                } catch(e) {
                  rawData = getEmptyRawData();
                  localStorage.removeItem(storageKey);
                }
              } else {
                // 3. Aucun historique pour cette pharmacie -> Démarrage à 0,00$
                rawData = getEmptyRawData();
                localStorage.removeItem(storageKey);
                console.log('[Generics Sync] Pharmacie vierge. Démarrage à l\'état initial 0,00$ pour:', pharmacyId);
              }
            }

            if (typeof saveAndRefreshDashboard === 'function') saveAndRefreshDashboard();
            if (typeof window.saveAndRefreshMonthlyDashboard === 'function') window.saveAndRefreshMonthlyDashboard();
          } catch(err) {
            console.error('[Generics Supabase Sync] Erreur lors du chargement cloud:', err);
          }
        };

        window.addEventListener('DOMContentLoaded', () => {
          setTimeout(window.loadGenericsDataFromCloud, 150);
        });
      })();
    </script>
`;

['generics_monthly.html', 'generics_annual.html'].forEach(filename => {
  const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/' + filename;
  let html = fs.readFileSync(filePath, 'utf8');

  const startTag = '<!-- Connecteur Supabase & Multi-Appareils';
  const startIdx = html.indexOf(startTag);
  if (startIdx !== -1) {
    const endIdx = html.indexOf('</script>', startIdx);
    html = html.substring(0, startIdx) + updatedSyncCode.trim() + html.substring(endIdx + 9);
  }

  fs.writeFileSync(filePath, html);
  console.log(`Cleanly updated sync script in ${filename}`);
});
