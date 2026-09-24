// Curated by canonical catalog slug. Missing or unapproved books are omitted at render time.
export type DiscoveryCollection = {
  slug: string;
  title: string;
  description?: string;
  bookSlugs: string[];
  listSlug?: string;
};

export const moods: DiscoveryCollection[] = [
  { slug: "dark", title: "یه داستان تاریک می‌خوام", description: "راز، تنش و سایه‌های آدم‌ها", bookSlugs: ["دیزی-دارکر", "سنگ-کاغذ-قیچی", "سفر-به-انتهای-شب"] },
  { slug: "calm", title: "یه چیز آروم می‌خوام", description: "برای مکث کردن و نفس کشیدن", bookSlugs: ["کوچک-هوگا", "کوچک-لوکا", "مغازه-جادویی"] },
  { slug: "thoughtful", title: "می‌خوام ذهنم درگیر بشه", description: "داستان‌هایی که بعد از تمام شدن می‌مانند", bookSlugs: ["خدای-چیزهای-کوچک", "کیم-جی-یونگ-متولد-1982", "کتابخانه-نیمه-شب"] },
  { slug: "thrilling", title: "یه داستان هیجان‌انگیز", description: "یک صفحه دیگر، و بعد یکی دیگر", bookSlugs: ["جناح-چهارم", "سنگ-کاغذ-قیچی", "گامبی-وزیر"] },
  { slug: "elsewhere", title: "می‌خوام وارد یه دنیای دیگه بشم", description: "از اینجا تا یک جهان تازه", bookSlugs: ["دختر-مهتاب", "اخگری-در-خاکستر", "هری-پاتر-هشت-جلدی"] },
  { slug: "weighty", title: "یه کتاب جدی و سنگین می‌خوام", description: "برای یک خواندن عمیق‌تر", bookSlugs: ["ژرمینال", "شکست", "سفر-به-انتهای-شب"] },
];

export const topics: DiscoveryCollection[] = [
  { slug: "identity", title: "هویت", bookSlugs: ["بادام", "کیم-جی-یونگ-متولد-1982", "خدای-چیزهای-کوچک"] },
  { slug: "life", title: "معنای زندگی", bookSlugs: ["کتابخانه-نیمه-شب", "مغازه-جادویی", "کوچک-هوگا"] },
  { slug: "power", title: "قدرت", bookSlugs: ["ژرمینال", "جناح-چهارم", "گامبی-وزیر"] },
  { slug: "relationships", title: "روابط انسانی", bookSlugs: ["خدای-چیزهای-کوچک", "سم-هستم-بفرمایید", "دفترچه-خاطرات-سنگی"] },
  { slug: "war", title: "جنگ", bookSlugs: ["شکست", "اخگری-در-خاکستر", "آیوانهو"] },
  { slug: "solitude", title: "تنهایی", bookSlugs: ["سفر-به-انتهای-شب", "بادام", "کتابخانه-نیمه-شب"] },
];

export const startingBooks = ["کتابخانه-نیمه-شب", "هری-پاتر-هشت-جلدی", "ژرمینال", "گامبی-وزیر"];

// Quiz facets reuse the collections above; only reading commitment needs new
// curation because page counts vary substantially between approved editions.
const from = (collections: DiscoveryCollection[], slug: string) =>
  collections.find((item) => item.slug === slug)?.bookSlugs ?? [];

export const quizKinds: DiscoveryCollection[] = [
  { slug: "literary", title: "ادبی", bookSlugs: ["آیوانهو", "ژرمینال", "بادام", "کیم-جی-یونگ-متولد-1982"] },
  { slug: "reflective", title: "فکری", bookSlugs: [...new Set([...from(moods, "thoughtful"), ...from(topics, "life"), ...from(topics, "identity")])] },
  { slug: "exciting", title: "هیجان‌انگیز", bookSlugs: [...new Set([...from(moods, "thrilling"), ...from(moods, "dark"), ...from(moods, "elsewhere")])] },
];

export const quizMoodOptions = [
  { slug: "dark", title: "تاریک و تلخ" },
  { slug: "calm", title: "آرام" },
  { slug: "thoughtful", title: "فکری" },
  { slug: "thrilling", title: "هیجان‌انگیز" },
  { slug: "elsewhere", title: "دنیای متفاوت" },
  { slug: "weighty", title: "جدی و سنگین" },
] as const;

export const quizCommitments: DiscoveryCollection[] = [
  { slug: "short", title: "کوتاه", bookSlugs: ["بادام", "کیم-جی-یونگ-متولد-1982", "کوچک-هوگا", "مغازه-جادویی"] },
  { slug: "medium", title: "متوسط", bookSlugs: ["دیزی-دارکر", "سنگ-کاغذ-قیچی", "گامبی-وزیر", "دفترچه-خاطرات-سنگی", "کتابخانه-نیمه-شب", "فابل", "آیوانهو", "کوچک-لوکا"] },
  { slug: "long", title: "بلند", bookSlugs: ["جناح-چهارم", "اخگری-در-خاکستر", "خدای-چیزهای-کوچک", "ژرمینال", "سفر-به-انتهای-شب", "شکست", "دختر-مهتاب", "هری-پاتر-هشت-جلدی"] },
];
