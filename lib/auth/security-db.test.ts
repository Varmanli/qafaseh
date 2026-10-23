import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

// Opt in only against a disposable local database prepared from db/schema.ts.
test("security transactions resist concurrent abuse", { skip: !process.env.SECURITY_TEST_DATABASE_URL }, async (t) => {
  const url = new URL(process.env.SECURITY_TEST_DATABASE_URL!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
  assert.equal(url.pathname, "/ghafaseh_security_test");
  process.env.DATABASE_URL = url.toString();
  process.env.EMAIL_DEV_MODE = "true";
  process.env.EMAIL_MODE = "dev";
  process.env.JWT_SECRET = "isolated-security-test-secret-at-least-32-characters";
  for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM"]) delete process.env[key];
  const { db, pool } = await import("@/db");
  const recoveryColumn = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name = 'PasswordResetToken' AND column_name = 'verification_method'");
  if (!recoveryColumn.rowCount) await pool.query(readFileSync("drizzle/0078_sms_signup_recovery.sql", "utf8"));
  const { User, PasswordResetToken, VerificationCode } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const { hashPassword, verifyPassword } = await import("./password");
  const { resetPassword, changePassword, findOrCreateGoogleUser } = await import("./service");
  const { generateResetToken } = await import("./tokens");
  const { issueVerificationCode, verifyVerificationCode } = await import("./verification-codes");
  const { sharedRateLimit } = await import("@/lib/rate-limit");
  const id = randomUUID();
  const email = `security-${id}@example.test`;
  const password = await hashPassword("original-password123");
  await db.insert(User).values({ id, email, username: `test-${id.slice(0, 8)}`, password, passwordHash: password });
  try {
    await t.test("new rate-limit migration applies and concurrent requests share an atomic allowance", async () => {
      await pool.query('DROP TABLE "SecurityRateLimit"');
      await pool.query(readFileSync("drizzle/0076_security_rate_limits.sql", "utf8"));
      const key = `test:${randomUUID()}`;
      const results = await Promise.all(Array.from({ length: 30 }, () => sharedRateLimit(key, { limit: 5 })));
      assert.equal(results.filter((result) => result.allowed).length, 5);
      const script = `import {sharedRateLimit} from './lib/rate-limit'; import {pool} from './db'; (async()=>{console.log(JSON.stringify(await sharedRateLimit(${JSON.stringify(key)},{limit:5})));await pool.end()})()`;
      const result = execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "-e", script], { encoding: "utf8", timeout: 15_000 });
      assert.equal(JSON.parse(result.trim()).allowed, false, "a new process cannot reset the limit");
      const hash = createHash("sha256").update(key).digest("hex");
      await pool.query('UPDATE "SecurityRateLimit" SET reset_at = clock_timestamp() - interval \'1 second\' WHERE key = $1', [hash]);
      assert.equal((await sharedRateLimit(key, { limit: 5 })).allowed, true);
      await pool.query('DELETE FROM "SecurityRateLimit" WHERE key = $1', [hash]);
    });

    await t.test("reset token succeeds exactly once under concurrent requests", async () => {
      const token = generateResetToken();
      await db.insert(PasswordResetToken).values({ userId: id, tokenHash: token.tokenHash, expiresAt: new Date(Date.now() + 60_000) });
      const results = await Promise.allSettled(["new-password123", "other-password123"].map((next) => resetPassword({ token: token.token, password: next })));
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      const [user] = await db.select().from(User).where(eq(User.id, id));
      assert.equal(user.sessionVersion, 1);
      const winner = results[0].status === "fulfilled" ? "new-password123" : "other-password123";
      assert.equal(await verifyPassword(winner, user.passwordHash!), true);
      const staleReset = generateResetToken();
      await db.insert(PasswordResetToken).values({ userId: id, tokenHash: staleReset.tokenHash, expiresAt: new Date(Date.now() + 60_000) });
      const changes = await Promise.allSettled(["changed-password123", "racing-password123"].map((next) => changePassword(id, winner, next)));
      assert.equal(changes.filter((result) => result.status === "fulfilled").length, 1);
      const [updated] = await db.select().from(User).where(eq(User.id, id));
      assert.equal(updated.sessionVersion, 2);
      await assert.rejects(resetPassword({ token: staleReset.token, password: "stolen-reset123" }));
    });

    await t.test("parallel OTP issuance creates one code and parallel verification consumes it once", async () => {
      await db.update(User).set({ emailVerified: new Date() }).where(eq(User.id, id));
      const issued = await Promise.allSettled(Array.from({ length: 8 }, () => issueVerificationCode({ email, purpose: "login", requireVerifiedUser: true })));
      const successful = issued.filter((result) => result.status === "fulfilled");
      assert.equal(successful.length, 1);
      const code = (successful[0] as PromiseFulfilledResult<{ devCode?: string }>).value.devCode!;
      assert.match(code, /^\d{6}$/);
      const results = await Promise.allSettled(Array.from({ length: 8 }, () => verifyVerificationCode({ email, code, purpose: "login" })));
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      const rows = await db.select().from(VerificationCode).where(and(eq(VerificationCode.email, email), eq(VerificationCode.purpose, "login")));
      assert.equal(rows.length, 1);
      assert.ok(rows[0].consumedAt);
      assert.notEqual(rows[0].codeHash, createHash("sha256").update(`${email}:login:${code}`).digest("hex"));
    });

    await t.test("parallel wrong OTP guesses cannot bypass the five-attempt ceiling", async () => {
      const codeHash = createHmac("sha256", process.env.JWT_SECRET!).update(`email-otp:${email}:password_reset:123456`).digest("hex");
      await db.insert(VerificationCode).values({ email, purpose: "password_reset", codeHash, expiresAt: new Date(Date.now() + 60_000) });
      const results = await Promise.allSettled(Array.from({ length: 12 }, () => verifyVerificationCode({ email, code: "654321", purpose: "password_reset" })));
      assert.ok(results.every((result) => result.status === "rejected"));
      const [record] = await db.select().from(VerificationCode).where(and(eq(VerificationCode.email, email), eq(VerificationCode.purpose, "password_reset")));
      assert.equal(record.attempts, 5);
      assert.ok(record.consumedAt);
      await assert.rejects(verifyVerificationCode({ email, code: "123456", purpose: "password_reset" }));
    });

    await t.test("Google linking revokes passwords and sessions from unverified registrations", async () => {
      await db.update(User).set({ emailVerified: null }).where(eq(User.id, id));
      const token = generateResetToken();
      await db.insert(PasswordResetToken).values({ userId: id, tokenHash: token.tokenHash, expiresAt: new Date(Date.now() + 60_000) });
      const result = await findOrCreateGoogleUser({ email, googleId: `google-${id}`, name: "Real owner" });
      const [user] = await db.select().from(User).where(eq(User.id, id));
      assert.equal(user.password, null);
      assert.equal(user.passwordHash, null);
      assert.equal(user.authProvider, "google");
      assert.equal(user.sessionVersion, 3);
      assert.equal(result.sessionVersion, 3);
      assert.ok(user.emailVerified);
      const [reset] = await db.select().from(PasswordResetToken).where(eq(PasswordResetToken.tokenHash, token.tokenHash));
      assert.ok(reset.usedAt);
    });

    await t.test("updated spreadsheet parser imports normal files and bounds untrusted rows", async () => {
      const XLSX = await import("xlsx");
      const { parseImportFile } = await import("@/lib/books/import/file");
      const { parseImportJson } = await import("@/lib/books/import/parse-json");
      const { mapExcelRowKeys } = await import("@/lib/books/import/normalize");
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ title: "Security book", authors: "Writer", language: "fa" }]), "Books");
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      const books = await parseImportFile(new File([buffer], "books.xlsx"));
      assert.equal(books.length, 1);
      assert.equal(books[0].title, "Security book");
      await assert.rejects(parseImportFile(new File([new Uint8Array(10 * 1024 * 1024 + 1)], "books.xlsx")), /IMPORT_FILE_TOO_LARGE/);
      assert.throws(() => parseImportJson(JSON.stringify(Array.from({ length: 5001 }, () => ({ title: "Book" })))), /IMPORT_TOO_MANY_ROWS/);
      const mapped = mapExcelRowKeys(JSON.parse('{"__proto__":{"polluted":true},"title":"Book"}'));
      assert.equal(Object.getPrototypeOf(mapped), null);
      assert.equal(({} as { polluted?: boolean }).polluted, undefined);
    });
  } finally {
    await db.delete(VerificationCode).where(eq(VerificationCode.email, email));
    await db.delete(User).where(eq(User.id, id));
    await pool.end();
  }
});
