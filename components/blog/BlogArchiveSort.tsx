"use client";

import { useRouter } from "next/navigation";

import {
  buildBlogArchiveHref,
  type BlogArchiveSort,
} from "@/components/blog/blog-archive";
import ArchiveSortMenu from "@/components/archive/ArchiveSortMenu";

export default function BlogArchiveSort({
  q,
  category,
  sort,
  pathname = "/blog",
}: {
  q: string;
  category: string;
  sort: BlogArchiveSort;
  pathname?: string;
}) {
  const router = useRouter();

  return (
    <ArchiveSortMenu
      value={sort}
      ariaLabel="مرتب‌سازی مقالات"
      options={[
        { value: "newest", label: "جدیدترین" },
        { value: "oldest", label: "قدیمی‌ترین" },
        { value: "shortest", label: "زمان مطالعه کوتاه‌تر" },
      ]}
      onChange={(value) =>
        router.push(
          buildBlogArchiveHref({
            q,
            category,
            sort: value as BlogArchiveSort,
            pathname,
          }),
          { scroll: false },
        )
      }
    />
  );
}
