import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getFollowingFeed } from "@/lib/social/activity";

export async function GET(request: NextRequest) {
  const viewer = await getCurrentUser();
  if (!viewer) return NextResponse.json({ error: "ابتدا وارد حساب خود شوید" }, { status: 401 });
  try {
    return NextResponse.json(await getFollowingFeed(viewer.id, request.nextUrl.searchParams.get("cursor")));
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CURSOR") {
      return NextResponse.json({ error: "نشانگر صفحه نامعتبر است" }, { status: 400 });
    }
    throw error;
  }
}
