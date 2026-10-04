import Link from "next/link";
import { MessageCircle } from "lucide-react";

import type { SocialCommentTarget } from "@/lib/social/comment-contract";
import { cn } from "@/lib/utils";
import { socialDetailHref } from "@/lib/social/detail-href";

export default function CommentCountLink({ targetType, targetId, count, className = "" }: {
  targetType: SocialCommentTarget;
  targetId: string;
  count: number;
  className?: string;
}) {
  const href = socialDetailHref({ type: targetType, id: targetId });

  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={`دیدگاه‌ها، ${count.toLocaleString("fa-IR")}`}
      title="دیدگاه‌ها"
      className={cn("inline-flex h-10 min-w-[68px] items-center justify-center gap-2 rounded-full border border-border/60 bg-background/30 px-3 text-xs font-black tabular-nums text-muted-foreground transition-colors hover:border-primary/20 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35", className)}
    >
      <MessageCircle className="h-[17px] w-[17px]" aria-hidden="true" />
      <span>{count.toLocaleString("fa-IR")}</span>
    </Link>
  );
}
