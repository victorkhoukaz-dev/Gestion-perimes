const fs = require('fs');

['generics_monthly.html', 'generics_annual.html'].forEach(filename => {
  const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/' + filename;
  let html = fs.readFileSync(filePath, 'utf8');

  // Injecter l'appel window.syncGenericsDataToCloud(rawData) au tout début de saveAndRefreshDashboard
  if (!html.includes('window.syncGenericsDataToCloud(rawData)')) {
    html = html.replace(
      'function saveAndRefreshDashboard() {',
      'function saveAndRefreshDashboard() {\n            if (typeof window.syncGenericsDataToCloud === "function") window.syncGenericsDataToCloud(rawData);'
    );
    fs.writeFileSync(filePath, html);
    console.log(`Injected sync call into saveAndRefreshDashboard for ${filename}`);
  }
});
