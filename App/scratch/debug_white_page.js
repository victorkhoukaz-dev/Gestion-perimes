const fs = require('fs');

const html = fs.readFileSync('C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/generics_monthly.html', 'utf8');

// Extraire tous les scripts et vérifier s'il y a une erreur d'exécution ou si rawData pose problème à l'initialisation
const scripts = html.match(/<script[\s\S]*?<\/script>/gi) || [];

console.log(`Total script tags in generics_monthly.html: ${scripts.length}`);

scripts.forEach((s, i) => {
  console.log(`Checking script ${i}...`);
  const code = s.replace(/<\/?script[^>]*>/gi, '');
  try {
    // Tester avec un environnement fictif léger
    const fakeWindow = { addEventListener: () => {}, localStorage: { getItem: () => null, setItem: () => {} } };
    new Function('window', 'document', 'localStorage', code)(fakeWindow, {}, fakeWindow.localStorage);
    console.log(`Script ${i} executed without syntax error.`);
  } catch(e) {
    console.error(`RUNTIME/SYNTAX ERROR IN SCRIPT ${i}:`, e.stack || e.message);
  }
});
