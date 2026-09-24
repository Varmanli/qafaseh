import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ChevronRight } from "lucide-react";

import BookArchiveFilters from "@/components/books/BookArchiveFilters";
import RelatedMagazineArticles from "@/components/blog/RelatedMagazineArticles";
import CollapsibleContent from "@/components/content/CollapsibleContent";
import PublicShell from "@/components/PublicShell";
import AuthorAvatar from "@/components/reference/AuthorAvatar";

import {
  getMagazineArticlesForAuthor,
  getMagazineArticlesForGenre,
} from "@/lib/blog/service";
import {
  type BookArchiveScope,
  getBookArchivePageData,
} from "@/lib/book/archive-service";
import { getSafeAuthorArchiveReturnPath } from "@/lib/reference/author-navigation";
import {
  getReferenceEntity,
  ROUTE_BY_TYPE,
} from "@/lib/reference/public-service";
import { buildPageMetadata } from "@/lib/seo/metadata";
import {
  REFERENCE_TYPE_LABELS,
  type ReferenceTypeValue,
} from "@/lib/validations/reference";

type SearchParams = Record<string, string | string[] | undefined>;

type ArchiveConfig = {
  searchPlaceholder: string;
  hideGenreFilter?: boolean;
  hideAuthorFilter?: boolean;
  hidePublisherFilter?: boolean;
  hideTranslatorFilter?: boolean;
  hideCountryFilter?: boolean;
};

const ARCHIVE_SCOPE_BY_TYPE: Partial<
  Record<
    ReferenceTypeValue,
    (entity: { id: string; name: string }) => BookArchiveScope
  >
> = {
  AUTHOR: (entity) => ({ personId: entity.id }),
  GENRE: (entity) => ({ fixedGenre: entity.name }),
  PUBLISHER: (entity) => ({ fixedPublisher: entity.name }),
  TRANSLATOR: (entity) => ({ personId: entity.id }),
  COUNTRY: (entity) => ({ fixedCountry: entity.name }),
};

const ARCHIVE_CONFIG_BY_TYPE: Partial<
  Record<ReferenceTypeValue, ArchiveConfig>
> = {
  AUTHOR: {
    searchPlaceholder: "جست‌وجو در کتاب‌های این شخص",
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
    searchPlaceholder: "جست‌وجو در کتاب‌های این شخص",
    hideTranslatorFilter: true,
  },
  COUNTRY: {
    searchPlaceholder: "جست‌وجو در کتاب‌های این کشور",
    hideCountryFilter: true,
  },
};

async function getRelatedMagazinePosts(
  type: ReferenceTypeValue,
  entityId: string,
) {
  try {
    if (type === "AUTHOR") {
      return await getMagazineArticlesForAuthor(entityId);
    }

    if (type === "GENRE") {
      return await getMagazineArticlesForGenre(entityId);
    }

    return [];
  } catch {
    // Magazine content must never block the public reference profile.
    return [];
  }
}

/**
 * Shared public view for reference entities such as authors,
 * translators, publishers, countries and genres.
 */
export default async function ReferencePublicView({
  type,
  slugParam,
  searchParams,
}: {
  type: ReferenceTypeValue;
  slugParam: string;
  searchParams?: SearchParams;
}) {
  const ref = decodeURIComponent(slugParam);

  const entity = await getReferenceEntity(type, ref);

  if (!entity) {
    notFound();
  }

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

  const archiveScopeFactory = ARCHIVE_SCOPE_BY_TYPE[type];
  const archiveConfig = ARCHIVE_CONFIG_BY_TYPE[type];

  const archiveScope = archiveScopeFactory?.(entity);

  const [scopedArchiveData, magazinePosts] = await Promise.all([
    archiveScope && archiveConfig
      ? getBookArchivePageData(searchParams ?? {}, archiveScope)
      : Promise.resolve(null),

    getRelatedMagazinePosts(type, entity.id),
  ]);

  const description = entity.description?.trim();

  const authorArchiveHref =
    type === "AUTHOR" ? (authorArchiveReturnPath ?? "/authors") : null;

  const hasMetaInformation = Boolean(
    entity.birthYear ||
    entity.deathYear ||
    entity.countryName ||
    entity.website,
  );

  return (
    <PublicShell>
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-5 sm:px-6 sm:pt-7">
        {/* Reference hero */}
        <section className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/60 shadow-[0_28px_100px_-72px_rgba(0,0,0,0.75)] backdrop-blur-md">
          {/* Ambient background */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(103,146,124,0.18),transparent_34%),radial-gradient(circle_at_80%_30%,rgba(103,146,124,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_28%)]"
          />

          {/* Subtle texture */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:14px_14px]"
          />

          {/* Top highlight */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
          />

          <div className="relative mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
            <div className="flex flex-col gap-6">
              {/* Identity */}
              <header className="flex items-center gap-4 sm:gap-5">
                <div className="relative shrink-0">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-2 rounded-full bg-primary/15 blur-2xl"
                  />

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

                <div className="min-w-0 flex-1 text-right">
                  <h1 className="line-clamp-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl md:text-[2.2rem]">
                    {entity.name}
                  </h1>

                  {entity.originalName ? (
                    <p
                      dir="ltr"
                      className="mt-1.5 w-fit text-sm font-medium text-muted-foreground sm:mt-2"
                    >
                      {entity.originalName}
                    </p>
                  ) : null}

                  {hasMetaInformation ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                      {entity.birthYear || entity.deathYear ? (
                        <span className="inline-flex items-center rounded-full border border-border/60 bg-background/55 px-3 py-1.5">
                          {entity.birthYear ?? "؟"} -{" "}
                          {entity.deathYear ?? "اکنون"}
                        </span>
                      ) : null}

                      {entity.countryName ? (
                        <span className="inline-flex items-center rounded-full border border-border/60 bg-background/55 px-3 py-1.5">
                          {entity.countryName}
                        </span>
                      ) : null}

                      {entity.website ? (
                        <a
                          href={entity.website}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-full border border-border/60 bg-background/55 px-3 py-1.5 transition-colors hover:border-primary/40 hover:text-primary"
                        >
                          وب‌سایت
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </header>

              {/* Biography / description */}
              {description ? (
                <CollapsibleContent
                  className="border-t border-border/50 pt-5 sm:pt-6"
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

        {/* Books */}
        {scopedArchiveData && archiveConfig ? (
          <section className="mt-6">
            <BookArchiveFilters
              filters={scopedArchiveData.filters}
              options={scopedArchiveData.options}
              archive={scopedArchiveData.archive}
              showBookCount={type === "AUTHOR" || type === "TRANSLATOR"}
              searchPlaceholder={archiveConfig.searchPlaceholder}
              hideGenreFilter={archiveConfig.hideGenreFilter}
              hideAuthorFilter={archiveConfig.hideAuthorFilter}
              hidePublisherFilter={archiveConfig.hidePublisherFilter}
              hideTranslatorFilter={archiveConfig.hideTranslatorFilter}
              hideCountryFilter={archiveConfig.hideCountryFilter}
            />
          </section>
        ) : null}

        {/* Magazine */}
        <RelatedMagazineArticles
          posts={magazinePosts}
          title={
            type === "GENRE"
              ? `مطالب مجله درباره ${entity.name}`
              : "از مجله قفسه"
          }
          description={
            type === "AUTHOR" ? `مطالب مرتبط با ${entity.name}` : undefined
          }
        />
      </main>
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
    return {
      title: `${label} یافت نشد | قفسه`,
    };
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
