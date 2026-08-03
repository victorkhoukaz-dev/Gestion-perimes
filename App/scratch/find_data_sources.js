const fs = require('fs');
const path = require('path');

const appDir = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App';

function searchDirectory(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDirectory(fullPath);
    } else if (file.endsWith('.html') || file.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('1782542') || content.includes('1328761') || content.includes('1163752')) {
        console.log(`FOUND SAMPLE NUMBERS IN FILE: ${file}`);
      }
    }
  });
}

searchDirectory(appDir);
