# Archives des scripts de réparation des génériques

Ces 49 scripts historiques ont été déplacés de `App/scratch/` pendant la préparation de la fusion d’`integration` vers `main`. Ils sont conservés pour référence, à l’extérieur du dossier de l’application.

Aucune référence à ces scripts n’a été trouvée dans le code actif de l’application. Ils ne sont pas nécessaires au fonctionnement des tableaux de bord.

**Ne pas les exécuter pour réparer la version actuelle.** Plusieurs réécrivent des fichiers HTML et utilisent des chemins absolus ou des versions anciennes de l’application. Le déplacement préserve leur contenu et ne les adapte pas au projet actuel.

Les tests actuels restent dans `scratch/`, à la racine du projet :

```powershell
node scratch/check_generics_name_review.cjs
node --test scratch/test_generics_session.cjs scratch/test_generics_name_review.cjs
python scratch/test_generics_session_browser.py
```

Le test de navigateur utilise Chrome installé sur le poste, des comptes fictifs et des services simulés. Il ne se connecte pas à la base de production.

Cette archive reste dans le dépôt. GitHub Pages publie actuellement la racine de `main`. Le fichier `_config.yml` préparé pendant le nettoyage exclut `Archive/` et les autres dossiers internes de la prochaine publication, tout en préservant les URL sous `/App/`. Vérifier ces exclusions après une publication autorisée. Elles ne rendent pas privée l’archive dans le dépôt GitHub public.
