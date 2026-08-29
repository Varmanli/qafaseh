import type { IranKetabImportDraft } from "./draft";

type IranKetabReferenceProfile = NonNullable<
  IranKetabImportDraft["entities"][number]["profile"]
>;

/**
 * IranKetab's title metadata is source branding, not curated Qafaseh SEO.
 * Keep it in the import draft for review, but never pass it to persistence.
 */
export function referenceInputWithoutIranKetabSeoTitle(
  profile: IranKetabReferenceProfile | undefined,
): Omit<IranKetabReferenceProfile, "seoTitle"> {
  if (!profile) return {};
  const { seoTitle: _sourceSeoTitle, ...referenceInput } = profile;
  return referenceInput;
}
