import type { Metadata } from "next";

import SearchComponent from "@/components/SearchComponent";
import PublicShell from "@/components/PublicShell";
import { countPublicUsers, searchPublicUsers } from "@/lib/search/user-search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "جست‌وجوی سراسری | قفسه",
  description: "جست‌وجو در کتاب‌ها، پدیدآورها، ناشرها، مجله و کاربران قفسه.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; tab?: string | string[]; page?: string | string[] }>;
}) {
  const params = await searchParams;
  const query =
    (Array.isArray(params.q) ? params.q[0] : params.q)?.slice(0, 200) ?? "";
  const tab = (Array.isArray(params.tab) ? params.tab[0] : params.tab) === "users" ? "users" : "books";
  const rawPage = Number(Array.isArray(params.page) ? params.page[0] : params.page);
  const requestedPage = Number.isFinite(rawPage) ? Math.max(1, Math.trunc(rawPage)) : 1;
  const userTotal = tab === "users" ? await countPublicUsers(query) : 0;
  const userPageCount = Math.max(1, Math.ceil(userTotal / 20));
  const userPage = Math.min(requestedPage, userPageCount);
  const fullUsers = tab === "users" ? {
    items: await searchPublicUsers(query, 20, (userPage - 1) * 20),
    total: userTotal,
    page: userPage,
    pageCount: userPageCount,
  } : undefined;

  return (
    <PublicShell>
      <main className="mx-auto min-h-[55dvh] w-full max-w-5xl px-4 py-6 pb-36 sm:px-6 sm:py-10 lg:pb-12">
        <SearchComponent
          variant="page"
          initialQuery={query}
          initialTab={tab}
          fullUsers={fullUsers}
          resultsHref="/books"
          placeholder="نام کتاب، پدیدآور، ناشر، مطلب مجله یا کاربر..."
          className="mx-auto max-w-4xl"
        />
      </main>
    </PublicShell>
  );
}
