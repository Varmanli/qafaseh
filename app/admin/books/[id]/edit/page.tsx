import { notFound } from "next/navigation";

import AdminBookForm from "@/components/admin/AdminBookForm";
import AdminBookEditionsManager from "@/components/admin/AdminBookEditionsManager";
import { requireAdmin } from "@/lib/admin/permissions";
import { getAdminCatalogBookForEdit } from "@/lib/admin/service";

export const dynamic = "force-dynamic";

export default async function AdminEditBookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const book = await getAdminCatalogBookForEdit(id);
  if (!book) notFound();

  return (
    <div>
      <AdminBookForm
        mode="edit"
        bookId={book.id}
        initialValues={{
          id: book.id,
          slug: book.slug,
          title: book.title,
          originalTitle: book.originalTitle,
          author: book.author,
          genres: book.genres,
          description: book.description,
          language: book.language,
          country: book.country,
          publisher: book.publisher,
          translator: book.translator,
          pageCount: book.pageCount,
          isbn: book.isbn,
          editionLabel: book.editionLabel,
          publishedYear: book.publishedYear,
          coverImage: book.coverImage,
          status: book.status,
          externalLinks: book.externalLinks.map((l) => ({
            provider: l.provider,
            type: l.type,
            url: l.url,
            label: l.label ?? "",
            isActive: l.isActive,
          })),
        }}
      />
      <AdminBookEditionsManager
        catalogBookId={book.id}
        bookTitle={book.title}
        originalTitle={book.originalTitle}
        author={book.author}
        genres={book.genres}
        editions={book.editions}
      />
    </div>
  );
}
