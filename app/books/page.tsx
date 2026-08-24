import type { Metadata } from "next";

import PublicShell from "@/components/PublicShell";
import BookArchiveFilters from "@/components/books/BookArchiveFilters";
import { getBookArchivePageData } from "@/lib/book/archive-service";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "آرشیو کتاب‌ها",
    description:
      "جست‌وجو، فیلتر و کشف کتاب‌های عمومی قفسه با مسیرهای کانونی مبتنی بر اسلاگ.",
    path: "/books",
  });
}

export default async function BooksArchivePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const { archive, filters, options } =
    await getBookArchivePageData(resolvedSearchParams);

  return (
    <PublicShell>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <BookArchiveFilters
          filters={filters}
          options={options}
          archive={archive}
          showDiscoveryHeader
        />
      </main>
    </PublicShell>
  );
}
