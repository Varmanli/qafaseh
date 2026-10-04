import type { Metadata } from "next";

import FeedTimeline from "@/components/feed/FeedTimeline";
import { getCurrentUser } from "@/lib/auth/session";
import { getFollowingFeed } from "@/lib/social/activity";
import { getFollowState } from "@/lib/social/follow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "خانه | قفسه" };

export default async function FeedPage() {
  const viewer = await getCurrentUser();
  if (!viewer) return null; // The dashboard layout redirects unauthenticated visitors.

  const [page, follow] = await Promise.all([
    getFollowingFeed(viewer.id, null),
    getFollowState(viewer.id),
  ]);

  return (
    <main className="mx-auto min-h-[70dvh] w-full max-w-2xl px-4 pb-20 pt-6 sm:px-8 sm:pt-9">
      <FeedTimeline initialPage={page} followingCount={follow.followingCount} />
    </main>
  );
}
