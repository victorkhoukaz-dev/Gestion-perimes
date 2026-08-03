const fs = require('fs');

const indexPath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/index.html';
const monthlyPath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/generics_monthly.html';

let indexHtml = fs.readFileSync(indexPath, 'utf8');
let monthlyHtml = fs.readFileSync(monthlyPath, 'utf8');

// 1. Extraire le style de generics_monthly.html
const styleMatch = monthlyHtml.match(/<style>([\s\S]*?)<\/style>/i);
const genericsCss = styleMatch ? styleMatch[1] : '';

// 2. Extraire la structure HTML du body (entre <body> et le premier <script> de logique)
const bodyStartIdx = monthlyHtml.indexOf('<body>');
const mainLogicIdx = monthlyHtml.indexOf('<!-- Main Logic -->');
let genericsMarkup = '';
if (bodyStartIdx !== -1 && mainLogicIdx !== -1) {
  genericsMarkup = monthlyHtml.substring(bodyStartIdx + 6, mainLogicIdx);
} else {
  // Fallback si balise body pas explicite
  const containerIdx = monthlyHtml.indexOf('<div class="container-fluid');
  genericsMarkup = monthlyHtml.substring(containerIdx, mainLogicIdx);
}

// 3. Remplacer l'iframe dans #module-generics-wrapper par le HTML natif
const oldWrapperStart = indexHtml.indexOf('<div id="module-generics-wrapper"');
const oldWrapperEnd = indexHtml.indexOf('<!-- 1. RETRAIT MENSUEL -->');

const nativeWrapperHtml = `<div id="module-generics-wrapper" style="display: none; padding: 16px 0;">
      <style>
        ${genericsCss}
      </style>
      
      ${genericsMarkup.trim()}
    </div>

    `;

if (oldWrapperStart !== -1 && oldWrapperEnd !== -1) {
  indexHtml = indexHtml.substring(0, oldWrapperStart) + nativeWrapperHtml + indexHtml.substring(oldWrapperEnd);
}

// 4. Mettre à jour openGenericsModule() dans index.html
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

      // Afficher le conteneur natif des génériques (sans iFrame)
      const genWrapper = document.getElementById("module-generics-wrapper");
      if (genWrapper) genWrapper.style.display = "block";

      document.getElementById("header-module-name").textContent = "📊 Module Analyse Génériques (Actif)";

      // Charger les données du compte actif sur le module natif
      if (typeof window.loadGenericsDataFromCloud === 'function') {
        window.loadGenericsDataFromCloud();
      } else if (typeof initKpis === 'function') {
        initKpis();
      }
    }`;

const startOpenIdx = indexHtml.indexOf('function openGenericsModule()');
const endOpenIdx = indexHtml.indexOf('function openExpiresModule()');
if (startOpenIdx !== -1 && endOpenIdx !== -1) {
  indexHtml = indexHtml.substring(0, startOpenIdx) + updatedOpenGenerics + '\n\n    ' + indexHtml.substring(endOpenIdx);
}

// 5. Injecter le script de logique d'achats à la fin du body d'index.html
const scriptsStartIdx = monthlyHtml.indexOf('<!-- Main Logic -->');
const scriptsEndIdx = monthlyHtml.lastIndexOf('</body>');
let genericsScripts = '';
if (scriptsStartIdx !== -1) {
  genericsScripts = monthlyHtml.substring(scriptsStartIdx, scriptsEndIdx !== -1 ? scriptsEndIdx : monthlyHtml.length);
}

// Enlever les balises de duplication de Supabase
genericsScripts = genericsScripts.replace(/<script src="supabase.js"><\/script>/gi, '');

// S'assurer que loadGenericsDataFromCloud utilise supabaseClient existant de index.html
genericsScripts = genericsScripts.replaceAll('window.supabaseClient', 'supabaseClient');

const lastBodyEnd = indexHtml.lastIndexOf('</body>');
if (lastBodyEnd !== -1) {
  indexHtml = indexHtml.substring(0, lastBodyEnd) + '\n\n    ' + genericsScripts + '\n</body>' + indexHtml.substring(lastBodyEnd + 7);
}

fs.writeFileSync(indexPath, indexHtml);
console.log('Successfully integrated Generics module 100% NATIVE (NO IFRAME) into index.html!');
