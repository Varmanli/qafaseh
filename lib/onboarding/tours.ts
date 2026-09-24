export const HOME_NAVIGATION_TOUR_ID = "home-navigation-v1";
export const PROFILE_MENU_TOUR_ID = "profile-menu-v1";
export const BOOK_READING_TOUR_ID = "book-reading-v1";
export const BOOK_NOTES_TOUR_ID = "book-notes-v1";

export type OnboardingTarget = "nav-books" | "nav-lists" | "search";

export type OnboardingStep = {
  target: OnboardingTarget;
  title: string;
  description: string;
};

export const HOME_NAVIGATION_TOUR_STEPS: readonly OnboardingStep[] = [
  {
    target: "nav-books",
    title: "کتاب‌ها را کشف کن",
    description: "مجموعه کتاب‌های قفسه را ببین و کتاب بعدی‌ات را پیدا کن.",
  },
  {
    target: "nav-lists",
    title: "یک مسیر مطالعه انتخاب کن",
    description: "از یک مسیر آماده شروع کن و کتاب‌ها را به ترتیب پیشنهادی بخوان.",
  },
  {
    target: "search",
    title: "هر چیزی را سریع پیدا کن",
    description: "نام کتاب، نویسنده یا چیزی که دنبالش هستی را جستجو کن.",
  },
];

export type ProfileMenuOnboardingTarget =
  | "profile-menu-profile"
  | "profile-menu-library"
  | "profile-menu-dashboard"
  | "profile-menu-settings";

export type ProfileMenuOnboardingStep = {
  target: ProfileMenuOnboardingTarget;
  title: string;
  description: string;
};

export const PROFILE_MENU_TOUR_STEPS: readonly ProfileMenuOnboardingStep[] = [
  {
    target: "profile-menu-profile",
    title: "پروفایل تو",
    description: "اطلاعات عمومی پروفایلت را ببین و ظاهر حساب کاربری‌ات را مدیریت کن.",
  },
  {
    target: "profile-menu-library",
    title: "کتابخانه شخصی تو",
    description: "کتاب‌هایی که ذخیره کرده‌ای و وضعیت مطالعه‌شان را یکجا دنبال کن.",
  },
  {
    target: "profile-menu-dashboard",
    title: "آمار مطالعه‌ات",
    description: "روند مطالعه، فعالیت‌ها و آمار کتاب‌خوانی‌ات را در گزارش مطالعه ببین.",
  },
  {
    target: "profile-menu-settings",
    title: "تنظیمات حساب",
    description: "اطلاعات حساب، تصویر پروفایل و تنظیمات شخصی‌ات را مدیریت کن.",
  },
];

export type BookReadingOnboardingTarget =
  | "book-reading-status"
  | "book-rating"
  | "book-reading-progress";

export type BookReadingOnboardingStep = {
  target: BookReadingOnboardingTarget;
  title: string;
  description: string;
};

export const BOOK_READING_TOUR_STEPS: readonly BookReadingOnboardingStep[] = [
  {
    target: "book-reading-status",
    title: "وضعیت مطالعه‌ات را ثبت کن",
    description:
      "مشخص کن این کتاب را می‌خواهی بخوانی، درحال خواندنش هستی، متوقفش کرده‌ای یا مطالعه‌اش را تمام کرده‌ای.",
  },
  {
    target: "book-rating",
    title: "به کتاب امتیاز بده",
    description:
      "امتیاز شخصی‌ات اینجا نمایش داده می‌شود؛ آن را از بخش «مطالعه من» ثبت یا ویرایش کن.",
  },
  {
    target: "book-reading-progress",
    title: "مطالعه‌ات را دنبال کن",
    description:
      "در «مطالعه من» پیشرفت، صفحه فعلی و مسیر شخصی مطالعه‌ات را ثبت و دنبال کن.",
  },
];

export type BookNotesOnboardingTarget =
  | "book-private-note"
  | "book-public-note"
  | "book-quote";

export type BookNotesOnboardingStep = {
  target: BookNotesOnboardingTarget;
  title: string;
  description: string;
};

export const BOOK_NOTES_TOUR_STEPS: readonly BookNotesOnboardingStep[] = [
  {
    target: "book-private-note",
    title: "یادداشت‌های خودت را نگه دار",
    description:
      "از «مطالعه من» به دفترچه‌ی خصوصی‌ات برو و فکرها و نکته‌های این کتاب را فقط برای خودت ثبت کن.",
  },
  {
    target: "book-public-note",
    title: "درباره کتاب بنویس",
    description:
      "برداشتت را عمومی منتشر کن؛ اگر نسخه‌ای انتخاب شده باشد، می‌توانی آن را درباره خود کتاب یا همان نسخه بنویسی.",
  },
  {
    target: "book-quote",
    title: "تکه‌ای از کتاب را ثبت کن",
    description:
      "جمله یا بخش ماندگار کتاب، یا تصویر صفحه‌اش را به‌صورت تکه‌کتاب عمومی منتشر کن.",
  },
];
