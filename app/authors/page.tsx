import type { Metadata } from "next";

import PublicShell from "@/components/PublicShell";
import AuthorsArchivePage from "@/components/reference/AuthorsArchivePage";
import { getAuthorArchive } from "@/lib/reference/author-archive";
import { AUTHOR_ARCHIVE_PAGE_SIZE, parseAuthorArchiveSearchParams } from "@/lib/reference/author-archive-search";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "نویسنده‌ها",
    description: "نویسنده‌های قفسه را پیدا کن و کتاب‌هایی را ببین که نوشته‌اند.",
    path: "/authors",
  });
}

export default async function AuthorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const filters = parseAuthorArchiveSearchParams(resolvedSearchParams);
  const result = await getAuthorArchive(filters, AUTHOR_ARCHIVE_PAGE_SIZE);

  return (
    <PublicShell>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <AuthorsArchivePage initialFilters={filters} result={result} />
      </main>
    </PublicShell>
  );
}
