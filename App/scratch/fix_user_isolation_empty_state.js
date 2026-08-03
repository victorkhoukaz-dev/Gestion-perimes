const fs = require('fs');

// 1. Définition de la fonction d'état vide par défaut
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

// 2. Mettre à jour generics_monthly.html et generics_annual.html
['generics_monthly.html', 'generics_annual.html'].forEach(filename => {
  const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/' + filename;
  let html = fs.readFileSync(filePath, 'utf8');

  const syncScript = `
    <!-- Connecteur Supabase & Multi-Appareils Propriétaire (Loi 25 Canada) -->
    <script src="supabase.js"></script>
    <script>
      ${emptyRawDataDef}

      (function() {
        window.syncGenericsDataToCloud = async function(dataObj) {
          try {
            if (!window.supabaseClient) return;
            const userRes = await window.supabaseClient.auth.getUser();
            const user = userRes?.data?.user;
            if (!user) return;

            const pharmacyId = user.user_metadata?.pharmacy_id || user.id;
            const payload = {
              pharmacy_id: pharmacyId,
              user_id: user.id,
              period_type: 'monthly',
              year: 2026,
              month: null,
              data: dataObj,
              updated_at: new Date().toISOString()
            };

            localStorage.setItem('generics_pharmacy_id', pharmacyId);

            const { error } = await window.supabaseClient
              .from('generics_purchases')
              .upsert(payload, { onConflict: 'pharmacy_id,period_type,year' });

            if (error) {
              console.warn('[Generics Supabase Sync] Note RLS/Sauvegarde:', error.message);
            } else {
              console.log('[Generics Supabase Sync] Sauvegarde réussie sur le cloud Canada (ca-central-1)');
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

            const pharmacyId = user.user_metadata?.pharmacy_id || user.id;
            const cachedPharmacyId = localStorage.getItem('generics_pharmacy_id');

            // Si changement de compte / pharmacie sur le même navigateur, nettoyer le cache local
            if (cachedPharmacyId && cachedPharmacyId !== pharmacyId) {
              console.log('[Generics Sync] Changement de compte détecté. Réinitialisation du cache local.');
              localStorage.removeItem('rawData_monthly');
              localStorage.setItem('generics_pharmacy_id', pharmacyId);
            }

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
              localStorage.setItem('rawData_monthly', JSON.stringify(cloudData));
              console.log('[Generics Supabase Sync] Données chargées depuis Supabase pour la pharmacie:', pharmacyId);
            } else {
              // Nouvel utilisateur sans données sauvegardées : Démarrer à l'état vide
              console.log('[Generics Sync] Aucune donnée enregistrée pour cette pharmacie. Démarrage état vide $0,00.');
              const cached = localStorage.getItem('rawData_monthly');
              if (cachedPharmacyId === pharmacyId && cached) {
                try { rawData = JSON.parse(cached); } catch(e) { rawData = getEmptyRawData(); }
              } else {
                rawData = getEmptyRawData();
                localStorage.removeItem('rawData_monthly');
              }
            }

            if (typeof saveAndRefreshDashboard === 'function') saveAndRefreshDashboard();
            if (typeof window.saveAndRefreshMonthlyDashboard === 'function') window.saveAndRefreshMonthlyDashboard();
          } catch(err) {
            console.error('[Generics Supabase Sync] Erreur lors du chargement cloud:', err);
          }
        };

        window.addEventListener('DOMContentLoaded', () => {
          setTimeout(window.loadGenericsDataFromCloud, 300);
        });
      })();
    </script>
  `;

  // Injecter le script de synchro dans la balise head si pas présent
  if (!html.includes('loadGenericsDataFromCloud')) {
    html = html.replace('</head>', `${syncScript}\n</head>`);
    fs.writeFileSync(filePath, html);
    console.log(`Injected account-isolated sync into ${filename}`);
  }
});

// 3. Mettre à jour la déconnexion dans index.html pour nettoyer le cache au logout
const indexPath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');

if (indexHtml.includes('await supabaseClient.auth.signOut();')) {
  indexHtml = indexHtml.replace(
    'await supabaseClient.auth.signOut();',
    'localStorage.removeItem("rawData_monthly"); localStorage.removeItem("generics_pharmacy_id"); await supabaseClient.auth.signOut();'
  );
  fs.writeFileSync(indexPath, indexHtml);
  console.log('Updated logout in index.html to clear local generics cache.');
}
