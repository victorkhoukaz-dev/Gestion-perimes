const fs = require('fs');

const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/index.html';
let html = fs.readFileSync(filePath, 'utf8');

// 1. Déclarer openGenericsModule si pas présent
const openGenericsFn = `    function openGenericsModule() {
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

      // Afficher le conteneur du module Génériques
      const genWrapper = document.getElementById("module-generics-wrapper");
      if (genWrapper) genWrapper.style.display = "block";

      document.getElementById("header-module-name").textContent = "📊 Module Analyse Génériques (Actif)";
    }`;

if (!html.includes('function openGenericsModule()')) {
  html = html.replace('function openExpiresModule()', `${openGenericsFn}\n\n    function openExpiresModule()`);
}

// 2. Injecter le div #module-generics-wrapper avec l'iframe vers generics_portal.html s'il n'existe pas dans le DOM
const genericsWrapperHtml = `
    <!-- MODULE ANALYSE GÉNÉRIQUES -->
    <div id="module-generics-wrapper" style="display: none; padding-top: 16px;">
      <iframe id="gen-iframe-portal" src="generics_portal.html" style="width: 100%; height: 85vh; min-height: 750px; border: none; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.15);"></iframe>
    </div>
`;

if (!html.includes('id="module-generics-wrapper"')) {
  html = html.replace('<!-- 1. RETRAIT MENSUEL -->', `${genericsWrapperHtml.trim()}\n\n    <!-- 1. RETRAIT MENSUEL -->`);
}

fs.writeFileSync(filePath, html);
console.log('Successfully injected openGenericsModule and #module-generics-wrapper into index.html.');
