import { createHash } from "node:crypto";
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  IranKetabImportEvent,
  IranKetabImportSession,
  User,
} from "@/db/schema";
import {
  assertTransition,
  safeAuditJson,
  type ImportStatus,
} from "./session-lifecycle";
import { iranKetabImportDraftSchema } from "./draft";
import { assertExtractionCollectionLimits, formatIranKetabSchemaIssues } from "./collection-limits";
export { IMPORT_STATUSES, classifyRetryable } from "./session-lifecycle";
export type { ImportStatus } from "./session-lifecycle";

export type ImportEventType =
  | "SESSION_CREATED"
  | "EXTRACTION_STARTED"
  | "EXTRACTION_COMPLETED"
  | "DRAFT_SAVED"
  | "COVER_PREPARATION_STARTED"
  | "COVER_PREPARATION_COMPLETED"
  | "CONTRIBUTOR_STEP_STARTED"
  | "CONTRIBUTOR_PROFILE_FETCH_STARTED"
  | "CONTRIBUTOR_PROFILE_FETCH_COMPLETED"
  | "CONTRIBUTOR_MATCHED"
  | "CONTRIBUTOR_CREATED"
  | "CONTRIBUTOR_UPDATED"
  | "CONTRIBUTOR_IGNORED"
  | "CONTRIBUTOR_IMAGE_STAGED"
  | "CONTRIBUTOR_FAILED"
  | "CONTRIBUTOR_STEP_COMPLETED"
  | "COMMIT_STARTED"
  | "COMMIT_COMPLETED"
  | "COMMIT_FAILED";

export function extractionFingerprint(extraction: unknown) {
  return createHash("sha256").update(JSON.stringify(extraction)).digest("hex");
}
export async function appendImportEvent(
  sessionId: string,
  type: ImportEventType,
  metadata?: unknown,
) {
  await db
    .insert(IranKetabImportEvent)
    .values({ sessionId, type, metadata: safeAuditJson(metadata) });
}
export async function createImportSession(input: {
  adminId: string;
  sourceUrl: string;
  canonicalSourceUrl: string;
  metadata?: Record<string, unknown>;
}) {
  const [session] = await db
    .insert(IranKetabImportSession)
    .values({
      adminId: input.adminId,
      sourceUrl: input.sourceUrl,
      canonicalSourceUrl: input.canonicalSourceUrl,
      metadata: input.metadata ?? {},
    })
    .returning();
  await appendImportEvent(session.id, "SESSION_CREATED", {
    sourceUrl: input.sourceUrl,
  });
  return session;
}
export async function markExtractionStarted(id: string, adminId: string) {
  const session = await transitionImportSession(id, adminId, "EXTRACTING");
  await appendImportEvent(id, "EXTRACTION_STARTED");
  return { ...session, status: "EXTRACTING" as const };
}
export async function transitionImportSession(
  id: string,
  adminId: string,
  next: ImportStatus,
  patch: Record<string, unknown> = {},
  event?: ImportEventType,
  eventMetadata?: unknown,
) {
  const [current] = await db
    .select({ status: IranKetabImportSession.status })
    .from(IranKetabImportSession)
    .where(
      and(
        eq(IranKetabImportSession.id, id),
        eq(IranKetabImportSession.adminId, adminId),
      ),
    )
    .limit(1);
  if (!current) throw new Error("SESSION_NOT_FOUND");
  assertTransition(current.status, next);
  const [updated] = await db
    .update(IranKetabImportSession)
    .set({ ...patch, status: next, updatedAt: new Date() })
    .where(
      and(
        eq(IranKetabImportSession.id, id),
        eq(IranKetabImportSession.adminId, adminId),
        eq(IranKetabImportSession.status, current.status),
      ),
    )
    .returning();
  if (!updated) throw new Error("SESSION_CONCURRENT_UPDATE");
  if (event) await appendImportEvent(id, event, eventMetadata);
  return updated;
}
export async function saveImportDraft(
  id: string,
  adminId: string,
  input: {
    draft: unknown;
    extraction?: unknown;
    preparedCovers?: unknown[];
    fingerprint?: string;
  },
) {
  const parsedDraft = iranKetabImportDraftSchema.safeParse(input.draft);
  if (!parsedDraft.success) throw new Error(formatIranKetabSchemaIssues(parsedDraft.error).join(" "));
  if (input.extraction) assertExtractionCollectionLimits(input.extraction as Parameters<typeof assertExtractionCollectionLimits>[0]);
  const [session] = await db
    .select()
    .from(IranKetabImportSession)
    .where(
      and(
        eq(IranKetabImportSession.id, id),
        eq(IranKetabImportSession.adminId, adminId),
      ),
    )
    .limit(1);
  if (!session) throw new Error("SESSION_NOT_FOUND");
  if (
    ![
      "PREVIEW_READY",
      "DRAFT_REVIEW",
      "COVER_PREPARATION",
      "READY_TO_COMMIT",
      "FAILED",
    ].includes(session.status)
  )
    throw new Error("SESSION_NOT_EDITABLE");
  const [updated] = await db
    .update(IranKetabImportSession)
    .set({
      draft: safeAuditJson(parsedDraft.data),
      extraction: input.extraction
        ? safeAuditJson(input.extraction)
        : session.extraction,
      preparedCovers: input.preparedCovers?.map(
        (item) => safeAuditJson(item) ?? {},
      ),
      extractionFingerprint: input.fingerprint ?? session.extractionFingerprint,
      draftVersion:
        Number((input.draft as { draftVersion?: number })?.draftVersion) || 1,
      status: "DRAFT_REVIEW",
      updatedAt: new Date(),
    })
    .where(eq(IranKetabImportSession.id, id))
    .returning();
  await appendImportEvent(id, "DRAFT_SAVED", {
    draftVersion: updated.draftVersion,
  });
  return updated;
}

/** Persist a validated, prepared draft without changing the current lifecycle state. */
export async function persistPreparedImportDraft(
  id: string,
  adminId: string,
  input: { draft: unknown; extraction: unknown; preparedCovers: unknown[]; fingerprint: string },
) {
  const parsedDraft = iranKetabImportDraftSchema.safeParse(input.draft);
  if (!parsedDraft.success) throw new Error(formatIranKetabSchemaIssues(parsedDraft.error).join(" "));
  assertExtractionCollectionLimits(input.extraction as Parameters<typeof assertExtractionCollectionLimits>[0]);
  const [updated] = await db.update(IranKetabImportSession)
    .set({
      draft: safeAuditJson(parsedDraft.data),
      extraction: safeAuditJson(input.extraction),
      preparedCovers: input.preparedCovers.map((item) => safeAuditJson(item) ?? {}),
      extractionFingerprint: input.fingerprint,
      draftVersion: parsedDraft.data.draftVersion,
      updatedAt: new Date(),
    })
    .where(and(eq(IranKetabImportSession.id, id), eq(IranKetabImportSession.adminId, adminId)))
    .returning();
  if (!updated) throw new Error("SESSION_NOT_FOUND");
  return updated;
}
export async function getRecoverableSession(adminId: string) {
  const terminal: ImportStatus[] = ["SUCCESS", "CANCELLED"];
  const [row] = await db
    .select()
    .from(IranKetabImportSession)
    .where(
      and(
        eq(IranKetabImportSession.adminId, adminId),
        sql`${IranKetabImportSession.status} not in (${sql.join(
          terminal.map((x) => sql`${x}`),
          sql`, `,
        )})`,
      ),
    )
    .orderBy(desc(IranKetabImportSession.updatedAt))
    .limit(1);
  return row ?? null;
}

export async function cancelImportSession(id: string, adminId: string) {
  const [session] = await db
    .select({ status: IranKetabImportSession.status })
    .from(IranKetabImportSession)
    .where(and(eq(IranKetabImportSession.id, id), eq(IranKetabImportSession.adminId, adminId)))
    .limit(1);
  if (!session) throw new Error("SESSION_NOT_FOUND");
  if (session.status === "CANCELLED" || session.status === "SUCCESS") return;
  assertTransition(session.status, "CANCELLED");
  await db.update(IranKetabImportSession).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(IranKetabImportSession.id, id));
}
export async function assertOwnedImportSession(id: string, adminId: string) {
  const [row] = await db
    .select({ id: IranKetabImportSession.id })
    .from(IranKetabImportSession)
    .where(
      and(
        eq(IranKetabImportSession.id, id),
        eq(IranKetabImportSession.adminId, adminId),
      ),
    )
    .limit(1);
  if (!row) throw new Error("SESSION_NOT_FOUND");
  return row;
}
export async function getImportSession(id: string) {
  const [session] = await db
    .select({
      session: IranKetabImportSession,
      adminName: User.name,
      adminEmail: User.email,
    })
    .from(IranKetabImportSession)
    .leftJoin(User, eq(User.id, IranKetabImportSession.adminId))
    .where(eq(IranKetabImportSession.id, id))
    .limit(1);
  if (!session) return null;
  const events = await db
    .select()
    .from(IranKetabImportEvent)
    .where(eq(IranKetabImportEvent.sessionId, id))
    .orderBy(IranKetabImportEvent.createdAt);
  return { ...session, events };
}
export async function listImportSessions(input: {
  page: number;
  status?: ImportStatus;
  adminId?: string;
  source?: string;
  q?: string;
  from?: Date;
  to?: Date;
}) {
  const filters: SQL[] = [];
  if (input.status)
    filters.push(eq(IranKetabImportSession.status, input.status));
  if (input.adminId)
    filters.push(eq(IranKetabImportSession.adminId, input.adminId));
  if (input.source)
    filters.push(eq(IranKetabImportSession.sourceName, input.source));
  if (input.from)
    filters.push(sql`${IranKetabImportSession.createdAt} >= ${input.from}`);
  if (input.to)
    filters.push(sql`${IranKetabImportSession.createdAt} <= ${input.to}`);
  if (input.q)
    filters.push(
      or(
        ilike(IranKetabImportSession.sourceUrl, `%${input.q}%`),
        ilike(IranKetabImportSession.canonicalSourceUrl, `%${input.q}%`),
        sql`${IranKetabImportSession.resultSummary}->>'catalogTitle' ilike ${`%${input.q}%`}`,
      )!,
    );
  const where = filters.length ? and(...filters) : undefined;
  const pageSize = 20;
  const [rows, count] = await Promise.all([
    db
      .select({
        session: IranKetabImportSession,
        adminName: User.name,
        adminEmail: User.email,
      })
      .from(IranKetabImportSession)
      .leftJoin(User, eq(User.id, IranKetabImportSession.adminId))
      .where(where)
      .orderBy(desc(IranKetabImportSession.createdAt))
      .limit(pageSize)
      .offset((input.page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(IranKetabImportSession)
      .where(where),
  ]);
  return { rows, total: count[0]?.count ?? 0, page: input.page, pageSize };
}
