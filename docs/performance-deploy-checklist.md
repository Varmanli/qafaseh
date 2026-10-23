# اعتبارسنجی و استقرار آیندهٔ بهینه‌سازی — ۲۰۲۶/۱۰/۲۳

این راهنما اجرا نشده است. این مأموریت به Production، SSH، PM2، Nginx یا دیتابیس اصلی متصل نشد. فایل‌های SQL در `drizzle/manual/` عضو journal نیستند و با migrate معمولی اجرا نمی‌شوند.

## قرارداد کش

- Cache Components فعال نیست؛ API نصب‌شدهٔ `unstable_cache` همراه `React.cache` استفاده شده است. مهاجرت سراسری به `use cache` انجام نشده است.
- فقط DTO عمومی در Data Cache قرار می‌گیرد. جلسه، کاربر جاری، وضعیت مطالعه، یادداشت خصوصی، فید دنبال‌شوندگان و پسندهای وابسته به کاربر همچنان تازه خوانده می‌شوند.
- محتوای کم‌تغییر: ۳۰۰ ثانیه؛ آمار و آرشیو عمومی: ۶۰ ثانیه؛ sitemap: ۳۶۰۰ ثانیه. TTL در Next معمولاً stale-while-revalidate است؛ سقف قطعی تازگی در صورت خطای دیتابیس نیست.
- تمام کش‌های جدید tag مشترک `public-content-v1` دارند. عملیات موفق مدیریت محتوا، پس از بازگشت handler، آن را با `{ expire: 0 }` باطل می‌کند. واردسازی فایل استثناست: پس از نتیجهٔ importer و پیش از پاسخ خطا نیز invalidate می‌کند، چون تراکنش‌های قبلی ممکن است موفق شده باشند.
- ابطال فعلی عمداً عمومی است. مدیریت محتوا کم‌تکرار است؛ اگر تعداد ویرایش‌ها بالا رفت، بعد از اندازه‌گیری tagهای کتاب/نویسنده/مجله را جدا کنید.
- worker خارج از request، اسکریپت‌های SQL و ویرایش مستقیم DB ابطال Next را انجام نمی‌دهند. دادهٔ عمومی بعد از TTL و درخواست بعدی تازه می‌شود؛ sitemap ممکن است یک ساعت قدیمی بماند. برای انتشار فوری از مسیر مدیریت محتوا استفاده کنید یا مرحلهٔ ابطال معتبر بعد از کار worker طراحی کنید. `revalidateTag` را مستقیماً داخل interval فراخوانی نکنید.
- این راهکار برای یک فرایند Node روی یک VPS ارزیابی شده است. در چند instance، دیسک کش و ابطال tag باید هماهنگ شوند؛ اشتراک فایل به‌تنهایی فرض نشده است. Redis اضافه نشده است.
- `cacheMaxMemorySize` برابر ۱۶ MiB است؛ سقف کل RSS، heap یا حافظهٔ sharp نیست. Map درخواست‌های درحال اجرا حداکثر ۶۴ promise نگه می‌دارد و بعد از resolve/reject پاک می‌شود. وقتی پر است، خواندن جدید از مسیر معمول اجرا می‌شود.
- جست‌وجو و فیلتر دلخواه آرشیو پایدار ذخیره نمی‌شوند؛ فیلترها جداگانه cache می‌شوند. فقط صفحه‌های معمول بدون فیلتر تا صفحهٔ ۱۰۰ کش صفحه دارند. کوئریِ archive با فیلتر همچنان می‌تواند سنگین باشد.
- کش lookup اسلاگ‌ها و رتبه‌بندی روزانه روی فایل‌سیستم است. TTL به معنی حذف فایل قدیمی نیست. اندازه، inode و عمر فایل‌های `.next/cache/fetch-cache` را پایش کنید؛ پاک‌سازی آفلاین و کنترل‌شده را فقط بعد از اندازه‌گیری طراحی کنید. مسیرهای تصادفیِ خزنده می‌توانند تعداد کلیدها را زیاد کنند.
- DTO مجله در مرز خروجی، `publishedAt` و `updatedAt` را دوباره به `Date` تبدیل می‌کند؛ JSON داخلی Data Cache تاریخ را string می‌کند.

## پیش از استقرار

1. Diff اختصاصی این مأموریت را نسبت به وضعیت اولیه بررسی کنید؛ checkout قبلی تغییرات ثبت‌نشدهٔ دیگری دارد. برای rollback از reset یا checkout سراسری استفاده نکنید.
2. روی staging با دادهٔ نماینده، نسخهٔ Node، نسخهٔ واقعی PostgreSQL، indexهای موجود، تعداد کاربران/کتاب‌ها و آمار جدول‌ها را ثبت کنید. عدد PostgreSQL اصلی از روی دیتابیس محلی حدس زده نشده است.
3. Type Check، lint، تست‌ها و production build را تکرار کنید. Build روی سیستم محلی ۱۱ worker داشت؛ روی VPS دو گیگابایتی هم‌زمان با سرویس‌های زنده build نگیرید. ترجیحاً artifact را بیرون آن VPS بسازید.
4. هنگام build/test محلی `IRANKETAB_DISCOVERY_WORKER_ENABLED=false` تنظیم کنید. در محیط اصلی مقدار پیش‌فرض `true` حفظ شده است؛ اگر worker جدا دارید، فقط با طرح زمان‌بندی و recovery روشن آن را در وب خاموش کنید.
5. mount و مجوز نوشتن cache در خروجی standalone را بررسی کنید. entrypoint و pipeline موجود را بدون بررسی عوض نکنید. دستور start واقعیِ standalone باید server تولیدشده را اجرا کند.
6. مهاجرت‌های قبلیِ موجود در checkout، از جمله تغییرات مستقل امنیت/SMS/مجله، را جداگانه بررسی کنید؛ این مأموریت journal را تغییر نداده است.

## PostgreSQL و indexهای پیشنهادی

`DB_POOL_MAX=4`، `DB_CONNECTION_TIMEOUT_MS=5000`، `DB_STATEMENT_TIMEOUT_MS=30000` پیش‌فرض‌اند. max برای هر فرایند است؛ هم‌پوشانی deploy، ابزارهای CLI و workerهای جدا را در بودجهٔ اتصال حساب کنید. خطای idle connection ثبت می‌شود تا رویداد بدون listener فرایند را نکشد. statement timeout برای هر statement است، نه سقف زمان کل HTTP یا transaction.

برای VPS مشترک ۲ GiB، یک نقطهٔ شروع آزمایشی می‌تواند `shared_buffers=128MB` تا `256MB`، `work_mem=2MB` تا `4MB` و `maintenance_work_mem=64MB` باشد. این‌ها تنظیمات اعمال‌شده یا مقادیر قطعی مناسب دیتابیس اصلی نیستند. work_mem به هر عملیات sort/hash و worker تعلق می‌گیرد؛ با تعداد اتصال و queryهای هم‌زمان ضرب می‌شود. max_connections را صرفاً برای رفع صف بالا نبرید. از تنظیم هیپ بزرگ‌تر به‌عنوان راه‌حل اصلی استفاده نکنید.

منبع رفتار حافظه: [مستندات PostgreSQL 17](https://www.postgresql.org/docs/17/runtime-config-resource.html). نسخهٔ اصلی را پیش از انتخاب تنظیمات بررسی کنید.

دو index اختیاری آماده شده‌اند:

| فایل | الگوی هدف | دلیل نیاز به بررسی |
| --- | --- | --- |
| `drizzle/manual/20261023_public-performance.sql`، index نویسنده | `(catalog_book_id, reference_item_id) WHERE role='AUTHOR'` | index یکتای فعلی `(catalog_book_id, reference_item_id, role)` از قبل کمک می‌کند؛ index جدید ممکن است ارزش هزینهٔ نوشتن و دیسک را نداشته باشد. |
| همان فایل، index عنوان | `lower(title) WHERE status='APPROVED'` | fallback اسلاگ قدیمی عنوان را مقایسه می‌کند؛ index اسلاگ برای این شرط کافی نیست. |

فایل `docs/performance-explain.sql` برای staging آماده است. ابتدا EXPLAIN بدون ANALYZE، سپس روی staging با `statement_timeout` محدود، `EXPLAIN (ANALYZE, BUFFERS, SETTINGS)` بگیرید. تعداد loop، rows removed، sort spill، temp blocks و shared read/hit را ثبت کنید. ANALYZE واقعاً query را اجرا می‌کند؛ در این مأموریت روی Production اجرا نشده است. برای queryهای واقعی archive و author نیز SQL تولیدشدهٔ Drizzle را با پارامترهای staging استخراج کنید؛ SQL نمونه، همهٔ هزینهٔ آن مسیرها را بازتولید نمی‌کند.

منبع: [EXPLAIN در PostgreSQL](https://www.postgresql.org/docs/17/using-explain.html).

indexها را فقط پس از تأیید، جداگانه و بیرون transaction بسازید. `CONCURRENTLY` به معنی بدون هزینه یا بدون هیچ قفل نیست و شکست آن ممکن است index نامعتبر باقی بگذارد. `pg_index.indisvalid` و تعریف واقعی index را بررسی کنید؛ `IF NOT EXISTS` یکسان بودن تعریف را تضمین نمی‌کند. برای rollback فقط دو index اضافه‌شده را با `DROP INDEX CONCURRENTLY` حذف کنید؛ indexهای قبلی را حذف نکنید.

منبع: [CREATE INDEX](https://www.postgresql.org/docs/17/sql-createindex.html).

## Nginx، خزنده‌ها و PM2

پیشنهاد Nginx در `docs/performance-nginx.proposed.conf` است. آن را جایگزین config موجود نکنید. ابتدا مسیرهای search API را با dry-run مشاهده کنید؛ نرخ و burst نمونه‌اند. IP باید از proxy مورد اعتماد و با overwrite هدرها به‌دست بیاید؛ هدر دلخواه کاربر معتبر نیست. HTML کتاب، نویسنده، robots و sitemap در این پیشنهاد محدود نشده‌اند. Googlebot با User-Agent مسدود یا بدون اعتبارسنجی معاف نشده است.

منبع رفتار dry-run و محدودسازی: [ماژول رسمی Nginx](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html).

config موجود PM2 عوض نشده است. پیش از استفاده، start واقعی standalone، یک instance روی VPS کوچک، مجموع اتصال‌ها، restart_delay، graceful shutdown و سقف RSS را بررسی کنید. `max_memory_restart: 512M` موجود را درمان leak یا مقداری قطعی مناسب فرض نکنید؛ restartهای مکرر ممکن است cache را سرد و فشار DB را بیشتر کنند. بالا بردن سقف heap جای این اصلاحات را نمی‌گیرد.

## تصاویر و heap

- `next/image` و کیفیت‌های ۶۰، ۷۵ و ۷۸ حفظ شدند. بودجهٔ دیسک optimizer روی ۲۵۶ MiB تنظیم شده است؛ پس از پر شدن، تصاویر قدیمی دوباره بهینه می‌شوند. این مقدار را با دیسک واقعی تنظیم کنید.
- پردازش تصاویر admin/importer تا ۵۰ میلیون پیکسل ورودی را می‌پذیرد. یک تصویر decodeشده می‌تواند حدود ۲۰۰ MB فقط برای RGBA نیاز داشته باشد؛ چند پردازش هم‌زمان مهم‌تر از اندازهٔ فایل فشرده است. محدودیت کیفیت یا ابعاد بدون آزمون تغییر نکرده است.
- در تست HTTP از تصاویر placeholder محلی استفاده شد؛ تأخیر storage، cold optimization، timeout و مصرف RSS تحت تصویر واقعی اندازه‌گیری نشده‌اند. روی staging چند اندازه و نسبت تصویر واقعی را با هم‌زمانی ۱، ۲ و ۴ بررسی کنید. کاهش concurrency در sharp یا استفاده از اندازه‌های آماده در object storage، تصمیم بعد از این اندازه‌گیری است.
- sanitizer مبتنی بر isomorphic-dompurify/JSDOM بار ثابت import دارد؛ حذف یا تضعیف sanitizer انجام نشده است. WeakMapهای رتبه‌بندی، کلیدهای مرده را قوی نگه نمی‌دارند و از روی وجودشان leak نتیجه‌گیری نمی‌شود.
- برای بررسی leak، production build محلی را با worker خاموش، دیتای نماینده و inspector فقط روی loopback اجرا کنید. پس از warm-up از همان مسیرها ۱۰۰۰ تا ۱۰۰۰۰ درخواست با concurrency محدود و اسلاگ‌های ثابت و سپس متفاوت بفرستید. در نقاط ثابت بعد از GC، heap snapshot بگیرید و retained size/dominatorهای Map، closure، Buffer و JSDOM را مقایسه کنید. رشد RSS بدون رشد retained heap می‌تواند از allocator یا حافظهٔ native باشد.
- آزمون کوتاه ۸۰ درخواست بدون GC اجباری، اثبات نبود leak نیست. snapshot اصلی یا نمودار چندساعتهٔ Production در دسترس نبوده است.

## پس از استقرار و rollback

1. HTTP 200، canonical، JSON-LD، HTML اولیه، redirect اسلاگ قدیمی و 404 ناموجود را روی مسیرهای اصلی بررسی کنید.
2. با مهمان و دو حساب آزمایشی، وضعیت مطالعه و یادداشت خصوصی را مقایسه کنید. هیچ پاسخ شخصی در proxy/CDN cache عمومی نشود؛ هدرهای API فعلی حفظ شده‌اند.
3. یک کتاب آزمایشی را ویرایش/رد/تأیید و نسخهٔ اصلی آن را عوض کنید؛ صفحهٔ کتاب، نویسنده، مترجم، آرشیو، homepage و sitemap را پس از پاسخ موفق کنترل کنید. مقاله و category را منتشر/پیش‌نویس کنید و تاریخ و canonical را کنترل کنید.
4. p50/p95 زمان پاسخ کامل و TTFB، نرخ 5xx/504، تعداد SQL/request، pool waitingCount، RSS/heap، CPU DB، زمان query و cache hit/miss را قبل/بعد در ترافیک مشابه ثبت کنید. دادهٔ محلی معیار پذیرش Production نیست.
5. در regression، ابتدا `PUBLIC_DATA_CACHE_DISABLED=1` را با restart کنترل‌شده برای bypass لایهٔ جدید استفاده کنید؛ این فقط کش دادهٔ جدید را خاموش می‌کند و همهٔ تغییرات pool/query/config را برنمی‌گرداند. سپس patch اختصاصی این مأموریت را معکوس اعمال و rebuild/restart کنید. تغییرات قبلی کاربر را حفظ کنید.
6. اگر index پیشنهادی اصلاً اعمال نشده باشد، rollback دیتابیس لازم نیست. هیچ داده‌ای با این patch حذف یا تبدیل نشده است.

برای benchmark محلی خواندنی:

```powershell
$env:PERF_BASE_URL = 'http://127.0.0.1:3107'
node node_modules/tsx/dist/cli.mjs scripts/benchmark-public.ts / /books /authors /sitemap.xml
```

این script تنها origin محلی را می‌پذیرد، برای هر مسیر یک درخواست اولیه و پنج نمونهٔ بعدی می‌فرستد و response کامل را اندازه می‌گیرد. برای مقایسهٔ کش، همان build و داده را یک بار با bypass و یک بار با کش فعال اجرا کنید. کوئری‌شماری در این مأموریت با preload موقت محلی انجام شد؛ instrumentation دائمی یا endpoint تشخیصی عمومی به محصول اضافه نشده است.
