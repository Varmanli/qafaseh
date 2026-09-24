import { notFound } from "next/navigation";
import AdminReadingListEditor from "@/components/admin/reading-lists/AdminReadingListEditor";
import { getAdminReadingList, getAdminRelatedOptions } from "@/lib/admin/reading-lists";
export const dynamic = "force-dynamic";
export default async function EditReadingListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [list, relatedOptions] = await Promise.all([getAdminReadingList(id), getAdminRelatedOptions(id)]);
  if (!list) notFound();
  return <AdminReadingListEditor initial={list} relatedOptions={relatedOptions} />;
}
