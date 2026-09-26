import { notFound } from "next/navigation";
import AdminReadingListEditor from "@/components/admin/reading-lists/AdminReadingListEditor";
import { getAdminReadingList, getAdminRelatedOptions } from "@/lib/admin/reading-lists";
import { getReadingListCategoryOptions } from "@/lib/admin/reading-list-categories";
import { getReadingListDisplayGroupOptions } from "@/lib/admin/reading-list-display-groups";
export const dynamic = "force-dynamic";
export default async function EditReadingListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [list, relatedOptions, categoryOptions, displayGroupOptions] = await Promise.all([
    getAdminReadingList(id),
    getAdminRelatedOptions(id),
    getReadingListCategoryOptions(),
    getReadingListDisplayGroupOptions(),
  ]);
  if (!list) notFound();
  return <AdminReadingListEditor initial={list} relatedOptions={relatedOptions} categoryOptions={categoryOptions} displayGroupOptions={displayGroupOptions} />;
}
