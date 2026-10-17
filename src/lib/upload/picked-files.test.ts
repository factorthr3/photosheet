import { describe, expect, it } from "vitest";
import { collectDroppedFiles, fromFileList, isHiddenPath } from "./picked-files";

const file = (name: string) => new File(["x"], name, { type: "image/jpeg" });

/** Minimal FileSystemEntry fakes; readEntries hands out children two at a time like browsers. */
function fileEntry(fullPath: string): FileSystemEntry {
  const name = fullPath.split("/").pop()!;
  return {
    isFile: true,
    isDirectory: false,
    name,
    fullPath,
    file: (ok: (f: File) => void) => ok(file(name)),
  } as unknown as FileSystemEntry;
}

function dirEntry(fullPath: string, children: FileSystemEntry[]): FileSystemEntry {
  return {
    isFile: false,
    isDirectory: true,
    name: fullPath.split("/").pop()!,
    fullPath,
    createReader: () => {
      let i = 0;
      return {
        readEntries: (ok: (batch: FileSystemEntry[]) => void) => {
          const batch = children.slice(i, i + 2);
          i += 2;
          queueMicrotask(() => ok(batch)); // browsers call back asynchronously
        },
      };
    },
  } as unknown as FileSystemEntry;
}

function dataTransfer(entries: (FileSystemEntry | null)[], files: File[] = []): DataTransfer {
  return {
    items: entries.map((entry) => ({ kind: "file", webkitGetAsEntry: () => entry })),
    files,
  } as unknown as DataTransfer;
}

describe("fromFileList", () => {
  it("uses the folder-relative path when there is one", () => {
    const inFolder = file("a.jpg");
    Object.defineProperty(inFolder, "webkitRelativePath", { value: "Launch/a.jpg" });
    expect(fromFileList([inFolder, file("b.jpg")]).map((p) => p.path)).toEqual([
      "Launch/a.jpg",
      "b.jpg",
    ]);
  });
});

describe("isHiddenPath", () => {
  it("flags dot files and anything inside dot folders", () => {
    expect(isHiddenPath("Launch/.DS_Store")).toBe(true);
    expect(isHiddenPath("Launch/._IMG_1.jpg")).toBe(true);
    expect(isHiddenPath(".thumbs/a.jpg")).toBe(true);
    expect(isHiddenPath("Launch/IMG_1.jpg")).toBe(false);
  });
});

describe("collectDroppedFiles", () => {
  it("walks nested folders, reading every batch of entries", async () => {
    const dt = dataTransfer([
      dirEntry("/Launch", [
        fileEntry("/Launch/1.jpg"),
        fileEntry("/Launch/2.jpg"),
        fileEntry("/Launch/3.jpg"),
        dirEntry("/Launch/Extras", [fileEntry("/Launch/Extras/4.jpg")]),
      ]),
      fileEntry("/loose.jpg"),
    ]);
    const { files, fromFolder } = await collectDroppedFiles(dt);
    expect(fromFolder).toBe(true);
    expect(files.map((f) => f.path)).toEqual([
      "Launch/1.jpg",
      "Launch/2.jpg",
      "Launch/3.jpg",
      "Launch/Extras/4.jpg",
      "loose.jpg",
    ]);
    expect(files[3].file.name).toBe("4.jpg");
  });

  it("falls back to plain files when entries aren't available", async () => {
    const dt = dataTransfer([null], [file("a.jpg")]);
    expect(await collectDroppedFiles(dt)).toEqual({
      files: [{ file: expect.any(File), path: "a.jpg" }],
      fromFolder: false,
    });
  });
});
