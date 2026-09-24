import AdminReadingListEditor from "@/components/admin/reading-lists/AdminReadingListEditor";
import { getAdminRelatedOptions } from "@/lib/admin/reading-lists";
export const dynamic = "force-dynamic";
export default async function NewReadingListPage() {
  return <AdminReadingListEditor relatedOptions={await getAdminRelatedOptions()} />;
}
