import Link from "next/link";
import { BookOpen } from "lucide-react";

import BookCoverImage from "@/components/books/BookCoverImage";

const PLACEHOLDER = "/placeholder-cover.svg";

export interface ShelfBook {
  id: string;
  title: string;
  coverImage: string | null;
}

export default function ShelfPreviewColumn({
  title,
  count,
  books,
  href,
}: {
  title: string;
  count: number;
  books: ShelfBook[];
  href: string;
}) {
  const covers = books.slice(0, 4);
  const emptySlots = Math.max(0, 4 - covers.length);

  return (
    <Link
      href={href}
      aria-label={`${title} (${count})`}
      className="group flex min-w-0 flex-col text-center"
    >
      <span className="grid min-w-0 grid-cols-2 gap-1.5 rounded-2xl bg-surface-2 p-2 sm:gap-2.5 sm:rounded-[1.6rem] sm:p-4 lg:gap-1.5 lg:rounded-2xl lg:p-2.5">
        {covers.map((book) => (
          <span
            key={book.id}
            className="relative aspect-[2/3] min-w-0 overflow-hidden rounded-lg bg-background/60 sm:rounded-xl lg:rounded-lg"
          >
            <BookCoverImage
              src={book.coverImage || PLACEHOLDER}
              alt={book.title}
              fill
              sizes="(min-width: 1024px) 73px, (min-width: 640px) 15vw, 13vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.025]"
            />
          </span>
        ))}
        {Array.from({ length: emptySlots }, (_, index) => (
          <span
            key={`empty-${index}`}
            aria-hidden="true"
            className="flex aspect-[2/3] min-w-0 items-center justify-center rounded-lg bg-background/45 text-muted-foreground/35 sm:rounded-xl lg:rounded-lg"
          >
            <BookOpen className="h-5 w-5 sm:h-8 sm:w-8 lg:h-5 lg:w-5" strokeWidth={1.4} />
          </span>
        ))}
      </span>

      <span className="mt-2 block truncate text-[11px] font-bold text-foreground sm:mt-4 sm:text-xl lg:mt-2 lg:text-sm">
        {title}
      </span>
      <span className="mt-0.5 block text-[10px] text-muted-foreground sm:mt-1 sm:text-base lg:mt-0.5 lg:text-xs">
        {count.toLocaleString("fa-IR")} کتاب
      </span>
    </Link>
  );
}
