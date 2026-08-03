const fs = require('fs');

const monthlyContent = fs.readFileSync('C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/generics_monthly.html', 'utf8');
const annualContent = fs.readFileSync('C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/generics_annual.html', 'utf8');

console.log('Monthly bytes:', monthlyContent.length);
console.log('Annual bytes:', annualContent.length);

// Trouver toutes les fonctions appelées au chargement dans monthly
const scriptBlocks = monthlyContent.match(/<script[\s\S]*?<\/script>/gi) || [];

console.log('Script count in monthly:', scriptBlocks.length);

scriptBlocks.forEach((block, idx) => {
  const code = block.replace(/<\/?script[^>]*>/gi, '');
  console.log(`\n--- Monthly Script Block ${idx} (length: ${code.length}) ---`);
  // Vérifier si des variables globales requises manquent
  if (code.includes('saveAndRefreshDashboard')) console.log('  -> Contains saveAndRefreshDashboard');
  if (code.includes('initKpis')) console.log('  -> Contains initKpis');
  if (code.includes('renderAll')) console.log('  -> Contains renderAll');
});
