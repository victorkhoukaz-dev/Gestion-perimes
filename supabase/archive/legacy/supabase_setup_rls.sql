-- ============================================================
-- SCRIPT COMPLET SUPABASE : TRIGGER PROFIL & POLITIQUES RLS
-- 
-- Instructions :
-- 1. Allez sur https://supabase.com/dashboard
-- 2. Sélectionnez votre projet
-- 3. Cliquez sur "SQL Editor" dans le menu de gauche
-- 4. Collez et exécutez le script ci-dessous en cliquant sur "Run"
-- ============================================================

-- ------------------------------------------------------------
-- 1. TRIGGER AUTOMATIQUE DE CRÉATION DE PROFIL (Crucial)
-- ------------------------------------------------------------
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
    initials = EXCLUDED.initials,
    email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attacher le trigger à la table auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ------------------------------------------------------------
-- 2. Table PHARMACIES
-- ------------------------------------------------------------
ALTER TABLE pharmacies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert to pharmacies" ON pharmacies;
CREATE POLICY "Allow public insert to pharmacies"
ON pharmacies FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public select on pharmacies" ON pharmacies;
CREATE POLICY "Allow public select on pharmacies"
ON pharmacies FOR SELECT
TO anon, authenticated
USING (true);


-- ------------------------------------------------------------
-- 3. Table PROFILES
-- ------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select profiles" ON profiles;
CREATE POLICY "Allow public select profiles"
ON profiles FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow public insert profiles" ON profiles;
CREATE POLICY "Allow public insert profiles"
ON profiles FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update profiles" ON profiles;
CREATE POLICY "Allow public update profiles"
ON profiles FOR UPDATE
TO anon, authenticated
USING (true);


-- ------------------------------------------------------------
-- 4. Table CONFIGURATIONS
-- ------------------------------------------------------------
ALTER TABLE configurations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow insert configuration" ON configurations;
CREATE POLICY "Allow insert configuration"
ON configurations FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow select configuration" ON configurations;
CREATE POLICY "Allow select configuration"
ON configurations FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow update configuration" ON configurations;
CREATE POLICY "Allow update configuration"
ON configurations FOR UPDATE
TO anon, authenticated
USING (true);


-- ------------------------------------------------------------
-- 5. Table FLAGGED_PRODUCTS (Expirations)
-- ------------------------------------------------------------
ALTER TABLE flagged_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on flagged_products" ON flagged_products;
CREATE POLICY "Allow all on flagged_products"
ON flagged_products FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);


-- ------------------------------------------------------------
-- 6. Table CATALOG (Auto-complétion et DIN/UPC)
-- ------------------------------------------------------------
ALTER TABLE catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on catalog" ON catalog;
CREATE POLICY "Allow all on catalog"
ON catalog FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);
