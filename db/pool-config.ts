function boundedInteger(value: string | undefined, fallback: number, max: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= max ? parsed : fallback;
}

export function getPoolConfig(env: Record<string, string | undefined> = process.env) {
  return {
    max: boundedInteger(env.DB_POOL_MAX, 4, 20),
    connectionTimeoutMillis: boundedInteger(env.DB_CONNECTION_TIMEOUT_MS, 5_000, 60_000),
    idleTimeoutMillis: 10_000,
    statement_timeout: boundedInteger(env.DB_STATEMENT_TIMEOUT_MS, 30_000, 300_000),
  };
}
