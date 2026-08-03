const fs = require('fs');

['generics_monthly.html', 'generics_annual.html'].forEach(filename => {
  const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/' + filename;
  let html = fs.readFileSync(filePath, 'utf8');

  // Retirer les définitions IIFE fermées de getEmptyRawData
  html = html.replaceAll('function getEmptyRawData()', 'window.getEmptyRawData = function()');

  // Définir la fonction getEmptyRawData globale tout en haut du head
  const headGlobalDefinition = `<script>
  window.getEmptyRawData = function() {
    return {
      totals: { "2022": 0, "2023": 0, "2024": 0, "2025": 0, "2026": 0 },
      years: [2022, 2023, 2024, 2025, 2026],
      manufacturers: [],
      monthly_2026: {}
    };
  };
  function getEmptyRawData() {
    return window.getEmptyRawData();
  }
</script>`;

  if (!html.includes('window.getEmptyRawData = function()')) {
    html = html.replace('<head>', `<head>\n${headGlobalDefinition}`);
  } else {
    // S'assurer qu'elle est en tête
    const firstHeadIdx = html.indexOf('<head>');
    html = html.substring(0, firstHeadIdx + 6) + '\n' + headGlobalDefinition + html.substring(firstHeadIdx + 6);
  }

  fs.writeFileSync(filePath, html);
  console.log(`Globalized getEmptyRawData for ${filename}`);
});
