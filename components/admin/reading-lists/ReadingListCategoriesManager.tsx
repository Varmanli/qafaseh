import ReadingListTermsManager from "@/components/admin/reading-lists/ReadingListTermsManager";

export default function ReadingListCategoriesManager() {
  return <ReadingListTermsManager
    endpoint="/api/admin/reading-list-categories"
    resource="categories"
    title="دسته‌بندی‌های لیست مطالعه"
    description="دسته‌ها را بساز یا تغییر نام بده؛ نام جدید روی فهرست‌های مرتبط هم اعمال می‌شود."
    singular="دسته‌بندی"
  />;
}
