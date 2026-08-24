import { NextRequest, NextResponse } from "next/server";

import { searchPublicBooks } from "@/lib/book/search-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim() ?? "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(20, Math.max(1, Number(searchParams.get("limit")) || 10));

    if (query.length === 0) {
      return NextResponse.json({ books: [], total: 0, page, limit, totalPages: 0 });
    }

    // Search is intentionally capped rather than COUNTing a fuzzy result set;
    // typeahead/discovery only needs the ranked window and avoids an expensive
    // duplicate aggregation on every keystroke.
    const allBooks = await searchPublicBooks(query, 50);
    const total = allBooks.length;
    const books = allBooks.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      books,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error("❌ خطا در جستجوی کتاب‌ها:", err);
    return NextResponse.json(
      { error: "خطا در جستجوی کتاب‌ها" },
      { status: 500 },
    );
  }
}
