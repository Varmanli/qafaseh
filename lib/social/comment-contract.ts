import { z } from "zod";

export const COMMENT_MAX_LENGTH = 2000;
export const COMMENT_PAGE_SIZE = 20;
export const commentTargetSchema = z.enum(["QUOTE", "NOTE", "ACTIVITY"]);
export type SocialCommentTarget = z.infer<typeof commentTargetSchema>;

const targetIdSchema = z.string().trim().min(1).max(80);
export const commentContentSchema = z.string().trim().min(1, "متن دیدگاه را بنویس").max(COMMENT_MAX_LENGTH, "دیدگاه خیلی طولانی است");
export const commentQuerySchema = z.object({
  targetType: commentTargetSchema,
  targetId: targetIdSchema,
  parentId: z.uuid().optional(),
  cursor: z.string().min(1).max(240).optional(),
});
export const createCommentSchema = z.object({
  targetType: commentTargetSchema,
  targetId: targetIdSchema,
  content: commentContentSchema,
  parentId: z.uuid().optional(),
  requestId: z.uuid(),
});

export interface CommentItem {
  id: string;
  parentId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  authorUsername: string | null;
  authorName: string | null;
  authorImage: string | null;
  replyCount: number;
  canEdit: boolean;
  canDelete: boolean;
}
export interface CommentPage {
  comments: CommentItem[];
  nextCursor: string | null;
  totalCount?: number;
}
