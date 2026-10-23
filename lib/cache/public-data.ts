import { unstable_cache, revalidateTag } from "next/cache";
import { cache } from "react";

export const PUBLIC_CONTENT_TAG = "public-content-v1";
const pending = new Map<string, Promise<unknown>>();
const MAX_PENDING = 64;

/** Only JSON public DTOs belong here. Keep sessions, private notes and viewer state outside. */
export function cachePublicData<Args extends unknown[], Result>(
  query: (...args: Args) => Promise<Result>,
  key: string,
  revalidate = 300,
) {
  const cached = unstable_cache(async (...args: Args) => ({ value: await query(...args) }), [key, "v1"], {
    tags: [PUBLIC_CONTENT_TAG],
    revalidate,
  });
  return cache((...args: Args): Promise<Result> => {
    if (process.env.NODE_ENV !== "production" || process.env.PUBLIC_DATA_CACHE_DISABLED === "1") return query(...args);
    // Collapse simultaneous cold reads; retain only a bounded number of pending promises.
    const invocation = JSON.stringify([key, args]);
    const existing = pending.get(invocation);
    if (existing) return existing as Promise<Result>;
    const promise = cached(...args).then((result) => result.value).finally(() => {
      if (pending.get(invocation) === promise) pending.delete(invocation);
    });
    if (pending.size < MAX_PENDING) pending.set(invocation, promise);
    return promise;
  });
}

export function invalidatePublicContent() {
  pending.clear();
  revalidateTag(PUBLIC_CONTENT_TAG, { expire: 0 });
}

/** Invalidate only after a successful, committed admin content mutation. */
export function withPublicContentInvalidation<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args) => {
    const response = await handler(...args);
    if (response.ok) invalidatePublicContent();
    return response;
  };
}
