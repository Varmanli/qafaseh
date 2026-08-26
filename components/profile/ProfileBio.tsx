"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export default function ProfileBio({ bio }: { bio: string }) {
  const [expanded, setExpanded] = useState(false);

  const shouldCollapse = bio.length > 150;

  return (
    <div className="mt-2.5 max-w-xl text-right">
      <p
        className={cn(
          "whitespace-pre-line text-xs leading-6 text-muted-foreground sm:text-sm sm:leading-7",
          !expanded && "line-clamp-3",
        )}
      >
        {bio}
      </p>

      {shouldCollapse ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary transition-opacity hover:opacity-80 sm:text-xs"
        >
          {expanded ? "کمتر" : "بیشتر بخوانید"}

          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
      ) : null}
    </div>
  );
}
