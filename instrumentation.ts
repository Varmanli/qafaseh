export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.IRANKETAB_DISCOVERY_WORKER_ENABLED === "false") return;
  const { startIranKetabBackgroundWorker } = await import("@/lib/discovery/iranketab/background-worker");
  startIranKetabBackgroundWorker();
}
