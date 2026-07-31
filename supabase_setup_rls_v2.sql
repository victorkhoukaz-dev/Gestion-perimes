-- ============================================================
-- SCRIPT SUPABASE RLS SÉCURISÉ V2
-- Gestion des Expirés de Laboratoire — PharmaExpire
--
-- QUOI A CHANGÉ vs V1 :
--   - Les USING(true) permissifs ont été remplacés par des
--     conditions vérifiant le pharmacy_id de l'utilisateur.
--   - Une fonction helper public.my_pharmacy_id() est créée
--     pour simplifier et centraliser la logique.
--   - Cas spéciaux préservés :
--       * Inscription : création de pharmacie avant d'avoir un profil
--       * Catalogue : duplication depuis pharmacie maître lors de signup
--       * Invitation : affichage du nom de pharmacie avant connexion
--
-- INSTRUCTIONS :
--   1. Allez sur https://supabase.com/dashboard
--   2. Sélectionnez votre projet
--   3. Cliquez sur "SQL Editor"
--   4. Collez ce script et cliquez sur "Run"
--   5. Testez les flux (login, inscription, invitation, app normale)
--   6. Si un problème survient, exécutez supabase_setup_rls.sql
--      (l'ancien script) pour revenir en arrière instantanément.
-- ============================================================


-- ============================================================
-- 0. FONCTION HELPER : public.my_pharmacy_id()
--    Retourne le pharmacy_id de l'utilisateur connecté.
--    Utilisée par toutes les politiques RLS ci-dessous.
--    NOTE : Doit être dans public (pas auth — schéma réservé Supabase)
-- ============================================================
CREATE OR REPLACE FUNCTION public.my_pharmacy_id()
RETURNS uuid AS $$
  SELECT pharmacy_id
  FROM public.profiles
  WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================
-- 1. TRIGGER AUTOMATIQUE DE CRÉATION DE PROFIL (inchangé)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, pharmacy_id, initials)
  VALUES (
    NEW.id,
    NEW.email,
    CASE
      WHEN (NEW.raw_user_meta_data->>'pharmacy_id') ~ '^[0-9a-fA-F-]{36}$'
      THEN (NEW.raw_user_meta_data->>'pharmacy_id')::uuid
      ELSE NULL
    END,
    COALESCE(NEW.raw_user_meta_data->>'initials', 'N/A')
  )
  ON CONFLICT (id) DO UPDATE SET
    pharmacy_id = EXCLUDED.pharmacy_id,
    initials    = EXCLUDED.initials,
    email       = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 2. Table PHARMACIES
--
--  SELECT : Tout utilisateur (y compris non-connecté) peut
--           lire les noms de pharmacies. Cela permet :
--             a) L'affichage du nom dans le lien d'invitation
--                avant que le nouvel employé soit connecté.
--             b) La duplication du catalogue maître (PJC 28).
--           IMPORTANT : La table pharmacies ne contient que
--           l'ID et le nom — aucune donnée sensible.
--
--  INSERT : Seulement par un utilisateur authentifié.
--           (Lors de la création d'une nouvelle pharmacie)
--
--  UPDATE/DELETE : Seulement le propriétaire de la pharmacie.
-- ============================================================
ALTER TABLE pharmacies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pharmacies_select_public"      ON pharmacies;
DROP POLICY IF EXISTS "pharmacies_insert_authenticated" ON pharmacies;
DROP POLICY IF EXISTS "pharmacies_update_own"         ON pharmacies;
DROP POLICY IF EXISTS "Allow public insert to pharmacies" ON pharmacies;
DROP POLICY IF EXISTS "Allow public select on pharmacies" ON pharmacies;

-- Tout le monde peut lire les noms (necessaire pour invitation + duplication catalogue)
CREATE POLICY "pharmacies_select_public"
ON pharmacies FOR SELECT
TO anon, authenticated
USING (true);

-- Seul un utilisateur connecté peut créer une pharmacie
CREATE POLICY "pharmacies_insert_authenticated"
ON pharmacies FOR INSERT
TO authenticated
WITH CHECK (true);

-- Seul un membre de la pharmacie peut la modifier
CREATE POLICY "pharmacies_update_own"
ON pharmacies FOR UPDATE
TO authenticated
USING (id = public.my_pharmacy_id())
WITH CHECK (id = public.my_pharmacy_id());


-- ============================================================
-- 3. Table PROFILES
--
--  SELECT : Un utilisateur voit seulement les profils de
--           sa propre pharmacie (pour voir la liste des techs).
--
--  INSERT : Géré par le trigger SECURITY DEFINER.
--           L'app peut aussi insérer lors du signup.
--
--  UPDATE : Un utilisateur ne peut modifier que son propre profil.
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_same_pharmacy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own"           ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"           ON profiles;
DROP POLICY IF EXISTS "Allow public select profiles"  ON profiles;
DROP POLICY IF EXISTS "Allow public insert profiles"  ON profiles;
DROP POLICY IF EXISTS "Allow public update profiles"  ON profiles;

-- Voir les profils de sa propre pharmacie (pour liste des techs)
CREATE POLICY "profiles_select_same_pharmacy"
ON profiles FOR SELECT
TO authenticated
USING (pharmacy_id = public.my_pharmacy_id());

-- Insérer son propre profil (lors de l'inscription, avant que le trigger ait fini)
CREATE POLICY "profiles_insert_own"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Modifier uniquement son propre profil
CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());


-- ============================================================
-- 4. Table CONFIGURATIONS
--
--  Toutes les opérations : seulement pour les membres
--  de la même pharmacie.
-- ============================================================
ALTER TABLE configurations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "configurations_own_pharmacy"    ON configurations;
DROP POLICY IF EXISTS "Allow insert configuration"     ON configurations;
DROP POLICY IF EXISTS "Allow select configuration"     ON configurations;
DROP POLICY IF EXISTS "Allow update configuration"     ON configurations;

CREATE POLICY "configurations_own_pharmacy"
ON configurations FOR ALL
TO authenticated
USING (pharmacy_id = public.my_pharmacy_id())
WITH CHECK (pharmacy_id = public.my_pharmacy_id());


-- ============================================================
-- 5. Table FLAGGED_PRODUCTS (Produits expirés)
--
--  Toutes les opérations : seulement pour les membres
--  de la même pharmacie.
-- ============================================================
ALTER TABLE flagged_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flagged_products_own_pharmacy" ON flagged_products;
DROP POLICY IF EXISTS "Allow all on flagged_products" ON flagged_products;

CREATE POLICY "flagged_products_own_pharmacy"
ON flagged_products FOR ALL
TO authenticated
USING (pharmacy_id = public.my_pharmacy_id())
WITH CHECK (pharmacy_id = public.my_pharmacy_id());


-- ============================================================
-- 6. Table CATALOG
--
--  SELECT : Un utilisateur peut lire le catalogue de sa
--           pharmacie ET le catalogue de la pharmacie maître
--           (nécessaire pour la duplication lors de l'inscription
--           d'une nouvelle pharmacie — fonction preloadDefaultCatalog).
--
--  INSERT/UPDATE/DELETE : Seulement pour sa propre pharmacie.
-- ============================================================
ALTER TABLE catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_select_own_or_master"  ON catalog;
DROP POLICY IF EXISTS "catalog_write_own_pharmacy"    ON catalog;
DROP POLICY IF EXISTS "catalog_update_own_pharmacy"   ON catalog;
DROP POLICY IF EXISTS "catalog_delete_own_pharmacy"   ON catalog;
DROP POLICY IF EXISTS "Allow all on catalog"          ON catalog;

-- Lecture : sa propre pharmacie OU la pharmacie maître (pour duplication)
CREATE POLICY "catalog_select_own_or_master"
ON catalog FOR SELECT
TO authenticated
USING (
  pharmacy_id = public.my_pharmacy_id()
  OR
  pharmacy_id = (
    SELECT id FROM pharmacies
    WHERE name ILIKE '%PJC 28%'
    LIMIT 1
  )
);

-- Écriture : uniquement sa propre pharmacie
CREATE POLICY "catalog_write_own_pharmacy"
ON catalog FOR INSERT
TO authenticated
WITH CHECK (pharmacy_id = public.my_pharmacy_id());

CREATE POLICY "catalog_update_own_pharmacy"
ON catalog FOR UPDATE
TO authenticated
USING (pharmacy_id = public.my_pharmacy_id())
WITH CHECK (pharmacy_id = public.my_pharmacy_id());

CREATE POLICY "catalog_delete_own_pharmacy"
ON catalog FOR DELETE
TO authenticated
USING (pharmacy_id = public.my_pharmacy_id());


-- ============================================================
-- FIN DU SCRIPT
-- Pour revenir à l'ancienne version (moins sécurisée) :
-- Exécutez supabase_setup_rls.sql (le fichier original V1)
-- ============================================================
