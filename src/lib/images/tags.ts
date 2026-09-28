export const MAX_TAGS = 50;
export const MAX_TAG_LENGTH = 64;

/** Tags are case-insensitive: stored trimmed, lower-cased, single-spaced and de-duplicated. */
export function normalizeTag(raw: string): string {
  return raw
    .normalize("NFC")
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .slice(0, MAX_TAG_LENGTH)
    .trim();
}

export function normalizeTags(raw: Iterable<string>): string[] {
  const out: string[] = [];
  for (const r of raw) {
    const t = normalizeTag(r);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/** Split free text like "beach, summer; sunset" into tags. */
export function parseTagInput(text: string): string[] {
  return normalizeTags(text.split(/[,;\n]/));
}
