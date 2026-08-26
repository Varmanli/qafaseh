export type SharePayload = ShareData & {
  title: string;
  text: string;
  url: string;
};

export type ShareDestination = "telegram" | "whatsapp" | "x" | "linkedin";

export function supportsNativeShare() {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export function shareDestinationUrl(destination: ShareDestination, { title, text, url }: SharePayload) {
  if (destination === "telegram") return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  if (destination === "whatsapp") return `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
  if (destination === "x") return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text || title)}&url=${encodeURIComponent(url)}`;
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
}

export async function shareWithDevice(payload: SharePayload) {
  return navigator.share(payload);
}

export async function copyToClipboard(value: string) {
  return navigator.clipboard.writeText(value);
}
