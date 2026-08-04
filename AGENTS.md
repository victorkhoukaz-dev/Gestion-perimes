# 🤖 AI AGENT INSTRUCTIONS (AGENTS.md)

> **IMPORTANT FOR ALL AI AGENTS (Antigravity, ChatGPT Codex, Claude, Cursor, etc.)**: 
> Read this document before making any changes to this codebase. It contains critical instructions, syntax validation scripts, architecture rules, and conventions for the **Gestion des Expirés (PharmaOps)** project.

---

## 📌 1. ESSENCE DU PROJET

**Gestion des Expirés (PharmaOps)** est une application Web & Mobile Progressive (PWA) de gestion des péremptions et retraits mensuels de médicaments pour pharmacies d'officine (laboratoires, réserves et tablettes).
* **Architecture** : HTML5 / Vanilla JS / Material Design 3 CSS + Cloud Supabase (RLS multi-tenant) + Local-First / PWA.
* **Fonctionnalités clés** :
  1. Tournée de saisie par scan de code-barres (UPC / Datamatrix 2D) et DIN.
  2. Auto-remplissage et association intelligente UPC ↔ DIN au vol.
  3. Suivi collaboratif en temps réel de l'avancement par section (checklists & pastilles 12 mois).
  4. Tableau de bord de retrait mensuel & impression de fiches de retrait officielles.
  5. Module d'analyse des achats de médicaments génériques (`App/js/modules/generics.js`).

---

## ⚠️ 2. RÈGLES D'OR & RÈGLES DU CODEBASE

### 🔴 Règle 1 : Validation Syntaxe JS Obligatoire (Avant tout commit / modification)
Le fichier `App/index.html` contient une grande partie de la logique JavaScript en ligne. **Une seule erreur de syntaxe JS (accolade ou virgule manquante) casse TOUS les event listeners et fige l'application sur la page de connexion.**

👉 **Avant de valider une modification sur `App/index.html`, vous DEVEZ exécuter cette commande Node.js pour vérifier la syntaxe :**

```powershell
node -e "const fs = require('fs'); const html = fs.readFileSync('./App/index.html', 'utf8'); const scripts = html.match(/<script[\s\S]*?<\/script>/gi) || []; scripts.forEach((s, i) => { const code = s.replace(/<\/?script[^>]*>/gi, ''); try { new Function(code); } catch(e) { console.error('Erreur syntaxe JS:', e.message); process.exit(1); } }); console.log('Syntaxe 100% OK');"
```

### 🔴 Règle 2 : Invalidation du Cache PWA (`App/sw.js`)
L'application est une PWA avec un Service Worker. Dès que vous modifiez du code HTML, CSS ou JS statique dans `App/`, **vous devez incrémenter la version de `CACHE_NAME`** dans `App/sw.js` (ex: passer de `v3.8` à `v3.9`) afin que les appareils mobiles et tablettes téléchargent la nouvelle version.

### 🔴 Règle 3 : Respect du Multi-UPC et du Flux de Saisie
Ne cassez jamais le comportement de saisie :
- Scan d'un code UPC ➔ auto-remplissage du DIN, nom, dosage et format.
- Focus automatique immédiatement transféré sur le champ **Quantité**.
- Touche `Entrée` dans le champ Quantité ➔ enregistrement direct et retour au champ code-barres sans clic de souris.
- Support du multi-UPC par DIN (plusieurs emballages pour un même médicament).

### 🔴 Règle 4 : Architecture Sans Build Heavy
L'application fonctionne en exécutant directement `App/index.html` dans un navigateur ou via un petit serveur local (`python serve.py` / `lancer_local.bat`). **Ne pas ajouter de bundler lourd (Vite, Webpack, React, Next.js) sans demande explicite de l'utilisateur.**

### 🔴 Règle 5 : Respect du Multi-Tenant et RLS Supabase
Chaque pharmacie possède son propre `pharmacy_id`. Toutes les requêtes vers Supabase doivent intégrer la sécurité RLS (Row Level Security). Référez-vous aux scripts `supabase_setup_rls_v2.sql`.

---

## 🛠️ 3. COMMANDES UTILES DU PROJET

* **Lancer le serveur local** : `powershell ./serve.ps1` ou exécuter `lancer_local.bat` (Port 8080).
* **Accès réseau local / mobile** : `powershell ./lancer_mobile.ps1`.
* **Vérification de la syntaxe JS** :
  ```powershell
  node -e "const fs = require('fs'); const html = fs.readFileSync('./App/index.html', 'utf8'); const scripts = html.match(/<script[\s\S]*?<\/script>/gi) || []; scripts.forEach((s, i) => { const code = s.replace(/<\/?script[^>]*>/gi, ''); try { new Function(code); } catch(e) { console.error('Erreur syntaxe JS:', e.message); process.exit(1); } }); console.log('Syntaxe 100% OK');"
  ```

---

## 📂 4. STRUCTURE DES FICHIERS CLÉS

```text
Procédure expirés/
├── AGENTS.md                          # Ce fichier d'instructions pour les agents IA
├── PROJECT.md                         # Spécification technique complète & schéma du projet
├── README.md                          # Guide de démarrage et documentation utilisateur
├── GUIDE_UTILISATION.md               # Guide opérationnel pour l'équipe en pharmacie
├── lancer_local.bat                   # Raccourci de lancement local (PC)
├── serve.ps1 / serve.py               # Serveur HTTP local léger (port 8080)
├── supabase_setup_rls_v2.sql          # Scripts SQL Supabase (tables, RLS & rôles)
└── App/                               # Code source principal de l'application
    ├── index.html                     # Application UI, structure & scripts principaux
    ├── manifest.json                  # Déclaration PWA
    ├── sw.js                          # Service Worker (gestion du cache hors-ligne)
    ├── globals.css / dashboard.css    # Styles Material Design 3
    └── js/
        ├── core/db.js / logger.js     # Logger et couche de base de données
        └── modules/generics.js        # Module d'analyse des achats génériques (Chart.js)
```
