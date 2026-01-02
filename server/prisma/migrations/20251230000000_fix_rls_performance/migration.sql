-- ============================================
-- RLS PERFORMANCE & SECURITY FIXES
-- ============================================
-- This migration addresses Supabase Security Advisor warnings:
-- 1. Enable RLS on _prisma_migrations table
-- 2. Set search_path on get_current_user_id() function
-- 3. Optimize auth.uid() calls with (SELECT ...) pattern
-- 4. Combine multiple permissive Swipe SELECT policies into one
-- ============================================


-- ============================================
-- FIX 1: Enable RLS on Prisma migrations table
-- ============================================
-- Issue: Table public._prisma_migrations is public, but RLS has not been enabled.
-- Risk: Low (only contains migration history, not user data)
-- Fix: Enable RLS with no policies = blocks all PostgREST access

ALTER TABLE IF EXISTS public._prisma_migrations ENABLE ROW LEVEL SECURITY;


-- ============================================
-- FIX 2: Set search_path on helper function
-- ============================================
-- Issue: Function has mutable search_path
-- Risk: Potential schema injection attack
-- Fix: Lock search_path to public schema

CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS TEXT AS $$
  SELECT id
  FROM "User"
  WHERE "supabaseId" = auth.uid()::TEXT
  LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;


-- ============================================
-- FIX 3: Optimize User table policies
-- ============================================
-- Issue: auth.uid() is re-evaluated for each row
-- Fix: Wrap in (SELECT ...) for single evaluation

-- Drop and recreate user_insert_own
DROP POLICY IF EXISTS "user_insert_own" ON "User";
CREATE POLICY "user_insert_own"
  ON "User" FOR INSERT
  TO authenticated
  WITH CHECK ("supabaseId" = (SELECT auth.uid()::TEXT));

-- Drop and recreate user_update_own
DROP POLICY IF EXISTS "user_update_own" ON "User";
CREATE POLICY "user_update_own"
  ON "User" FOR UPDATE
  TO authenticated
  USING ("supabaseId" = (SELECT auth.uid()::TEXT))
  WITH CHECK ("supabaseId" = (SELECT auth.uid()::TEXT));

-- Drop and recreate user_delete_own
DROP POLICY IF EXISTS "user_delete_own" ON "User";
CREATE POLICY "user_delete_own"
  ON "User" FOR DELETE
  TO authenticated
  USING ("supabaseId" = (SELECT auth.uid()::TEXT));


-- ============================================
-- FIX 4: Combine Swipe SELECT policies into one
-- ============================================
-- Issue: Multiple permissive policies for same role/action
-- Risk: Both are evaluated for every query (performance)
-- Fix: Combine into single policy with OR condition

-- Drop the two separate policies
DROP POLICY IF EXISTS "swipe_select_received_likes" ON "Swipe";
DROP POLICY IF EXISTS "swipe_select_own_passes" ON "Swipe";

-- Create combined policy
-- Users can see:
-- 1. Likes they received (for Likes inbox)
-- 2. Passes they made (for Look Back feature)
CREATE POLICY "swipe_select_own"
  ON "Swipe" FOR SELECT
  TO authenticated
  USING (
    -- Likes received (for Likes inbox)
    ("swipedId" = (SELECT get_current_user_id()) AND "liked" = true)
    OR
    -- Own passes (for Look Back feature)
    ("swiperId" = (SELECT get_current_user_id()) AND "liked" = false)
  );


-- ============================================
-- DONE
-- ============================================
-- Summary of fixes applied:
-- 1. _prisma_migrations: RLS enabled (blocks PostgREST access)
-- 2. get_current_user_id(): search_path locked to public
-- 3. User policies: auth.uid() wrapped in (SELECT ...)
-- 4. Swipe SELECT: Combined into single policy with OR
--
-- Note: The password leak protection setting must be enabled
-- manually in Supabase Dashboard → Authentication → Providers → Email

