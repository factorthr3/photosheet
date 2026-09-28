/** Only allow same-site relative redirects (prevents open redirects via ?next=). */
export function safeNext(next: string | string[] | undefined | null, fallback = "/app"): string {
  const value = Array.isArray(next) ? next[0] : next;
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
