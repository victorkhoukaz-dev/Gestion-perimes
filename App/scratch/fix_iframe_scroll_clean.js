const fs = require('fs');

const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/index.html';
let html = fs.readFileSync(filePath, 'utf8');

const oldIframe = '<iframe id="gen-iframe-portal" src="generics_monthly.html" scrolling="no" style="width: 100%; height: 920px; border: none; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.15);"></iframe>';

const cleanIframe = '<iframe id="gen-iframe-portal" src="generics_monthly.html" style="width: 100%; height: 85vh; min-height: 750px; border: none; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.15);"></iframe>';

if (html.includes(oldIframe)) {
  html = html.replace(oldIframe, cleanIframe);
  fs.writeFileSync(filePath, html);
  console.log('Successfully updated iframe with clean 85vh height and enabled scrolling.');
} else {
  console.log('Old iframe tag pattern not found exact match.');
}
