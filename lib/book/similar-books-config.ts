// Canonical CatalogBook IDs: one work can have many editions, but one relation target.
const id = {
  nightJourney: "9f03a1d3-7324-44d3-b8d6-72e146e9136b", // سفر به انتهای شب
  downfall: "02f99cf8-b62a-4ea7-977e-fb68a2bc2046", // شکست
  germinal: "bdd5138b-08ac-4906-975f-f3b8ca3e32a8", // ژرمینال
  harry: "b639e470-0437-42af-a55d-f4c7f5d3d6aa", // هری پاتر
  midnight: "1317625a-65ce-4098-98fe-640f30739bfc", // کتابخانه نیمه شب
  smallThings: "473d30b1-8884-4d0c-be95-5467a1631b77", // خدای چیزهای کوچک
  ivanhoe: "c3887625-be39-4a86-bbae-18a29ac2c1e3", // آیوانهو
  stoneDiaries: "1ae078f8-3d7d-444e-8af0-28453ff42084", // دفترچه خاطرات سنگی
  ember: "cc44222a-fd52-4e0e-ad70-24010981b019", // اخگری در خاکستر
  fourthWing: "eb23bc4b-0f2d-4efb-b483-76379991fd21", // جناح چهارم
  magicShop: "fffa0059-8b91-4398-815c-670ed74ddb52", // مغازه جادویی
  kim: "e5907b2f-835f-4e69-8151-3eacd6d514f7", // کیم جی یونگ
  lykke: "e5a70f9a-67d3-4756-88a4-785b78d85224", // کوچک لوکا
  hygge: "a742e7ac-2722-41c6-864a-a35cc7b04092", // کوچک هوگا
  gambit: "581fe8ab-8b8a-4593-a8b1-25bc54ab77b5", // گامبی وزیر
  knight: "a555a67d-caa3-45d7-81fb-6fdd722224aa", // شوالیه و شب پره
  almond: "68b1459b-81ed-43fe-803c-e471602493a2", // بادام
  daisy: "d36d4407-6068-4a73-b932-3133d5898493", // دیزی دارکر
  rockPaper: "6f85ae15-c8cf-41a4-bf1e-ee388191d6fe", // سنگ کاغذ قیچی
  fable: "78685c9b-4073-4d1e-8e2f-468bfb86ffe9", // فابل
  moon: "0e58670f-ae3e-4350-97c5-9c41c696b2ff", // دختر مهتاب
  twinCrowns: "a6dcb38e-123e-4d9c-9793-f34c0497c31e", // تاج دوقلوها
  sam: "a57fce9f-2eac-4726-8c48-6d6a4757a499", // سم هستم، بفرمایید
  sunHeart: "9d03af54-c39f-4f62-a505-88819bbfe8ae", // قلب جنگجوی خورشید
} as const;

// Direction and order are editorial: A → B never implies B → A.
export const similarBooksById: Record<string, readonly string[]> = {
  [id.nightJourney]: [id.germinal, id.downfall, id.smallThings, id.kim],
  [id.downfall]: [id.germinal, id.nightJourney, id.ivanhoe, id.smallThings],
  [id.germinal]: [id.downfall, id.nightJourney, id.kim, id.smallThings],
  [id.harry]: [id.ember, id.fourthWing, id.moon, id.twinCrowns],
  [id.midnight]: [id.sam, id.magicShop, id.almond, id.stoneDiaries],
  [id.smallThings]: [id.stoneDiaries, id.kim, id.almond, id.germinal],
  [id.ivanhoe]: [id.downfall, id.ember, id.fable, id.harry],
  [id.stoneDiaries]: [id.smallThings, id.kim, id.midnight, id.sam],
  [id.ember]: [id.fourthWing, id.twinCrowns, id.harry, id.moon],
  [id.fourthWing]: [id.ember, id.fable, id.twinCrowns, id.moon],
  [id.magicShop]: [id.midnight, id.hygge, id.lykke, id.sam],
  [id.kim]: [id.smallThings, id.stoneDiaries, id.almond, id.germinal],
  [id.lykke]: [id.hygge, id.magicShop, id.midnight, id.stoneDiaries],
  [id.hygge]: [id.lykke, id.magicShop, id.midnight, id.stoneDiaries],
  [id.gambit]: [id.almond, id.rockPaper, id.kim, id.daisy],
  [id.almond]: [id.kim, id.midnight, id.smallThings, id.gambit],
  [id.daisy]: [id.rockPaper, id.knight, id.gambit, id.nightJourney],
  [id.rockPaper]: [id.daisy, id.knight, id.gambit, id.nightJourney],
  [id.fable]: [id.fourthWing, id.ember, id.moon, id.twinCrowns],
  [id.moon]: [id.sunHeart, id.ember, id.twinCrowns, id.fable],
  [id.twinCrowns]: [id.moon, id.sunHeart, id.fourthWing, id.ember],
  [id.sam]: [id.midnight, id.stoneDiaries, id.magicShop, id.smallThings],
  [id.sunHeart]: [id.moon, id.twinCrowns, id.ember, id.fable],
};
