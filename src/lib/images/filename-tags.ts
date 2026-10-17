import { normalizeTag } from "./tags";

/**
 * Words that appear in camera/phone/export filenames but say nothing about the subject
 * ("IMG_0042.jpg", "DSC01234 copy.jpg", "Screenshot 2026-10-17.png"), plus a few stop words.
 */
const NOISE = new Set([
  "img",
  "image",
  "images",
  "dsc",
  "dscf",
  "dscn",
  "mg",
  "pxl",
  "gopr",
  "dji",
  "mvimg",
  "photo",
  "photos",
  "pic",
  "pics",
  "picture",
  "screenshot",
  "screen",
  "shot",
  "copy",
  "edit",
  "edited",
  "final",
  "export",
  "exported",
  "untitled",
  "scan",
  "jpg",
  "jpeg",
  "heic",
  "heif",
  "png",
  "tif",
  "tiff",
  "webp",
  "raw",
  "the",
  "and",
  "for",
  "with",
  "from",
]);

const MIN_WORD_LENGTH = 3;
const MAX_SUGGESTIONS = 3;

/** Meaningful lower-case words in a filename or relative path, in order. Numbers are dropped. */
export function filenameWords(pathOrName: string): string[] {
  const segments = pathOrName.split(/[\\/]/).filter(Boolean);
  if (segments.length === 0) return [];
  const last = segments.length - 1;
  segments[last] = segments[last].replace(/\.[^.]{1,10}$/, ""); // extension
  return segments
    .flatMap((s) => s.replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2").split(/[^\p{L}]+/u))
    .map((w) => w.toLowerCase())
    .filter((w) => w.length >= MIN_WORD_LENGTH && !NOISE.has(w));
}

/**
 * Tags suggested by words every file in a batch has in common, e.g. "Launch Party/IMG_01.jpg" and
 * "Launch Party/IMG_02.jpg" → ["launch party"]. Common words that sit next to each other in the
 * first name become one phrase. Needs at least two files; returns [] when nothing is shared.
 */
export function suggestTagsFromNames(names: string[]): string[] {
  if (names.length < 2) return [];
  const [first, ...rest] = names.map(filenameWords);
  const common = new Set(first.filter((w) => rest.every((words) => words.includes(w))));
  if (common.size === 0) return [];

  // Each word joins at most one phrase, so a folder and file both named "Harbour Festival"
  // give "harbour festival" once rather than also "festival".
  const phrases: string[] = [];
  const used = new Set<string>();
  let run: string[] = [];
  const flush = () => {
    const tag = normalizeTag(run.join(" "));
    if (tag && !phrases.includes(tag)) phrases.push(tag);
    run = [];
  };
  for (const word of first) {
    if (common.has(word) && !used.has(word)) {
      run.push(word);
      used.add(word);
    } else if (run.length) flush();
  }
  if (run.length) flush();
  return phrases.slice(0, MAX_SUGGESTIONS);
}
