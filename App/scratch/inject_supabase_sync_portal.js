const fs = require('fs');

const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/generics_portal.html';
let html = fs.readFileSync(filePath, 'utf8');

const syncCode = `
    <!-- Connecteur Supabase & Multi-Appareils Propriétaire (Loi 25 Canada) -->
    <script src="supabase.js"></script>
    <script>
      (function() {
        // Enregistrement asynchrone des données sur Supabase pour la synchronisation multi-appareils
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

        // Chargement initial depuis Supabase au démarrage si disponible
        window.loadGenericsDataFromCloud = async function() {
          try {
            if (!window.supabaseClient) return;
            const userRes = await window.supabaseClient.auth.getUser();
            const user = userRes?.data?.user;
            if (!user) return;

            const pharmacyId = user.user_metadata?.pharmacy_id || user.id;
            const { data, error } = await window.supabaseClient
              .from('generics_purchases')
              .select('data')
              .eq('pharmacy_id', pharmacyId)
              .eq('period_type', 'monthly')
              .order('updated_at', { ascending: false })
              .limit(1);

            if (!error && data && data.length > 0 && data[0].data) {
              const cloudData = data[0].data;
              localStorage.setItem('rawData_monthly', JSON.stringify(cloudData));
              console.log('[Generics Supabase Sync] Données d\'achats chargées depuis Supabase Canada');
              if (typeof window.saveAndRefreshMonthlyDashboard === 'function') {
                window.saveAndRefreshMonthlyDashboard();
              } else if (typeof window.renderAll === 'function') {
                window.renderAll();
              }
            }
          } catch(err) {
            console.error('[Generics Supabase Sync] Erreur lors du chargement cloud:', err);
          }
        };

        window.addEventListener('DOMContentLoaded', () => {
          setTimeout(window.loadGenericsDataFromCloud, 500);
        });
      })();
    </script>
`;

// Hook into localStorage.setItem('rawData_monthly', ...)
if (!html.includes('syncGenericsDataToCloud')) {
  html = html.replace(
    "localStorage.setItem('rawData_monthly', JSON.stringify(rawData));",
    "localStorage.setItem('rawData_monthly', JSON.stringify(rawData)); if (typeof window.syncGenericsDataToCloud === 'function') window.syncGenericsDataToCloud(rawData);"
  );
  html = html.replace('</head>', `${syncCode}\n</head>`);
  fs.writeFileSync(filePath, html);
  console.log('Successfully injected Supabase Sync into App/generics_portal.html.');
}
