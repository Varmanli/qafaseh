export const CONTRIBUTOR_ROLE_LABELS = {
  AUTHOR: "نویسنده",
  TRANSLATOR: "مترجم",
} as const;

export type ContributorRole = keyof typeof CONTRIBUTOR_ROLE_LABELS;

export function normalizeContributorRoles(roles: string[]): ContributorRole[] {
  return (Object.keys(CONTRIBUTOR_ROLE_LABELS) as ContributorRole[])
    .filter((role) => roles.includes(role));
}
