CREATE OR REPLACE FUNCTION qafaseh_discovery_text(value text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT trim(regexp_replace(regexp_replace(
    translate(lower(regexp_replace(regexp_replace(coalesce(value, ''), '<[^>]*>', ' ', 'g'),
      '[ًٌٍَُِّْٰـ]', '', 'g')),
      'يىئكۀةأإٱؤ٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
      'یییکههاااو01234567890123456789'),
    '[‌‍‎‏]', ' ', 'g'), '[[:space:][:punct:]]+', ' ', 'g'))
$$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "CatalogBook_discovery_text_idx"
  ON "CatalogBook" USING gin (
    qafaseh_discovery_text(coalesce("genre", '') || ' ' || coalesce("description", '')) gin_trgm_ops
  ) WHERE "status" = 'APPROVED';
