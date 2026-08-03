const fs = require('fs');

function processFile(filename, periodType) {
  const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/' + filename;
  let html = fs.readFileSync(filePath, 'utf8');

  // 1. Enlever tous les anciens blocs Connecteur Supabase
  html = html.replace(/<!-- Connecteur Supabase[\s\S]*?<\/script>\s*/gi, '');

  // 2. Désactiver / neutraliser le chargement direct localStorage d'origine qui court-circuitait la synchro
  html = html.replace(
    /const savedData = localStorage\.getItem\(['"](rawData_monthly|rawData_annual)['"]\);[\s\S]*?console\.log\("Données chargées depuis le localStorage\."\);[\s\S]*?\}/g,
    '// [REMPLACÉ] Le chargement localStorage est désormais géré par loadGenericsDataFromCloud pour garantir l\'isolation par pharmacie.'
  );

  html = html.replace(
    /const savedData = localStorage\.getItem\(getPharmacyStorageKey\(\)\);[\s\S]*?console\.log\("Données chargées depuis le localStorage\."\);[\s\S]*?\}/g,
    '// [REMPLACÉ] Le chargement localStorage est désormais géré par loadGenericsDataFromCloud pour garantir l\'isolation par pharmacie.'
  );

  // 3. Définir le script de synchronisation unique et étanche
  const storageKeyPrefix = periodType === 'monthly' ? 'rawData_monthly_' : 'rawData_annual_';
  
  const cleanSyncScript = `<!-- Connecteur Supabase & Isolation Multi-Pharmacie (Loi 25 Canada) -->
<script src="supabase.js"></script>
<script>
  let _currentPharmacyId = null;

  function getPharmacyStorageKey() {
    return '${storageKeyPrefix}' + (_currentPharmacyId || 'guest');
  }

  function getEmptyRawData() {
    return {
      totals: {},
      years: [],
      manufacturers: [],
      monthly_2026: {}
    };
  }

  (function() {
    async function fetchPharmacyId() {
      if (!window.supabaseClient) return null;
      try {
        const userRes = await window.supabaseClient.auth.getUser();
        const user = userRes?.data?.user;
        if (!user) return null;
        const { data: profile } = await window.supabaseClient
          .from('profiles')
          .select('pharmacy_id')
          .eq('id', user.id)
          .maybeSingle();
        return profile?.pharmacy_id || user.id;
      } catch(e) {
        return null;
      }
    }

    window.syncGenericsDataToCloud = async function(dataObj) {
      try {
        if (!window.supabaseClient || !_currentPharmacyId) return;
        const userRes = await window.supabaseClient.auth.getUser();
        const user = userRes?.data?.user;
        if (!user) return;

        localStorage.setItem(getPharmacyStorageKey(), JSON.stringify(dataObj));

        const { error } = await window.supabaseClient
          .from('generics_purchases')
          .upsert({
            pharmacy_id: _currentPharmacyId,
            user_id: user.id,
            period_type: '${periodType}',
            year: 2026,
            month: null,
            data: dataObj,
            updated_at: new Date().toISOString()
          }, { onConflict: 'pharmacy_id,period_type,year' });

        if (error) {
          console.warn('[Sync ${periodType}] Sauvegarde cloud:', error.message);
        } else {
          console.log('[Sync ${periodType}] Sauvegarde cloud réussie pour pharmacie:', _currentPharmacyId);
        }
      } catch(err) {
        console.error('[Sync ${periodType}] Erreur:', err);
      }
    };

    window.loadGenericsDataFromCloud = async function() {
      try {
        const pharmacyId = await fetchPharmacyId();
        if (!pharmacyId) {
          console.log('[Sync ${periodType}] Aucune session active. Initialisation à l\\'état vierge.');
          rawData = getEmptyRawData();
          if (typeof saveAndRefreshDashboard === 'function') saveAndRefreshDashboard();
          return;
        }

        _currentPharmacyId = pharmacyId;
        const storageKey = getPharmacyStorageKey();

        // 1. Tenter la lecture Supabase Cloud
        const { data, error } = await window.supabaseClient
          .from('generics_purchases')
          .select('data')
          .eq('pharmacy_id', pharmacyId)
          .eq('period_type', '${periodType}')
          .order('updated_at', { ascending: false })
          .limit(1);

        if (!error && data && data.length > 0 && data[0].data && Object.keys(data[0].data).length > 0) {
          rawData = data[0].data;
          localStorage.setItem(storageKey, JSON.stringify(rawData));
          console.log('[Sync ${periodType}] Données cloud chargées pour pharmacie:', pharmacyId);
        } else {
          // 2. Tenter la lecture du cache local isolé
          const cached = localStorage.getItem(storageKey);
          if (cached) {
            try {
              rawData = JSON.parse(cached);
              console.log('[Sync ${periodType}] Données cache local chargées pour pharmacie:', pharmacyId);
            } catch(e) {
              rawData = getEmptyRawData();
            }
          } else {
            // 3. Aucun enregistrement -> État vierge 0,00$
            rawData = getEmptyRawData();
            console.log('[Sync ${periodType}] Pharmacie neuve sans historique. Démarrage à 0,00$ pour:', pharmacyId);
          }
        }

        if (typeof saveAndRefreshDashboard === 'function') saveAndRefreshDashboard();
      } catch(err) {
        console.error('[Sync ${periodType}] Erreur chargement:', err);
      }
    };

    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(window.loadGenericsDataFromCloud, 100);
    });
  })();
</script>`;

  // 4. Injecter le bloc juste avant <!-- Data Injection -->
  if (html.includes('<!-- Data Injection -->')) {
    html = html.replace('<!-- Data Injection -->', `${cleanSyncScript}\n\n    <!-- Data Injection -->`);
  } else {
    html = html.replace('</head>', `${cleanSyncScript}\n</head>`);
  }

  fs.writeFileSync(filePath, html);
  console.log(`Successfully cleaned and injected single sync block into ${filename}`);
}

processFile('generics_monthly.html', 'monthly');
processFile('generics_annual.html', 'annual');
