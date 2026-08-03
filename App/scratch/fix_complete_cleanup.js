const fs = require('fs');

// =============================================
// NETTOYAGE COMPLET DE generics_monthly.html
// =============================================
const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/generics_monthly.html';
let html = fs.readFileSync(filePath, 'utf8');
let lines = html.split('\n');

console.log('Before cleanup: ' + lines.length + ' lines');

// 1. SUPPRIMER les 3 scripts de sync dupliqués (lignes 1046-1400)
//    Identifier le début du premier "<!-- Connecteur Supabase" et la fin du dernier </script> avant "<!-- Data Injection -->"
const dataInjectionIdx = lines.findIndex(l => l.includes('<!-- Data Injection -->'));
console.log('Data Injection tag at line:', dataInjectionIdx + 1);

// Chercher en arrière depuis Data Injection pour trouver le début des scripts de sync
let syncStartIdx = -1;
for (let i = dataInjectionIdx - 1; i >= 0; i--) {
  if (lines[i].includes('<!-- Connecteur Supabase')) {
    syncStartIdx = i;
  }
  if (lines[i].includes('</div>') && syncStartIdx !== -1) {
    break;  // On a trouvé la fin du HTML avant les scripts de sync
  }
}

if (syncStartIdx !== -1) {
  console.log('Removing duplicate sync scripts from line ' + (syncStartIdx + 1) + ' to ' + (dataInjectionIdx));
  lines.splice(syncStartIdx, dataInjectionIdx - syncStartIdx);
}

html = lines.join('\n');
lines = html.split('\n');

// 2. Trouver à nouveau le Data Injection
const newDataInjIdx = lines.findIndex(l => l.includes('<!-- Data Injection -->'));

// 3. INJECTER UN SEUL script de sync propre juste avant <!-- Data Injection -->
const cleanSyncScript = `
    <!-- Connecteur Supabase & Isolation Multi-Pharmacie (Loi 25 Canada) -->
    <script src="supabase.js"></script>
    <script>
      // === FONCTIONS GLOBALES D'ISOLATION PAR PHARMACIE ===
      let _currentPharmacyId = null;

      function getPharmacyStorageKey() {
        return 'rawData_monthly_' + (_currentPharmacyId || 'unset');
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
                period_type: 'monthly',
                year: 2026,
                month: null,
                data: dataObj,
                updated_at: new Date().toISOString()
              }, { onConflict: 'pharmacy_id,period_type,year' });

            if (error) {
              console.warn('[Sync] Sauvegarde cloud:', error.message);
            } else {
              console.log('[Sync] Sauvegarde cloud OK pour pharmacie:', _currentPharmacyId);
            }
          } catch(err) {
            console.error('[Sync] Erreur:', err);
          }
        };

        window.loadGenericsDataFromCloud = async function() {
          try {
            const pharmacyId = await fetchPharmacyId();
            if (!pharmacyId) {
              console.log('[Sync] Pas de session active. État vierge.');
              rawData = getEmptyRawData();
              if (typeof saveAndRefreshDashboard === 'function') saveAndRefreshDashboard();
              return;
            }

            _currentPharmacyId = pharmacyId;
            const storageKey = getPharmacyStorageKey();

            // 1. Tenter Supabase
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
              console.log('[Sync] Chargement cloud OK pour pharmacie:', pharmacyId);
            } else {
              // 2. Tenter localStorage isolé
              const cached = localStorage.getItem(storageKey);
              if (cached) {
                try {
                  rawData = JSON.parse(cached);
                  console.log('[Sync] Chargement cache local OK pour pharmacie:', pharmacyId);
                } catch(e) {
                  rawData = getEmptyRawData();
                }
              } else {
                // 3. Aucune donnée -> état vierge
                rawData = getEmptyRawData();
                console.log('[Sync] Pharmacie sans historique. Démarrage vierge pour:', pharmacyId);
              }
            }

            if (typeof saveAndRefreshDashboard === 'function') saveAndRefreshDashboard();
          } catch(err) {
            console.error('[Sync] Erreur chargement:', err);
          }
        };

        // Charger les données du bon compte dès que possible
        window.addEventListener('DOMContentLoaded', () => {
          setTimeout(window.loadGenericsDataFromCloud, 100);
        });
      })();
    </script>

`;

lines.splice(newDataInjIdx, 0, cleanSyncScript);
html = lines.join('\n');

// 4. NEUTRALISER le chargement localStorage dans le script du Data Manager (ligne ~2809)
//    Ce code charge depuis localStorage AVANT que loadGenericsDataFromCloud ne s'exécute,
//    ce qui écrase rawData avec les données du mauvais compte.
html = html.replace(
  /\/\/ Load custom data from localStorage if available\s*\n\s*const savedData = localStorage\.getItem\(getPharmacyStorageKey\(\)\);\s*\n\s*if \(savedData\) \{\s*\n\s*try \{\s*\n\s*rawData = JSON\.parse\(savedData\);\s*\n\s*console\.log\("Données chargées depuis le localStorage\."\);\s*\n\s*\} catch \(e\) \{\s*\n\s*console\.error\("Erreur lors de la lecture du localStorage:", e\);\s*\n\s*\}\s*\n\s*\}/,
  '// [DÉSACTIVÉ] Le chargement localStorage est géré par loadGenericsDataFromCloud\n        // pour garantir l\'isolation stricte par pharmacie.'
);

fs.writeFileSync(filePath, html);

// Vérification
const finalLines = html.split('\n');
console.log('After cleanup: ' + finalLines.length + ' lines');

// Compter les scripts de sync restants
const syncCount = (html.match(/Connecteur Supabase/g) || []).length;
console.log('Sync script blocks remaining:', syncCount, '(should be 1)');

// Vérifier que le localStorage direct est neutralisé
console.log('Direct localStorage load disabled:', html.includes('[DÉSACTIVÉ] Le chargement localStorage'));
