import { BookMarked } from "lucide-react";

import ArchiveBookCard from "@/components/books/ArchiveBookCard";
import HomeSectionHeader from "@/components/home/HomeSectionHeader";
import { Carousel } from "@/components/ui/Carousel";
import type { HomeBookCard } from "@/lib/home/service";

export default function HomeBookCarousel({
  books,
  isFallback = false,
}: {
  books: HomeBookCard[];
  isFallback?: boolean;
}) {
  if (!books.length) return null;
  return (
    <section className="relative">
      <div className="mb-4 sm:mb-5">
        <HomeSectionHeader
          icon={BookMarked}
          title="کتاب های پیشنهادی"
          href="/books"
        />
      </div>

      <Carousel
        ariaLabel="کتاب‌های پیشنهادی"
        slideClassName="basis-[145px] sm:basis-[175px] lg:basis-[195px]"
        containerClassName="gap-4"
        slides={books.map((book) => (
          <ArchiveBookCard key={book.id} book={book} />
        ))}
      />
    </section>
  );
}
