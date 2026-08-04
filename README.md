# 💊 Gestion des Expirés de Laboratoire (PharmaOps)

> **Application Web & Mobile Progressive (PWA) de gestion des péremptions, suivi des retraits mensuels et analyse des achats génériques pour pharmacies d'officine.**

![Version](https://img.shields.io/badge/Version-V4.6-0f766e)
![Platform](https://img.shields.io/badge/Plateforme-Web%20%7C%20Mobile%20PWA-0369a1)
![Stack](https://img.shields.io/badge/Stack-HTML5%20%7C%20Vanilla%20JS%20%7C%20Supabase-386a20)
![Conformité](https://img.shields.io/badge/Conformit%C3%A9-Loi%2025%20(Qu%C3%A9bec)-815600)

---

## 🚀 DÉMARRAGE RAPIDE

### Sur PC (Local) :
1. Allez dans le dossier `Procédure expirés`.
2. Double-cliquez sur **`lancer_local.bat`** (ou lancez `serve.ps1` dans PowerShell).
3. L'application s'ouvre automatiquement dans votre navigateur à l'adresse `http://localhost:8080`.
4. Connectez-vous avec vos identifiants d'officine.

### Sur Mobile / Tablette (Réseau local) :
1. Exécutez le script PowerShell `lancer_mobile.ps1`.
2. Scannez le QR Code affiché sur l'écran du PC avec votre mobile/tablette pour ouvrir l'application sur le réseau local.

---

## 📋 FONCTIONNALITÉS PRINCIPALES

* **➕ Saisie & Scan Ultra-Rapides** :
  * Scan de codes-barres 1D (UPC) et 2D (Datamatrix) avec douchette physique ou caméra mobile.
  * Auto-remplissage immédiat (Nom, Dosage, Format) dès la saisie d'un DIN (8 chiffres) ou le scan.
  * Auto-focus sur la quantité pour une saisie "à la chaîne" au clavier sans toucher la souris.
  * Association automatique UPC ↔ DIN au vol pour les nouveaux conditionnements.
* **📊 Suivi Collaboratif par Section** :
  * Découpage du laboratoire par zones (*Magistral, Liquide, Solide, Frigo, Topique*).
  * Checklist d'avancement et pourcentage global de la tournée mis à jour en temps réel sur tous les postes.
  * Gestion des pastilles/stickers de couleur pour les 12 mois de l'année.
* **📋 Retrait Mensuel (Dashboard)** :
  * Filtrage automatique des médicaments arrivant à échéance le mois courant.
  * Boutons d'action rapide (`Retiré` / `Vendu`).
  * Mode *Session Rapide* sans fenêtre de confirmation.
  * Impression A4 officielle des fiches de retrait papier avec lignes de signature.
* **📈 Analyse des Achats Génériques (PharmaOps Generics)** :
  * Importation directe des fichiers d'achats grossistes (Excel/CSV).
  * Graphiques interactifs (Chart.js) et analyse comparative des parts de marché par fabricant et par molécule.
* **💾 Synchronisation Cloud & Mode Hors-ligne (Local-First)** :
  * Base de données Cloud Supabase avec sécurité RLS multi-tenant (isolation par pharmacie).
  * Exportation et importation de fichiers de sauvegarde JSON (fusion intelligente de données).

---

## 📚 DOCUMENTATION DU PROJET

* 🤖 [**AGENTS.md**](file:///c:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Proc%C3%A9dure%20expir%C3%A9s/AGENTS.md) : Instructions, règles d'or et script de validation de syntaxe pour les agents IA (ChatGPT Codex, Antigravity, Claude, Cursor).
* 📄 [**PROJECT.md**](file:///c:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Proc%C3%A9dure%20expir%C3%A9s/PROJECT.md) : Spécification technique détaillée, schéma de base de données Supabase et architecture.
* 📖 [**GUIDE_UTILISATION.md**](file:///c:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Proc%C3%A9dure%20expir%C3%A9s/GUIDE_UTILISATION.md) : Guide d'utilisation pas-à-pas destiné au personnel en pharmacie.

---

## 🛠️ STRUCTURE DU CODEBASE

```text
Procédure expirés/
├── README.md                          # Ce document
├── AGENTS.md                          # Directives et règles pour agents IA
├── PROJECT.md                         # Architecture et spécifications techniques
├── GUIDE_UTILISATION.md               # Manuel utilisateur
├── lancer_local.bat                   # Lancement HTTP local sur PC
├── serve.ps1                          # Serveur PowerShell local (Port 8080)
├── serve.py                           # Serveur Python alternative
├── lancer_mobile.ps1                  # Serveur et QR Code pour réseau mobile
├── supabase_setup_rls_v2.sql          # Modèle de base de données Supabase RLS
└── App/                               # Application PWA
    ├── index.html                     # Application UI principal
    ├── manifest.json                  # Déclaration PWA Web App
    ├── sw.js                          # Service Worker (Cache PWA)
    ├── globals.css / dashboard.css    # Thème Material Design 3 (Pharmacy Sage)
    └── js/
        ├── core/                      # Logger & DB connector
        └── modules/generics.js        # Moteur d'analyse des achats génériques
```
