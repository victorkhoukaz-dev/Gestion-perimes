const fs = require('fs');

// =============================================
// NETTOYAGE COMPLET DE generics_annual.html
// =============================================
const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/generics_annual.html';
let html = fs.readFileSync(filePath, 'utf8');
let lines = html.split('\n');

console.log('Before cleanup: ' + lines.length + ' lines');

// 1. SUPPRIMER les scripts de sync dupliqués avant <!-- Data Injection -->
const dataInjectionIdx = lines.findIndex(l => l.includes('<!-- Data Injection -->'));
console.log('Data Injection tag at line:', dataInjectionIdx + 1);

let syncStartIdx = -1;
for (let i = dataInjectionIdx - 1; i >= 0; i--) {
  if (lines[i].includes('<!-- Connecteur Supabase')) {
    syncStartIdx = i;
  }
  if (lines[i].includes('</div>') && syncStartIdx !== -1) {
    break;
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

// 3. INJECTER UN SEUL script de sync propre
const cleanSyncScript = `
    <!-- Connecteur Supabase & Isolation Multi-Pharmacie (Loi 25 Canada) -->
    <script src="supabase.js"></script>
    <script>
      let _currentPharmacyId = null;

      function getPharmacyStorageKey() {
        return 'rawData_annual_' + (_currentPharmacyId || 'unset');
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
                period_type: 'annual',
                year: 2026,
                month: null,
                data: dataObj,
                updated_at: new Date().toISOString()
              }, { onConflict: 'pharmacy_id,period_type,year' });

            if (error) {
              console.warn('[Sync Annual] Sauvegarde cloud:', error.message);
            } else {
              console.log('[Sync Annual] Sauvegarde cloud OK pour pharmacie:', _currentPharmacyId);
            }
          } catch(err) {
            console.error('[Sync Annual] Erreur:', err);
          }
        };

        window.loadGenericsDataFromCloud = async function() {
          try {
            const pharmacyId = await fetchPharmacyId();
            if (!pharmacyId) {
              rawData = getEmptyRawData();
              if (typeof saveAndRefreshDashboard === 'function') saveAndRefreshDashboard();
              return;
            }

            _currentPharmacyId = pharmacyId;
            const storageKey = getPharmacyStorageKey();

            const { data, error } = await window.supabaseClient
              .from('generics_purchases')
              .select('data')
              .eq('pharmacy_id', pharmacyId)
              .eq('period_type', 'annual')
              .order('updated_at', { ascending: false })
              .limit(1);

            if (!error && data && data.length > 0 && data[0].data && Object.keys(data[0].data).length > 0) {
              rawData = data[0].data;
              localStorage.setItem(storageKey, JSON.stringify(rawData));
              console.log('[Sync Annual] Chargement cloud OK pour pharmacie:', pharmacyId);
            } else {
              const cached = localStorage.getItem(storageKey);
              if (cached) {
                try {
                  rawData = JSON.parse(cached);
                } catch(e) {
                  rawData = getEmptyRawData();
                }
              } else {
                rawData = getEmptyRawData();
                console.log('[Sync Annual] Pharmacie sans historique annuel.');
              }
            }

            if (typeof saveAndRefreshDashboard === 'function') saveAndRefreshDashboard();
          } catch(err) {
            console.error('[Sync Annual] Erreur chargement:', err);
          }
        };

        window.addEventListener('DOMContentLoaded', () => {
          setTimeout(window.loadGenericsDataFromCloud, 100);
        });
      })();
    </script>

`;

lines.splice(newDataInjIdx, 0, cleanSyncScript);
html = lines.join('\n');

// 4. NEUTRALISER le chargement localStorage direct dans le Data Manager
html = html.replace(
  /\/\/ Load custom data from localStorage if available\s*\n\s*const savedData = localStorage\.getItem\(['"]rawData_annual['"]\);\s*\n\s*if \(savedData\) \{\s*\n\s*try \{\s*\n\s*rawData = JSON\.parse\(savedData\);\s*\n\s*console\.log\("Données chargées depuis le localStorage\."\);\s*\n\s*\} catch \(e\) \{\s*\n\s*console\.error\("Erreur lors de la lecture du localStorage:", e\);\s*\n\s*\}\s*\n\s*\}/,
  '// [DÉSACTIVÉ] Le chargement localStorage est géré par loadGenericsDataFromCloud'
);

// 5. Remplacer le saveAndRefreshDashboard localStorage.setItem('rawData_annual') direct
html = html.replace(
  "localStorage.setItem('rawData_annual', JSON.stringify(rawData));",
  "if (typeof window.syncGenericsDataToCloud === 'function') window.syncGenericsDataToCloud(rawData);"
);

fs.writeFileSync(filePath, html);

const finalLines = html.split('\n');
console.log('After cleanup: ' + finalLines.length + ' lines');
const syncCount = (html.match(/Connecteur Supabase/g) || []).length;
console.log('Sync script blocks remaining:', syncCount, '(should be 1)');
console.log('Direct rawData_annual load disabled:', html.includes('[DÉSACTIVÉ]'));
console.log('Direct rawData_annual save replaced:', !html.includes("localStorage.setItem('rawData_annual'"));
