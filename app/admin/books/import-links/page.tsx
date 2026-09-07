import { requireAdmin } from "@/lib/admin/permissions";
import IranKetabPreviewClient from "./IranKetabPreviewClient";

export const dynamic = "force-dynamic";

export default async function IranKetabImportLinksPage() {
  await requireAdmin();
  return (
    <div className="w-full">
      <IranKetabPreviewClient />
    </div>
  );
}
