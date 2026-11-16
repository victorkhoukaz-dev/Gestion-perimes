const fs = require('fs');

const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/index.html';
let html = fs.readFileSync(filePath, 'utf8');

// 1. Remplacer showGenericsModulePreview() par openGenericsModule() sur la carte Hub et le menu déroulant
html = html.replaceAll('showGenericsModulePreview();', 'openGenericsModule();');

// 2. Mettre à jour openExpiresModule() pour masquer systématiquement le wrapper des génériques et ré-afficher nav-tabs
const updatedOpenExpires = `    function openExpiresModule() {
      document.getElementById("hub-landing-container").style.display = "none";
      document.getElementById("main-app-wrapper").style.display = "block";

      // Masquer le module Génériques s'il était ouvert
      const genWrapper = document.getElementById("module-generics-wrapper");
      if (genWrapper) genWrapper.style.display = "none";

      // Ré-afficher la barre d'onglets de navigation Expirés Labo
      const navTabs = document.querySelector(".nav-tabs");
      if (navTabs) navTabs.style.display = "flex";

      document.getElementById("header-module-name").textContent = "📦 Module Expirés Labo (Actif)";
      
      const defaultTabId = (window.innerWidth <= 768) ? "tab-tournee" : "tab-retrait";
      const defaultBtn = document.querySelector(\`.tab-btn[data-tab="\${defaultTabId}"], .mobile-nav-item[data-tab="\${defaultTabId}"]\`);
      if (defaultBtn) defaultBtn.click();
    }`;

const startExpiresIdx = html.indexOf('function openExpiresModule()');
const endExpiresIdx = html.indexOf('function returnToHub()');
if (startExpiresIdx !== -1 && endExpiresIdx !== -1) {
  html = html.substring(0, startExpiresIdx) + updatedOpenExpires + '\n\n    ' + html.substring(endExpiresIdx);
}

// 3. Mettre à jour returnToHub() pour masquer aussi le module génériques
const updatedReturnToHub = `    function returnToHub() {
      document.getElementById("main-app-wrapper").style.display = "none";
      const genWrapper = document.getElementById("module-generics-wrapper");
      if (genWrapper) genWrapper.style.display = "none";
      document.getElementById("hub-landing-container").style.display = "block";
    }`;

const startHubIdx = html.indexOf('function returnToHub()');
const endHubIdx = html.indexOf('// Swiping / Touch Navigation');
if (startHubIdx !== -1 && endHubIdx !== -1) {
  html = html.substring(0, startHubIdx) + updatedReturnToHub + '\n\n    ' + html.substring(endHubIdx);
}

fs.writeFileSync(filePath, html);
console.log('Successfully updated direct access to openGenericsModule in index.html.');
