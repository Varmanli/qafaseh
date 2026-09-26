"use client";

import { useState } from "react";
import { BookOpen, PanelsTopLeft, Sparkles } from "lucide-react";

import AdminPageHeader from "@/components/admin/AdminPageHeader";
import FeaturedBooksManager from "@/components/admin/FeaturedBooksManager";
import HeroSlidesManager from "@/components/admin/HeroSlidesManager";
import HomepageCurationManager from "@/components/admin/HomepageCurationManager";

const sections = {
  slides: {
    label: "اسلایدر صفحه اصلی",
    description: "بنرها و اسلایدهای ابتدای صفحه را مدیریت کن.",
    icon: PanelsTopLeft,
  },
  books: {
    label: "کتاب‌های پیشنهادی",
    description: "کتاب‌هایی را که در صفحه اصلی پیشنهاد می‌شوند انتخاب و مرتب کن.",
    icon: BookOpen,
  },
  curation: {
    label: "بخش‌های منتخب",
    description: "نویسنده‌ها، مطالب مجله و مسیرهای مطالعهٔ صفحه اصلی را تنظیم کن.",
    icon: Sparkles,
  },
} as const;

type Section = keyof typeof sections;

export default function HomeContentSections() {
  const [activeSection, setActiveSection] = useState<Section>("slides");
  const current = sections[activeSection];
  const Icon = current.icon;

  return (
    <div dir="rtl" className="space-y-6">
      <AdminPageHeader
        title="محتوای صفحه اصلی"
        description="هر بخش را جداگانه انتخاب و مدیریت کن."
        action={
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-card px-3">
            <span className="shrink-0 text-xs font-bold text-muted-foreground">بخش</span>
            <select
              aria-label="انتخاب بخش محتوای صفحه اصلی"
              value={activeSection}
              onChange={(event) => setActiveSection(event.target.value as Section)}
              className="min-h-10 min-w-48 bg-transparent text-sm font-bold text-foreground outline-none"
            >
              {Object.entries(sections).map(([value, section]) => (
                <option key={value} value={value}>{section.label}</option>
              ))}
            </select>
          </label>
        }
      />

      <div className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-primary/[0.04] px-4 py-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div>
          <h2 className="text-sm font-black text-foreground">{current.label}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{current.description}</p>
        </div>
      </div>

      {activeSection === "slides" ? <HeroSlidesManager /> : null}
      {activeSection === "books" ? <FeaturedBooksManager /> : null}
      {activeSection === "curation" ? <HomepageCurationManager /> : null}
    </div>
  );
}
