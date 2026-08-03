const fs = require('fs');

const originalPath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Generiques/Tableau_de_bord_Mensuel_2026.html';
let content = fs.readFileSync(originalPath, 'utf8');

// 1. Mettre à jour les liens vers le fichier annuel si cliqué
content = content.replaceAll('Tableau_de_bord_Achats%20(annuel).html', 'generics_annual.html');
content = content.replaceAll('Tableau_de_bord_Achats (annuel).html', 'generics_annual.html');

// 2. Remplacer les accès direct localStorage.getItem/setItem par getPharmacyStorageKey()
content = content.replaceAll("localStorage.getItem('rawData_monthly')", "localStorage.getItem(getPharmacyStorageKey())");
content = content.replaceAll("localStorage.setItem('rawData_monthly', JSON.stringify(rawData))", "localStorage.setItem(getPharmacyStorageKey(), JSON.stringify(rawData))");

// 3. Remplacer la définition harcodée de rawData par getEmptyRawData()
const rawDataIdx = content.indexOf('let rawData = {');
if (rawDataIdx !== -1) {
  const rawDataEnd = content.indexOf('};', rawDataIdx);
  if (rawDataEnd !== -1) {
    content = content.substring(0, rawDataIdx) + 'let rawData = getEmptyRawData();' + content.substring(rawDataEnd + 2);
  }
}

// 4. Désactiver la relecture synchrone d'origine du localStorage dans le Data Manager
content = content.replace(
  /const savedData = localStorage\.getItem\(['"]rawData_monthly['"]\);[\s\S]*?console\.log\("Données chargées depuis le localStorage\."\);[\s\S]*?\}/,
  '// [DÉSACTIVÉ] Géré par loadGenericsDataFromCloud'
);

// 5. Remplacer TOUTE la fonction saveAndRefreshDashboard d'origine jusqu'à sa fermeture
const saveFnIdx = content.indexOf('function saveAndRefreshDashboard() {');
if (saveFnIdx !== -1) {
  const nextFnIdx = content.indexOf('function closeModal() {', saveFnIdx);
  if (nextFnIdx !== -1) {
    const cleanSaveFn = `function refreshDashboardUI() {
            try {
                if (typeof updateMonthsCount === 'function') updateMonthsCount();
                if (typeof initKpis === 'function') initKpis();
            } catch(e) { console.warn('Refresh UI note:', e); }
        }

        function saveAndRefreshDashboard() {
            if (typeof window.syncGenericsDataToCloud === 'function') window.syncGenericsDataToCloud(rawData);
            refreshDashboardUI();
        }\n\n        `;
    content = content.substring(0, saveFnIdx) + cleanSaveFn + content.substring(nextFnIdx);
  }
}

// 6. Injecter le script Supabase propre dans le head
const syncScript = `<script src="supabase.js"></script>
<script>
  window.getEmptyRawData = function() {
    return {
      totals: { "2022": 0, "2023": 0, "2024": 0, "2025": 0, "2026": 0 },
      years: [2022, 2023, 2024, 2025, 2026],
      manufacturers: [],
      monthly_2026: {}
    };
  };

  let _currentPharmacyId = null;

  function getPharmacyStorageKey() {
    return 'rawData_monthly_' + (_currentPharmacyId || 'guest');
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
            period_type: 'monthly',
            year: 2026,
            month: null,
            data: dataObj,
            updated_at: new Date().toISOString()
          }, { onConflict: 'pharmacy_id,period_type,year' });

        if (error) {
          console.warn('[Sync Monthly] Note sauvegarde cloud:', error.message);
        } else {
          console.log('[Sync Monthly] Sauvegarde cloud OK pour pharmacie:', _currentPharmacyId);
        }
      } catch(err) {
        console.error('[Sync Monthly] Erreur sync:', err);
      }
    };

    window.loadGenericsDataFromCloud = async function() {
      try {
        const pharmacyId = await fetchPharmacyId();
        if (!pharmacyId) {
          rawData = getEmptyRawData();
          if (typeof refreshDashboardUI === 'function') refreshDashboardUI();
          return;
        }

        _currentPharmacyId = pharmacyId;
        const storageKey = getPharmacyStorageKey();

        const { data, error } = await window.supabaseClient
          .from('generics_purchases')
          .select('data')
          .eq('pharmacy_id', pharmacyId)
          .eq('period_type', 'monthly')
          .order('updated_at', { ascending: false })
          .limit(1);

        if (!error && data && data.length > 0 && data[0].data && Object.keys(data[0].data).length > 0) {
          rawData = data[0].data;
          localStorage.setItem(storageKey, JSON.stringify(rawData));
          console.log('[Sync Monthly] Données cloud chargées pour pharmacie:', pharmacyId);
        } else {
          const cached = localStorage.getItem(storageKey);
          if (cached) {
            try {
              rawData = JSON.parse(cached);
              console.log('[Sync Monthly] Données cache local chargées pour pharmacie:', pharmacyId);
            } catch(e) {
              rawData = getEmptyRawData();
            }
          } else {
            rawData = getEmptyRawData();
            console.log('[Sync Monthly] Pharmacie sans historique. Démarrage vierge.');
          }
        }

        if (typeof refreshDashboardUI === 'function') refreshDashboardUI();
      } catch(err) {
        console.error('[Sync Monthly] Erreur chargement:', err);
      }
    };

    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(window.loadGenericsDataFromCloud, 100);
    });
  })();
</script>`;

content = content.replace('</head>', `${syncScript}\n</head>`);

const targetPath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/generics_monthly.html';
fs.writeFileSync(targetPath, content);
console.log('Successfully restored generics_monthly.html with perfectly clean function boundaries.');
