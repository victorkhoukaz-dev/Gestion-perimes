const fs = require('fs');

const SUPABASE_URL = "https://hhmwlzaeipyrowwjlbbj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhobXdsemFlaXB5cm93d2psYmJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MDM5NjYsImV4cCI6MjA5OTE3OTk2Nn0.vv1Zw3oFDilKSxh7FEocWi8Y2pzu7uX1rf_L0Jhf1m4";

function processFile(filename, periodType) {
  const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/' + filename;
  let html = fs.readFileSync(filePath, 'utf8');

  // 1. Remplacer les accès direct localStorage.setItem/getItem unpartitionnés
  const oldStorageKey = periodType === 'monthly' ? 'rawData_monthly' : 'rawData_annual';
  html = html.replaceAll(`localStorage.setItem('${oldStorageKey}', JSON.stringify(rawData));`, `saveToPharmacyStorage(rawData);`);
  html = html.replaceAll(`localStorage.getItem('${oldStorageKey}')`, `loadFromPharmacyStorage()`);

  // 2. Injecter Supabase SDK et le script de synchro cloisonné dans le head
  const syncModuleScript = `<script src="supabase.js"></script>
<script>
  if (window.supabase && !window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient("${SUPABASE_URL}", "${SUPABASE_KEY}");
  }

  let _activePharmacyId = null;

  function getPharmacyStorageKey() {
    return '${oldStorageKey}_' + (_activePharmacyId || 'guest');
  }

  function saveToPharmacyStorage(dataObj) {
    if (_activePharmacyId) {
      localStorage.setItem(getPharmacyStorageKey(), JSON.stringify(dataObj));
    }
  }

  function loadFromPharmacyStorage() {
    if (_activePharmacyId) {
      return localStorage.getItem(getPharmacyStorageKey());
    }
    return null;
  }

  window.getEmptyRawData = function() {
    return {
      totals: { "2022": 0, "2023": 0, "2024": 0, "2025": 0, "2026": 0 },
      years: [2022, 2023, 2024, 2025, 2026],
      manufacturers: [],
      monthly_2026: {}
    };
  };

  (function() {
    async function getPharmacyIdFromSession() {
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
        if (!window.supabaseClient) return;
        const userRes = await window.supabaseClient.auth.getUser();
        const user = userRes?.data?.user;
        if (!user) return;

        const pharmacyId = await getPharmacyIdFromSession();
        if (!pharmacyId) return;

        _activePharmacyId = pharmacyId;
        saveToPharmacyStorage(dataObj);

        const payload = {
          pharmacy_id: pharmacyId,
          user_id: user.id,
          period_type: '${periodType}',
          year: 2026,
          month: null,
          data: dataObj,
          updated_at: new Date().toISOString()
        };

        const { error } = await window.supabaseClient
          .from('generics_purchases')
          .upsert(payload, { onConflict: 'pharmacy_id,period_type,year' });

        if (error) {
          console.warn('[Supabase Sync ${periodType}] Note sauvegarde:', error.message);
        } else {
          console.log('[Supabase Sync ${periodType}] Sauvegarde cloud réussie pour pharmacie:', pharmacyId);
        }
      } catch(err) {
        console.error('[Supabase Sync ${periodType}] Erreur:', err);
      }
    };

    window.loadGenericsDataFromCloud = async function() {
      try {
        const pharmacyId = await getPharmacyIdFromSession();
        if (!pharmacyId) {
          rawData = getEmptyRawData();
          if (typeof refreshDashboardUI === 'function') refreshDashboardUI();
          return;
        }

        _activePharmacyId = pharmacyId;
        const storageKey = getPharmacyStorageKey();

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
          console.log('[Supabase Sync ${periodType}] Données chargées depuis Supabase pour:', pharmacyId);
        } else {
          const cached = localStorage.getItem(storageKey);
          if (cached) {
            try {
              rawData = JSON.parse(cached);
              console.log('[Supabase Sync ${periodType}] Données chargées depuis cache local pour:', pharmacyId);
            } catch(e) {
              rawData = getEmptyRawData();
            }
          } else {
            rawData = getEmptyRawData();
            console.log('[Supabase Sync ${periodType}] Nouvelle pharmacie. Démarrage vierge pour:', pharmacyId);
          }
        }

        if (typeof refreshDashboardUI === 'function') refreshDashboardUI();
      } catch(err) {
        console.error('[Supabase Sync ${periodType}] Erreur:', err);
      }
    };

    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(window.loadGenericsDataFromCloud, 100);
    });
  })();
</script>`;

  if (!html.includes('syncGenericsDataToCloud')) {
    html = html.replace('</head>', `${syncModuleScript}\n</head>`);
  }

  // 3. Connecter saveAndRefreshDashboard à syncGenericsDataToCloud
  if (html.includes('function saveAndRefreshDashboard() {')) {
    html = html.replace(
      'function saveAndRefreshDashboard() {',
      'function saveAndRefreshDashboard() {\n            if (typeof window.syncGenericsDataToCloud === "function") window.syncGenericsDataToCloud(rawData);'
    );
  }

  // 4. Ajouter la fonction de rafraîchissement d'interface sans boucle
  if (!html.includes('function refreshDashboardUI()')) {
    const refreshFnCode = `
      function refreshDashboardUI() {
        try {
          if (typeof updateMonthsCount === 'function') updateMonthsCount();
          if (typeof initKpis === 'function') initKpis();
        } catch(e) {}
      }
    `;
    html = html.replace('function saveAndRefreshDashboard() {', `${refreshFnCode}\n        function saveAndRefreshDashboard() {`);
  }

  fs.writeFileSync(filePath, html);
  console.log(`Successfully configured Supabase sync & pharmacy partitioning for ${filename}`);
}

processFile('generics_monthly.html', 'monthly');
processFile('generics_annual.html', 'annual');
