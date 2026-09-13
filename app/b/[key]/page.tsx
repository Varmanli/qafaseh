import { notFound, permanentRedirect } from "next/navigation";

import { getBookDetail } from "@/lib/book/detail-service";
import { decodeShortBookKey } from "@/lib/book/short-link";

export const dynamic = "force-dynamic";

export default async function ShortBookLinkPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const bookId = decodeShortBookKey(key);
  if (!bookId) notFound();

  const result = await getBookDetail(bookId);
  if (!result.found) notFound();

  permanentRedirect(`/book/${encodeURIComponent(result.book.slug)}`);
}
