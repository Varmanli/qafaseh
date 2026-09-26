import ReadingListTermsManager from "@/components/admin/reading-lists/ReadingListTermsManager";

export default function ReadingListDisplayGroupsManager() {
  return <ReadingListTermsManager
    endpoint="/api/admin/reading-list-display-groups"
    resource="groups"
    title="گروه‌های نمایش لیست مطالعه"
    description="گروه‌های صفحهٔ عمومی لیست‌ها را مدیریت کن؛ تغییر نام روی فهرست‌های مرتبط هم اعمال می‌شود."
    singular="گروه نمایش"
  />;
}
