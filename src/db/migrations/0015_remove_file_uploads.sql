-- Remove file upload feature (student UML diagram uploads)
DROP TABLE IF EXISTS "file_uploads";
ALTER TABLE "answers" DROP COLUMN IF EXISTS "file_url";
