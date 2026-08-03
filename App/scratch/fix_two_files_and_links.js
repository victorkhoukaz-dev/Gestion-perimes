const fs = require('fs');

// 1. Mettre à jour les liens inter-fichiers dans generics_monthly.html
const mPath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/generics_monthly.html';
let mHtml = fs.readFileSync(mPath, 'utf8');
mHtml = mHtml.replaceAll('Tableau_de_bord_Achats (annuel).html', 'generics_annual.html');
mHtml = mHtml.replaceAll('Tableau_de_bord_Achats%20(annuel).html', 'generics_annual.html');
mHtml = mHtml.replaceAll('Tableau_de_bord_Mensuel_2026.html', 'generics_monthly.html');
fs.writeFileSync(mPath, mHtml);
console.log('Updated inter-file links in generics_monthly.html.');

// 2. Mettre à jour les liens inter-fichiers dans generics_annual.html
const aPath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/generics_annual.html';
let aHtml = fs.readFileSync(aPath, 'utf8');
aHtml = aHtml.replaceAll('Tableau_de_bord_Achats (annuel).html', 'generics_annual.html');
aHtml = aHtml.replaceAll('Tableau_de_bord_Achats%20(annuel).html', 'generics_annual.html');
aHtml = aHtml.replaceAll('Tableau_de_bord_Mensuel_2026.html', 'generics_monthly.html');
fs.writeFileSync(aPath, aHtml);
console.log('Updated inter-file links in generics_annual.html.');

// 3. Mettre à jour App/index.html pour inclure la fonction openGenericsModule() et le conteneur iFrame
const indexPath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// Définition propre de openGenericsModule()
const openGenericsScript = `
    function openGenericsModule() {
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

      // Afficher le wrapper des génériques
      const genWrapper = document.getElementById("module-generics-wrapper");
      if (genWrapper) genWrapper.style.display = "block";

      document.getElementById("header-module-name").textContent = "📊 Module Analyse Génériques (Actif)";
    }
`;

if (!indexHtml.includes('function openGenericsModule()')) {
  const insertBefore = 'function openExpiresModule()';
  indexHtml = indexHtml.replace(insertBefore, `${openGenericsScript}\n\n    ${insertBefore}`);
}

// Remplacer les appels showGenericsModulePreview() par openGenericsModule()
indexHtml = indexHtml.replace(
  `document.getElementById("hub-card-generics")?.addEventListener("click", () => {\n        showToast("Ouverture de l'Analyse Génériques...", "info");\n        showGenericsModulePreview();\n      });`,
  `document.getElementById("hub-card-generics")?.addEventListener("click", () => {\n        showToast("Ouverture de l'Analyse Génériques...", "info");\n        openGenericsModule();\n      });`
);

indexHtml = indexHtml.replace(
  `document.getElementById("menu-mod-generics")?.addEventListener("click", (e) => {\n        e.preventDefault();\n        if (menu) menu.style.display = "none";\n        showToast("Ouverture de l'Analyse Génériques...", "info");\n        showGenericsModulePreview();\n      });`,
  `document.getElementById("menu-mod-generics")?.addEventListener("click", (e) => {\n        e.preventDefault();\n        if (menu) menu.style.display = "none";\n        showToast("Ouverture de l'Analyse Génériques...", "info");\n        openGenericsModule();\n      });`
);

// Conteneur iFrame pointant vers generics_monthly.html
const genericsWrapperMarkup = `
    <!-- CONTENEUR DU MODULE : ANALYSE DES ACHATS GÉNÉRIQUES (INTEGRATION IFRAME ÉTANCHE) -->
    <div id="module-generics-wrapper" style="display: none; padding-top: 16px;">
      <iframe id="gen-iframe-portal" src="generics_monthly.html" scrolling="no" style="width: 100%; height: 920px; border: none; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.15);"></iframe>
    </div>
`;

if (!indexHtml.includes('id="module-generics-wrapper"')) {
  const endTag = '<!-- 1. RETRAIT MENSUEL -->';
  indexHtml = indexHtml.replace(endTag, `${genericsWrapperMarkup}\n\n    ${endTag}`);
}

fs.writeFileSync(indexPath, indexHtml);
console.log('Successfully updated App/index.html with openGenericsModule and generics_monthly.html wrapper.');
