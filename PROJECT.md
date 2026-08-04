# 📄 SPECIFICATION DU PROJET (PROJECT.md)

> **Gestion des Expirés de Laboratoire (PharmaOps)** — Spécification technique, architecture, modèle de données et fonctionnalités.

---

## 🚀 1. APERÇU GÉNÉRAL

* **Nom du projet** : Gestion des Expirés de Laboratoire (PharmaOps)
* **Version actuelle** : V4.6
* **Domaine métier** : Pharmacie d'officine (Gestion des périmés, retraits mensuels, tournées de saisie, analyse des achats génériques)
* **Type d'application** : Web App Progressive (PWA), Local-First avec synchronisation Cloud Supabase en temps réel.
* **Compatibilité** : Ordinateurs de bureau (Windows/Mac), Tablettes et Smartphones (iOS/Android).

---

## 🛠️ 2. STACK TECHNIQUE

| Composant | Technologie Utilisée | Rôle / Utilisation |
| :--- | :--- | :--- |
| **Frontend UI** | HTML5, Vanilla JavaScript (ES6+), Material Design 3 CSS | Interface réactive, ultra-rapide, sans surpoids de framework. |
| **Base de Données Cloud** | Supabase (PostgreSQL, Row Level Security) | Synchronisation multi-utilisateurs et multi-pharmacies en temps réel. |
| **Stockage Local** | LocalStorage + IndexDB / Fichiers JSON | Mode hors-ligne et fonctionnement Local-First. |
| **Scanner & Code-barres** | `html5-qrcode.min.js` | Scan de codes-barres 1D (UPC) et 2D (Datamatrix). |
| **Analyse & Graphiques** | `Chart.js`, `SheetJS (XLSX)` | Module d'analyse des rapports d'achats génériques (`generics.js`). |
| **PWA & Cache** | Service Worker (`sw.js`), `manifest.json` | Installation sur mobile et mise en cache des assets statiques. |

---

## 🗄️ 3. ARCHITECTURE & MODÈLE DE DONNÉES

### A. Modèle de Données Supabase (PostgreSQL)

1. **`profiles`** : Profils des utilisateurs (techniciens / pharmaciens).
   * Contient `id`, `email`, `pharmacy_id`, `role` (`admin`, `staff`).
2. **`products` (Catalogue référence & produits signalés)** :
   * `din` (VARCHAR 8, clé unique par produit)
   * `name` (Nom du médicament / produit)
   * `dosage` (Dosage, ex: `500mg`)
   * `format` (Format de conditionnement, ex: `Btle 100`)
   * `category` / `section` (Section associée par défaut)
   * `pharmacy_id` (UUID de la pharmacie)
3. **`upc_mappings` (Associations Codes-Barres ↔ DIN)** :
   * `upc` (VARCHAR 12-14, clé unique du code-barres)
   * `din` (DIN auquel ce code-barres est associé)
   * `package_format` (Format spécifique au code UPC)
   * `pharmacy_id`
4. **`inventory_items` (Produits expirés enregistrés lors des tournées)** :
   * `id` (UUID)
   * `din` / `upc`
   * `expiry_date` (Mois/Année de péremption)
   * `quantity` (Quantité comptée)
   * `section` (Zone du laboratoire)
   * `status` (`active`, `removed`, `sold`)
   * `recorded_by` (Initiales ou ID du technicien)
   * `pharmacy_id`
5. **`section_progress` (Suivi de l'avancement des tournées par section)** :
   * `section_name` (ex: `MAGISTRAL`)
   * `status` (`not_started`, `in_progress`, `completed`)
   * `tour_type` (`3_months`, `6_months`)
   * `pharmacy_id`
6. **`generics_purchases`** : Données d'achats génériques importées.

---

## ⚙️ 4. FONCTIONNALITÉS ESSENTIELLES & FLUX OPÉRATIONNELS

### 1️⃣ Tournée de Saisie (Scan & Auto-complétion)
- **Scan Barcode / DIN** : Saisie par douche d'un code-barres ou saisie directe du DIN.
- **Remplissage automatique** : Recherche instantanée du DIN dans le catalogue pré-chargé.
- **Auto-Focus** : Le curseur saute automatiquement sur le champ **Quantité**.
- **Association UPC au vol** : Si l'UPC est inconnu, l'application demande le DIN, remplit le produit et enregistre l'association permanente en base de données.
- **Multi-UPC par DIN** : Gestion des différents formats de conditionnement liés à un même DIN.

### 2️⃣ Suivi de l'Avancement par Section (Checklist Collaborative)
- Division du labo en sections (*Liquide, Magistral, Frigo, Topique, Solide, etc.*).
- Statut d'avancement mis à jour en temps réel (🔴 Non entamée, 🟡 En cours, 🟢 Complétée).
- Barre de progression globale en pourcentage.
- Système de pastilles/stickers colorés sur 12 mois.

### 3️⃣ Tableau de Bord du Retrait Mensuel
- Vue filtrée automatique des produits expirant dans le mois sélectionné.
- Actions rapides 1-clic : ✅ **Retirer** | 📦 **Vendu**.
- Mode **Session Rapide** (saisie accélérée avec initiales).
- **Impression Pro** : Fiches de retrait au format A4 papier avec lignes de signature.

### 4️⃣ Module Analyse des Achats Génériques (`generics.js`)
- Importation des fichiers Excel/CSV de rapports d'achats grossistes.
- Tableaux de bord annuels et mensuels avec graphiques Chart.js.
- Filtrage par fabricant (ex: *Pharmascience, Apotex, Teva, Sandoz*) et par molécule.

---

## 🔒 5. SÉCURITÉ, PRIVATISATION & LOI 25

* **Aucune donnée patient (PHII / PHI)** n'est collectée ni stockée. L'application gère uniquement des numéros de DIN, codes-barres, quantités et dates de péremption de boîtes de médicaments.
* Conforme à la **Loi 25 du Québec** sur la protection des renseignements personnels.
* Sécurité **Supabase RLS (Row Level Security)** : chaque utilisateur ne peut accéder qu'aux données associées au `pharmacy_id` de son compte.

---

## 📋 6. COMMANDES DE LANCEMENT & TEST

```powershell
# 1. Lancer le serveur local HTTP (port 8080)
powershell ./serve.ps1

# 2. Lancer la version d'accès mobile / réseau local
powershell ./lancer_mobile.ps1

# 3. Vérifier la syntaxe du fichier HTML/JS principal
node -e "const fs = require('fs'); const html = fs.readFileSync('./App/index.html', 'utf8'); const scripts = html.match(/<script[\s\S]*?<\/script>/gi) || []; scripts.forEach((s, i) => { const code = s.replace(/<\/?script[^>]*>/gi, ''); try { new Function(code); } catch(e) { console.error('Erreur syntaxe JS:', e.message); process.exit(1); } }); console.log('Syntaxe 100% OK');"
```
