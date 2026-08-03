const fs = require('fs');

const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/index.html';
let html = fs.readFileSync(filePath, 'utf8');

const updatedOpenExpires = `    function openExpiresModule() {
      document.getElementById("hub-landing-container").style.display = "none";
      document.getElementById("main-app-wrapper").style.display = "block";

      // Masquer le module Génériques s'il était actif
      const genWrapper = document.getElementById("module-generics-wrapper");
      if (genWrapper) genWrapper.style.display = "none";

      // Ré-afficher la barre d'onglets de navigation Expirés Labo (laisser le CSS gérer la vue mobile)
      const navTabs = document.querySelector(".nav-tabs");
      if (navTabs) navTabs.style.display = "";
      const mobileNav = document.querySelector(".mobile-bottom-nav");
      if (mobileNav) mobileNav.style.display = "";
      const mobileHeader = document.getElementById("mobile-section-header");
      if (mobileHeader) mobileHeader.style.display = "";

      // Réinitialiser les styles inline sur les contenus d'onglets pour laisser le CSS .active fonctionner 100%
      document.querySelectorAll(".tab-content").forEach(tab => {
        tab.style.display = "";
      });

      document.getElementById("header-module-name").textContent = "📦 Module Expirés Labo (Actif)";
      
      // Sélectionner l'onglet Expirés par défaut (Retrait Mensuel sur bureau, Saisie / Tournée sur mobile)
      const defaultTabId = (window.innerWidth <= 768) ? "tab-tournee" : "tab-retrait";
      const defaultBtn = document.querySelector(\`.tab-btn[data-tab="\${defaultTabId}"], .mobile-nav-item[data-tab="\${defaultTabId}"]\`);
      if (defaultBtn) defaultBtn.click();
    }`;

const startIdx = html.indexOf('function openExpiresModule()');
const endIdx = html.indexOf('function returnToHub()');

if (startIdx !== -1 && endIdx !== -1) {
  html = html.substring(0, startIdx) + updatedOpenExpires + '\n\n    ' + html.substring(endIdx);
  fs.writeFileSync(filePath, html);
  console.log('Successfully updated openExpiresModule in index.html to restore native CSS tabs and hide mobile nav on desktop.');
}
