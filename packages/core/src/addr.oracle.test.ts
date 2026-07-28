import { describe, it, expect } from "vitest";
import { scriptToAddress } from "./derive";
import { decodeMx } from "../../base32/src/minima32";
import { bytesToHex } from "@totemsdk/core";

describe("Script → Mx (Minima oracles)", () => {
  it("RETURN TRUE", () => {
    const mx = scriptToAddress("RETURN TRUE");
    expect(mx).toBe("MxG082Z5AW0TACM86D3R2WT4Z1PKJKYGWRKDGM2DU30RB43EAVA8HBQURHCQE9V");
    // payload should equal oracle root
    expect(bytesToHex(decodeMx(mx)).toUpperCase()).toBe(
      "582AA40EA996419A3D8A5D26039A4E9584B746C2C26F860DAC8372BEA4457AF6"
    );
  });

  it("LET x 1 RETURN x == 1", () => {
    const mx = scriptToAddress("LET x 1 RETURN x == 1");
    expect(mx).toBe("MxG085JV8JAT8VVQGR7Z8UVVQQYZ5TUEMN4Y4HU98T9SU8CVRU5Y5NRWFVU5MEF");
  });

  it("RETURN SIGNEDBY(0xFFFF)", () => {
    const mx = scriptToAddress("RETURN SIGNEDBY(0xFFFF)");
    expect(mx).toBe("MxG0835THZEDNNJHWU8S5AM61FGCZRRV3BB1RQN371SR4S6J0EWA2SUWYS7MZVQ");
  });
});