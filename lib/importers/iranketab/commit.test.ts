import assert from "node:assert/strict";
import test from "node:test";
import { referenceInputWithoutIranKetabSeoTitle } from "./reference-profile-input";

test("new IranKetab reference inputs retain profile data but omit source SEO titles", () => {
  const profile = {
    profileId: "source-profile-42",
    originalName: "Original name",
    description: "Profile biography",
    sourceUrl: "https://www.iranketab.ir/profile/source-profile-42",
    seoTitle: "کتاب های نمونه | ایران کتاب",
    seoDescription: "Source profile description",
    metadata: { source: "iranketab" },
  };

  const input = referenceInputWithoutIranKetabSeoTitle(profile);

  assert.equal(Object.hasOwn(input, "seoTitle"), false);
  assert.deepEqual(input, {
    profileId: "source-profile-42",
    originalName: "Original name",
    description: "Profile biography",
    sourceUrl: "https://www.iranketab.ir/profile/source-profile-42",
    seoDescription: "Source profile description",
    metadata: { source: "iranketab" },
  });
  assert.equal(profile.seoTitle, "کتاب های نمونه | ایران کتاب");
});

test("new IranKetab reference inputs handle absent profiles", () => {
  assert.deepEqual(referenceInputWithoutIranKetabSeoTitle(undefined), {});
});
