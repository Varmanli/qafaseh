ALTER TABLE "ReferenceItem"
  ADD COLUMN "roles" "ReferenceType"[] NOT NULL DEFAULT ARRAY[]::"ReferenceType"[],
  ADD COLUMN "canonical_reference_id" varchar REFERENCES "ReferenceItem"("id") ON DELETE CASCADE;
--> statement-breakpoint
UPDATE "ReferenceItem" SET "roles" = ARRAY["type"]::"ReferenceType"[];
--> statement-breakpoint
CREATE INDEX "ReferenceItem_roles_gin_idx" ON "ReferenceItem" USING GIN ("roles");
--> statement-breakpoint
CREATE INDEX "ReferenceItem_canonical_reference_idx" ON "ReferenceItem" ("canonical_reference_id");
--> statement-breakpoint
DO $$
DECLARE person RECORD;
BEGIN
  FOR person IN
    WITH authors AS (
      SELECT id, lower(btrim(name)) AS identity, count(*) OVER (PARTITION BY lower(btrim(name))) AS duplicates
      FROM "ReferenceItem" WHERE type = 'AUTHOR'
    ), translators AS (
      SELECT id, lower(btrim(name)) AS identity, count(*) OVER (PARTITION BY lower(btrim(name))) AS duplicates
      FROM "ReferenceItem" WHERE type = 'TRANSLATOR'
    )
    SELECT authors.id AS author_id, translators.id AS translator_id
    FROM authors JOIN translators USING (identity)
    WHERE authors.duplicates = 1 AND translators.duplicates = 1
  LOOP
    UPDATE "ReferenceItem" AS author SET
      roles = ARRAY['AUTHOR', 'TRANSLATOR']::"ReferenceType"[],
      cover_image = coalesce(author.cover_image, translator.cover_image),
      banner_image = coalesce(author.banner_image, translator.banner_image),
      original_name = coalesce(author.original_name, translator.original_name),
      description = coalesce(author.description, translator.description),
      short_description = coalesce(author.short_description, translator.short_description),
      image_filename = coalesce(author.image_filename, translator.image_filename),
      source_name = coalesce(author.source_name, translator.source_name),
      source_url = coalesce(author.source_url, translator.source_url),
      seo_title = coalesce(author.seo_title, translator.seo_title),
      seo_description = coalesce(author.seo_description, translator.seo_description),
      birth_year = coalesce(author.birth_year, translator.birth_year),
      death_year = coalesce(author.death_year, translator.death_year),
      country_name = coalesce(author.country_name, translator.country_name),
      country_slug = coalesce(author.country_slug, translator.country_slug),
      website = coalesce(author.website, translator.website),
      status = CASE WHEN author.status = 'APPROVED' OR translator.status = 'APPROVED' THEN 'APPROVED'::"ApprovalStatus" ELSE author.status END,
      updated_at = now()
    FROM "ReferenceItem" AS translator
    WHERE author.id = person.author_id AND translator.id = person.translator_id;

    UPDATE "ReferenceItem"
    SET canonical_reference_id = person.author_id, updated_at = now()
    WHERE id = person.translator_id;
  END LOOP;
END $$;
