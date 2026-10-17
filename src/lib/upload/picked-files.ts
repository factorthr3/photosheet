/** A file chosen for upload, with its path relative to the folder it came from (or its name). */
export interface PickedFile {
  file: File;
  path: string;
}

/** Files from an <input type="file">, keeping folder paths when it was a folder picker. */
export function fromFileList(list: FileList | File[]): PickedFile[] {
  return Array.from(list, (file) => ({ file, path: file.webkitRelativePath || file.name }));
}

/** Hidden files (".DS_Store", "._IMG_1.jpg" resource forks) found inside dropped/picked folders. */
export function isHiddenPath(path: string): boolean {
  return path.split("/").some((segment) => segment.startsWith("."));
}

function readAllEntries(dir: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = dir.createReader();
  const all: FileSystemEntry[] = [];
  return new Promise((resolve, reject) => {
    // readEntries returns at most ~100 entries per call; keep reading until it returns none.
    const next = () =>
      reader.readEntries((batch) => {
        if (batch.length === 0) return resolve(all);
        all.push(...batch);
        next();
      }, reject);
    next();
  });
}

async function walk(entry: FileSystemEntry, out: PickedFile[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    );
    out.push({ file, path: entry.fullPath.replace(/^\//, "") });
  } else if (entry.isDirectory) {
    for (const child of await readAllEntries(entry as FileSystemDirectoryEntry)) {
      await walk(child, out);
    }
  }
}

/**
 * Files from a drop, descending into dropped folders. Entries must be taken synchronously inside
 * the drop handler (the DataTransfer is emptied afterwards), so call this before any `await`.
 */
export function collectDroppedFiles(
  dt: DataTransfer,
): Promise<{ files: PickedFile[]; fromFolder: boolean }> {
  const entries = Array.from(dt.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.webkitGetAsEntry?.() ?? null);
  const fallback = fromFileList(dt.files);
  if (entries.length === 0 || entries.some((e) => e === null)) {
    return Promise.resolve({ files: fallback, fromFolder: false });
  }
  return (async () => {
    const files: PickedFile[] = [];
    for (const entry of entries) await walk(entry!, files);
    return { files, fromFolder: entries.some((e) => e!.isDirectory) };
  })();
}
