"use client";

import { useEffect, useState } from "react";
import { BookOpen, Check, Loader2, Plus, Quote, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { Carousel } from "@/components/ui/Carousel";
import { QuoteBackground as QuoteBackgroundPreview } from "@/components/quotes/QuoteBackground";
import type { PublicQuote } from "@/lib/quotes/service";
import type { QuoteBackground as QuoteBackgroundVariant } from "@/lib/quotes/backgrounds";
import { cn } from "@/lib/utils";
import { getQuoteTextareaDirectionProps } from "@/lib/text-direction";

export default function QuoteDialog({
  open,
  editing,
  content,
  page,
  busy,
  imageKey,
  imagePreview,
  uploading,
  background,
  backgroundsList,
  onOpenChange,
  onContentChange,
  onPageChange,
  onImagePreviewChange,
  onImageKeyChange,
  onUploadStateChange,
  onBackgroundChange,
  onSubmit,
}: {
  open: boolean;
  editing: PublicQuote | null;
  content: string;
  page: string;
  busy: boolean;
  imageKey: string | null;
  imagePreview: string | null;
  uploading: boolean;
  background: QuoteBackgroundVariant;
  backgroundsList: Array<{ value: string; label: string }>;
  onOpenChange: (open: boolean) => void;
  onContentChange: (value: string) => void;
  onPageChange: (value: string) => void;
  onImagePreviewChange: (value: string) => void;
  onImageKeyChange: (key: string) => void;
  onUploadStateChange: (uploading: boolean) => void;
  onBackgroundChange: (background: QuoteBackgroundVariant) => void;
  onSubmit: () => void;
}) {
  const [tab, setTab] = useState<"text" | "image">("text");

  useEffect(() => {
    if (open) {
      // Direct edit mode tab selection: if it has an image and no text content, start on image tab
      setTab(imageKey && !content ? "image" : "text");
    }
  }, [open, editing, imageKey, content]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 overflow-hidden max-h-[92dvh] sm:max-h-[85dvh] flex flex-col sm:max-w-lg md:max-w-xl rounded-2xl border-border/85 bg-card shadow-2xl">
        {/* Header */}
        <div className="flex flex-col gap-1 px-5 py-4 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <DialogTitle className="text-base font-bold text-foreground">
              {editing ? "ویرایش تکه کتاب" : "افزودن تکه کتاب"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pr-10">
            جمله یا بخشی از کتاب را بنویسید یا تصویر آن را بارگذاری کنید.
          </DialogDescription>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-4 shrink-0">
          <div className="flex rounded-xl bg-muted/50 p-1 border border-border/30">
            <button
              type="button"
              onClick={() => setTab("text")}
              className={cn(
                "flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer",
                tab === "text"
                  ? "bg-card text-foreground shadow-sm ring-1 ring-black/[0.05]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              متن تکه
            </button>
            <button
              type="button"
              onClick={() => setTab("image")}
              className={cn(
                "flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer",
                tab === "image"
                  ? "bg-card text-foreground shadow-sm ring-1 ring-black/[0.05]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              تصویر صفحه
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {tab === "text" ? (
            <>
              {/* Text editor with Live Preview background */}
              <div
                className={cn(
                  "relative overflow-hidden rounded-[1.45rem] border min-h-[205px] sm:min-h-[230px] transition-all flex flex-col justify-center items-center",
                  background === "default"
                    ? "border-border/60 bg-background/30"
                    : "border-border/50 bg-card/20",
                )}
              >
                {/* Selected background preview */}
                <QuoteBackgroundPreview variant={background} />

                {/* Decorative quote marks */}
                <Quote
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute right-4 top-4 z-[1] h-7 w-7 sm:right-5 sm:top-5 sm:h-8 sm:w-8 opacity-25",
                    background === "default" ? "text-primary/25" : "text-white/35",
                  )}
                />

                <Quote
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute bottom-4 left-4 z-[1] h-7 w-7 rotate-180 sm:bottom-5 sm:left-5 sm:h-8 sm:w-8 opacity-15",
                    background === "default" ? "text-primary/10" : "text-white/15",
                  )}
                />

                {/* Centered editor area matching QuoteCard composition */}
                <div className="relative z-10 w-full flex-1 flex flex-col justify-center items-center px-5 py-6 sm:px-7 sm:py-7">
                  <div className="mx-auto w-full max-w-[34rem] flex items-center justify-center">
                    <Textarea
                      {...getQuoteTextareaDirectionProps(content)}
                      value={content}
                      onChange={(event) => onContentChange(event.target.value)}
                      placeholder="یک تکه از کتاب را نقل کن..."
                      rows={1}
                      className={cn(
                        "w-full bg-transparent text-center resize-none border-0 shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0 p-0 overflow-hidden field-sizing-content",
                        "text-[13px] font-medium leading-7",
                        "sm:text-[15px] sm:leading-[2.2]",
                        "md:text-[1rem] md:leading-[2.3]",
                        background === "default"
                          ? "text-foreground/95 placeholder:text-muted-foreground/75"
                          : "text-white placeholder:text-white/60 [text-shadow:0_1px_18px_rgba(0,0,0,0.55)]",
                      )}
                    />
                  </div>

                  {/* Page Badge matching actual QuoteCard bottom-left positioning */}
                  {page && (
                    <div
                      className={cn(
                        "absolute bottom-4 left-5 sm:bottom-5 sm:left-7 z-10 flex shrink-0 items-center gap-1.5 text-[10px] font-medium tabular-nums",
                        background === "default" ? "text-muted-foreground" : "text-white/75",
                      )}
                    >
                      <BookOpen className="h-3.5 w-3.5 opacity-70" />
                      صفحه {Number(page).toLocaleString("fa-IR")}
                    </div>
                  )}
                </div>
              </div>

              {/* Redesigned Background Selector */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs font-semibold px-0.5">
                  <span className="text-foreground/90">طرح پس‌زمینه</span>
                  <span className="text-muted-foreground/75">
                    {backgroundsList.find((item) => item.value === background)?.label ?? "پیش‌فرض"}
                  </span>
                </div>

                <Carousel
                  ariaLabel="طرح‌های پس‌زمینه"
                  slideClassName="w-24 shrink-0"
                  containerClassName="gap-2.5"
                  className="-mx-1 px-1"
                  slides={backgroundsList.map((item) => {
                    const selected = background === item.value;
                    const isDefault = item.value === "default";

                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => onBackgroundChange(item.value)}
                        disabled={busy || uploading}
                        aria-pressed={selected}
                        className={cn(
                          "group relative w-full h-15 overflow-hidden rounded-xl border text-right transition-all duration-200 cursor-pointer",
                          selected
                            ? "border-primary ring-2 ring-primary/20 ring-offset-1"
                            : "border-border/50 hover:border-foreground/20",
                        )}
                      >
                        {/* Visual Thumbnail */}
                        <div className="absolute inset-0 w-full h-full scale-[1.01]">
                          <QuoteBackgroundPreview variant={item.value} />
                        </div>

                        {/* Subtle text label badge */}
                        <span
                          className={cn(
                            "absolute bottom-1 right-1 z-10 rounded-md px-1.5 py-0.5 text-[9px] font-black backdrop-blur-[2px] transition-colors",
                            isDefault
                              ? "bg-background/80 text-foreground"
                              : "bg-black/40 text-white",
                          )}
                        >
                          {item.label}
                        </span>

                        {/* Check indicator for selected */}
                        {selected && (
                          <span className="absolute left-1 top-1 z-10 grid h-4.5 w-4.5 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
                            <Check className="h-2.5 w-2.5 stroke-[3px]" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                />
              </div>
            </>
          ) : (
            /* Image Tab Content */
            <div className="space-y-3">
              <div className="rounded-2xl border border-border/50 bg-background/30 p-2 sm:p-3">
                <ImageUploader
                  value={imagePreview}
                  onChange={onImagePreviewChange}
                  onKeyChange={onImageKeyChange}
                  onUploadStateChange={onUploadStateChange}
                  folder="quotes"
                  variant="document"
                  label="افزودن تصویر از صفحه کتاب"
                  description="فرمت‌های JPEG، PNG و WebP تا حجم ۸ مگابایت پذیرفته می‌شوند."
                  disabled={busy}
                />
              </div>
            </div>
          )}

          {/* Page Number Row */}
          <div className="flex items-center gap-3 pt-1">
            <label className="flex h-10 w-full items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/30 px-3 sm:w-56">
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                شماره صفحه
              </span>
              <input
                value={page}
                onChange={(event) =>
                  onPageChange(event.target.value.replace(/[^0-9]/g, ""))
                }
                inputMode="numeric"
                placeholder="اختیاری"
                className="h-8 w-24 bg-transparent text-left text-xs font-bold tabular-nums text-foreground outline-none placeholder:text-muted-foreground/60"
              />
            </label>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 border-t border-border/40 p-4 shrink-0 bg-card">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy || uploading}
            className="h-9 rounded-xl px-4 text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
          >
            بستن
          </Button>

          <Button
            type="button"
            onClick={onSubmit}
            disabled={busy || uploading || (!content.trim() && !imageKey)}
            className="h-9 rounded-xl px-5 text-xs font-bold gap-1.5 cursor-pointer"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {editing ? "ذخیره تغییرات" : "انتشار تکه"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
