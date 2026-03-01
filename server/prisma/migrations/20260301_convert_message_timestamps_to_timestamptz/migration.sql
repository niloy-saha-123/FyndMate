-- Ensure message timestamps carry timezone to avoid client-side day shifts.
ALTER TABLE "Message"
  ALTER COLUMN "createdAt" TYPE timestamptz USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" SET DEFAULT now(),
  ALTER COLUMN "readAt" TYPE timestamptz USING CASE WHEN "readAt" IS NULL THEN NULL ELSE "readAt" AT TIME ZONE 'UTC' END,
  ALTER COLUMN "editedAt" TYPE timestamptz USING CASE WHEN "editedAt" IS NULL THEN NULL ELSE "editedAt" AT TIME ZONE 'UTC' END,
  ALTER COLUMN "deletedAt" TYPE timestamptz USING CASE WHEN "deletedAt" IS NULL THEN NULL ELSE "deletedAt" AT TIME ZONE 'UTC' END;

-- Ensure indexes remain valid (Postgres adjusts automatically).

