# Règle de Projet : Vérification Syntaxe JS & Diagnostic Connexion

## 1. Validation de Syntaxe Obligatoire
Avant chaque commit/push de modifications sur `App/index.html` :
- Exécuter la commande Node.js pour valider la syntaxe :
  ```powershell
  node -e "const fs = require('fs'); const html = fs.readFileSync('./App/index.html', 'utf8'); const scripts = html.match(/<script[\s\S]*?<\/script>/gi) || []; scripts.forEach((s, i) => { const code = s.replace(/<\/?script[^>]*>/gi, ''); try { new Function(code); } catch(e) { console.error('Erreur syntaxe JS:', e.message); process.exit(1); } }); console.log('Syntaxe 100% OK');"
  ```

## 2. Guide de Réparation ("Aucun bouton ne marche")
Si les boutons du login ne réagissent pas :
1. **Étape A** : Tester la syntaxe JS avec Node.js (détecte les accolades manquantes).
2. **Étape B** : Vérifier que la politique RLS Supabase `profiles_select_own` (`id = auth.uid()`) est active.
3. **Étape C** : Incrémenter `CACHE_NAME` dans `sw.js` pour forcer la mise à jour PWA.
