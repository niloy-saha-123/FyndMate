-- ============================================
-- STORAGE BUCKET SETUP
-- ============================================
-- This file runs automatically when we start local Supabase:
--   npx supabase start
--
-- It creates the storage bucket needed for profile picture uploads.
-- The bucket will be created every time we reset/restart Supabase.
-- ============================================

-- Create profile-pictures storage bucket
-- ON CONFLICT ensures this is idempotent (safe to run multiple times)
INSERT INTO storage.buckets (
  id, 
  name, 
  public, 
  file_size_limit, 
  allowed_mime_types
)
VALUES (
  'profile-pictures',           -- Bucket ID (matches code constant)
  'profile-pictures',           -- Bucket name  
  true,                         -- Public bucket (profile pictures are publicly accessible)
  10485760,                     -- 10MB file size limit (10 * 1024 * 1024 bytes)
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[]  -- Allowed file types
)
ON CONFLICT (id) DO NOTHING;  -- Skip if bucket already exists

-- Verify bucket was created
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'profile-pictures') THEN
    RAISE NOTICE '✅ Storage bucket "profile-pictures" created successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to create storage bucket';
  END IF;
END $$;
