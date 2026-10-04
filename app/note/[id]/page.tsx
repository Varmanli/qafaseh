import type { Metadata } from "next";
import { notFound } from "next/navigation";

import PublicShell from "@/components/PublicShell";
import NoteCard from "@/components/profile/NoteCard";
import ContentDetailLayout, { ContentDetailBookHeader } from "@/components/social/ContentDetailLayout";
import { getCurrentUser } from "@/lib/auth/session";
import { getVisiblePublishedNoteById } from "@/lib/notes/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "یادداشت کتاب | قفسه" };

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getCurrentUser();
  const note = await getVisiblePublishedNoteById(id, viewer?.id);
  if (!note) notFound();
  const bookHref = `/book/${encodeURIComponent(note.bookSlug || note.bookId || note.catalogBookId || "")}`;

  return (
    <PublicShell user={viewer}>
      <ContentDetailLayout title="یادداشت کتاب" fallbackHref={bookHref} targetType="NOTE" targetId={note.id} canComment={!!viewer}>
        <ContentDetailBookHeader href={bookHref} title={note.bookTitle} author={note.bookAuthor} cover={note.bookCover} username={note.authorUsername} name={note.authorName} image={note.authorImage} />
        <NoteCard note={note} canLike={!!viewer} showBook={false} showComments={false} detailPage />
      </ContentDetailLayout>
    </PublicShell>
  );
}
