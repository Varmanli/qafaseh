import { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api/response";
import { createContactMessage } from "@/lib/admin/contact-messages";
import { sendEmail } from "@/lib/email";
import { getClientKey, rateLimit } from "@/lib/rate-limit";
import { getSiteSettings } from "@/lib/settings/service";

const contactSchema = z.object({
  name: z.string().trim().min(2, "نام را وارد کنید.").max(100),
  email: z.string().trim().email("ایمیل معتبر وارد کنید.").max(254),
  topic: z.enum(["book", "criticism", "suggestion", "problem", "cooperation", "other"]),
  message: z.string().trim().min(10, "پیام باید دست‌کم ۱۰ نویسه باشد.").max(5000),
  bookTitle: z.string().trim().max(200).optional().default(""),
  bookAuthor: z.string().trim().max(160).optional().default(""),
  bookTranslator: z.string().trim().max(160).optional().default(""),
  bookReference: z.string().trim().max(300).optional().default(""),
  website: z.string().max(300).optional().default(""),
}).superRefine((data, context) => {
  if (data.topic === "book") {
    if (!data.bookTitle) context.addIssue({ code: z.ZodIssueCode.custom, path: ["bookTitle"], message: "نام کتاب را وارد کنید." });
    if (!data.bookAuthor) context.addIssue({ code: z.ZodIssueCode.custom, path: ["bookAuthor"], message: "نام نویسنده را وارد کنید." });
  }
});

const topicLabels = {
  book: "پیشنهاد افزودن کتاب",
  criticism: "انتقاد",
  suggestion: "پیشنهاد و ایده",
  problem: "گزارش مشکل",
  cooperation: "همکاری",
  other: "موضوع دیگر",
} as const;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

export async function POST(req: NextRequest) {
  const limit = rateLimit(getClientKey(req, "contact"), { limit: 4, windowMs: 10 * 60_000 });
  if (!limit.allowed) return apiError("تعداد پیام‌ها زیاد است. کمی بعد دوباره تلاش کنید.", 429, "RATE_LIMITED");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("درخواست نامعتبر است.", 400);
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "اطلاعات فرم را بررسی کنید.", 422);

  // فیلد مخفی ضد ربات؛ پاسخ موفق می‌دهیم تا ربات برای تلاش دوباره راهنمایی نشود.
  if (parsed.data.website) return apiSuccess({ message: "پیام شما ارسال شد." });

  const { name, email, topic, message, bookTitle, bookAuthor, bookTranslator, bookReference } = parsed.data;
  try {
    await createContactMessage({ name, email, topic, message, bookTitle, bookAuthor, bookTranslator, bookReference });
  } catch (error) {
    console.error("[contact] Could not save contact message", error);
    return apiError("ثبت پیام موقتاً ممکن نیست. کمی بعد دوباره تلاش کنید.", 503, "CONTACT_SAVE_FAILED");
  }

  const settings = await getSiteSettings();
  if (!settings.contactEmail.trim()) {
    return apiSuccess({ message: "پیام شما ثبت شد و در پنل مدیریت قابل مشاهده است." });
  }

  const bookDetails = topic === "book"
    ? [
        `نام کتاب: ${bookTitle}`,
        `نویسنده: ${bookAuthor}`,
        ...(bookTranslator ? [`مترجم: ${bookTranslator}`] : []),
        ...(bookReference ? [`شابک یا لینک: ${bookReference}`] : []),
      ]
    : [];
  const text = [
    `موضوع: ${topicLabels[topic]}`,
    `نام: ${name}`,
    `ایمیل: ${email}`,
    ...bookDetails,
    "",
    "متن پیام:",
    message,
  ].join("\n");
  const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:2"><h2>پیام جدید از فرم تماس قفسه</h2><p><strong>موضوع:</strong> ${escapeHtml(topicLabels[topic])}</p><p><strong>نام:</strong> ${escapeHtml(name)}</p><p><strong>ایمیل:</strong> ${escapeHtml(email)}</p>${bookDetails.length ? `<h3>مشخصات کتاب</h3><ul>${bookDetails.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}</ul>` : ""}<h3>متن پیام</h3><p style="white-space:pre-wrap">${escapeHtml(message)}</p></div>`;

  const result = await sendEmail({
    to: settings.contactEmail.trim(),
    replyTo: email,
    subject: `پیام تماس قفسه: ${topicLabels[topic]}`,
    text,
    html,
  });

  // ثبت پیام در صندوق پنل معیار موفقیت است؛ ایمیل فقط اطلاع‌رسانی تکمیلی است.
  if (!result.ok) console.warn("[contact] Message was saved, but email notification was not delivered");
  return apiSuccess({ message: "پیام شما با موفقیت ارسال شد." });
}
