-- ============================================================
-- SCRIPT DE NETTOYAGE RLS — Suppression des anciennes politiques
-- À exécuter APRÈS supabase_setup_rls_v2.sql
--
-- POURQUOI : Les anciennes politiques (nommées en français) coexistent
-- avec les nouvelles (V2). En mode PERMISSIVE, Supabase utilise une
-- logique OU — si UNE politique dit "true", l'accès est ouvert à tous.
-- Ce script supprime les anciennes pour ne garder que les V2 sécurisées.
-- ============================================================


-- ------------------------------------------------------------
-- Table CATALOG
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Accès complet catalogue par pharmacie"      ON catalog;
DROP POLICY IF EXISTS "Insertion de ses propres produits catalogue" ON catalog;
DROP POLICY IF EXISTS "Lecture du catalogue par les connectés"      ON catalog;
DROP POLICY IF EXISTS "Mise à jour de ses propres produits catalogue" ON catalog;
DROP POLICY IF EXISTS "Suppression de ses propres produits catalogue" ON catalog;


-- ------------------------------------------------------------
-- Table CONFIGURATIONS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Accès complet config par pharmacie"    ON configurations;
DROP POLICY IF EXISTS "Insertion de sa propre configuration"  ON configurations;
DROP POLICY IF EXISTS "Lecture de sa propre configuration"    ON configurations;
DROP POLICY IF EXISTS "Mise à jour de sa propre configuration" ON configurations;


-- ------------------------------------------------------------
-- Table FLAGGED_PRODUCTS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Accès complet expirés par pharmacie"   ON flagged_products;
DROP POLICY IF EXISTS "Insertion de ses produits tournées"    ON flagged_products;
DROP POLICY IF EXISTS "Lecture de ses produits tournées"      ON flagged_products;
DROP POLICY IF EXISTS "Mise à jour de ses produits tournées"  ON flagged_products;
DROP POLICY IF EXISTS "Suppression de ses produits tournées"  ON flagged_products;


-- ------------------------------------------------------------
-- Table PHARMACIES
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Création de pharmacie pour tous"          ON pharmacies;
DROP POLICY IF EXISTS "Lecture pour les membres"                  ON pharmacies;
DROP POLICY IF EXISTS "Permettre l'insertion à l'inscription"     ON pharmacies;
DROP POLICY IF EXISTS "Permettre la lecture de sa propre pharmacie" ON pharmacies;


-- ------------------------------------------------------------
-- Table PROFILES
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Lecture de son profil et des membres" ON profiles;
DROP POLICY IF EXISTS "Lecture de son propre profil"         ON profiles;
DROP POLICY IF EXISTS "Mise à jour de son propre profil"     ON profiles;
DROP POLICY IF EXISTS "Modification de son propre profil"    ON profiles;


-- ============================================================
-- FIN DU SCRIPT
-- Après exécution, seules les politiques V2 (my_pharmacy_id)
-- sont actives. Teste l'app pour confirmer le bon fonctionnement.
-- ============================================================
