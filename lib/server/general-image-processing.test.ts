import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import {
  validateAndProcessImageBuffer,
  ImageValidationError,
} from "./general-image-processing";
import { buildUploadKey, sanitizeFilename, getFilenameExtension } from "./upload-key";

test("general image processing normalizes JPEG/PNG/WebP and strips metadata", async () => {
  const source = await sharp({
    create: {
      width: 500,
      height: 500,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 },
    },
  })
    .png()
    .withMetadata({ orientation: 6 })
    .toBuffer();

  const result = await validateAndProcessImageBuffer({
    buffer: source,
    filename: "my-photo.png",
  });

  const metadata = await sharp(result.buffer).metadata();
  assert.equal(result.contentType, "image/png");
  assert.equal(result.filename, "my-photo.png");
  assert.equal(metadata.format, "png");
  assert.equal(metadata.orientation, undefined);
});

test("general image processing rejects non-image or corrupt buffers", async () => {
  await assert.rejects(
    () =>
      validateAndProcessImageBuffer({
        buffer: Buffer.from("<html><script>alert(1)</script></html>"),
        filename: "evil.html",
      }),
    ImageValidationError
  );
});

test("upload key builder enforces safe extensions and directory traversal resistance", () => {
  assert.equal(getFilenameExtension("malicious.html"), ".jpg");
  assert.equal(getFilenameExtension("script.php"), ".jpg");
  assert.equal(getFilenameExtension("valid.png"), ".png");
  assert.equal(getFilenameExtension("photo.webp"), ".webp");

  const sanitized = sanitizeFilename("../../../etc/passwd.php");
  assert.match(sanitized, /passwd\.jpg$/);

  const key = buildUploadKey("covers", "../../../avatar.png");
  assert.ok(key.startsWith("covers/"));
  assert.ok(!key.includes(".."));
  assert.ok(key.endsWith("-avatar.png"));
});
