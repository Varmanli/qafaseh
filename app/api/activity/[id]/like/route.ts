import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { toggleActivityLike } from "@/lib/social/activity";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "برای پسندیدن باید وارد شوید" }, { status: 401 });
  const { id } = await params;
  const result = await toggleActivityLike(id, user.id);
  if (!result) return NextResponse.json({ error: "فعالیت پیدا نشد" }, { status: 404 });
  return NextResponse.json(result);
}
