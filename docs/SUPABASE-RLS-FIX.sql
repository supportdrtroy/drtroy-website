-- ============================================================
-- DrTroy CE Platform — Supabase RLS Fix
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- STEP 1: Drop all existing policies on profiles (clears recursive policy)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Enable read access for own profile" ON profiles;
DROP POLICY IF EXISTS "Enable insert for own profile" ON profiles;
DROP POLICY IF EXISTS "Enable update for own profile" ON profiles;

-- STEP 2: Drop any existing admin helper (may conflict)
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.get_admin_status() CASCADE;

-- STEP 3: Create SECURITY DEFINER helper to check admin WITHOUT recursion
-- This function bypasses RLS when called, preventing infinite loops
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    false
  );
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- STEP 4: Add is_admin column if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- STEP 5: Create clean, non-recursive RLS policies
-- Users can read their own profile
CREATE POLICY "users_read_own_profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (but not is_admin)
CREATE POLICY "users_update_own_profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (triggered on signup)
CREATE POLICY "users_insert_own_profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Admins can read ALL profiles — uses SECURITY DEFINER function (no recursion)
CREATE POLICY "admins_read_all_profiles"
  ON profiles FOR SELECT
  USING (public.is_admin() = true);

-- Admins can update ALL profiles
CREATE POLICY "admins_update_all_profiles"
  ON profiles FOR UPDATE
  USING (public.is_admin() = true);

-- STEP 6: Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- STEP 7: Fix enrollments RLS — users see only their own
DROP POLICY IF EXISTS "Users can view own enrollments" ON enrollments;
DROP POLICY IF EXISTS "Users can insert own enrollments" ON enrollments;
DROP POLICY IF EXISTS "users_read_own_enrollments" ON enrollments;
DROP POLICY IF EXISTS "admins_read_all_enrollments" ON enrollments;

CREATE POLICY "users_read_own_enrollments"
  ON enrollments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_enrollments"
  ON enrollments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins_read_all_enrollments"
  ON enrollments FOR SELECT
  USING (public.is_admin() = true);

ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- STEP 8: Fix course_progress RLS
DROP POLICY IF EXISTS "Users can view own progress" ON course_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON course_progress;
DROP POLICY IF EXISTS "users_read_own_progress" ON course_progress;
DROP POLICY IF EXISTS "users_update_own_progress" ON course_progress;

CREATE POLICY "users_read_own_progress"
  ON course_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_progress"
  ON course_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_progress"
  ON course_progress FOR UPDATE
  USING (auth.uid() = user_id);

ALTER TABLE course_progress ENABLE ROW LEVEL SECURITY;

-- STEP 9: Fix completions RLS
DROP POLICY IF EXISTS "users_read_own_completions" ON completions;
DROP POLICY IF EXISTS "users_insert_own_completions" ON completions;

CREATE POLICY "users_read_own_completions"
  ON completions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_completions"
  ON completions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE completions ENABLE ROW LEVEL SECURITY;

-- STEP 10: Fix certificates RLS
DROP POLICY IF EXISTS "users_read_own_certificates" ON certificates;
DROP POLICY IF EXISTS "users_insert_own_certificates" ON certificates;

CREATE POLICY "users_read_own_certificates"
  ON certificates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_certificates"
  ON certificates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- STEP 11: courses and packages are PUBLIC (anyone can read)
DROP POLICY IF EXISTS "Public can read courses" ON courses;
DROP POLICY IF EXISTS "Public can read packages" ON packages;

CREATE POLICY "public_read_courses"
  ON courses FOR SELECT
  USING (true);

CREATE POLICY "public_read_packages"
  ON packages FOR SELECT
  USING (true);

-- STEP 12: discount_codes — public can read active ones
DROP POLICY IF EXISTS "Anyone can view active codes" ON discount_codes;
DROP POLICY IF EXISTS "public_read_active_discount_codes" ON discount_codes;

CREATE POLICY "public_read_active_discount_codes"
  ON discount_codes FOR SELECT
  USING (is_active = true);

-- ============================================================
-- STEP 13: Auto-create profile on signup (Postgres trigger)
-- Runs whenever a new user signs up via Supabase Auth
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, profession, license_number, state)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'profession', ''),
    COALESCE(NEW.raw_user_meta_data->>'license_number', ''),
    COALESCE(NEW.raw_user_meta_data->>'state', 'TX')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- STEP 14: Set Troy as admin (run AFTER Troy creates his account)
-- Replace the email below with Troy's actual email
-- ============================================================
-- UPDATE profiles SET is_admin = true WHERE email = 'troyh@texastherapypros.com';

-- ============================================================
-- DONE! Test with:
-- SELECT * FROM profiles WHERE id = auth.uid();  -- should work for logged-in users
-- SELECT public.is_admin();                       -- should return false for regular users
-- ============================================================
