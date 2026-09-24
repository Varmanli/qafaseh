import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import {
  FiArchive,
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
import { Carousel } from "@/components/ui/Carousel";
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
import SimilarBooksSection from "@/components/books/SimilarBooksSection";
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
    bookNotes,
    editionNotes,
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
  const [magazinePosts, similarBooks] = await Promise.all([
    getMagazineArticlesForBook(book.id),
    getSimilarBooks(book.id),
  ]);
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

        <section className="relative overflow-hidden rounded-[2.25rem] border border-border/70 bg-card/95 p-4 shadow-[0_30px_100px_-70px_rgba(0,0,0,0.55)] backdrop-blur-xl dark:bg-[#101815]/90 dark:shadow-[0_36px_120px_-64px_rgba(0,0,0,0.95)] sm:p-6 lg:p-8 xl:p-10">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-primary/25 to-transparent dark:via-white/20" />

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_22%,rgba(128,167,150,0.16),transparent_34%),radial-gradient(circle_at_18%_70%,rgba(43,98,82,0.10),transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.35),transparent_45%,rgba(128,167,150,0.06))] dark:bg-[radial-gradient(circle_at_82%_22%,rgba(128,167,150,0.18),transparent_34%),radial-gradient(circle_at_18%_70%,rgba(43,98,82,0.16),transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.035),transparent_45%,rgba(128,167,150,0.04))]" />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.16] dark:opacity-[0.22]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(128,167,150,0.22) 1px, transparent 0)",
              backgroundSize: "22px 22px",
            }}
          />

          <div className="pointer-events-none absolute -right-28 top-8 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-32 bottom-10 h-80 w-80 rounded-full bg-emerald-300/10 blur-3xl dark:bg-emerald-300/5" />

          <div className="pointer-events-none absolute -left-24 bottom-12 h-52 w-[42rem] rounded-[50%] border border-primary/10" />
          <div className="pointer-events-none absolute -left-16 bottom-6 h-56 w-[46rem] rounded-[50%] border border-border/35 dark:border-white/5" />
          <div className="pointer-events-none absolute -right-20 top-16 h-[26rem] w-[32rem] rounded-[50%] border border-primary/10" />

          <div
            dir="ltr"
            className="relative flex flex-col gap-8 pt-2 lg:grid lg:min-h-[520px] lg:grid-cols-[280px_minmax(0,1fr)_260px] lg:items-center lg:gap-10 lg:pt-0 xl:grid-cols-[300px_minmax(0,1fr)_280px] xl:gap-12"
          >
            <aside
              dir="rtl"
              className="order-3 w-full lg:order-1 lg:w-[280px] xl:w-[300px]"
            >
              <div className="rounded-[1.8rem] border border-border/70 bg-background/55 p-3 shadow-[0_24px_80px_-58px_rgba(0,0,0,0.65)] backdrop-blur-md dark:bg-black/10">
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
              <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                {visibleGenres.length > 0 ? (
                  <>
                    {visibleGenres.map((genre) => (
                      <BookPill key={genre}>{genre}</BookPill>
                    ))}

                    {hiddenGenres.length > 0 ? (
                      <HiddenGenresPill hiddenGenres={hiddenGenres} />
                    ) : null}
                  </>
                ) : (
                  <BookPill>صفحه کتاب</BookPill>
                )}
              </div>

              <h1 className="mt-4 text-3xl font-black leading-[1.25] tracking-tight text-foreground drop-shadow-[0_10px_30px_rgba(0,0,0,0.18)] sm:text-4xl lg:max-w-3xl lg:text-5xl xl:text-[3.4rem] dark:drop-shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
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
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/55 px-3.5 py-2 text-sm backdrop-blur-md dark:border-white/8 dark:bg-black/10">
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
                    <div className="flex flex-wrap items-center justify-center gap-1.5 lg:justify-start">
                      {topMoods.slice(0, 3).map((mood) => (
                        <span
                          key={mood}
                          className="inline-flex max-w-[120px] truncate rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
                        >
                          {mood}
                        </span>
                      ))}
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
                <div className="pointer-events-none absolute -inset-5 rounded-[2rem] bg-primary/12 blur-3xl" />
                <div className="pointer-events-none absolute -inset-2 rounded-[1.7rem] bg-gradient-to-b from-white/40 via-transparent to-black/10 dark:from-white/10 dark:to-black/20" />

                <div className="relative aspect-[2/3] overflow-hidden rounded-[1.45rem] bg-secondary/40 shadow-[0_30px_75px_-46px_rgba(0,0,0,0.65)] ring-1 ring-border/80 dark:shadow-[0_34px_86px_-42px_rgba(0,0,0,0.92)] dark:ring-white/10">
                  <BookCoverImage
                    src={book.displayCoverImage || PLACEHOLDER}
                    alt={book.title}
                    fill
                    sizes="(min-width: 1280px) 280px, (min-width: 1024px) 260px, (min-width: 640px) 250px, 230px"
                    className="object-cover"
                    priority
                  />

                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/10 via-transparent to-white/16 dark:from-black/24 dark:to-white/8" />
                </div>
              </div>
            </aside>
          </div>

          {metaItems.length > 0 ? (
            <Carousel
              className="relative mt-9"
              ariaLabel="مشخصات کتاب"
              align="start"
              slideClassName="basis-[170px] sm:basis-[185px] lg:basis-[195px]"
              containerClassName="justify-start gap-3"
              slides={metaItems}
              controls={false}
            />
          ) : null}

          <div className="mt-9">
            <BookIntroduction content={book.description} />
          </div>
        </section>
        <RelatedMagazineArticles posts={magazinePosts} />
        <div className="mt-10 lg:mt-12">
          <BookQuotesSection
            subjectBookId={book.id}
            viewerEntryId={entry?.id ?? null}
            viewerIsAdmin={isAdmin(viewer)}
            isLoggedIn={isLoggedIn}
            quotes={quotes}
            viewAllHref={`/book/${encodeURIComponent(book.slug)}/quotes`}
          />
        </div>

        <div className="mt-10 lg:mt-12">
          <BookNotesTabsSection
            catalogBookId={book.id}
            selectedEditionId={selectedEdition?.id ?? null}
            isLoggedIn={isLoggedIn}
            bookNotes={bookNotes}
            editionNotes={editionNotes}
            viewerId={viewer?.id ?? null}
            viewAllHref={`/book/${encodeURIComponent(book.slug)}/notes`}
          />
        </div>
        <SimilarBooksSection books={similarBooks} />
        <BookReadingTour isAuthenticated={isLoggedIn} />
        <BookNotesTour isAuthenticated={isLoggedIn && Boolean(entry)} />
      </div>
    </PublicShell>
  );
}

function HiddenGenresPill({ hiddenGenres }: { hiddenGenres: string[] }) {
  return (
    <span className="group relative inline-flex">
      <span className="inline-flex h-8 items-center rounded-full border border-border/80 bg-background/65 px-3 text-[11px] font-bold text-muted-foreground shadow-sm backdrop-blur transition-colors hover:border-primary/25 hover:bg-primary/5 hover:text-primary">
        +{hiddenGenres.length.toLocaleString("fa-IR")} مورد
      </span>

      <span className="pointer-events-none absolute right-0 top-[calc(100%+0.6rem)] z-50 hidden w-[min(260px,calc(100vw-2rem))] rounded-2xl border border-border/80 bg-card/95 p-3 text-right shadow-[0_24px_70px_-38px_rgba(0,0,0,0.65)] backdrop-blur-xl group-hover:block dark:shadow-[0_24px_70px_-38px_rgba(0,0,0,0.95)] sm:right-1/2 sm:translate-x-1/2">
        <span className="absolute -top-1.5 right-6 h-3 w-3 rotate-45 border-r border-t border-border/80 bg-card/95 sm:right-1/2 sm:translate-x-1/2" />

        <span className="relative z-10 mb-2 block text-[10px] font-black text-muted-foreground">
          ژانرهای بیشتر
        </span>

        <span className="relative z-10 flex max-w-full flex-wrap gap-1.5">
          {hiddenGenres.map((genre) => (
            <span
              key={genre}
              className="inline-flex max-w-full rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-[10px] font-bold leading-5 text-primary"
            >
              <span className="max-w-[210px] truncate">{genre}</span>
            </span>
          ))}
        </span>
      </span>
    </span>
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
    <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-border/80 bg-background/60 px-2.5 text-[10px] font-medium text-foreground backdrop-blur sm:h-auto sm:gap-2 sm:px-3.5 sm:py-2 sm:text-xs">
      <span className="shrink-0 text-muted-foreground">{icon}</span>

      <span className="shrink-0 font-bold tabular-nums text-foreground">
        {value.toLocaleString("fa-IR")}
      </span>

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
    "group relative block h-full min-h-[86px] overflow-hidden rounded-[1.35rem] border border-border/70 bg-card/60 px-4 py-4 text-right backdrop-blur-md transition-colors hover:border-primary/25 hover:bg-card/80";

  const inner = (
    <>
      <div className="flex items-center justify-start gap-2">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          {icon}
        </span>

        <span className="text-[13px] font-extrabold text-muted-foreground">
          {label}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-center gap-1.5">
        {valueAvatar}

        <span
          className={
            "line-clamp-1 text-base font-black leading-7 text-foreground" +
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

function BookPill({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "muted";
}) {
  return (
    <span
      className={
        tone === "default"
          ? "inline-flex h-8 max-w-[140px] items-center truncate rounded-full border border-primary/15 bg-primary/10 px-3 text-[11px] font-bold text-primary shadow-sm backdrop-blur"
          : "inline-flex h-8 max-w-[140px] items-center truncate rounded-full border border-border/80 bg-background/65 px-3 text-[11px] font-bold text-muted-foreground shadow-sm backdrop-blur"
      }
    >
      {children}
    </span>
  );
}
