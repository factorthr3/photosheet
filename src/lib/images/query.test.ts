import { describe, expect, it } from "vitest";
import {
  buildOrderBy,
  buildWhere,
  cursorWhere,
  decodeCursor,
  encodeCursor,
  parseFilters,
} from "./query";

const row = {
  id: "0b0e6b3e-1111-4111-8111-111111111111",
  createdAt: new Date("2026-09-01T10:00:00Z"),
  takenAt: new Date("2025-06-01T08:30:00Z"),
  filename: "beach.jpg",
};

describe("parseFilters", () => {
  it("applies defaults", () => {
    const f = parseFilters({});
    expect(f).toMatchObject({ q: "", tags: [], sort: "uploaded_desc", dateField: "uploaded" });
  });

  it("parses tags and trims search", () => {
    const f = parseFilters(
      new URLSearchParams("q=%20sunset%20&tags=beach,%20summer,&sort=name_asc"),
    );
    expect(f.q).toBe("sunset");
    expect(f.tags).toEqual(["beach", "summer"]);
    expect(f.sort).toBe("name_asc");
  });

  it("rejects bad values", () => {
    expect(() => parseFilters({ sort: "random" })).toThrow();
    expect(() => parseFilters({ from: "yesterday" })).toThrow();
  });
});

describe("buildWhere", () => {
  it("always scopes to the org and excludes trashed/incomplete uploads", () => {
    const where = buildWhere("org_1", parseFilters({}));
    expect(where.AND).toContainEqual({
      orgId: "org_1",
      deletedAt: null,
      status: { in: ["PROCESSING", "READY", "FAILED"] },
    });
  });

  it("makes the date range inclusive of the end day", () => {
    const where = buildWhere(
      "o",
      parseFilters({ from: "2026-01-01", to: "2026-01-31", dateField: "taken" }),
    );
    expect(where.AND).toContainEqual({
      takenAt: {
        gte: new Date("2026-01-01T00:00:00.000Z"),
        lt: new Date("2026-02-01T00:00:00.000Z"),
      },
    });
  });

  it("lowercases tag filters", () => {
    const where = buildWhere("o", parseFilters({ tags: "Beach" }));
    expect(where.AND).toContainEqual({ tags: { hasEvery: ["beach"] } });
  });

  it("filters expired licences relative to now", () => {
    const now = new Date("2026-09-28T00:00:00Z");
    const where = buildWhere("o", parseFilters({ licence: "expired" }), now);
    expect(where.AND).toContainEqual({ licenceExpiresAt: { lte: now } });
  });
});

describe("cursors", () => {
  it("round-trips and is bound to its sort", () => {
    const c = encodeCursor("taken_desc", row);
    expect(decodeCursor("taken_desc", c)).toEqual([
      "2025-06-01T08:30:00.000Z",
      "2026-09-01T10:00:00.000Z",
      row.id,
    ]);
    expect(decodeCursor("uploaded_desc", c)).toBeNull();
    expect(decodeCursor("taken_desc", "not-a-cursor")).toBeNull();
  });

  it("builds a keyset condition for a simple sort", () => {
    const values = decodeCursor("uploaded_desc", encodeCursor("uploaded_desc", row))!;
    expect(cursorWhere("uploaded_desc", values)).toEqual({
      OR: [
        { AND: [{ createdAt: { lt: row.createdAt } }] },
        { AND: [{ createdAt: row.createdAt }, { id: { lt: row.id } }] },
      ],
    });
  });

  it("includes null takenAt rows after the last dated row (nulls last)", () => {
    const values = decodeCursor("taken_desc", encodeCursor("taken_desc", row))!;
    const where = cursorWhere("taken_desc", values);
    expect(where.OR![0]).toEqual({
      AND: [{ OR: [{ takenAt: { lt: row.takenAt } }, { takenAt: null }] }],
    });
  });

  it("only continues within nulls once the cursor is in the null section", () => {
    const undated = { ...row, takenAt: null };
    const values = decodeCursor("taken_desc", encodeCursor("taken_desc", undated))!;
    const where = cursorWhere("taken_desc", values);
    expect(where.OR).toEqual([
      { AND: [{ takenAt: null }, { createdAt: { lt: row.createdAt } }] },
      { AND: [{ takenAt: null }, { createdAt: row.createdAt }, { id: { lt: row.id } }] },
    ]);
  });

  it("orders nullable keys with nulls last", () => {
    expect(buildOrderBy("taken_asc")).toEqual([
      { takenAt: { sort: "asc", nulls: "last" } },
      { createdAt: "asc" },
      { id: "asc" },
    ]);
  });
});

describe("filtersToSearchParams", async () => {
  const { filtersToSearchParams, activeFilterCount } = await import("./filters");
  it("omits defaults and round-trips through parseFilters", () => {
    const f = parseFilters({
      q: "beach",
      tags: "a,b",
      sort: "uploaded_desc",
      orientation: "portrait",
    });
    const params = filtersToSearchParams(f);
    expect(params.toString()).toBe("orientation=portrait&q=beach&tags=a%2Cb");
    expect(parseFilters(params)).toEqual(f);
  });
  it("drops dateField when there is no date range", () => {
    expect(filtersToSearchParams(parseFilters({ dateField: "taken" })).toString()).toBe("");
    expect(
      filtersToSearchParams(parseFilters({ dateField: "taken", from: "2026-01-01" })).toString(),
    ).toBe("dateField=taken&from=2026-01-01");
  });
  it("counts active filters", () => {
    expect(activeFilterCount(parseFilters({ tags: "a,b", uploader: "u", q: "x" }))).toBe(3);
  });
});
