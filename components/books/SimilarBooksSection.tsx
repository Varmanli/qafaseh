import { BookOpen, Sparkles } from "lucide-react";

import ArchiveBookCard from "@/components/books/ArchiveBookCard";
import { Carousel } from "@/components/ui/Carousel";
import type { SimilarBook } from "@/lib/book/similar-books-service";

export default function SimilarBooksSection({ books }: { books: SimilarBook[] }) {
  if (!books.length) return null;

  return (
    <section aria-labelledby="similar-books-title" className="mt-8 border-t border-border/40 py-6 sm:mt-10 sm:py-8" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <h2 id="similar-books-title" className="text-base font-bold text-foreground sm:text-lg">اگر این کتاب رو دوست داشتی...</h2>
        <span className="shrink-0 text-xs text-muted-foreground">{books.length.toLocaleString("fa-IR")} کتاب</span>
      </div>
      <Carousel
        className="mt-4"
        ariaLabel="کتاب‌های پیشنهادی"
        align="start"
        slideClassName="w-[min(72vw,240px)] flex-none snap-start sm:w-[230px] lg:w-[240px]"
        containerClassName="gap-3 sm:gap-4"
        slides={books.map((book) => <ArchiveBookCard key={book.id} book={book} />)}
      />
    </section>
  );
}
