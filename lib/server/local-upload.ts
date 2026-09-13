import { copyFile, mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

import type { ImageUploadFolder } from "@/lib/upload";
import { buildUploadKey } from "@/lib/server/upload-key";

// درایورِ ذخیره‌سازیِ محلی: فایل را زیر public/uploads می‌نویسد و با مسیر عمومیِ
// /uploads/... سرو می‌شود. برای محیط‌هایی که فضای S3 (آروان) از شبکه‌ی سرور
// در دسترس نیست، یا به‌عنوان fallbackِ خودکار در توسعه. دیسکِ پایدار لازم است
// (روی پلتفرم‌های serverless/فقط‌خواندنی مناسب نیست).

const UPLOAD_ROOT = resolve(process.cwd(), "public", "uploads");
const METADATA_ROOT = resolve(process.cwd(), ".local-upload-metadata");

function safePath(root: string, key: string) {
  const target = resolve(root, key);
  if (target !== root && !target.startsWith(root + sep)) throw new Error("Invalid upload path.");
  return target;
}

export async function uploadImageToLocal(params: {
  buffer: Buffer;
  contentType: string;
  filename: string;
  folder: ImageUploadFolder;
  objectKey?: string;
  metadata?: Record<string, string>;
}): Promise<{ key: string; url: string }> {
  const key =
    params.objectKey && params.objectKey.trim()
      ? params.objectKey.trim().replace(/^\/+/, "")
      : buildUploadKey(params.folder, params.filename);
  const target = safePath(UPLOAD_ROOT, key);

  // محافظتِ پیمایش مسیر: مقصد باید داخل UPLOAD_ROOT باشد.
  if (target !== UPLOAD_ROOT && !target.startsWith(UPLOAD_ROOT + sep)) {
    throw new Error("Invalid upload path.");
  }

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, params.buffer);
  const metadataTarget = safePath(METADATA_ROOT, `${key}.json`);
  await mkdir(dirname(metadataTarget), { recursive: true });
  await writeFile(metadataTarget, JSON.stringify(params.metadata ?? {}), "utf8");

  return { key, url: `/uploads/${key}` };
}

export { UPLOAD_ROOT };

export async function deleteImageFromLocal(key: string): Promise<void> {
  const target = safePath(UPLOAD_ROOT, key);
  const metadataTarget = safePath(METADATA_ROOT, `${key}.json`);
  try {
    await unlink(target);
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
  try { await unlink(metadataTarget); } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
export async function headImageInLocal(key: string) {
  const target = safePath(UPLOAD_ROOT, key);
  const metadataTarget = safePath(METADATA_ROOT, `${key}.json`);
  try {
    const info = await stat(target);
    let metadata: Record<string, string> = {};
    try { metadata = JSON.parse(await readFile(metadataTarget, "utf8")) as Record<string, string>; } catch { /* Legacy local uploads have no sidecar. */ }
    return { key, sizeBytes: info.size, contentType: key.endsWith(".webp") ? "image/webp" : null, etag: null, metadata };
  } catch (error) { if ((error as { code?: string }).code === "ENOENT") return null; throw error; }
}
export async function copyImageInLocal(sourceKey: string, destinationKey: string) {
  const source = safePath(UPLOAD_ROOT, sourceKey);
  const destination = safePath(UPLOAD_ROOT, destinationKey);
  const sourceMetadata = safePath(METADATA_ROOT, `${sourceKey}.json`);
  const destinationMetadata = safePath(METADATA_ROOT, `${destinationKey}.json`);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
  try {
    await mkdir(dirname(destinationMetadata), { recursive: true });
    await copyFile(sourceMetadata, destinationMetadata);
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
