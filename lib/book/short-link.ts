/** Short, URL-safe key for stable book share links. */
export function encodeShortBookKey(bookId: string): string {
  if (UUID_RE.test(bookId)) {
    return Buffer.from(bookId.replaceAll("-", ""), "hex").toString("base64url");
  }
  return Buffer.from(bookId, "utf8").toString("base64url");
}

export function decodeShortBookKey(key: string): string | null {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(key)) return null;
    const buffer = Buffer.from(key, "base64url");
    if (buffer.length === 16) {
      const hex = buffer.toString("hex");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    const value = buffer.toString("utf8");
    return value ? value : null;
  } catch {
    return null;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
