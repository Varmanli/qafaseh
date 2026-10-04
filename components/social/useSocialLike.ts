"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import type { SocialCommentTarget } from "@/lib/social/comment-contract";

type LikeState = { liked: boolean; likeCount: number };
type LikeChange = LikeState & { type: SocialCommentTarget; id: string };
const LIKE_CHANGED = "ghafaseh:like-changed";

export function useSocialLike(type: SocialCommentTarget, id: string, initial: LikeState, canLike: boolean) {
  const [state, setState] = useState(initial);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    function sync(event: Event) {
      const change = (event as CustomEvent<LikeChange>).detail;
      if (change.type === type && change.id === id) setState({ liked: change.liked, likeCount: change.likeCount });
    }
    window.addEventListener(LIKE_CHANGED, sync);
    return () => window.removeEventListener(LIKE_CHANGED, sync);
  }, [type, id]);

  async function toggleLike() {
    if (!canLike) { toast("برای پسندیدن وارد شوید"); return; }
    if (pending) return;
    setPending(true);
    try {
      const route = type === "QUOTE" ? "quotes" : type === "NOTE" ? "notes" : "activity";
      const response = await fetch(`/api/${route}/${encodeURIComponent(id)}/like`, { method: "POST" });
      if (!response.ok) throw new Error();
      const result = await response.json() as LikeState;
      setState(result);
      window.dispatchEvent(new CustomEvent<LikeChange>(LIKE_CHANGED, { detail: { ...result, type, id } }));
    } catch { toast.error("پسند ثبت نشد"); }
    finally { setPending(false); }
  }

  return { ...state, pending, toggleLike };
}
