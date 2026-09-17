import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  pgEnum,
  unique,
  uniqueIndex,
  index,
  check,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ---------------- Enums ----------------
export const BookFormat = pgEnum("BookFormat", ["PHYSICAL", "ELECTRONIC"]);
export const BookStatus = pgEnum("BookStatus", [
  "UNREAD",
  "READING",
  "PAUSED",
  "STOPPED",
  "FINISHED",
]);

export const ReadingEventType = pgEnum("ReadingEventType", [
  "START",
  "PROGRESS",
  "FINISH",
]);

export const PublicBookThoughtType = pgEnum("PublicBookThoughtType", [
  "THOUGHT",
  "QUOTE",
  "REFLECTION",
]);

export const PurchasePriority = pgEnum("PurchasePriority", [
  "MUST_HAVE", // حتما باید بخرم
  "WANT_IT", // خیلی دلم می‌خواد
  "NICE_TO_HAVE", // بد نیست داشته باشم
  "IF_EXTRA_MONEY", // اگر پول اضافه داشتم
  "NOT_IMPORTANT", // فعلا مهم نیست
]);

// نمایانی پروفایل کاربر (حساب‌های جدید به‌صورت عمومی ساخته می‌شوند)
export const ProfileVisibility = pgEnum("ProfileVisibility", [
  "PUBLIC",
  "PRIVATE",
]);

// نقش کاربر برای دسترسی ادمین
export const UserRole = pgEnum("UserRole", ["USER", "ADMIN"]);

// وضعیت تأیید برای کاتالوگ و فهرست‌های مرجع
export const ApprovalStatus = pgEnum("ApprovalStatus", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const BlogPostStatus = pgEnum("BlogPostStatus", ["DRAFT", "PUBLISHED"]);

export const NoteScope = pgEnum("NoteScope", ["book", "edition"]);

// وضعیت انتشار صفحه‌ی ثابت (درباره ما، تماس، قوانین، …)
export const StaticPageStatus = pgEnum("StaticPageStatus", [
  "DRAFT",
  "PUBLISHED",
]);

export const VerificationCodePurpose = pgEnum("VerificationCodePurpose", [
  "email_verification",
  "login",
  "password_reset",
]);

export const AuthProvider = pgEnum("AuthProvider", [
  "password",
  "google",
  "otp",
]);

// نوع داده‌ی مرجع مدیریت‌شده توسط ادمین
export const ReferenceType = pgEnum("ReferenceType", [
  "AUTHOR",
  "GENRE",
  "TRANSLATOR",
  "PUBLISHER",
  "COUNTRY",
]);

// فروشگاه/پلتفرمِ لینک بیرونیِ کتاب
export const ExternalLinkProvider = pgEnum("ExternalLinkProvider", [
  "taaghche",
  "fidibo",
  "iranketab",
  "ketabrah",
  "digikala",
  "publisher",
  "other",
]);

// نوع نسخه‌ی لینک بیرونی
export const ExternalLinkType = pgEnum("ExternalLinkType", [
  "print",
  "ebook",
  "audiobook",
  "unknown",
]);
export const IranKetabImportStatus = pgEnum("IranKetabImportStatus", [
  "CREATED",
  "EXTRACTING",
  "PREVIEW_READY",
  "DRAFT_REVIEW",
  "COVER_PREPARATION",
  "IMPORTING_REFERENCES",
  "READY_TO_COMMIT",
  "COMMITTING",
  "SUCCESS",
  "FAILED",
  "CANCELLED",
]);
export const IranKetabImportEventType = pgEnum("IranKetabImportEventType", [
  "SESSION_CREATED",
  "EXTRACTION_STARTED",
  "EXTRACTION_COMPLETED",
  "DRAFT_SAVED",
  "COVER_PREPARATION_STARTED",
  "COVER_PREPARATION_COMPLETED",
  "CONTRIBUTOR_STEP_STARTED",
  "CONTRIBUTOR_PROFILE_FETCH_STARTED",
  "CONTRIBUTOR_PROFILE_FETCH_COMPLETED",
  "CONTRIBUTOR_MATCHED",
  "CONTRIBUTOR_CREATED",
  "CONTRIBUTOR_UPDATED",
  "CONTRIBUTOR_IGNORED",
  "CONTRIBUTOR_IMAGE_STAGED",
  "CONTRIBUTOR_FAILED",
  "CONTRIBUTOR_STEP_COMPLETED",
  "COMMIT_STARTED",
  "COMMIT_COMPLETED",
  "COMMIT_FAILED",
]);
export const IranKetabPreviewOperationStatus = pgEnum(
  "IranKetabPreviewOperationStatus",
  ["PROCESSING", "COMPLETED", "FAILED"],
);
export const IranKetabDiscoverySourceType = pgEnum(
  "IranKetabDiscoverySourceType",
  [
    "AWARD",
    "CURATED_LIST",
    "EDITORIAL_COLLECTION",
    "AUTHOR",
    "PUBLISHER",
    "TAG",
    "SEARCH",
  ],
);
export const IranKetabDiscoveryCrawlStatus = pgEnum(
  "IranKetabDiscoveryCrawlStatus",
  ["IDLE", "RUNNING", "SUCCEEDED", "FAILED", "PAUSED"],
);
export const IranKetabDiscoveryImportConfidence = pgEnum(
  "IranKetabDiscoveryImportConfidence",
  ["HIGH", "MEDIUM", "LOW"],
);
export const IranKetabDiscoveryImportMode = pgEnum(
  "IranKetabDiscoveryImportMode",
  ["MANUAL_REVIEW", "AUTO_IMPORT"],
);
export const IranKetabPublisherImportStatus = pgEnum(
  "IranKetabPublisherImportStatus",
  ["IDLE", "RUNNING", "PAUSED", "COMPLETED"],
);
export const IranKetabDiscoveryItemStatus = pgEnum(
  "IranKetabDiscoveryItemStatus",
  [
    "DISCOVERED",
    "SCORED",
    "QUEUED",
    "IMPORTING",
    "IMPORTED",
    "NEEDS_REVIEW",
    "APPROVED",
    "SKIPPED",
    "FAILED",
  ],
);
export const IranKetabDiscoveryRunStatus = pgEnum(
  "IranKetabDiscoveryRunStatus",
  ["RUNNING", "SUCCESS", "FAILED"],
);
export const IranKetabDiscoveryImportJobStatus = pgEnum(
  "IranKetabDiscoveryImportJobStatus",
  ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"],
);
export const CatalogBookContributorRole = pgEnum("CatalogBookContributorRole", [
  "AUTHOR",
  "TRANSLATOR",
]);

// ---------------- User ----------------
export const User = pgTable("User", {
  id: varchar("id")
    .primaryKey()
    .notNull()
    .default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  // تصویر کاور/بنر پروفایل (پس‌زمینه‌ی هدر، شبیه توییتر)
  profileBannerImage: text("profile_banner_image"),
  authProvider: AuthProvider("auth_provider").default("password").notNull(),
  googleId: text("google_id").unique(),
  password: text("password"),
  passwordHash: text("password_hash"),
  // ---- فیلدهای پروفایل (فاز ۲) ----
  username: varchar("username", { length: 30 }).unique(),
  bio: varchar("bio", { length: 500 }),
  location: varchar("location", { length: 100 }),
  website: text("website"),
  instagram: varchar("instagram", { length: 100 }),
  twitter: varchar("twitter", { length: 100 }),
  linkedin: text("linkedin"),
  telegram: varchar("telegram", { length: 100 }),
  profileVisibility: ProfileVisibility("profile_visibility")
    .default("PUBLIC")
    .notNull(),
  role: UserRole("role").default("USER").notNull(),
  sessionVersion: integer("session_version").default(0).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ---------------- ReferenceItem (فهرست‌های مرجع مدیریت‌شده توسط ادمین) ----------------
// یک جدول عمومی برای نویسنده/ژانر/مترجم/ناشر/کشور؛ مقادیر ادمین APPROVED و
// مقادیر پیشنهادی کاربر PENDING هستند.
export const ReferenceItem = pgTable(
  "ReferenceItem",
  {
    id: varchar("id")
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    type: ReferenceType("type").notNull(),
    name: text("name").notNull(),
    // فیلدهای صفحه‌ی عمومی موجودیت (نویسنده/ژانر/…). nullable برای سازگاری.
    slug: text("slug"),
    // کلید lookup نرمال‌شده؛ slug اصلی برای URL canonical و backward compatibility حفظ می‌شود.
    slugNormalized: text("slug_normalized"),
    coverImage: text("cover_image"),
    bannerImage: text("banner_image"),
    originalName: text("original_name"),
    description: text("description"),
    shortDescription: text("short_description"),
    imageFilename: text("image_filename"),
    sourceName: text("source_name"),
    sourceUrl: text("source_url"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    birthYear: integer("birth_year"),
    deathYear: integer("death_year"),
    countryName: text("country_name"),
    countrySlug: text("country_slug"),
    website: text("website"),
    status: ApprovalStatus("status").default("PENDING").notNull(),
    createdById: varchar("created_by_id").references(() => User.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => ({
    // اسلاگ یکتا در هر نوع (نویسنده و ناشر هم‌نام مجازند).
    typeSlugUnique: unique("ReferenceItem_type_slug_unique").on(t.type, t.slug),
  }),
);

// ---------------- PasswordResetToken ----------------
// فقط هش توکن ذخیره می‌شود؛ توکن خام هرگز در دیتابیس نگهداری نمی‌شود.
export const PasswordResetToken = pgTable("PasswordResetToken", {
  id: varchar("id")
    .primaryKey()
    .notNull()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => User.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const VerificationCode = pgTable(
  "VerificationCode",
  {
    id: varchar("id")
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    email: varchar("email", { length: 255 }).notNull(),
    codeHash: text("code_hash").notNull(),
    purpose: VerificationCodePurpose("purpose").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    consumedAt: timestamp("consumed_at", { mode: "date" }),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(5).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => ({
    emailPurposeIdx: index("VerificationCode_email_purpose_idx").on(
      t.email,
      t.purpose,
    ),
    expiresAtIdx: index("VerificationCode_expires_at_idx").on(t.expiresAt),
  }),
);

// ---------------- Account ----------------
export const Account = pgTable("Account", {
  id: varchar("id")
    .primaryKey()
    .notNull()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => User.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refreshToken: text("refresh_token"),
  accessToken: text("access_token"),
  expiresAt: integer("expires_at"),
  tokenType: text("token_type"),
  scope: text("scope"),
  idToken: text("id_token"),
  sessionState: text("session_state"),
});

// ---------------- Session ----------------
export const Session = pgTable("Session", {
  id: varchar("id")
    .primaryKey()
    .notNull()
    .default(sql`gen_random_uuid()`),
  sessionToken: text("session_token").unique().notNull(),
  userId: varchar("user_id")
    .notNull()
    .references(() => User.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

// ---------------- VerificationToken ----------------
export const VerificationToken = pgTable("VerificationToken", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull().unique(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

// ---------------- CatalogBook (هویت کانونی کتاب در کاتالوگ سراسری) ----------------
// کتاب‌هایی که روی پلتفرم وجود دارند و همه‌ی کاربران می‌توانند جست‌وجو و انتخابشان کنند.
export const CatalogBook = pgTable("CatalogBook", {
  id: varchar("id")
    .primaryKey()
    .notNull()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  slug: text("slug").unique(),
  slugNormalized: text("slug_normalized"),
  originalTitle: text("original_title"),
  description: text("description"),
  coverImage: text("cover_image"),
  author: text("author").notNull(),
  language: varchar("language", { length: 50 }),
  genre: text("genre"),
  country: text("country"),
  firstPublishedYear: integer("first_published_year"),
  sourceName: text("source_name"),
  sourceUrl: text("source_url"),
  // وضعیت تأیید برای نمایش در کاتالوگ عمومی (پیش‌فرض APPROVED؛ ساخت دستی PENDING)
  status: ApprovalStatus("status").default("APPROVED").notNull(),
  primaryEditionId: varchar("primary_edition_id"),
  // کاربری که این کتاب کانونی را ساخته (برای حسابرسی؛ با حذف کاربر null می‌شود)
  createdById: varchar("created_by_id").references(() => User.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ---------------- BookEdition (نسخه/چاپ مشخص از یک کتاب کانونی) ----------------
export const BookEdition = pgTable("BookEdition", {
  id: varchar("id")
    .primaryKey()
    .notNull()
    .default(sql`gen_random_uuid()`),
  catalogBookId: varchar("catalog_book_id")
    .notNull()
    .references(() => CatalogBook.id, { onDelete: "cascade" }),
  titleOverride: text("title_override"),
  translator: text("translator"),
  publisher: text("publisher"),
  isbn: varchar("isbn", { length: 20 }),
  isbn10: varchar("isbn10", { length: 20 }),
  isbn13: varchar("isbn13", { length: 20 }),
  format: BookFormat("format").notNull().default("PHYSICAL"),
  coverImage: text("cover_image"),
  coverFilename: text("cover_filename"),
  publishedYear: integer("published_year"),
  editionLabel: text("edition_label"),
  editionDescription: text("edition_description"),
  pageCount: integer("page_count"),
  language: varchar("language", { length: 50 }),
  sourceName: text("source_name"),
  sourceUrl: text("source_url"),
  sourceEditionCode: text("source_edition_code"),
  status: ApprovalStatus("status").default("APPROVED").notNull(),
  createdById: varchar("created_by_id").references(() => User.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const CatalogBookContributor = pgTable(
  "CatalogBookContributor",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`)
      .notNull(),
    catalogBookId: varchar("catalog_book_id")
      .notNull()
      .references(() => CatalogBook.id, { onDelete: "cascade" }),
    referenceItemId: varchar("reference_item_id")
      .notNull()
      .references(() => ReferenceItem.id, { onDelete: "cascade" }),
    role: CatalogBookContributorRole("role").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    sourceName: text("source_name"),
    sourceUrl: text("source_url"),
  },
  (t) => ({
    uniqueContributor: unique("CatalogBookContributor_unique").on(
      t.catalogBookId,
      t.referenceItemId,
      t.role,
    ),
    catalogIdx: index("CatalogBookContributor_catalog_idx").on(t.catalogBookId),
    referenceIdx: index("CatalogBookContributor_reference_idx").on(
      t.referenceItemId,
    ),
  }),
);

export const BookEditionPublisher = pgTable(
  "BookEditionPublisher",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`)
      .notNull(),
    bookEditionId: varchar("book_edition_id")
      .notNull()
      .references(() => BookEdition.id, { onDelete: "cascade" }),
    referenceItemId: varchar("reference_item_id")
      .notNull()
      .references(() => ReferenceItem.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").default(0).notNull(),
    sourceName: text("source_name"),
    sourceUrl: text("source_url"),
  },
  (t) => ({
    uniquePublisher: unique("BookEditionPublisher_unique").on(
      t.bookEditionId,
      t.referenceItemId,
    ),
    editionIdx: index("BookEditionPublisher_edition_idx").on(t.bookEditionId),
    referenceIdx: index("BookEditionPublisher_reference_idx").on(
      t.referenceItemId,
    ),
  }),
);

// ---------------- BookExternalLink (لینک‌های خرید/مطالعه‌ی بیرونی) ----------------
// مدل مقیاس‌پذیر: به‌جای یک ستون برای هر فروشگاه، هر لینک یک ردیف است. هویت
// کانونی = CatalogBook؛ editionId اختیاری برای لینک‌های مخصوص یک نسخه.
export const BookExternalLink = pgTable(
  "BookExternalLink",
  {
    id: varchar("id")
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    catalogBookId: varchar("catalog_book_id")
      .notNull()
      .references(() => CatalogBook.id, { onDelete: "cascade" }),
    editionId: varchar("edition_id").references(() => BookEdition.id, {
      onDelete: "set null",
    }),
    provider: ExternalLinkProvider("provider").notNull(),
    label: text("label"),
    url: text("url").notNull(),
    type: ExternalLinkType("type").notNull().default("unknown"),
    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => ({
    catalogIdx: index("BookExternalLink_catalog_idx").on(t.catalogBookId),
    providerIdx: index("BookExternalLink_provider_idx").on(t.provider),
    activeIdx: index("BookExternalLink_active_idx").on(t.isActive),
    // از لینک تکراریِ یک فروشگاه با همان URL برای یک کتاب جلوگیری می‌کند.
    catalogProviderUrlUnique: unique(
      "BookExternalLink_catalog_provider_url_unique",
    ).on(t.catalogBookId, t.provider, t.url),
  }),
);

// ---------------- Book (ردیف کتابخانه‌ی شخصی کاربر) ----------------
export const Book = pgTable("Book", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`)
    .notNull(),
  title: text("title").notNull(),
  // اسلاگ خوانا برای URL عمومی کتاب (یکتا). nullable برای ردیف‌های قدیمی؛
  // به‌صورت تنبل هنگام اولین مشاهده ساخته می‌شود اگر خالی باشد.
  slug: text("slug").unique(),
  // جلد اختیاری است؛ در نبود آن از تصویر پیش‌فرض استفاده می‌شود
  coverImage: text("cover_image"),
  author: text("author").notNull(),
  translator: text("translator"),
  description: text("description"),
  country: text("country"),
  genre: text("genre").notNull(),
  pageCount: integer("page_count"),
  format: BookFormat("format").notNull(),
  publisher: text("publisher"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  userId: varchar("user_id")
    .notNull()
    .references(() => User.id, { onDelete: "cascade" }),
  status: BookStatus("status").default("UNREAD").notNull(),
  progress: integer("progress"),
  // Reading progress is kept on the existing personal-library record so it
  // stays tied to the user's chosen edition and never creates a second status
  // system.
  currentPage: integer("current_page").default(0).notNull(),
  readingUpdatedAt: timestamp("reading_updated_at", { mode: "date" }),
  completedAt: timestamp("completed_at", { mode: "date" }),
  rating: integer("rating"),
  review: text("review"),
  // حس/حال‌وهوای شخصی کاربر از کتاب (چندتایی). nullable برای سازگاری با ردیف‌های قدیمی.
  moodTags: text("mood_tags").array(),
  // علاقه‌مندی صریح کاربر (مستقل از امتیاز)
  isFavorite: boolean("is_favorite").default(false).notNull(),
  // پیوند اختیاری به کاتالوگ سراسری (در حالت افزودن از کاتالوگ پر می‌شود؛
  // برای کتاب‌های دستیِ قدیمی/مستقل null می‌ماند)
  catalogBookId: varchar("catalog_book_id").references(() => CatalogBook.id, {
    onDelete: "set null",
  }),
  editionId: varchar("edition_id").references(() => BookEdition.id, {
    onDelete: "set null",
  }),
});

// ---------------- Quote ----------------
export const Quote = pgTable(
  "Quote",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    userId: varchar("user_id")
      .notNull()
      .references(() => User.id, { onDelete: "cascade" }),

    content: text("content").notNull(),

    imageKey: text("image_key"),

    page: integer("page"),

    background: text("background").notNull().default("default"),

    catalogBookId: varchar("catalog_book_id").references(() => CatalogBook.id, {
      onDelete: "set null",
    }),

    bookEditionId: varchar("book_edition_id").references(() => BookEdition.id, {
      onDelete: "set null",
    }),

    bookId: varchar("book_id")
      .notNull()
      .references(() => Book.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),

    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    imageKeyUnique: uniqueIndex("Quote_image_key_unique").on(table.imageKey),
    bookIdx: index("Quote_book_id_idx").on(table.bookId),
    userIdx: index("Quote_user_id_idx").on(table.userId),
    createdAtIdx: index("Quote_created_at_idx").on(table.createdAt),
    updatedAtIdx: index("Quote_updated_at_idx").on(table.updatedAt),
  }),
);

// ---------------- QuoteBackground (پس‌زمینه‌های مدیریت‌شده‌ی تکه کتاب) ----------------
export const QuoteBackground = pgTable(
  "QuoteBackground",
  {
    id: varchar("id")
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    value: text("value").notNull().unique("QuoteBackground_value_unique"),
    label: text("label").notNull(),
    imageKey: text("image_key"),
    imageUrl: text("image_url"),
    isActive: boolean("is_active").default(true).notNull(),
    displayOrder: integer("display_order").default(0).notNull(),
    isSystem: boolean("is_system").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    displayOrderIdx: index("QuoteBackground_display_order_idx").on(table.displayOrder),
    isActiveIdx: index("QuoteBackground_is_active_idx").on(table.isActive),
  }),
);

// ---------------- PersonalBookNote (دفترچه‌ی خصوصی مطالعه) ----------------
// این یادداشت‌ها جدا از یادداشت‌های منتشرشده‌اند و فقط به رکورد کتابِ شخصیِ
// کاربر وصل می‌شوند؛ بنابراین هرگز در پروفایل یا صفحه‌ی عمومی نمایش داده نمی‌شوند.
export const PersonalBookNote = pgTable(
  "PersonalBookNote",
  {
    id: varchar("id")
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    bookId: varchar("book_id")
      .notNull()
      .references(() => Book.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => User.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    pageNumber: integer("page_number"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    bookUserIdx: index("PersonalBookNote_book_user_idx").on(
      table.bookId,
      table.userId,
    ),
    createdAtIdx: index("PersonalBookNote_created_at_idx").on(table.createdAt),
  }),
);

// ---------------- PublicBookThought (لحظه‌ی منتخبِ عمومی) ----------------
// انتشار فقط با انتخاب صریح کاربر انجام می‌شود. متن اصلی PersonalBookNote
// همچنان خصوصی است و این ردیف یک نسخه‌ی مستقل برای صفحه‌ی عمومی کتاب است.
export const PublicBookThought = pgTable(
  "PublicBookThought",
  {
    id: varchar("id")
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    catalogBookId: varchar("catalog_book_id")
      .notNull()
      .references(() => CatalogBook.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => User.id, { onDelete: "cascade" }),
    sourcePersonalNoteId: varchar("source_personal_note_id").references(
      () => PersonalBookNote.id,
      { onDelete: "set null" },
    ),
    content: text("content").notNull(),
    pageNumber: integer("page_number"),
    type: PublicBookThoughtType("type").default("THOUGHT").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    sourceNoteUnique: uniqueIndex("PublicBookThought_source_note_unique").on(
      table.sourcePersonalNoteId,
    ),
    bookCreatedIdx: index("PublicBookThought_book_created_idx").on(
      table.catalogBookId,
      table.createdAt,
    ),
    userIdx: index("PublicBookThought_user_idx").on(table.userId),
  }),
);

// ---------------- ReadingEvent (مسیر خصوصی مطالعه) ----------------
// وضعیت و صفحه‌ی فعلی همچنان روی Book نگهداری می‌شوند؛ این جدول فقط رخدادهای
// مهم مسیر مطالعه را برای دفترچه‌ی شخصی کاربر ثبت می‌کند.
export const ReadingEvent = pgTable(
  "ReadingEvent",
  {
    id: varchar("id")
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => User.id, { onDelete: "cascade" }),
    bookId: varchar("book_id")
      .notNull()
      .references(() => Book.id, { onDelete: "cascade" }),
    type: ReadingEventType("type").notNull(),
    pageFrom: integer("page_from"),
    pageTo: integer("page_to"),
    pagesRead: integer("pages_read"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userBookCreatedIdx: index("ReadingEvent_user_book_created_idx").on(
      table.userId,
      table.bookId,
      table.createdAt,
    ),
  }),
);

export const IranKetabImportSession = pgTable(
  "IranKetabImportSession",
  {
    id: varchar("id")
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    adminId: varchar("admin_id")
      .notNull()
      .references(() => User.id, { onDelete: "restrict" }),
    sourceUrl: text("source_url").notNull(),
    canonicalSourceUrl: text("canonical_source_url").notNull(),
    sourceName: text("source_name").default("iranketab").notNull(),
    status: IranKetabImportStatus("status").default("CREATED").notNull(),
    startedAt: timestamp("started_at", { mode: "date" }),
    completedAt: timestamp("completed_at", { mode: "date" }),
    draftVersion: integer("draft_version").default(1).notNull(),
    catalogId: varchar("catalog_id").references(() => CatalogBook.id, {
      onDelete: "set null",
    }),
    draft: jsonb("draft").$type<Record<string, unknown> | null>(),
    extraction: jsonb("extraction").$type<Record<string, unknown> | null>(),
    extractionFingerprint: text("extraction_fingerprint"),
    preparedCovers: jsonb("prepared_covers").$type<
      Record<string, unknown>[] | null
    >(),
    resultSummary: jsonb("result_summary").$type<Record<
      string,
      unknown
    > | null>(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    retryable: boolean("retryable").default(false).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => ({
    adminIdx: index("IranKetabImportSession_admin_idx").on(t.adminId),
    statusIdx: index("IranKetabImportSession_status_idx").on(t.status),
    createdIdx: index("IranKetabImportSession_created_idx").on(t.createdAt),
    canonicalIdx: index("IranKetabImportSession_canonical_idx").on(
      t.canonicalSourceUrl,
    ),
  }),
);

export const IranKetabImportEvent = pgTable(
  "IranKetabImportEvent",
  {
    id: varchar("id")
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    sessionId: varchar("session_id")
      .notNull()
      .references(() => IranKetabImportSession.id, { onDelete: "cascade" }),
    type: IranKetabImportEventType("type").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => ({
    sessionIdx: index("IranKetabImportEvent_session_idx").on(t.sessionId),
    createdIdx: index("IranKetabImportEvent_created_idx").on(t.createdAt),
    typeIdx: index("IranKetabImportEvent_type_idx").on(t.type),
  }),
);

/** Shared, source-derived preview work. Per-admin drafts remain in IranKetabImportSession. */
export const IranKetabPreviewOperation = pgTable(
  "IranKetabPreviewOperation",
  {
    id: varchar("id")
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    sourceIdentity: text("source_identity").notNull(),
    status: IranKetabPreviewOperationStatus("status")
      .default("PROCESSING")
      .notNull(),
    leaseExpiresAt: timestamp("lease_expires_at", { mode: "date" }),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    result: jsonb("result").$type<Record<string, unknown> | null>(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    retryable: boolean("retryable").default(false).notNull(),
    generation: integer("generation").default(1).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => ({
    sourceIdentityUnique: unique(
      "IranKetabPreviewOperation_source_identity_unique",
    ).on(t.sourceIdentity),
    reclaimIdx: index("IranKetabPreviewOperation_reclaim_idx").on(
      t.status,
      t.leaseExpiresAt,
      t.expiresAt,
    ),
  }),
);

// ---------------- AnalyticsPageView ----------------
// First-party, privacy-conscious traffic measurement. `visitorId` is a random
// opaque cookie value; IP addresses, user agents and query strings are never
// persisted. Content fields are derived from the normalized public pathname.
export const AnalyticsPageView = pgTable(
  "AnalyticsPageView",
  {
    id: varchar("id")
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    visitorId: varchar("visitor_id", { length: 64 }).notNull(),
    userId: varchar("user_id").references(() => User.id, {
      onDelete: "set null",
    }),
    path: varchar("path", { length: 500 }).notNull(),
    ipAddress: varchar("ip_address", { length: 128 }),
    userAgent: text("user_agent"),
    referrer: varchar("referrer", { length: 1000 }),
    contentKind: varchar("content_kind", { length: 32 }),
    contentSlug: varchar("content_slug", { length: 255 }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index("AnalyticsPageView_created_at_idx").on(table.createdAt),
    visitorCreatedIdx: index("AnalyticsPageView_visitor_created_idx").on(
      table.visitorId,
      table.createdAt,
    ),
    contentCreatedIdx: index("AnalyticsPageView_content_created_idx").on(
      table.contentKind,
      table.contentSlug,
      table.createdAt,
    ),
    userCreatedIdx: index("AnalyticsPageView_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
  }),
);

/** Configured, curated IranKetab surfaces. Discovery fetches these pages; it never uses them as book import URLs. */
export const IranKetabDiscoverySource = pgTable(
  "IranKetabDiscoverySource",
  {
    id: varchar("id")
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    sourceType: IranKetabDiscoverySourceType("source_type").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceKey: text("source_key").notNull(),
    importance: integer("importance").default(50).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    crawlStatus: IranKetabDiscoveryCrawlStatus("crawl_status")
      .default("IDLE")
      .notNull(),
    crawlLeaseExpiresAt: timestamp("crawl_lease_expires_at", { mode: "date" }),
    crawlIntervalMinutes: integer("crawl_interval_minutes")
      .default(1440)
      .notNull(),
    autoQueue: boolean("auto_queue").default(false).notNull(),
    importMode: IranKetabDiscoveryImportMode("import_mode").default("MANUAL_REVIEW").notNull(),
    publisherImportStatus: IranKetabPublisherImportStatus("publisher_import_status")
      .default("IDLE")
      .notNull(),
    publisherImportStartedAt: timestamp("publisher_import_started_at", { mode: "date" }),
    publisherImportCompletedAt: timestamp("publisher_import_completed_at", { mode: "date" }),
    minimumQueueScore: integer("minimum_queue_score").default(85).notNull(),
    parserVersion: integer("parser_version").default(1).notNull(),
    lastCrawledAt: timestamp("last_crawled_at", { mode: "date" }),
    nextCrawlAt: timestamp("next_crawl_at", { mode: "date" }),
    lastSuccessAt: timestamp("last_success_at", { mode: "date" }),
    lastErrorCode: text("last_error_code"),
    lastErrorMessage: text("last_error_message"),
    discoveredBookCount: integer("discovered_book_count").default(0).notNull(),
    newBookCount: integer("new_book_count").default(0).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdById: varchar("created_by_id").references(() => User.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => ({
    sourceUrlUnique: unique("IranKetabDiscoverySource_source_url_unique").on(
      t.sourceUrl,
    ),
    sourceKeyUnique: unique("IranKetabDiscoverySource_source_key_unique").on(
      t.sourceKey,
    ),
    crawlReadyIdx: index("IranKetabDiscoverySource_crawl_ready_idx").on(
      t.enabled,
      t.crawlStatus,
      t.nextCrawlAt,
    ),
    crawlLeaseIdx: index("IranKetabDiscoverySource_crawl_lease_idx").on(
      t.crawlStatus,
      t.crawlLeaseExpiresAt,
    ),
    oneRunningPublisher: uniqueIndex("IranKetabDiscoverySource_one_running_publisher")
      .on(t.publisherImportStatus)
      .where(sql`${t.sourceType} = 'PUBLISHER' and ${t.publisherImportStatus} = 'RUNNING'`),
    importanceRange: check(
      "IranKetabDiscoverySource_importance_range_check",
      sql`${t.importance} between 0 and 100`,
    ),
    crawlIntervalPositive: check(
      "IranKetabDiscoverySource_crawl_interval_positive_check",
      sql`${t.crawlIntervalMinutes} > 0`,
    ),
    minimumQueueScoreRange: check(
      "IranKetabDiscoverySource_minimum_queue_score_range_check",
      sql`${t.minimumQueueScore} between 0 and 100`,
    ),
    discoveredBookCountNonnegative: check(
      "IranKetabDiscoverySource_discovered_book_count_nonnegative_check",
      sql`${t.discoveredBookCount} >= 0`,
    ),
    newBookCountNonnegative: check(
      "IranKetabDiscoverySource_new_book_count_nonnegative_check",
      sql`${t.newBookCount} >= 0`,
    ),
  }),
);

/** One canonical IranKetab book candidate, independent of how many sources found it. */
export const IranKetabDiscoveryItem = pgTable(
  "IranKetabDiscoveryItem",
  {
    id: varchar("id")
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    iranKetabBookId: varchar("iranketab_book_id", { length: 32 }).notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    titleHint: text("title_hint"),
    authorHint: text("author_hint"),
    preferredEditionCode: text("preferred_edition_code"),
    priorityScore: integer("priority_score").default(0).notNull(),
    scoreBreakdown: jsonb("score_breakdown").$type<
      Record<string, unknown> | null
    >(),
    importConfidence: IranKetabDiscoveryImportConfidence("import_confidence")
      .default("LOW")
      .notNull(),
    status: IranKetabDiscoveryItemStatus("status")
      .default("DISCOVERED")
      .notNull(),
    existingCatalogBookId: varchar("existing_catalog_book_id").references(
      () => CatalogBook.id,
      { onDelete: "set null" },
    ),
    importSessionId: varchar("import_session_id").references(
      () => IranKetabImportSession.id,
      { onDelete: "set null" },
    ),
    failureCode: text("failure_code"),
    failureReason: text("failure_reason"),
    retryCount: integer("retry_count").default(0).notNull(),
    nextRetryAt: timestamp("next_retry_at", { mode: "date" }),
    leaseExpiresAt: timestamp("lease_expires_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => ({
    iranKetabBookIdUnique: unique(
      "IranKetabDiscoveryItem_iranketab_book_id_unique",
    ).on(t.iranKetabBookId),
    canonicalUrlUnique: unique(
      "IranKetabDiscoveryItem_canonical_url_unique",
    ).on(t.canonicalUrl),
    queueIdx: index("IranKetabDiscoveryItem_queue_idx").on(
      t.status,
      t.priorityScore,
      t.nextRetryAt,
    ),
    statusIdx: index("IranKetabDiscoveryItem_status_idx").on(t.status),
    leaseIdx: index("IranKetabDiscoveryItem_lease_idx").on(
      t.status,
      t.leaseExpiresAt,
    ),
    priorityScoreRange: check(
      "IranKetabDiscoveryItem_priority_score_range_check",
      sql`${t.priorityScore} between 0 and 100`,
    ),
    retryCountNonnegative: check(
      "IranKetabDiscoveryItem_retry_count_nonnegative_check",
      sql`${t.retryCount} >= 0`,
    ),
  }),
);

/** Source-specific provenance for a canonical discovery item. */
export const IranKetabDiscoveryMembership = pgTable(
  "IranKetabDiscoveryMembership",
  {
    id: varchar("id")
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    discoveryItemId: varchar("discovery_item_id")
      .notNull()
      .references(() => IranKetabDiscoveryItem.id, { onDelete: "cascade" }),
    discoverySourceId: varchar("discovery_source_id")
      .notNull()
      .references(() => IranKetabDiscoverySource.id, { onDelete: "cascade" }),
    firstSeenAt: timestamp("first_seen_at", { mode: "date" })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { mode: "date" })
      .defaultNow()
      .notNull(),
    sourcePosition: integer("source_position"),
    sourceTitleHint: text("source_title_hint"),
    preferredEditionCode: text("preferred_edition_code"),
    sourceScoreContribution: integer("source_score_contribution")
      .default(0)
      .notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => ({
    itemSourceUnique: unique(
      "IranKetabDiscoveryMembership_item_source_unique",
    ).on(t.discoveryItemId, t.discoverySourceId),
    sourceIdx: index("IranKetabDiscoveryMembership_source_idx").on(
      t.discoverySourceId,
      t.lastSeenAt,
    ),
    itemIdx: index("IranKetabDiscoveryMembership_item_idx").on(
      t.discoveryItemId,
    ),
    sourcePositionNonnegative: check(
      "IranKetabDiscoveryMembership_source_position_nonnegative_check",
      sql`${t.sourcePosition} is null or ${t.sourcePosition} >= 0`,
    ),
  }),
);

/** Immutable operational history for each source crawl. */
export const IranKetabDiscoveryRun = pgTable(
  "IranKetabDiscoveryRun",
  {
    id: varchar("id")
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    discoverySourceId: varchar("discovery_source_id")
      .notNull()
      .references(() => IranKetabDiscoverySource.id, { onDelete: "cascade" }),
    status: IranKetabDiscoveryRunStatus("status").notNull(),
    startedAt: timestamp("started_at", { mode: "date" }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { mode: "date" }),
    pagesFetched: integer("pages_fetched").default(0).notNull(),
    booksFound: integer("books_found").default(0).notNull(),
    itemsInserted: integer("items_inserted").default(0).notNull(),
    itemsUpdated: integer("items_updated").default(0).notNull(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    diagnostics: jsonb("diagnostics").$type<Record<string, unknown> | null>(),
  },
  (t) => ({
    sourceStartedIdx: index("IranKetabDiscoveryRun_source_started_idx").on(
      t.discoverySourceId,
      t.startedAt,
    ),
    statusIdx: index("IranKetabDiscoveryRun_status_idx").on(t.status),
    pagesFetchedNonnegative: check(
      "IranKetabDiscoveryRun_pages_fetched_nonnegative_check",
      sql`${t.pagesFetched} >= 0`,
    ),
    booksFoundNonnegative: check(
      "IranKetabDiscoveryRun_books_found_nonnegative_check",
      sql`${t.booksFound} >= 0`,
    ),
    itemsInsertedNonnegative: check(
      "IranKetabDiscoveryRun_items_inserted_nonnegative_check",
      sql`${t.itemsInserted} >= 0`,
    ),
    itemsUpdatedNonnegative: check(
      "IranKetabDiscoveryRun_items_updated_nonnegative_check",
      sql`${t.itemsUpdated} >= 0`,
    ),
  }),
);

/** Durable, lease-based handoff from reviewed discovery candidates to the importer. */
export const IranKetabDiscoveryImportJob = pgTable(
  "IranKetabDiscoveryImportJob",
  {
    id: varchar("id")
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    discoveryItemId: varchar("discovery_item_id")
      .notNull()
      .references(() => IranKetabDiscoveryItem.id, { onDelete: "cascade" }),
    discoverySourceId: varchar("discovery_source_id").references(() => IranKetabDiscoverySource.id, { onDelete: "set null" }),
    status: IranKetabDiscoveryImportJobStatus("status")
      .default("PENDING")
      .notNull(),
    priority: integer("priority").default(0).notNull(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    availableAt: timestamp("available_at", { mode: "date" }).defaultNow().notNull(),
    lockedAt: timestamp("locked_at", { mode: "date" }),
    lockedBy: varchar("locked_by"),
    startedAt: timestamp("started_at", { mode: "date" }),
    completedAt: timestamp("completed_at", { mode: "date" }),
    lastErrorCode: text("last_error_code"),
    lastErrorMessage: text("last_error_message"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => ({
    activeItemUnique: uniqueIndex("IranKetabDiscoveryImportJob_active_item_unique")
      .on(t.discoveryItemId)
      .where(sql`${t.status} in ('PENDING', 'PROCESSING')`),
    claimIdx: index("IranKetabDiscoveryImportJob_claim_idx").on(
      t.status,
      t.availableAt,
      t.priority,
      t.createdAt,
    ),
    itemIdx: index("IranKetabDiscoveryImportJob_item_idx").on(
      t.discoveryItemId,
      t.createdAt,
    ),
    sourceIdx: index("IranKetabDiscoveryImportJob_source_idx").on(
      t.discoverySourceId,
      t.status,
    ),
    lockIdx: index("IranKetabDiscoveryImportJob_lock_idx").on(
      t.status,
      t.lockedAt,
    ),
    priorityRange: check(
      "IranKetabDiscoveryImportJob_priority_range_check",
      sql`${t.priority} between 0 and 100`,
    ),
    attemptsNonnegative: check(
      "IranKetabDiscoveryImportJob_attempts_nonnegative_check",
      sql`${t.attempts} >= 0`,
    ),
    maxAttemptsPositive: check(
      "IranKetabDiscoveryImportJob_max_attempts_positive_check",
      sql`${t.maxAttempts} > 0`,
    ),
  }),
);

// ---------------- QuoteLike (پسند نقل‌قول؛ هر کاربر یک‌بار) ----------------
// مدل افزایشی و کم‌هزینه: شمار پسندها از روی تعداد ردیف‌ها محاسبه می‌شود و
// قید یکتایی (quote_id, user_id) از پسند تکراری جلوگیری می‌کند.
export const QuoteLike = pgTable(
  "QuoteLike",
  {
    id: varchar("id")
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    quoteId: varchar("quote_id")
      .notNull()
      .references(() => Quote.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => User.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => ({
    uniqueQuoteUser: unique("QuoteLike_quote_user_unique").on(
      t.quoteId,
      t.userId,
    ),
  }),
);

// ---------------- PublishedBookNote (یادداشت عمومیِ منتشرشده درباره‌ی کتاب) ----------------
// جدا از review/توضیحات خصوصیِ ردیف Book؛ فقط یادداشت‌هایی که کاربر آگاهانه
// منتشر می‌کند اینجا ذخیره می‌شوند و در پروفایل عمومی دیده می‌شوند (تابع حریم
// خصوصی پروفایل). وجود ردیف یعنی «منتشرشده».
export const PublishedBookNote = pgTable(
  "PublishedBookNote",
  {
    id: varchar("id")
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => User.id, { onDelete: "cascade" }),
    bookId: varchar("book_id").references(() => Book.id, {
      onDelete: "cascade",
    }),
    catalogBookId: varchar("catalog_book_id").references(() => CatalogBook.id, {
      onDelete: "cascade",
    }),
    bookEditionId: varchar("book_edition_id").references(() => BookEdition.id, {
      onDelete: "set null",
    }),
    scope: NoteScope("scope").default("book").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("PublishedBookNote_user_id_idx").on(table.userId),
    bookIdx: index("PublishedBookNote_book_id_idx").on(table.bookId),
    createdAtIdx: index("PublishedBookNote_created_at_idx").on(table.createdAt),
    updatedAtIdx: index("PublishedBookNote_updated_at_idx").on(table.updatedAt),
    contentLength: check(
      "PublishedBookNote_content_length_check",
      sql`char_length(${table.content}) <= 50000`,
    ),
  }),
);

// ---------------- PublishedBookNoteLike (پسند یادداشت عمومی؛ مثل QuoteLike) ----------------
export const PublishedBookNoteLike = pgTable(
  "PublishedBookNoteLike",
  {
    id: varchar("id")
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    noteId: varchar("note_id")
      .notNull()
      .references(() => PublishedBookNote.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => User.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => ({
    uniqueNoteUser: unique("PublishedBookNoteLike_note_user_unique").on(
      t.noteId,
      t.userId,
    ),
  }),
);

// ---------------- HomeFeaturedBook (کتاب‌های پیشنهادیِ انتخابیِ ادمین برای صفحه‌ی اصلی) ----------------
export const HomeFeaturedBook = pgTable("HomeFeaturedBook", {
  id: varchar("id")
    .primaryKey()
    .notNull()
    .default(sql`gen_random_uuid()`),
  // هویت کانونیِ کتاب (CatalogBook). انتخاب‌های جدید این را پر می‌کنند.
  catalogBookId: varchar("catalog_book_id")
    .unique()
    .references(() => CatalogBook.id, { onDelete: "cascade" }),
  // ردیف کتابخانه‌ی قدیمی؛ فقط برای سازگاری با انتخاب‌های پیش از نرمال‌سازی کاتالوگ.
  bookId: varchar("book_id")
    .unique()
    .references(() => Book.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ---------------- HomeHeroSlide (اسلایدِ صفحه‌ی اصلیِ مدیریت‌شده توسط ادمین) ----------------
export const HomeHeroSlide = pgTable("HomeHeroSlide", {
  id: varchar("id")
    .primaryKey()
    .notNull()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  badge: text("badge"),
  primaryCtaLabel: text("primary_cta_label"),
  primaryCtaHref: text("primary_cta_href"),
  secondaryCtaLabel: text("secondary_cta_label"),
  secondaryCtaHref: text("secondary_cta_href"),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ---------------- HomeHeroSlideBook (کتاب‌های انتخابیِ هر اسلاید؛ ۱ تا ۳) ----------------
export const HomeHeroSlideBook = pgTable("HomeHeroSlideBook", {
  id: varchar("id")
    .primaryKey()
    .notNull()
    .default(sql`gen_random_uuid()`),
  slideId: varchar("slide_id")
    .notNull()
    .references(() => HomeHeroSlide.id, { onDelete: "cascade" }),
  // هویت کانونیِ کتاب (CatalogBook). انتخاب‌های جدید این را پر می‌کنند.
  catalogBookId: varchar("catalog_book_id").references(() => CatalogBook.id, {
    onDelete: "cascade",
  }),
  // ردیف کتابخانه‌ی قدیمی؛ فقط برای سازگاری با انتخاب‌های قبلی.
  bookId: varchar("book_id").references(() => Book.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").default(0).notNull(),
});

// ---------------- BlogCategory (دسته‌بندیِ مخصوص نوشته‌های بلاگ) ----------------
export const BlogCategory = pgTable("BlogCategory", {
  id: varchar("id")
    .primaryKey()
    .notNull()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ---------------- BlogPost ----------------
export const BlogPost = pgTable("BlogPost", {
  id: varchar("id")
    .primaryKey()
    .notNull()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  // دسته‌بندیِ نوشته. nullable برای سازگاری با ردیف‌های قدیمی؛ در فرم الزامی است.
  // حذف دسته‌ای که نوشته دارد در سرویس مسدود می‌شود (RESTRICT).
  categoryId: varchar("category_id").references(() => BlogCategory.id, {
    onDelete: "restrict",
  }),
  excerpt: text("excerpt"),
  content: text("content").notNull(),
  bannerImage: text("banner_image").notNull(),
  status: BlogPostStatus("status").default("DRAFT").notNull(),
  createdById: varchar("created_by_id").references(() => User.id, {
    onDelete: "set null",
  }),
  publishedAt: timestamp("published_at", { mode: "date" }),
  readingTime: integer("reading_time"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  canonicalUrl: text("canonical_url"),
  ogImage: text("og_image"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ---------------- HomeFeaturedAuthor (نویسنده‌های منتخبِ انتخابیِ ادمین) ----------------
export const HomeFeaturedAuthor = pgTable(
  "HomeFeaturedAuthor",
  {
    id: varchar("id")
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    authorId: varchar("author_id")
      .notNull()
      .references(() => ReferenceItem.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => ({
    authorUnique: unique("HomeFeaturedAuthor_author_id_unique").on(t.authorId),
    sortOrderIdx: index("HomeFeaturedAuthor_sort_order_idx").on(t.sortOrder),
  }),
);

// ---------------- HomeFeaturedBlogPost (مطالب مجله‌ی انتخابیِ ادمین) ----------------
export const HomeFeaturedBlogPost = pgTable(
  "HomeFeaturedBlogPost",
  {
    id: varchar("id")
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    blogPostId: varchar("blog_post_id")
      .notNull()
      .references(() => BlogPost.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => ({
    postUnique: unique("HomeFeaturedBlogPost_blog_post_id_unique").on(
      t.blogPostId,
    ),
    sortOrderIdx: index("HomeFeaturedBlogPost_sort_order_idx").on(t.sortOrder),
  }),
);

// One row per searchable catalog/edition value. It is maintained by database
// triggers so every importer/admin path has the same searchable representation.
export const BookSearchIndex = pgTable(
  "BookSearchIndex",
  {
    id: varchar("id").primaryKey().notNull().default(sql`gen_random_uuid()`),
    catalogBookId: varchar("catalog_book_id")
      .notNull()
      .references(() => CatalogBook.id, { onDelete: "cascade" }),
    editionId: varchar("edition_id").references(() => BookEdition.id, {
      onDelete: "cascade",
    }),
    kind: varchar("kind", { length: 40 }).notNull(),
    valueNormalized: text("value_normalized").notNull(),
    valueCompact: text("value_compact").notNull(),
  },
  (t) => ({
    catalogIdx: index("BookSearchIndex_catalog_idx").on(t.catalogBookId),
    compactIdx: index("BookSearchIndex_compact_idx").on(t.valueCompact),
  }),
);

// Explicit editorial graph edges. Embedded books remain a live relationship
// source in article HTML; these tables store only editor-managed additions.
export const BlogPostBook = pgTable(
  "BlogPostBook",
  {
    postId: varchar("post_id").notNull().references(() => BlogPost.id, { onDelete: "cascade" }),
    bookId: varchar("book_id").notNull().references(() => CatalogBook.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => ({ uniqueEdge: unique("BlogPostBook_unique").on(t.postId, t.bookId), postIdx: index("BlogPostBook_post_idx").on(t.postId), bookIdx: index("BlogPostBook_book_idx").on(t.bookId) }),
);

export const BlogPostAuthor = pgTable(
  "BlogPostAuthor",
  {
    postId: varchar("post_id").notNull().references(() => BlogPost.id, { onDelete: "cascade" }),
    authorId: varchar("author_id").notNull().references(() => ReferenceItem.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => ({ uniqueEdge: unique("BlogPostAuthor_unique").on(t.postId, t.authorId), postIdx: index("BlogPostAuthor_post_idx").on(t.postId), authorIdx: index("BlogPostAuthor_author_idx").on(t.authorId) }),
);

export const BlogPostGenre = pgTable(
  "BlogPostGenre",
  {
    postId: varchar("post_id").notNull().references(() => BlogPost.id, { onDelete: "cascade" }),
    genreId: varchar("genre_id").notNull().references(() => ReferenceItem.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => ({ uniqueEdge: unique("BlogPostGenre_unique").on(t.postId, t.genreId), postIdx: index("BlogPostGenre_post_idx").on(t.postId), genreIdx: index("BlogPostGenre_genre_idx").on(t.genreId) }),
);

// ---------------- SiteSetting (تنظیمات سراسری سایت؛ مدل کلید-مقدار) ----------------
// یک ردیف به‌ازای هر کلید تنظیم. مقادیر به‌صورت متن ذخیره می‌شوند (بولین‌ها
// "true"/"false") و در سرویس به شکل تایپ‌شده‌ی SiteSettings نرمال می‌شوند.
// مدل کلید-مقدار افزایشی است: افزودن تنظیم جدید نیازی به migration ندارد.
export const SiteSetting = pgTable("SiteSetting", {
  key: varchar("key", { length: 100 }).primaryKey().notNull(),
  value: text("value"),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ---------------- StaticPage (صفحات ثابتِ قابل‌ویرایش توسط ادمین) ----------------
// صفحه‌های عمومیِ ثابت مثل «درباره ما»، «تماس»، «قوانین»، «حریم خصوصی» و
// «راهنما». اسلاگ‌های هسته‌ای ثابت‌اند و در سرویس از حذف/تغییر محافظت می‌شوند؛
// محتوای HTML پیش از ذخیره و نمایش پاک‌سازی (sanitize) می‌شود.
export const StaticPage = pgTable("StaticPage", {
  id: varchar("id")
    .primaryKey()
    .notNull()
    .default(sql`gen_random_uuid()`),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  content: text("content").default("").notNull(),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  status: StaticPageStatus("status").default("PUBLISHED").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ---------------- Wishlist ----------------
export const Wishlist = pgTable("Wishlist", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`)
    .notNull(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  translator: text("translator"),
  publisher: text("publisher"),
  genre: text("genre"),
  note: text("note"),
  priority: PurchasePriority("priority").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),

  userId: varchar("user_id")
    .notNull()
    .references(() => User.id, { onDelete: "cascade" }),
});

// ---------------- Relations ----------------
export const UserRelations = relations(User, ({ many }) => ({
  accounts: many(Account),
  books: many(Book),
  quotes: many(Quote),
  sessions: many(Session),
  wishlist: many(Wishlist),
  passwordResetTokens: many(PasswordResetToken),
  blogPosts: many(BlogPost),
  publicThoughts: many(PublicBookThought),
}));

export const BookEditionContributor = pgTable(
  "BookEditionContributor",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`)
      .notNull(),
    bookEditionId: varchar("book_edition_id")
      .notNull()
      .references(() => BookEdition.id, { onDelete: "cascade" }),
    referenceItemId: varchar("reference_item_id")
      .notNull()
      .references(() => ReferenceItem.id, { onDelete: "cascade" }),
    role: CatalogBookContributorRole("role").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    sourceName: text("source_name"),
    sourceUrl: text("source_url"),
  },
  (t) => ({
    uniqueContributor: unique("BookEditionContributor_unique").on(
      t.bookEditionId,
      t.referenceItemId,
      t.role,
    ),
    editionIdx: index("BookEditionContributor_edition_idx").on(t.bookEditionId),
    referenceIdx: index("BookEditionContributor_reference_idx").on(
      t.referenceItemId,
    ),
  }),
);

export const PasswordResetTokenRelations = relations(
  PasswordResetToken,
  ({ one }) => ({
    user: one(User, {
      fields: [PasswordResetToken.userId],
      references: [User.id],
    }),
  }),
);

export const CatalogBookRelations = relations(CatalogBook, ({ many }) => ({
  editions: many(BookEdition),
  externalLinks: many(BookExternalLink),
  notes: many(PublishedBookNote),
  publicThoughts: many(PublicBookThought),
  quotes: many(Quote),
}));

export const BookExternalLinkRelations = relations(
  BookExternalLink,
  ({ one }) => ({
    catalogBook: one(CatalogBook, {
      fields: [BookExternalLink.catalogBookId],
      references: [CatalogBook.id],
    }),
    edition: one(BookEdition, {
      fields: [BookExternalLink.editionId],
      references: [BookEdition.id],
    }),
  }),
);

export const BookEditionRelations = relations(BookEdition, ({ one, many }) => ({
  catalogBook: one(CatalogBook, {
    fields: [BookEdition.catalogBookId],
    references: [CatalogBook.id],
  }),
  libraryEntries: many(Book),
  notes: many(PublishedBookNote),
  quotes: many(Quote),
}));

export const BookRelations = relations(Book, ({ one, many }) => ({
  user: one(User, { fields: [Book.userId], references: [User.id] }),
  quotes: many(Quote),
  catalogBook: one(CatalogBook, {
    fields: [Book.catalogBookId],
    references: [CatalogBook.id],
  }),
  edition: one(BookEdition, {
    fields: [Book.editionId],
    references: [BookEdition.id],
  }),
}));

export const QuoteRelations = relations(Quote, ({ one, many }) => ({
  user: one(User, { fields: [Quote.userId], references: [User.id] }),
  book: one(Book, { fields: [Quote.bookId], references: [Book.id] }),
  catalogBook: one(CatalogBook, {
    fields: [Quote.catalogBookId],
    references: [CatalogBook.id],
  }),
  edition: one(BookEdition, {
    fields: [Quote.bookEditionId],
    references: [BookEdition.id],
  }),
  likes: many(QuoteLike),
}));

export const QuoteLikeRelations = relations(QuoteLike, ({ one }) => ({
  quote: one(Quote, { fields: [QuoteLike.quoteId], references: [Quote.id] }),
  user: one(User, { fields: [QuoteLike.userId], references: [User.id] }),
}));

export const PublishedBookNoteRelations = relations(
  PublishedBookNote,
  ({ one, many }) => ({
    user: one(User, {
      fields: [PublishedBookNote.userId],
      references: [User.id],
    }),
    book: one(Book, {
      fields: [PublishedBookNote.bookId],
      references: [Book.id],
    }),
    catalogBook: one(CatalogBook, {
      fields: [PublishedBookNote.catalogBookId],
      references: [CatalogBook.id],
    }),
    edition: one(BookEdition, {
      fields: [PublishedBookNote.bookEditionId],
      references: [BookEdition.id],
    }),
    likes: many(PublishedBookNoteLike),
  }),
);

export const PublicBookThoughtRelations = relations(
  PublicBookThought,
  ({ one }) => ({
    user: one(User, {
      fields: [PublicBookThought.userId],
      references: [User.id],
    }),
    catalogBook: one(CatalogBook, {
      fields: [PublicBookThought.catalogBookId],
      references: [CatalogBook.id],
    }),
    sourcePersonalNote: one(PersonalBookNote, {
      fields: [PublicBookThought.sourcePersonalNoteId],
      references: [PersonalBookNote.id],
    }),
  }),
);

export const PublishedBookNoteLikeRelations = relations(
  PublishedBookNoteLike,
  ({ one }) => ({
    note: one(PublishedBookNote, {
      fields: [PublishedBookNoteLike.noteId],
      references: [PublishedBookNote.id],
    }),
    user: one(User, {
      fields: [PublishedBookNoteLike.userId],
      references: [User.id],
    }),
  }),
);

export const AccountRelations = relations(Account, ({ one }) => ({
  user: one(User, { fields: [Account.userId], references: [User.id] }),
}));

export const WishlistRelations = relations(Wishlist, ({ one }) => ({
  user: one(User, { fields: [Wishlist.userId], references: [User.id] }),
}));

export const BlogPostRelations = relations(BlogPost, ({ one }) => ({
  author: one(User, {
    fields: [BlogPost.createdById],
    references: [User.id],
  }),
  category: one(BlogCategory, {
    fields: [BlogPost.categoryId],
    references: [BlogCategory.id],
  }),
}));

export const BlogCategoryRelations = relations(BlogCategory, ({ many }) => ({
  posts: many(BlogPost),
}));

export const IranKetabDiscoverySourceRelations = relations(
  IranKetabDiscoverySource,
  ({ one, many }) => ({
    createdBy: one(User, {
      fields: [IranKetabDiscoverySource.createdById],
      references: [User.id],
    }),
    memberships: many(IranKetabDiscoveryMembership),
    runs: many(IranKetabDiscoveryRun),
  }),
);

export const IranKetabDiscoveryItemRelations = relations(
  IranKetabDiscoveryItem,
  ({ one, many }) => ({
    existingCatalogBook: one(CatalogBook, {
      fields: [IranKetabDiscoveryItem.existingCatalogBookId],
      references: [CatalogBook.id],
    }),
    importSession: one(IranKetabImportSession, {
      fields: [IranKetabDiscoveryItem.importSessionId],
      references: [IranKetabImportSession.id],
    }),
    memberships: many(IranKetabDiscoveryMembership),
    importJobs: many(IranKetabDiscoveryImportJob),
  }),
);

export const IranKetabDiscoveryImportJobRelations = relations(
  IranKetabDiscoveryImportJob,
  ({ one }) => ({
    discoveryItem: one(IranKetabDiscoveryItem, {
      fields: [IranKetabDiscoveryImportJob.discoveryItemId],
      references: [IranKetabDiscoveryItem.id],
    }),
    discoverySource: one(IranKetabDiscoverySource, {
      fields: [IranKetabDiscoveryImportJob.discoverySourceId],
      references: [IranKetabDiscoverySource.id],
    }),
  }),
);

export const IranKetabDiscoveryMembershipRelations = relations(
  IranKetabDiscoveryMembership,
  ({ one }) => ({
    discoveryItem: one(IranKetabDiscoveryItem, {
      fields: [IranKetabDiscoveryMembership.discoveryItemId],
      references: [IranKetabDiscoveryItem.id],
    }),
    discoverySource: one(IranKetabDiscoverySource, {
      fields: [IranKetabDiscoveryMembership.discoverySourceId],
      references: [IranKetabDiscoverySource.id],
    }),
  }),
);

export const IranKetabDiscoveryRunRelations = relations(
  IranKetabDiscoveryRun,
  ({ one }) => ({
    discoverySource: one(IranKetabDiscoverySource, {
      fields: [IranKetabDiscoveryRun.discoverySourceId],
      references: [IranKetabDiscoverySource.id],
    }),
  }),
);
