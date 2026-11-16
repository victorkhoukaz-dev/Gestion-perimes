const fs = require('fs');

const emptyRawDataDef = `
  function getEmptyRawData() {
    return {
      totals: { "2022": 0, "2023": 0, "2024": 0, "2025": 0, "2026": 0 },
      years: [2022, 2023, 2024, 2025, 2026],
      manufacturers: [],
      monthly_2026: {}
    };
  }
`;

['generics_monthly.html', 'generics_annual.html'].forEach(filename => {
  const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/' + filename;
  let html = fs.readFileSync(filePath, 'utf8');

  // 1. Remplacer la définition initiale harcodée de rawData par getEmptyRawData()
  const rawDataIdx = html.indexOf('let rawData = {');
  if (rawDataIdx !== -1) {
    const rawDataEnd = html.indexOf('};', rawDataIdx);
    if (rawDataEnd !== -1) {
      html = html.substring(0, rawDataIdx) + 'let rawData = getEmptyRawData();' + html.substring(rawDataEnd + 2);
      console.log(`Replaced hardcoded rawData with empty initial state in ${filename}`);
    }
  }

  // 2. Mettre à jour les boutons de réinitialisation pour vider vers getEmptyRawData()
  html = html.replaceAll(
    "rawData = JSON.parse(JSON.stringify(defaultRawData));",
    "rawData = getEmptyRawData(); if (typeof window.syncGenericsDataToCloud === 'function') window.syncGenericsDataToCloud(rawData);"
  );
  html = html.replaceAll(
    "rawData = { totals: {}, years: [], manufacturers: [] };",
    "rawData = getEmptyRawData(); if (typeof window.syncGenericsDataToCloud === 'function') window.syncGenericsDataToCloud(rawData);"
  );

  fs.writeFileSync(filePath, html);
  console.log(`Updated reset logic in ${filename}`);
});
