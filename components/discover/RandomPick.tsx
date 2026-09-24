"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Dice5 } from "lucide-react";

export default function RandomPick({ children, hasPick, basePath = "/discover" }: { children: ReactNode; hasPick: boolean; basePath?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="min-w-0">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => router.push(`${basePath}?pick=random&roll=${Date.now()}`, { scroll: false }))}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-black text-primary-deep outline-none transition-colors hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-deep disabled:cursor-wait disabled:opacity-70"
      >
        <Dice5 aria-hidden="true" className="size-5" />
        {pending ? "دارم انتخاب می‌کنم..." : hasPick ? "یکی دیگه" : "یه کتاب برام انتخاب کن"}
      </button>
      {pending ? (
        <div role="status" className="mt-5 flex items-center gap-4" aria-label="در حال پیدا کردن کتاب">
          <div className="h-28 w-[4.7rem] shrink-0 animate-pulse rounded-lg bg-white/20" />
          <div className="w-40 space-y-3"><div className="h-4 animate-pulse rounded bg-white/20" /><div className="h-3 w-24 animate-pulse rounded bg-white/15" /></div>
        </div>
      ) : children}
    </div>
  );
}
