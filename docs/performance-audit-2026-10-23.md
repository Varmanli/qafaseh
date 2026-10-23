# گزارش ممیزی و اصلاحات قفسه — ۲۰۲۶/۱۰/۲۳

اصلاحات مستقیماً در Repository محلی `C:\Users\amirhosein\Desktop\Project\multi-project-deploy\ghafaseh` انجام شد. تغییرات قبلی و اصلاحات این مأموریت در کامیت‌های جدا نگهداری می‌شوند. تغییرات قبلی کاربر حفظ شدند. هیچ اتصال Production، deploy، تغییر PM2/Nginx فعال، حذف دادهٔ واقعی یا اجرای migration اصلی انجام نشد. این گزارش نتیجهٔ ممیزی ایستا، تست‌های محلی و اصلاحات اولویت‌دار است؛ اثبات رفع OOM و 504 در Production نیست.

> به‌روزرسانی بازبینی نهایی: نسخهٔ نهایی Next.js برابر 16.4.3 و markdown-it برابر 15.0.3 است. benchmarkهای این گزارش مربوط به مرحلهٔ 16.3.8 هستند. تست‌های امنیت/SMS و API کامنت که در مرحلهٔ اولیه skip بودند، جداگانه اجرا و موفق شدند. جزئیات اصلاح lookup قدیمی کتاب ردشده و اعتبارسنجی نهایی در docs/final-review-2026-10-23.md آمده است.

## A. معماری و مشکلات کشف‌شده

نسخه‌های واقعاً نصب‌شده در مرحلهٔ اولیه: Next.js **16.3.8**، React **19.2.8**، Drizzle ORM **0.45.4**، Node.js **22.20.0**. PostgreSQL محلی سری 17 است؛ نسخهٔ دیتابیس اصلی تأیید نشده است. ۱۰۶ فایل page، ۱۴۸ Route Handler و ۱۸۸ ماژول دارای use client شناسایی شد. وجود Client Component به‌خودی‌خود ایراد نیست؛ کنترل‌های تعاملی و providerها حفظ شدند.

App Router با صفحات سروری، Suspense در جزئیات کتاب و صفحهٔ اصلی، session مبتنی بر JWT/cookie و pg Pool استفاده می‌شود. کش تنظیمات قبلاً یک مقدار با TTL یک‌دقیقه‌ای داشت؛ React.cache در جزئیات کتاب فقط داخل همان render مشترک بود. Cache Components فعال نیست. راهنمای محلی Next و پیاده‌سازی همان نسخه پیش از اصلاح کش خوانده شدند. API قدیمی unstable_cache هنوز در نسخهٔ نصب‌شده کار می‌کند؛ تغییر معماری کامل به use cache انجام نشد.

| شدت | محل دقیق در نسخهٔ نهایی | شواهد و اثر احتمالی | اقدام |
| --- | --- | --- | --- |
| بالا | `lib/book/detail-service.ts:290` و `lib/book/detail-service.ts:640` | subject، نسخه‌ها، چهار query مرجع، aggregate و لینک‌ها در بازدیدهای مختلف دوباره اجرا می‌شدند؛ فشار DB و زمان پاسخ. | کش عمومی جدا از loadViewerEntry؛ TTL کوتاه برای آمار. |
| بالا | `lib/book/archive-service.ts:438` و `lib/book/archive-service.ts:361` | تا هفت query گزینه‌های فیلتر و aggregate کل Book برای هر درخواست؛ LIMIT صفحه، هزینهٔ aggregate قبل از آن را حذف نمی‌کند. | کش گزینه‌ها و صفحه‌های رایج؛ بازطراحی aggregate با طرح واقعی باقی است. |
| بالا | `lib/reference/author-archive.ts:28` | CTE آمار نویسنده، join کتابخانه و global_rating برای آرشیو؛ هزینهٔ DB با داده زیاد. | کش ۶۰ثانیه‌ای صفحه‌های رایج؛ query جست‌وجو همچنان تازه است. |
| بالا | `lib/book/discover-service.ts:30` و `lib/book/discover-service.ts:66` | COALESCE/array_agg وابسته به هر کاندید؛ query مشکوک پیدا شد. رتبه‌بندی همچنان ممکن است همهٔ کاندیدهای واجد شرایط را در RAM جمع کند. | ARRAY(SELECT ...) با حفظ ترتیب و آرایهٔ خالی؛ کش رتبه‌بندی‌های کوچک؛ حذف eligibility cap انجام نشد. |
| بالا | `app/sitemap.ts:25` | پنج خواندن اصلی، فهرست‌های مطالعه و Promise.all به تعداد کتاب‌ها در هر فراخوانی. | کش عمومی یک‌ساعته؛ ساخت مرحله‌ای ورودی کتاب‌ها؛ نتیجهٔ ناقص خطای DB کش نمی‌شود. |
| متوسط | `db/index.ts:17` و `db/pool-config.ts` | pool قبلی timeout صریح نداشت؛ پیش‌فرض pg تا ۱۰ اتصال برای هر pool و انتظار اتصال بدون محدودیت زمانی داشت. چند pool per request در سورس پیدا نشد؛ reload توسعه از قبل reuse داشت. | reuse سراسری در هر process، max=4، انتظار اتصال ۵ثانیه، statement timeout ۳۰ثانیه. |
| متوسط | `lib/reference/public-service.ts:86` و `lib/blog/service.ts:507` | metadata و page، lookup یکسان را تکرار می‌کردند؛ در مقاله محتوای کامل هم دوباره خوانده می‌شد. | کش عمومی و memoization درخواست؛ بازیابی نوع Date بعد از JSON. |
| متوسط | `app/layout.tsx:10` | force-dynamic در ریشه به همهٔ مسیرها تحمیل شده بود. PublicShell و صفحه‌های دارای cookies همچنان واقعاً پویا هستند. | revalidate=60 در ریشه؛ اطلاعات session عمومی cache نشد و HTML سروری حفظ شد. |
| متوسط | `lib/profile/service.ts:164` | سه عبور مستقل برای وضعیت‌ها، علاقه‌مندی و امتیاز یک کاربر. | یک query با FILTER؛ دادهٔ پروفایل در shared cache قرار نگرفت. |
| متوسط | `lib/search/global-service.ts:71` | تعداد کتاب ناشر محاسبه می‌شد اما در پاسخ ناشر برگردانده نمی‌شد. | حذف aggregate بلااستفاده؛ پاسخ API ثابت ماند. |
| متوسط | `lib/importers/iranketab/rate-limit.ts:2` | Map سراسری ادمین‌ها پس از پایان window رکورد را نگه می‌داشت؛ رشد نسبت به تعداد adminهای متفاوت در سورس قابل اثبات بود. | سقف ۱۰۰۰ و حذف idleهای منقضی؛ قفل کار فعال و release تکراری تست شد. |
| نیازمند اندازه‌گیری | `instrumentation.ts`، `lib/discovery/iranketab/background-worker.ts` | worker هر ۵ثانیه در process وب بیدار می‌شود؛ عملیات خارجی و importer می‌توانند با رندر رقابت کنند. running guard و lease موجود است. | کلید خاموش‌کردن صریح برای build/test یا worker جدا؛ مقدار پیش‌فرض عملیاتی عوض نشد. |
| نیازمند اندازه‌گیری | `next.config.ts`، `lib/server/general-image-processing.ts` و importer تصاویر | decode تصویر تا ۵۰MP، Buffer و sharp می‌توانند RSS native را بالا ببرند. | budget دیسک optimizer برابر ۲۵۶MiB؛ کیفیت، ابعاد و قابلیت فعلی حفظ شد. تست تصویر واقعی باقی است. |

نشت حافظهٔ کلی Node از روی سورس یا آزمون کوتاه اثبات نشده است. Map عمومی rate-limit موجود از قبل سقف ۱۰هزار داشت، WeakMapهای رتبه‌بندی کلید را قوی نگه نمی‌دارند و Mapهای داخل request/import، خودبه‌خود leak محسوب نشدند. sanitizer مبتنی بر JSDOM حذف نشد. سقف heap افزایش نیافت و dependency جدیدی نصب نشد.

### مسیرهای مهم و هزینهٔ خواندن

تعدادهای زیر شمارش واقعی SQLِ مهمان در fixture محلی هستند، نه برآورد تعداد query روی تمام داده‌ها یا همهٔ حالت‌های Production. هر پاسخ کامل HTML/RSC، queryهای shell و بخش‌های Suspense را هم شامل می‌شود. ورودی‌های session، فیلتر و تعداد نتایج می‌توانند آن را تغییر دهند.

| مسیر | دادهٔ اصلی و رفتار |
| --- | --- |
| صفحهٔ اصلی | featured/hero، نویسنده، genre، مجله و reading list عمومی cache می‌شوند؛ quotes و پسندهای viewer و following feed بیرون کش‌اند. fallback popular books فقط وقتی featured خالی باشد اجرا می‌شود و تازه مانده است. |
| /book/[id]، با slug عمومی | subject/edition/reference/link عمومی، آمار ۶۰ثانیه‌ای؛ یک خواندن تازهٔ کتابخانه برای viewer؛ quotes/notes و وضعیت پسند همچنان تازه. متادیتا و محتوای اصلی از خواندن عمومی مشترک استفاده می‌کنند؛ Suspense باقی است. |
| /authors/[slug] و /translators/[slug] | entity عمومی، آرشیو scopeشده و مقاله‌های مرتبط. entity در metadata/page مشترک است؛ آرشیو پیش‌فرض cache می‌شود؛ جست‌وجوی دلخواه cache صفحه ندارد. |
| /authors و /books | pagination موجود ۲۰ نویسنده/۳۰ کتاب حفظ شد؛ گزینه‌های فیلتر cache مستقل دارند. queryهای فیلترشده، sort و COUNT هنوز ممکن است گران باشند. |
| /search و API جست‌وجو | نتیجه‌های کتاب از search index، مرجع‌ها، مجله و کاربران عمومی. API global تا پنج گروه را هم‌زمان می‌خواند و نتیجه محدود است؛ محتوای مجله ILIKE و شمارش نویسنده هنوز نقاط بررسی‌اند. shared cache جست‌وجوی دلخواه اضافه نشد. |
| /blog/[slug]، آرشیو و category | مقالهٔ عمومی و دسته‌های عمومی cache شدند؛ رابطه‌ها و مقاله‌های مرتبط تازه خوانده می‌شوند. آرشیو مجله pagination موجود را دارد؛ تمام ترکیب‌های فیلتر cache نشده‌اند. |
| /note/[id] و /quote/[id] | visibility و viewer/likes به پاسخ اثر می‌گذارند؛ shared cache جدید ندارند. bounded list/countهای موجود و احراز مالکیت حفظ شد. |
| /[username] و کتابخانه | پروفایل خصوصی فقط برای مالک باز می‌شود؛ آمار از سه query به یک query رسید. فهرست اولیهٔ پروفایل همچنان حداکثر ۶۰ کتاب است؛ وضعیت خصوصی تازه خوانده می‌شود. |
| /sitemap.xml و robots | URL فعلی sitemap حفظ شد، دادهٔ عمومی cache شد، canonical/JSON-LD/robots و مسیرهای قدیمی تغییر ساختاری نکردند. Googlebot مسدود نشد. |

## B. اصلاحات و benchmark

Data Cache جدید برای JSON عمومی است؛ نتیجهٔ کامل شخصی getBookOverview یا getPublicProfile cache نشده است. Map کارهای درحال اجرا حداکثر ۶۴ promise دارد و cold read یک کلید را در یک process ادغام می‌کند. آزمون ۲۰ فراخوانی هم‌زمان یک اجرای loader را ثبت کرد. کش in-memory خود Next به ۱۶MiB محدود شد؛ دادهٔ پایدار از cache خود فریم‌ورک روی دیسک استفاده می‌کند. ابطال مدیریت محتوا بعد از موفقیت و پس از commit اجرا می‌شود؛ حالت واردسازی فایل با موفقیت جزئی هم پوشش داده شد.

در مقایسهٔ زیر **همان کد اصلاح‌شده، همان production build و همان دادهٔ ساختگی** با PUBLIC_DATA_CACHE_DISABLED=1 و سپس با کش فعال اجرا شد. بنابراین ستون خاموش baseline کد پیش از این مأموریت نیست؛ اثر لایهٔ کش را جدا می‌کند. دیتابیس فقط روی loopback و جدا از اطلاعات کاربر بود. ۲۲ کتاب آزمایشی، دو مرجع، یک مقاله و هشت reading list برای تست رابط آماده شد. زمان‌ها میانهٔ پنج درخواست پس از یک درخواست اولیه و شامل دریافت کامل پاسخ‌اند؛ TTFB اندازه‌گیری مستقل نشده است.

| مسیر | SQL/request با bypass | SQL/request با کش گرم | زمان bypass (ms) | زمان کش گرم (ms) |
| --- | ---: | ---: | ---: | ---: |
| `/` | 10 | 1 | 26 | 24 |
| `/book/perf-audit-book` | 19 | 7 | 31 | 25 |
| `/authors/perf-audit-author` | 13 | 1 | 32 | 18 |
| `/translators/perf-audit-translator` | 12 | 0 | 27 | 10 |
| `/books` | 10 | 0 | 16 | 10 |
| `/authors` | 3 | 0 | 13 | 8 |
| `/blog/perf-audit-article` | 6 | 4 | 15 | 14 |
| `/sitemap.xml` | 7 | 0 | 11 | 3 |

در تست synthetic جدا با ۲۰هزار کتاب و حدود ۶۰هزار ارتباط نویسنده، برابری خروجی نسخهٔ قدیم و ARRAY برای تمام ردیف‌ها، آرایهٔ خالی، نقش TRANSLATOR و ترتیب شناسه‌ها تأیید شد. در اجرای نهاییِ پنج‌نمونه‌ای EXPLAIN ANALYZE، میانهٔ SQL قدیمی **۱۵۶٫۳۹۹ms** و SQL جدید **۱۴۶٫۰۳۴ms** بود. index پیشنهادی جدید در این مقایسه اعمال نشد؛ index مشابه ساختار قبلی استفاده شد. این تفاوت کوچک‌تر از منفعت کش است و علت CPU اصلی را اثبات نمی‌کند.

تست scale موجود ۱۹۹۹۹ کتاب واجد شرایط از ۲۰هزار ردیف را بررسی کرد؛ prefilterِ مجموعه‌ها نتیجهٔ رتبه‌بندی را نسبت به همهٔ کاندیدها از دست نداد و استفاده از trigram index برای عبارت نادر تأیید شد. بیشترین query کاندید در همان تست حدود ۱۳۳۴ms و ranking حدود ۵۰۹ms بود؛ این‌ها گلوگاه سردِ باقی‌مانده روی fixture خاص‌اند، نه عدد Production.

## C. نتایج اعتبارسنجی

| بررسی | نتیجه |
| --- | --- |
| Baseline پیش از اصلاح | Type Check موفق؛ lint بدون خطا با ۴ warning قبلی؛ ۳۸۵ تست موفق و ۱۵ skip، بدون شکست. |
| Type Check نهایی | موفق؛ build نهایی نیز TypeScript را تأیید کرد. |
| Lint نهایی | بدون خطا؛ همان ۴ warning قبلی در فایل‌های نامرتبط باقی است. |
| مجموعهٔ تست محلی با دیتابیس جدا | ۴۲۷ موفق، صفر شکست، ۳ skip از مجموع ۴۳۰ assertion/subtest گزارش‌شده. |
| بررسی نهایی متمرکز پس از اصلاح واردسازی جزئی | ۳۷ موفق، صفر شکست، بدون skip؛ cache، pool، queryهای عمومی و migration guardهای موجود. |
| Production Build نهایی | موفق؛ ۱۰۷ خروجی static در مرحلهٔ ساخت ایجاد شد. مسیرهای sessionدار/force-dynamic همچنان SSR هستند. |
| HTTP روی production build محلی | مهمان و دو session مستقل؛ یادداشت خصوصی A فقط برای A و B فقط برای B؛ محتوای خصوصی در fetch-cache پیدا نشد. |
| SEO و invalidation | HTML اصلی، canonical و JSON-LD کتاب/مقاله حاضر؛ رد درخواست ادمین مهمان؛ رد/تأیید کتاب آزمایشی، 404 و ابطال آرشیو و sitemap بلافاصله پس از پاسخ موفق تأیید شد. |
| آزمون کوتاه ترافیک | ۸۰ درخواست با هم‌زمانی ۴، صفر خطای HTTP؛ اندازهٔ heap/RSS بدون GC اجباری ثبت شد. |
| Git diff whitespace | بررسی نهایی بدون ایراد whitespace. |

سه skip مربوط به دو تست security/SMS با نام ثابت دیتابیس ghafaseh_security_test و یک تست API کامنت نیازمند server اختصاصی است. برای اجرای آن‌ها از دیتابیس موجود کاربر یا Production استفاده نشد. تست‌های امنیتی واحد و سایر integrationهای visibility/comments/likes روی محیط جدا اجرا شدند. در اولین اجرای گسترده، دو guard نام دیتابیس و نبود fixtureِ reading list باعث شکست آماده‌سازی شدند؛ guardها دست‌کاری نشدند، دو تست نام‌ثابت skip و fixtureهای ساختگی جدا آماده شدند؛ اجرای نهایی بدون شکست بود.

heapUsed در آزمون ۸۰ درخواست از **112.8MiB** به **116.2MiB** و RSS از **195.1MiB** به **234.9MiB** رسید. این اندازه‌گیری کوتاه، بدون کنترل GC و بدون تصویر واقعی است؛ از آن کاهش پایدار RAM یا رفع memory leak نتیجه‌گیری نمی‌شود. طرح heap snapshot و آزمون بلندمدت در راهنمای استقرار آمده است.

## D. کارهای باقی‌مانده و ریسک‌ها

- علت قطعی 504، افزایش heap و CPU اصلی، بدون query plan، traffic و snapshot اصلی مشخص نشده است. اثر Production باید بعد از deploy مجاز اندازه‌گیری شود.
- aggregate کل کتابخانه در archive/author، queryهای sort/filter/search و projectionهای متعدد نسخهٔ کتاب در cache miss هنوز مهم‌اند. بازنویسی با LATERAL، aggregate نگهداری‌شده یا محدودسازی کاندیدها بدون guardian و طرح نماینده انجام نشد.
- getCatalogDiscoverySignals با وجود keyset صفحه‌های ۱۰۰۰تایی، همهٔ صفحه‌ها را در یک آرایه جمع می‌کند؛ آن را streaming یا کاملاً bounded معرفی نمی‌کنیم. ranking تمام کاندیدهای واجد شرایط در cache miss حفظ شده تا کیفیت پیشنهادها و کتاب‌های تازه حذف نشود.
- sitemap تک‌فایلی هنوز کل کاتالوگ را جمع می‌کند. قبل از رسیدن به سقف ۵۰هزار URL یا حجم مجاز، shard و sitemap index با حفظ endpoint فعلی طراحی شود. backfill اسلاگ‌های خالی باید جداگانه بررسی شود؛ رفتار سازگاری ensureCatalogBookSlug حفظ شده و ممکن است روی ردیف‌های قدیمی query نوشتن ایجاد کند.
- cache filesystem بین چند instance خودکار هماهنگ فرض نشده است. worker و ابزار خارج از request، ابطال فوری ندارند؛ public تا TTL و sitemap تا حدود یک ساعت بعد از تغییر مستقیم می‌تواند قدیمی باشد. زمان‌بندی TTL، اندازهٔ cache و cardinality اسلاگ‌های نامعتبر نیازمند پایش است.
- ویرایش ادمین همهٔ tag عمومی را باطل می‌کند و می‌تواند چند miss هم‌زمان بسازد. Map محدود و pool کوچک این هزینه را کنترل می‌کنند؛ در نرخ ویرایش بالا tagها باید ریزتر شوند.
- pool چهاراتصالی و timeout پیش‌فرض، پشت query کند صف یا خطای کنترل‌شده می‌سازند؛ با waitingCount و p95 تنظیم شوند. این سقف، مقدار قطعی مناسب همهٔ workloadها نیست.
- object storage و تصویر واقعی، ایمیل/SMS واقعی، Nginx/PM2 و رفتار چندساعتهٔ heap تست نشده‌اند. HTTP محلی با next start اجرا شد؛ مسیر واقعی سرویس standalone و آزمون بصری مرورگر بررسی نشده‌اند. تغییر کیفیت تصویر یا حذف قابلیت انجام نشده است.
- دو index اختیاری در drizzle/manual آماده‌اند و به journal اضافه نشده‌اند. نیاز آن‌ها باید با EXPLAIN staging و indexهای فعلی تأیید شود؛ هیچ index اصلی اعمال نشد.
- تنظیمات PostgreSQL، PM2، Nginx dry-run، مراحل post-deploy و rollback در **docs/performance-deploy-checklist.md** ثبت شده‌اند. اعداد تنظیمات پیشنهاد staging هستند، نه تغییرات سرور.

برای rollback، patch اختصاصی این مأموریت را معکوس اعمال و build/restart کنید؛ reset سراسری تغییرات قبلی کاربر را از بین می‌برد. PUBLIC_DATA_CACHE_DISABLED=1 فقط لایهٔ Data Cache جدید را bypass می‌کند. نسخهٔ اختصاصی patch نسبت به snapshot ابتدای مأموریت تهیه شد؛ امکان اعمال معکوس آن با git apply --reverse --check تأیید شد و همراه خروجی‌هاست.

## فهرست فایل‌های این مأموریت

- `.env.example`
- `app/api/admin/blog/[id]/route.ts`
- `app/api/admin/blog/categories/[id]/route.ts`
- `app/api/admin/blog/categories/route.ts`
- `app/api/admin/blog/route.ts`
- `app/api/admin/book-covers/[editionId]/upload/route.ts`
- `app/api/admin/book-covers/bulk-upload/route.ts`
- `app/api/admin/books/[id]/editions/route.ts`
- `app/api/admin/books/[id]/route.ts`
- `app/api/admin/books/import-links/commit/route.ts`
- `app/api/admin/books/import/route.ts`
- `app/api/admin/books/route.ts`
- `app/api/admin/catalog-books/[bookId]/primary-edition/route.ts`
- `app/api/admin/catalog/[id]/route.ts`
- `app/api/admin/editions/[id]/route.ts`
- `app/api/admin/home/curation/route.ts`
- `app/api/admin/home/featured/[id]/route.ts`
- `app/api/admin/home/featured/reorder/route.ts`
- `app/api/admin/home/featured/route.ts`
- `app/api/admin/home/hero/[id]/books/route.ts`
- `app/api/admin/home/hero/[id]/route.ts`
- `app/api/admin/home/hero/reorder/route.ts`
- `app/api/admin/home/hero/route.ts`
- `app/api/admin/navigation/route.ts`
- `app/api/admin/reading-list-categories/[id]/route.ts`
- `app/api/admin/reading-list-categories/route.ts`
- `app/api/admin/reading-list-display-groups/[id]/route.ts`
- `app/api/admin/reading-list-display-groups/route.ts`
- `app/api/admin/reading-lists/[id]/route.ts`
- `app/api/admin/reading-lists/route.ts`
- `app/api/admin/reference/[id]/route.ts`
- `app/api/admin/reference/route.ts`
- `app/api/admin/references/import/apply/route.ts`
- `app/api/admin/settings/route.ts`
- `app/api/admin/static-pages/[slug]/route.ts`
- `app/layout.tsx`
- `app/sitemap.ts`
- `db/index.ts`
- `db/pool-config.ts`
- `docs/final-review-2026-10-23.md`
- `docs/performance-audit-2026-10-23.md`
- `docs/performance-deploy-checklist.md`
- `docs/performance-explain.sql`
- `docs/performance-nginx.proposed.conf`
- `drizzle/manual/20261023_public-performance.sql`
- `instrumentation.ts`
- `lib/blog/service.ts`
- `lib/book/archive-service.ts`
- `lib/book/detail-service.test.ts`
- `lib/book/detail-service.ts`
- `lib/book/discover-service.ts`
- `lib/book/discovery-array-db.test.ts`
- `lib/book/discovery-recommendations.ts`
- `lib/book/external-links.ts`
- `lib/book/reading-lists-service.ts`
- `lib/book/similar-books-service.ts`
- `lib/cache/pool-config.test.ts`
- `lib/cache/public-data.test.ts`
- `lib/cache/public-data.ts`
- `lib/cache/public-queries-db.test.ts`
- `lib/home/curation.ts`
- `lib/home/service.ts`
- `lib/importers/iranketab/rate-limit.test.ts`
- `lib/importers/iranketab/rate-limit.ts`
- `lib/layout/navigation-settings.ts`
- `lib/profile/service.ts`
- `lib/reference/author-archive.ts`
- `lib/reference/public-service.ts`
- `lib/search/global-service.ts`
- `next.config.ts`
- `package-lock.json`
- `package.json`
- `scripts/benchmark-public.ts`

گزارش جزئیات عملیاتی: docs/performance-deploy-checklist.md. فایل benchmark قابل تکرار: scripts/benchmark-public.ts. raw نتایج local HTTP و log تست/build همراه خروجی‌ها ارائه شده‌اند؛ فایل env، credential، session و schema اصلی در خروجی تحویل قرار نگرفته‌اند.
