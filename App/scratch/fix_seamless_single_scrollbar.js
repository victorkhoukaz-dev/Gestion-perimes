const fs = require('fs');

const indexPath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// 1. Désactiver la 2ème barre de défilement sur l'iFrame (scrolling="no", pas de scrollbar interne)
indexHtml = indexHtml.replace(
  '<iframe id="gen-iframe-portal" src="generics_monthly.html" style="width: 100%; height: 85vh; min-height: 750px; border: none; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.15);"></iframe>',
  '<iframe id="gen-iframe-portal" src="generics_monthly.html" scrolling="no" style="width: 100%; border: none; overflow: hidden; min-height: 2800px;"></iframe>'
);

// 2. Injecter un petit script simple pour ajuster la hauteur une seule fois au chargement sans boucle
const seamlessHeightScript = `<script>
  // Ajuster la hauteur de l'iFrame une seule fois pour éliminer la 2ème barre de défilement
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SET_SINGLE_SCROLLBAR_HEIGHT' && event.data.height) {
      const iframe = document.getElementById('gen-iframe-portal');
      if (iframe) {
        iframe.style.height = (event.data.height + 40) + 'px';
      }
    }
  });
</script>`;

if (!indexHtml.includes('SET_SINGLE_SCROLLBAR_HEIGHT')) {
  indexHtml = indexHtml.replace('</head>', `${seamlessHeightScript}\n</head>`);
}

fs.writeFileSync(indexPath, indexHtml);
console.log('Updated index.html to enforce single main window scrollbar.');

// 3. Injecter l'émetteur de hauteur unique (sans boucle ResizeObserver) dans generics_monthly.html et generics_annual.html
const singleHeightSenderScript = `<script>
  function notifyParentHeightOnce() {
    try {
      const h = Math.max(
        document.body ? document.body.scrollHeight : 0,
        document.documentElement ? document.documentElement.scrollHeight : 0,
        2800
      );
      window.parent.postMessage({ type: 'SET_SINGLE_SCROLLBAR_HEIGHT', height: h }, '*');
    } catch(e) {}
  }

  window.addEventListener('load', () => {
    setTimeout(notifyParentHeightOnce, 300);
    setTimeout(notifyParentHeightOnce, 1000);
  });
</script>`;

['generics_monthly.html', 'generics_annual.html'].forEach(filename => {
  const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/' + filename;
  let html = fs.readFileSync(filePath, 'utf8');

  if (!html.includes('SET_SINGLE_SCROLLBAR_HEIGHT')) {
    html = html.replace('</head>', `${singleHeightSenderScript}\n</head>`);
    fs.writeFileSync(filePath, html);
    console.log(`Injected single height notifier into ${filename}`);
  }
});
