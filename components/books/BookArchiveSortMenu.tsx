"use client";

import ArchiveSortMenu from "@/components/archive/ArchiveSortMenu";
import { BOOK_ARCHIVE_SORT_OPTIONS, type BookArchiveFilters } from "@/lib/book/archive-search";

export default function BookArchiveSortMenu({ value, onChange }: { value: BookArchiveFilters["sort"]; onChange: (value: BookArchiveFilters["sort"]) => void }) {
  return <ArchiveSortMenu value={value} options={BOOK_ARCHIVE_SORT_OPTIONS} onChange={onChange} ariaLabel="مرتب‌سازی کتاب‌ها" />;
}
