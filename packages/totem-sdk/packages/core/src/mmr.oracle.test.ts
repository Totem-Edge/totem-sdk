import { describe, it, expect } from "vitest";
import { mmrRootFromSingleLeaf } from "./mmr";
import { bytesToHex } from "@totemsdk/core";

const enc = (s: string) => new TextEncoder().encode(s);

describe("MMR roots (single-leaf) – Minima oracles", () => {
  it("RETURN TRUE", () => {
    const root = mmrRootFromSingleLeaf("RETURN TRUE");
    expect(bytesToHex(root).toUpperCase()).toBe(
      "582AA40EA996419A3D8A5D26039A4E9584B746C2C26F860DAC8372BEA4457AF6"
    );
  });

  it("LET x 1 RETURN x == 1", () => {
    const root = mmrRootFromSingleLeaf("LET x 1 RETURN x == 1");
    expect(bytesToHex(root).toUpperCase()).toBe(
      "B3FA26AEA3FFD4367C23DFFEB55C17BE75AE4A923E4A3A9E790CFEFC5A96FB93"
    );
  });

  it("RETURN SIGNEDBY(0xFFFF)", () => {
    const root = mmrRootFromSingleLeaf("RETURN SIGNEDBY(0xFFFF)");
    expect(bytesToHex(root).toUpperCase()).toBe(
      "65EC70E6DEF38CBC8E1556305F06637BF8D6B0EF5719C3CD9386981D250B9E95"
    );
  });
});