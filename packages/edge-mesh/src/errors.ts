/**
 * Typed errors for the edge mesh (RFC-063 P3).
 *
 * A framed link has two kinds of failure: a caller mistake (bad MTU, frame too
 * large) and hostile input (a byte stream that does not parse). Callers must be
 * able to tell them apart without string matching, and relays must be able to
 * count rejects without swallowing them.
 */

export type MeshErrorCode =
  | 'mtu-too-small'
  | 'frame-too-large'
  | 'too-many-fragments'
  | 'invalid-stream-frame'
  | 'corrupt-frame';

export class MeshError extends Error {
  constructor(readonly code: MeshErrorCode, message: string) {
    super(message);
    this.name = 'MeshError';
  }
}

/** The link MTU cannot carry even one header-sized fragment. */
export class MtuTooSmallError extends MeshError {
  constructor(minimumExclusive: number) {
    super('mtu-too-small', `MTU too small for the mesh header (must exceed ${minimumExclusive})`);
    this.name = 'MtuTooSmallError';
  }
}

/** The payload exceeds what this MTU can express in `MAX_FRAGMENTS` packets. */
export class FrameTooLargeError extends MeshError {
  constructor(length: number, limit: number) {
    super('frame-too-large', `frame of ${length} bytes exceeds the mesh limit of ${limit}`);
    this.name = 'FrameTooLargeError';
  }
}

export class TooManyFragmentsError extends MeshError {
  constructor(total: number, limit: number) {
    super('too-many-fragments', `frame needs ${total} fragments; the wire format allows ${limit}`);
    this.name = 'TooManyFragmentsError';
  }
}

/** A length-prefixed bridge frame declared a length that cannot be valid. */
export class InvalidStreamFrameError extends MeshError {
  constructor(length: number) {
    super('invalid-stream-frame', `invalid Minima frame length ${length} on the bridge stream`);
    this.name = 'InvalidStreamFrameError';
  }
}

/** Why a received packet was not accepted into a frame. */
export type MeshRejectReason =
  | 'short-header'
  | 'bad-magic'
  | 'unsupported-version'
  | 'bad-header'
  | 'crc'
  | 'duplicate'
  | 'frame-too-large';

/**
 * Called for every dropped packet. Relays should count these: silent drops make
 * a hostile or broken peer indistinguishable from an idle link.
 */
export type MeshRejectSink = (reason: MeshRejectReason) => void;
