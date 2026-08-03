const fs = require('fs');

const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/index.html';
let html = fs.readFileSync(filePath, 'utf8');

const newOpenExpires = `    function openExpiresModule() {
      document.getElementById("hub-landing-container").style.display = "none";
      document.getElementById("main-app-wrapper").style.display = "block";

      // Masquer le module Génériques s'il était actif
      const genWrapper = document.getElementById("module-generics-wrapper");
      if (genWrapper) genWrapper.style.display = "none";

      // Ré-afficher la barre d'onglets Desktop & Mobile des Expirés
      const navTabs = document.querySelector(".nav-tabs");
      if (navTabs) navTabs.style.display = "flex";
      const mobileNav = document.querySelector(".mobile-bottom-nav");
      if (mobileNav) mobileNav.style.display = "flex";
      const mobileHeader = document.getElementById("mobile-section-header");
      if (mobileHeader) mobileHeader.style.display = (window.innerWidth <= 768) ? "block" : "none";

      document.getElementById("header-module-name").textContent = "📦 Module Expirés Labo (Actif)";
      
      // Sélectionner l'onglet Expirés actif et afficher son contenu
      const defaultTabId = (window.innerWidth <= 768) ? "tab-tournee" : "tab-retrait";
      document.querySelectorAll(".tab-content").forEach(tab => {
        if (tab.id === defaultTabId) {
          tab.style.display = "block";
          tab.classList.add("active");
        } else {
          tab.style.display = "none";
          tab.classList.remove("active");
        }
      });

      document.querySelectorAll(".tab-btn").forEach(btn => {
        if (btn.dataset.tab === defaultTabId) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
    }`;

const newReturnToHub = `    function returnToHub() {
      document.getElementById("main-app-wrapper").style.display = "none";
      document.getElementById("hub-landing-container").style.display = "block";

      const genWrapper = document.getElementById("module-generics-wrapper");
      if (genWrapper) genWrapper.style.display = "none";
    }`;

// Remplacer openExpiresModule
const startIdx = html.indexOf('function openExpiresModule()');
const endIdx = html.indexOf('function returnToHub()');

if (startIdx !== -1 && endIdx !== -1) {
  const returnEndIdx = html.indexOf('function showLoading', endIdx);
  html = html.substring(0, startIdx) + newOpenExpires + '\n\n' + newReturnToHub + '\n\n    ' + html.substring(returnEndIdx);
  fs.writeFileSync(filePath, html);
  console.log('Successfully updated openExpiresModule and returnToHub in index.html.');
}
