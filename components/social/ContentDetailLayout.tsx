"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, MessageCircle } from "lucide-react";

import BookCoverImage from "@/components/books/BookCoverImage";
import { AuthorChip } from "@/components/profile/QuoteCard";
import CommentsSection from "@/components/social/CommentsSection";
import type { SocialCommentTarget } from "@/lib/social/comment-contract";

export default function ContentDetailLayout({ title, fallbackHref, targetType, targetId, canComment, children, contentIsCard = false }: {
  title: string;
  fallbackHref: string;
  targetType: SocialCommentTarget;
  targetId: string;
  canComment: boolean;
  children: ReactNode;
  contentIsCard?: boolean;
}) {
  const router = useRouter();

  return (
    <div dir="rtl" className="mx-auto min-h-[70dvh] w-full max-w-3xl px-3 pb-12 pt-2 sm:px-6 sm:pb-8 sm:pt-3 lg:max-w-6xl">
      <header className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border/40 pb-2">
        <button type="button" onClick={() => window.history.length > 1 ? router.back() : router.replace(fallbackHref)} className="inline-flex min-h-9 w-fit items-center gap-1.5 rounded-full border border-border/60 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/8 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <ArrowRight className="size-4" aria-hidden="true" />برگشت
        </button>
        <h1 className="text-center text-base font-bold leading-7 text-foreground sm:text-lg">{title}</h1>
        <div aria-hidden="true" />
      </header>

      <div className="grid min-w-0 items-start gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-6">
        <div className={contentIsCard ? "min-w-0 [&>article]:rounded-b-none [&>article]:border-b-0 [&>article]:shadow-none sm:[&>article]:shadow-none lg:sticky lg:top-24 lg:[&>article]:rounded-b-[1.75rem] lg:[&>article]:border-b lg:[&>article]:shadow-[0_24px_80px_-48px_rgba(0,0,0,0.45)]" : "min-w-0 rounded-t-3xl border border-b-0 border-border/60 bg-card/60 p-5 sm:p-6 lg:sticky lg:top-24 lg:rounded-3xl lg:border-b lg:shadow-[0_24px_80px_-48px_rgba(0,0,0,0.45)]"}>{children}</div>
        <aside aria-labelledby="detail-comments-heading" tabIndex={0} className="min-w-0 rounded-b-3xl border border-border/60 bg-card/60 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:p-5 lg:rounded-3xl lg:shadow-[0_24px_80px_-48px_rgba(0,0,0,0.45)] lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto lg:overscroll-contain [scrollbar-width:thin]">
          <h2 id="detail-comments-heading" className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground"><MessageCircle className="size-4 text-primary" aria-hidden="true" />دیدگاه‌ها</h2>
          <CommentsSection targetType={targetType} targetId={targetId} canComment={canComment} defaultOpen showToggle={false} standalone />
        </aside>
      </div>
    </div>
  );
}

export function ContentDetailBookHeader({ href, title, author, cover, username, name, image }: {
  href: string;
  title: string;
  author: string | null;
  cover: string | null;
  username: string | null;
  name: string | null;
  image: string | null;
}) {
  return (
    <header className="flex flex-col gap-3">
      {username ? <div className="min-w-0">
        <AuthorChip username={username} name={name} image={image} />
      </div> : null}
      <Link href={href} className="group flex min-w-0 items-center gap-4 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
        <BookCoverImage src={cover || "/placeholder-cover.svg"} alt={`جلد ${title}`} width={56} height={84} sizes="56px" className="h-[84px] w-14 shrink-0 rounded-lg object-cover shadow-md ring-1 ring-border/60" />
        <div className="min-w-0">
          <h2 className="break-words text-lg font-bold leading-8 text-foreground transition-colors group-hover:text-primary sm:text-xl">{title}</h2>
          {author ? <p className="mt-1 text-xs leading-6 text-muted-foreground sm:text-sm">{author}</p> : null}
        </div>
      </Link>
    </header>
  );
}
