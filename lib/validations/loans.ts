import { z } from "zod";

const date = z.iso.date();

const loanFields = {
  bookId: z.string().uuid(),
  borrowerName: z.string().trim().min(1).max(150),
  loanedAt: date,
  dueAt: date.nullable(),
  note: z.string().trim().max(1000).nullable(),
};
const validDates = (value: { loanedAt: string; dueAt: string | null }) => !value.dueAt || value.dueAt >= value.loanedAt;
const dateError = {
  path: ["dueAt"], message: "تاریخ بازگشت نباید پیش از تاریخ امانت باشد",
};

export const loanSchema = z.object(loanFields).refine(validDates, dateError);

export const loanUpdateSchema = z.object({
  ...loanFields,
  bookId: z.string().uuid().nullable(),
  returned: z.boolean(),
}).refine(validDates, dateError);
