# Consignes pour les agents — PharmaOps

## Langue obligatoire du produit

**PharmaOps est une application en français. Toute nouvelle fonctionnalité et toute modification de contenu destiné aux utilisateurs doivent être en français.**

Cette règle couvre notamment les menus, onglets, boutons, champs, exemples de saisie, infobulles, libellés accessibles, tutoriels, confirmations, messages de validation et d’erreur, états de chargement ou d’enregistrement, rapports imprimés, PDF et autres documents générés par l’application. Utiliser les conventions du français canadien pour les dates et les nombres lorsque cela convient.

Ne pas ajouter de version anglaise, de sélecteur de langue ou de nouveaux textes anglais sans demande explicite de l’utilisateur. Traduire le texte visible sans renommer inutilement les identifiants techniques, clés de stockage, valeurs de données existantes, tables ou fonctions. Préserver les noms des médicaments et les autres données saisies/importées.

Les explications, plans, comptes rendus et réponses de l’agent dans la conversation restent **en anglais**, selon la préférence de l’utilisateur. Cette distinction ne change pas la langue française de l’interface.

## Collaboration et autorisations

- L’utilisateur débute en programmation : procéder par petites étapes vérifiables et expliquer simplement les choix importants avant de modifier l’architecture.
- Après chaque étape, expliquer ce qui a changé, comment le vérifier et ce qu’il faut retenir.
- Ne jamais supprimer de données, publier le projet ou engager de frais sans autorisation. Une autorisation explicite déjà donnée pour l’action en cours reste valable.
- Éviter les dépendances inutiles. Conserver HTML, JavaScript natif et CSS, sans ajouter de bundler ni de framework lourd sans demande explicite.

## Architecture et protection des données

- Application PWA dans `App/`, avec Supabase et isolation des pharmacies par `pharmacy_id` et RLS.
- Respecter les règles de `supabase/README.md`. Enregistrer toute modification du schéma dans une nouvelle migration ; ne jamais réexécuter une ancienne migration.
- Ne pas exposer de clé secrète ou de clé `service_role` dans le navigateur.
- Préserver les rapports existants, les copies de récupération et les associations UPC/DIN.
- Ne pas casser le flux de saisie : scan UPC ou 2D, remplissage du produit, lot et péremption lorsque disponibles, focus sur la quantité, puis touche Entrée pour enregistrer et reprendre la saisie. Conserver plusieurs UPC par DIN.

## Vérifications avant validation et commit

Une erreur dans le JavaScript intégré à `App/index.html` peut bloquer toute l’application. Vérifier sa syntaxe après modification et avant commit :

```powershell
node -e "const fs = require('fs'); const html = fs.readFileSync('./App/index.html', 'utf8'); const scripts = html.match(/<script[\s\S]*?<\/script>/gi) || []; scripts.forEach((s) => { const code = s.replace(/<\/?script[^>]*>/gi, ''); new Function(code); }); console.log('Syntaxe JavaScript OK');"
```

- Vérifier aussi les modules JavaScript modifiés et exécuter les tests pertinents pour le changement.
- Toute modification de HTML, CSS ou JavaScript statique sous `App/` exige d’incrémenter `CACHE_NAME` dans `App/sw.js` pour permettre la mise à jour des appareils.
- Vérifier la branche et l’état Git avant toute opération. Pour les ajustements actuellement destinés au site publié, travailler sur `main` ; transférer les changements vers `integration` selon les instructions de l’utilisateur, sans publier prématurément les fonctionnalités propres à integration.
- Lors d’une traduction, vérifier également les confirmations, les erreurs, les listes d’unités, l’impression et la compatibilité des rapports déjà enregistrés.
