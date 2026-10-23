import { z } from "zod";
import { isValidUsername, normalizeUsername } from "@/lib/profile/username-rules";
import { isAllowedPersistedImageUrl } from "@/lib/storage/image-url";

// رشته‌ی خالی → null (یعنی «پاک کن»)؛ کلید نبود → undefined (یعنی «تغییری نده»)
const emptyToNull = (v: unknown) => {
  if (typeof v !== "string") return v;
  const t = v.trim();
  return t === "" ? null : t;
};

const optionalText = (max: number) =>
  z.preprocess(emptyToNull, z.union([z.string().max(max), z.null()]).optional());

const optionalUrl = z.preprocess(
  emptyToNull,
  z.union([z.string().url("آدرس نامعتبر است").max(500).refine(
    (value) => URL.canParse(value) && ["https:", "http:"].includes(new URL(value).protocol),
    "آدرس باید HTTP یا HTTPS باشد",
  ), z.null()]).optional()
);

// هندل شبکه‌ی اجتماعی: @ ابتدایی حذف می‌شود؛ فقط حروف/عدد/._
const optionalHandle = z.preprocess(
  (v) => {
    if (typeof v !== "string") return v;
    const t = v.trim().replace(/^@/, "");
    return t === "" ? null : t;
  },
  z.union([
    z
      .string()
      .max(100)
      .regex(/^[a-zA-Z0-9._]+$/, "نام کاربری شبکه‌ی اجتماعی نامعتبر است"),
    z.null(),
  ]).optional()
);

// نام‌کاربری: کوچک، URL-safe، غیررزرو و غیرمشابه شناسه‌های کتاب
export const usernameSchema = z.preprocess(
  (v) => (typeof v === "string" ? normalizeUsername(v) : v),
  z
    .string()
    .min(3, "نام کاربری باید حداقل ۳ کاراکتر باشد")
    .max(30, "نام کاربری نباید بیشتر از ۳۰ کاراکتر باشد")
    .refine(
      (value) => isValidUsername(value),
      "نام کاربری باید با حرف شروع شود، فقط از حروف کوچک انگلیسی، عدد و - تشکیل شود و با مسیرها یا شناسه‌های کتاب تداخل نداشته باشد"
    )
);

export const updateProfileSchema = z.object({
  name: optionalText(255),
  username: usernameSchema.optional(),
  bio: optionalText(500),
  location: optionalText(100),
  website: optionalUrl,
  linkedin: optionalUrl,
  instagram: optionalHandle,
  twitter: optionalHandle,
  telegram: optionalHandle,
  // آواتار: string برای تنظیم، null برای حذف، undefined برای بدون‌تغییر
  image: z.union([z.string().max(1000), z.null()]).optional().refine(
    isAllowedPersistedImageUrl,
    "مسیر محلی /uploads/ برای تصویر مجاز نیست.",
  ),
  // بنر/کاور پروفایل: همان قرارداد آواتار (string/null/undefined)
  bannerImage: z.union([z.string().max(1000), z.null()]).optional().refine(
    isAllowedPersistedImageUrl,
    "مسیر محلی /uploads/ برای تصویر مجاز نیست.",
  ),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updateProfileVisibilitySchema = z.object({
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
});
