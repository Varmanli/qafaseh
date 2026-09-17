import { eq } from "drizzle-orm";

import { db } from "@/db";
import { User } from "@/db/schema";
import { processPublisherImportQueue } from "./import-queue";
import { runScheduledDiscovery } from "./scheduler";
import { getActiveIranKetabPublisherImport } from "./source-service";

const WORKER_INTERVAL_MS = 5_000;
const WORKER_STATE_KEY = Symbol.for("qafaseh.iranketab.publisher-worker");

type WorkerState = { timer?: ReturnType<typeof setInterval>; running: boolean };

function workerState() {
  const globalState = globalThis as typeof globalThis & { [WORKER_STATE_KEY]?: WorkerState };
  return globalState[WORKER_STATE_KEY] ??= { running: false };
}

/** Starts once per Node process; PostgreSQL leases keep multiple app instances safe. */
export function startIranKetabBackgroundWorker() {
  const state = workerState();
  if (state.timer) return;
  state.timer = setInterval(() => void runPublisherWorker(), WORKER_INTERVAL_MS);
  state.timer.unref?.();
  void runPublisherWorker();
}

async function runPublisherWorker() {
  const state = workerState();
  if (state.running) return;
  state.running = true;
  try {
    await runScheduledDiscovery();
    const active = await getActiveIranKetabPublisherImport();
    if (!active) return;
    const [admin] = await db
      .select({ id: User.id })
      .from(User)
      .where(eq(User.role, "ADMIN"))
      .limit(1);
    if (!admin) {
      console.error("[iranketab-background-worker] no admin actor is available");
      return;
    }
    const result = await processPublisherImportQueue(
      active.id,
      `background-publisher:${process.pid}`,
      admin.id,
      1,
    );
    if (result.processed || result.repaired) {
      console.info("[iranketab-background-worker] publisher tick", {
        sourceId: active.id,
        processed: result.processed,
        repaired: result.repaired,
        state: result.state,
      });
    }
  } catch (error) {
    console.error("[iranketab-background-worker] tick failed", {
      code: error instanceof Error && "code" in error ? error.code : "BACKGROUND_WORKER_FAILED",
      message: error instanceof Error ? error.message : "unknown error",
    });
  } finally {
    state.running = false;
  }
}
