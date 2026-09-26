import AdminReadingListEditor from "@/components/admin/reading-lists/AdminReadingListEditor";
import { getAdminRelatedOptions } from "@/lib/admin/reading-lists";
import { getReadingListCategoryOptions } from "@/lib/admin/reading-list-categories";
import { getReadingListDisplayGroupOptions } from "@/lib/admin/reading-list-display-groups";
export const dynamic = "force-dynamic";
export default async function NewReadingListPage() {
  const [relatedOptions, categoryOptions, displayGroupOptions] = await Promise.all([
    getAdminRelatedOptions(),
    getReadingListCategoryOptions(),
    getReadingListDisplayGroupOptions(),
  ]);
  return <AdminReadingListEditor relatedOptions={relatedOptions} categoryOptions={categoryOptions} displayGroupOptions={displayGroupOptions} />;
}
