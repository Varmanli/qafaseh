"use client";

import { useState } from "react";
import Image from "next/image";
import { UserRound } from "lucide-react";

import { normalizeCoverImage } from "@/lib/book/cover";

export default function AuthorAvatar({
  name,
  image,
  sizeClassName = "h-20 w-20",
  textClassName = "text-2xl",
  iconClassName = "h-8 w-8",
  className = "",
}: {
  name: string;
  image: string | null;
  sizeClassName?: string;
  textClassName?: string;
  iconClassName?: string;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [optimizerFailedSrc, setOptimizerFailedSrc] = useState<string | null>(null);
  const initial = name.trim().charAt(0) || "ن";
  // Keep the direct URL as a fallback when a remote optimizer request fails.
  const imageSrc = normalizeCoverImage(image);
  const showImage = !!imageSrc && failedSrc !== imageSrc;

  return (
    <div
      className={`relative overflow-hidden rounded-full bg-primary/10 ring-1 ring-primary/15 ${sizeClassName} ${className}`}
    >
      {showImage ? (
        <Image
          src={imageSrc}
          alt={name}
          fill
          sizes="128px"
          className="object-cover"
          unoptimized={optimizerFailedSrc === imageSrc}
          onError={() => {
            if (optimizerFailedSrc === imageSrc) setFailedSrc(imageSrc);
            else setOptimizerFailedSrc(imageSrc);
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-primary">
          {initial ? (
            <span className={`font-black ${textClassName}`}>{initial}</span>
          ) : (
            <UserRound className={iconClassName} />
          )}
        </div>
      )}
    </div>
  );
}
