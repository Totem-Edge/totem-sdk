export class BinWriter {
  #buf: number[] = [];
  get bytes(): Uint8Array { return new Uint8Array(this.#buf); }

  writeU8(n: number)  { this.#buf.push(n & 0xff); }
  writeU16(n: number) { this.#buf.push((n >>> 8) & 0xff, n & 0xff); }        // big-endian
  writeU32(n: number) {
    this.#buf.push((n>>>24)&0xff, (n>>>16)&0xff, (n>>>8)&0xff, n&0xff);
  }
  writeU64(bi: bigint) {
    // big-endian 8 bytes
    const out = new Uint8Array(8);
    let x = bi;
    for (let i = 7; i >= 0; i--) {
      out[i] = Number(x & 0xffn);
      x >>= 8n;
    }
    this.writeBytes(out);
  }
  writeBytes(b: Uint8Array) { for (const x of b) this.#buf.push(x); }
}