const fs = require('fs');

const storageKeyHelper = `
  function getPharmacyStorageKey() {
    const pId = localStorage.getItem('generics_pharmacy_id') || 'guest';
    return 'rawData_monthly_' + pId;
  }
`;

['generics_monthly.html', 'generics_annual.html'].forEach(filename => {
  const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/' + filename;
  let html = fs.readFileSync(filePath, 'utf8');

  // Injecter le helper s'il n'est pas déjà présent
  if (!html.includes('getPharmacyStorageKey')) {
    html = html.replace('function getEmptyRawData() {', `${storageKeyHelper}\n  function getEmptyRawData() {`);
  }

  // Remplacer toutes les occurrences de 'rawData_monthly' par getPharmacyStorageKey()
  html = html.replaceAll("localStorage.getItem('rawData_monthly')", "localStorage.getItem(getPharmacyStorageKey())");
  html = html.replaceAll("localStorage.setItem('rawData_monthly', JSON.stringify(rawData))", "localStorage.setItem(getPharmacyStorageKey(), JSON.stringify(rawData))");
  html = html.replaceAll("localStorage.setItem('rawData_monthly', JSON.stringify(cloudData))", "localStorage.setItem(getPharmacyStorageKey(), JSON.stringify(cloudData))");
  html = html.replaceAll("localStorage.removeItem('rawData_monthly')", "localStorage.removeItem(getPharmacyStorageKey())");

  fs.writeFileSync(filePath, html);
  console.log(`Successfully replaced rawData_monthly with getPharmacyStorageKey() in ${filename}`);
});

// Dans index.html, mettre à jour la déconnexion
const indexPath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');
indexHtml = indexHtml.replaceAll('localStorage.removeItem("rawData_monthly");', 'localStorage.removeItem("generics_pharmacy_id");');
fs.writeFileSync(indexPath, indexHtml);
console.log('Updated logout in index.html.');
