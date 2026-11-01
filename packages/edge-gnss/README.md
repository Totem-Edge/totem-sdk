# @totemsdk/edge-gnss

Edge runtime adapter for GNSS — GPS/RTK fixes, NMEA 0183 parsing, location proofs.

## Install

```bash
npm install @totemsdk/edge-gnss
```

## Design

The connector does not open serial ports or call a platform location API. A
receiver binding is injected through `GnssTransportPort`, so the same gateway
works with a serial NMEA reader, a modem AT interface, a phone location API, a
ROS/GNSS bridge or a deterministic simulator.

Fixes are validated before they are signed: latitude/longitude bounds,
observation time, and a non-`none` fix type. Malformed or absent fixes never
become proofs.

## Quick start

```ts
import { createGnssGateway, createGnssSensorBridge } from '@totemsdk/edge-gnss';
import type { GnssTransportPort } from '@totemsdk/edge-gnss';

const transport: GnssTransportPort = {
  async start() { /* open the receiver */ },
  async stop() { /* close it */ },
  async getFix() { return latestFix; },
  onFix(handler) { /* call handler(fix) on updates */ return () => {}; },
  onError(handler) { /* receiver errors */ return () => {}; },
};

const gateway = createGnssGateway({ runtime, transport });
await gateway.start(); // fixes become gnss:<source> proofs

const current = await gateway.getFix();

const bridge = createGnssSensorBridge({
  runtime,
  transport,
  bindings: [{ sensorId: 'rover', intervalMs: 5000, dataType: 'position' }],
});
await bridge.start(); // fixes become sensor:rover proofs
```

## NMEA 0183

`parseNmeaSentence` and `parseNmeaFix` parse GGA, RMC and GSA from any talker
ID (GP, GN, GL, GA, BD, …) with mandatory checksums:

```ts
import { parseNmeaFix } from '@totemsdk/edge-gnss';

const fix = parseNmeaFix([gga, rmc, gsa], { source: 'rtk' });
// lat/lon, altitude, speed (m/s), heading, satellites, hdop/vdop/pdop,
// fixType (2d/3d/dgps/rtk-float/rtk-fixed/estimated) and observedAt
```

Quality `0`, RMC status `V`, absent positions, bad checksums and malformed
fields produce no fix. NMEA two-digit years use the standard 1980–2079 pivot.

## Fix and proof shape

A fix carries WGS-84 `lat`/`lon`, optional `altitudeM`, `speedMps`,
`headingDeg`, `accuracyM`, `hdop`/`vdop`/`pdop`, `satellitesUsed`, `fixType`,
`source`, `observedAt` and optional raw/NMEA metadata.

Gateway proofs use `gnss:<source>`; sensor-bridge proofs use `sensor:<id>` and
include the position, fix quality and DOP/satellite claims. Raw receiver bytes
and NMEA sentences are not copied into proof claims.

## Qualification status

`@totemsdk/edge-gnss` is **RC**. The qualified profile is the port-injected GNSS
fix pipeline with NMEA GGA/RMC/GSA vectors and a simulator integration suite
(start/stop, fix streaming, invalid-fix rejection, error-state recovery, bridge
polling and teardown).

Not qualified: physical receivers, serial/USB NMEA transports, phone OS
location APIs, RTK correction streams, geofencing and spoofing/jamming
detection. Those remain the responsibility of the injected transport or a
higher-level location-proof policy.

## Testing

Tests live outside the published package. Package `test:*` scripts are
repository delegates; tests are not shipped.

- Unit (NMEA vectors, gateway, bridge): `npm test`
- Simulator integration: `npm run test:integration`

## License

Apache-2.0 — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
