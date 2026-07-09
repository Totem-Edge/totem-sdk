import { describe, it, expect } from "vitest";
import { makeMinimaAddress, convertMinimaAddress } from "./index";

describe("Address Tests (matching Java AddressTests)", () => {
  it("testMakeMinimaAddress - should roundtrip various lengths", () => {
    // Test cases from Java AddressTests.testMakeMinimaAddress()
    const testCases = [
      "0xFFFF",
      "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",  // 19 bytes (38 hex chars)
      "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",  // 66 bytes (132 hex chars)
      "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",  // 34 bytes
      "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",  // 20 bytes
      "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"  // 38 bytes
    ];

    for (const hexInput of testCases) {
      console.log(`Testing hex length ${(hexInput.length - 2) / 2} bytes`);
      
      // Make Minima address
      const mxAddress = makeMinimaAddress(hexInput);
      console.log(`  Input:  ${hexInput.slice(0, 20)}...`);
      console.log(`  Output: ${mxAddress}`);
      
      // Convert back
      const converted = convertMinimaAddress(mxAddress);
      
      // Should be equal (case-insensitive comparison since we uppercase on output)
      expect(converted.toUpperCase()).toBe(hexInput.toUpperCase());
      console.log(`  ✓ Roundtrip successful\n`);
    }
  });

  it("should handle MiniData constructor test cases", () => {
    // Test cases from the Java constructor tests
    const testCases = [
      "0xF0F0",
      "0xFFFF",
      "0xFFF0F0"
    ];

    for (const hexInput of testCases) {
      const mxAddress = makeMinimaAddress(hexInput);
      const converted = convertMinimaAddress(mxAddress);
      expect(converted.toUpperCase()).toBe(hexInput.toUpperCase());
    }
  });

  it("should handle empty MiniData", () => {
    // Java test includes new MiniData() which is empty
    const empty = "0x";
    const mxAddress = makeMinimaAddress(empty);
    const converted = convertMinimaAddress(mxAddress);
    expect(converted).toBe("0X");
  });
});