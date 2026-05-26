-- ── shift_groups migration ───────────────────────────────────────────────────
-- Adds ShiftGroup (for per-group weekly-off schedules) and wires Employee to it.
-- All statements are idempotent (IF NOT EXISTS / IF EXISTS).

-- 1. Shift groups table
CREATE TABLE IF NOT EXISTS "shift_groups" (
  "id"          TEXT         NOT NULL DEFAULT gen_random_uuid(),
  "org_id"      TEXT         NOT NULL,
  "name"        TEXT         NOT NULL,
  "weekly_offs" INTEGER[]    NOT NULL DEFAULT '{0}',
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shift_groups_pkey" PRIMARY KEY ("id")
);

-- FK: shift_groups → organisations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shift_groups_org_id_fkey'
  ) THEN
    ALTER TABLE "shift_groups"
      ADD CONSTRAINT "shift_groups_org_id_fkey"
      FOREIGN KEY ("org_id") REFERENCES "organisations"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 2. Employee: shift group assignment
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "shift_group_id" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employees_shift_group_id_fkey'
  ) THEN
    ALTER TABLE "employees"
      ADD CONSTRAINT "employees_shift_group_id_fkey"
      FOREIGN KEY ("shift_group_id") REFERENCES "shift_groups"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
