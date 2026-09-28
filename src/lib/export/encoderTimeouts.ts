export const ENCODER_STALLED_MSG = 'The video encoder stopped responding. Please keep this tab open and try again, or try Chrome/Edge on a computer.';

/** Rejects with `message` if `promise` hasn't settled within `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** `encoder.flush()` with a timeout — some hardware encoders never resolve it. */
export async function flushEncoder(encoder: { flush(): Promise<void>; close(): void; state: string }, ms = 60_000): Promise<void> {
  try {
    await withTimeout(encoder.flush(), ms, ENCODER_STALLED_MSG);
  } catch (e) {
    if (encoder.state !== 'closed') {
      try { encoder.close(); } catch { /* already closed */ }
    }
    throw e;
  }
}
