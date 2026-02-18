-- ============================================================
-- DrTroy RLS Fix v2 — Run this in Supabase SQL Editor
-- Dynamically drops ALL policies on problem tables, then
-- recreates them clean. No guessing policy names.
-- ============================================================

-- STEP 1: Drop ALL policies on profiles (dynamic — catches any name)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON public.profiles';
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END $$;

-- STEP 2: Drop ALL policies on discount_codes
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'discount_codes' AND schemaname = 'public'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON public.discount_codes';
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END $$;

-- STEP 3: Drop old is_admin function if it exists
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

-- STEP 4: Create SECURITY DEFINER is_admin() — bypasses RLS, no recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    false
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- STEP 5: Add is_admin column if missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- STEP 6: Create clean profiles policies (no recursion)
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_admin_select_all"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

CREATE POLICY "profiles_admin_update_all"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- STEP 7: Create discount_codes public read policy
CREATE POLICY "discount_codes_public_read"
  ON public.discount_codes FOR SELECT
  USING (is_active = true);

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

-- STEP 8: Verify — should return list of new policies
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('profiles', 'discount_codes')
AND schemaname = 'public'
ORDER BY tablename, policyname;
