import Link from "next/link";
import { LibraryBig, MoveLeft } from "lucide-react";

import BlogCategoryCover from "@/components/blog/BlogCategoryCover";
import HomeSectionHeader from "@/components/home/HomeSectionHeader";
import type { PublicBlogCategory } from "@/lib/blog/service";

export default function BlogCategoryShelf({ categories, compact = false }: {
  categories: PublicBlogCategory[];
  compact?: boolean;
}) {
  if (!categories.length) return null;
  const titleId = compact ? "home-magazine-categories" : "magazine-categories";

  return (
    <section dir="rtl" aria-labelledby={titleId}>
      {compact ? <HomeSectionHeader icon={LibraryBig} title="در قفسه بخوانید" titleId={titleId} /> : (
        <div className="mb-5 flex items-end justify-between gap-4 sm:mb-6">
        <div>
          <p className="mb-2 flex items-center gap-2 text-[11px] font-bold text-primary">
            <span className="h-px w-6 bg-primary/50" />
            یک موضوع، هزار دریچه
          </p>
          <h2 id={titleId} className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
            قفسه‌های مجله
          </h2>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            موضوع دلخواهت را انتخاب کن؛ خواندنی‌هایش اینجاست.
          </p>
        </div>
        <LibraryBig aria-hidden="true" className="mb-1 hidden size-8 text-primary/35 sm:block" strokeWidth={1.2} />
      </div>
      )}

      <div className={`-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 ${compact ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        {categories.map((category, index) => (
          <Link key={category.id} href={`/blog/category/${encodeURIComponent(category.slug)}`}
            className="group relative flex w-[82%] max-w-[340px] shrink-0 snap-center flex-col overflow-hidden rounded-[1.5rem] border border-border/60 bg-card transition-[transform,box-shadow,border-color] duration-300 hover:border-primary/35 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary motion-safe:hover:-translate-y-1 sm:w-auto sm:max-w-none">
            <div className={`relative isolate overflow-hidden ${compact ? "h-40" : "h-48 sm:h-52"}`}>
              <div className="absolute inset-0 transition-transform duration-700 motion-safe:group-hover:scale-105">
                <BlogCategoryCover src={category.coverImage} slug={category.slug}
                  sizes={compact ? "(max-width: 640px) 82vw, (max-width: 1024px) 50vw, 25vw" : "(max-width: 640px) 82vw, (max-width: 1024px) 50vw, 33vw"} />
              </div>
              <span className="absolute right-3 top-3 rounded-full border border-white/50 bg-white/85 px-2.5 py-1 text-[10px] font-bold text-[#2b3932] backdrop-blur-sm">
                {category.postCount ? `${category.postCount.toLocaleString("fa-IR")} مقاله` : "به‌زودی"}
              </span>
              <span aria-hidden="true" className="absolute bottom-3 left-4 font-serif text-3xl italic leading-none text-black/30">{(index + 1).toLocaleString("fa-IR", { minimumIntegerDigits: 2 })}</span>
            </div>
            <div className="flex flex-1 flex-col p-4 sm:p-5">
              <h3 className="min-h-7 text-sm font-black leading-7 text-foreground transition-colors group-hover:text-primary sm:text-base">{category.name}</h3>
              <p className="mb-4 mt-1 line-clamp-2 min-h-12 text-xs leading-6 text-muted-foreground">{category.description || `نوشته‌ها و روایت‌هایی خواندنی از جهان ${category.name}.`}</p>
              <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-3 text-[11px] font-bold text-primary">
                <span>کشف این قفسه</span>
                <MoveLeft aria-hidden="true" className="size-4 transition-transform motion-safe:group-hover:-translate-x-1" />
              </div>
            </div>
          </Link>
        ))}
      </div>
      <p className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground sm:hidden"><MoveLeft aria-hidden="true" className="size-3.5" /> برای دیدن قفسه‌های بیشتر، ورق بزن</p>
    </section>
  );
}
