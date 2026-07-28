import { mmrRootFromSingleLeaf } from "./mmr.js";
import { makeMxAddress, parseMxAddress } from "./minima32.js";

export function scriptToAddress(script: string): string {
  const root32 = mmrRootFromSingleLeaf(script);
  return makeMxAddress(root32);
}

export function addressToRoot(mx: string): Uint8Array {
  return parseMxAddress(mx);
}
