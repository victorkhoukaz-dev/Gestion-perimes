const fs = require('fs');

['generics_monthly.html', 'generics_annual.html'].forEach(filename => {
  const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/' + filename;
  let html = fs.readFileSync(filePath, 'utf8');

  html = html.replaceAll("Données d'achats", "Données d\\'achats");
  html = html.replaceAll("d'état", "d\\'état");
  html = html.replaceAll("d'origine", "d\\'origine");
  html = html.replaceAll("l'état", "l\\'état");

  fs.writeFileSync(filePath, html);
  console.log(`Fixed quote escaping in ${filename}`);
});
