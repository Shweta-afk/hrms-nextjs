-- Adds occurrence-in-month off-day rules to shift groups (e.g. "2nd Saturday
-- off" or "1st and 3rd Sunday off"), generalizing the plain weekly_offs list.
ALTER TABLE "shift_groups" ADD COLUMN "off_day_rules" JSONB;
