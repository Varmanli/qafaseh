import { BookOpen, Sparkles } from "lucide-react";

import ArchiveBookCard from "@/components/books/ArchiveBookCard";
import type { SimilarBook } from "@/lib/book/similar-books-service";

export default function SimilarBooksSection({ books }: { books: SimilarBook[] }) {
  if (!books.length) return null;

  return (
    <section aria-labelledby="similar-books-title" className="relative mt-10 overflow-hidden rounded-2xl border border-border/50 bg-card/50 p-4 backdrop-blur-md transition-colors hover:border-border/80 sm:mt-12 sm:p-5" dir="rtl">
      <div aria-hidden="true" className="pointer-events-none absolute -left-12 -top-16 size-40 rounded-full bg-primary/[0.05] blur-3xl" />
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Sparkles aria-hidden="true" className="size-4" /></span>
          <h2 id="similar-books-title" className="text-base font-bold text-foreground sm:text-lg">اگر این کتاب رو دوست داشتی...</h2>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-background/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"><BookOpen aria-hidden="true" className="size-3.5" /> {books.length.toLocaleString("fa-IR")} کتاب</span>
      </div>
      <div className="relative mt-4 grid grid-cols-2 gap-3 min-[430px]:gap-3.5 sm:mt-5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5 xl:grid-cols-5">
        {books.map((book) => <ArchiveBookCard key={book.id} book={book} />)}
      </div>
    </section>
  );
}
