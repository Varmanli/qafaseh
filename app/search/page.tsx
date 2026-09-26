import type { Metadata } from "next";

import SearchComponent from "@/components/SearchComponent";
import PublicShell from "@/components/PublicShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "جست‌وجوی سراسری | قفسه",
  description: "جست‌وجو در کتاب‌ها، نویسنده‌ها، مترجم‌ها و ناشرهای قفسه.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const query =
    (Array.isArray(params.q) ? params.q[0] : params.q)?.slice(0, 200) ?? "";

  return (
    <PublicShell>
      <main className="mx-auto min-h-[55dvh] w-full max-w-5xl px-4 py-6 pb-28 sm:px-6 sm:py-10 lg:pb-12">
        <SearchComponent
          variant="page"
          initialQuery={query}
          resultsHref="/books"
          placeholder="نام کتاب، نویسنده، مترجم یا ناشر..."
          className="mx-auto max-w-4xl"
        />
      </main>
    </PublicShell>
  );
}
