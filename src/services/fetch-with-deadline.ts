export interface FetchWithDeadlineInit extends RequestInit {
  readonly deadlineMs: number;
}

export async function fetchWithDeadline(
  input: RequestInfo | URL,
  { deadlineMs, signal: callerSignal, ...init }: FetchWithDeadlineInit,
): Promise<Response> {
  const controller = new AbortController();
  const onCallerAbort = () => controller.abort(callerSignal?.reason);

  if (callerSignal?.aborted) onCallerAbort();
  else callerSignal?.addEventListener('abort', onCallerAbort, { once: true });

  const timer = globalThis.setTimeout(() => {
    controller.abort(new DOMException('Request deadline exceeded', 'TimeoutError'));
  }, deadlineMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timer);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  }
}
