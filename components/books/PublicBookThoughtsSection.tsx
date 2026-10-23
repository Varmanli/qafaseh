import Link from "next/link";
import { BookOpen, Globe2, Sparkles } from "lucide-react";

import MetaAvatar from "@/components/books/MetaAvatar";
import { detectTextDirection } from "@/lib/text-direction";
import type { listPublicBookThoughts } from "@/lib/public-thoughts/service";

type PublicThought = Awaited<ReturnType<typeof listPublicBookThoughts>>[number];

export default function PublicBookThoughtsSection({ thoughts }: { thoughts: PublicThought[] }) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-border/80 bg-card/70 p-5 shadow-[0_22px_70px_-48px_rgba(0,0,0,0.5)] sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.1),transparent_35%)]" />
      <div className="relative flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-black text-foreground">لحظه‌های ماندگار</h2>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">تجربه‌هایی که خوانندگان با انتخاب خودشان با دیگران به اشتراک گذاشته‌اند.</p>
        </div>
      </div>

      {thoughts.length === 0 ? (
        <div className="relative mt-6 rounded-2xl border border-dashed border-border/80 bg-background/30 px-4 py-10 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-primary" />
          <h3 className="mt-3 text-sm font-black text-foreground">هنوز لحظه‌ای از این کتاب منتشر نشده</h3>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">اولین کسی باش که تجربه‌ای از این کتاب را ثبت می‌کند.</p>
        </div>
      ) : (
        <div className="relative mt-6 grid gap-3 md:grid-cols-2">
          {thoughts.map((thought) => {
            const name = thought.authorName || thought.authorUsername || "کاربر قفسه";
            return (
              <article key={thought.id} className="rounded-2xl border border-border/70 bg-background/40 p-4 transition-colors hover:bg-background/60">
                <div className="flex items-center gap-2.5">
                  <MetaAvatar image={thought.authorImage} name={name} />
                  <div className="min-w-0">
                    {thought.authorUsername ? <Link href={`/${encodeURIComponent(thought.authorUsername)}`} className="block truncate text-xs font-black text-foreground hover:text-primary">{name}</Link> : <span className="block truncate text-xs font-black text-foreground">{name}</span>}
                    <time className="mt-0.5 block text-[10px] text-muted-foreground">{formatDate(thought.createdAt)}</time>
                  </div>
                </div>
                {thought.pageNumber ? <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-primary"><BookOpen className="h-3.5 w-3.5" />صفحه‌ی {thought.pageNumber.toLocaleString("fa-IR")}</p> : <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground"><Globe2 className="h-3.5 w-3.5" />لحظه‌ی خواندن</p>}
                <p dir={detectTextDirection(thought.content)} className="persian-paragraph mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground">{thought.content}</p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "long", year: "numeric" }).format(date);
}
