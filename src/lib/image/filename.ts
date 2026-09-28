/** Normalise a user-supplied filename for storage and display (no paths, no control chars). */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  if (!cleaned || cleaned === "." || cleaned === "..") return "untitled";
  if (cleaned.length <= 200) return cleaned;
  const dot = cleaned.lastIndexOf(".");
  const ext = dot > 0 && cleaned.length - dot <= 10 ? cleaned.slice(dot) : "";
  return cleaned.slice(0, 200 - ext.length) + ext;
}
