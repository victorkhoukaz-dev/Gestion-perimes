const fs = require('fs');

const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/index.html';
let html = fs.readFileSync(filePath, 'utf8');

// 1. Mettre à jour l'événement du hub-card-generics pour appeler openGenericsModule()
html = html.replace(
  `document.getElementById("hub-card-generics")?.addEventListener("click", () => {\n        showToast("Ouverture de l'Analyse Génériques...", "info");\n        showGenericsModulePreview();\n      });`,
  `document.getElementById("hub-card-generics")?.addEventListener("click", () => {\n        showToast("Ouverture de l'Analyse Génériques...", "info");\n        openGenericsModule();\n      });`
);

// 2. Mettre à jour l'événement du menu-mod-generics pour appeler openGenericsModule()
html = html.replace(
  `document.getElementById("menu-mod-generics")?.addEventListener("click", (e) => {\n        e.preventDefault();\n        if (menu) menu.style.display = "none";\n        showToast("Ouverture de l'Analyse Génériques...", "info");\n        showGenericsModulePreview();\n      });`,
  `document.getElementById("menu-mod-generics")?.addEventListener("click", (e) => {\n        e.preventDefault();\n        if (menu) menu.style.display = "none";\n        showToast("Ouverture de l'Analyse Génériques...", "info");\n        openGenericsModule();\n      });`
);

// 3. S'assurer que openGenericsModule s'ouvre sans être bloqué par une vérification de preview
const oldOpenFunc = `function openGenericsModule() {
      const isOwner = sessionProfile && (sessionProfile.role === "owner" || sessionProfile.role === "admin");
      if (!isOwner) {
        showGenericsModulePreview();
        return;
      }`;

const newOpenFunc = `function openGenericsModule() {`;

if (html.includes(oldOpenFunc)) {
  html = html.replace(oldOpenFunc, newOpenFunc);
}

fs.writeFileSync(filePath, html);
console.log('Successfully updated App/index.html to open generics module directly.');
