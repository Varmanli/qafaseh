// Exact stored genre labels are objective signals. Editorial slugs only boost
// selected books; they never define the candidate pool.
export type DiscoveryCollection = {
  slug: string;
  title: string;
  description?: string;
  genres: readonly string[];
  editorialBookSlugs?: readonly string[];
  listSlug?: string;
};

export const moods: DiscoveryCollection[] = [
  { slug: "dark", title: "یه داستان تاریک می‌خوام", description: "راز، تنش و سایه‌های آدم‌ها", genres: ["داستان معمایی", "داستان تریلر", "داستان جنایی", "داستان وحشت"], editorialBookSlugs: ["دیزی-دارکر", "سنگ-کاغذ-قیچی", "سفر-به-انتهای-شب"] },
  { slug: "calm", title: "یه چیز آروم می‌خوام", description: "برای مکث کردن و نفس کشیدن", genres: [], editorialBookSlugs: ["کوچک-هوگا", "کوچک-لوکا", "مغازه-جادویی"] },
  { slug: "thoughtful", title: "می‌خوام ذهنم درگیر بشه", description: "داستان‌هایی که بعد از تمام شدن می‌مانند", genres: ["داستان روانشناسانه", "ادبیات رئالیسم جادویی"], editorialBookSlugs: ["خدای-چیزهای-کوچک", "کیم-جی-یونگ-متولد-1982", "کتابخانه-نیمه-شب"] },
  { slug: "thrilling", title: "یه داستان هیجان‌انگیز", description: "یک صفحه دیگر، و بعد یکی دیگر", genres: ["داستان معمایی", "داستان تریلر", "داستان ماجرایی", "داستان جنایی"], editorialBookSlugs: ["جناح-چهارم", "سنگ-کاغذ-قیچی", "گامبی-وزیر"] },
  { slug: "elsewhere", title: "می‌خوام وارد یه دنیای دیگه بشم", description: "از اینجا تا یک جهان تازه", genres: ["داستان فانتزی", "داستان علمی تخیلی", "ادبیات رئالیسم جادویی"], editorialBookSlugs: ["دختر-مهتاب", "اخگری-در-خاکستر", "هری-پاتر-هشت-جلدی"] },
  { slug: "weighty", title: "یه کتاب جدی و سنگین می‌خوام", description: "برای یک خواندن عمیق‌تر", genres: ["ادبیات کلاسیک", "داستان تاریخی", "داستان اجتماعی"], editorialBookSlugs: ["ژرمینال", "شکست", "سفر-به-انتهای-شب"] },
];

export const topics: DiscoveryCollection[] = [
  { slug: "identity", title: "هویت", genres: [], editorialBookSlugs: ["بادام", "کیم-جی-یونگ-متولد-1982", "خدای-چیزهای-کوچک"] },
  { slug: "life", title: "معنای زندگی", genres: [], editorialBookSlugs: ["کتابخانه-نیمه-شب", "مغازه-جادویی", "کوچک-هوگا"] },
  { slug: "power", title: "قدرت", genres: [], editorialBookSlugs: ["ژرمینال", "جناح-چهارم", "گامبی-وزیر"] },
  { slug: "relationships", title: "روابط انسانی", genres: ["داستان عاشقانه", "داستان اجتماعی", "داستان درام"], editorialBookSlugs: ["خدای-چیزهای-کوچک", "سم-هستم-بفرمایید", "دفترچه-خاطرات-سنگی"] },
  { slug: "war", title: "جنگ", genres: [], editorialBookSlugs: ["شکست", "اخگری-در-خاکستر", "آیوانهو"] },
  { slug: "solitude", title: "تنهایی", genres: [], editorialBookSlugs: ["سفر-به-انتهای-شب", "بادام", "کتابخانه-نیمه-شب"] },
];

export const startingBooks = ["کتابخانه-نیمه-شب", "هری-پاتر-هشت-جلدی", "ژرمینال", "گامبی-وزیر"];

export const quizKinds: DiscoveryCollection[] = [
  { slug: "literary", title: "ادبی", genres: ["ادبیات کلاسیک", "ادبیات داستانی", "رمان", "داستان تاریخی", "داستان درام"], editorialBookSlugs: ["آیوانهو", "ژرمینال", "بادام", "کیم-جی-یونگ-متولد-1982"] },
  { slug: "reflective", title: "فکری", genres: ["داستان روانشناسانه", "ادبیات رئالیسم جادویی", "داستان اجتماعی"], editorialBookSlugs: ["خدای-چیزهای-کوچک", "کیم-جی-یونگ-متولد-1982", "کتابخانه-نیمه-شب"] },
  { slug: "exciting", title: "هیجان‌انگیز", genres: ["داستان معمایی", "داستان تریلر", "داستان ماجرایی", "داستان جنایی", "داستان فانتزی", "داستان علمی تخیلی"], editorialBookSlugs: ["جناح-چهارم", "سنگ-کاغذ-قیچی", "گامبی-وزیر"] },
];

export const quizMoodOptions = [
  { slug: "dark", title: "تاریک و تلخ" },
  { slug: "calm", title: "آرام" },
  { slug: "thoughtful", title: "فکری" },
  { slug: "thrilling", title: "هیجان‌انگیز" },
  { slug: "elsewhere", title: "دنیای متفاوت" },
  { slug: "weighty", title: "جدی و سنگین" },
] as const;
export const quizCommitments = [
  { slug: "short", title: "کوتاه" },
  { slug: "medium", title: "متوسط" },
  { slug: "long", title: "بلند" },
] as const;
