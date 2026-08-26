"use client";

import { useRouter } from "next/navigation";

import {
  buildBlogArchiveHref,
  type BlogArchiveSort,
} from "@/components/blog/blog-archive";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    <Select
      value={sort}
      onValueChange={(value) =>
        router.push(
          buildBlogArchiveHref({
            q,
            category,
            sort: value as BlogArchiveSort,
          }),
        )
      }
    >
      <SelectTrigger
        size="default"
        aria-label="مرتب‌سازی مقالات"
        className="h-14 min-h-14 w-[140px] min-w-[140px] rounded-2xl border-border/70 bg-background/80 px-3.5 text-sm font-medium"
      >
        <SelectValue placeholder="مرتب‌سازی" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="newest">جدیدترین</SelectItem>
        <SelectItem value="oldest">قدیمی‌ترین</SelectItem>
        <SelectItem value="shortest">زمان مطالعه کوتاه‌تر</SelectItem>
      </SelectContent>
    </Select>
  );
}
