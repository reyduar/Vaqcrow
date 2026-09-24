/** Generic bounded poll: retries `read` until `predicate` accepts its value, or throws once `timeoutMs` elapses. */
export async function pollUntil<T>(
  read: () => Promise<T>,
  predicate: (value: T) => boolean,
  options: { readonly timeoutMs?: number; readonly intervalMs?: number; readonly description?: string } = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const intervalMs = options.intervalMs ?? 2_000;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const value = await read();
    if (predicate(value)) return value;
    if (Date.now() >= deadline) {
      throw new Error(`Timed out after ${String(timeoutMs)}ms waiting for ${options.description ?? "condition"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
