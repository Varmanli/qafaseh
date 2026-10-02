import { notFound, permanentRedirect } from "next/navigation";

import { getBookMetadata } from "@/lib/book/detail-service";
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

  const book = await getBookMetadata(bookId);
  if (!book) notFound();

  permanentRedirect(`/book/${encodeURIComponent(book.slug)}`);
}
