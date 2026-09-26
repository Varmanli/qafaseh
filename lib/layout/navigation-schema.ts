import { z } from "zod";

const navLinkSchema = z.object({
  label: z.string().trim().min(1, "عنوان لینک الزامی است").max(50),
  href: z.string().trim().min(1, "آدرس لینک الزامی است").max(500).refine(
    (value) => (value.startsWith("/") && !value.startsWith("//")) || /^https?:\/\//i.test(value),
    "آدرس باید مسیر داخلی با / یا لینک کامل http(s) باشد",
  ),
});

export const navigationMenusSchema = z.object({
  header: z.array(navLinkSchema).min(1).max(5, "منوی هدر حداکثر ۵ لینک دارد تا در موبایل هم جا شود"),
  footer: z.array(navLinkSchema).max(15),
});
