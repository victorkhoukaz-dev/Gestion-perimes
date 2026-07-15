# Plan d'implémentation - Migration vers Supabase (Cloud & Multi-Pharmacie)

Ce document décrit le plan pour faire évoluer l'application **Gestion des Expirés de Laboratoire** d'un fonctionnement 100% local à une application Cloud sécurisée avec **Supabase**. 

Ce plan met un accent particulier sur la **sécurité des données**, la **conservation de vos données actuelles**, et la **gestion multi-pharmacie** (commercialisation).

---

## 🔒 Sécurité et Conservation des Données Actuelles

> [!IMPORTANT]
> **ZÉRO PERTE DE DONNÉES :** Votre travail actuel ne sera pas perdu. Nous utiliserons votre sauvegarde locale pour alimenter votre compte en ligne lors de la première connexion. Votre fichier de sauvegarde JSON (`expires_database_backup_2026-07-08.json`) servira également de filet de sécurité absolu.

---

## 🏢 Fonctionnement Multi-Pharmacie (SaaS)

Pour permettre à chaque pharmacie d'utiliser son propre inventaire, l'architecture sera configurée en "Multi-Locataire" (*Multi-Tenant*) :
1. **Création de Compte :** Chaque pharmacie possède un identifiant unique (`pharmacy_id`).
2. **Importation du Catalogue :** Dans son propre portail, la Pharmacie B importe son fichier CSV. Les suggestions d'auto-complétion de la Pharmacie B proviendront uniquement de son propre fichier CSV.
3. **Isolation des Données :** Grâce aux règles de sécurité de Supabase (RLS - *Row Level Security*), les techniciens de la Pharmacie A ne peuvent techniquement pas lire ni modifier les données de la Pharmacie B, et vice-versa.

---

## 🗄️ Structure de la Base de Données (Schéma Supabase)

Nous allons créer 5 tables principales sur Supabase :

```mermaid
erDiagram
    PHARMACIES ||--o{ USERS : "emploie"
    PHARMACIES ||--o{ CATALOG : "possede son inventaire"
    PHARMACIES ||--o{ FLAGGED_PRODUCTS : "a des produits expires"
    PHARMACIES ||--|| CONFIGURATIONS : "a des reglages"

    PHARMACIES {
        uuid id PK
        text name "Nom de la pharmacie"
        timestamp created_at
    }
    USERS {
        uuid id PK "Id de connexion Supabase"
        uuid pharmacy_id FK "Référénce la pharmacie"
        text email
        text initials "Initiales (ex: SB)"
        text role "admin / technicien"
    }
    CATALOG {
        bigint id PK
        uuid pharmacy_id FK
        text din "DIN / UPC"
        text product "Nom du produit"
        text dosage
        text format
    }
    FLAGGED_PRODUCTS {
        text id PK "Identifiant unique"
        uuid pharmacy_id FK
        text section "Section (ex: FRIGO)"
        text din
        text product
        text quantity
        text expiry_date "Format AAAA-MM"
        text status "active / removed / sold"
        timestamp date_added
        text tech_initials
        timestamp removal_date
        text removed_by
        text notes
        text dosage
        text format
    }
    CONFIGURATIONS {
        uuid pharmacy_id PK FK
        int expiry_window_months "Ex: 6 mois"
        jsonb sections "Liste des sections configurées"
        jsonb sticker_colors "Couleurs des pastilles par mois"
    }
```

---

## 🛠️ Étapes Proposées pour la Migration

### Étapes d'implémentation des codes-barres (UPC)

1. **Mise à jour du Schéma :** Ajout des colonnes `upc` (text) aux tables `catalog` et `flagged_products`.
2. **Gestion de la Saisie (Scanner) :** 
   - Recherche simultanée sur `din` ou `upc` lors de la saisie.
   - Si l'UPC est inconnu, inviter l'utilisateur à saisir le DIN pour associer le produit.
   - Sauvegarde automatique de l'association `UPC <-> DIN` dans le catalogue pour les prochaines utilisations.
3. **Multiplicité des UPC :** Gestion native de plusieurs lignes dans `catalog` pour un même DIN (permettant de différencier les formats/tailles de conditionnement par code-barres unique).

### Étape 1 : Configuration de Supabase (Dans votre compte)
1. Création d'un nouveau projet sur Supabase hébergé au **Canada (Montréal / Canada Central)**.
2. Exécution du script SQL (que je vous fournirai) pour créer les tables représentées ci-dessus.
3. Configuration des règles RLS (Row Level Security) pour cloisonner hermétiquement les données par pharmacie.

### Étape 2 : Création de l'Interface de Connexion (Login)
1. Ajout d'un écran de connexion (Email + Mot de passe) au démarrage de l'application.
2. Gestion de l'inscription pour les nouvelles pharmacies.

### Étape 3 : Code de Synchronisation Cloud
1. Liaison de l'interface actuelle avec l'API Supabase pour toutes les lectures et écritures.
2. Modification de l'outil d'importation CSV pour envoyer le catalogue directement dans la table en ligne `CATALOG` de la pharmacie connectée.

### Étape 4 : Script de Migration Automatique
1. Lors de votre première connexion, l'application détectera s'il y a des données dans votre `localStorage` et votre `IndexedDB` actuels.
2. Si des données locales existent, l'application proposera : *"Données locales détectées. Souhaitez-vous les importer dans votre compte en ligne ?"*.
3. Les données seront automatiquement téléversées sur Supabase.
4. Une fois la migration confirmée par le serveur, l'application nettoiera l'espace local.

---

## 🔍 Plan de Vérification

### Tests Manuels
1. **Sauvegarde Initiale :** Effectuer une sauvegarde JSON manuelle avant toute modification du code pour garantir la sécurité.
2. **Vérification de la Connexion :** Se connecter avec les identifiants créés et vérifier que l'accès est accordé.
3. **Migration Test :** Vérifier que les anciens produits saisis (comme `BIACNA`, `TARO CLOBETASOL`, etc.) sont bien présents dans l'onglet *Inventaire & Recherche* après la migration.
4. **Test Multi-Postes :** Ouvrir l'application sur deux navigateurs différents (simulant deux ordinateurs), ajouter un produit sur l'un et vérifier qu'il apparaît instantanément sur l'autre après rafraîchissement (ou en temps réel).
5. **Test d'Importation CSV :** Importer un catalogue CSV test pour s'assurer que l'auto-complétion se remplit correctement à partir du Cloud.
