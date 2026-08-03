const fs = require('fs');

const indexPath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/index.html';
const monthlyPath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/generics_monthly.html';

let indexHtml = fs.readFileSync(indexPath, 'utf8');
let monthlyHtml = fs.readFileSync(monthlyPath, 'utf8');

// 1. Désactiver la boucle infinie postMessage / ResizeObserver
indexHtml = indexHtml.replace(/<script>\s*\/\/ Écouteur de redimensionnement dynamique[\s\S]*?<\/script>/gi, '');

// 2. Remplacer le wrapper iframe par un conteneur a scroll interne propre avec hauteur fixe elegante
const newIframeWrapper = `
    <div id="module-generics-wrapper" style="display: none; padding-top: 8px;">
      <iframe id="gen-iframe-portal" src="generics_monthly.html" style="width: 100%; height: calc(100vh - 90px); border: none; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.12);"></iframe>
    </div>
`;

// Remplacer l'ancien wrapper iframe
const startWrapperIdx = indexHtml.indexOf('<div id="module-generics-wrapper"');
if (startWrapperIdx !== -1) {
  const endWrapperIdx = indexHtml.indexOf('</div>', startWrapperIdx);
  if (endWrapperIdx !== -1) {
    indexHtml = indexHtml.substring(0, startWrapperIdx) + newIframeWrapper.trim() + indexHtml.substring(endWrapperIdx + 6);
  }
}

fs.writeFileSync(indexPath, indexHtml);
console.log('Fixed iframe scrollbar infinite loop by setting clean height calc(100vh - 90px) and scroll handling.');

// 3. Nettoyer le script d'émetteur postMessage infini dans generics_monthly.html et generics_annual.html
['generics_monthly.html', 'generics_annual.html'].forEach(filename => {
  const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/' + filename;
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(/<script>\s*function sendHeightToParent[\s\S]*?<\/script>/gi, '');
  fs.writeFileSync(filePath, html);
  console.log(`Cleaned infinite height sender script from ${filename}`);
});
