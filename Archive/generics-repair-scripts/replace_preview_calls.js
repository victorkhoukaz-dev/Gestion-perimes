const fs = require('fs');

const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/index.html';
let html = fs.readFileSync(filePath, 'utf8');

// Replace all calls to showGenericsModulePreview() inside event listeners with openGenericsModule()
let replacedCount = 0;
html = html.replace(/showGenericsModulePreview\(\);/g, (match, offset) => {
  // Replace calls inside event listeners, but keep the function definition itself
  const preceding = html.substring(offset - 200, offset);
  if (preceding.includes('hub-card-generics') || preceding.includes('menu-mod-generics')) {
    replacedCount++;
    return 'openGenericsModule();';
  }
  return match;
});

fs.writeFileSync(filePath, html);
console.log(`Replaced ${replacedCount} calls to showGenericsModulePreview with openGenericsModule.`);
