import { createHash } from "node:crypto";
import sharp from "sharp";
import { saveImageUpload } from "@/lib/server/upload-storage";

const HOSTS = new Set(["iranketab.ir", "www.iranketab.ir", "img.iranketab.ir"]);
const MAX_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

export function validateIranKetabReferenceImageUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || !HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password || url.port) throw new Error("REFERENCE_IMAGE_HOST_NOT_ALLOWED");
  return url;
}

export async function prepareIranKetabReferenceImage(input: { sourceUrl: string; fetcher?: typeof fetch; objectKey: string; metadata?: Record<string, string> }) {
  let current = validateIranKetabReferenceImageUrl(input.sourceUrl);
  const visited = new Set<string>();
  const fetcher = input.fetcher ?? fetch;
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (visited.has(current.toString())) throw new Error("REFERENCE_IMAGE_REDIRECT_LOOP");
    visited.add(current.toString());
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetcher(current, { redirect: "manual", signal: controller.signal, headers: { Accept: "image/*", "User-Agent": "Qafaseh-IranKetab-Reference/1.0" } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirects === 3) throw new Error("REFERENCE_IMAGE_REDIRECT_INVALID");
        current = validateIranKetabReferenceImageUrl(new URL(location, current).toString());
        continue;
      }
      if (!response.ok) throw new Error("REFERENCE_IMAGE_FETCH_FAILED");
      const mime = (response.headers.get("content-type") ?? "").split(";", 1)[0].toLowerCase();
      if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) throw new Error("REFERENCE_IMAGE_CONTENT_TYPE");
      if (Number(response.headers.get("content-length") ?? 0) > MAX_BYTES || !response.body) throw new Error("REFERENCE_IMAGE_TOO_LARGE");
      const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > MAX_BYTES) { await reader.cancel(); throw new Error("REFERENCE_IMAGE_TOO_LARGE"); } chunks.push(part.value); }
      const source = Buffer.concat(chunks); const image = sharp(source, { failOn: "warning", limitInputPixels: 50_000_000 }); const meta = await image.metadata();
      if (!meta.width || !meta.height || meta.width > 12000 || meta.height > 12000) throw new Error("REFERENCE_IMAGE_DIMENSIONS");
      const buffer = await image.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
      const hash = createHash("sha256").update(buffer).digest("hex");
      const upload = await saveImageUpload({ buffer, contentType: "image/webp", filename: "reference.webp", folder: "temp", objectKey: input.objectKey, metadata: { "iranketab-reference-hash": hash, "iranketab-source-url": input.sourceUrl, ...input.metadata } });
      const output = await sharp(buffer).metadata();
      return { objectKey: upload.key, url: upload.url, hash, mimeType: "image/webp" as const, width: output.width!, height: output.height!, sizeBytes: buffer.length, sourceUrl: input.sourceUrl };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("REFERENCE_IMAGE_REDIRECT_INVALID");
}
