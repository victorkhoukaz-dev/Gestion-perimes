const fs = require('fs');

const emptyRawDataDef = `
  function getEmptyRawData() {
    return {
      totals: { "2022": 0, "2023": 0, "2024": 0, "2025": 0, "2026": 0 },
      years: [2022, 2023, 2024, 2025, 2026],
      manufacturers: [],
      monthly_2026: {}
    };
  }
`;

const syncScript = `
    <!-- Connecteur Supabase & Multi-Appareils Partitionné par Pharmacie (Loi 25 Canada) -->
    <script src="supabase.js"></script>
    <script>
      ${emptyRawDataDef}

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

            // Clé isolée par pharmacie dans le localStorage
            const storageKey = 'rawData_monthly_' + pharmacyId;
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
              console.warn('[Generics Supabase Sync] Erreur Sauvegarde Cloud:', error.message);
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

            const storageKey = 'rawData_monthly_' + pharmacyId;

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
              console.log('[Generics Sync] Données d\'achats chargées depuis Supabase pour la pharmacie:', pharmacyId);
            } else {
              // 2. Tenter le chargement depuis le cache local spécifique à cette pharmacie
              const cached = localStorage.getItem(storageKey);
              if (cached) {
                try {
                  rawData = JSON.parse(cached);
                  console.log('[Generics Sync] Données chargées depuis le cache local pour la pharmacie:', pharmacyId);
                } catch(e) {
                  rawData = getEmptyRawData();
                }
              } else {
                // 3. Aucun historique pour cette pharmacie -> Démarrage à 0,00$
                rawData = getEmptyRawData();
                console.log('[Generics Sync] Pharmacie vierge. Démarrage à l\'état initial $0,00 pour:', pharmacyId);
              }
            }

            if (typeof saveAndRefreshDashboard === 'function') saveAndRefreshDashboard();
            if (typeof window.saveAndRefreshMonthlyDashboard === 'function') window.saveAndRefreshMonthlyDashboard();
          } catch(err) {
            console.error('[Generics Supabase Sync] Erreur lors du chargement cloud:', err);
          }
        };

        window.addEventListener('DOMContentLoaded', () => {
          setTimeout(window.loadGenericsDataFromCloud, 200);
        });
      })();
    </script>
`;

['generics_monthly.html', 'generics_annual.html'].forEach(filename => {
  const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/' + filename;
  let html = fs.readFileSync(filePath, 'utf8');

  // Remplacer l'ancienne balise de synchro si présente
  const startTag = '<!-- Connecteur Supabase & Multi-Appareils';
  const startIdx = html.indexOf(startTag);
  if (startIdx !== -1) {
    const endIdx = html.indexOf('</script>', startIdx);
    html = html.substring(0, startIdx) + syncScript.trim() + html.substring(endIdx + 9);
  } else {
    html = html.replace('</head>', `${syncScript}\n</head>`);
  }

  // Également intercepter les sauvegardes directes dans le code d'origine
  html = html.replaceAll(
    "localStorage.setItem('rawData_monthly', JSON.stringify(rawData));",
    "if (typeof window.syncGenericsDataToCloud === 'function') window.syncGenericsDataToCloud(rawData);"
  );

  fs.writeFileSync(filePath, html);
  console.log(`Updated ${filename} with pharmacy-partitioned storage.`);
});
