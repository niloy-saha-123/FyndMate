-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR FYNDMATE
-- ============================================
-- 
-- This migration enables Row Level Security on all tables and defines
-- access policies that control what data users can read/write.
--
-- HOW RLS WORKS:
-- - When RLS is enabled, ALL queries are blocked by default
-- - Policies define WHO can do WHAT on WHICH rows
-- - Supabase's auth.uid() returns the authenticated user's Supabase ID
-- - Service role key (used by the server) BYPASSES all RLS
--
-- POLICY STRUCTURE:
-- - FOR SELECT/INSERT/UPDATE/DELETE = which operation
-- - TO authenticated = applies to logged-in users
-- - USING (condition) = which EXISTING rows can be accessed (SELECT/UPDATE/DELETE)
-- - WITH CHECK (condition) = which NEW rows can be written (INSERT/UPDATE)
--
-- ============================================


-- ============================================
-- STEP 1: ENABLE RLS ON ALL TABLES
-- ============================================
-- This is the "master switch" - once enabled, all access is denied
-- unless explicitly allowed by a policy.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Swipe" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Match" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;


-- ============================================
-- STEP 2: HELPER FUNCTION
-- ============================================
-- Our User table uses custom IDs (cuid), but Supabase Auth uses UUIDs.
-- This function maps auth.uid() → User.id for use in policies.
--
-- SECURITY DEFINER: Function runs with creator's permissions (needed to query User table)
-- STABLE: Result doesn't change within a transaction (enables caching)

CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS TEXT AS $$
  -- LIMIT 1 is a defensive guard: supabaseId is unique, but this prevents errors
  -- if bad data is ever inserted manually.
  SELECT id
  FROM "User"
  WHERE "supabaseId" = auth.uid()::TEXT
  LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================
-- STEP 3: USER TABLE POLICIES
-- ============================================
-- The User table contains developer profiles.
-- 
-- Access Pattern:
-- - Everyone can VIEW all profiles (needed for swiping/discovery feed)
-- - Only the user can create/edit/delete their own profile

-- SELECT: Any authenticated user can view any profile
-- Why: Users need to see other profiles to swipe on them
CREATE POLICY "user_select_all"
  ON "User" FOR SELECT
  TO authenticated
  USING (true);  -- No restriction - all profiles are public

-- INSERT: Users can only create their own profile
-- Why: Prevents creating fake profiles for other users
-- How: Checks that the supabaseId matches the authenticated user
CREATE POLICY "user_insert_own"
  ON "User" FOR INSERT
  TO authenticated
  WITH CHECK ("supabaseId" = auth.uid()::TEXT);

-- UPDATE: Users can only update their own profile
-- Why: The user shouldn't be able to edit someone else's bio, skills, etc.
-- USING: Which existing rows can be targeted
-- WITH CHECK: The updated row must still belong to the user    
CREATE POLICY "user_update_own"
  ON "User" FOR UPDATE
  TO authenticated
  USING ("supabaseId" = auth.uid()::TEXT)
  WITH CHECK ("supabaseId" = auth.uid()::TEXT);

-- DELETE: Users can only delete their own profile
-- Why: Account deletion should only affect the authenticated user's own account
CREATE POLICY "user_delete_own"
  ON "User" FOR DELETE
  TO authenticated
  USING ("supabaseId" = auth.uid()::TEXT);


-- ============================================
-- STEP 4: PROJECT TABLE POLICIES
-- ============================================
-- Projects are portfolio items shown on profile cards.
--
-- Access Pattern:
-- - Everyone can VIEW all projects (they're displayed during swiping)
-- - Only the project OWNER can create/edit/delete

-- SELECT: All projects are publicly viewable
-- Why: Projects appear on profile cards when swiping
CREATE POLICY "project_select_all"
  ON "Project" FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Users can only create projects linked to themselves
-- Why: Prevents adding fake projects to someone else's profile
CREATE POLICY "project_insert_own"
  ON "Project" FOR INSERT
  TO authenticated
  WITH CHECK ("userId" = get_current_user_id());

-- UPDATE: Users can only update their own projects
CREATE POLICY "project_update_own"
  ON "Project" FOR UPDATE
  TO authenticated
  USING ("userId" = get_current_user_id())
  WITH CHECK ("userId" = get_current_user_id());

-- DELETE: Users can only delete their own projects
CREATE POLICY "project_delete_own"
  ON "Project" FOR DELETE
  TO authenticated
  USING ("userId" = get_current_user_id());


-- ============================================
-- STEP 5: SWIPE TABLE POLICIES
-- ============================================
-- Swipes track who liked/passed on whom.
--
-- ACCESS PATTERN (HINGE-STYLE MATCHING):
-- 
-- This is NOT blind matching like Tinder. FyndMate uses Hinge-style:
-- - Liking REQUIRES sending a proposal message (can't just swipe right)
-- - The recipient sees who liked them in their "Likes" section
-- - One person accepts to create a match (no mutual like needed)
-- - Passed profiles can be revisited in "Look Back" feature
--
-- MATCHING FLOW:
-- 1. Person A sees Person B in feed
-- 2. Person A likes Person B WITH a proposal message
-- 3. Person B sees Person A in their "Likes" section (with the message)
-- 4. Person B does NOT see Person A in their feed (already liked by A)
-- 5. Person A cannot see Person B until B accepts (no stalking pending likes)
-- 6. Person B accepts → Match created → Both move to Messages
-- 7. If Person B declines → Swipe is archived, A never reappears in B's feed
--
-- PASS/CROSS FLOW:
-- 1. Person A passes on Person C
-- 2. Person C is removed from Person A's feed
-- 3. When Person A runs out of people → "Look Back" feature appears
-- 4. Person A can reconsider passed profiles (including Person C)
--
-- WHO CAN SEE WHAT:
-- ┌─────────────┬─────────────────────────┬─────────────────────────┐
-- │ User Role   │ CAN See                 │ CANNOT See              │
-- ├─────────────┼─────────────────────────┼─────────────────────────┤
-- │ Swiper (A)  │ Own PASSES (Look Back)  │ Own LIKES (pending)     │
-- │ Recipient(B)│ LIKES received (Likes)  │ PASSES received         │
-- └─────────────┴─────────────────────────┴─────────────────────────┘

-- SELECT (Policy 1): Users can see LIKES they received
-- Why: Powers the "Likes" section where recipients see proposals
-- Shows: The profile of who liked the user + their proposal message
CREATE POLICY "swipe_select_received_likes"
  ON "Swipe" FOR SELECT
  TO authenticated
  USING ("swipedId" = get_current_user_id() AND "liked" = true);

-- SELECT (Policy 2): Users can see their own PASSES (not likes!)
-- Why: Powers the "Look Back" feature to reconsider passed profiles
-- Note: App logic decides WHEN to show this (e.g., only when feed is empty)
-- The RLS just allows the access; the app controls the UX timing
CREATE POLICY "swipe_select_own_passes"
  ON "Swipe" FOR SELECT
  TO authenticated
  USING ("swiperId" = get_current_user_id() AND "liked" = false);

-- ❌ NO POLICY for own likes!
-- Users CANNOT see profiles they've liked until matched.
-- This prevents: stalking pending proposals, knowing who hasn't responded yet
-- Creates anticipation and protects recipients from pressure

-- INSERT: Users can only create swipes as themselves
-- Why: Prevents spoofing swipes from other users
CREATE POLICY "swipe_insert_own"
  ON "Swipe" FOR INSERT
  TO authenticated
  WITH CHECK (
    "swiperId" = get_current_user_id() 
    AND "swiperId" != "swipedId"  -- Can't swipe on own profile
  );

-- ❌ NO UPDATE POLICY!
-- Swipes are immutable. Once the user sends a proposal, they can't edit it.
-- If the client needs to allow message editing, implement server-side with limits.

-- ❌ NO DELETE POLICY from client!
-- Swipes can't be undone from client (no "undo like" button).
-- Server can delete swipes using service role if needed for:
-- - When recipient rejects (to allow swiper to reappear in their feed later)
-- - Admin moderation


-- ============================================
-- STEP 6: MATCH TABLE POLICIES
-- ============================================
-- Matches are created when Person A likes Person B, and Person B accepts.
-- This is Hinge-style (one-sided accept), NOT Tinder-style (mutual like).
--
-- Access Pattern:
-- - Users can only see matches they're part of
-- - INSERT is NOT allowed from client (server creates matches on accept)
-- - DELETE is NOT allowed from client (unmatch is server-side via status change)
--
-- SECURITY DECISION: All match mutations are server-side only.
-- This prevents manipulation and ensures proper state management.

-- SELECT: Users can view matches they're part of
-- Why: The matches list shows people the user is matched with
CREATE POLICY "match_select_own"
  ON "Match" FOR SELECT
  TO authenticated
  USING (
    "user1Id" = get_current_user_id() 
    OR "user2Id" = get_current_user_id()
  );

-- ❌ NO INSERT POLICY!
-- Matches are created by the SERVER (using service role) when recipient accepts.
-- This prevents users from creating fake matches with anyone.

-- ❌ NO UPDATE POLICY!
-- Match status changes (e.g., unmatched) are handled server-side only.

-- ❌ NO DELETE POLICY!
-- Unmatch is handled server-side by updating Match.status, not by deleting.
-- This preserves history and prevents abuse (harassment loops).


-- ============================================
-- STEP 7: MESSAGE TABLE POLICIES
-- ============================================
-- Messages belong to a Match (conversation between two users).
--
-- Access Pattern:
-- - Users can only view/send messages in their matches
-- - Users can only send messages as themselves
-- - Only the sender of the message can delete it
--
-- SECURITY: Uses a subquery to verify match membership.

-- SELECT: Users can view messages in matches they're part of
-- Why: Users should only see their own conversations
-- How: Checks if the user is user1 or user2 of the parent Match
CREATE POLICY "message_select_in_match"
  ON "Message" FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Match" m 
      WHERE m.id = "matchId" 
      AND (m."user1Id" = get_current_user_id() OR m."user2Id" = get_current_user_id())
    )
  );

-- INSERT: Users can send messages in their matches, as themselves
-- Why: Prevents impersonation and messaging people the user is not matched with
-- Checks: 1) senderId is the user, 2) the user is in the match
CREATE POLICY "message_insert_in_match"
  ON "Message" FOR INSERT
  TO authenticated
  WITH CHECK (
    "senderId" = get_current_user_id()
    AND EXISTS (
      SELECT 1 FROM "Match" m 
      WHERE m.id = "matchId" 
      AND (m."user1Id" = get_current_user_id() OR m."user2Id" = get_current_user_id())
    )
  );

-- ❌ NO UPDATE POLICY!
-- Messages are immutable from the client. No editing allowed.
-- Read receipts (updating readAt) are handled server-side using service role.
-- If message editing is needed later, add a sender-only policy:
-- CREATE POLICY "message_update_own"
--   ON "Message" FOR UPDATE
--   TO authenticated
--   USING ("senderId" = get_current_user_id())
--   WITH CHECK ("senderId" = get_current_user_id());

-- DELETE: Only the sender can delete their own message
-- Why: The user shouldn't be able to delete what others said
CREATE POLICY "message_delete_own"
  ON "Message" FOR DELETE
  TO authenticated
  USING ("senderId" = get_current_user_id());


-- ============================================
-- DONE! 
-- ============================================
-- 
-- SUMMARY OF POLICIES:
-- 
-- User:     Public read, owner-only write
-- Project:  Public read, owner-only write  
-- Swipe:    Hinge-style (see likes received, own passes, insert only)
-- Match:    Participants SELECT only, all mutations server-side
-- Message:  Match participants (read/insert/delete), no updates from client
--
-- HINGE-STYLE MATCHING FLOW:
-- 1. Person A likes Person B with a proposal message
-- 2. Person B sees Person A in "Likes" section with the message
-- 3. Person A CANNOT see Person B until matched (no stalking pending likes)
-- 4. Person B accepts → Match created (server-side) → Both move to Messages
-- 5. Person B declines → Swipe archived (server-side) → A never reappears
--
-- LOOK BACK FEATURE:
-- - Users can see their own PASSES (but not LIKES)
-- - App logic controls when to show this (e.g., when feed is empty)
-- - Allows reconsidering previously passed profiles
--
-- REMEMBER: Our server uses the service role key which BYPASSES all RLS.
-- These policies protect against direct client access and add defense-in-depth.

