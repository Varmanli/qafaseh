"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { ArchiveFilterButton } from "@/components/archive/ArchiveToolbar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const DESKTOP_FILTER_QUERY = "(min-width: 1024px)";

function useDesktopFilterSurface() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_FILTER_QUERY);
    const update = () => setIsDesktop(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

export function ArchiveFilter({
  title,
  description,
  label,
  activeCount = 0,
  onReset,
  resetLabel = "پاک کردن",
  children,
  mobileBeforeContent,
  mobileFooter,
  desktopWidthClassName = "w-[360px] xl:w-[380px]",
}: {
  title: string;
  description?: string;
  label: string;
  activeCount?: number;
  onReset?: () => void;
  resetLabel?: string;
  children: ReactNode;
  mobileBeforeContent?: ReactNode;
  mobileFooter?: (close: () => void) => ReactNode;
  desktopWidthClassName?: string;
}) {
  const isDesktop = useDesktopFilterSurface();
  const [open, setOpen] = useState(false);
  const desktopSurfaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [isDesktop]);

  useEffect(() => {
    if (!isDesktop || !open) return;

    const closeWhenOutside = (event: PointerEvent) => {
      if (!desktopSurfaceRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeWhenOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isDesktop, open]);

  const trigger = (onClick?: () => void) => (
    <ArchiveFilterButton
      activeCount={activeCount}
      label={label}
      aria-expanded={open}
      onClick={onClick}
    />
  );

  if (!isDesktop) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger()}</SheetTrigger>
        <SheetContent
          side="bottom"
          dir="rtl"
          className="z-[80] flex h-[92dvh] max-h-[92dvh] flex-col overflow-hidden rounded-t-[1.75rem] border-x border-t border-border bg-background p-0 text-right shadow-[0_-25px_80px_-35px_rgba(0,0,0,0.55)] sm:left-1/2 sm:max-w-[640px] sm:-translate-x-1/2"
        >
          <div className="flex shrink-0 justify-center pt-2.5" aria-hidden="true">
            <span className="h-1 w-10 rounded-full bg-border" />
          </div>
          <SheetHeader className="shrink-0 border-b border-border/70 px-4 pb-4 pt-2 text-right">
            <div className="flex items-center justify-between gap-3 pl-10">
              <div className="min-w-0">
                <SheetTitle className="text-[15px] font-black">{title}</SheetTitle>
                {description ? <SheetDescription className="mt-1 text-[11px] font-medium">{description}</SheetDescription> : null}
              </div>
              {onReset ? <button type="button" onClick={onReset} className="shrink-0 rounded-lg px-2 py-1.5 text-[11px] font-bold text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive">{resetLabel}</button> : null}
            </div>
          </SheetHeader>
          {mobileBeforeContent}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-3 [scrollbar-width:thin]">
            {children}
          </div>
          {mobileFooter?.(() => setOpen(false))}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div ref={desktopSurfaceRef} className="relative shrink-0">
      {trigger(() => setOpen((value) => !value))}
      {open ? (
        <div
          role="dialog"
          aria-label={title}
          className={`absolute left-0 top-[calc(100%+10px)] z-50 max-h-[calc(100vh-120px)] overflow-y-auto rounded-[1.4rem] border border-border bg-card p-4 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.45)] ${desktopWidthClassName}`}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-foreground">{title}</h2>
              {description ? <p className="mt-1 text-[11px] font-semibold text-muted-foreground">{description}</p> : null}
            </div>
            {onReset ? <button type="button" onClick={onReset} className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold text-muted-foreground hover:text-foreground">{resetLabel}</button> : null}
          </div>
          {children}
        </div>
      ) : null}
    </div>
  );
}
