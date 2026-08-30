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
}: {
  q: string;
  category: string;
  sort: BlogArchiveSort;
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
          }),
        )
      }
    />
  );
}
