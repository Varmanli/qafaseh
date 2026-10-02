import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// اگر DATABASE_URL تنظیم نشده باشد، pg با خطای مبهم SASL کرش می‌کند؛
// این بررسی یک پیام واضح برای توسعه‌دهنده می‌دهد.
if (!process.env.DATABASE_URL) {
  throw new Error(
    "[db] متغیر محیطی DATABASE_URL تنظیم نشده است. " +
      "رشته‌ی اتصال PostgreSQL را در فایل .env قرار دهید (نمونه را در .env.example ببینید)."
  );
}

// Reuse the pool across development reloads instead of opening more connections.
const globalForDb = globalThis as typeof globalThis & { ghafasehPool?: Pool };
const pool = globalForDb.ghafasehPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
});
if (process.env.NODE_ENV !== "production") globalForDb.ghafasehPool = pool;

// اتصال Drizzle به دیتابیس با schema
export const db = drizzle(pool, { schema });

/** Safe to log: identifies the database target without exposing credentials. */
export function databaseDiagnosticTarget() {
  try {
    const url = new URL(process.env.DATABASE_URL!);
    return `${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
  } catch {
    return "unavailable";
  }
}

// اگه جایی لازم داشتی raw query بزنی
export { pool };
