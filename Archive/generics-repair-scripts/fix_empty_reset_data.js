const fs = require('fs');

['generics_monthly.html', 'generics_annual.html'].forEach(filename => {
  const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/' + filename;
  let html = fs.readFileSync(filePath, 'utf8');

  // 1. Remplacer la définition de defaultRawData par getEmptyRawData()
  html = html.replace(
    'const defaultRawData = JSON.parse(JSON.stringify(rawData));',
    'const defaultRawData = getEmptyRawData();'
  );

  // 2. Mettre à jour resetDataBtn pour vider vers getEmptyRawData() et synchroniser Cloud + Local
  html = html.replace(
    'rawData = JSON.parse(JSON.stringify(defaultRawData));',
    'rawData = getEmptyRawData(); if (typeof window.syncGenericsDataToCloud === "function") window.syncGenericsDataToCloud(rawData);'
  );

  // 3. Mettre à jour clearAllDataBtn pour vider vers getEmptyRawData() et synchroniser Cloud + Local
  html = html.replace(
    /rawData\s*=\s*\{\s*totals:[\s\S]*?manufacturers:\s*\[\]\s*\};/,
    'rawData = getEmptyRawData(); if (typeof window.syncGenericsDataToCloud === "function") window.syncGenericsDataToCloud(rawData);'
  );

  fs.writeFileSync(filePath, html);
  console.log(`Updated clean reset and clear logic in ${filename}`);
});
