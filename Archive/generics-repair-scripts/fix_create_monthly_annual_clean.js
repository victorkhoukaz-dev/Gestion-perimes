const fs = require('fs');

const monthlySource = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Generiques/Tableau_de_bord_Mensuel_2026.html';
const annualSource = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Generiques/Tableau_de_bord_Achats (annuel).html';

let monthlyHtml = fs.readFileSync(monthlySource, 'utf8');
let annualHtml = fs.readFileSync(annualSource, 'utf8');

// 1. Mettre à jour les liens d'onglets inter-fichiers
monthlyHtml = monthlyHtml.replaceAll('Tableau_de_bord_Achats%20(annuel).html', 'generics_annual.html');
monthlyHtml = monthlyHtml.replaceAll('Tableau_de_bord_Achats (annuel).html', 'generics_annual.html');

annualHtml = annualHtml.replaceAll('Tableau_de_bord_Mensuel_2026.html', 'generics_monthly.html');

// 2. Écrire generics_monthly.html et generics_annual.html dans App/
fs.writeFileSync('C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/generics_monthly.html', monthlyHtml);
fs.writeFileSync('C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/generics_annual.html', annualHtml);

console.log('Created generics_monthly.html and generics_annual.html in App/ with proper tab links.');

// 3. Mettre à jour index.html pour pointer vers generics_monthly.html avec défilement interne propre à 85vh (sans boucle postMessage)
const indexPath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// Retirer les scripts de redimensionnement postMessage pour supprimer la boucle infinie
indexHtml = indexHtml.replace(/<script>\s*\/\/ Écouteur de redimensionnement dynamique[\s\S]*?<\/script>/gi, '');

// Mettre à jour l'iframe dans #module-generics-wrapper
const oldWrapperStart = indexHtml.indexOf('<div id="module-generics-wrapper"');
const oldWrapperEnd = indexHtml.indexOf('<!-- 1. RETRAIT MENSUEL -->');

const cleanWrapperHtml = `<div id="module-generics-wrapper" style="display: none; padding-top: 16px;">
      <iframe id="gen-iframe-portal" src="generics_monthly.html" style="width: 100%; height: 85vh; min-height: 750px; border: none; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.15);"></iframe>
    </div>

    `;

if (oldWrapperStart !== -1 && oldWrapperEnd !== -1) {
  indexHtml = indexHtml.substring(0, oldWrapperStart) + cleanWrapperHtml + indexHtml.substring(oldWrapperEnd);
}

fs.writeFileSync(indexPath, indexHtml);
console.log('Updated index.html to load generics_monthly.html with clean 85vh height and internal scrolling.');
