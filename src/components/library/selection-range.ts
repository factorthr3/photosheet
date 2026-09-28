/** Inclusive slice of `ids` between `anchor` and `target` (order-independent). */
export function rangeBetween(ids: string[], anchor: string, target: string): string[] {
  const a = ids.indexOf(anchor);
  const b = ids.indexOf(target);
  if (b === -1) return [];
  if (a === -1) return [target];
  const [start, end] = a < b ? [a, b] : [b, a];
  return ids.slice(start, end + 1);
}
