import { asc, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { Book } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import LoansPage from "@/components/loans/LoansPage";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) return null;
  const books = await db.select({ id: Book.id, title: Book.title, author: Book.author, coverImage: Book.coverImage })
    .from(Book).where(and(eq(Book.userId, user.id), eq(Book.format, "PHYSICAL")))
    .orderBy(asc(Book.title));
  return <LoansPage books={books} />;
}
