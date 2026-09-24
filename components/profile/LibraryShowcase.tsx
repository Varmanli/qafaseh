import { LibraryBig } from "lucide-react";

import ShelfPreviewColumn, {
  type ShelfBook,
} from "@/components/profile/ShelfPreviewColumn";
import type { ReadingStats } from "@/lib/profile/service";

interface ShowcaseBook extends ShelfBook {
  status: string;
}

const STATUS = {
  finished: "FINISHED",
  unread: "UNREAD",
  reading: "READING",
} as const;

export default function LibraryShowcase({
  books,
  username,
  stats,
}: {
  books: ShowcaseBook[];
  username: string;
  stats: ReadingStats;
}) {
  const getBooksByStatus = (status: string) =>
    books.filter((book) => book.status === status);

  const unread = Math.max(stats.total - stats.reading - stats.finished, 0);

  const getHref = (filter: string) => `/books/${username}?filter=${filter}`;

  const shelves = [
    {
      title: "خوانده‌شده",
      count: stats.finished,
      books: getBooksByStatus(STATUS.finished),
      href: getHref(STATUS.finished),
      accentClassName: "text-lime-300",
    },
    {
      title: "خوانده‌نشده",
      count: unread,
      books: getBooksByStatus(STATUS.unread),
      href: getHref(STATUS.unread),
      accentClassName: "text-foreground",
    },
    {
      title: "درحال خواندن",
      count: stats.reading,
      books: getBooksByStatus(STATUS.reading),
      href: getHref(STATUS.reading),
      accentClassName: "text-sky-300",
    },
  ];

  return (
    <section className="min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <LibraryBig className="h-[18px] w-[18px] shrink-0 text-primary sm:h-5 sm:w-5" />

          <div className="min-w-0">
            <h2 className="truncate text-sm font-black tracking-tight text-foreground sm:text-base">
              کتابخانه
            </h2>
          </div>
        </div>

      </div>

      {/* Shelves */}
      <div className="mt-4 grid min-w-0 grid-cols-3 items-stretch gap-2 sm:mt-5 sm:gap-3">
        {shelves.map((shelf) => (
          <div key={shelf.title} className="min-w-0 h-full">
            <ShelfPreviewColumn
              title={shelf.title}
              count={shelf.count}
              books={shelf.books}
              href={shelf.href}
              accentClassName={shelf.accentClassName}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
