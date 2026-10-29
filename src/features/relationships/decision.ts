/** A transport/decoding failure may have committed. Retry its exact request. */
export function uncertainDecision(error: unknown) {
  if (!error) return false;
  const message = typeof error === 'object' && 'message' in error ? String(error.message) : '';
  return !/^(Goal (changed|unavailable|period locked|target below saved|balance below correction|contribution unavailable|limit reached|request changed)|Invalid goal input|Gift exceeds allowance|Expense (unavailable|split changed|split needs partner|split needs income)|Invalid expense split|Budget period locked)$/.test(message);
}
