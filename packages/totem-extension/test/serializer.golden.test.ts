import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { mkBundleDeterministic } from "./utils/fixture";
import { serializeWitnessBundleToHex } from "../src/core/wots/serialize";

const GOLDEN = path.join(__dirname, "goldens", "witness.placeholder.hex");
const UPDATE = process.env.UPDATE_GOLDENS === "1";

describe("Totem serializer goldens", () => {
  it("witness HEX matches golden (update with UPDATE_GOLDENS=1)", () => {
    const bundle = mkBundleDeterministic();
    const hex = serializeWitnessBundleToHex(bundle);

    if (UPDATE) {
      fs.writeFileSync(GOLDEN, hex + "\n", "utf8");
      console.log("[golden updated]", GOLDEN);
    }

    const expected = fs.readFileSync(GOLDEN, "utf8").trim();
    expect(hex).toBe(expected);
  });

  it("has exactly 3 signature proofs and correct lengths", () => {
    const b = mkBundleDeterministic();
    expect(Object.keys(b.proofs)).toEqual(["l1_to_l2","l2_to_l3","tx"]);
    for (const key of ["l1_to_l2","l2_to_l3","tx"] as const) {
      const p = b.proofs[key];
      expect(Array.isArray(p.signature)).toBe(true);
      expect(p.signature.length).toBeGreaterThanOrEqual(1); // 90 in real flow
      expect(p.proof.prooflength).toBe(p.proof.proof.length);
    }
  });
});