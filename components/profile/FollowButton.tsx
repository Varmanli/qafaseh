"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";

export default function FollowButton({ username, initialFollowing, allowFollow = true }: { username: string; initialFollowing: boolean; allowFollow?: boolean }) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function toggle() {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(username)}/follow`, { method: following ? "DELETE" : "POST" });
      if (response.status === 401) {
        router.push(`/auth/login?redirect=${encodeURIComponent(`/${username}`)}`);
        return;
      }
      if (!response.ok) throw new Error("FOLLOW_FAILED");
      setFollowing(!following);
      router.refresh();
    } catch {
      toast.error("تغییر وضعیت دنبال کردن انجام نشد");
    } finally {
      setPending(false);
    }
  }

  if (!following && !allowFollow) return null;
  return <Button type="button" size="sm" variant={following ? "outline" : "default"} disabled={pending} onClick={toggle} className="h-8.5 rounded-lg px-3.5 text-xs">
    {following ? "دنبال می‌کنید" : "دنبال کردن"}
  </Button>;
}
