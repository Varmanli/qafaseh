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
import { ArrowUpDown } from "lucide-react";

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
        className="h-14 min-h-14 w-12 min-w-12 justify-center rounded-2xl border-border/70 bg-background/80 px-0 text-sm font-medium data-[state=open]:border-primary/50 data-[state=open]:bg-primary/10 data-[state=open]:text-primary sm:w-[140px] sm:min-w-[140px] sm:justify-between sm:px-3.5"
      >
        <ArrowUpDown className="size-[18px] sm:hidden" aria-hidden="true" />
        <span className="hidden sm:block"><SelectValue placeholder="مرتب‌سازی" /></span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="newest">جدیدترین</SelectItem>
        <SelectItem value="oldest">قدیمی‌ترین</SelectItem>
        <SelectItem value="shortest">زمان مطالعه کوتاه‌تر</SelectItem>
      </SelectContent>
    </Select>
  );
}
