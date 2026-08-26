"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, List, X, ChevronRight } from "lucide-react";

import type { ArticleHeading } from "@/lib/blog/article-content";
import { cn } from "@/lib/utils";

const READING_MODE_KEY = "ghafaseh-magazine-reading-mode";

function useActiveHeading(headings: ArticleHeading[]) {
  const [activeId, setActiveId] = useState(headings[0]?.id ?? "");

  useEffect(() => {
    if (!headings.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];

        if (visible?.target.id) {
          setActiveId(visible.target.id);
        }
      },
      {
        rootMargin: "-120px 0px -65% 0px",
        threshold: 0,
      },
    );

    const elements = headings
      .map(({ id }) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [headings]);

  return activeId;
}

function ReadingButton({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        `
        inline-flex
        h-11
        items-center
        gap-2
        rounded-full
        border
        px-5
        text-sm
        font-black
        transition-all
        backdrop-blur-xl
        `,
        active
          ? `
            border-primary/30
            bg-primary/10
            text-primary
          `
          : `
            border-border/70
            bg-background/80
            text-foreground
            hover:border-primary/30
            hover:text-primary
          `,
      )}
    >
      {children}
    </button>
  );
}

export default function ArticleReadingExperience({
  headings,
  children,
  shareAction,
}: {
  headings: ArticleHeading[];
  children: React.ReactNode;
  shareAction?: React.ReactNode;
}) {
  const [readingMode, setReadingMode] = useState(false);

  const [tocOpen, setTocOpen] = useState(false);
  const [heroTarget, setHeroTarget] = useState<HTMLElement | null>(null);

  // A reading navigation should surface sections, not every subheading in the
  // article. Both desktop and mobile TOCs share this list and observer.
  const tocHeadings = useMemo(
    () => headings.filter((heading) => heading.level === 2),
    [headings],
  );
  const activeId = useActiveHeading(tocHeadings);

  useEffect(() => {
    setHeroTarget(
      document.querySelector<HTMLElement>("[data-magazine-hero-image]"),
    );
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(READING_MODE_KEY);

    setReadingMode(saved === "true");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle(
      "article-reading-mode",
      readingMode,
    );

    window.localStorage.setItem(READING_MODE_KEY, String(readingMode));

    return () => {
      document.documentElement.classList.remove("article-reading-mode");
    };
  }, [readingMode]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (tocOpen) {
        setTocOpen(false);
        return;
      }

      if (readingMode) {
        setReadingMode(false);
      }
    };

    window.addEventListener("keydown", handler);

    return () => window.removeEventListener("keydown", handler);
  }, [tocOpen, readingMode]);

  const scrollToHeading = (id: string) => {
    setTocOpen(false);

    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const tocItems = useMemo(
    () =>
      tocHeadings.map((heading) => (
        <li key={heading.id}>
          <button
            type="button"
            onClick={() => scrollToHeading(heading.id)}
            className={cn(
              `
                group
                flex
                w-full
                items-center
                gap-2
                rounded-xl
                px-3
                py-1.5
                text-right
                text-sm
                leading-6
                transition
                `,
              activeId === heading.id
                ? `
                    bg-primary/10
                    font-black
                    text-primary
                    `
                : `
                    text-muted-foreground
                    hover:bg-muted
                    hover:text-foreground
                    `,
            )}
          >
            {activeId === heading.id && (
              <ChevronRight
                className="
                    size-4
                    shrink-0
                  "
              />
            )}

            <span>{heading.text}</span>
          </button>
        </li>
      )),
    [tocHeadings, activeId],
  );

  const entryControls = (
    <div className="article-reading-controls z-40 flex justify-center gap-2">
      {tocHeadings.length > 0 && (
        <ReadingButton onClick={() => setTocOpen(true)}>
          <List className="size-4" />
          فهرست
        </ReadingButton>
      )}
      <ReadingButton
        active={readingMode}
        onClick={() => setReadingMode((value) => !value)}
      >
        {readingMode ? (
          <X className="size-4" />
        ) : (
          <BookOpen className="size-4" />
        )}
        {readingMode ? "خروج از مطالعه" : "حالت مطالعه"}
      </ReadingButton>
      {shareAction}
    </div>
  );

  const readingToolbar = (
    <div className="article-reading-toolbar" dir="rtl">
      <div className="mx-auto flex h-12 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={() => setReadingMode(false)}
          aria-label="خروج از حالت مطالعه"
          className="inline-flex h-8 items-center gap-1.5 border-b border-border/80 px-1 text-xs font-black text-foreground transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <X className="size-3.5" aria-hidden="true" />
          خروج از مطالعه
        </button>

        {tocHeadings.length > 0 ? (
          <button
            type="button"
            onClick={() => setTocOpen(true)}
            aria-label="باز کردن فهرست مطلب"
            className="inline-flex h-8 items-center gap-1.5 px-1 text-xs font-bold text-muted-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <List className="size-3.5" aria-hidden="true" />
            فهرست
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      className={cn("article-reading-experience", readingMode && "is-reading")}
    >
      {children}
      {readingMode
        ? createPortal(readingToolbar, document.body)
        : heroTarget
          ? createPortal(entryControls, heroTarget)
          : null}

      {/* Mobile TOC */}

      {tocHeadings.length > 0 && (
        <div
          className={cn(
            `
            fixed
            inset-0
            z-[100]
            transition
            `,
            tocOpen
              ? "visible opacity-100"
              : "pointer-events-none invisible opacity-0",
          )}
        >
          <button
            type="button"
            aria-label="بستن"
            onClick={() => setTocOpen(false)}
            className="
              absolute
              inset-0
              bg-black/50
              backdrop-blur-sm
            "
          />

          <section
            className="
              absolute
              bottom-0
              w-full
              rounded-t-[2rem]
              bg-background
              p-6
              shadow-2xl
            "
          >
            <div
              className="
                mb-5
                flex
                items-center
                justify-between
                border-b
                border-border
                pb-4
              "
            >
              <h2
                className="
                  font-black
                "
              >
                فهرست مطلب
              </h2>

              <button
                type="button"
                aria-label="بستن فهرست مطلب"
                onClick={() => setTocOpen(false)}
                className="
                  rounded-xl
                  p-2
                  hover:bg-muted
                "
              >
                <X
                  className="
                    size-5
                  "
                />
              </button>
            </div>

            <ol
              className="
                max-h-[60vh]
                space-y-1
                overflow-y-auto
              "
            >
              {tocItems}
            </ol>
          </section>
        </div>
      )}
    </div>
  );
}

export function ArticleDesktopToc({
  headings,
}: {
  headings: ArticleHeading[];
}) {
  const tocHeadings = useMemo(
    () => headings.filter((heading) => heading.level === 2),
    [headings],
  );
  const activeId = useActiveHeading(tocHeadings);

  if (!tocHeadings.length) return null;

  return (
    <aside
      className="
        article-desktop-toc
        hidden
        lg:block
        rounded-3xl
        border
        border-border/70
        bg-card/70
        p-4
        backdrop-blur-xl
      "
    >
      <span
        className="
          text-xs
          font-black
          text-primary
        "
      >
        فهرست مطالعه
      </span>

      <ol
        className="
          mt-3
          space-y-0.5
        "
      >
        {tocHeadings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              className={cn(
                `
                  block
                  rounded-xl
                  px-2.5
                  py-1.5
                  text-sm
                  leading-5
                  transition
                  `,
                activeId === heading.id
                  ? `
                      bg-primary/10
                      font-black
                      text-primary
                      `
                  : `
                      text-muted-foreground
                      hover:bg-muted
                      hover:text-foreground
                      `,
              )}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </aside>
  );
}
