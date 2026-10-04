"use client";

import Link from "next/link";
import { MessageSquareText } from "lucide-react";

import NoteCard from "@/components/profile/NoteCard";
import type { PublicNote } from "@/lib/notes/service";

export default function NotesSection({
  notes,
  isOwner,
  canLike = false,
  username,
}: {
  notes: PublicNote[];
  isOwner: boolean;
  canLike?: boolean;
  username: string;
}) {
  const hasNotes = notes.length > 0;

  return (
    <section className="relative" dir="rtl">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-3 px-1 sm:mb-7">
        <h2 className="text-base font-black tracking-tight text-foreground sm:text-2xl">
          یادداشت‌ها
        </h2>
        <Link
          href={`/${encodeURIComponent(username)}/notes`}
          className="shrink-0 text-xs font-bold text-primary transition-colors hover:text-primary/80 sm:text-base"
        >
          نمایش یادداشت‌ها
        </Link>
      </div>

      {/* Content */}
      {!hasNotes ? (
        <EmptyNotesState isOwner={isOwner} />
      ) : (
        <div className="flex flex-col gap-4">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              canLike={canLike}
              showAuthor={false}
              showBook
            />
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyNotesState({ isOwner }: { isOwner: boolean }) {
  return (
    <div
      className="
        relative overflow-hidden
        rounded-[1.5rem]
        border border-dashed border-border/65
        bg-card/35
        px-5 py-10
        text-center
      "
    >
      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute left-1/2 top-0
          h-32 w-48
          -translate-x-1/2 -translate-y-1/2
          rounded-full
          bg-primary/[0.08]
          blur-3xl
        "
      />

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute inset-x-16 top-0 h-px
          bg-gradient-to-r
          from-transparent via-primary/25 to-transparent
        "
      />

      <div className="relative">
        <span
          className="
            mx-auto grid h-12 w-12
            place-items-center
            rounded-2xl
            bg-primary/[0.08]
            text-primary
            ring-1 ring-primary/15
          "
        >
          <MessageSquareText className="h-5 w-5" />
        </span>

        <p className="mt-4 text-sm font-black text-foreground">
          {isOwner ? "هنوز یادداشتی منتشر نکرده‌ای" : "یادداشتی منتشر نشده"}
        </p>

        <p
          className="
            mx-auto mt-1.5
            max-w-sm
            text-[11px] leading-6
            text-muted-foreground
          "
        >
          {isOwner
            ? "برداشت، نظر یا نوشته‌ای درباره کتابی که خوانده‌ای منتشر کن؛ یادداشت‌ها اینجا جمع می‌شوند."
            : "این کاربر هنوز یادداشتی درباره کتاب‌ها منتشر نکرده است."}
        </p>
      </div>
    </div>
  );
}
