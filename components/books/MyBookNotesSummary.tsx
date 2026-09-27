import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function MyBookNotesSummary({
  bookSlug,
  notesCount,
}: {
  bookSlug: string;
  notesCount: number | null;
}) {
  const hasBookEntry = notesCount !== null;
  const href = hasBookEntry
    ? "/book/" + encodeURIComponent(bookSlug) + "/my"
    : "#book-actions";

  return (
    <section
      id="my-notes"
      aria-labelledby="my-book-notes-title"
      className="border-t border-border/40 py-5 sm:py-6"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 id="my-book-notes-title" className="text-sm font-bold text-foreground sm:text-base">
              یادداشت‌های من
            </h2>
            {hasBookEntry ? (
              <span className="text-xs text-muted-foreground">
                {notesCount
                  ? notesCount.toLocaleString("fa-IR") + " یادداشت درباره این کتاب نوشته‌ای"
                  : "هنوز درباره این کتاب چیزی ننوشته‌ای"}
              </span>
            ) : null}
          </div>
          {!hasBookEntry ? (
            <p className="mt-1 text-xs text-muted-foreground">
              برای یادداشت‌گذاشتن، اول کتاب را به قفسه‌ات اضافه کن.
            </p>
          ) : null}
        </div>
        <Link href={href} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-primary hover:bg-primary/5">
          {hasBookEntry && notesCount ? "مشاهده یادداشت‌ها" : hasBookEntry ? "نوشتن یادداشت" : "افزودن به قفسه"}
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
