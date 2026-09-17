export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startIranKetabBackgroundWorker } = await import("@/lib/discovery/iranketab/background-worker");
  startIranKetabBackgroundWorker();
}
