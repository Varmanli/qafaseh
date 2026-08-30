import AdminPageHeader from "@/components/admin/AdminPageHeader";
import FeaturedBooksManager from "@/components/admin/FeaturedBooksManager";
import HomepageCurationManager from "@/components/admin/HomepageCurationManager";
import HeroSlidesManager from "@/components/admin/HeroSlidesManager";

export const dynamic = "force-dynamic";

export default function AdminHomeContentPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="محتوای صفحه اصلی"
        description="مدیریت اسلایدر، کتاب‌ها و بخش‌های منتخبِ صفحه‌ی اصلی"
      />

      <HeroSlidesManager />

      <FeaturedBooksManager />

      <HomepageCurationManager />
    </div>
  );
}
