import Link from "next/link";

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

  const unread = stats.wantToRead;

  const getHref = (filter: string) => `/books/${username}?filter=${filter}`;

  const shelves = [
    {
      title: "خوانده‌ام",
      count: stats.finished,
      books: getBooksByStatus(STATUS.finished),
      href: getHref(STATUS.finished),
    },
    {
      title: "در حال خواندن",
      count: stats.reading,
      books: getBooksByStatus(STATUS.reading),
      href: getHref(STATUS.reading),
    },
    {
      title: "می‌خواهم بخوانم",
      count: unread,
      books: getBooksByStatus(STATUS.unread),
      href: getHref(STATUS.unread),
    },
  ];

  return (
    <section className="min-w-0">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-3 px-1 sm:mb-7 lg:mb-4">
        <h2 className="text-base font-black tracking-tight text-foreground sm:text-2xl lg:text-lg">
          کتابخانه
        </h2>
        <Link
          href={`/books/${encodeURIComponent(username)}`}
          className="text-xs font-bold text-primary transition-colors hover:text-primary/80 sm:text-base lg:text-xs"
        >
          نمایش کتابخانه
        </Link>
      </div>

      {/* Shelves */}
      <div className="grid min-w-0 grid-cols-3 items-start gap-2 sm:gap-4 lg:mx-auto lg:max-w-[540px] lg:gap-3">
        {shelves.map((shelf) => (
          <div key={shelf.title} className="h-full min-w-0">
            <ShelfPreviewColumn
              title={shelf.title}
              count={shelf.count}
              books={shelf.books}
              href={shelf.href}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
