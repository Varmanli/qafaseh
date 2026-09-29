"use client";

import { useState } from "react";
import Image from "next/image";

import { normalizeMediaUrl } from "@/lib/book/cover";

const PLACEHOLDER_COVER = "/placeholder-cover.svg";

type BookCoverImageProps = {
  src: string | null | undefined;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  priority?: boolean;
  sizes?: string;
};

export default function BookCoverImage({
  src,
  alt,
  className,
  width,
  height,
  fill = false,
  priority = false,
  sizes,
}: BookCoverImageProps) {
  const resolvedSrc = normalizeMediaUrl(src) ?? PLACEHOLDER_COVER;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [optimizerFailedSrc, setOptimizerFailedSrc] = useState<string | null>(null);
  const displayedSrc = failedSrc === resolvedSrc ? PLACEHOLDER_COVER : resolvedSrc;

  return (
    <Image
      src={displayedSrc}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      fill={fill}
      sizes={sizes}
      priority={priority}
      className={className}
      unoptimized={optimizerFailedSrc === displayedSrc}
      onError={() => {
        if (displayedSrc !== PLACEHOLDER_COVER && optimizerFailedSrc !== displayedSrc) {
          setOptimizerFailedSrc(displayedSrc);
        } else {
          setFailedSrc(resolvedSrc);
        }
      }}
    />
  );
}
