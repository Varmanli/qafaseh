import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import {
  FiArchive,
  FiArrowLeft,
  FiBookOpen,
  FiCalendar,
  FiClock,
  FiEdit3,
  FiHeart,
  FiMapPin,
  FiStar,
  FiUserCheck,
  FiUserPlus,
} from "react-icons/fi";

import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";
import { getBookDetail } from "@/lib/book/detail-service";
import PublicShell from "@/components/PublicShell";
import ReadingStatusControl from "@/components/books/ReadingStatusControl";
import BookReadingTour from "@/components/onboarding/BookReadingTour";
import BookNotesTour from "@/components/onboarding/BookNotesTour";
import ReferenceChip from "@/components/books/ReferenceChip";
import MetaAvatar from "@/components/books/MetaAvatar";
import BookQuotesSection from "@/components/books/BookQuotesSection";
import BookNotesTabsSection from "@/components/books/BookNotesTabsSection";
import BookEditionSelector from "@/components/books/BookEditionSelector";
import BookExternalLinksPanel from "@/components/books/BookExternalLinksPanel";
import BookCoverImage from "@/components/books/BookCoverImage";
import BookShare from "@/components/books/BookShare";
import BookIntroduction from "@/components/books/BookIntroduction";
import MyBookNotesSummary from "@/components/books/MyBookNotesSummary";
import SimilarBooksSection from "@/components/books/SimilarBooksSection";
import { countPersonalBookNotes } from "@/lib/reading-notes/service";
import { getPublicReadingListsForBook } from "@/lib/book/reading-lists-service";
import RelatedMagazineArticles from "@/components/blog/RelatedMagazineArticles";
import { getMagazineArticlesForBook } from "@/lib/blog/service";
import { getSimilarBooks } from "@/lib/book/similar-books-service";
import { buildPageMetadata } from "@/lib/seo/metadata";
import {
  buildBreadcrumbJsonLd,
  serializeJsonLd,
} from "@/lib/seo/structured-data";
import { toAbsoluteUrl } from "@/lib/seo/site";
import { encodeShortBookKey } from "@/lib/book/short-link";

export const dynamic = "force-dynamic";

const PLACEHOLDER = "/placeholder-cover.svg";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await getBookDetail(decodeURIComponent(id));

  if (!result.found) {
    return { title: "کتاب پیدا نشد | قفسه" };
  }

  const { book } = result;
  const description =
    book.description
      ?.replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim() ||
    `معرفی، نقل‌قول‌ها و اطلاعات کتاب ${book.title} نوشته ${book.author} در قفسه.`;

  return buildPageMetadata({
    title: `${book.title} اثر ${book.author}`,
    description,
    path: `/book/${encodeURIComponent(book.slug)}`,
    image: book.displayCoverImage,
    type: "book",
    keywords: [
      book.title,
      book.author,
      ...book.genres.map((genre) => genre.name),
    ],
  });
}

export default async function BookPage({
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
  const result = await getBookDetail(ref, viewer?.id, edition ?? null);

  if (!result.found) notFound();

  const {
    book,
    presentation,
    selectedEdition,
    editions,
    viewer: entry,
    stats,
    topMoods,
    refLinks,
    refImages,
    authorChip,
    authorChips,
    translatorChip,
    translatorChips,
    publisherChip,
    quotes,
    quoteCount,
    bookNotes,
    bookNotesCount,
    editionNotes,
    editionNotesCount,
    externalLinks,
  } = result;

  if (ref !== book.slug) {
    permanentRedirect(
      `/book/${encodeURIComponent(book.slug)}${
        selectedEdition?.id
          ? `?edition=${encodeURIComponent(selectedEdition.id)}`
          : ""
      }`,
    );
  }

  const isLoggedIn = !!viewer;
  const loginHref = `/auth/login?redirect=/book/${encodeURIComponent(book.slug)}`;

  const genreList = book.genres.map((genre) => genre.name);
  const [magazinePosts, similarBooks, readingLists, personalNotesCount] =
    await Promise.all([
    getMagazineArticlesForBook(book.id),
    getSimilarBooks(book.id),
    getPublicReadingListsForBook(book.id),
    viewer && entry
      ? countPersonalBookNotes(entry.id, viewer.id)
      : Promise.resolve(null),
  ]);
  const analysisPost = magazinePosts.find((post) =>
    /خلاصه|تحلیل/.test(post.title + " " + (post.excerpt ?? "")),
  );
  const deeperPosts = magazinePosts.filter((post) => post.id !== analysisPost?.id);
  const visibleGenres = genreList.slice(0, 3);
  const hiddenGenres = genreList.slice(3);

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "قفسه", url: toAbsoluteUrl("/") },
    { name: "کتاب‌ها", url: toAbsoluteUrl("/books") },
    {
      name: book.title,
      url: toAbsoluteUrl(`/book/${encodeURIComponent(book.slug)}`),
    },
  ]);

  const bookJsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title,
    alternateName: book.originalTitle || undefined,
    description:
      book.description
        ?.replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim() || undefined,
    image: book.displayCoverImage
      ? [toAbsoluteUrl(book.displayCoverImage)]
      : undefined,
    inLanguage: book.language || "fa",
    numberOfPages: presentation.pageCount ?? undefined,
    datePublished:
      presentation.publishedYear != null
        ? String(presentation.publishedYear)
        : book.firstPublishedYear != null
          ? String(book.firstPublishedYear)
          : undefined,
    author: [{ "@type": "Person", name: book.author }],
    translator: presentation.translator
      ? [{ "@type": "Person", name: presentation.translator }]
      : undefined,
    publisher: presentation.publisher
      ? { "@type": "Organization", name: presentation.publisher }
      : undefined,
    genre: genreList.length > 0 ? genreList : undefined,
    aggregateRating:
      stats.averageRating != null && stats.ratingCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: stats.averageRating,
            ratingCount: stats.ratingCount,
            bestRating: 10,
            worstRating: 1,
          }
        : undefined,
    mainEntityOfPage: toAbsoluteUrl(`/book/${encodeURIComponent(book.slug)}`),
  };

  const { wantToReadCount, readingCount, finishedCount } = stats;

  const metaItems: ReactNode[] = [
    <BookMetaItem
      key="viewer-rating"
      icon={<FiStar className="h-4 w-4" />}
      label="امتیاز تو"
      onboardingTarget="book-rating"
      value={
        entry?.rating != null
          ? `${entry.rating.toLocaleString("fa-IR")} از ۱۰`
          : "—"
      }
    />,
    book.country && (
      <BookMetaItem
        key="country"
        icon={<FiMapPin className="h-4 w-4" />}
        label="کشور"
        value={book.country}
        valueAvatar={
          <MetaAvatar
            image={refImages.country}
            name={book.country}
            fallback={<FiMapPin />}
          />
        }
        href={
          refLinks.country
            ? `/countries/${encodeURIComponent(refLinks.country)}`
            : undefined
        }
      />
    ),
    presentation.translator && (
      <BookMetaItem
        key="translator"
        icon={<FiEdit3 className="h-4 w-4" />}
        label="مترجم"
        value={presentation.translator}
        valueAvatar={
          <MetaAvatar
            image={translatorChip?.image}
            name={presentation.translator}
            fallback={<FiEdit3 />}
          />
        }
        href={translatorChip?.href ?? undefined}
      />
    ),
    presentation.publisher && (
      <BookMetaItem
        key="publisher"
        icon={<FiArchive className="h-4 w-4" />}
        label="ناشر"
        value={presentation.publisher}
        valueAvatar={
          <MetaAvatar
            image={publisherChip?.image}
            name={presentation.publisher}
            fallback={<FiArchive />}
          />
        }
        href={
          refLinks.publisher
            ? `/publishers/${encodeURIComponent(refLinks.publisher)}`
            : undefined
        }
      />
    ),
    presentation.pageCount != null && (
      <BookMetaItem
        key="pageCount"
        icon={<FiBookOpen className="h-4 w-4" />}
        label="تعداد صفحه"
        value={presentation.pageCount.toLocaleString("fa-IR")}
      />
    ),
    presentation.publishedYear != null && (
      <BookMetaItem
        key="publishedYear"
        icon={<FiCalendar className="h-4 w-4" />}
        label="سال چاپ"
        value={presentation.publishedYear.toLocaleString("fa-IR", {
          useGrouping: false,
        })}
      />
    ),
    book.firstPublishedYear != null && (
      <BookMetaItem
        key="firstPublishedYear"
        icon={<FiCalendar className="h-4 w-4" />}
        label="نخستین انتشار"
        value={book.firstPublishedYear.toLocaleString("fa-IR")}
      />
    ),
  ].filter(Boolean);

  return (
    <PublicShell>
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:py-8">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(breadcrumbJsonLd),
          }}
        />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(bookJsonLd),
          }}
        />

        <section className="rounded-2xl border border-border/60 bg-card/45 p-4 sm:p-6 lg:p-8">
          <div
            dir="ltr"
            className="relative flex flex-col gap-8 pt-2 lg:grid lg:min-h-[520px] lg:grid-cols-[280px_minmax(0,1fr)_260px] lg:items-center lg:gap-10 lg:pt-0 xl:grid-cols-[300px_minmax(0,1fr)_280px] xl:gap-12"
          >
            <aside
              dir="rtl"
              id="book-actions"
              className="order-3 w-full lg:order-1 lg:w-[280px] xl:w-[300px]"
            >
              <div>
                <div className="grid gap-2.5">
                  {editions.length > 1 ? (
                    <>
                      <BookEditionSelector
                        editions={editions}
                        selectedEditionId={selectedEdition?.id ?? null}
                      />
                      {presentation.edition ? (
                        <p className="px-1 text-[11px] font-bold leading-5 text-muted-foreground">
                          در حال مشاهده:{" "}
                          {[
                            presentation.editionLabel,
                            presentation.publisher,
                            presentation.translator,
                          ]
                            .filter(Boolean)
                            .join(" • ") || "نسخه انتخاب‌شده"}
                        </p>
                      ) : null}
                    </>
                  ) : null}

                  <ReadingStatusControl
                    subjectBookId={book.id}
                    bookTitle={book.title}
                    viewer={entry}
                    isLoggedIn={isLoggedIn}
                    loginHref={loginHref}
                    averageRating={stats.averageRating}
                    selectedEditionId={selectedEdition?.id ?? null}
                    hidePersonalRating
                  />
                  <BookShare
                    title={book.title}
                    originalTitle={book.originalTitle}
                    author={book.author}
                    translator={presentation.translator}
                    coverImage={book.displayCoverImage}
                    canonicalUrl={toAbsoluteUrl(`/book/${encodeURIComponent(book.slug)}`)}
                    shareUrl={toAbsoluteUrl(`/b/${encodeShortBookKey(book.id)}`)}
                    status={entry?.status}
                    rating={entry?.rating}
                  />
                </div>

                {externalLinks.length > 0 ? (
                  <div className="mt-4 border-t border-border/60 pt-4">
                    <BookExternalLinksPanel links={externalLinks} />
                  </div>
                ) : null}
              </div>
            </aside>

            <div
              dir="rtl"
              className="order-2 min-w-0 text-center lg:order-2 lg:text-right"
            >
              <p className="text-xs font-medium text-muted-foreground">
                {genreList.length
                  ? visibleGenres.join(" · ") +
                    (hiddenGenres.length ? " · " + hiddenGenres.length.toLocaleString("fa-IR") + " ژانر دیگر" : "")
                  : "کتاب"}
              </p>

              <h1 className="mt-3 text-2xl font-black leading-[1.35] tracking-tight text-foreground sm:text-4xl lg:max-w-3xl lg:text-[2.8rem]">
                {book.title}
              </h1>

              {book.originalTitle ? (
                <p
                  dir="ltr"
                  className="mt-3 text-sm font-semibold tracking-wide text-muted-foreground/85 lg:text-right"
                >
                  {book.originalTitle}
                </p>
              ) : null}

              <div className="mt-5 flex flex-col items-center gap-3 lg:items-start">
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 lg:justify-start">
                  {authorChips.map((chip) => (
                    <ReferenceChip
                      key={`${chip.name}-${chip.href ?? ""}`}
                      name={chip.name}
                      href={chip.href}
                      image={chip.image}
                    />
                  ))}
                  {translatorChips.map((chip) => (
                    <ReferenceChip
                      key={`translator-${chip.name}-${chip.href ?? ""}`}
                      name={chip.name}
                      href={chip.href}
                      image={chip.image}
                    />
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                  <div className="inline-flex items-center gap-2 text-sm">
                    <FiStar
                      className={
                        stats.averageRating != null
                          ? "h-4 w-4 text-amber-500 dark:text-amber-400"
                          : "h-4 w-4 text-muted-foreground"
                      }
                    />

                    {stats.averageRating != null ? (
                      <>
                        <span className="font-bold tabular-nums text-foreground">
                          {stats.averageRating.toLocaleString("fa-IR")} از ۱۰
                        </span>

                        <span className="text-xs text-muted-foreground">
                          ({stats.ratingCount.toLocaleString("fa-IR")} امتیاز)
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-medium text-muted-foreground">
                          امتیاز این کتاب
                        </span>

                        <span className="font-bold text-muted-foreground">
                          —
                        </span>
                      </>
                    )}
                  </div>

                  {topMoods.length > 0 ? (
                    <div className="text-xs text-muted-foreground">
                      {topMoods.slice(0, 3).join(" · ")}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 overflow-hidden pb-1">
                <div className="mx-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 sm:gap-2.5 lg:mx-0 lg:justify-start">
                  <BookMiniStat
                    icon={<FiUserPlus className="h-3 w-3 sm:h-4 sm:w-4" />}
                    value={wantToReadCount}
                    label="می‌خواهند بخوانند"
                  />

                  <BookMiniStat
                    icon={<FiClock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                    value={readingCount}
                    label="درحال خواندن"
                  />

                  <BookMiniStat
                    icon={<FiUserCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                    value={finishedCount}
                    label="خوانده‌اند"
                  />

                  {entry?.isFavorite ? (
                    <span className="inline-flex h-7 max-w-full shrink-0 items-center gap-1.5 rounded-full border border-rose-300/25 bg-rose-500/10 px-2.5 text-[10px] font-bold text-foreground shadow-[0_18px_45px_-34px_rgba(244,63,94,0.8)] backdrop-blur sm:h-auto sm:gap-2 sm:px-3.5 sm:py-2 sm:text-xs">
                      <FiHeart className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400 sm:h-4 sm:w-4" />
                      علاقه‌مندی تو
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <aside
              dir="rtl"
              className="order-1 mx-auto w-full max-w-[230px] shrink-0 sm:max-w-[250px] lg:order-3 lg:mx-0 lg:w-[260px] lg:max-w-none xl:w-[280px]"
            >
              <div className="relative">
                <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-secondary/40 ring-1 ring-border/70">
                  <BookCoverImage
                    src={book.displayCoverImage || PLACEHOLDER}
                    alt={book.title}
                    fill
                    sizes="(min-width: 1280px) 280px, (min-width: 1024px) 260px, (min-width: 640px) 250px, 230px"
                    className="object-cover"
                    priority
                  />

                </div>
              </div>
            </aside>
          </div>

          {metaItems.length ? (
            <div className="mt-6 grid grid-cols-2 gap-x-4 border-t border-border/40 pt-4 sm:grid-cols-3 lg:grid-cols-4">
              {metaItems}
            </div>
          ) : null}
        </section>
        <BookPageNavigation
          hasAbout={Boolean(book.description || analysisPost)}
          hasPersonalNotes={isLoggedIn}
          hasMagazinePosts={deeperPosts.length > 0}
          hasSimilarBooks={similarBooks.length > 0}
          hasReadingLists={readingLists.length > 0}
        />
        {book.description || analysisPost ? (
          <section id="about" className="scroll-mt-28 border-b border-border/40 py-6 sm:py-8">
            <BookIntroduction content={book.description} flat />
            {analysisPost ? (
              <Link href={"/blog/" + encodeURIComponent(analysisPost.slug)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                خلاصه کامل و تحلیل کتاب <FiArrowLeft className="h-4 w-4" />
              </Link>
            ) : null}
          </section>
        ) : null}
        <div id="quotes" className="scroll-mt-28">
          <BookQuotesSection
            subjectBookId={book.id}
            viewerEntryId={entry?.id ?? null}
            viewerIsAdmin={isAdmin(viewer)}
            isLoggedIn={isLoggedIn}
            quotes={quotes}
            totalQuoteCount={quoteCount}
            viewAllHref={`/book/${encodeURIComponent(book.slug)}/quotes`}
            flat
          />
        </div>

        <div id="community-notes" className="scroll-mt-28">
          <BookNotesTabsSection
            catalogBookId={book.id}
            selectedEditionId={selectedEdition?.id ?? null}
            isLoggedIn={isLoggedIn}
            bookNotes={bookNotes}
            bookNotesCount={bookNotesCount}
            editionNotes={editionNotes}
            editionNotesCount={editionNotesCount}
            flat
            viewerId={viewer?.id ?? null}
            editionNotesHref={
              selectedEdition?.id
                ? "/book/" + encodeURIComponent(book.slug) + "/notes?edition=" + encodeURIComponent(selectedEdition.id)
                : undefined
            }
            viewAllHref={`/book/${encodeURIComponent(book.slug)}/notes`}
          />
        </div>
        {isLoggedIn ? (
          <MyBookNotesSummary bookSlug={book.slug} notesCount={personalNotesCount} />
        ) : null}
        {deeperPosts.length > 0 ? (
          <div id="magazine-content" className="scroll-mt-28">
            <RelatedMagazineArticles posts={deeperPosts} />
          </div>
        ) : null}
        <div id="more-books" className="scroll-mt-28">
          <SimilarBooksSection books={similarBooks} />
        </div>
        {readingLists.length ? <RelatedBookReadingLists lists={readingLists} /> : null}
        <BookReadingTour isAuthenticated={isLoggedIn} />
        <BookNotesTour isAuthenticated={isLoggedIn && Boolean(entry)} />
      </div>
    </PublicShell>
  );
}

function BookPageNavigation({
  hasAbout,
  hasPersonalNotes,
  hasMagazinePosts,
  hasSimilarBooks,
  hasReadingLists,
}: {
  hasAbout: boolean;
  hasPersonalNotes: boolean;
  hasMagazinePosts: boolean;
  hasSimilarBooks: boolean;
  hasReadingLists: boolean;
}) {
  const links = [
    hasAbout ? { href: "#about", label: "درباره" } : null,
    { href: "#quotes", label: "تکه‌ها" },
    { href: "#community-notes", label: "یادداشت‌ها" },
    hasPersonalNotes ? { href: "#my-notes", label: "یادداشت‌های من" } : null,
    hasMagazinePosts ? { href: "#magazine-content", label: "مطالب مرتبط" } : null,
    hasSimilarBooks ? { href: "#more-books", label: "کتاب‌های مرتبط" } : null,
    hasReadingLists ? { href: "#reading-lists", label: "فهرست‌ها" } : null,
  ].filter((item): item is { href: string; label: string } => Boolean(item));

  return (
    <nav aria-label="بخش‌های صفحه کتاب" className="sticky top-14 z-20 -mx-4 mt-3 border-b border-border/40 bg-background/90 px-4 backdrop-blur sm:top-16 sm:mx-0 sm:px-2">
      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max min-w-full items-center gap-5 py-3 sm:gap-6">
          {links.map((item) => (
            <a key={item.href} href={item.href} className="shrink-0 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:text-sm">
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}

function RelatedBookReadingLists({
  lists,
}: {
  lists: Array<{ id: string; slug: string; title: string; subtitle: string | null }>;
}) {
  return (
    <section id="reading-lists" aria-labelledby="book-reading-lists-title" className="border-t border-border/40 py-6 sm:py-8">
      <h2 id="book-reading-lists-title" className="text-base font-bold text-foreground sm:text-lg">این کتاب در فهرست‌ها</h2>
      <ul className="mt-3 max-w-3xl divide-y divide-border/30">
        {lists.map((list) => (
          <li key={list.id}>
            <Link href={"/lists/" + encodeURIComponent(list.slug)} className="flex items-center justify-between gap-4 py-3 text-sm transition-colors hover:text-primary">
              <span className="min-w-0">
                <span className="block font-semibold">{list.title}</span>
                {list.subtitle ? <span className="mt-1 block truncate text-xs text-muted-foreground">{list.subtitle}</span> : null}
              </span>
              <FiArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BookMiniStat({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: number;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground sm:text-xs">
      <span className="shrink-0">{icon}</span>
      <span className="font-bold tabular-nums text-foreground">{value.toLocaleString("fa-IR")}</span>
      <span>{label}</span>
    </span>
  );
}

function BookMetaItem({
  icon,
  label,
  value,
  valueAvatar,
  href,
  onboardingTarget,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  valueAvatar?: ReactNode;
  href?: string;
  onboardingTarget?: string;
}) {
  const className =
    "group flex min-w-0 items-center gap-2 border-b border-border/30 py-2 text-right";

  const inner = (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex shrink-0 text-muted-foreground [&_svg]:h-3.5 [&_svg]:w-3.5">
          {icon}
        </span>

        <span className="shrink-0 text-[11px] text-muted-foreground">
          {label}
        </span>
        {valueAvatar}
        <span
          className={
            "line-clamp-1 min-w-0 text-xs font-bold text-foreground" +
            (href ? " transition-colors group-hover:text-primary" : "")
          }
        >
          {value}
        </span>
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        data-onboarding={onboardingTarget}
        className={className}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div data-onboarding={onboardingTarget} className={className}>
      {inner}
    </div>
  );
}
