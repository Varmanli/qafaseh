import type { PublicBlogPostPreview } from "@/lib/blog/service";

export const FEATURED_AUTHOR_LIMIT = 6;
export const FEATURED_BLOG_POST_LIMIT = 3;
export const FEATURED_READING_LIST_LIMIT = 2;

export type FeaturedAuthor = {
  id: string;
  name: string;
  slug: string | null;
  coverImage: string | null;
  bookCount: number;
  readCount: number;
};

export type FeaturedAuthorOption = Pick<
  FeaturedAuthor,
  "id" | "name" | "slug" | "coverImage"
>;

export type FeaturedBlogPostOption = Pick<
  PublicBlogPostPreview,
  "id" | "title" | "bannerImage" | "categoryName"
>;

export type FeaturedReadingListOption = {
  id: string;
  title: string;
  slug: string;
  category: string;
  mode: "ORDERED" | "UNORDERED";
};

export type HomepageCuration = {
  authors: FeaturedAuthorOption[];
  posts: FeaturedBlogPostOption[];
  readingLists: FeaturedReadingListOption[];
};
