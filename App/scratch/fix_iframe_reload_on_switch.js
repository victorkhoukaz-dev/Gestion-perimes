const fs = require('fs');

const indexPath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/index.html';
let html = fs.readFileSync(indexPath, 'utf8');

const updatedOpenGenerics = `    function openGenericsModule() {
      document.getElementById("hub-landing-container").style.display = "none";
      document.getElementById("main-app-wrapper").style.display = "block";

      // Masquer les onglets Expirés Labo
      document.querySelectorAll(".tab-content").forEach(el => el.style.display = "none");
      const navTabs = document.querySelector(".nav-tabs");
      if (navTabs) navTabs.style.display = "none";
      const mobileNav = document.querySelector(".mobile-bottom-nav");
      if (mobileNav) mobileNav.style.display = "none";
      const mobileHeader = document.getElementById("mobile-section-header");
      if (mobileHeader) mobileHeader.style.display = "none";

      // Récupérer la pharmacie active depuis la session Supabase
      const currentPharmacyId = sessionProfile?.pharmacy_id || sessionUser?.id || "guest";
      localStorage.setItem("generics_pharmacy_id", currentPharmacyId);

      // Recharger l'iFrame pour détruire la mémoire RAM du compte précédent
      const portalFrame = document.getElementById("gen-iframe-portal");
      if (portalFrame) {
        portalFrame.src = "generics_monthly.html?t=" + Date.now();
      }

      // Afficher le conteneur du module Génériques
      const genWrapper = document.getElementById("module-generics-wrapper");
      if (genWrapper) genWrapper.style.display = "block";

      document.getElementById("header-module-name").textContent = "📊 Module Analyse Génériques (Actif)";
    }`;

// Remplacer openGenericsModule
const startIdx = html.indexOf('function openGenericsModule()');
const endIdx = html.indexOf('function openExpiresModule()');

if (startIdx !== -1 && endIdx !== -1) {
  html = html.substring(0, startIdx) + updatedOpenGenerics + '\n\n    ' + html.substring(endIdx);
}

// Nettoyer l'iframe à la déconnexion
html = html.replace(
  'await supabaseClient.auth.signOut();',
  'const portalFrame = document.getElementById("gen-iframe-portal"); if (portalFrame) portalFrame.src = "about:blank"; localStorage.removeItem("generics_pharmacy_id"); await supabaseClient.auth.signOut();'
);

fs.writeFileSync(indexPath, html);
console.log('Successfully updated index.html with iFrame memory destruction on switch and logout.');
