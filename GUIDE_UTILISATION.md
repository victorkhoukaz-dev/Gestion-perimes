# Guide d'utilisation - Gestion des Expirés de Laboratoire (V3.6)

Félicitations ! Votre application de gestion des expirés a été mise à jour en version V3.6 avec l'intégration d'un **Suivi de l'avancement par section** (checklist de tournée collaborative) et l'harmonisation de l'ergonomie.

Ce document vous explique comment l'utiliser au quotidien pour vos tournées de saisie et vos retraits mensuels.

---

## 🚀 Comment lancer l'application ?

C'est extrêmement simple :
1. Allez dans le dossier `Procédure expirés` sur votre ordinateur.
2. Double-cliquez sur le fichier **`index.html`**.
3. Saisissez vos identifiants ou créez un compte (si vous utilisez le module Cloud Supabase).
4. **Une connexion internet est requise** uniquement pour la synchronisation Cloud.

---

## 💾 Comment sont sauvegardées les données ?

* **Sauvegarde Automatique Cloud** : Toutes vos données sont synchronisées en temps réel de manière sécurisée sur votre base de données en ligne Supabase. En cas de changement d'ordinateur ou de panne, il vous suffit de vous connecter à votre compte sur le nouveau poste pour retrouver instantanément votre inventaire, vos sections et vos pastilles colorées.
* **Préchargement Automatique pour les Inscriptions** : Lors de la création d'un nouveau compte pharmacie, le système clone automatiquement en arrière-plan le catalogue d'auto-complétion de référence. La pharmacie démarre ainsi immédiatement avec une base de données de milliers de produits préconfigurés (incluant les codes-barres associés), sans devoir importer de fichier au départ.
* **Sauvegarde et partage de fichier (JSON)** : Dans l'onglet **Configuration** :
  * Cliquez sur **Exporter Sauvegarde (fichier .json)** pour télécharger un fichier contenant toutes vos données (produits, configurations et avancement des sections).
  * Pour importer ou fusionner le travail de plusieurs techniciens, cliquez sur **Importer Sauvegarde (fichier .json)**. Vous pouvez choisir de **fusionner** (combiner les deux listes intelligemment) ou d'**écraser** (remplacer).
* **Exportation Excel (CSV)** : Vous pouvez exporter vos données sous forme de fichier CSV, directement compatible avec Microsoft Excel.

---

## 🛠️ Utilisation des Différents Onglets

### 1. 📋 Retrait Mensuel (Dashboard)
Cet onglet est votre guide pour les retraits en début de mois :
* Il affiche la liste de tous les produits actifs (présents sur les tablettes) dont la date d'expiration correspond au mois sélectionné.
* **Classement par Section** : Les produits sont regroupés par section (ex: *LIQUIDE*, *MAGISTRAL*).
* **Boutons d'Action Rapide** : Clic rapide sur ✅ **Retirer** ou 📦 **Vendu**.
* **Session Rapide** : Saisissez vos initiales dans le volet de droite pour désactiver les demandes de confirmation et travailler à la chaîne.
* **Impression Pro** : Cliquez sur **Imprimer la fiche** pour obtenir une feuille de retrait papier impeccable avec des lignes de signature au bas de la page.

### 2. ➕ Saisie / Tournée
Cet onglet vous assiste lors de la tournée générale du laboratoire :
* **Saisie unique (DIN / UPC / Scanner)** : Placez votre curseur dans le champ *DIN ou code UPC*. Vous pouvez :
  * Taper un DIN (8 chiffres).
  * Taper un UPC (12-14 chiffres).
  * **Scanner directement le code-barres de la boîte** avec votre lecteur physique (scanner).
* **Détection & Remplissage automatique** : Si le code scanné ou saisi est connu, le formulaire (Nom, Dosage, Format) se remplit instantanément et le focus se déplace automatiquement sur la **Quantité**. Vous n'avez qu'à entrer le chiffre de quantité et appuyer sur Entrée !
* **Association intelligente au vol (UPC inconnu)** : Si le code-barres scanné est inconnu dans le catalogue :
  1. L'application affiche une alerte rouge demandant de saisir le DIN du produit pour l'associer.
  2. Le champ DIN est vidé : vous restez dans la même case et tapez le DIN connu du produit.
  3. L'application trouve le produit par le DIN et le remplit. Un bandeau vert confirme que l'association est planifiée.
  4. Lorsque vous cliquez sur **Enregistrer le produit**, le système enregistre le produit ET crée automatiquement une **association permanente** entre ce code-barres et ce DIN dans le catalogue. L'association s'enregistre de manière permanente. Lors du prochain scan, il sera reconnu immédiatement !
* **Bouton d'annulation d'association** : Si vous scannez un code-barres inconnu par erreur, cliquez sur le bouton rouge *[Annuler l'association]* ou sur *[Effacer la sélection]* (pour les produits connus) sous le champ de saisie pour réinitialiser le formulaire.
* **Multi-UPC par DIN** : Plusieurs codes-barres distincts (par exemple un pour la bouteille de 100 comprimés et un autre pour celle de 500) peuvent être liés au même DIN. L'application chargera le format de conditionnement exact correspondant à l'UPC scanné.
* **Suivi de l'avancement par section (Nouveau)** : Dans le panneau latéral de droite, un module « Suivi des Sections » vous indique en temps réel où vous en êtes pour la tournée en cours (3 ou 6 mois) :
  * 🔴 **Non entamée** : Aucun produit n'a encore été saisi pour cette tournée dans cette section.
  * 🟡 **En cours** : Affiche le nombre de produits actifs déjà enregistrés dans la section (ex: `(12)`).
  * 🟢 **Complétée** : Cochez manuellement la case pour marquer la section comme terminée. La barre de progression et le pourcentage global d'avancement se mettront à jour pour l'ensemble du laboratoire (synchronisé en temps réel avec tous les ordinateurs connectés).
* **Mémorisation de Section** : Le menu déroulant conserve la section active après chaque enregistrement.
* **Derniers produits saisis** : Affiche les 20 derniers produits enregistrés avec un bouton de pliage/dépliage et des boutons d'édition (crayon bleu) et suppression rapide.

### 3. 🔍 Inventaire & Recherche
Cet onglet regroupe la totalité de l'historique et vous donne accès au catalogue complet :
* **Double Source de Données** : Basculez entre *Produits signalés (Expirations)* et *Catalogue complet (Base de données)*.
* **Séparation Dosage/Format** : Présentés dans deux colonnes distinctes.
* **Recherche Globale par UPC/Code-barres** : Vous pouvez rechercher des produits en tapant ou en scannant un code UPC directement dans la case de recherche de l'inventaire.
* **Raccourci de Signalement Rapide** : En mode catalogue, cliquez sur **`➕ Signaler`** d'un produit pour charger son DIN, son Nom, son Dosage et son Format dans la saisie, basculer d'onglet et positionner le curseur sur la *Quantité*.

### 4. ⚙️ Configuration
Cet onglet vous permet de configurer l'outil pour vos besoins spécifiques :
* **Importation du fichier d'inventaire** : Chargez un fichier CSV exporté de votre système informatique de pharmacie.
* **Association des codes UPC aux DIN** : Chargez un fichier CSV contenant à la fois UPC et DIN pour populer en masse votre catalogue existant.
* **Gestion des Sections** : Ajoutez, retirez ou renommez des sections de laboratoire.
* **Configuration des pastilles** : Ajustez la couleur et le nom des stickers pour chacun des 12 mois.
* **Réactiver le Tutoriel** : Si vous avez coché par le passé *« Ne plus afficher ce tutoriel au démarrage »* et souhaitez revoir la popup de démarrage, cliquez sur ce bouton pour réinitialiser cette préférence.

### 5. 📖 Guide & Tutoriel
Cet onglet interactif regroupe de manière permanente :
* Un résumé visuel et interactif de toute la procédure opérationnelle.
* Des sections dépliables (accordéons) pour consulter rapidement les instructions d'utilisation de la tournée de saisie, du retrait mensuel, ou du scan au scanner et de l'import CSV.
