import type { SocialCommentTarget } from "./comment-contract";

export function socialDetailHref(target: { type: SocialCommentTarget; id: string }) {
  const route = target.type === "QUOTE" ? "quote" : target.type === "NOTE" ? "note" : "activity";
  return `/${route}/${encodeURIComponent(target.id)}`;
}
