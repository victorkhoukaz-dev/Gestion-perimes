const fs = require('fs');

// 1. Mettre à jour index.html avec le récepteur de message pour redimensionner l'iframe dynamiquement
const indexPath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// Ajuster les attributs de l'iframe dans index.html pour autoriser la hauteur dynamique et le défilement
indexHtml = indexHtml.replace(
  'style="width: 100%; height: 920px; border: none; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.15);"',
  'style="width: 100%; min-height: 1200px; border: none; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.15);"'
);

const resizeListenerScript = `<script>
  // Écouteur de redimensionnement dynamique de l'iFrame du module génériques
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'RESIZE_GENERICS_IFRAME' && event.data.height) {
      const iframe = document.getElementById('gen-iframe-portal');
      if (iframe) {
        iframe.style.height = (event.data.height + 60) + 'px';
      }
    }
  });
</script>`;

if (!indexHtml.includes('RESIZE_GENERICS_IFRAME')) {
  indexHtml = indexHtml.replace('</head>', `${resizeListenerScript}\n</head>`);
}

fs.writeFileSync(indexPath, indexHtml);
console.log('Updated index.html with dynamic iframe height listener.');

// 2. Injecter l'émetteur de hauteur auto-resizing dans generics_monthly.html et generics_annual.html
const heightSenderScript = `<script>
  function sendHeightToParent() {
    try {
      const body = document.body;
      const html = document.documentElement;
      const height = Math.max(
        body ? body.scrollHeight : 0,
        body ? body.offsetHeight : 0,
        html ? html.clientHeight : 0,
        html ? html.scrollHeight : 0,
        html ? html.offsetHeight : 0,
        1800
      );
      window.parent.postMessage({ type: 'RESIZE_GENERICS_IFRAME', height: height }, '*');
    } catch(e) {}
  }

  window.addEventListener('load', () => {
    setTimeout(sendHeightToParent, 200);
    setTimeout(sendHeightToParent, 600);
    setTimeout(sendHeightToParent, 1200);
  });

  window.addEventListener('resize', sendHeightToParent);

  if (window.ResizeObserver && document.body) {
    new ResizeObserver(sendHeightToParent).observe(document.body);
  }
</script>`;

['generics_monthly.html', 'generics_annual.html'].forEach(filename => {
  const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/' + filename;
  let html = fs.readFileSync(filePath, 'utf8');

  if (!html.includes('RESIZE_GENERICS_IFRAME')) {
    html = html.replace('</head>', `${heightSenderScript}\n</head>`);
    fs.writeFileSync(filePath, html);
    console.log(`Injected auto-resizing height sender into ${filename}`);
  }
});
