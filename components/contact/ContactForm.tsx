"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, LoaderCircle, Send, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const topics = [
  { value: "book", label: "پیشنهاد افزودن کتاب" },
  { value: "criticism", label: "انتقاد" },
  { value: "suggestion", label: "پیشنهاد و ایده" },
  { value: "problem", label: "گزارش مشکل" },
  { value: "cooperation", label: "همکاری" },
  { value: "other", label: "موضوع دیگر" },
] as const;

type Topic = (typeof topics)[number]["value"];

export default function ContactForm({
  initialTopic = "",
  initialBookTitle = "",
}: {
  initialTopic?: Topic | "";
  initialBookTitle?: string;
}) {
  const [topic, setTopic] = useState<Topic | "">(initialTopic);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [bookTitle, setBookTitle] = useState(initialBookTitle);
  const [message, setMessage] = useState(initialBookTitle ? `لطفاً کتاب «${initialBookTitle}» را به قفسه اضافه کنید.` : "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!topic) {
      setError("لطفاً موضوع پیام را انتخاب کنید.");
      return;
    }
    setPending(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = { ...Object.fromEntries(form.entries()), topic };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ارسال پیام انجام نشد. دوباره تلاش کنید.");
      setSent(true);
      formElement.reset();
      setTopic("");
      setBookTitle("");
      setMessage("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "ارسال پیام انجام نشد. دوباره تلاش کنید.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/80 p-5 shadow-[0_30px_90px_-60px_rgba(0,0,0,.55)] backdrop-blur-xl sm:p-7">
      <div aria-hidden="true" className="absolute inset-x-8 top-0 h-px bg-gradient-to-l from-transparent via-primary/60 to-transparent" />
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <span className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-primary"><Sparkles className="h-3.5 w-3.5" />فرم ارتباط</span>
          <h2 className="text-xl font-black text-foreground sm:text-2xl">پیامت را برای ما بنویس</h2>
          <p className="mt-1.5 text-sm leading-7 text-muted-foreground">موضوع را انتخاب کن تا بهتر راهنمایی‌ات کنیم.</p>
        </div>
        <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary sm:flex"><Send className="h-4 w-4" /></span>
      </div>

      {sent && <div role="status" className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm leading-7 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-5 w-5 shrink-0" />پیامت با موفقیت ارسال شد. از اینکه با ما در ارتباطی ممنونیم.</div>}
      {error && <p role="alert" className="mb-5 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm leading-7 text-destructive">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5 text-xs font-bold text-foreground">نام شما<Input name="name" required minLength={2} maxLength={100} autoComplete="name" placeholder="مثلاً سارا احمدی" className="h-11 rounded-xl border-border/70 bg-background/60 text-sm transition-colors hover:border-primary/30" /></label>
          <label className="block space-y-1.5 text-xs font-bold text-foreground">ایمیل برای پاسخ<Input name="email" required type="email" maxLength={254} autoComplete="email" placeholder="name@example.com" dir="ltr" className="h-11 rounded-xl border-border/70 bg-background/60 text-left text-sm transition-colors hover:border-primary/30" /></label>
        </div>

        <label className="block space-y-1.5 text-xs font-bold text-foreground">موضوع پیام
          <Select value={topic} onValueChange={(value) => { setTopic(value as Topic); setSent(false); setError(""); }}>
            <SelectTrigger className="h-11 w-full rounded-xl border-border/70 bg-background/60 text-right text-sm transition-colors hover:border-primary/30"><SelectValue placeholder="موضوع پیام را انتخاب کنید" /></SelectTrigger>
            <SelectContent>{topics.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
        </label>

        {topic === "book" && <div className="rounded-2xl border border-primary/20 bg-primary/[0.045] p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3"><p className="text-sm font-bold text-foreground">مشخصات کتاب پیشنهادی</p><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">برای بررسی دقیق‌تر</span></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5 text-xs font-bold">نام کتاب<Input name="bookTitle" required minLength={1} maxLength={200} value={bookTitle} onChange={(event) => setBookTitle(event.target.value)} placeholder="عنوان کتاب" className="h-10 rounded-xl bg-background/70 text-sm" /></label>
            <label className="block space-y-1.5 text-xs font-bold">نویسنده<Input name="bookAuthor" required minLength={1} maxLength={160} placeholder="نام نویسنده" className="h-10 rounded-xl bg-background/70 text-sm" /></label>
            <label className="block space-y-1.5 text-xs font-bold">مترجم <span className="font-normal text-muted-foreground">اختیاری</span><Input name="bookTranslator" maxLength={160} placeholder="نام مترجم" className="h-10 rounded-xl bg-background/70 text-sm" /></label>
            <label className="block space-y-1.5 text-xs font-bold">شابک یا لینک <span className="font-normal text-muted-foreground">اختیاری</span><Input name="bookReference" maxLength={300} placeholder="ISBN یا نشانی صفحهٔ کتاب" dir="auto" className="h-10 rounded-xl bg-background/70 text-sm" /></label>
          </div>
        </div>}

        <label className="block space-y-1.5 text-xs font-bold text-foreground">متن پیام
          <Textarea name="message" required minLength={10} maxLength={5000} rows={5} value={message} onChange={(event) => { setMessage(event.target.value); setSent(false); }} placeholder={topic === "book" ? "اگر توضیحی دربارهٔ این کتاب داری برایمان بنویس..." : "پیامت را اینجا بنویس..."} className="min-h-32 resize-y rounded-xl border-border/70 bg-background/60 text-sm leading-7 transition-colors hover:border-primary/30" />
          <span className="flex justify-end pt-1 text-[10px] font-normal text-muted-foreground">{message.length.toLocaleString("fa-IR")} از ۵٬۰۰۰</span>
        </label>

        <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"><label>وب‌سایت<Input name="website" tabIndex={-1} autoComplete="off" /></label></div>

        <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-6 text-muted-foreground">{topic === "book" ? "نام، ایمیل، موضوع، نام کتاب، نویسنده و متن پیام را کامل کنید." : "نام، ایمیل، موضوع و متن پیام را کامل کنید."}</p>
          <Button type="submit" disabled={pending} className="h-11 rounded-xl px-6 font-bold shadow-lg shadow-primary/15 sm:min-w-36">
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {pending ? "در حال ارسال..." : "ارسال پیام"}
          </Button>
        </div>
      </form>
    </section>
  );
}
