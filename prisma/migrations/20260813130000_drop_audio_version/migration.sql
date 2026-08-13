-- Drop the audio-version axis.
--
-- Two instances of the same kind are told apart by their label ("Radarr",
-- "Radarr French"), which is what a requester actually chooses between. The
-- VO/MULTI enum forced every install onto an axis most do not have, and it
-- could not express a third instance at all.

-- The old uniqueness included version; label alone now separates instances of
-- a kind. Dropped first so removing the column cannot fail on a dependency.
DROP INDEX IF EXISTS "ArrInstance_kind_version_label_key";

ALTER TABLE "ArrInstance" DROP COLUMN IF EXISTS "version";

DROP TYPE IF EXISTS "AudioVersion";

-- Collapsing the axis can leave two instances of a kind sharing a label; keep
-- the oldest and rename the rest rather than failing the migration.
UPDATE "ArrInstance" AS a
SET "label" = a."label" || ' (' || substr(a."id", 1, 6) || ')'
WHERE EXISTS (
  SELECT 1 FROM "ArrInstance" AS b
  WHERE b."kind" = a."kind" AND b."label" = a."label" AND b."createdAt" < a."createdAt"
);

CREATE UNIQUE INDEX "ArrInstance_kind_label_key" ON "ArrInstance"("kind", "label");
