import { describe, it, expect } from "vitest";
import { makeMinimaAddress, convertMinimaAddress } from "../src/mx";

describe("Mx address compat", () => {
  it("roundtrips fixed vector", () => {
    const hex = "0x01E41FCB7F956F510CA1F656C8CF991594BEE6F3A05F489EDA5798F485F21026";
    const mx  = "MxG0801SGFSMVSYDT8GP8FMAR4CV68YWWVEDST0BT49TMWNJ3Q8BSGG4PT3A5RW";

    expect(makeMinimaAddress(hex)).toBe(mx);
    expect(convertMinimaAddress(mx)).toBe(hex.toUpperCase());
  });

  it("various lengths behave like Java tests", () => {
    const samples = [
      "0xFFFF",
      "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
      "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
    ];
    for (const h of samples) {
      const mx = makeMinimaAddress(h);
      const back = convertMinimaAddress(mx);
      expect(back).toBe(h.toUpperCase());
    }
  });
});