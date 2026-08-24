import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";
import {
  type ImageUploadFolder,
  IMAGE_UPLOAD_FOLDERS,
  getImageUploadPolicy,
  UPLOAD_FAILED_MESSAGE,
  validateFaviconFile,
  validateImageFile,
} from "@/lib/upload";
import { StorageError } from "@/lib/server/s3";
import { deleteImageUpload, saveImageUpload } from "@/lib/server/upload-storage";
import { buildUploadKey } from "@/lib/server/upload-key";
import { db } from "@/db";
import { Quote, User } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isOwnedQuoteImageKey } from "@/lib/quotes/image";
import {
  processQuoteImage,
  QuoteImageProcessingError,
} from "@/lib/server/quote-image-processing";
import {
  validateAndProcessImageBuffer,
  ImageValidationError,
} from "@/lib/server/general-image-processing";

export const runtime = "nodejs";

// پیامِ شفاف برای زمانی که سرور نمی‌تواند به فضای ذخیره‌سازی متصل شود.
const STORAGE_UNREACHABLE_MESSAGE =
  "اتصال سرور به فضای ذخیره‌سازی برقرار نشد. لطفاً چند لحظه بعد دوباره تلاش کنید.";

// سقف بزرگ‌تر برای دارایی‌های برندینگ (لوگو/فاوآیکون/تصویر اشتراک‌گذاری).
const SETTINGS_MAX_BYTES = 1024 * 1024; // ۱ مگابایت

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });
    }

    const data = await req.formData();
    const file = data.get("file") as File | null;
    const rawFolder = data.get("folder");
    const kind = data.get("kind"); // "favicon" برای دارایی فاوآیکون
    const requestedOwnerId = data.get("targetOwnerId");

    if (!file) {
      return NextResponse.json({ error: "فایلی ارسال نشده" }, { status: 400 });
    }

    if (
      typeof rawFolder !== "string" ||
      !IMAGE_UPLOAD_FOLDERS.includes(
        rawFolder as (typeof IMAGE_UPLOAD_FOLDERS)[number]
      )
    ) {
      return NextResponse.json({ error: "پوشه‌ی آپلود معتبر نیست." }, { status: 400 });
    }
    const folder = rawFolder as ImageUploadFolder;
    let uploadOwnerId = user.id;
    if ((folder === "quotes" || folder === "avatars") && typeof requestedOwnerId === "string" && requestedOwnerId !== user.id) {
      if (!isAdmin(user)) {
        return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
      }
      const [target] = await db.select({ id: User.id }).from(User).where(eq(User.id, requestedOwnerId)).limit(1);
      if (!target) {
        return NextResponse.json({ error: "کاربر مقصد پیدا نشد" }, { status: 404 });
      }
      uploadOwnerId = target.id;
    }

    // دارایی‌های تنظیمات و پس‌زمینه‌ها فقط برای ادمین.
    const isSettings = folder === "settings";
    const isAdminOnlyFolder = isSettings || folder === "quote-backgrounds";
    if (isAdminOnlyFolder && !isAdmin(user)) {
      return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    }

    const maxBytes = isSettings
      ? SETTINGS_MAX_BYTES
      : getImageUploadPolicy(folder).maxInputBytes;
    const isFavicon = isSettings && kind === "favicon";

    const validationError = isFavicon
      ? validateFaviconFile({ type: file.type, size: file.size }, maxBytes)
      : validateImageFile({ type: file.type, size: file.size }, maxBytes);
    if (validationError) {
      // 413 برای حجم زیاد، 400 برای نوع نامعتبر
      const status = file.size > maxBytes ? 413 : 400;
      return NextResponse.json({ error: validationError }, { status });
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const processed =
      folder === "quotes"
        ? await processQuoteImage({
            buffer: inputBuffer,
            declaredMime: file.type,
            filename: file.name || "quote-page",
          })
        : await validateAndProcessImageBuffer({
            buffer: inputBuffer,
            filename: file.name || "image",
            declaredMime: file.type,
            maxBytes,
            isFavicon,
          });
    const uploadResult = await saveImageUpload({
      buffer: processed.buffer,
      contentType: processed.contentType,
      filename: processed.filename,
      folder,
      objectKey:
        folder === "quotes"
          ? buildUploadKey(`quotes/${uploadOwnerId}`, processed.filename)
          : undefined,
    });

    // فقط key/url را برمی‌گردانیم (سازگار با ImageUploader)؛ درایور صرفاً داخلی است.
    return NextResponse.json({
      key: uploadResult.key,
      url: uploadResult.url,
    });
  } catch (err) {
    console.error(err);

    if (err instanceof QuoteImageProcessingError || err instanceof ImageValidationError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.code === "IMAGE_TOO_LARGE" ? 413 : 422 },
      );
    }

    // خطاهای اتصال به فضای ذخیره‌سازی → پیام شفاف و کد وضعیتِ مناسب.
    if (err instanceof StorageError) {
      if (err.code === "STORAGE_TIMEOUT" || err.code === "STORAGE_UNREACHABLE") {
        return NextResponse.json(
          { error: STORAGE_UNREACHABLE_MESSAGE, code: err.code },
          { status: 503 },
        );
      }
      if (err.code === "STORAGE_CONFIG") {
        return NextResponse.json(
          {
            error:
              "پیکربندی S3 ناقص است. S3_ENDPOINT، S3_BUCKET، S3_ACCESS_KEY_ID، S3_SECRET_ACCESS_KEY و S3_PUBLIC_BASE_URL را بررسی کنید.",
            code: err.code,
          },
          { status: 503 },
        );
      }
      if (err.code === "STORAGE_FORBIDDEN") {
        return NextResponse.json(
          { error: "دسترسی به فضای ذخیره‌سازی مجاز نیست.", code: err.code },
          { status: 502 },
        );
      }
    }

    return NextResponse.json({ error: UPLOAD_FAILED_MESSAGE }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { key?: unknown; targetOwnerId?: unknown } | null;
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  let ownerId = user.id;
  if (typeof body?.targetOwnerId === "string" && body.targetOwnerId !== user.id) {
    if (!isAdmin(user)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    const [target] = await db.select({ id: User.id }).from(User).where(eq(User.id, body.targetOwnerId)).limit(1);
    if (!target) return NextResponse.json({ error: "کاربر مقصد پیدا نشد" }, { status: 404 });
    ownerId = target.id;
  }
  if (!key || !isOwnedQuoteImageKey(key, ownerId)) {
    return NextResponse.json({ error: "تصویر معتبر نیست" }, { status: 403 });
  }

  const [referenced] = await db
    .select({ id: Quote.id })
    .from(Quote)
    .where(eq(Quote.imageKey, key))
    .limit(1);
  if (referenced) {
    return NextResponse.json(
      { error: "تصویرِ ذخیره‌شده باید از طریق ویرایش یا حذف تکه مدیریت شود" },
      { status: 409 },
    );
  }

  try {
    await deleteImageUpload(key);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[upload] quote image cleanup failed", { key, error });
    return NextResponse.json({ error: "حذف تصویر ناموفق بود" }, { status: 500 });
  }
}
