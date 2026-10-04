import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { getLibraryPath, getProfilePath } from "@/lib/library/paths";
import {
  getFeaturedBooks,
  getHeroSlides,
  getPopularBooks,
  getRecentHomeQuotes,
  HOME_FALLBACK_SLIDES,
  type HeroSlideView,
  getHomepageGenres,
} from "@/lib/home/service";
import {
  getFeaturedAuthors,
  getFeaturedHomeBlogPosts,
  getFeaturedHomeReadingLists,
} from "@/lib/home/curation";
import PublicShell from "@/components/PublicShell";
import HomeHeroSlider from "@/components/home/HomeHeroSlider";
import HomeBookCarousel from "@/components/home/HomeBookCarousel";
import HomeQuotesSection from "@/components/home/HomeQuotesSection";
import HomeRecentActivity from "@/components/home/HomeRecentActivity";
import HomePopularAuthors from "@/components/home/HomePopularAuthors";
import HomeReadingListsPreview from "@/components/home/HomeReadingListsPreview";
// import HomeFeatureCards from "@/components/home/HomeFeatureCards";
import HomeBlogPreview from "@/components/home/HomeBlogPreview";
import HomeGenreDiscovery from "@/components/home/HomeGenreDiscovery";
import { getFollowingFeed } from "@/lib/social/activity";

export const dynamic = "force-dynamic";

type HomeMeasure = ReturnType<typeof createHomePerfMeter>;

function loadHomeSections(
  userPromise: ReturnType<typeof getCurrentUser>,
  measure: HomeMeasure,
) {
  const featuredBooksPromise = measure("featured books", () => getFeaturedBooks(8));
  return {
    featuredBooks: featuredBooksPromise,
    popularBooks: featuredBooksPromise.then((books) =>
      books.length ? [] : measure("popular books", () => getPopularBooks(8)),
    ),
    quotes: measure("recent quotes", () => userPromise.then((user) => getRecentHomeQuotes(10, user?.id))),
    recentActivity: measure("recent activities", () =>
      userPromise.then((user) => user ? getFollowingFeed(user.id, null, 3, false) : null),
    ),
    blogPosts: measure("featured blog posts", getFeaturedHomeBlogPosts),
    authors: measure("featured authors", getFeaturedAuthors),
    genres: measure("genres", () => getHomepageGenres(5)),
    readingLists: measure("reading lists", getFeaturedHomeReadingLists),
  };
}

type HomeData = ReturnType<typeof loadHomeSections>;

async function HomeBooks({ data }: { data: HomeData }) {
  const [featuredBooks, popularBooks] = await Promise.all([data.featuredBooks, data.popularBooks]);
  const hasFeatured = featuredBooks.length > 0;
  return <HomeBookCarousel books={hasFeatured ? featuredBooks : popularBooks} isFallback={!hasFeatured} />;
}

async function HomeQuotes({ data, isLoggedIn }: { data: HomeData; isLoggedIn: boolean }) {
  return <HomeQuotesSection quotes={await data.quotes} isLoggedIn={isLoggedIn} />;
}

async function HomeAuthors({ data }: { data: HomeData }) {
  return <HomePopularAuthors authors={await data.authors} />;
}

async function HomeGenres({ data }: { data: HomeData }) {
  return <HomeGenreDiscovery genres={await data.genres} />;
}

async function HomeLists({ data }: { data: HomeData }) {
  return <HomeReadingListsPreview lists={await data.readingLists} />;
}

async function HomeBlog({ data }: { data: HomeData }) {
  return <HomeBlogPreview posts={await data.blogPosts} />;
}

async function HomeRecentActivities({ data }: { data: HomeData }) {
  const feed = await data.recentActivity;
  return feed ? <HomeRecentActivity items={feed.items} canLike /> : null;
}

function createHomePerfMeter(enabled: boolean, requestId: string) {
  return async function measure<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    if (!enabled) return fn();
    const start = performance.now();
    try {
      return await fn();
    } finally {
      console.info("[home-perf]", {
        requestId,
        operation,
        durationMs: Math.round(performance.now() - start),
      });
    }
  }
}

export default async function HomePage() {
  const perf = process.env.HOME_PERF === "1";
  const requestId = perf ? crypto.randomUUID() : "";
  const measure = createHomePerfMeter(perf, requestId);
  const userPromise = measure("session", getCurrentUser);
  const homeData = loadHomeSections(userPromise, measure);
  const [user, dbHeroSlides] = await Promise.all([
    userPromise,
    measure("hero slides", getHeroSlides),
  ]);

  const isLoggedIn = !!user;
  const libraryHref = getLibraryPath(user?.username);
  const profileHref = getProfilePath(user?.username);

  // اسلایدر از انتخاب ادمین (DB) می‌آید؛ در نبود اسلاید فعال از HOME_FALLBACK_SLIDES
  // به‌عنوان داده‌ی پیش‌فرض استفاده می‌شود (نه محتوای ادمین).
  const resolveHref = (href: string) =>
    href === "/books"
      ? libraryHref
      : href === "/settings/profile"
        ? profileHref
        : href;

  const heroSlides: HeroSlideView[] =
    dbHeroSlides.length > 0
      ? dbHeroSlides
      : HOME_FALLBACK_SLIDES.map((slide) => ({
          id: slide.id,
          badge: slide.eyebrow,
          title: slide.title,
          description: slide.description,
          primaryLabel: isLoggedIn
            ? slide.memberPrimaryLabel
            : slide.guestPrimaryLabel,
          primaryHref: isLoggedIn
            ? resolveHref(slide.memberPrimaryHref)
            : slide.guestPrimaryHref,
          secondaryLabel:
            (isLoggedIn
              ? slide.memberSecondaryLabel
              : slide.guestSecondaryLabel) ?? null,
          secondaryHref:
            (isLoggedIn
              ? slide.memberSecondaryHref
                ? resolveHref(slide.memberSecondaryHref)
                : null
              : slide.guestSecondaryHref) ?? null,
          imageUrl: null,
          books: [],
        }));

  return (
    <PublicShell user={user}>
      <div className="relative overflow-x-clip">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[540px] bg-[radial-gradient(circle_at_top,rgba(128,167,150,0.16),transparent_42%)]"
        />
        <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:space-y-10">
          <HomeHeroSlider slides={heroSlides} />

          <Suspense fallback={null}>
            <HomeRecentActivities data={homeData} />
          </Suspense>

          <div className="[content-visibility:auto] [contain-intrinsic-size:auto_650px]">
            <Suspense fallback={<div className="h-[650px]" aria-hidden="true" />}>
              <HomeBooks data={homeData} />
            </Suspense>
          </div>
          <div className="[content-visibility:auto] [contain-intrinsic-size:auto_560px]">
            <Suspense fallback={<div className="h-[560px]" aria-hidden="true" />}>
              <HomeQuotes data={homeData} isLoggedIn={isLoggedIn} />
            </Suspense>
          </div>
          <div className="[content-visibility:auto] [contain-intrinsic-size:auto_400px]">
            <Suspense fallback={<div className="h-[400px]" aria-hidden="true" />}>
              <HomeAuthors data={homeData} />
            </Suspense>
          </div>
          <div className="[content-visibility:auto] [contain-intrinsic-size:auto_380px]">
            <Suspense fallback={<div className="h-[380px]" aria-hidden="true" />}>
              <HomeGenres data={homeData} />
            </Suspense>
          </div>
          <div className="[content-visibility:auto] [contain-intrinsic-size:auto_560px]">
            <Suspense fallback={<div className="h-[560px]" aria-hidden="true" />}>
              <HomeLists data={homeData} />
            </Suspense>
          </div>
          <div className="[content-visibility:auto] [contain-intrinsic-size:auto_520px]">
            <Suspense fallback={<div className="h-[520px]" aria-hidden="true" />}>
              <HomeBlog data={homeData} />
            </Suspense>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
