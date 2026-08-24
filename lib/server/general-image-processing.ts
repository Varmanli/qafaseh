import sharp from "sharp";

const MAX_INPUT_PIXELS = 50_000_000;
const MAX_INPUT_DIMENSION = 12_000;

export class ImageValidationError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID_IMAGE" | "UNSUPPORTED_IMAGE" | "IMAGE_TOO_LARGE" = "INVALID_IMAGE",
  ) {
    super(message);
    this.name = "ImageValidationError";
  }
}

export interface ProcessedGeneralImage {
  buffer: Buffer;
  contentType: string;
  filename: string;
  extension: string;
}

/**
 * Inspects image buffer magic bytes via sharp, verifies valid dimensions,
 * strips unsafe EXIF metadata, and outputs normalized images.
 */
export async function validateAndProcessImageBuffer(input: {
  buffer: Buffer;
  filename: string;
  declaredMime?: string | null;
  maxBytes?: number;
  isFavicon?: boolean;
}): Promise<ProcessedGeneralImage> {
  const { buffer, filename, maxBytes = 2 * 1024 * 1024, isFavicon = false } = input;

  if (!buffer || buffer.length === 0) {
    throw new ImageValidationError("فایل ارسال‌شده خالی است.");
  }
  if (buffer.length > maxBytes) {
    throw new ImageValidationError("حجم فایل بیش از حد مجاز است.", "IMAGE_TOO_LARGE");
  }

  // Handle ICO files for favicons (ICO magic bytes: 00 00 01 00)
  if (
    isFavicon &&
    buffer.length >= 4 &&
    buffer[0] === 0 &&
    buffer[1] === 0 &&
    buffer[2] === 1 &&
    buffer[3] === 0
  ) {
    const base = filename.replace(/\.[^.]+$/, "") || "favicon";
    return {
      buffer,
      contentType: "image/x-icon",
      filename: `${base}.ico`,
      extension: ".ico",
    };
  }

  try {
    const source = sharp(buffer, {
      failOn: "warning",
      limitInputPixels: MAX_INPUT_PIXELS,
      pages: 1,
    });
    const metadata = await source.metadata();
    const format = metadata.format;
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    if (!format || !["jpeg", "png", "webp"].includes(format)) {
      throw new ImageValidationError(
        "فرمت تصویر پشتیبانی نمی‌شود. لطفاً JPG، PNG یا WebP انتخاب کنید.",
        "UNSUPPORTED_IMAGE",
      );
    }

    if (!width || !height || width > MAX_INPUT_DIMENSION || height > MAX_INPUT_DIMENSION) {
      throw new ImageValidationError("ابعاد تصویر بیش از حد مجاز است.", "IMAGE_TOO_LARGE");
    }

    let processedBuffer: Buffer;
    let contentType: string;
    let ext: string;

    if (format === "png") {
      contentType = "image/png";
      ext = ".png";
      processedBuffer = await source.png({ quality: 90 }).toBuffer();
    } else if (format === "webp") {
      contentType = "image/webp";
      ext = ".webp";
      processedBuffer = await source.webp({ quality: 85 }).toBuffer();
    } else {
      contentType = "image/jpeg";
      ext = ".jpg";
      processedBuffer = await source.jpeg({ quality: 85 }).toBuffer();
    }

    const base = filename.replace(/\.[^.]+$/, "") || "image";
    return {
      buffer: processedBuffer,
      contentType,
      filename: `${base}${ext}`,
      extension: ext,
    };
  } catch (error) {
    if (error instanceof ImageValidationError) throw error;
    throw new ImageValidationError("فایل ارسال‌شده یک تصویر معتبر نیست.", "INVALID_IMAGE");
  }
}
