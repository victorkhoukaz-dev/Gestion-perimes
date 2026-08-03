const fs = require('fs');

const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/generics_portal.html';
let html = fs.readFileSync(filePath, 'utf8');

html = html.replace("Données d'achats", "Données d\\'achats");
fs.writeFileSync(filePath, html);

console.log('Fixed string escaping in App/generics_portal.html.');
