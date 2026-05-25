-- ────────────────────────────────────────────────────────────────────────────
-- Migration: add_verification_ratelimit_apikeys
-- Adds the columns/tables that exist in schema.prisma but were never migrated.
-- Safe to re-run: uses IF NOT EXISTS / IF EXISTS guards throughout.
-- ────────────────────────────────────────────────────────────────────────────

-- 1. Email-verification columns on users
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "email_verified_at"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "email_verification_token"  TEXT,
  ADD COLUMN IF NOT EXISTS "email_verification_expiry" TIMESTAMP(3);

-- Unique index (Prisma @unique maps to a unique index, not a constraint)
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_verification_token_key"
  ON "users"("email_verification_token");

-- 2. Missing columns on devices (model + timezone were added to schema but not migrated)
ALTER TABLE "devices"
  ADD COLUMN IF NOT EXISTS "model"    TEXT,
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- 3. rate_limit_entries table (Postgres-backed rate limiter used by auth routes)
CREATE TABLE IF NOT EXISTS "rate_limit_entries" (
    "key"        TEXT         NOT NULL,
    "count"      INTEGER      NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "rate_limit_entries_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "rate_limit_entries_expires_at_idx"
  ON "rate_limit_entries"("expires_at");

-- 4. org_api_keys table (biometric device API key management)
CREATE TABLE IF NOT EXISTS "org_api_keys" (
    "id"         TEXT         NOT NULL,
    "org_id"     TEXT         NOT NULL,
    "name"       TEXT         NOT NULL,
    "key_hash"   TEXT         NOT NULL,
    "last_used"  TIMESTAMP(3),
    "is_active"  BOOLEAN      NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "org_api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "org_api_keys_key_hash_key"
  ON "org_api_keys"("key_hash");

ALTER TABLE "org_api_keys"
  ADD CONSTRAINT "org_api_keys_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organisations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
