"use client";

import ArchiveSortMenu from "@/components/archive/ArchiveSortMenu";
import { AUTHOR_ARCHIVE_SORT_OPTIONS, type AuthorArchiveSort } from "@/lib/reference/author-archive-search";

export default function AuthorArchiveSortMenu({ value, onChange }: { value: AuthorArchiveSort; onChange: (value: AuthorArchiveSort) => void }) {
  return <ArchiveSortMenu value={value} options={AUTHOR_ARCHIVE_SORT_OPTIONS} onChange={onChange} ariaLabel="مرتب‌سازی نویسنده‌ها" />;
}
