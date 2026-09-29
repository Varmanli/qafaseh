"use client";
import { Button } from "@/components/ui/button";
export default function Error({ reset }: { reset: () => void }) {
  return <div dir="rtl" className="mx-auto max-w-3xl p-8 text-center"><p>بارگذاری امانت‌ها ناموفق بود.</p><Button onClick={reset} className="mt-4">تلاش دوباره</Button></div>;
}
