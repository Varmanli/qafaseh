// Book slugs identify canonical public catalog pages; editions share that page.
// Array order is editorial reading order, independent of publication date or rating.
export type ReadingListConfig = {
  slug: string;
  title: string;
  description: string;
  audience: string;
  category: string;
  hubGroup: string;
  discoverPreviewSlug?: string;
  relatedLists: string[];
  items: { bookSlug: string; note: string; difficulty?: "easy" | "medium" | "hard" }[];
};

export const readingLists: ReadingListConfig[] = [
  {
    slug: "enter-fantasy-worlds", discoverPreviewSlug: "fantasy", title: "ورود به جهان‌های خیال",
    description: "از جادوی آشنا شروع می‌کنیم و قدم‌به‌قدم به جهان‌هایی با خطر و کشمکش بیشتر می‌رسیم.",
    audience: "برای کسی که می‌خواهد فانتزی را از یک جهان آشنا آغاز کند و بعد سراغ ماجراجویی‌های پرتنش‌تر برود.",
    category: "فانتزی", hubGroup: "جهان‌های خیال", relatedLists: ["myth-and-power", "classics-first"],
    items: [
      { bookSlug: "هری-پاتر-هشت-جلدی", note: "یک جهان جادویی آشنا برای ورود به زبان و قواعد فانتزی." },
      { bookSlug: "دختر-مهتاب", note: "از جادوی مدرسه به افسانه، خانواده و سفر قهرمان می‌رویم." },
      { bookSlug: "اخگری-در-خاکستر", note: "حالا خطر سیاسی و انتخاب‌های دشوارتر وارد مسیر می‌شود." },
      { bookSlug: "جناح-چهارم", note: "پایان پرشتاب مسیر، با رقابت، نبرد و مخاطرهٔ بیشتر." },
    ],
  },
  {
    slug: "from-puzzle-to-suspense", discoverPreviewSlug: "mystery", title: "از معما تا تعلیق",
    description: "از کشمکش ذهنی یک شخصیت شروع می‌کنیم و به معماهای خانوادگی و تعلیق روان‌شناختی می‌رسیم.",
    audience: "برای کسی که داستان شخصیت‌محور دوست دارد و می‌خواهد کم‌کم وارد فضای تریلر شود.",
    category: "معما و تعلیق", hubGroup: "مسیرهای موضوعی", relatedLists: ["contemporary-lives", "classics-first"],
    items: [
      { bookSlug: "گامبی-وزیر", note: "تعلیق را نخست در رقابت و ذهن یک شخصیت تجربه کن." },
      { bookSlug: "دیزی-دارکر", note: "حالا یک جمع بسته و رازهای خانوادگی، معما را پررنگ‌تر می‌کنند." },
      { bookSlug: "سنگ-کاغذ-قیچی", note: "در پایان، روایت نامطمئن و رابطه‌ای پرتنش را دنبال کن." },
    ],
  },
  {
    slug: "classics-first", discoverPreviewSlug: "classics", title: "شروع با کلاسیک‌ها",
    description: "سه شیوهٔ متفاوت خواندن رمان کلاسیک: ماجراجویی تاریخی، واقع‌گرایی اجتماعی و نثر تیره‌تر مدرن.",
    audience: "برای خواننده‌ای که می‌خواهد با چند چهرهٔ متفاوت ادبیات کلاسیک آشنا شود.",
    category: "ادبیات کلاسیک", hubGroup: "ادبیات جهان", relatedLists: ["french-literature-path", "contemporary-lives"],
    items: [
      { bookSlug: "آیوانهو", note: "از ماجراجویی و روایت تاریخی وارد جهان کلاسیک شو." },
      { bookSlug: "ژرمینال", note: "گام بعدی، رمانی اجتماعی با تمرکز بر کار، فقر و قدرت است." },
      { bookSlug: "سفر-به-انتهای-شب", note: "در پایان، سراغ زبانی تلخ‌تر و ساختاری چالش‌برانگیزتر برو." },
    ],
  },
  {
    slug: "contemporary-lives", discoverPreviewSlug: "contemporary", title: "چند دریچه به زندگی امروز",
    description: "از تجربهٔ فردی به فشارهای اجتماعی و سپس به روایت پیچیده‌تر خانواده و تاریخ می‌رسیم.",
    audience: "برای کسی که رمان معاصر را از پرسش‌های نزدیک به زندگی روزمره شروع می‌کند.",
    category: "ادبیات معاصر", hubGroup: "ادبیات جهان", relatedLists: ["grief-to-hope", "classics-first"],
    items: [
      { bookSlug: "بادام", note: "با روایتی کوتاه‌تر دربارهٔ احساس و ارتباط آغاز کن." },
      { bookSlug: "کیم-جی-یونگ-متولد-1982", note: "از فرد به نقش‌های اجتماعی و انتظارات روزمره برس." },
      { bookSlug: "خدای-چیزهای-کوچک", note: "اکنون خانواده، طبقه و تاریخ را در روایتی چندلایه‌تر دنبال کن." },
    ],
  },
  {
    slug: "everyday-life-and-meaning", title: "از آرامش روزمره تا انتخاب‌های زندگی",
    description: "مسیر از توجه به لحظه‌های کوچک آغاز می‌شود و به پرسش‌هایی دربارهٔ ذهن، شادی و انتخاب می‌رسد.",
    audience: "برای کسی که از کتاب‌های تأملی و آرام شروع می‌کند و دوست دارد در پایان یک رمان بخواند.",
    category: "زندگی و معنا", hubGroup: "مسیرهای موضوعی", relatedLists: ["grief-to-hope", "contemporary-lives"],
    items: [
      { bookSlug: "کوچک-هوگا", note: "با آسودگی و لذت‌های کوچک زندگی روزمره شروع کن." },
      { bookSlug: "کوچک-لوکا", note: "نگاهت را از یک فرهنگ به راه‌های گوناگون شادی ببر." },
      { bookSlug: "مغازه-جادویی", note: "از عادت‌های بیرونی به توجه، ذهن و شفقت نزدیک شو." },
      { bookSlug: "کتابخانه-نیمه-شب", note: "در پایان، انتخاب‌ها و حسرت‌ها را در قالب داستان ببین." },
    ],
  },
  {
    slug: "grief-to-hope", title: "از سوگ تا امید",
    description: "چهار روایت دربارهٔ فقدان، پیوند با دیگران، مرور زندگی و امکان آغاز دوباره.",
    audience: "برای خواننده‌ای که می‌خواهد این مضمون را از روایتی احساسی به تأملی گسترده‌تر دنبال کند.",
    category: "روابط و زندگی", hubGroup: "مسیرهای موضوعی", relatedLists: ["everyday-life-and-meaning", "contemporary-lives"],
    items: [
      { bookSlug: "سم-هستم-بفرمایید", note: "با تجربهٔ مستقیم فقدان و حرف‌های ناگفته آغاز کن." },
      { bookSlug: "بادام", note: "سپس از زاویهٔ احساس و یادگرفتن ارتباط به دیگران نزدیک شو." },
      { bookSlug: "دفترچه-خاطرات-سنگی", note: "یک زندگی کامل را از خلال خاطره و گذر زمان ببین." },
      { bookSlug: "کتابخانه-نیمه-شب", note: "در پایان، سراغ امکان‌های دیگر و امید به ادامه برو." },
    ],
  },
  {
    slug: "french-literature-path", title: "سه ایستگاه در ادبیات فرانسه",
    description: "از واقع‌گرایی اجتماعی زولا به جنگ و سپس به نثر تلخ و متفاوت سلین می‌رسیم.",
    audience: "برای خواننده‌ای که از رمان‌های مفصل نمی‌ترسد و می‌خواهد ادبیات فرانسه را عمیق‌تر تجربه کند.",
    category: "ادبیات فرانسه", hubGroup: "ادبیات جهان", relatedLists: ["classics-first", "contemporary-lives"],
    items: [
      { bookSlug: "ژرمینال", note: "با زولا و مسئلهٔ کار، فقر و همبستگی اجتماعی شروع کن." },
      { bookSlug: "شکست", note: "همان نویسنده را این بار در بستر جنگ و فروپاشی تاریخی بخوان." },
      { bookSlug: "سفر-به-انتهای-شب", note: "در پایان، به نثری تندتر و نگاه بدبینانه‌تر به جامعه برس." },
    ],
  },
  {
    slug: "myth-and-power", title: "از افسانه تا نبرد قدرت",
    description: "از افسانه‌ای خانوادگی به دنبالهٔ همان جهان و سپس به فانتزی‌هایی با قدرت و مقاومت گسترده‌تر می‌رویم.",
    audience: "برای کسی که اسطوره و فانتزی عاشقانه دوست دارد و می‌خواهد مسیر را به سوی نبردهای بزرگ‌تر ادامه دهد.",
    category: "فانتزی و اسطوره", hubGroup: "جهان‌های خیال", relatedLists: ["enter-fantasy-worlds", "classics-first"],
    items: [
      { bookSlug: "دختر-مهتاب", note: "جهان و شخصیت اصلی این افسانه را بشناس." },
      { bookSlug: "قلب-جنگجوی-خورشید", note: "دنبالهٔ همان داستان را پیش از رفتن به جهان دیگر بخوان." },
      { bookSlug: "اخگری-در-خاکستر", note: "از افسانهٔ فردی به مقاومت در برابر یک امپراتوری برو." },
      { bookSlug: "جناح-چهارم", note: "با رقابت و نبردی پرشتاب‌تر مسیر را تمام کن." },
    ],
  },
];
