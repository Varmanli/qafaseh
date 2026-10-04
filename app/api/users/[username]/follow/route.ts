import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { followUser, unfollowUser } from "@/lib/social/follow";

type Context = { params: Promise<{ username: string }> };

async function changeFollow(context: Context, method: "POST" | "DELETE") {
  const viewer = await getCurrentUser();
  if (!viewer) return NextResponse.json({ error: "ابتدا وارد حساب خود شوید" }, { status: 401 });
  const { username } = await context.params;
  const result = method === "POST" ? await followUser(viewer.id, username) : await unfollowUser(viewer.id, username);
  if (result === "NOT_FOUND") return NextResponse.json({ error: "کاربر پیدا نشد" }, { status: 404 });
  if (result === "SELF") return NextResponse.json({ error: "نمی‌توانید خودتان را دنبال کنید" }, { status: 422 });
  return NextResponse.json({ following: method === "POST" });
}

export async function POST(_request: Request, context: Context) {
  return changeFollow(context, "POST");
}

export async function DELETE(_request: Request, context: Context) {
  return changeFollow(context, "DELETE");
}
