"use client";

import { Heart } from "lucide-react";

import CommentCountLink from "@/components/social/CommentCountLink";
import { cn } from "@/lib/utils";
import type { SocialCommentTarget } from "@/lib/social/comment-contract";
import { useSocialLike } from "@/components/social/useSocialLike";

export default function ActivityActions({ likeCount: initialCount, likedByViewer, commentCount, commentTarget, canLike, className }: {
  likeCount: number; likedByViewer: boolean; commentCount: number; canLike: boolean;
  commentTarget: { type: SocialCommentTarget; id: string };
  className?: string;
}) {
  const { liked, likeCount: count, pending, toggleLike } = useSocialLike(commentTarget.type, commentTarget.id, { liked: likedByViewer, likeCount: initialCount }, canLike);
  const targetLabel = commentTarget.type === "QUOTE" ? "تکه" : commentTarget.type === "NOTE" ? "یادداشت" : "فعالیت";

  const buttonClass = "h-9 min-w-[60px] gap-2 rounded-full px-3 text-xs";
  return (
    <div className={cn("mt-3 flex items-center gap-2", className)}>
      <button type="button" onClick={toggleLike} disabled={pending} aria-pressed={liked} aria-label={`پسندیدن ${targetLabel}، ${count.toLocaleString("fa-IR")}`} className={cn("inline-flex items-center justify-center border border-border/60 bg-background/30 font-bold tabular-nums text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:opacity-50", buttonClass, liked && "border-rose-300/20 bg-rose-500/10 text-rose-300")}>
        <Heart className={cn("size-[17px]", liked && "fill-current")} aria-hidden="true" />
        <span>{count.toLocaleString("fa-IR")}</span>
      </button>
      <CommentCountLink targetType={commentTarget.type} targetId={commentTarget.id} count={commentCount} className={buttonClass} />
    </div>
  );
}
