import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Pool } from "pg";

// Opt in against a local database. All fixtures live in a unique, isolated schema.
test("category cover persistence, public counts and article navigation", { skip: !process.env.MAGAZINE_TEST_DATABASE_URL }, async (t) => {
  const url = new URL(process.env.MAGAZINE_TEST_DATABASE_URL!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
  const schema = `magazine_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: url.toString() });
  let appPool: Pool | undefined;
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    for (const table of ["BlogCategory", "BlogPost", "User", "BlogPostBook", "CatalogBook"]) {
      await admin.query(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
    }
    url.searchParams.set("options", `-csearch_path=${schema}`);
    process.env.DATABASE_URL = url.toString();
    const { db, pool } = await import("@/db");
    appPool = pool;
    const { BlogCategory, BlogPost } = await import("@/db/schema");
    const service = await import("./service");

    await t.test("migration applies repeatedly without losing categories", async () => {
      await pool.query('ALTER TABLE "BlogCategory" DROP COLUMN cover_image');
      const migration = readFileSync("drizzle/0079_blog_category_covers.sql", "utf8");
      await pool.query(migration);
      await pool.query(migration);
    });
    const first = await service.createBlogCategory({ name: "قفسه فارسی", coverImage: "https://example.com/original.webp" });
    const other = await service.createBlogCategory({ name: "قفسه دیگر" });

    await t.test("cover changes preserve the slug and omitted covers; null removes the image", async () => {
      assert.equal((await service.getBlogCategoryById(first.id))?.coverImage, "https://example.com/original.webp");
      await service.updateBlogCategory(first.id, { name: "نام تازه", coverImage: "https://example.com/replaced.webp" });
      await service.updateBlogCategory(first.id, { name: "نام نهایی" });
      const saved = await service.getBlogCategoryById(first.id);
      assert.equal(saved?.slug, first.slug);
      assert.equal(saved?.coverImage, "https://example.com/replaced.webp");
      assert.equal((await service.getPublicBlogCategoryBySlug(encodeURIComponent(first.slug)))?.name, "نام نهایی");
      await service.updateBlogCategory(first.id, { name: "نام نهایی", coverImage: null });
      assert.equal((await service.getBlogCategoryById(first.id))?.coverImage, null);
      await service.updateBlogCategory(first.id, { name: "نام نهایی", coverImage: "/uploads/blog/local.webp" });
      assert.ok((await service.listBlogCategoryOptions()).find((item) => item.id === first.id)?.coverImage);
    });

    await db.insert(BlogPost).values([
      ...Array.from({ length: 12 }, (_, index) => ({
        title: `مقاله ${index}`, slug: `article-${index}`, categoryId: first.id,
        content: "متن مقاله", bannerImage: "/placeholder-cover.svg", status: "PUBLISHED" as const,
        publishedAt: new Date(2026, 0, index + 1), readingTime: index + 1,
      })),
      { title: "پیش‌نویس", slug: "draft", categoryId: first.id, content: "متن", bannerImage: "/placeholder-cover.svg", status: "DRAFT", publishedAt: new Date() },
      { title: "بدون تاریخ", slug: "undated", categoryId: first.id, content: "متن", bannerImage: "/placeholder-cover.svg", status: "PUBLISHED" },
      { title: "مقاله دسته دیگر", slug: "other-article", categoryId: other.id, content: "متن", bannerImage: "/placeholder-cover.svg", status: "PUBLISHED", publishedAt: new Date() },
    ]);

    await t.test("public cards count only visible articles, including empty categories", async () => {
      await db.insert(BlogCategory).values({ name: "خالی", slug: "empty" });
      const cards = await service.listPublicBlogCategories();
      assert.equal(cards.find((item) => item.id === first.id)?.postCount, 12);
      assert.equal(cards.find((item) => item.id === other.id)?.postCount, 1);
      assert.equal(cards.find((item) => item.slug === "empty")?.postCount, 0);
    });

    await t.test("pagination shows every article exactly once and keeps categories isolated", async () => {
      const page1 = await service.listPublicBlogPosts({ categorySlug: first.slug, page: 1 });
      const page2 = await service.listPublicBlogPosts({ categorySlug: first.slug, page: 2 });
      assert.equal(page1.total, 12);
      assert.equal(page1.posts.length, 9);
      assert.equal(page2.posts.length, 3);
      const posts = [...page1.posts, ...page2.posts];
      assert.equal(new Set(posts.map((post) => post.id)).size, 12);
      assert.ok(posts.every((post) => post.categorySlug === first.slug));
      const search = await service.listPublicBlogPosts({ categorySlug: first.slug, q: "مقاله 11", page: 1 });
      assert.equal(search.total, 1);
      assert.equal(search.posts[0]?.slug, "article-11");
      const oldest = await service.listPublicBlogPosts({ categorySlug: first.slug, sort: "oldest", page: 1 });
      assert.equal(oldest.posts[0]?.slug, "article-0");
      const shortest = await service.listPublicBlogPosts({ categorySlug: first.slug, sort: "shortest", page: 1 });
      assert.equal(shortest.posts[0]?.readingTime, 1);
      const empty = await service.listPublicBlogPosts({ categorySlug: "empty", page: 1 });
      assert.equal(empty.total, 0);
    });
  } finally {
    await appPool?.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  }
});
