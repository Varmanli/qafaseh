import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";

import BookArchiveFilters from "@/components/books/BookArchiveFilters";
import CollapsibleContent from "@/components/content/CollapsibleContent";
import PublicShell from "@/components/PublicShell";
import AuthorAvatar from "@/components/reference/AuthorAvatar";
import RelatedMagazineArticles from "@/components/blog/RelatedMagazineArticles";
import { getMagazineArticlesForAuthor, getMagazineArticlesForGenre } from "@/lib/blog/service";
import {
  type BookArchiveScope,
  getBookArchivePageData,
} from "@/lib/book/archive-service";
import {
  getReferenceEntity,
  ROUTE_BY_TYPE,
} from "@/lib/reference/public-service";
import {
  REFERENCE_TYPE_LABELS,
  type ReferenceTypeValue,
} from "@/lib/validations/reference";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getSafeAuthorArchiveReturnPath } from "@/lib/reference/author-navigation";

/**
 * نمای عمومی مشترک برای همه‌ی موجودیت‌های مرجع (نویسنده/مترجم/ناشر/کشور/ژانر).
 * یک‌بار نوشته می‌شود و در پنج مسیر استفاده می‌گردد.
 */
export default async function ReferencePublicView({
  type,
  slugParam,
  searchParams,
}: {
  type: ReferenceTypeValue;
  slugParam: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const ref = decodeURIComponent(slugParam);
  const entity = await getReferenceEntity(type, ref);
  if (!entity) notFound();

  const authorArchiveReturnPath =
    type === "AUTHOR"
      ? getSafeAuthorArchiveReturnPath(searchParams?.from)
      : null;

  if (ref !== entity.slug) {
    const returnQuery = authorArchiveReturnPath
      ? `?from=${encodeURIComponent(authorArchiveReturnPath)}`
      : "";
    permanentRedirect(
      `/${ROUTE_BY_TYPE[type]}/${encodeURIComponent(entity.slug)}${returnQuery}`,
    );
  }

  const label = REFERENCE_TYPE_LABELS[type];
  const archiveScopeByType: Partial<
    Record<ReferenceTypeValue, BookArchiveScope>
  > = {
    AUTHOR: { fixedAuthor: entity.name },
    GENRE: { fixedGenre: entity.name },
    PUBLISHER: { fixedPublisher: entity.name },
    TRANSLATOR: { fixedTranslator: entity.name },
    COUNTRY: { fixedCountry: entity.name },
  };
  const archiveConfigByType: Partial<
    Record<
      ReferenceTypeValue,
      {
        searchPlaceholder: string;
        hideGenreFilter?: boolean;
        hideAuthorFilter?: boolean;
        hidePublisherFilter?: boolean;
        hideTranslatorFilter?: boolean;
        hideCountryFilter?: boolean;
      }
    >
  > = {
    AUTHOR: {
      searchPlaceholder: "جست‌وجو در کتاب‌های این نویسنده",
      hideAuthorFilter: true,
    },
    GENRE: {
      searchPlaceholder: "جست‌وجو در کتاب‌های این ژانر",
      hideGenreFilter: true,
    },
    PUBLISHER: {
      searchPlaceholder: "جست‌وجو در کتاب‌های این ناشر",
      hidePublisherFilter: true,
    },
    TRANSLATOR: {
      searchPlaceholder: "جست‌وجو در کتاب‌های این مترجم",
      hideTranslatorFilter: true,
    },
    COUNTRY: {
      searchPlaceholder: "جست‌وجو در کتاب‌های این کشور",
      hideCountryFilter: true,
    },
  };

  const archiveScope = archiveScopeByType[type];
  const archiveConfig = archiveConfigByType[type];
  const usesArchiveFilters = Boolean(archiveScope && archiveConfig);

  const scopedArchiveData = usesArchiveFilters
    ? await getBookArchivePageData(searchParams ?? {}, archiveScope)
    : null;
  const magazinePosts = await (async () => {
    try {
      return type === "AUTHOR"
        ? await getMagazineArticlesForAuthor(entity.id)
        : type === "GENRE"
          ? await getMagazineArticlesForGenre(entity.id)
          : [];
    } catch {
      // Magazine content is secondary to the public reference profile.
      return [];
    }
  })();
  const description = entity.description?.trim();
  const authorArchiveHref =
    type === "AUTHOR" ? authorArchiveReturnPath ?? "/authors" : null;

  return (
    <PublicShell>
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/60 shadow-[0_28px_100px_-72px_rgba(0,0,0,0.75)] backdrop-blur-md">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(103,146,124,0.18),transparent_34%),radial-gradient(circle_at_80%_30%,rgba(103,146,124,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_28%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:14px_14px]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
          />

          <div className="relative w-[90%] mx-auto  py-6 sm:px-7 sm:py-8">
            {authorArchiveHref ? (
              <Link
                href={authorArchiveHref}
                className="inline-flex text-xs font-bold text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                بازگشت به نویسنده‌ها
              </Link>
            ) : null}
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="pointer-events-none absolute inset-2 rounded-full bg-primary/15 blur-2xl" />

                  <AuthorAvatar
                    name={entity.name}
                    image={entity.coverImage}
                    sizeClassName={
                      type === "AUTHOR"
                        ? "h-20 w-20 sm:h-24 sm:w-24"
                        : "h-16 w-16 sm:h-20 sm:w-20"
                    }
                    textClassName="text-2xl"
                    iconClassName="h-8 w-8"
                    className="relative"
                  />
                </div>

                <div className="min-w-0 text-right">
                  <h1 className="line-clamp-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl md:text-[2.2rem]">
                    {entity.name}
                  </h1>
                  {entity.originalName ? (
                    <p
                      dir="ltr"
                      className="mt-2 text-sm font-medium text-muted-foreground"
                    >
                      {entity.originalName}
                    </p>
                  ) : null}

                  {entity.birthYear ||
                  entity.deathYear ||
                  entity.countryName ||
                  entity.website ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {entity.birthYear || entity.deathYear ? (
                        <span className="rounded-full border border-border/60 bg-background/60 px-3 py-1">
                          {`${entity.birthYear ?? "?"} - ${entity.deathYear ?? "اکنون"}`}
                        </span>
                      ) : null}
                      {entity.countryName ? (
                        <span className="rounded-full border border-border/60 bg-background/60 px-3 py-1">
                          {entity.countryName}
                        </span>
                      ) : null}
                      {entity.website ? (
                        <a
                          href={entity.website}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-border/60 bg-background/60 px-3 py-1 transition hover:border-primary/40 hover:text-primary"
                        >
                          وب‌سایت
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              {description ? (
                <CollapsibleContent
                  className="border-t border-border/50 pt-5"
                  fadeClassName="from-card via-card/70"
                >
                  <p className="max-w-none whitespace-pre-line break-words text-justify text-sm font-medium leading-8 text-muted-foreground sm:text-base sm:leading-9">
                    {description}
                  </p>
                </CollapsibleContent>
              ) : null}
            </div>
          </div>
        </section>

        <div className="mt-6">
          {scopedArchiveData && archiveConfig ? (
            <BookArchiveFilters
              filters={scopedArchiveData.filters}
              options={scopedArchiveData.options}
              archive={scopedArchiveData.archive}
              searchPlaceholder={archiveConfig.searchPlaceholder}
              hideGenreFilter={archiveConfig.hideGenreFilter}
              hideAuthorFilter={archiveConfig.hideAuthorFilter}
              hidePublisherFilter={archiveConfig.hidePublisherFilter}
              hideTranslatorFilter={archiveConfig.hideTranslatorFilter}
              hideCountryFilter={archiveConfig.hideCountryFilter}
            />
          ) : null}
        </div>
        <RelatedMagazineArticles posts={magazinePosts} title={type === "GENRE" ? `مطالب مجله درباره ${entity.name}` : "از مجله قفسه"} description={type === "AUTHOR" ? `مطالب مرتبط با ${entity.name}` : undefined} />
      </div>
    </PublicShell>
  );
}

export async function buildReferenceMetadata(
  type: ReferenceTypeValue,
  slugParam: string,
) {
  const entity = await getReferenceEntity(type, decodeURIComponent(slugParam));
  const label = REFERENCE_TYPE_LABELS[type];
  if (!entity) {
    return { title: `${label} یافت نشد | قفسه` };
  }
  const image = entity.bannerImage || entity.coverImage;
  return buildPageMetadata({
    title: entity.seoTitle || `کتاب‌های ${entity.name}`,
    description:
      entity.seoDescription ||
      entity.shortDescription ||
      entity.description?.slice(0, 160) ||
      `صفحه‌ی ${label} ${entity.name} و کتاب‌های مرتبط در قفسه.`,
    path: `/${ROUTE_BY_TYPE[type]}/${encodeURIComponent(entity.slug)}`,
    image,
    type: "profile",
  });
}
