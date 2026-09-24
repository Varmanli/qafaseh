import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";

import BookCoverImage from "@/components/books/BookCoverImage";
import type { ReadingListPreview } from "@/lib/book/reading-lists-service";

export default function ReadingListCard({ list }: { list: ReadingListPreview }) {
  return (
    <Link
      href={`/lists/${list.slug}`}
      aria-label={`${list.title}، مشاهده ${list.mode === "ORDERED" ? "مسیر" : "مجموعه"}`}
      className="group relative isolate flex min-h-56 overflow-hidden rounded-[1.5rem] border border-border/60 bg-card shadow-sm outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-xl hover:shadow-primary/5 focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span aria-hidden="true" className="pointer-events-none absolute -left-12 -top-16 -z-10 size-44 rounded-full bg-primary/[0.05] blur-2xl transition-transform duration-300 group-hover:scale-125" />
      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span className="rounded-full border border-primary/15 bg-primary/[0.07] px-2.5 py-1 text-primary">{list.category}</span>
          <span className="text-muted-foreground/50" aria-hidden="true">·</span>
          <span className="text-muted-foreground">{list.bookCount.toLocaleString("fa-IR")} کتاب</span>
          <span className="text-muted-foreground/50" aria-hidden="true">·</span>
          <span className="text-muted-foreground">{list.mode === "ORDERED" ? "مسیر ترتیبی" : "مجموعه کتاب"}</span>
        </div>
        <h3 className="mt-3 text-base font-black leading-7 tracking-tight transition-colors group-hover:text-primary sm:text-lg">{list.title}</h3>
        <p className="mt-1 line-clamp-2 text-xs leading-6 text-muted-foreground sm:text-sm">{list.description}</p>
        <span className="mt-auto inline-flex min-h-10 items-end gap-1.5 pt-4 text-xs font-bold text-primary">
          {list.mode === "ORDERED" ? "دیدن مسیر مطالعه" : "دیدن مجموعه"} {list.mode === "ORDERED" && <ArrowLeft aria-hidden="true" className="size-4 transition-transform group-hover:-translate-x-1" />}
        </span>
      </div>
      <div aria-hidden="true" className="relative flex w-[38%] min-w-[6.5rem] shrink-0 flex-col items-center justify-center gap-2 overflow-hidden border-r border-border/50 bg-gradient-to-br from-primary/[0.09] via-primary/[0.035] to-transparent sm:w-[40%] sm:min-w-[10rem]">
        <span className="pointer-events-none absolute -left-12 -top-10 size-36 rounded-full border border-primary/[0.08]" />
        <span className="pointer-events-none absolute -bottom-16 -right-10 size-40 rounded-full bg-primary/[0.07] blur-2xl" />
        {list.previewBooks.length > 0 ? <div className="relative flex items-center justify-center -space-x-7 [direction:rtl] sm:-space-x-9">
          {list.previewBooks.slice(0, 3).map((book, bookIndex) => (
            <span key={book.id} className={`relative block aspect-[2/3] w-[3.35rem] overflow-hidden rounded-lg border-2 border-card bg-muted shadow-[0_12px_24px_-12px_rgba(0,0,0,0.65)] transition-transform duration-300 group-hover:-translate-y-1 sm:w-[5.25rem] ${bookIndex === 1 ? "-translate-y-2" : "translate-y-1"}`} style={{ zIndex: 3 - bookIndex }}>
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-muted-foreground/50">قفسه</span>
              <BookCoverImage src={book.coverImage} alt="" fill sizes="(max-width: 640px) 54px, 84px" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
            </span>
          ))}
        </div> : <BookOpen className="size-12 text-primary/25" />}
        {list.mode === "ORDERED" && <span dir="ltr" className="relative text-[10px] font-black tracking-wider text-primary/70">{[1, 2, 3].map((step) => step.toLocaleString("fa-IR", { minimumIntegerDigits: 2 })).join(" → ")}</span>}
      </div>
    </Link>
  );
}
