const fs = require('fs');

const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/index.html';
let content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');

for (let i = 4890; i < 4910; i++) {
  if (lines[i] && lines[i].includes('showGenericsModulePreview()')) {
    lines[i] = lines[i].replace('showGenericsModulePreview()', 'openGenericsModule()');
    console.log('Replaced line ' + (i+1));
  }
}

fs.writeFileSync(filePath, lines.join('\n'));
