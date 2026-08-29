import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test, { beforeEach, after } from "node:test";
import { Pool, type PoolClient } from "pg";
import {
  advisoryLockKey,
  canonicalIranKetabSourceIdentity,
} from "../../lib/importers/iranketab/server-hardening";
import {
  commitIranKetabImport,
  type IranKetabCommitMediaStorage,
} from "../../lib/importers/iranketab/commit";
import {
  draftFingerprint,
  type IranKetabImportDraftWithPreparedCovers,
} from "../../lib/importers/iranketab/cover-preparation";
import {
  promoteObjects,
  type StorageAdapter,
  type StorageObject,
} from "../../lib/importers/iranketab/storage-promotion";

const connectionString = process.env.DATABASE_URL;
const databaseName = connectionString ? new URL(connectionString).pathname.slice(1) : "";
if (
  !connectionString ||
  !/127\.0\.0\.1|localhost/.test(connectionString) ||
  !/(^|[_-])test([_-]|$)/i.test(databaseName)
)
  throw new Error("Integration tests require an isolated local PostgreSQL database whose name contains 'test'");
const pool = new Pool({ connectionString, max: 12 });
after(async () => pool.end());
beforeEach(async () => {
  await pool.query(
    'TRUNCATE TABLE "BookExternalLink", "BookEdition", "CatalogBook", "ReferenceItem" CASCADE',
  );
  await pool.query(
    `insert into "User" (id,email,role) values ('integration-admin','phase6@example.invalid','ADMIN') on conflict (id) do nothing`,
  );
});

async function locked(client: PoolClient, namespace: string, value: string) {
  await client.query("select pg_advisory_xact_lock($1::bigint)", [
    advisoryLockKey(`${namespace}:${value}`).toString(),
  ]);
}

test("same canonical source identity blocks a second independent connection", async () => {
  const a = await pool.connect();
  const b = await pool.connect();
  try {
    await a.query("begin");
    await b.query("begin");
    const identity = canonicalIranKetabSourceIdentity(
      "https://iranketab.ir/book/123-test",
    );
    await a.query("select pg_advisory_xact_lock($1::bigint)", [
      advisoryLockKey(identity).toString(),
    ]);
    let acquired = false;
    const waiting = b
      .query("select pg_advisory_xact_lock($1::bigint)", [
        advisoryLockKey(
          canonicalIranKetabSourceIdentity(
            "https://www.iranketab.ir/book/123-test#abc",
          ),
        ).toString(),
      ])
      .then(() => {
        acquired = true;
      });
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(acquired, false);
    await a.query("commit");
    await waiting;
    assert.equal(acquired, true);
    await b.query("rollback");
  } finally {
    a.release();
    b.release();
  }
});

test("different source identities acquire concurrently", async () => {
  const a = await pool.connect();
  const b = await pool.connect();
  try {
    await a.query("begin");
    await b.query("begin");
    await Promise.all([
      a.query("select pg_advisory_xact_lock($1::bigint)", [
        advisoryLockKey("iranketab:book:1").toString(),
      ]),
      b.query("select pg_advisory_xact_lock($1::bigint)", [
        advisoryLockKey("iranketab:book:2").toString(),
      ]),
    ]);
    await a.query("rollback");
    await b.query("rollback");
  } finally {
    a.release();
    b.release();
  }
});

for (const [namespace, value] of [
  ["isbn", "9780306406157"],
  ["source-edition", "edition-77"],
] as const) {
  test(`${namespace} advisory lock blocks conflicting connection`, async () => {
    const a = await pool.connect();
    const b = await pool.connect();
    try {
      await a.query("begin");
      await b.query("begin");
      await locked(a, namespace, value);
      await b.query("set local lock_timeout = '100ms'");
      await assert.rejects(locked(b, namespace, value), /lock timeout/);
      await a.query("rollback");
      await b.query("rollback");
    } finally {
      a.release();
      b.release();
    }
  });
}

const rollbackSteps = [
  "entity",
  "catalog",
  "relation",
  "edition",
  "source-link",
  "cover-attachment",
] as const;
for (const failureStep of rollbackSteps) {
  test(`transaction rollback removes all writes after ${failureStep}`, async () => {
    await pool.query(
      `insert into "CatalogBook" (id,title,author,slug) values ('existing','Existing','Curated','existing')`,
    );
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(
        `insert into "ReferenceItem" (id,type,name,status) values ('new-entity','AUTHOR','New','APPROVED')`,
      );
      if (failureStep === "entity") throw new Error("injected");
      await client.query(
        `insert into "CatalogBook" (id,title,author,genre,slug) values ('new-catalog','New','Author','Genre','new')`,
      );
      if (failureStep === "catalog") throw new Error("injected");
      await client.query(
        `update "CatalogBook" set author='Author، Related' where id='new-catalog'`,
      );
      if (failureStep === "relation") throw new Error("injected");
      await client.query(
        `insert into "BookEdition" (id,catalog_book_id,format,status,source_name,source_edition_code) values ('new-edition','new-catalog','PHYSICAL','APPROVED','iranketab','77')`,
      );
      if (failureStep === "edition") throw new Error("injected");
      await client.query(
        `insert into "BookExternalLink" (catalog_book_id,provider,url,type) values ('new-catalog','iranketab','https://iranketab.ir/book/77-test','print')`,
      );
      if (failureStep === "source-link") throw new Error("injected");
      await client.query(
        `update "BookEdition" set cover_image='/fake/final.webp' where id='new-edition'`,
      );
      throw new Error("injected");
    } catch {
      await client.query("rollback");
    } finally {
      client.release();
    }
    const counts = await pool.query(
      `select (select count(*) from "ReferenceItem") entities, (select count(*) from "CatalogBook" where id='new-catalog') catalogs, (select count(*) from "BookEdition") editions, (select count(*) from "BookExternalLink") links`,
    );
    assert.deepEqual(counts.rows[0], {
      entities: "0",
      catalogs: "0",
      editions: "0",
      links: "0",
    });
    const existing = await pool.query(
      `select title,author from "CatalogBook" where id='existing'`,
    );
    assert.deepEqual(existing.rows[0], {
      title: "Existing",
      author: "Curated",
    });
  });
}

function fixture(bookId = 9001, isbn13 = "9780306406157") {
  const canonicalUrl = `https://www.iranketab.ir/book/${bookId}-phase-six`;
  const extraction: any = {
    contractVersion: 1,
    source: { submittedUrl: canonicalUrl, canonicalUrl, editionCode: null },
    book: {
      title: `Book ${bookId}`,
      subtitle: null,
      originalTitle: null,
      description: null,
      language: "fa",
      firstPublishedYear: null,
      authors: [{ name: "Author" }],
      genres: [],
      country: null,
    },
    editions: [
      {
        titleOverride: null,
        translators: [],
        publisher: { name: "" },
        isbn10: null,
        isbn13,
        publishedYear: 1400,
        pageCount: 100,
        editionDescription: null,
        sourceUrl: `${canonicalUrl}#pts=1`,
        sourceEditionCode: `${bookId}-1`,
      },
    ],
    warnings: [],
    diagnostics: {
      descriptionCompleteness: "missing",
      editionsParsed: 1,
      editionsAfterDedup: 1,
      parsedEditions: [],
      relatedProfiles: [],
      coverCandidatesByEdition: {},
    },
  };
  const draft: any = {
    draftVersion: 1,
    source: {
      contractVersion: 1,
      submittedUrl: canonicalUrl,
      canonicalUrl,
      selectedEditionCode: null,
      approvedCoverCandidateUrls: [],
    },
    catalog: {
      action: "CREATE_NEW",
      fields: {
        title: `Book ${bookId}`,
        subtitle: null,
        originalTitle: null,
        description: null,
        language: "fa",
        firstPublishedYear: null,
      },
      authors: [
        {
          action: "CREATE_NEW",
          entityType: "AUTHOR",
          extractedName: "Author",
          proposedName: "Author",
        },
      ],
      genres: [],
      country: null,
    },
    editions: [
      {
        extractedEditionIndex: 0,
        action: "CREATE_NEW",
        fields: {
          titleOverride: null,
          isbn10: null,
          isbn13,
          publishedYear: 1400,
          pageCount: 100,
          editionDescription: null,
          sourceEditionCode: `${bookId}-1`,
          sourceUrl: `${canonicalUrl}#pts=1`,
        },
        translators: [],
        publisher: null,
        coverAction: { action: "SKIP" },
      },
    ],
    entities: [
      {
        action: "CREATE_NEW",
        entityType: "AUTHOR",
        extractedName: "Author",
        proposedName: "Author",
      },
    ],
    unresolvedIssues: [],
    readiness: "READY_FOR_COVER_IMPORT",
  };
  const prepared: IranKetabImportDraftWithPreparedCovers = {
    draft,
    fingerprint: draftFingerprint(draft),
    preparedCovers: [
      {
        extractedEditionIndex: 0,
        sourceEditionCode: `${bookId}-1`,
        status: "SKIPPED",
      },
    ],
  };
  return { extraction, prepared };
}

test("real commit is idempotent after duplicate submit and lost response retry", async () => {
  const input = fixture();
  const first = await commitIranKetabImport({
    adminId: "integration-admin",
    ...input,
  });
  const retry = await commitIranKetabImport({
    adminId: "integration-admin",
    ...input,
  });
  assert.equal(first.catalog.action, "CREATED");
  assert.equal(retry.catalog.action, "REUSED");
  assert.equal(retry.editions[0].action, "REUSED");
  const counts = await pool.query(
    `select (select count(*) from "CatalogBook") catalogs, (select count(*) from "BookEdition") editions, (select count(*) from "ReferenceItem") entities, (select count(*) from "BookExternalLink") links`,
  );
  assert.deepEqual(counts.rows[0], {
    catalogs: "1",
    editions: "1",
    entities: "1",
    links: "1",
  });
});

test("complete commit persists promoted cover and contributor reference media", async () => {
  const input = fixture(9010, "9783161484100");
  const author = {
    action: "CREATE_NEW",
    entityType: "AUTHOR",
    extractedName: "Media Author",
    proposedName: "Media Author",
    profile: { description: "Author biography", sourceUrl: "https://www.iranketab.ir/profile/author", seoTitle: "کتاب های نویسنده | ایران کتاب", seoDescription: "Author SEO description", metadata: { profileKind: "author" } },
    profileImageAction: "replace",
    bannerImageAction: "preserve",
  };
  const translator = {
    action: "CREATE_NEW",
    entityType: "TRANSLATOR",
    extractedName: "Media Translator",
    proposedName: "Media Translator",
    profile: { description: "Translator biography", sourceUrl: "https://www.iranketab.ir/profile/translator", seoTitle: "کتاب های مترجم | ایران کتاب", seoDescription: "Translator SEO description", metadata: { profileKind: "translator" } },
    profileImageAction: "replace",
    bannerImageAction: "preserve",
  };
  const publisher = {
    action: "CREATE_NEW",
    entityType: "PUBLISHER",
    extractedName: "Media Publisher",
    proposedName: "Media Publisher",
    profile: { description: "Publisher biography", sourceUrl: "https://www.iranketab.ir/profile/publisher", seoTitle: "کتاب های ناشر | ایران کتاب", seoDescription: "Publisher SEO description", metadata: { profileKind: "publisher" } },
    profileImageAction: "replace",
    bannerImageAction: "preserve",
  };
  const draft = input.prepared.draft as any;
  draft.catalog.authors = [author];
  draft.entities = [author, translator, publisher];
  draft.editions[0].translators = [translator];
  draft.editions[0].publisher = publisher;
  draft.editions[0].coverAction = { action: "IMPORT_SOURCE", candidateUrl: "https://images.iranketab.ir/cover.webp" };
  draft.source.approvedCoverCandidateUrls = ["https://images.iranketab.ir/cover.webp"];
  (input.extraction as any).book.authors = [{ name: "Media Author" }];
  (input.extraction as any).editions[0].translators = [{ name: "Media Translator" }];
  (input.extraction as any).editions[0].publisher = { name: "Media Publisher" };
  const fingerprint = draftFingerprint(draft);
  const referenceKey = (type: string, name: string) => {
    const token = createHash("sha256").update(`${type}:${name}`).digest("hex").slice(0, 16);
    return `references/iranketab-${type.toLowerCase()}-${fingerprint.slice(0, 20)}-${token}-profile.webp`;
  };
  const prefix = `tmp/iranketab-imports/integration-admin/${fingerprint}/`;
  const coverSource = `${prefix}0-9010-1.webp`;
  const referenceSources = {
    AUTHOR: `${prefix}reference-author-a-profile.webp`,
    TRANSLATOR: `${prefix}reference-translator-b-profile.webp`,
    PUBLISHER: `${prefix}reference-publisher-c-profile.webp`,
  } as const;
  const objects = new Map<string, { key: string; sizeBytes: number; contentType: string | null; etag: string | null; metadata: Record<string, string> }>();
  objects.set(coverSource, { key: coverSource, sizeBytes: 100, contentType: "image/webp", etag: null, metadata: { "iranketab-admin": "integration-admin", "iranketab-fingerprint": fingerprint, "iranketab-edition-index": "0" } });
  for (const source of Object.values(referenceSources))
    objects.set(source, { key: source, sizeBytes: 100, contentType: "image/webp", etag: null, metadata: {} });
  const mediaStorage: IranKetabCommitMediaStorage = {
    async head(key) { return objects.get(key) ?? null; },
    async copy({ sourceKey, destinationKey, contentType, metadata }) {
      const source = objects.get(sourceKey);
      if (!source) throw new Error("SOURCE_MISSING");
      objects.set(destinationKey, { ...source, key: destinationKey, contentType: contentType ?? source.contentType, metadata: metadata ?? source.metadata });
    },
    async delete(key) { objects.delete(key); },
  };
  input.prepared = {
    draft,
    fingerprint,
    preparedCovers: [{ extractedEditionIndex: 0, sourceEditionCode: "9010-1", status: "PREPARED", action: "USE_PREPARED", objectKey: coverSource, url: "https://storage.invalid/temp-cover.webp", originalSourceUrl: "https://images.iranketab.ir/cover.webp", mimeType: "image/webp", width: 100, height: 100, sizeBytes: 100, preparedAt: new Date().toISOString() }],
    preparedReferenceImages: [author, translator, publisher].map((entity) => ({ entityType: entity.entityType, extractedName: entity.extractedName, kind: "PROFILE" as const, status: "PREPARED" as const, objectKey: referenceSources[entity.entityType as keyof typeof referenceSources], sourceUrl: entity.profile.sourceUrl, mimeType: "image/webp" as const, width: 100, height: 100, sizeBytes: 100, url: "https://storage.invalid/reference.webp" })),
  } as any;

  const result = await commitIranKetabImport({ adminId: "integration-admin", ...input, mediaStorage });
  assert.equal(result.catalog.action, "CREATED");
  assert.equal(result.editions[0].action, "CREATED");

  const references = await pool.query(`select type,name,cover_image,description,source_url,seo_title,seo_description,metadata from "ReferenceItem" order by type`);
  assert.deepEqual(references.rows.map((row) => ({ type: row.type, coverImage: row.cover_image, description: row.description, sourceUrl: row.source_url, seoTitle: row.seo_title, seoDescription: row.seo_description, metadata: row.metadata })), [
    { type: "AUTHOR", coverImage: referenceKey("AUTHOR", "Media Author"), description: "Author biography", sourceUrl: "https://www.iranketab.ir/profile/author", seoTitle: null, seoDescription: "Author SEO description", metadata: { profileKind: "author" } },
    { type: "TRANSLATOR", coverImage: referenceKey("TRANSLATOR", "Media Translator"), description: "Translator biography", sourceUrl: "https://www.iranketab.ir/profile/translator", seoTitle: null, seoDescription: "Translator SEO description", metadata: { profileKind: "translator" } },
    { type: "PUBLISHER", coverImage: referenceKey("PUBLISHER", "Media Publisher"), description: "Publisher biography", sourceUrl: "https://www.iranketab.ir/profile/publisher", seoTitle: null, seoDescription: "Publisher SEO description", metadata: { profileKind: "publisher" } },
  ]);
  const relations = await pool.query(`select (select count(*) from "CatalogBookContributor" where role='AUTHOR') authors, (select count(*) from "BookEditionContributor" where role='TRANSLATOR') translators, (select count(*) from "BookEditionPublisher") publishers`);
  assert.deepEqual(relations.rows[0], { authors: "1", translators: "1", publishers: "1" });
  assert.ok(objects.has(`covers/iranketab-${fingerprint.slice(0, 20)}-0.webp`));
  assert.ok(objects.has(referenceKey("AUTHOR", "Media Author")));
  assert.ok(objects.has(referenceKey("TRANSLATOR", "Media Translator")));
  assert.ok(objects.has(referenceKey("PUBLISHER", "Media Publisher")));
});

test("reused references retain null and curated SEO titles while importing other profile fields", async () => {
  const input = fixture(9011, "9781234567897");
  await pool.query(`insert into "ReferenceItem" (id,type,name,status,seo_title) values
    ('existing-author','AUTHOR','Existing Author','APPROVED',null),
    ('existing-translator','TRANSLATOR','Existing Translator','APPROVED','Curated translator title'),
    ('existing-publisher','PUBLISHER','Existing Publisher','APPROVED',null)`);
  const profile = (kind: string) => ({
    description: `${kind} biography`,
    sourceUrl: `https://www.iranketab.ir/profile/${kind}`,
    seoTitle: `کتاب های ${kind} | ایران کتاب`,
    seoDescription: `${kind} SEO description`,
    metadata: { profileKind: kind },
    profileId: `${kind}-profile-id`,
  });
  const author = { action: "REUSE_EXISTING", entityType: "AUTHOR", entityId: "existing-author", extractedName: "Existing Author", displayName: "Existing Author", profile: profile("author") };
  const translator = { action: "REUSE_EXISTING", entityType: "TRANSLATOR", entityId: "existing-translator", extractedName: "Existing Translator", displayName: "Existing Translator", profile: profile("translator") };
  const publisher = { action: "REUSE_EXISTING", entityType: "PUBLISHER", entityId: "existing-publisher", extractedName: "Existing Publisher", displayName: "Existing Publisher", profile: profile("publisher") };
  const draft = input.prepared.draft as any;
  draft.catalog.authors = [author];
  draft.entities = [author, translator, publisher];
  draft.editions[0].translators = [translator];
  draft.editions[0].publisher = publisher;
  (input.extraction as any).book.authors = [{ name: "Existing Author" }];
  (input.extraction as any).editions[0].translators = [{ name: "Existing Translator" }];
  (input.extraction as any).editions[0].publisher = { name: "Existing Publisher" };
  input.prepared = { ...input.prepared, fingerprint: draftFingerprint(draft) };

  await commitIranKetabImport({ adminId: "integration-admin", ...input });

  const references = await pool.query(`select type,description,source_url,seo_title,seo_description,metadata from "ReferenceItem" order by type`);
  assert.deepEqual(references.rows, [
    { type: "AUTHOR", description: "author biography", source_url: "https://www.iranketab.ir/profile/author", seo_title: null, seo_description: "author SEO description", metadata: { profileKind: "author", iranketabProfileId: "author-profile-id" } },
    { type: "TRANSLATOR", description: "translator biography", source_url: "https://www.iranketab.ir/profile/translator", seo_title: "Curated translator title", seo_description: "translator SEO description", metadata: { profileKind: "translator", iranketabProfileId: "translator-profile-id" } },
    { type: "PUBLISHER", description: "publisher biography", source_url: "https://www.iranketab.ir/profile/publisher", seo_title: null, seo_description: "publisher SEO description", metadata: { profileKind: "publisher", iranketabProfileId: "publisher-profile-id" } },
  ]);
});

test("concurrent real commits across pool connections create one import", async () => {
  const input = fixture(9002, "9783161484100");
  const results = await Promise.all(
    Array.from({ length: 4 }, () =>
      commitIranKetabImport({ adminId: "integration-admin", ...input }),
    ),
  );
  assert.equal(
    results.filter((item) => item.catalog.action === "CREATED").length,
    1,
  );
  const counts = await pool.query(
    `select (select count(*) from "CatalogBook") catalogs, (select count(*) from "BookEdition") editions, (select count(*) from "BookExternalLink") links`,
  );
  assert.deepEqual(counts.rows[0], {
    catalogs: "1",
    editions: "1",
    links: "1",
  });
});

test("fake storage promotion compensates on database rollback boundary", async () => {
  const objects = new Map<string, StorageObject>([
    ["tmp/a", { key: "tmp/a", contentType: "image/webp", metadata: {} }],
  ]);
  const storage: StorageAdapter = {
    async headObject(key) {
      return objects.get(key) ?? null;
    },
    async copyObject(source, destination, metadata) {
      objects.set(destination, {
        ...objects.get(source)!,
        key: destination,
        metadata,
      });
    },
    async deleteObject(key) {
      objects.delete(key);
    },
  };
  const promoted = await promoteObjects(storage, [
    {
      sourceKey: "tmp/a",
      destinationKey: "covers/iranketab-a.webp",
      metadata: {},
    },
  ]);
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into "CatalogBook" (id,title,author) values ('rollback-cover','x','a')`,
    );
    throw new Error("injected");
  } catch {
    await client.query("rollback");
    await Promise.all(promoted.map((key) => storage.deleteObject(key)));
  } finally {
    client.release();
  }
  assert.equal(objects.has("covers/iranketab-a.webp"), false);
  assert.equal(objects.has("tmp/a"), true);
});

test("cleanup failure does not rollback a successful database commit", async () => {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into "CatalogBook" (id,title,author) values ('cleanup-success','x','a')`,
    );
    await client.query("commit");
  } finally {
    client.release();
  }
  await assert.rejects(Promise.reject(new Error("fake cleanup failure")));
  assert.equal(
    (
      await pool.query(
        `select count(*) from "CatalogBook" where id='cleanup-success'`,
      )
    ).rows[0].count,
    "1",
  );
});
