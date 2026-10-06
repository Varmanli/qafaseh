"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";

import type { BookEditionSummary } from "@/lib/book/detail-service";
import { cn } from "@/lib/utils";

type DropdownPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

export default function BookEditionSelector({
  editions,
  selectedEditionId,
}: {
  editions: BookEditionSummary[];
  selectedEditionId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<DropdownPosition | null>(null);

  const selectedEdition = useMemo(
    () =>
      editions.find((edition) => edition.id === selectedEditionId) ??
      editions.find((edition) => edition.isPrimary) ??
      editions[0] ??
      null,
    [editions, selectedEditionId],
  );

  const searchableEditions = useMemo(
    () =>
      editions.map((edition) => {
        const title = getEditionTitle(edition);

        return {
          edition,
          title,
          searchText: normalizeSearch(
            [
              title,
              edition.editionLabel,
              edition.titleOverride,
              edition.publisher,
              edition.translator,
              edition.publishedYear ? String(edition.publishedYear) : null,
              edition.publishedYear
                ? edition.publishedYear.toLocaleString("fa-IR")
                : null,
            ]
              .filter(Boolean)
              .join(" "),
          ),
        };
      }),
    [editions],
  );

  const filteredEditions = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);

    if (!normalizedQuery) return searchableEditions;

    return searchableEditions.filter((item) =>
      item.searchText.includes(normalizedQuery),
    );
  }, [query, searchableEditions]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    updatePosition();

    const handleResize = () => updatePosition();
    const handleScroll = () => updatePosition();

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 40);

    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;

      if (!target) return;

      const trigger = triggerRef.current;
      const dropdown = document.getElementById(
        "book-edition-selector-dropdown",
      );

      if (trigger?.contains(target)) return;
      if (dropdown?.contains(target)) return;

      setOpen(false);
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!selectedEdition || editions.length < 2) return null;

  function updatePosition() {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const padding = 16;
    const offset = 8;

    const spaceBelow = viewportHeight - rect.bottom - padding;
    const spaceAbove = rect.top - padding;
    const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;

    const maxHeight = Math.max(
      220,
      Math.min(340, openUp ? spaceAbove - offset : spaceBelow - offset),
    );

    const width = Math.min(rect.width, viewportWidth - padding * 2);

    const left = Math.min(
      Math.max(rect.left, padding),
      viewportWidth - width - padding,
    );

    const top = openUp
      ? Math.max(padding, rect.top - maxHeight - offset)
      : Math.min(rect.bottom + offset, viewportHeight - maxHeight - padding);

    setPosition({
      top,
      left,
      width,
      maxHeight,
    });
  }

  function toggleOpen() {
    setOpen((value) => {
      const next = !value;

      if (next) {
        setQuery("");
        window.requestAnimationFrame(updatePosition);
      }

      return next;
    });
  }

  function chooseEdition(editionId: string) {
    setOpen(false);
    setQuery("");
    if (editionId === selectedEdition?.id) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("edition", editionId);

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (
      event.key === "ArrowDown" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      setOpen(true);
      window.requestAnimationFrame(updatePosition);
    }
  }

  return (
    <div className="w-full">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-busy={isPending}
        disabled={isPending}
        className={cn(
          "group flex h-11 w-full items-center justify-between gap-3 rounded-2xl border px-3 text-right text-xs font-bold shadow-none transition-all",
          "border-border/80 bg-background/55 text-foreground hover:border-primary/25 hover:bg-background/80",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
          "disabled:cursor-wait disabled:opacity-70",
          open && "border-primary/30 bg-background/80",
        )}
      >
        <span className="min-w-0 truncate" aria-live="polite">
          {isPending ? "در حال تغییر نسخه..." : getEditionTitle(selectedEdition)}
        </span>

        {isPending ? (
          <Loader2 className="h-4 w-4 shrink-0 motion-safe:animate-spin" />
        ) : (
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180 text-primary",
            )}
          />
        )}
      </button>

      {mounted && open && position
        ? createPortal(
            <div
              id="book-edition-selector-dropdown"
              dir="rtl"
              className="fixed z-[100] overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-2xl backdrop-blur-xl"
              style={{
                top: position.top,
                left: position.left,
                width: position.width,
              }}
            >
              <div className="border-b border-border/70 p-2">
                <div className="flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-background/65 px-3">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />

                  <input
                    ref={searchInputRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="جست‌وجوی نسخه، ناشر، مترجم..."
                    className="h-full min-w-0 flex-1 bg-transparent text-right text-xs font-medium text-foreground outline-none placeholder:text-muted-foreground"
                  />

                  {query ? (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                      aria-label="پاک کردن جست‌وجو"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>

              <div
                role="listbox"
                className="overflow-y-auto p-1.5"
                style={{
                  maxHeight: position.maxHeight,
                }}
              >
                {filteredEditions.length > 0 ? (
                  filteredEditions.map(({ edition, title }) => {
                    const active = edition.id === selectedEdition.id;

                    return (
                      <button
                        key={edition.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => chooseEdition(edition.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-right transition-colors",
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-background/70",
                        )}
                      >
                        <OptionContent edition={edition} title={title} />

                        <span className="flex shrink-0 items-center gap-2">
                          {edition.isPrimary ? (
                            <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-black text-primary">
                              نسخه اصلی
                            </span>
                          ) : null}

                          {active ? (
                            <Check className="h-4 w-4 shrink-0 text-primary" />
                          ) : null}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="flex min-h-28 items-center justify-center rounded-xl px-4 py-8 text-center">
                    <p className="text-xs font-bold text-muted-foreground">
                      نسخه‌ای پیدا نشد.
                    </p>
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function OptionContent({
  edition,
  title,
}: {
  edition: BookEditionSummary;
  title: string;
}) {
  const meta = [
    edition.publisher ? `ناشر: ${edition.publisher}` : null,
    edition.translator ? `مترجم: ${edition.translator}` : null,
    edition.publishedYear
      ? `سال چاپ: ${edition.publishedYear.toLocaleString("fa-IR", {
          useGrouping: false,
        })}`
      : null,
  ].filter(Boolean);

  return (
    <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
      <span className="max-w-full truncate text-xs font-black">{title}</span>

      {meta.length > 0 ? (
        <span className="max-w-full truncate text-[11px] font-medium text-muted-foreground">
          {meta.join(" • ")}
        </span>
      ) : (
        <span className="text-[11px] font-medium text-muted-foreground">
          بدون اطلاعات تکمیلی
        </span>
      )}
    </span>
  );
}

function getEditionTitle(edition: BookEditionSummary) {
  if (edition.editionLabel) {
    return edition.editionLabel;
  }

  if (edition.titleOverride) {
    return edition.titleOverride;
  }

  if (edition.publisher) {
    return `نسخه نشر ${edition.publisher}`;
  }

  if (edition.translator) {
    return `نسخه ترجمه ${edition.translator}`;
  }

  if (edition.publishedYear) {
    return `نسخه چاپ ${edition.publishedYear.toLocaleString("fa-IR", {
      useGrouping: false,
    })}`;
  }

  return "نسخه کتاب";
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/\s+/g, " ")
    .trim();
}
