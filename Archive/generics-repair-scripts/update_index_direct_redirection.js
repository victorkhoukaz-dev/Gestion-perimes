const fs = require('fs');

const indexPath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/index.html';
let html = fs.readFileSync(indexPath, 'utf8');

// 1. Remplacer les gestionnaires de clic du module Génériques par une redirection directe de page
html = html.replaceAll('showGenericsModulePreview();', "window.location.href = 'generics_monthly.html';");

// 2. Définir openGenericsModule comme une redirection directe
const directRedirectFn = `    function openGenericsModule() {
      window.location.href = 'generics_monthly.html';
    }`;

if (!html.includes('function openGenericsModule()')) {
  html = html.replace('function openExpiresModule()', `${directRedirectFn}\n\n    function openExpiresModule()`);
} else {
  html = html.replace(/function openGenericsModule\(\) \{[\s\S]*?\}/, directRedirectFn);
}

fs.writeFileSync(indexPath, html);
console.log('Successfully updated App/index.html to perform direct window.location.href redirection.');
