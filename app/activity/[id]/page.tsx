import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import PublicShell from "@/components/PublicShell";
import { ActivityCard } from "@/components/feed/FeedTimeline";
import ContentDetailLayout from "@/components/social/ContentDetailLayout";
import { getCurrentUser } from "@/lib/auth/session";
import { getVisibleActivityById } from "@/lib/social/activity";
import { socialDetailHref } from "@/lib/social/detail-href";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "گفت‌وگوی کتاب‌خوان‌ها | قفسه" };

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getCurrentUser();
  const activity = await getVisibleActivityById(id, viewer?.id);
  if (!activity) notFound();
  if (activity.commentTarget.type !== "ACTIVITY") redirect(socialDetailHref(activity.commentTarget));
  return <PublicShell user={viewer}>
    <ContentDetailLayout title="فعالیت کتاب‌خوانی" fallbackHref={activity.bookHref} targetType="ACTIVITY" targetId={activity.id} canComment={!!viewer}>
      <ol><ActivityCard item={activity} canComment={!!viewer} detailPage showComments={false} /></ol>
    </ContentDetailLayout>
  </PublicShell>;
}
