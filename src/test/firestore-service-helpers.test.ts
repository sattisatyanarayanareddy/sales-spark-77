import { describe, expect, it } from "vitest";
import { toNonNegativeNumber, validateValueHierarchy } from "@/lib/firestore-service";

describe("firestore service validation helpers", () => {
  it("coerces numeric inputs and rejects negative values", () => {
    expect(toNonNegativeNumber("1000", "Quotation value")).toBe(1000);
    expect(toNonNegativeNumber(undefined, "PO value")).toBe(0);
    expect(() => toNonNegativeNumber(-5, "Invoice value")).toThrow("Invoice value must be greater than or equal to 0");
  });

  it("validates that the value hierarchy is ordered correctly", () => {
    expect(() => validateValueHierarchy(1000, 1200, 0)).toThrow(
      "PO value cannot exceed quotation value"
    );
    expect(() => validateValueHierarchy(1000, 800, 900)).toThrow(
      "Invoice value cannot exceed PO value"
    );
    expect(() => validateValueHierarchy(1000, 800, 700)).not.toThrow();
  });
});
