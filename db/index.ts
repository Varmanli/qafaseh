import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { getPoolConfig } from "./pool-config";

// اگر DATABASE_URL تنظیم نشده باشد، pg با خطای مبهم SASL کرش می‌کند؛
// این بررسی یک پیام واضح برای توسعه‌دهنده می‌دهد.
if (!process.env.DATABASE_URL) {
  throw new Error(
    "[db] متغیر محیطی DATABASE_URL تنظیم نشده است. " +
      "رشته‌ی اتصال PostgreSQL را در فایل .env قرار دهید (نمونه را در .env.example ببینید)."
  );
}

// Share one bounded pool per process, including separately bundled server modules.
const globalForDb = globalThis as typeof globalThis & { ghafasehPool?: Pool };
const pool = globalForDb.ghafasehPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  ...getPoolConfig(),
});
if (!globalForDb.ghafasehPool) {
  globalForDb.ghafasehPool = pool;
  pool.on("error", (error: Error & { code?: string }) => {
    console.error("[db] idle connection error", { code: error.code ?? "CONNECTION_ERROR" });
  });
}

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
