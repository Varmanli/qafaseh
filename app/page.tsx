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
} from "@/lib/home/curation";
import PublicShell from "@/components/PublicShell";
import HomeHeroSlider from "@/components/home/HomeHeroSlider";
import HomeBookCarousel from "@/components/home/HomeBookCarousel";
import HomeQuotesSection from "@/components/home/HomeQuotesSection";
import HomePopularAuthors from "@/components/home/HomePopularAuthors";
// import HomeReadingListsPreview from "@/components/home/HomeReadingListsPreview";
// import HomeFeatureCards from "@/components/home/HomeFeatureCards";
import HomeBlogPreview from "@/components/home/HomeBlogPreview";
import HomeExploreGhafaseh from "@/components/home/HomeExploreGhafaseh";
import HomeGenreDiscovery from "@/components/home/HomeGenreDiscovery";

export const dynamic = "force-dynamic";

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
  const [
    user,
    featuredBooks,
    recentQuotes,
    featuredBlogPosts,
    dbHeroSlides,
    featuredAuthors,
    popularBooks,
    genres,
  ] = await measure("all homepage data", () => Promise.all([
    userPromise,
    measure("featured books", () => getFeaturedBooks(8)),
    measure("recent quotes", () => userPromise.then((currentUser) => getRecentHomeQuotes(10, currentUser?.id))),
    measure("featured blog posts", getFeaturedHomeBlogPosts),
    measure("hero slides", getHeroSlides),
    measure("featured authors", getFeaturedAuthors),
    measure("popular books", () => getPopularBooks(8)),
    measure("genres", () => getHomepageGenres(5)),
  ]));

  // کتاب‌های پیشنهادی از انتخاب ادمین می‌آیند؛ در نبود انتخاب، fallback به
  // کتاب‌های اخیر عمومی (به‌صورت شفاف با برچسب «تازه‌ترین‌ها»).
  const hasFeatured = featuredBooks.length > 0;
  const showcaseBooks = hasFeatured ? featuredBooks : popularBooks;

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

          <div className="[content-visibility:auto] [contain-intrinsic-size:auto_340px]">
            <HomeExploreGhafaseh />
          </div>

          <div className="[content-visibility:auto] [contain-intrinsic-size:auto_650px]">
            <HomeBookCarousel books={showcaseBooks} isFallback={!hasFeatured} />
          </div>

          <div className="[content-visibility:auto] [contain-intrinsic-size:auto_560px]">
            <HomeQuotesSection quotes={recentQuotes} isLoggedIn={isLoggedIn} />
          </div>

          <div className="[content-visibility:auto] [contain-intrinsic-size:auto_400px]">
            <HomePopularAuthors authors={featuredAuthors} />
          </div>

          <div className="[content-visibility:auto] [contain-intrinsic-size:auto_380px]">
            <HomeGenreDiscovery genres={genres} />
          </div>

          {/* <HomeReadingListsPreview lists={HOME_PLACEHOLDER_LISTS} /> */}

          {/* <HomeFeatureCards /> */}

          <div className="[content-visibility:auto] [contain-intrinsic-size:auto_520px]">
            <HomeBlogPreview posts={featuredBlogPosts} />
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
