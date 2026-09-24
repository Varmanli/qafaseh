"use client";

import { useTransition, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import type { DiscoveryCollection } from "@/lib/book/discover-config";

export default function DiscoveryChoices({ kind, items, selected, children, basePath = "/discover" }: {
  kind: "mood" | "topic";
  items: Pick<DiscoveryCollection, "slug" | "title" | "description">[];
  selected?: string;
  children: ReactNode;
  basePath?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function navigate(event: MouseEvent<HTMLAnchorElement>, slug: string, href: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || slug === selected) return;
    event.preventDefault();
    startTransition(() => router.push(href, { scroll: false }));
  }

  return (
    <div aria-busy={pending}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => {
          const href = `${basePath}?${kind}=${item.slug}`;
          const active = selected === item.slug;
          return (
            <Link
              key={item.slug}
              href={href}
              onClick={(event) => navigate(event, item.slug, href)}
              aria-current={active ? "true" : undefined}
              className={`group relative flex min-h-28 items-center gap-3 overflow-hidden rounded-2xl border p-4 text-right outline-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary sm:min-h-32 sm:gap-4 sm:p-5 ${active ? "border-primary/40 bg-primary/[0.07] shadow-sm" : "border-border/70 bg-background/65 hover:border-primary/30 hover:bg-primary/[0.025]"}`}
            >
              <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-xl border text-xs font-black tabular-nums transition-colors ${active ? "border-primary/15 bg-primary text-primary-foreground" : "border-border/60 bg-card text-primary group-hover:border-primary/20 group-hover:bg-primary/10"}`}>
                {(index + 1).toLocaleString("fa-IR")}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-black leading-6 sm:text-base ${active ? "text-primary" : "text-foreground group-hover:text-primary"}`}>{item.title}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description ?? "چند کتاب نزدیک به این موضوع رو پیدا کن."}</span>
              </span>
              <ArrowLeft aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-all group-hover:-translate-x-1 group-hover:text-primary" />
              <span aria-hidden="true" className="absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          );
        })}
      </div>
      {pending ? (
        <div role="status" className="mt-7 border-t border-border pt-5" aria-label="در حال پیدا کردن کتاب‌ها">
          <p className="mb-4 text-sm font-bold text-muted-foreground">دارم کتاب‌ها رو پیدا می‌کنم...</p>
          <div className="flex gap-4 overflow-hidden">
            {[0, 1, 2].map((index) => <div key={index} className="h-44 w-28 shrink-0 animate-pulse rounded-xl bg-muted sm:h-56 sm:w-36" />)}
          </div>
        </div>
      ) : children}
    </div>
  );
}
