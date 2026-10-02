import Link from "next/link";
import { ArrowUpLeft, Library } from "lucide-react";

import BookCoverImage from "@/components/books/BookCoverImage";
import { cn } from "@/lib/utils";

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
  accentClassName = "text-primary",
}: {
  title: string;
  count: number;
  books: ShelfBook[];
  href: string;
  accentClassName?: string;
}) {
  const covers = books.slice(0, 4);
  const emptySlots = Math.max(0, 4 - covers.length);

  return (
    <Link
      href={href}
      aria-label={`${title} (${count})`}
      className="
        group
        relative
        flex
        h-full
        min-w-0
        flex-col
        overflow-hidden
        rounded-2xl
        border
        border-border/80
        bg-background/45
        p-1.5
        shadow-[0_18px_55px_-44px_rgba(0,0,0,0.42)]
        transition-all
        duration-300
        hover:-translate-y-0.5
        hover:border-primary/25
        hover:bg-background/60
        sm:rounded-[1.55rem]
        sm:p-4
      "
    >
      {/* Header */}
      <div className="relative flex min-w-0 items-center justify-between gap-1.5">
        <div className="min-w-0">
          <h3 className="truncate text-[9px] font-black text-foreground sm:text-sm">
            {title}
          </h3>
        </div>

        <span
          className={cn(
            "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-border/80 bg-card/70 px-1 text-[8px] font-black tabular-nums sm:h-8 sm:min-w-8 sm:px-2 sm:text-[11px]",
            accentClassName,
          )}
        >
          {count.toLocaleString("fa-IR")}
        </span>
      </div>

      {/* Covers */}
      <div className="relative mt-2 grid min-h-0 min-w-0 flex-1 grid-cols-2 grid-rows-2 gap-1 sm:mt-4 sm:gap-2.5">
        {covers.length === 0 ? (
          <EmptyShelf />
        ) : (
          <>
            {covers.map((book) => (
              <span
                key={book.id}
                className="
      relative
      min-h-0
      min-w-0
      overflow-hidden
      rounded-md
      border
      border-border/80
      bg-card/85
      shadow-[0_12px_25px_-18px_rgba(0,0,0,0.8)]
      ring-1
      ring-black/20
      transition-transform
      duration-300
      group-hover:-translate-y-0.5
      sm:rounded-xl
    "
              >
                <div className="relative h-full min-h-[52px] w-full sm:min-h-[250px]">
                  <BookCoverImage
                    src={book.coverImage || PLACEHOLDER}
                    alt={book.title}
                    fill
                    sizes="(min-width: 1280px) 180px, 16vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />
                </div>
              </span>
            ))}
            {Array.from({ length: emptySlots }).map((_, index) => (
              <span
                key={`empty-${index}`}
                aria-hidden="true"
                className="
                  relative
                  min-h-[72px]
                  min-w-0
                  overflow-hidden
                  rounded-md
                  border
                  border-dashed
                  border-border/70
                  bg-white/[0.025]
                  sm:min-h-[120px]
                  sm:rounded-xl
                "
              />
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="relative mt-1.5 flex items-center justify-between border-t border-border/70 pt-1.5 sm:mt-3 sm:pt-3">
        <span className="truncate text-[8px] font-bold text-muted-foreground sm:text-[11px]">
          ورود به قفسه
        </span>

        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/15 transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 sm:h-7 sm:w-7 sm:rounded-xl">
          <ArrowUpLeft className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        </span>
      </div>
    </Link>
  );
}

function EmptyShelf() {
  return (
    <div className="col-span-2 row-span-2 flex h-full min-h-[145px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 bg-background/30 px-2 text-center sm:min-h-[250px] sm:rounded-xl">
      <Library className="h-5 w-5 text-muted-foreground sm:h-6 sm:w-6" />

      <span className="text-[9px] font-bold text-muted-foreground sm:text-[11px]">
        هنوز کتابی نیست
      </span>
    </div>
  );
}
