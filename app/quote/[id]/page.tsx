import type { Metadata } from "next";
import { notFound } from "next/navigation";

import PublicShell from "@/components/PublicShell";
import QuoteCard from "@/components/profile/QuoteCard";
import ContentDetailLayout from "@/components/social/ContentDetailLayout";
import { getCurrentUser } from "@/lib/auth/session";
import { getVisibleQuoteById } from "@/lib/quotes/service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "تکهٔ کتاب | قفسه" };

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getCurrentUser();
  const quote = await getVisibleQuoteById(id, viewer?.id);
  if (!quote) notFound();
  const bookHref = `/book/${encodeURIComponent(quote.bookSlug || quote.bookId)}`;

  return (
    <PublicShell user={viewer}>
      <ContentDetailLayout title="تکهٔ کتاب" fallbackHref={bookHref} targetType="QUOTE" targetId={quote.id} canComment={!!viewer} contentIsCard>
        <QuoteCard quote={quote} canLike={!!viewer} showAuthor showBook background={quote.background} detailPage className="min-h-[440px] w-full lg:min-h-[480px]" />
      </ContentDetailLayout>
    </PublicShell>
  );
}
