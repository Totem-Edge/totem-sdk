/**
 * GNSS transport port — injected by the caller.
 *
 * The connector owns fix validation, NMEA parsing and proof shaping. The
 * caller supplies the receiver binding: a serial NMEA reader, a modem AT
 * interface, a phone location API, or a simulator.
 */

export type GnssFixType =
  | 'none'
  | '2d'
  | '3d'
  | 'dgps'
  | 'rtk-float'
  | 'rtk-fixed'
  | 'estimated';

export interface GnssFix {
  /** WGS-84 latitude in degrees. */
  lat: number;
  /** WGS-84 longitude in degrees. */
  lon: number;
  altitudeM?: number;
  speedMps?: number;
  headingDeg?: number;
  accuracyM?: number;
  hdop?: number;
  vdop?: number;
  pdop?: number;
  satellitesUsed?: number;
  fixType: GnssFixType;
  /** Source label, e.g. gnss, gps, rtk, cell, wifi. */
  source: string;
  /** Observation time in ms since epoch. */
  observedAt: number;
  /** Optional raw receiver payload. */
  raw?: Uint8Array;
  /** Optional NMEA sentences that produced this fix. */
  nmea?: string[];
  metadata?: Record<string, unknown>;
}

export interface GnssTransportPort {
  /** Start the receiver / location stream. */
  start(): Promise<void>;
  /** Stop the receiver and release resources. */
  stop(): Promise<void>;
  /** Latest known fix, or null when no fix is available. */
  getFix(): Promise<GnssFix | null>;
  /** Register a handler for fix updates. */
  onFix(handler: (fix: GnssFix) => void): () => void;
  /** Register a handler for receiver errors. */
  onError(handler: (err: Error) => void): () => void;
}
