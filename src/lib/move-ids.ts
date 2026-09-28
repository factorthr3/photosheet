/**
 * Move `imageIds` (kept in the given order) to just before `beforeId` or just after `afterId`.
 * With neither, they move to the end.
 */
export function moveIds(
  order: string[],
  imageIds: string[],
  target: { beforeId?: string | null; afterId?: string | null },
): string[] {
  const moving = new Set(imageIds);
  const moved = imageIds.filter((id) => order.includes(id));
  const rest = order.filter((id) => !moving.has(id));
  let at = rest.length;
  if (target.beforeId && !moving.has(target.beforeId)) {
    const i = rest.indexOf(target.beforeId);
    if (i !== -1) at = i;
  } else if (target.afterId && !moving.has(target.afterId)) {
    const i = rest.indexOf(target.afterId);
    if (i !== -1) at = i + 1;
  }
  return [...rest.slice(0, at), ...moved, ...rest.slice(at)];
}
