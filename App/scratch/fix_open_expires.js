const fs = require('fs');

const indexPath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');

const updatedOpenExpires = `function openExpiresModule() {
      document.getElementById("hub-landing-container").style.display = "none";
      document.getElementById("main-app-wrapper").style.display = "block";

      const genWrapper = document.getElementById("module-generics-wrapper");
      if (genWrapper) genWrapper.style.display = "none";

      const navTabs = document.querySelector(".nav-tabs");
      if (navTabs) navTabs.style.display = "flex";
      const mobileNav = document.querySelector(".mobile-bottom-nav");
      if (mobileNav) mobileNav.style.display = "flex";

      document.getElementById("header-module-name").textContent = "📦 Module Expirés Labo (Actif)";
      
      const defaultTabId = (window.innerWidth <= 768) ? "tab-tournee" : "tab-retrait";
      const defaultBtn = document.querySelector(\`.tab-btn[data-tab="\${defaultTabId}"], .mobile-nav-item[data-tab="\${defaultTabId}"]\`);
      if (defaultBtn) defaultBtn.click();
    }`;

const oldOpenExpires = `function openExpiresModule() {
      document.getElementById("hub-landing-container").style.display = "none";
      document.getElementById("main-app-wrapper").style.display = "block";
      
      // Sélection immédiate de l'onglet par défaut
      const defaultTabId = (window.innerWidth <= 768) ? "tab-tournee" : "tab-retrait";
      const defaultBtn = document.querySelector(\`.tab-btn[data-tab="\${defaultTabId}"], .mobile-nav-item[data-tab="\${defaultTabId}"]\`);
      if (defaultBtn) defaultBtn.click();
    }`;

if (indexHtml.includes(oldOpenExpires)) {
  indexHtml = indexHtml.replace(oldOpenExpires, updatedOpenExpires);
  fs.writeFileSync(indexPath, indexHtml);
  console.log('Successfully updated openExpiresModule in index.html.');
}
