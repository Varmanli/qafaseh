import Link from "next/link";
import { FiStar } from "react-icons/fi";

import BookCoverImage from "@/components/books/BookCoverImage";
import { getPublicBookHref } from "@/lib/book/public-href";
import { resolveBookPresentation, type BookPresentationEdition } from "@/lib/book/presentation";
import { CONTRIBUTOR_ROLE_LABELS, type ContributorRole } from "@/lib/reference/contributor-roles";

export type ArchiveBookCardData = {
  id: string;
  slug: string | null;
  title: string;
  author: string;
  coverImage: string | null;
  displayEdition?: BookPresentationEdition | null;
  averageRating?: number | null;
  personRoles?: ContributorRole[];
};

export default function ArchiveBookCard({ book }: { book: ArchiveBookCardData }) {
  const presentation = resolveBookPresentation(book, book.displayEdition);
  const href = getPublicBookHref({ ...book, editionId: presentation.linkEditionId });
  const ratingLabel = book.averageRating != null ? book.averageRating.toLocaleString("fa-IR", { maximumFractionDigits: 1 }) : null;
  const editionMeta = [presentation.publisher, presentation.translator].filter(Boolean).join(" • ");
  const content = (
    <article className="group/card flex h-full flex-col rounded-[1.25rem] border border-border/90 bg-card p-2.5 shadow-[0_8px_26px_-18px_rgba(0,0,0,0.28)] transition-all duration-300 ease-out hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_18px_42px_-24px_rgba(0,0,0,0.4)] sm:rounded-[1.4rem] sm:p-3 dark:shadow-[0_10px_30px_-20px_rgba(0,0,0,0.85)] dark:hover:border-primary/40">
      <div className="relative overflow-hidden rounded-[1rem] bg-muted shadow-[0_8px_24px_-18px_rgba(0,0,0,0.55)] sm:rounded-[1.1rem]">
        <div className="relative aspect-[2/3]">
          <BookCoverImage src={presentation.coverImage} alt={presentation.title} fill sizes="(max-width: 640px) 44vw, (max-width: 1024px) 30vw, (max-width: 1280px) 23vw, 18vw" className="object-cover transition-transform duration-500 ease-out group-hover/card:scale-[1.025]" />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 via-black/10 to-transparent" />
        {ratingLabel ? <div className="absolute bottom-2 left-2 inline-flex h-7 items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-2.5 text-[10px] font-black text-white shadow-sm backdrop-blur-md sm:bottom-2.5 sm:left-2.5"><FiStar className="h-3 w-3 fill-amber-400 text-amber-400" /><span className="tabular-nums">{ratingLabel}</span></div> : null}
      </div>
      <div className="flex flex-1 flex-col px-1 pb-1 pt-3 text-right sm:px-1.5 sm:pt-3.5">
        <h2 className="line-clamp-2 min-h-[2.9rem] text-[13px] font-black leading-[1.5rem] tracking-tight text-foreground transition-colors duration-200 group-hover/card:text-primary sm:min-h-[3.15rem] sm:text-[14px] sm:leading-[1.6rem]">{presentation.title}</h2>
        <p className="mt-1.5 line-clamp-1 text-[11px] font-semibold text-muted-foreground sm:text-xs">{book.author || "نویسنده نامشخص"}</p>
        {book.personRoles?.length ? <p className="mt-1 line-clamp-1 text-[10px] font-medium text-primary/80 sm:text-[11px]">{book.personRoles.map((role) => CONTRIBUTOR_ROLE_LABELS[role]).join(" · ")}</p> : null}
        {presentation.linkEditionId && editionMeta ? <div className="mt-auto pt-3"><div className="border-t border-border/60 pt-2.5"><p className="line-clamp-1 text-[10px] font-medium text-muted-foreground/80 sm:text-[11px]">{editionMeta}</p></div></div> : null}
      </div>
    </article>
  );

  return href ? <Link href={href} className="block h-full rounded-[1.25rem] outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-3 focus-visible:ring-offset-background">{content}</Link> : content;
}
