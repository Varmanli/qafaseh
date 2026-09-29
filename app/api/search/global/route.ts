import { NextRequest, NextResponse } from "next/server";

import { searchGlobal } from "@/lib/search/global-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim() ?? "";
    const limit = Math.min(5, Math.max(1, Number(searchParams.get("limit")) || 4));

    if (!query) {
      return NextResponse.json({
        books: [],
        authors: [],
        publishers: [],
        magazine: [],
        users: [],
        hasMore: { books: false, authors: false, publishers: false, magazine: false, users: false },
      });
    }

    const result = await searchGlobal(query, { limitPerGroup: limit });
    return NextResponse.json(result);
  } catch (error) {
    console.error("❌ global search error:", error);
    return NextResponse.json(
      { error: "خطا در جست‌وجوی سراسری" },
      { status: 500 },
    );
  }
}
