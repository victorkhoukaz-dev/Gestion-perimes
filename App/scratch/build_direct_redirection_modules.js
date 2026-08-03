const fs = require('fs');

const SUPABASE_URL = "https://hhmwlzaeipyrowwjlbbj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhobXdsemFlaXB5cm93d2psYmJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MDM5NjYsImV4cCI6MjA5OTE3OTk2Nn0.vv1Zw3oFDilKSxh7FEocWi8Y2pzu7uX1rf_L0Jhf1m4";

// Barre d'en-tête PharmaOps élégante avec bouton de retour direct
const headerBarHtml = `
  <div style="background: linear-gradient(135deg, #0f766e 0%, #0d524c 100%); padding: 12px 24px; color: white; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 4px 12px rgba(0,0,0,0.15); margin-bottom: 20px; border-radius: 0 0 12px 12px;">
    <div style="display: flex; align-items: center; gap: 16px;">
      <a href="index.html" style="background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); color: white; text-decoration: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 0.9rem; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 8px;">
        <span>🏠</span> Retour à PharmaOps
      </a>
      <span style="font-size: 1.1rem; font-weight: 700; letter-spacing: 0.5px;">PharmaOps</span>
    </div>
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 500;">📊 Module Analyse Génériques</span>
    </div>
  </div>
`;

// Script de synchronisation Supabase 100% Cloud (0% LocalStorage)
function getSyncScript(periodType) {
  return `<script src="supabase.js"></script>
<script>
  const SUPABASE_URL = "${SUPABASE_URL}";
  const SUPABASE_KEY = "${SUPABASE_KEY}";

  if (window.supabase && !window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
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
        if (!window.supabaseClient) return;
        const userRes = await window.supabaseClient.auth.getUser();
        const user = userRes?.data?.user;
        if (!user) {
          alert("Session expirée. Veuillez vous reconnecter sur PharmaOps.");
          window.location.href = "index.html";
          return;
        }

        const pharmacyId = await fetchPharmacyId();
        if (!pharmacyId) return;

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
          console.log('[Supabase Sync ${periodType}] Sauvegarde réussie sur Supabase Cloud pour pharmacie:', pharmacyId);
        }
      } catch(err) {
        console.error('[Supabase Sync ${periodType}] Erreur:', err);
      }
    };

    window.loadGenericsDataFromCloud = async function() {
      try {
        if (!window.supabaseClient) return;
        const userRes = await window.supabaseClient.auth.getUser();
        const user = userRes?.data?.user;
        if (!user) {
          console.log('[Supabase Sync ${periodType}] Aucun utilisateur connecté. Redirection vers login.');
          window.location.href = "index.html";
          return;
        }

        const pharmacyId = await fetchPharmacyId();
        if (!pharmacyId) {
          rawData = getEmptyRawData();
          if (typeof refreshDashboardUI === 'function') refreshDashboardUI();
          return;
        }

        const { data, error } = await window.supabaseClient
          .from('generics_purchases')
          .select('data')
          .eq('pharmacy_id', pharmacyId)
          .eq('period_type', '${periodType}')
          .order('updated_at', { ascending: false })
          .limit(1);

        if (!error && data && data.length > 0 && data[0].data && Object.keys(data[0].data).length > 0) {
          rawData = data[0].data;
          console.log('[Supabase Sync ${periodType}] Données cloud chargées depuis Supabase pour:', pharmacyId);
        } else {
          // Aucun enregistrement -> État vierge 0,00$ (0% LocalStorage)
          rawData = getEmptyRawData();
          console.log('[Supabase Sync ${periodType}] Aucune donnée sur Supabase. Démarrage vierge à $0,00 pour:', pharmacyId);
        }

        if (typeof refreshDashboardUI === 'function') refreshDashboardUI();
      } catch(err) {
        console.error('[Supabase Sync ${periodType}] Erreur chargement:', err);
      }
    };

    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(window.loadGenericsDataFromCloud, 100);
    });
  })();
</script>`;
}

// 1. CONSTRUIRE generics_monthly.html
const monthlySourcePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Generiques/Tableau_de_bord_Mensuel_2026.html';
let monthlyHtml = fs.readFileSync(monthlySourcePath, 'utf8');

// Injecter la barre de retour
monthlyHtml = monthlyHtml.replace('<body>', `<body>\n${headerBarHtml}`);

// Mettre à jour le lien vers le fichier annuel
monthlyHtml = monthlyHtml.replaceAll('Tableau_de_bord_Achats%20(annuel).html', 'generics_annual.html');
monthlyHtml = monthlyHtml.replaceAll('Tableau_de_bord_Achats (annuel).html', 'generics_annual.html');

// SUPPRIMER TOUT ACCÈS LOCALSTORAGE POUR LES DONNÉES
monthlyHtml = monthlyHtml.replaceAll("localStorage.getItem('rawData_monthly')", "null");
monthlyHtml = monthlyHtml.replaceAll("localStorage.setItem('rawData_monthly', JSON.stringify(rawData));", "// LocalStorage désactivé - Supabase exclusif");
monthlyHtml = monthlyHtml.replace(
  /const savedData = localStorage\.getItem\(['"]rawData_monthly['"]\);[\s\S]*?console\.log\("Données chargées depuis le localStorage\."\);[\s\S]*?\}/,
  '// LocalStorage désactivé - Supabase exclusif'
);

// Initialiser rawData à l'état vierge getEmptyRawData()
const monthlyRawDataIdx = monthlyHtml.indexOf('let rawData = {');
if (monthlyRawDataIdx !== -1) {
  const monthlyRawDataEnd = monthlyHtml.indexOf('};', monthlyRawDataIdx);
  if (monthlyRawDataEnd !== -1) {
    monthlyHtml = monthlyHtml.substring(0, monthlyRawDataIdx) + 'let rawData = getEmptyRawData();' + monthlyHtml.substring(monthlyRawDataEnd + 2);
  }
}

// Réinitialisation & Vidage à $0,00
monthlyHtml = monthlyHtml.replace(
  'const defaultRawData = JSON.parse(JSON.stringify(rawData));',
  'const defaultRawData = getEmptyRawData();'
);
monthlyHtml = monthlyHtml.replace(
  'rawData = JSON.parse(JSON.stringify(defaultRawData));',
  'rawData = getEmptyRawData(); if (typeof window.syncGenericsDataToCloud === "function") window.syncGenericsDataToCloud(rawData);'
);
monthlyHtml = monthlyHtml.replace(
  /rawData\s*=\s*\{\s*totals:[\s\S]*?manufacturers:\s*\[\]\s*\};/,
  'rawData = getEmptyRawData(); if (typeof window.syncGenericsDataToCloud === "function") window.syncGenericsDataToCloud(rawData);'
);

// Remplacer saveAndRefreshDashboard
const saveFnIdxM = monthlyHtml.indexOf('function saveAndRefreshDashboard() {');
if (saveFnIdxM !== -1) {
  const nextFnIdxM = monthlyHtml.indexOf('function closeModal() {', saveFnIdxM);
  if (nextFnIdxM !== -1) {
    const cleanSaveFnM = `function refreshDashboardUI() {
            try {
                if (typeof updateMonthsCount === 'function') updateMonthsCount();
                if (typeof initKpis === 'function') initKpis();
            } catch(e) {}
        }

        function saveAndRefreshDashboard() {
            if (typeof window.syncGenericsDataToCloud === 'function') window.syncGenericsDataToCloud(rawData);
            refreshDashboardUI();
        }\n\n        `;
    monthlyHtml = monthlyHtml.substring(0, saveFnIdxM) + cleanSaveFnM + monthlyHtml.substring(nextFnIdxM);
  }
}

// Injecter le script Supabase Cloud dans le head
monthlyHtml = monthlyHtml.replace('</head>', `${getSyncScript('monthly')}\n</head>`);

fs.writeFileSync('C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/generics_monthly.html', monthlyHtml);
console.log('Created App/generics_monthly.html with 0% LocalStorage & Direct Header Navigation.');

// 2. CONSTRUIRE generics_annual.html
const annualSourcePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Generiques/Tableau_de_bord_Achats (annuel).html';
let annualHtml = fs.readFileSync(annualSourcePath, 'utf8');

// Injecter la barre de retour
annualHtml = annualHtml.replace('<body>', `<body>\n${headerBarHtml}`);

// Mettre à jour le lien vers le fichier mensuel
annualHtml = annualHtml.replaceAll('Tableau_de_bord_Mensuel_2026.html', 'generics_monthly.html');

// SUPPRIMER TOUT ACCÈS LOCALSTORAGE POUR LES DONNÉES
annualHtml = annualHtml.replaceAll("localStorage.getItem('rawData_annual')", "null");
annualHtml = annualHtml.replaceAll("localStorage.setItem('rawData_annual', JSON.stringify(rawData));", "// LocalStorage désactivé - Supabase exclusif");
annualHtml = annualHtml.replace(
  /const savedData = localStorage\.getItem\(['"]rawData_annual['"]\);[\s\S]*?console\.log\("Données chargées depuis le localStorage\."\);[\s\S]*?\}/,
  '// LocalStorage désactivé - Supabase exclusif'
);

// Initialiser rawData à l'état vierge getEmptyRawData()
const annualRawDataIdx = annualHtml.indexOf('let rawData = {');
if (annualRawDataIdx !== -1) {
  const annualRawDataEnd = annualHtml.indexOf('};', annualRawDataIdx);
  if (annualRawDataEnd !== -1) {
    annualHtml = annualHtml.substring(0, annualRawDataIdx) + 'let rawData = getEmptyRawData();' + annualHtml.substring(annualRawDataEnd + 2);
  }
}

// Réinitialisation & Vidage à $0,00
annualHtml = annualHtml.replace(
  'const defaultRawData = JSON.parse(JSON.stringify(rawData));',
  'const defaultRawData = getEmptyRawData();'
);
annualHtml = annualHtml.replace(
  'rawData = JSON.parse(JSON.stringify(defaultRawData));',
  'rawData = getEmptyRawData(); if (typeof window.syncGenericsDataToCloud === "function") window.syncGenericsDataToCloud(rawData);'
);
annualHtml = annualHtml.replace(
  /rawData\s*=\s*\{\s*totals:[\s\S]*?manufacturers:\s*\[\]\s*\};/,
  'rawData = getEmptyRawData(); if (typeof window.syncGenericsDataToCloud === "function") window.syncGenericsDataToCloud(rawData);'
);

// Remplacer saveAndRefreshDashboard
const saveFnIdxA = annualHtml.indexOf('function saveAndRefreshDashboard() {');
if (saveFnIdxA !== -1) {
  const nextFnIdxA = annualHtml.indexOf('function closeModal() {', saveFnIdxA);
  if (nextFnIdxA !== -1) {
    const cleanSaveFnA = `function refreshDashboardUI() {
            try {
                if (typeof updateMonthsCount === 'function') updateMonthsCount();
                if (typeof initKpis === 'function') initKpis();
            } catch(e) {}
        }

        function saveAndRefreshDashboard() {
            if (typeof window.syncGenericsDataToCloud === 'function') window.syncGenericsDataToCloud(rawData);
            refreshDashboardUI();
        }\n\n        `;
    annualHtml = annualHtml.substring(0, saveFnIdxA) + cleanSaveFnA + annualHtml.substring(nextFnIdxA);
  }
}

// Injecter le script Supabase Cloud dans le head
annualHtml = annualHtml.replace('</head>', `${getSyncScript('annual')}\n</head>`);

fs.writeFileSync('C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/generics_annual.html', annualHtml);
console.log('Created App/generics_annual.html with 0% LocalStorage & Direct Header Navigation.');
