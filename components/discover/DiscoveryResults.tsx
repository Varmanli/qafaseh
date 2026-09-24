import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import BookCoverImage from "@/components/books/BookCoverImage";
import type { ArchiveBookCardData } from "@/components/books/ArchiveBookCard";
import { getPublicBookHref } from "@/lib/book/public-href";

export default function DiscoveryResults({
  id,
  title,
  books,
  backHref = "/discover/mood",
  showChangeLink = true,
}: {
  id?: string;
  title: string;
  books: ArchiveBookCardData[];
  backHref?: string;
  showChangeLink?: boolean;
}) {
  const found = books;

  return (
    <section id={id} className="scroll-mt-24" role="region" aria-live="polite" aria-label={title}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-black sm:text-xl">{title}</h2>
        {found.length > 0 && <span className="text-xs text-muted-foreground">{found.length.toLocaleString("fa-IR")} کتاب</span>}
      </div>
      {found.length ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {found.map((book, index) => {
            const href = getPublicBookHref(book);
            if (!href) return null;
            return (
              <Link key={book.id} href={href} className="group min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-muted shadow-[0_16px_30px_-18px_rgba(0,0,0,0.55)] transition-transform duration-200 group-hover:-translate-y-1">
                  <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-sm font-black text-muted-foreground/50">قفسه</span>
                  <BookCoverImage src={book.coverImage} alt="" fill sizes="(max-width: 640px) 44vw, 180px" className="object-cover" />
                </div>
                <p className="mt-2 text-[11px] font-black tabular-nums text-primary">{(index + 1).toLocaleString("fa-IR")}</p>
                <p className="mt-0.5 line-clamp-2 text-sm font-black leading-6 transition-colors group-hover:text-primary">{book.title}</p>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{book.author}</p>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="rounded-2xl border border-border/60 bg-card p-5 text-sm leading-7 text-muted-foreground">فعلاً کتابی برای این انتخاب در دسترس نیست. یک حال‌وهوا یا موضوع دیگر را امتحان کن.</p>
      )}
      {showChangeLink && <Link href={backHref} className="mt-6 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary">
        تغییر انتخاب <ArrowLeft aria-hidden="true" className="size-4" />
      </Link>}
    </section>
  );
}
