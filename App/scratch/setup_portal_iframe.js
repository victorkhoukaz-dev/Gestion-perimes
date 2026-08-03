const fs = require('fs');

// 1. Ajouter le script de communication de hauteur dans generics_portal.html
const portalPath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/generics_portal.html';
let portalHtml = fs.readFileSync(portalPath, 'utf8');

const resizeScript = `
<script>
  function sendHeight() {
    const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight);
    window.parent.postMessage({ type: 'RESIZE_GENERICS_IFRAME', height: height }, '*');
  }
  window.addEventListener('load', sendHeight);
  window.addEventListener('resize', sendHeight);
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(sendHeight);
    observer.observe(document.body);
  }
  setInterval(sendHeight, 1000);
</script>
`;

if (!portalHtml.includes('RESIZE_GENERICS_IFRAME')) {
  portalHtml = portalHtml.replace('</body>', `${resizeScript}\n</body>`);
  fs.writeFileSync(portalPath, portalHtml);
  console.log('Added auto-resize script to App/generics_portal.html.');
}

// 2. Mettre à jour App/index.html pour contenir uniquement le conteneur iFrame de generics_portal.html
let indexHtml = fs.readFileSync('C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/index.html', 'utf8');

const genericsWrapperMarkup = `
    <!-- CONTENEUR DU MODULE : ANALYSE DES ACHATS GÉNÉRIQUES (PORTAIL UNIFIÉ ÉTANCHE) -->
    <div id="module-generics-wrapper" style="display: none; padding-top: 16px;">
      <iframe id="gen-iframe-portal" src="generics_portal.html" scrolling="no" style="width: 100%; height: 920px; border: none; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.15);"></iframe>
    </div>
`;

// Remplacer l'ancien conteneur s'il existe
const startTag = '<!-- CONTENEUR DU MODULE : ANALYSE DES ACHATS GÉNÉRIQUES';
const startIdx = indexHtml.indexOf(startTag);
const endTag = '<!-- 1. RETRAIT MENSUEL -->';
const endIdx = indexHtml.indexOf(endTag);

if (startIdx !== -1 && endIdx !== -1) {
  indexHtml = indexHtml.substring(0, startIdx) + genericsWrapperMarkup + '\n\n    ' + indexHtml.substring(endIdx);
} else {
  // Remplacer l'élément génériques v4.2
  const oldStart = indexHtml.indexOf('<div id="module-generics-wrapper"');
  const oldEnd = indexHtml.indexOf('</div>\n\n    <!-- 1. RETRAIT MENSUEL -->');
  if (oldStart !== -1 && oldEnd !== -1) {
    indexHtml = indexHtml.substring(0, oldStart) + genericsWrapperMarkup + '\n\n    ' + indexHtml.substring(oldEnd + 6);
  }
}

// Assurer la présence de l'écouteur de hauteur dans index.html
if (!indexHtml.includes('RESIZE_GENERICS_IFRAME')) {
  const iframeResizeListener = `
  <script>
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'RESIZE_GENERICS_IFRAME' && e.data.height) {
        const portalFrame = document.getElementById('gen-iframe-portal');
        if (portalFrame) {
          portalFrame.style.height = (e.data.height + 30) + 'px';
        }
      }
    });
  </script>
  `;
  indexHtml = indexHtml.replace('</body>', `${iframeResizeListener}\n</body>`);
}

fs.writeFileSync('C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/index.html', indexHtml);
console.log('Successfully updated App/index.html with generics_portal.html wrapper.');
