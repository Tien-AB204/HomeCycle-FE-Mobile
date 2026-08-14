import {
  GENERAL_FILTERS,
  MAIN_CATEGORIES,
  SPECIFIC_FILTERS,
} from "../src/constants/filters";

describe("MAIN_CATEGORIES", () => {
  test("has 3 categories", () => {
    expect(MAIN_CATEGORIES).toHaveLength(3);
  });

  test("every category has non-empty id and label", () => {
    for (const category of MAIN_CATEGORIES) {
      expect(category.id.length).toBeGreaterThan(0);
      expect(category.label.length).toBeGreaterThan(0);
    }
  });

  test("category ids are unique", () => {
    const ids = MAIN_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("GENERAL_FILTERS", () => {
  test("has 5 conditions", () => {
    expect(GENERAL_FILTERS.conditions).toHaveLength(5);
  });

  test("has 4 price ranges", () => {
    expect(GENERAL_FILTERS.priceRanges).toHaveLength(4);
  });

  test("has 2 priorities", () => {
    expect(GENERAL_FILTERS.priorities).toHaveLength(2);
  });
});

describe("SPECIFIC_FILTERS", () => {
  test("covers all main categories", () => {
    for (const category of MAIN_CATEGORIES) {
      expect(SPECIFIC_FILTERS[category.id as keyof typeof SPECIFIC_FILTERS]).toBeDefined();
    }
  });

  test("dien_may has types, brands and hasWarranty", () => {
    expect(SPECIFIC_FILTERS.dien_may.types.length).toBeGreaterThan(0);
    expect(SPECIFIC_FILTERS.dien_may.brands.length).toBeGreaterThan(0);
    expect(SPECIFIC_FILTERS.dien_may.hasWarranty).toEqual([
      "Còn bảo hành",
      "Hết bảo hành",
    ]);
  });

  test("noi_that and sinh_hoat have types, brands and materials", () => {
    for (const key of ["noi_that", "sinh_hoat"] as const) {
      expect(SPECIFIC_FILTERS[key].types.length).toBeGreaterThan(0);
      expect(SPECIFIC_FILTERS[key].brands.length).toBeGreaterThan(0);
      expect(SPECIFIC_FILTERS[key].materials.length).toBeGreaterThan(0);
    }
  });
});