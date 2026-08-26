export type BlogArchiveSort = "newest" | "oldest" | "shortest";

export function normalizeBlogArchiveSort(value?: string): BlogArchiveSort {
  return value === "oldest" || value === "shortest" ? value : "newest";
}

export function buildBlogArchiveHref({
  q = "",
  category = "",
  sort = "newest",
  page = 1,
}: {
  q?: string;
  category?: string;
  sort?: BlogArchiveSort;
  page?: number;
}) {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (category.trim()) params.set("category", category.trim());
  if (sort !== "newest") params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/blog?${query}` : "/blog";
}
