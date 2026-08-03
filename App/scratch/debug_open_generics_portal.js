const fs = require('fs');

const indexPath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/index.html';
const html = fs.readFileSync(indexPath, 'utf8');

const openGenIdx = html.indexOf('function openGenericsModule');
console.log('--- openGenericsModule definition ---');
console.log(html.substring(openGenIdx, openGenIdx + 500));

const wrapperIdx = html.indexOf('id="module-generics-wrapper"');
console.log('\n--- module-generics-wrapper HTML ---');
console.log(html.substring(wrapperIdx - 50, wrapperIdx + 300));
