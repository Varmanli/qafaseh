import { validateIranKetabCollectionUrl } from "./collection-fetch";

export type IranKetabPublisherSource = {
  name: string;
  sourceKey: string;
  sourceUrl: string;
};

export function parseIranKetabPublisherSource(value: string): IranKetabPublisherSource {
  const url = validateIranKetabCollectionUrl(value, "PUBLISHER");
  const pathname = decodeURIComponent(url.pathname).replace(/\/+$/u, "");
  const match = /^\/publisher\/(\d+)(?:-([^/]+))?$/u.exec(pathname);
  if (!match) throw new Error("لینک باید مربوط به صفحهٔ یک انتشارات ایران‌کتاب باشد.");

  const [, id, slug] = match;
  const label = slug?.replace(/[-_]+/gu, " ").trim();
  url.pathname = `/publisher/${id}${label ? `-${encodeURIComponent(label.replace(/\s+/gu, "-"))}` : ""}`;
  url.search = "";

  return {
    name: `انتشارات ${label || id}`,
    sourceKey: `publisher:${id}`,
    sourceUrl: url.toString(),
  };
}
