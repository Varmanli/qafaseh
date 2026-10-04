import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { commentQuerySchema } from "@/lib/social/comment-contract";
import { getVisibleActivityById } from "@/lib/social/activity";
import { socialDetailHref } from "@/lib/social/detail-href";

export const dynamic = "force-dynamic";

// Compatibility for saved links; comments live on the original detail page.
export default async function LegacyCommentsRedirect({ searchParams }: {
  searchParams: Promise<{ targetType?: string; targetId?: string }>;
}) {
  const parsed = commentQuerySchema.safeParse(await searchParams);
  if (!parsed.success) notFound();
  const { targetType, targetId } = parsed.data;
  if (targetType === "ACTIVITY") {
    const viewer = await getCurrentUser();
    const activity = await getVisibleActivityById(targetId, viewer?.id);
    if (!activity) notFound();
    redirect(socialDetailHref(activity.commentTarget));
  }
  redirect(socialDetailHref({ type: targetType, id: targetId }));
}
