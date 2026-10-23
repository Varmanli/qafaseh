import Link from "next/link";
import { ArrowUpLeft, BookOpenText } from "lucide-react";

import PublicShell from "@/components/PublicShell";

interface StaticSection {
  title: string;
  body: string;
}

export default function StaticContentPage({
  eyebrow,
  title,
  description,
  sections,
  ctaLabel,
  ctaHref,
}: {
  eyebrow: string;
  title: string;
  description: string;
  sections: StaticSection[];
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <PublicShell>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <section className="overflow-hidden rounded-[2rem] border border-border/80 bg-card/90 p-6 shadow-[0_24px_70px_-52px_rgba(0,0,0,0.45)] sm:p-8">
          <span className="inline-flex rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-primary">
            {eyebrow}
          </span>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            {title}
          </h1>
          <p className="persian-paragraph mt-4 max-w-2xl text-sm leading-8 text-muted-foreground sm:text-base">
            {description}
          </p>

          {ctaLabel && ctaHref ? (
            <Link
              href={ctaHref}
              className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background/70 px-5 text-sm font-bold text-foreground transition-colors hover:border-primary/20 hover:bg-primary/5 hover:text-primary"
            >
              {ctaLabel}
              <ArrowUpLeft className="h-4 w-4" />
            </Link>
          ) : null}
        </section>

        <div className="mt-8 grid gap-4">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-[1.6rem] border border-border/75 bg-card/85 p-5 shadow-[0_18px_60px_-50px_rgba(0,0,0,0.35)]"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/15">
                  <BookOpenText className="h-4 w-4" />
                </span>
                <h2 className="text-lg font-black text-foreground">
                  {section.title}
                </h2>
              </div>
              <p className="persian-paragraph mt-4 text-sm leading-8 text-muted-foreground">
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </main>
    </PublicShell>
  );
}
