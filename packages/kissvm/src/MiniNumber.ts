// Matching Java's `org.minima.objects.base.MiniNumber` backed by `BigDecimal`
// with MathContext(64, RoundingMode.DOWN).
//
// NOTE: This file mirrors the implementation in @totemsdk/core.
// When @totemsdk/core is published with MiniNumber, this file can be removed
// and all imports changed to `import { MiniNumber } from '@totemsdk/core'`.

const MAX_DIGITS = 64;
const MAX_DECIMAL_PLACES = MAX_DIGITS - 20;
const MAX_VALUE_BIG = (1n << 64n) - 1n; // 2^64 - 1

function checkLimits(unscaled: bigint, scale: number): void {
  if (scale > MAX_DECIMAL_PLACES) {
    const diff = scale - MAX_DECIMAL_PLACES;
    const divisor = 10n ** BigInt(diff);
    unscaled = unscaled / divisor;
    scale = MAX_DECIMAL_PLACES;
  }
  const abs = unscaled < 0n ? -unscaled : unscaled;
  const factor = 10n ** BigInt(scale);
  const intPart = abs / factor;
  const rem = abs % factor;
  if (intPart > MAX_VALUE_BIG || (intPart === MAX_VALUE_BIG && rem > 0n)) {
    throw new RangeError(`MiniNumber too large: ${unscaled}E${-scale}`);
  }
}

function digits(v: bigint): number {
  if (v === 0n) return 0;
  return v.toString().replace('-', '').length;
}

function roundToDigits(unscaled: bigint, scale: number, digits_target: number): { unscaled: bigint; scale: number } {
  let u = unscaled;
  let s = scale;
  const currentDigits = digits(u);
  if (currentDigits > digits_target) {
    const drop = currentDigits - digits_target;
    const divisor = 10n ** BigInt(drop);
    u = u / divisor;
    s = s - drop;
  }
  if (s > MAX_DECIMAL_PLACES) {
    const diff = s - MAX_DECIMAL_PLACES;
    const divisor = 10n ** BigInt(diff);
    u = u / divisor;
    s = s - diff;
  }
  while (s > 0 && u % 10n === 0n) {
    u = u / 10n;
    s--;
  }
  return { unscaled: u, scale: s };
}

export class MiniNumber {
  readonly unscaled: bigint;
  readonly scale: number;

  static readonly ZERO = new MiniNumber(0);
  static readonly ONE = new MiniNumber(1);
  static readonly TWO = new MiniNumber(2);
  static readonly THREE = new MiniNumber(3);
  static readonly FOUR = new MiniNumber(4);
  static readonly EIGHT = new MiniNumber(8);
  static readonly TWELVE = new MiniNumber(12);
  static readonly SIXTEEN = new MiniNumber(16);
  static readonly TWENTY = new MiniNumber(20);
  static readonly THIRTYTWO = new MiniNumber(32);
  static readonly FIFTY = new MiniNumber(50);
  static readonly SIXTYFOUR = new MiniNumber(64);
  static readonly TWOFIVESIX = new MiniNumber(256);
  static readonly FIVEONE12 = new MiniNumber(512);
  static readonly THOUSAND24 = new MiniNumber(1024);
  static readonly MINUSONE = new MiniNumber(-1);

  constructor(value: string | number | bigint | MiniNumber) {
    if (value instanceof MiniNumber) {
      this.unscaled = value.unscaled;
      this.scale = value.scale;
      return;
    }
    if (typeof value === 'bigint') {
      this.unscaled = value;
      this.scale = 0;
      if (value !== 0n) { const r = roundToDigits(this.unscaled, this.scale, MAX_DIGITS); this.unscaled = r.unscaled; this.scale = r.scale; checkLimits(this.unscaled, this.scale); }
      return;
    }
    if (typeof value === 'number') {
      const s = Number.isInteger(value) ? value.toFixed(0) : value.toExponential(20);
      const parsed = parseDecimal(s);
      this.unscaled = parsed.unscaled;
      this.scale = parsed.scale;
      if (this.unscaled !== 0n) { const r = roundToDigits(this.unscaled, this.scale, MAX_DIGITS); this.unscaled = r.unscaled; this.scale = r.scale; checkLimits(this.unscaled, this.scale); }
      return;
    }
    const parsed = parseDecimal(value);
    this.unscaled = parsed.unscaled;
    this.scale = parsed.scale;
    if (this.unscaled !== 0n) { const r = roundToDigits(this.unscaled, this.scale, MAX_DIGITS); this.unscaled = r.unscaled; this.scale = r.scale; checkLimits(this.unscaled, this.scale); }
  }

  getAsBigDecimal(): string {
    return this.toString();
  }

  getAsBigInteger(): string {
    const s = this.toString();
    const dot = s.indexOf('.');
    return dot === -1 ? s : s.slice(0, dot);
  }

  toNumber(): number {
    return Number(this.toString());
  }

  toString(): string {
    if (this.unscaled === 0n) return '0';
    const neg = this.unscaled < 0n;
    const abs = neg ? -this.unscaled : this.unscaled;
    let s = abs.toString();
    if (s.length <= this.scale) {
      s = s.padStart(this.scale + 1, '0');
      s = s.slice(0, s.length - this.scale) + '.' + s.slice(s.length - this.scale);
    } else {
      s = s.slice(0, s.length - this.scale) + '.' + s.slice(s.length - this.scale);
    }
    s = s.replace(/(\.[0-9]*?)0+$/, '$1').replace(/\.$/, '');
    return neg ? '-' + s : s;
  }

  private assertSameScale(other: MiniNumber): { a: bigint; b: bigint; outScale: number } {
    if (this.scale === other.scale) return { a: this.unscaled, b: other.unscaled, outScale: this.scale };
    if (this.scale > other.scale) {
      const diff = this.scale - other.scale;
      return { a: this.unscaled, b: other.unscaled * 10n ** BigInt(diff), outScale: this.scale };
    }
    const diff = other.scale - this.scale;
    return { a: this.unscaled * 10n ** BigInt(diff), b: other.unscaled, outScale: other.scale };
  }

  add(other: MiniNumber): MiniNumber {
    const { a, b, outScale } = this.assertSameScale(other);
    const result = a + b;
    const r = roundToDigits(result, outScale, MAX_DIGITS);
    return new MiniNumber(r.unscaled.toString() + 'e' + (-r.scale));
  }

  sub(other: MiniNumber): MiniNumber {
    const { a, b, outScale } = this.assertSameScale(other);
    const result = a - b;
    const r = roundToDigits(result, outScale, MAX_DIGITS);
    return new MiniNumber(r.unscaled.toString() + 'e' + (-r.scale));
  }

  mult(other: MiniNumber): MiniNumber {
    const result = this.unscaled * other.unscaled;
    const outScale = this.scale + other.scale;
    const r = roundToDigits(result, outScale, MAX_DIGITS);
    return new MiniNumber(r.unscaled.toString() + 'e' + (-r.scale));
  }

  div(other: MiniNumber): MiniNumber {
    if (other.unscaled === 0n) throw new Error('Division by zero');
    const extraScale = MAX_DIGITS;
    const scaledThis = this.unscaled * 10n ** BigInt(extraScale);
    const result = scaledThis / other.unscaled;
    const outScale = this.scale + extraScale - other.scale;
    const r = roundToDigits(result, outScale, MAX_DIGITS);
    return new MiniNumber(r.unscaled.toString() + 'e' + (-r.scale));
  }

  modulo(other: MiniNumber): MiniNumber {
    if (other.unscaled === 0n) throw new Error('Modulo by zero');
    const { a, b, outScale } = this.assertSameScale(other);
    const result = a % b;
    return new MiniNumber(result.toString() + 'e' + (-outScale));
  }

  pow(n: number): MiniNumber {
    if (n < 0) throw new Error('Negative power not supported');
    let result = MiniNumber.ONE;
    for (let i = 0; i < n; i++) result = result.mult(this);
    return result;
  }

  sqrt(): MiniNumber {
    if (this.unscaled < 0n) throw new Error('Square root of negative number');
    if (this.unscaled === 0n) return MiniNumber.ZERO;
    const extra = MAX_DIGITS * 2;
    const scaled = this.unscaled * 10n ** BigInt(extra);
    const s = scaled / 10n ** BigInt(extra / 2);
    let x = s;
    const two = 2n;
    for (let i = 0; i < 100; i++) {
      const next = (x + scaled / x) / two;
      if (next === x) break;
      x = next;
    }
    const outScale = (this.scale + extra) / 2;
    const r = roundToDigits(x, outScale, MAX_DIGITS);
    return new MiniNumber(r.unscaled.toString() + 'e' + (-r.scale));
  }

  floor(): MiniNumber {
    if (this.scale === 0) return new MiniNumber(this);
    const divisor = 10n ** BigInt(this.scale);
    const q = this.unscaled / divisor;
    const rem = this.unscaled % divisor;
    if (this.unscaled < 0n && rem !== 0n) {
      return new MiniNumber((q - 1n).toString());
    }
    return new MiniNumber(q.toString());
  }

  ceil(): MiniNumber {
    if (this.scale === 0) return new MiniNumber(this);
    const divisor = 10n ** BigInt(this.scale);
    const q = this.unscaled / divisor;
    const rem = this.unscaled % divisor;
    if (this.unscaled > 0n && rem !== 0n) {
      return new MiniNumber((q + 1n).toString());
    }
    return new MiniNumber(q.toString());
  }

  abs(): MiniNumber {
    if (this.unscaled >= 0n) return new MiniNumber(this);
    return new MiniNumber((-this.unscaled).toString() + 'e' + (-this.scale));
  }

  negate(): MiniNumber {
    return new MiniNumber((-this.unscaled).toString() + 'e' + (-this.scale));
  }

  increment(): MiniNumber {
    return this.add(MiniNumber.ONE);
  }

  decrement(): MiniNumber {
    return this.sub(MiniNumber.ONE);
  }

  compareTo(other: MiniNumber): number {
    const { a, b } = this.assertSameScale(other);
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }

  isEqual(other: MiniNumber): boolean { return this.compareTo(other) === 0; }
  isLess(other: MiniNumber): boolean { return this.compareTo(other) < 0; }
  isLessEqual(other: MiniNumber): boolean { return this.compareTo(other) <= 0; }
  isMore(other: MiniNumber): boolean { return this.compareTo(other) > 0; }
  isMoreEqual(other: MiniNumber): boolean { return this.compareTo(other) >= 0; }

  setSignificantDigits(d: number): MiniNumber {
    if (d > MAX_DIGITS) throw new Error(`Cannot specify this many significant digits ${d}`);
    if (d < 0) throw new Error(`Cannot specify negative significant digits ${d}`);
    const currentDigits = digits(this.unscaled);
    if (currentDigits <= d) return new MiniNumber(this);
    const drop = currentDigits - d;
    const divisor = 10n ** BigInt(drop);
    const newUnscaled = this.unscaled / divisor;
    return new MiniNumber(newUnscaled.toString() + 'e' + (-(this.scale - drop)));
  }

  decimalPlaces(): number {
    return this.scale;
  }
}

function parseDecimal(s: string): { unscaled: bigint; scale: number } {
  s = s.trim();
  const ePos = s.toLowerCase().indexOf('e');
  if (ePos !== -1) {
    const mantissa = s.slice(0, ePos);
    const exponent = parseInt(s.slice(ePos + 1), 10);
    const { unscaled, scale } = parseDecimal(mantissa);
    const newScale = scale - exponent;
    if (newScale < 0) {
      const factor = 10n ** BigInt(-newScale);
      return { unscaled: unscaled * factor, scale: 0 };
    }
    return { unscaled, scale: newScale };
  }
  const neg = s.startsWith('-');
  const abs = neg ? s.slice(1) : s;
  const dot = abs.indexOf('.');
  if (dot === -1) {
    return { unscaled: BigInt(neg ? '-' + abs : abs), scale: 0 };
  }
  const intPart = abs.slice(0, dot) || '0';
  const fracPart = abs.slice(dot + 1);
  const full = intPart + fracPart;
  const scale = fracPart.length;
  return { unscaled: BigInt(neg ? '-' + full : full), scale };
}
