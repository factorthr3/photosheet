import { describe, expect, it } from "vitest";
import { filenameWords, suggestTagsFromNames } from "./filename-tags";

describe("filenameWords", () => {
  it("drops extensions, numbers, camera prefixes and short words", () => {
    expect(filenameWords("IMG_0042.JPG")).toEqual([]);
    expect(filenameWords("DSC01234 copy.jpg")).toEqual([]);
    expect(filenameWords("Acme_Launch-2026-10-17_014.heic")).toEqual(["acme", "launch"]);
    expect(filenameWords("NY at night.jpg")).toEqual(["night"]);
  });

  it("splits camelCase and keeps folder names from relative paths", () => {
    expect(filenameWords("SummerParty/BeachDay_01.png")).toEqual([
      "summer",
      "party",
      "beach",
      "day",
    ]);
    expect(filenameWords("Trip\\Day1\\a.jpg")).toEqual(["trip", "day"]);
  });

  it("keeps accented letters", () => {
    expect(filenameWords("Café_Zürich_01.jpg")).toEqual(["café", "zürich"]);
  });
});

describe("suggestTagsFromNames", () => {
  it("needs at least two files", () => {
    expect(suggestTagsFromNames(["Launch_Event_01.jpg"])).toEqual([]);
  });

  it("joins adjacent shared words into one phrase", () => {
    expect(
      suggestTagsFromNames(["Launch_Event_001.jpg", "Launch_Event_002.jpg", "launch-event-3.png"]),
    ).toEqual(["launch event"]);
  });

  it("splits shared words that aren't adjacent", () => {
    expect(
      suggestTagsFromNames([
        "Smith_Wedding_Ceremony_Rings.jpg",
        "Smith_Wedding_Reception_Rings.jpg",
      ]),
    ).toEqual(["smith wedding", "rings"]);
  });

  it("uses the folder name when filenames are just camera numbers", () => {
    expect(
      suggestTagsFromNames([
        "Launch Party/IMG_0001.JPG",
        "Launch Party/IMG_0002.JPG",
        "Launch Party/Extras/DSC_9.jpg",
      ]),
    ).toEqual(["launch party"]);
  });

  it("doesn't repeat words when the folder and file names say the same thing", () => {
    expect(
      suggestTagsFromNames([
        "Harbour Festival 2026/Harbour_Festival_1.jpg",
        "Harbour Festival 2026/Harbour_Festival_2.jpg",
      ]),
    ).toEqual(["harbour festival"]);
  });

  it("returns nothing when only noise or nothing is shared", () => {
    expect(suggestTagsFromNames(["IMG_0001.jpg", "IMG_0002.jpg"])).toEqual([]);
    expect(suggestTagsFromNames(["beach.jpg", "mountain.jpg"])).toEqual([]);
  });

  it("is case-insensitive and caps the number of suggestions", () => {
    expect(
      suggestTagsFromNames([
        "Alpha one Beta two Gamma six Delta.jpg",
        "ALPHA-BETA-GAMMA-DELTA.jpg",
      ]),
    ).toEqual(["alpha", "beta", "gamma"]);
  });
});
