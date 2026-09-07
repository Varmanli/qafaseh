import { BookOpenText, LibraryBig, Quote, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import type { SiteBranding } from "@/lib/settings/types";

export function AuthBrandPanel({
  branding,
}: {
  branding: SiteBranding;
}) {
  return (
    <aside className="relative hidden w-[48%] overflow-hidden border-l border-white/8 lg:flex lg:flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(146,214,185,0.16),transparent_22%),radial-gradient(circle_at_75%_30%,rgba(83,157,124,0.14),transparent_24%),linear-gradient(160deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]" />
      <div className="absolute right-10 top-16 h-44 w-44 rounded-full bg-emerald-300/10 blur-3xl" />
      <div className="absolute bottom-20 left-10 h-52 w-52 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative z-10 flex px-10 pt-10">
        <BrandLogo
        {...branding}
        size="auth"
        />
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-center px-10 py-12">
        <div className="max-w-xl space-y-7">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-emerald-200/10 bg-emerald-200/10 px-3 py-1 text-xs font-semibold text-emerald-100/90">
              فضای آرام برای خواندن و بازگشتن
            </span>
            <h2 className="text-4xl font-black leading-[1.5] tracking-tight text-white">
              دنیای کتاب‌ها،
              <br />
              همیشه در دسترس تو
            </h2>
            <p className="max-w-lg text-base leading-8 text-white/60">
              قفسه جایی است برای نگه‌داشتن کتاب‌ها، یادداشت‌ها و مسیر مطالعه؛ با
              رابطی آرام، دقیق و خوانا که تمرکز را از متن نمی‌گیرد.
            </p>
          </div>

          <div className="grid gap-4">
            <FeatureRow
              icon={<LibraryBig className="h-4 w-4" />}
              title="کتابخانه‌ی شخصی"
              text="قفسه‌ها، فهرست‌ها و وضعیت مطالعه در یک فضای تمیز و منظم."
            />
            <FeatureRow
              icon={<BookOpenText className="h-4 w-4" />}
              title="یادداشت و بازخوانی"
              text="نقل‌قول‌ها و برداشت‌ها کنار هر کتاب، همیشه آماده‌ی مرور."
            />
            <FeatureRow
              icon={<Sparkles className="h-4 w-4" />}
              title="تجربه‌ای آرام"
              text="طراحی کم‌هیاهو با نور نرم، تایپوگرافی خوانا و تمرکز روی محتوا."
            />
          </div>
        </div>

        <FloatingCards />
      </div>

      <div className="relative z-10 px-10 pb-10 text-sm text-white/38">
        © {new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric" }).format(new Date())} {branding.siteName}
      </div>
    </aside>
  );
}

function FeatureRow({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4 backdrop-blur-xl">
      <div className="mb-2 flex items-center gap-3 text-white">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.06] text-emerald-200">
          {icon}
        </span>
        <span className="font-bold">{title}</span>
      </div>
      <p className="text-sm leading-7 text-white/52">{text}</p>
    </div>
  );
}

function FloatingCards() {
  return (
    <>
      <div className="pointer-events-none absolute left-10 top-[18%] hidden w-52 rounded-[1.75rem] border border-white/8 bg-white/[0.05] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-2xl xl:block">
        <p className="mb-2 text-xs font-semibold text-emerald-100/70">
          یادداشت امروز
        </p>
        <p className="text-sm leading-7 text-white/55">
          «هر کتاب، اتاقی تازه در ذهن باز می‌کند.»
        </p>
      </div>

      {/* <div className="pointer-events-none absolute bottom-[20%] right-10 hidden w-56 rotate-[-5deg] rounded-[1.75rem] border border-white/8 bg-gradient-to-br from-white/[0.08] to-white/[0.03] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur-2xl xl:block">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-white/62">در حال مطالعه</span>
          <Quote className="h-4 w-4 text-emerald-200/70" />
        </div>
        <div className="space-y-2">
          <div className="h-2 rounded-full bg-white/8">
            <div className="h-2 w-[68%] rounded-full bg-emerald-200/70" />
          </div>
          <p className="text-sm text-white/52">پیشروی آرام، بدون شلوغی.</p>
        </div>
      </div> */}
    </>
  );
}
