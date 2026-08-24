CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "BookSearchIndex" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "catalog_book_id" varchar NOT NULL REFERENCES "CatalogBook"("id") ON DELETE CASCADE,
  "edition_id" varchar REFERENCES "BookEdition"("id") ON DELETE CASCADE,
  "kind" varchar(40) NOT NULL,
  "value_normalized" text NOT NULL,
  "value_compact" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "BookSearchIndex_catalog_idx" ON "BookSearchIndex" ("catalog_book_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "BookSearchIndex_compact_idx" ON "BookSearchIndex" ("value_compact");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "BookSearchIndex_compact_prefix_idx" ON "BookSearchIndex" ("value_compact" text_pattern_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "BookSearchIndex_normalized_trgm_idx" ON "BookSearchIndex" USING gin ("value_normalized" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "BookSearchIndex_compact_trgm_idx" ON "BookSearchIndex" USING gin ("value_compact" gin_trgm_ops);
--> statement-breakpoint

CREATE OR REPLACE FUNCTION qafaseh_search_normalize(value text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT trim(regexp_replace(
    regexp_replace(
      translate(lower(coalesce(value, '')),
        'يىئكۀةأإٱؤ٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹ـ',
        'یییکههاااو01234567890123456789'),
      '[‌‍‎‏]', ' ', 'g'),
    '[[:space:][:punct:]]+', ' ', 'g'))
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION qafaseh_rebuild_book_search_index(target_catalog_book_id varchar)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM "BookSearchIndex" WHERE catalog_book_id = target_catalog_book_id;

  INSERT INTO "BookSearchIndex" (catalog_book_id, edition_id, kind, value_normalized, value_compact)
  SELECT target_catalog_book_id, source.edition_id, source.kind, normalized, replace(normalized, ' ', '')
  FROM (
    SELECT c.id AS catalog_book_id, NULL::varchar AS edition_id, 'CANONICAL_TITLE'::varchar AS kind, c.title AS value
      FROM "CatalogBook" c WHERE c.id = target_catalog_book_id AND c.status = 'APPROVED'
    UNION ALL SELECT c.id, NULL::varchar, 'ORIGINAL_TITLE', c.original_title FROM "CatalogBook" c WHERE c.id = target_catalog_book_id AND c.status = 'APPROVED'
    UNION ALL SELECT c.id, NULL::varchar, 'AUTHOR', c.author FROM "CatalogBook" c WHERE c.id = target_catalog_book_id AND c.status = 'APPROVED'
    UNION ALL SELECT c.id, NULL::varchar, 'GENRE', c.genre FROM "CatalogBook" c WHERE c.id = target_catalog_book_id AND c.status = 'APPROVED'
    UNION ALL SELECT be.catalog_book_id, be.id, 'EDITION_TITLE', be.title_override FROM "BookEdition" be WHERE be.catalog_book_id = target_catalog_book_id AND be.status = 'APPROVED'
    UNION ALL SELECT be.catalog_book_id, be.id, 'EDITION_LABEL', be.edition_label FROM "BookEdition" be WHERE be.catalog_book_id = target_catalog_book_id AND be.status = 'APPROVED'
    UNION ALL SELECT be.catalog_book_id, be.id, 'TRANSLATOR', be.translator FROM "BookEdition" be WHERE be.catalog_book_id = target_catalog_book_id AND be.status = 'APPROVED'
    UNION ALL SELECT be.catalog_book_id, be.id, 'PUBLISHER', be.publisher FROM "BookEdition" be WHERE be.catalog_book_id = target_catalog_book_id AND be.status = 'APPROVED'
    UNION ALL SELECT be.catalog_book_id, be.id, 'ISBN', coalesce(be.isbn13, be.isbn10, be.isbn) FROM "BookEdition" be WHERE be.catalog_book_id = target_catalog_book_id AND be.status = 'APPROVED'
    UNION ALL SELECT cbc.catalog_book_id, NULL::varchar, 'AUTHOR_REFERENCE', coalesce(r.name, r.original_name) FROM "CatalogBookContributor" cbc JOIN "ReferenceItem" r ON r.id = cbc.reference_item_id WHERE cbc.catalog_book_id = target_catalog_book_id AND cbc.role = 'AUTHOR'
    UNION ALL SELECT cbc.catalog_book_id, NULL::varchar, 'AUTHOR_ALIAS', r.original_name FROM "CatalogBookContributor" cbc JOIN "ReferenceItem" r ON r.id = cbc.reference_item_id WHERE cbc.catalog_book_id = target_catalog_book_id AND cbc.role = 'AUTHOR'
    UNION ALL SELECT be.catalog_book_id, be.id, 'TRANSLATOR_REFERENCE', coalesce(r.name, r.original_name) FROM "BookEditionContributor" bec JOIN "BookEdition" be ON be.id = bec.book_edition_id JOIN "ReferenceItem" r ON r.id = bec.reference_item_id WHERE be.catalog_book_id = target_catalog_book_id AND be.status = 'APPROVED' AND bec.role = 'TRANSLATOR'
    UNION ALL SELECT be.catalog_book_id, be.id, 'TRANSLATOR_ALIAS', r.original_name FROM "BookEditionContributor" bec JOIN "BookEdition" be ON be.id = bec.book_edition_id JOIN "ReferenceItem" r ON r.id = bec.reference_item_id WHERE be.catalog_book_id = target_catalog_book_id AND be.status = 'APPROVED' AND bec.role = 'TRANSLATOR'
    UNION ALL SELECT be.catalog_book_id, be.id, 'PUBLISHER_REFERENCE', coalesce(r.name, r.original_name) FROM "BookEditionPublisher" bep JOIN "BookEdition" be ON be.id = bep.book_edition_id JOIN "ReferenceItem" r ON r.id = bep.reference_item_id WHERE be.catalog_book_id = target_catalog_book_id AND be.status = 'APPROVED'
  ) source
  CROSS JOIN LATERAL (SELECT qafaseh_search_normalize(source.value) AS normalized) prepared
  WHERE source.value IS NOT NULL AND btrim(source.value) <> '' AND normalized <> '';
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION qafaseh_book_search_catalog_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM qafaseh_rebuild_book_search_index(COALESCE(NEW.id, OLD.id));
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION qafaseh_book_search_edition_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM qafaseh_rebuild_book_search_index(COALESCE(NEW.catalog_book_id, OLD.catalog_book_id));
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION qafaseh_book_search_relation_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id varchar;
BEGIN
  IF TG_TABLE_NAME = 'CatalogBookContributor' THEN target_id := COALESCE(NEW.catalog_book_id, OLD.catalog_book_id);
  ELSE SELECT catalog_book_id INTO target_id FROM "BookEdition" WHERE id = COALESCE(NEW.book_edition_id, OLD.book_edition_id);
  END IF;
  IF target_id IS NOT NULL THEN PERFORM qafaseh_rebuild_book_search_index(target_id); END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION qafaseh_book_search_reference_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id varchar;
BEGIN
  FOR target_id IN
    SELECT distinct catalog_book_id FROM (
      SELECT cbc.catalog_book_id FROM "CatalogBookContributor" cbc WHERE cbc.reference_item_id = COALESCE(NEW.id, OLD.id)
      UNION
      SELECT be.catalog_book_id FROM "BookEditionContributor" bec JOIN "BookEdition" be ON be.id = bec.book_edition_id WHERE bec.reference_item_id = COALESCE(NEW.id, OLD.id)
      UNION
      SELECT be.catalog_book_id FROM "BookEditionPublisher" bep JOIN "BookEdition" be ON be.id = bep.book_edition_id WHERE bep.reference_item_id = COALESCE(NEW.id, OLD.id)
    ) targets
  LOOP
    PERFORM qafaseh_rebuild_book_search_index(target_id);
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "BookSearchCatalogTrigger" ON "CatalogBook";
CREATE TRIGGER "BookSearchCatalogTrigger" AFTER INSERT OR UPDATE OR DELETE ON "CatalogBook" FOR EACH ROW EXECUTE FUNCTION qafaseh_book_search_catalog_trigger();
DROP TRIGGER IF EXISTS "BookSearchEditionTrigger" ON "BookEdition";
CREATE TRIGGER "BookSearchEditionTrigger" AFTER INSERT OR UPDATE OR DELETE ON "BookEdition" FOR EACH ROW EXECUTE FUNCTION qafaseh_book_search_edition_trigger();
DROP TRIGGER IF EXISTS "BookSearchCatalogContributorTrigger" ON "CatalogBookContributor";
CREATE TRIGGER "BookSearchCatalogContributorTrigger" AFTER INSERT OR UPDATE OR DELETE ON "CatalogBookContributor" FOR EACH ROW EXECUTE FUNCTION qafaseh_book_search_relation_trigger();
DROP TRIGGER IF EXISTS "BookSearchEditionContributorTrigger" ON "BookEditionContributor";
CREATE TRIGGER "BookSearchEditionContributorTrigger" AFTER INSERT OR UPDATE OR DELETE ON "BookEditionContributor" FOR EACH ROW EXECUTE FUNCTION qafaseh_book_search_relation_trigger();
DROP TRIGGER IF EXISTS "BookSearchEditionPublisherTrigger" ON "BookEditionPublisher";
CREATE TRIGGER "BookSearchEditionPublisherTrigger" AFTER INSERT OR UPDATE OR DELETE ON "BookEditionPublisher" FOR EACH ROW EXECUTE FUNCTION qafaseh_book_search_relation_trigger();
DROP TRIGGER IF EXISTS "BookSearchReferenceTrigger" ON "ReferenceItem";
CREATE TRIGGER "BookSearchReferenceTrigger" AFTER UPDATE OR DELETE ON "ReferenceItem" FOR EACH ROW EXECUTE FUNCTION qafaseh_book_search_reference_trigger();
--> statement-breakpoint
SELECT qafaseh_rebuild_book_search_index(id) FROM "CatalogBook";
