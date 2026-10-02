import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowRight, NotebookPen } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { getBookOverview, getBookMetadata } from "@/lib/book/detail-service";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getPublishedNotesForBook } from "@/lib/notes/service";
import PublicShell from "@/components/PublicShell";
import BookCoverImage from "@/components/books/BookCoverImage";
import BookEditionSelector from "@/components/books/BookEditionSelector";
import ReferenceChip from "@/components/books/ReferenceChip";
import BookNotesList from "@/components/books/BookNotesList";

export const dynamic = "force-dynamic";

const PLACEHOLDER = "/placeholder-cover.svg";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const book = await getBookMetadata(decodeURIComponent(id));

  if (!book) {
    return { title: "یادداشت‌های کتاب | قفسه" };
  }

  return buildPageMetadata({
    title: `یادداشت‌های کتاب ${book.title}`,
    description: `یادداشت‌ها و برداشت‌های عمومی کاربران درباره کتاب ${book.title} در قفسه.`,
    path: `/book/${encodeURIComponent(book.slug)}/notes`,
    image: book.displayCoverImage,
    type: "book",
    keywords: [book.title, book.author, "یادداشت کتاب", "نقد و نظر کاربران"],
  });
}

export default async function BookNotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edition?: string }>;
}) {
  const { id } = await params;
  const { edition } = await searchParams;

  const ref = decodeURIComponent(id);
  const viewer = await getCurrentUser();
  const result = await getBookOverview(ref, viewer?.id, edition ?? null);

  if (!result.found) notFound();

  const {
    book,
    presentation,
    selectedEdition,
    editions,
    authorChip,
  } = result;

  if (ref !== book.slug) {
    permanentRedirect(
      `/book/${encodeURIComponent(book.slug)}/notes${
        selectedEdition?.id ? `?edition=${encodeURIComponent(selectedEdition.id)}` : ""
      }`,
    );
  }

  // Load paginated notes for book & edition (first 10 records)
  const [bookNotesResult, editionNotesResult] = await Promise.all([
    getPublishedNotesForBook({
      catalogBookId: book.id,
      viewerId: viewer?.id,
      scope: "book",
      limit: 10,
      offset: 0,
    }),
    selectedEdition?.id
      ? getPublishedNotesForBook({
          catalogBookId: book.id,
          viewerId: viewer?.id,
          scope: "edition",
          editionId: selectedEdition.id,
          limit: 10,
          offset: 0,
        })
      : Promise.resolve({ notes: [], hasMore: false }),
  ]);

  const isLoggedIn = !!viewer;
  const loginHref = `/auth/login?redirect=/book/${encodeURIComponent(book.slug)}/notes`;

  return (
    <PublicShell>
      <main className="relative mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10" dir="rtl">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(circle_at_top,rgba(128,167,150,0.1),transparent_52%)]" />

        <div className="space-y-6">
          {/* Back Link */}
          <div className="text-right">
            <Link
              href={`/book/${encodeURIComponent(book.slug)}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors group"
            >
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              بازگشت به صفحه کتاب
            </Link>
          </div>

          {/* Book Editorial Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-border/40">
            <div className="flex items-start gap-4">
              {/* Book Cover */}
              <div className="relative aspect-[3/4] w-16 shrink-0 overflow-hidden rounded-2xl border border-border/80 bg-background/40 sm:w-20 shadow-sm">
                <BookCoverImage
                  src={book.displayCoverImage || PLACEHOLDER}
                  alt={book.title}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>

              <div className="space-y-2 text-right">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-black text-foreground sm:text-xl leading-none">
                    {book.title}
                  </h1>
                  <span className="inline-flex items-center rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-black text-primary">
                    یادداشت‌ها
                  </span>
                </div>

                {book.originalTitle ? (
                  <p dir="ltr" className="text-xs text-muted-foreground text-right">
                    {book.originalTitle}
                  </p>
                ) : null}

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <ReferenceChip
                    name={authorChip.name}
                    href={authorChip.href}
                    image={authorChip.image}
                    size="sm"
                  />
                </div>
              </div>
            </div>

            {/* Edition Selector */}
            {editions.length > 1 ? (
              <div className="w-full max-w-sm sm:w-[320px] self-end md:self-auto">
                <BookEditionSelector
                  editions={editions}
                  selectedEditionId={selectedEdition?.id ?? null}
                />
              </div>
            ) : null}
          </div>

          {/* Paginated list with tabs */}
          <div className="mt-6">
            <BookNotesList
              catalogBookId={book.id}
              selectedEditionId={selectedEdition?.id ?? null}
              isLoggedIn={isLoggedIn}
              initialBookNotes={bookNotesResult.notes}
              initialEditionNotes={editionNotesResult.notes}
              initialBookHasMore={bookNotesResult.hasMore}
              initialEditionHasMore={editionNotesResult.hasMore}
              viewerId={viewer?.id ?? null}
              loginHref={loginHref}
              editionSummary={
                presentation.edition
                  ? {
                      label:
                        presentation.editionLabel ?? presentation.title ?? null,
                      publisher: presentation.publisher,
                      translator: presentation.translator,
                      publishedYear: presentation.publishedYear,
                    }
                  : null
              }
            />
          </div>
        </div>
      </main>
    </PublicShell>
  );
}
