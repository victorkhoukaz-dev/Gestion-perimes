const fs = require('fs');

['generics_monthly.html', 'generics_annual.html'].forEach(filename => {
  const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/' + filename;
  let html = fs.readFileSync(filePath, 'utf8');

  // Définition globale pure au tout début du <head>
  const globalHelper = `<script>
  function getEmptyRawData() {
    return {
      totals: { "2022": 0, "2023": 0, "2024": 0, "2025": 0, "2026": 0 },
      years: [2022, 2023, 2024, 2025, 2026],
      manufacturers: [],
      monthly_2026: {}
    };
  }
</script>`;

  // Retirer toute déclaration en doublon de getEmptyRawData dans le head si présente
  if (!html.includes('function getEmptyRawData()') || html.indexOf('function getEmptyRawData()') > html.indexOf('let rawData =')) {
    html = html.replace('<head>', `<head>\n${globalHelper}`);
  }

  fs.writeFileSync(filePath, html);
  console.log(`Ensured global getEmptyRawData in head for ${filename}`);
});
